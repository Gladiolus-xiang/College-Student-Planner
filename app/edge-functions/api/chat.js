/**
 * POST /api/chat —— 调 DeepSeek 的唯一实现。
 *
 * 部署时：EdgeOne Makers 的边缘函数（edge-functions/api/chat.js → /api/chat）。
 * 本地时：vite.config.ts 的中间件导入这里的 handleChat，用 Node 跑同一份代码。
 * 所以「代理怎么写」只有这一处。
 *
 * 三条边界：
 * 1. 密钥只从环境变量读，浏览器永远拿不到；
 * 2. 只接受同源页面发来的请求（Origin 必须和站点一致），防止别人拿这个地址当免费 API；
 * 3. 每日调用次数记进 KV（全局 + 单 IP 各一个），超额返回 429。
 */

const DEFAULT_BASE = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'
const UPSTREAM_TIMEOUT_MS = 55_000
/** 边缘函数请求体上限 1 MB，前端已把截图压到 1280px，留出 JSON 开销的余量 */
const MAX_BODY_CHARS = 900 * 1024
const DEFAULT_DAILY_LIMIT = 400
const DEFAULT_IP_DAILY_LIMIT = 30

/** 边缘函数只有 JS 运行时的 fetch，所以响应一律手工拼 */
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

/** 环境变量可能来自 edgeone 控制台，也可能来自本地 .env */
function readEnv(env, name) {
  const value = env && env[name]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * KV 绑定的变量名在控制台里配，所以既可能挂在 env 上，也可能被注入成全局变量
 * （官方示例直接用 `my_kv.get(...)`）。两种都兼容，都没有就跳过限流，不影响主流程。
 */
function resolveKv(env) {
  const fromEnv = env && env.QUOTA
  if (fromEnv && typeof fromEnv.get === 'function' && typeof fromEnv.put === 'function') return fromEnv
  if (typeof QUOTA !== 'undefined' && QUOTA && typeof QUOTA.get === 'function') return QUOTA
  return null
}

/** KV 的 key 只允许字母、数字、下划线 */
function beijingDay() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '')
}

async function hashIp(ip) {
  try {
    const data = new TextEncoder().encode(ip)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest).slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return 'unknown'
  }
}

/**
 * 额度检查：先读后写。KV 是最终一致（跨节点最多 60 秒），并发下会少量超发，
 * 作为「防链接被转发到陌生大群」的刹车足够，不要当计费依据。
 */
async function takeQuota(kv, ip, env) {
  const dailyLimit = Math.max(1, Number(readEnv(env, 'DAILY_LIMIT')) || DEFAULT_DAILY_LIMIT)
  const ipLimit = Math.max(1, Number(readEnv(env, 'IP_DAILY_LIMIT')) || DEFAULT_IP_DAILY_LIMIT)
  if (!kv) return { ok: true, kv: false, used: 0, dailyLimit }

  const day = beijingDay()
  const globalKey = `g_${day}`
  // 拿不到客户端 IP 时只记总账，否则所有访客会挤在同一个 key 上互相顶掉额度
  const ipKey = ip ? `ip_${day}_${await hashIp(ip)}` : ''

  try {
    const [globalUsed, ipUsed] = await Promise.all([kv.get(globalKey), ipKey ? kv.get(ipKey) : Promise.resolve(null)])
    const used = Number(globalUsed) || 0
    if (used >= dailyLimit) return { ok: false, kv: true, used, dailyLimit, scope: 'day' }
    if (ipKey && (Number(ipUsed) || 0) >= ipLimit) {
      return { ok: false, kv: true, used, dailyLimit, scope: 'ip', ipLimit }
    }

    const writes = [kv.put(globalKey, String(used + 1))]
    if (ipKey) writes.push(kv.put(ipKey, String((Number(ipUsed) || 0) + 1)))
    await Promise.all(writes)
    return { ok: true, kv: true, used: used + 1, dailyLimit }
  } catch (err) {
    // 存储挂了不能连累主流程：放行，但留一条日志
    console.warn('[chat] 额度检查失败，本次放行', err && err.message)
    return { ok: true, kv: false, used: 0, dailyLimit }
  }
}

/** 客户端 IP：边缘函数可能放在 request.eo 上，也可能只在转发头里；取不到就返回空串 */
function clientIpOf(request, fallback) {
  if (fallback) return String(fallback)
  const eo = request.eo || {}
  const fromEo = eo.clientIp || (eo.geo && eo.geo.ip)
  if (fromEo) return String(fromEo)
  for (const name of ['eo-connecting-ip', 'x-forwarded-for', 'x-real-ip']) {
    const value = request.headers.get(name)
    if (value) return value.split(',')[0].trim()
  }
  return ''
}

async function readBody(request) {
  const declared = Number(request.headers.get('content-length'))
  if (declared && declared > MAX_BODY_CHARS) return { error: '请求体过大，截图请先裁剪' }
  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) return { error: '请求体过大，截图请先裁剪' }
  try {
    return { body: JSON.parse(text) }
  } catch {
    return { error: '请求体不是合法 JSON' }
  }
}

/**
 * @param {Request} request
 * @param {object} [ctx]
 * @param {Record<string, string>} [ctx.env]        环境变量（生产：控制台；本地：.env）
 * @param {string} [ctx.ip]                        客户端 IP；边缘函数用 x-forwarded-for
 * @param {boolean} [ctx.checkOrigin]              是否要求同源，默认 true
 * @param {boolean} [ctx.allowNoOrigin]            允许没有 Origin 的请求（本地回归脚本用）
 * @param {(entry: object) => void} [ctx.log]      调用日志；本地写 logs/ai-calls.jsonl
 */
export async function handleChat(request, ctx = {}) {
  const { env = {}, checkOrigin = true, allowNoOrigin = false, log } = ctx

  if (request.method !== 'POST') return json({ error: '只支持 POST' }, 405)

  if (checkOrigin) {
    const origin = request.headers.get('origin')
    const self = new URL(request.url).host
    const hostOf = (url) => {
      try {
        return new URL(url).host
      } catch {
        return ''
      }
    }
    if (origin) {
      if (hostOf(origin) !== self) return json({ error: '这个地址只给本站页面用' }, 403)
    } else if (!allowNoOrigin) {
      // 少数浏览器/环境不发 Origin，退一步看 Referer；两者都没有就拒绝
      const referer = request.headers.get('referer')
      if (!referer || hostOf(referer) !== self) return json({ error: '缺少来源信息，请求被拒绝' }, 403)
    }
  }

  const key = readEnv(env, 'DEEPSEEK_API_KEY')
  if (!key) {
    return json({ error: '服务端没有配置 DEEPSEEK_API_KEY', detail: '本地：写进 app/.env；线上：控制台 → 环境变量，改完重新部署' }, 500)
  }
  if (!/^[\x21-\x7e]+$/.test(key) || !key.startsWith('sk-')) {
    return json({ error: `这个 key 不是 DeepSeek 的格式（末尾 ${key.slice(-4)}）` }, 500)
  }

  const { body, error } = await readBody(request)
  if (error) return json({ error }, 413)
  const messages = Array.isArray(body.messages) ? body.messages : null
  if (!messages) return json({ error: '缺少 messages 字段' }, 400)

  const kv = resolveKv(env)
  const ip = clientIpOf(request, ctx.ip)
  const quota = await takeQuota(kv, ip, env)
  if (!quota.ok) {
    const message =
      quota.scope === 'ip'
        ? `今天这一台设备已经用了 ${quota.ipLimit} 次，明天 0 点再来`
        : `今天的 AI 额度（${quota.dailyLimit} 次）用完了，明天 0 点重置`
    return json({ error: message }, 429, { 'X-Quota-Left': '0' })
  }

  const model = body.model || readEnv(env, 'DEEPSEEK_MODEL') || DEFAULT_MODEL
  const base = readEnv(env, 'DEEPSEEK_BASE_URL') || DEFAULT_BASE
  const payload = {
    model,
    messages,
    stream: false,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.2,
  }
  if (body.json) payload.response_format = { type: 'json_object' }

  const started = Date.now()
  try {
    const upstream = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    const text = await upstream.text()
    if (!upstream.ok) {
      log?.({ ok: false, status: upstream.status, model, ms: Date.now() - started })
      if (upstream.status === 401) {
        return json({ error: `DeepSeek 不认这个 key（401，末尾 ${key.slice(-4)}）`, detail: 'key 可能复制不全或已被删除，请到 platform.deepseek.com 重新复制' }, 401)
      }
      if (upstream.status === 402) {
        return json({ error: '账户余额不足（402）', detail: '到 platform.deepseek.com 充值后再试' }, 402)
      }
      return json({ error: `模型接口返回 ${upstream.status}`, detail: String(text).slice(0, 500) }, upstream.status)
    }

    const data = JSON.parse(text)
    const content = data.choices?.[0]?.message?.content ?? ''
    const ms = Date.now() - started
    log?.({ ok: true, model, ms, usage: data.usage, chars: content.length })
    return json({ content, model, ms, usage: data.usage }, 200, { 'X-Quota-Used': String(quota.used) })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const timedOut = message.includes('timed out') || message.includes('abort')
    log?.({ ok: false, model, ms: Date.now() - started, error: message })
    return json(
      { error: timedOut ? '模型响应超时，请重试（识别截图会比纯文字慢）' : '调用模型失败', detail: message },
      502,
    )
  }
}

/** 平台按导出的 Handler 生成路由；只导出这一个入口，非 POST 由 handleChat 内部拒绝 */
export function onRequest(context) {
  return handleChat(context.request, {
    env: context.env,
    ip: context.clientIp,
    log: (entry) => console.log('[chat]', JSON.stringify(entry)),
  })
}
