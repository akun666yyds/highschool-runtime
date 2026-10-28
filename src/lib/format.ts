export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分钟`
  return `${safe} 秒`
}

export function formatDate(timestamp: number | string | Date | null): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

export function formatDateTime(timestamp: number | string | Date | null): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  return `${formatDate(timestamp)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function weekday(timestamp: number | string | Date): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return names[new Date(timestamp).getDay()]
}

export function isSameDay(a: number | string | Date, b: number | string | Date): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

export function startOfDay(timestamp: number | string | Date): number {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function percent(score: number | null | undefined, max: number | null | undefined): number {
  if (score == null || !max) return 0
  return Math.round((score / max) * 1000) / 10
}

export function scoreText(score: number | null | undefined): string {
  if (score == null) return '—'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

export function getGaokaoDate(now = new Date()): Date {
  const year = now.getMonth() > 5 || (now.getMonth() === 5 && now.getDate() > 7)
    ? now.getFullYear() + 1
    : now.getFullYear()
  return new Date(`${year}-06-07T09:00:00+08:00`)
}

export function daysUntil(target: Date, now = new Date()): number {
  const a = new Date(target)
  const b = new Date(now)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

export function greeting(now = new Date()): string {
  const hour = now.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}
