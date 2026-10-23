export function pad(n) {
  return String(n).padStart(2, '0')
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDate(str) {
  if (!str) return null
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0))
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export function formatDate(str, style = 'dot') {
  const d = parseDate(str)
  if (!d) return ''
  if (style === 'long') return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`
  if (style === 'short') return `${d.getMonth() + 1}.${d.getDate()}`
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}.`
}

export function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 시작일을 1일째로 세는 방식 (스킨의 D-Day 계산과 같아요)
export function daysSince(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today - d) / 86400000)
}

export function ddayLabel(dateStr, mode = 'auto') {
  const diff = daysSince(dateStr)
  if (diff === null) return '날짜 없음'
  if (mode === 'dplus' || (mode === 'auto' && diff >= 0)) return diff >= 0 ? `${diff + 1}일` : `D${diff}`
  if (diff === 0) return 'D-DAY'
  return diff < 0 ? `D${diff}` : `D+${diff}`
}

// 매년 돌아오는 기념일까지 남은 날
export function nextAnnual(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
  return Math.round((next - today) / 86400000)
}

export function isRecent(iso, days = 3) {
  const d = parseDate(iso)
  return d ? Date.now() - d.getTime() < days * 86400000 : false
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function youtubeId(value) {
  const m = String(value || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^\s#]*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/i)
  return m ? m[1] : ''
}

export function uid(prefix = 'w') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}
