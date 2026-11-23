/**
 * 本地开发用的壳：把 Node 的 req/res 翻译成 Web 标准的 Request/Response，
 * 再交给 edge-functions/api/chat.js 的 handleChat —— 部署前后跑的是同一份逻辑。
 *
 * 这里只做三件 Node 特有的事：读 .env、把每次调用记进 logs/ai-calls.jsonl、写回响应。
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleChat } from '../edge-functions/api/chat.js'

/** 本地兜底上限：边缘函数是 1 MB，这里放宽一点，方便本地调试大图 */
const MAX_BODY_BYTES = 10 * 1024 * 1024

/** 把 .env 读进 process.env（Vite 只把 VITE_ 前缀的变量暴露给浏览器，服务端要自己读） */
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

async function readRaw(req: IncomingMessage): Promise<string> {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > MAX_BODY_BYTES) throw new Error('请求体过大')
  }
  return raw
}

/** POST /api/chat 的本地入口，由 vite.config.ts 挂在 dev / preview 中间件上 */
export async function chatProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const raw = req.method === 'POST' ? await readRaw(req) : ''
    const headers = new Headers()
    for (const name of ['content-type', 'origin', 'content-length']) {
      const value = req.headers[name]
      if (typeof value === 'string') headers.set(name, value)
    }

    const request = new Request(`http://${req.headers.host ?? 'localhost'}/api/chat`, {
      method: req.method ?? 'GET',
      headers,
      body: req.method === 'POST' ? raw : undefined,
    })

    const response = await handleChat(request, {
      env: { ...process.env, ...readEnvFile() } as Record<string, string>,
      ip: req.socket.remoteAddress ?? '127.0.0.1',
      // 回归脚本用 Node 的 fetch 直连，没有 Origin 头；本地放行，线上不放
      allowNoOrigin: true,
      log: logCall,
    })

    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const tooLarge = message.includes('请求体过大')
    res.statusCode = tooLarge ? 413 : 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: tooLarge ? '请求体过大' : '本地代理出错', detail: message }))
  }
}
