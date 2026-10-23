const enc = new TextEncoder()

function toB64Url(bytes) {
  let s = ''
  const arr = new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function sign(secret, message) {
  const key = await hmacKey(secret)
  return toB64Url(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

export async function verify(secret, message, signature) {
  try {
    const key = await hmacKey(secret)
    return await crypto.subtle.verify('HMAC', key, fromB64Url(signature), enc.encode(message))
  } catch {
    return false
  }
}

// 문자열 두 개를 길이·내용과 무관하게 같은 시간에 비교합니다.
export async function safeEqual(a, b) {
  const key = await hmacKey('compare')
  const [x, y] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(String(a))),
    crypto.subtle.sign('HMAC', key, enc.encode(String(b))),
  ])
  const ax = new Uint8Array(x)
  const ay = new Uint8Array(y)
  let diff = 0
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ ay[i]
  return diff === 0
}

// 방명록·보호글 비밀번호용 해시. (Workers CPU 한도를 고려해 반복 횟수를 낮게 잡았어요)
const ITERATIONS = 5000

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(12))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toB64Url(salt)}$${hash}`
}

export async function checkPassword(password, stored) {
  if (!stored) return false
  const [scheme, iter, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const candidate = await derive(password, fromB64Url(salt), Number(iter))
  return safeEqual(candidate, hash)
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return toB64Url(bits)
}

export function randomId(bytes = 9) {
  return toB64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}
