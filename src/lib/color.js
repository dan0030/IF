// 글자가 배경에 묻혀 안 보이지 않게 색 대비를 계산해요.
// 대비는 사람 눈에 실제로 보이는 정도에 가까운 APCA 방식(Lc, 0~106)으로 재요.
// 이 값보다 낮으면 자동으로 고쳐요. 45는 버튼처럼 굵고 짧은 글자가 읽히는 최소 기준이에요.
export const MIN_CONTRAST = 45

const DARK = '#1a1a1a'
const LIGHT = '#ffffff'

let ctx = null
function canvas() {
  if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d')
  return ctx
}

function parseHex(h) {
  let s = h.slice(1)
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join('')
  if (s.length !== 6 && s.length !== 8) return null
  const n = [0, 2, 4, 6].map((i) => parseInt(s.slice(i, i + 2) || 'ff', 16))
  if (n.some(Number.isNaN)) return null
  return { r: n[0], g: n[1], b: n[2], a: n[3] / 255 }
}

// CSS 색 문자열 → { r, g, b, a }. 이름 색(white 등)·rgb()도 브라우저에게 해석을 맡겨요. 모르는 형식이면 null.
export function parseColor(c) {
  if (!c || typeof c !== 'string') return null
  const s = c.trim()
  if (/^#[0-9a-f]+$/i.test(s)) return parseHex(s)
  const x = canvas()
  if (!x) return null
  x.fillStyle = '#010203'
  x.fillStyle = s
  const v = x.fillStyle
  if (v === '#010203' && s.toLowerCase() !== '#010203') return null
  if (v.startsWith('#')) return parseHex(v)
  const m = v.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const [r, g, b, a = 1] = m[1].split(',').map((t) => parseFloat(t))
  return { r, g, b, a }
}

// 반투명 색은 아래 색(under) 위에 올렸을 때의 색으로 계산해요.
function solid(c, under) {
  const p = typeof c === 'string' ? parseColor(c) : c
  if (!p) return null
  if (p.a >= 1 || !under) return p
  const u = solid(under)
  if (!u) return p
  return { r: p.r * p.a + u.r * (1 - p.a), g: p.g * p.a + u.g * (1 - p.a), b: p.b * p.a + u.b * (1 - p.a), a: 1 }
}

// APCA(0.0.98G) 화면 밝기
function luminance({ r, g, b }) {
  const f = (v) => (v / 255) ** 2.4
  const y = 0.2126729 * f(r) + 0.7151522 * f(g) + 0.072175 * f(b)
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y
}

// 글자(text)를 바탕(bg) 위에 놓았을 때의 APCA 대비 크기 |Lc|. 밝은 바탕·어두운 바탕 모두 양수로 돌려줘요.
function ratio(text, bg) {
  const yt = luminance(text)
  const yb = luminance(bg)
  if (Math.abs(yb - yt) < 0.0005) return 0
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14
    return s < 0.1 ? 0 : (s - 0.027) * 100
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14
  return s > -0.1 ? 0 : -(s + 0.027) * 100
}

// 두 색의 대비 (APCA |Lc|, 0 ~ 106). 해석할 수 없으면 null.
export function contrast(fg, bg, under) {
  const b = solid(bg, under)
  const f = b && solid(fg, b)
  return f ? ratio(f, b) : null
}

// bg 위에 놓을 글자색: 원래 글자색(fg)이 잘 보이면 그대로, 안 보이면 흰색·검정 중 더 잘 보이는 색.
export function readableOn(bg, fg, under) {
  const b = solid(bg, under)
  if (!b) return fg
  const now = fg ? contrast(fg, b) : null
  if (now !== null && now >= MIN_CONTRAST) return fg
  return ratio(parseHex(LIGHT), b) >= ratio(parseHex(DARK), b) ? LIGHT : DARK
}

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

// 색 글자(포인트 색 링크·버튼 글자 등)가 bg에 묻히면, 색감은 살리면서 toward(보통 본문 글자색) 쪽으로 조금씩 진하게 해요.
export function legibleOn(color, bg, toward, under) {
  const b = solid(bg, under)
  const c = b && solid(color, b)
  if (!c || ratio(c, b) >= MIN_CONTRAST) return color
  const t = solid(toward, b) || parseHex(ratio(parseHex(DARK), b) >= ratio(parseHex(LIGHT), b) ? DARK : LIGHT)
  for (let k = 0.1; k <= 1.001; k += 0.1) {
    const m = { r: c.r + (t.r - c.r) * k, g: c.g + (t.g - c.g) * k, b: c.b + (t.b - c.b) * k }
    if (ratio(m, b) >= MIN_CONTRAST) return toHex(m)
  }
  return toHex(t)
}
