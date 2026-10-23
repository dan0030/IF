async function request(method, path, body, { raw = false } = {}) {
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
  categoryConfig: (id) => request('GET', `/categories/${id}/config`),
  saveCategoryConfig: (id, config) => request('PUT', `/categories/${id}/config`, config),

  posts: (params) => request('GET', `/posts${qs(params)}`),
  post: (id) => request('GET', `/posts/${id}`),
  unlock: (id, password) => request('POST', `/posts/${id}/unlock`, { password }),
  createPost: (data) => request('POST', '/posts', data),
  updatePost: (id, data) => request('PUT', `/posts/${id}`, data),
  deletePost: (id) => request('DELETE', `/posts/${id}`),
  react: (id, emoji, undo) => request('POST', `/posts/${id}/react`, { emoji, undo }),

  tags: () => request('GET', '/tags'),
  calendar: (month) => request('GET', `/calendar${qs({ month })}`),

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
