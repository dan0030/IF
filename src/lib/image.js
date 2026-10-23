import { api } from './api.js'

// 큰 사진은 올리기 전에 줄여서 용량을 아낍니다. (GIF·SVG는 움직임/벡터를 지키려고 그대로 올려요)
export async function prepareImage(file, maxSize = 1800, quality = 0.86, keepPng = false) {
  if (!file.type.startsWith('image/') || /gif|svg|icon/.test(file.type) || /\.cur$/i.test(file.name)) return file
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
    if (scale === 1 && file.size < 900 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const type = keepPng ? 'image/png' : file.type === 'image/png' ? 'image/webp' : 'image/jpeg'
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality))
    if (!blob || (blob.size >= file.size && scale === 1)) return file
    const ext = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg'
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.' + ext, { type })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadFile(file, opts) {
  const prepared = file.type.startsWith('image/') ? await prepareImage(file, opts?.maxSize, 0.86, opts?.keepPng) : file
  const res = await api.upload(prepared)
  return res.url
}

export function pickFile(accept = 'image/*', multiple = false) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files || []))
    input.click()
  })
}
