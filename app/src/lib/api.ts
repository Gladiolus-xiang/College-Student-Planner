export type TextPart = { type: 'text'; text: string }
export type ImagePart = { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
export type ChatContent = string | Array<TextPart | ImagePart>

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: ChatContent
}

export interface ChatResult {
  content: string
  model: string
  ms: number
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

/** 调本地代理 → DeepSeek。密钥在服务端，前端只发消息。 */
export async function chat(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number; model?: string } = {},
): Promise<ChatResult> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      json: opts.json ?? false,
      temperature: opts.temperature ?? 0.2,
      model: opts.model,
    }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = data?.error ?? `请求失败（${res.status}）`
    const detail = data?.detail ? `：${String(data.detail).slice(0, 200)}` : ''
    throw new Error(error + detail)
  }
  return data as ChatResult
}

/** 模型偶尔会带上 ```json 包裹或前后废话，这里只取第一个 JSON 对象 */
export function extractJson<T>(content: string): T {
  const trimmed = content.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('模型没有返回 JSON')
  return JSON.parse(trimmed.slice(start, end + 1)) as T
}
