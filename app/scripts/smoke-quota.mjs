/**
 * 离线回归：/api/chat 的三个边界（来源校验、每日额度、key 缺失）。
 * 不联网 —— 把上游 fetch 换成假响应，直接调 edge-functions/api/chat.js 的 handleChat。
 *
 * 跑法：node scripts/smoke-quota.mjs
 */
import { handleChat } from '../edge-functions/api/chat.js'

const KEY = { DEEPSEEK_API_KEY: 'sk-test-0000000000000000000000000000' }
const realFetch = globalThis.fetch

/** 上游假响应 */
function fakeUpstream() {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 1 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
}

/** 内存版 KV，模拟最终一致存储的接口 */
function fakeKv(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    map,
    async get(key) {
      return map.has(key) ? map.get(key) : null
    },
    async put(key, value) {
      map.set(key, String(value))
    },
  }
}

function beijingDay() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '')
}

const post = (body, origin = 'http://localhost:5173') =>
  new Request('http://localhost:5173/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  })

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

fakeUpstream()
const messages = [{ role: 'user', content: 'hi' }]

// 1. 别站来源一律拒绝
{
  const res = await handleChat(post({ messages }, 'https://evil.example'), { env: KEY, checkOrigin: true })
  check('外站 Origin 被拒', res.status === 403, `${res.status}`)
}

// 2. 同源正常放行
{
  const res = await handleChat(post({ messages }), { env: KEY, checkOrigin: true })
  const data = await res.json()
  check('同源请求放行', res.status === 200 && data.content === 'ok', `${res.status}`)
}

// 3. 没配 key 时给出可操作的提示
{
  const res = await handleChat(post({ messages }), { env: {}, checkOrigin: true })
  check('缺 key 返回 500 且提示环境变量', res.status === 500 && (await res.json()).error.includes('DEEPSEEK_API_KEY'))
}

// 4. 全局日额度用完 → 429
{
  const kv = fakeKv({ [`g_${beijingDay()}`]: '1' })
  const res = await handleChat(post({ messages }), { env: { ...KEY, DAILY_LIMIT: '1', QUOTA: kv }, checkOrigin: true })
  check('全局额度用完返回 429', res.status === 429, `${res.status}`)
}

// 5. 单 IP 额度：同一 IP 第二次被拦，换 IP 仍可用
{
  const kv = fakeKv()
  const env = { ...KEY, DAILY_LIMIT: '100', IP_DAILY_LIMIT: '1', QUOTA: kv }
  const first = await handleChat(post({ messages }), { env, checkOrigin: true, ip: '10.0.0.1' })
  const second = await handleChat(post({ messages }), { env, checkOrigin: true, ip: '10.0.0.1' })
  const other = await handleChat(post({ messages }), { env, checkOrigin: true, ip: '10.0.0.2' })
  check('单 IP 超额被拦（同一 IP 第二次 429）', first.status === 200 && second.status === 429, `${first.status}/${second.status}`)
  check('换 IP 不受影响', other.status === 200, `${other.status}`)
}

// 6. 非 POST
{
  const res = await handleChat(new Request('http://localhost:5173/api/chat'), { env: KEY })
  check('GET 返回 405', res.status === 405, `${res.status}`)
}

// 7. 没有 Origin 时退一步看 Referer（线上模式，不放行裸请求）
{
  const withReferer = new Request('http://localhost:5173/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'http://localhost:5173/' },
    body: JSON.stringify({ messages }),
  })
  const res = await handleChat(withReferer, { env: KEY, checkOrigin: true })
  check('同站 Referer 放行', res.status === 200, `${res.status}`)
}

// 8. 两个头都没有 → 403，挡住 curl 脚本
{
  const bare = new Request('http://localhost:5173/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const res = await handleChat(bare, { env: KEY, checkOrigin: true })
  check('既无 Origin 也无 Referer 被拒', res.status === 403, `${res.status}`)
}

// 9. 拿不到客户端 IP 时只记总账，不会把所有人挤到同一个 key
{
  const kv = fakeKv()
  const env = { ...KEY, DAILY_LIMIT: '100', IP_DAILY_LIMIT: '1', QUOTA: kv }
  const bare = () =>
    new Request('http://localhost:5173/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Referer: 'http://localhost:5173/' },
      body: JSON.stringify({ messages }),
    })
  const first = await handleChat(bare(), { env, checkOrigin: true })
  const second = await handleChat(bare(), { env, checkOrigin: true })
  const ipKeys = [...kv.map.keys()].filter((k) => k.startsWith('ip_'))
  check('无 IP 时不按设备限流（两次都放行）', first.status === 200 && second.status === 200, `${first.status}/${second.status}`)
  check('无 IP 时不写设备 key', ipKeys.length === 0, ipKeys.join(','))
}

globalThis.fetch = realFetch
const failed = results.filter((r) => !r.ok)
console.log(failed.length ? `\n${failed.length} 项失败` : `\n全部通过（${results.length} 项）`)
process.exit(failed.length ? 1 : 0)
