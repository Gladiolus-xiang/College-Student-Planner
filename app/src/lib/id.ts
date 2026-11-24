/**
 * 生成前端用的 id。
 * `crypto.randomUUID()` 只在安全上下文（https / localhost）里存在——线上用 http 打开、
 * 或者局域网用 http://10.x 预览时它是 undefined，页面会直接报 "crypto.randomUUID is not a function"。
 * 这里给一个不依赖安全上下文的兜底。
 */
export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
