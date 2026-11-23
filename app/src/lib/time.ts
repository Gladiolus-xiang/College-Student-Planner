/** 模型给的时间格式不统一（2026-11-25T20:00:00 / 2026-11-25 20:00 / 2026-11-25），这里统一成 "YYYY-MM-DD HH:mm" */

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DD HH:mm" → Date。解析不了返回 null。全项目只在这里做这件事。 */
export function parseDeadline(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

export function normalizeDeadline(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const s = input.trim().replace('T', ' ')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ ](\d{1,2}):(\d{2}))?/)
  if (!m) return null

  const [, y, mo, d, h, mi] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // 只给了日期、没给时刻：按当天 23:59 算（DDL 通常指“当天结束前”）
  const hour = h === undefined ? 23 : Number(h)
  const minute = mi === undefined ? 59 : Number(mi)
  return `${year}-${pad(month)}-${pad(day)} ${pad(Math.min(23, hour))}:${pad(Math.min(59, minute))}`
}

/** "2026-11-25 20:00" → 距离现在还有多久，用于卡片上显示“还剩 3 天” */
export function humanizeRemaining(deadline: string | null, now = new Date()): string {
  if (!deadline) return '无明确截止'
  const target = parseDeadline(deadline)
  if (!target) return deadline

  const diffMs = target.getTime() - now.getTime()
  if (diffMs < 0) return '已过期'
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.floor(diffMs / 60_000))} 分钟后`
  if (hours < 24) return `${hours} 小时后`
  const days = Math.floor(hours / 24)
  return `${days} 天后`
}
