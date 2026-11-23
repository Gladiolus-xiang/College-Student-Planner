export interface ChatContext {
  env?: Record<string, string>
  ip?: string
  checkOrigin?: boolean
  allowNoOrigin?: boolean
  log?: (entry: Record<string, unknown>) => void
}

/** 边缘函数与本地开发共用的代理实现，见 chat.js */
export function handleChat(request: Request, ctx?: ChatContext): Promise<Response>
