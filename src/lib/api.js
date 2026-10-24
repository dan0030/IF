// 같은 목록을 짧은 시간 안에 다시 부르면(뒤로 가기, 홈 위젯 여러 개 등) 서버에 다시 묻지 않고 바로 보여줘요.
// 글을 쓰거나 고치거나 지우는 등 무언가 바뀌면(GET이 아닌 요청) 바로 비워서 새 내용이 보이게 해요.
const CACHE_MS = 60_000
const cache = new Map()
const inflight = new Map()

function cachedGet(path) {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data)
  if (inflight.has(path)) return inflight.get(path) // 똑같은 요청이 동시에 오면 하나로 합쳐요
  const p = request('GET', path)
    .then((data) => {
      cache.set(path, { at: Date.now(), data })
      return data
    })
    .finally(() => inflight.delete(path))
  inflight.set(path, p)
  return p
}

export function clearApiCache() {
  cache.clear()
}

async function request(method, path, body, { raw = false } = {}) {
  if (method !== 'GET') cache.clear()
  const opts = { method, headers: {}, credentials: 'same-origin' }
  if (body instanceof FormData) opts.body = body
  else if (body !== undefined) {
    opts.headers['content-type'] = 'application/json'
    opts.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  const res = await fetch(`/api${path}`, opts)
  if (raw) return res
  let data = null
  try {
    data = await res.json()
  } catch {
    // 응답 본문이 비어 있을 수 있어요.
  }
  if (method !== 'GET') cache.clear() // 바뀐 뒤에 다른 곳에서 미리 받아둔 옛 내용도 비워요
  if (!res.ok) {
    const err = new Error(data?.error || `요청에 실패했어요. (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

function qs(params = {}) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  bootstrap: () => request('GET', '/bootstrap'),
  login: (password) => request('POST', '/login', { password }),
  logout: () => request('POST', '/logout'),
  saveSetting: (key, value) => request('PUT', `/settings/${key}`, value),
  saveCategories: (list) => request('PUT', '/categories', list),
  categoryConfig: (id) => cachedGet(`/categories/${id}/config`),
  saveCategoryConfig: (id, config) => request('PUT', `/categories/${id}/config`, config),

  posts: (params) => cachedGet(`/posts${qs(params)}`),
  post: (id) => request('GET', `/posts/${id}`),
  unlock: (id, password) => request('POST', `/posts/${id}/unlock`, { password }),
  createPost: (data) => request('POST', '/posts', data),
  updatePost: (id, data) => request('PUT', `/posts/${id}`, data),
  deletePost: (id) => request('DELETE', `/posts/${id}`),
  react: (id, emoji, undo) => request('POST', `/posts/${id}/react`, { emoji, undo }),

  tags: () => cachedGet('/tags'),
  calendar: (month) => cachedGet(`/calendar${qs({ month })}`),

  comments: (params) => request('GET', `/comments${qs(params)}`),
  addComment: (data) => request('POST', '/comments', data),
  deleteComment: (id, password) => request('DELETE', `/comments/${id}`, { password }),

  upload: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('POST', '/upload', fd)
  },
  files: () => request('GET', '/files'),
  deleteFile: (key) => request('DELETE', `/files/${encodeURIComponent(key)}`),
  cleanupFiles: (hours) => request('POST', '/files-cleanup', { hours }),
  migrateFiles: () => request('POST', '/files-migrate'),
  exportUrl: '/api/export',
  importAll: (data) => request('POST', '/import', data),
}
