import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const DEFAULT_BASE = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'
/** 截图识别要用视觉模型；图片 base64 会撑大请求体，所以上限放到 12 MB */
const MAX_BODY = 12 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 120_000

/** 把 .env 读进 process.env（Vite 只会把 VITE_ 前缀的变量暴露给浏览器，服务端要自己读） */
export function loadEnv(): void {
  try {
    process.loadEnvFile(resolve(process.cwd(), '.env'))
  } catch {
    // 没有 .env 就靠系统环境变量，不报错
  }
}

/**
 * 每次请求都重新读 .env。
 * 这样改完 key 不需要重启 dev server —— 少一个必踩的坑。
 */
function readEnvFile(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8').replace(/^\uFEFF/, '')
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      let value = m[2].trim()
      if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'"))) {
        value = value.slice(1, value.endsWith(value[0]) ? -1 : undefined)
      }
      out[m[1]] = value.trim()
    }
  } catch {
    // 文件不存在就用系统环境变量
  }
  return out
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/** 每次调用记一行，比赛文档附录直接用这个文件 */
function logCall(entry: Record<string, unknown>): void {
  try {
    const dir = resolve(process.cwd(), 'logs')
    mkdirSync(dir, { recursive: true })
    appendFileSync(resolve(dir, 'ai-calls.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n')
  } catch {
    // 日志失败不影响主流程
  }
}

/**
 * POST /api/chat  { messages, json?, temperature?, model? }
 * 密钥只存在于服务端，浏览器拿不到。
 */
export async function chatProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') return send(res, 405, { error: '只支持 POST' })

  const fileEnv = readEnvFile()
  const key = (fileEnv.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '').trim()
  if (!key || !/^[\x21-\x7e]+$/.test(key)) {
    return send(res, 500, { error: '缺少 DEEPSEEK_API_KEY：请在 D:\\AIGC\\app\\.env 里填 key（改完直接刷新页面，不用重启）' })
  }
  if (!key.startsWith('sk-')) {
    return send(res, 500, {
      error: `这个 key 不是 DeepSeek 的格式（末尾 ${key.slice(-4)}）`,
      detail: 'DeepSeek 官方 key 一定以 sk- 开头、共 35 位。请到 platform.deepseek.com → API keys 用复制按钮重新取一次。',
    })
  }

  let raw = ''
  try {
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > MAX_BODY) return send(res, 413, { error: '请求体过大' })
    }
  } catch {
    return send(res, 400, { error: '读取请求体失败' })
  }

  let body: { messages?: unknown; json?: boolean; temperature?: number; model?: string }
  try {
    body = JSON.parse(raw)
  } catch {
    return send(res, 400, { error: '请求体不是合法 JSON' })
  }

  const messages = Array.isArray(body.messages) ? body.messages : null
  if (!messages) return send(res, 400, { error: '缺少 messages 字段' })

  const model = body.model || fileEnv.DEEPSEEK_MODEL || process.env.DEEPSEEK_MODEL || DEFAULT_MODEL
  const base = fileEnv.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE
  const payload: Record<string, unknown> = {
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
      logCall({ ok: false, status: upstream.status, model, ms: Date.now() - started })
      if (upstream.status === 401) {
        return send(res, 401, {
          error: `DeepSeek 不认这个 key（401，末尾 ${key.slice(-4)}）`,
          detail: 'key 可能复制不全、已被删除，或来自别的平台。请到 platform.deepseek.com → API keys 重新复制完整一串（以 sk- 开头）。',
        })
      }
      if (upstream.status === 402) {
        return send(res, 402, { error: '账户余额不足（402）', detail: '到 platform.deepseek.com 充值后再试。' })
      }
      return send(res, upstream.status, { error: `模型接口返回 ${upstream.status}`, detail: text.slice(0, 500) })
    }

    const data = JSON.parse(text)
    const content: string = data.choices?.[0]?.message?.content ?? ''
    const ms = Date.now() - started
    logCall({ ok: true, model, ms, usage: data.usage, chars: content.length })
    return send(res, 200, { content, model, ms, usage: data.usage })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const timedOut = message.includes('timed out') || message.includes('abort')
    logCall({ ok: false, model, ms: Date.now() - started, error: message })
    return send(res, 502, {
      error: timedOut ? '模型响应超时，请重试（识别截图会比纯文字慢）' : '调用模型失败',
      detail: message,
    })
  }
}
