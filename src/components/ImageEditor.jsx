import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IMAGE_GUIDES, guideText, ratioLabel } from '../lib/imageGuides.js'

// 사이트 안에서 쓰는 사진 편집기: 자르기 · 회전/뒤집기 · 크기 조정 · 밝기/대비/채도 · 저장 형식
// src: 편집할 사진 주소(blob: 또는 사이트 주소), guide: imageGuides.js의 키
export function ImageEditor({ src, fileName = 'image', guide, originalFile, onCancel, onApply }) {
  const g = IMAGE_GUIDES[guide] || null
  const [img, setImg] = useState(null)
  const [error, setError] = useState(null)
  const [rot, setRot] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [aspect, setAspect] = useState(g?.ratio ?? null)
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 })
  const [outW, setOutW] = useState(null) // null이면 자동
  const [adj, setAdj] = useState({ brightness: 100, contrast: 100, saturate: 100, gray: false })
  const [format, setFormat] = useState('auto')
  const [quality, setQuality] = useState(0.9)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('crop')
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const drag = useRef(null)

  const isGif = /\.gif($|\?)/i.test(src) || originalFile?.type === 'image/gif'

  useEffect(() => {
    const el = new Image()
    if (!/^(blob:|data:)/.test(src) && new URL(src, location.href).origin !== location.origin) el.crossOrigin = 'anonymous'
    el.onload = () => setImg(el)
    el.onerror = () => setError('사진을 불러오지 못했어요. 다른 사이트의 사진은 편집할 수 없을 수 있어요 — 내려받아서 직접 올려주세요.')
    el.src = src
  }, [src])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onCancel])

  // 회전 후의 원본 크기
  const full = useMemo(() => {
    if (!img) return { w: 1, h: 1 }
    const w = img.naturalWidth
    const h = img.naturalHeight
    return rot % 180 ? { w: h, h: w } : { w, h }
  }, [img, rot])

  const ratioFor = (a) => (a === 'orig' ? full.w / full.h : a)

  function fitCrop(a) {
    const r = ratioFor(a)
    if (!r) return { x: 0, y: 0, w: 1, h: 1 }
    let bw = full.w
    let bh = full.w / r
    if (bh > full.h) {
      bh = full.h
      bw = full.h * r
    }
    const w = bw / full.w
    const h = bh / full.h
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
  }

  // 사진·회전·비율이 바뀌면 자르기 틀을 다시 가운데로 맞춰요.
  useEffect(() => {
    if (img) setCrop(fitCrop(aspect))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, rot, aspect])

  // 미리보기 그리기
  useEffect(() => {
    if (!img || !canvasRef.current) return
    const scale = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight))
    drawTransformed(canvasRef.current, img, rot, flipH, flipV, scale)
  }, [img, rot, flipH, flipV])

  const filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturate}%)${adj.gray ? ' grayscale(1)' : ''}`
  const cropPx = { w: Math.max(1, Math.round(crop.w * full.w)), h: Math.max(1, Math.round(crop.h * full.h)) }
  const autoW = g?.size?.[0] || (g?.size?.[1] ? Math.round((g.size[1] * cropPx.w) / cropPx.h) : Math.min(cropPx.w, 1600))
  const finalW = Math.max(1, Math.round(outW || autoW))
  const finalH = Math.max(1, Math.round((finalW * cropPx.h) / cropPx.w))
  const upscale = finalW > cropPx.w * 1.05

  /* ---------------- 자르기 틀 끌기 ---------------- */

  function onPointerDown(e, mode) {
    e.preventDefault()
    e.stopPropagation()
    const rect = wrapRef.current.getBoundingClientRect()
    drag.current = { mode, px: e.clientX, py: e.clientY, rect, start: crop }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.px) / d.rect.width
    const dy = (e.clientY - d.py) / d.rect.height
    const s = d.start
    const r = ratioFor(aspect)
    let { x, y, w, h } = s
    if (d.mode === 'move') {
      x = Math.min(Math.max(0, s.x + dx), 1 - s.w)
      y = Math.min(Math.max(0, s.y + dy), 1 - s.h)
    } else {
      const left = d.mode.includes('w')
      const top = d.mode.includes('n')
      w = s.w + (left ? -dx : dx)
      h = s.h + (top ? -dy : dy)
      if (r) h = (w * full.w) / (r * full.h)
      if (w < 0.04 || h < 0.04) return
      x = left ? s.x + s.w - w : s.x
      y = top ? s.y + s.h - h : s.y
      if (x < -0.001 || y < -0.001 || x + w > 1.001 || y + h > 1.001) return
      x = Math.max(0, x)
      y = Math.max(0, y)
      w = Math.min(w, 1 - x)
      h = Math.min(h, 1 - y)
    }
    setCrop({ x, y, w, h })
  }

  function onPointerUp() {
    drag.current = null
  }

  /* ---------------- 내보내기 ---------------- */

  async function apply() {
    setBusy(true)
    try {
      const big = document.createElement('canvas')
      drawTransformed(big, img, rot, flipH, flipV, 1)
      const out = document.createElement('canvas')
      out.width = finalW
      out.height = finalH
      const ctx = out.getContext('2d')
      const type = format === 'auto' ? (originalFile?.type === 'image/png' || /\.png($|\?)/i.test(src) || finalW <= 64 ? 'image/png' : 'image/jpeg') : format
      if (type === 'image/jpeg') {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, finalW, finalH)
      }
      ctx.imageSmoothingQuality = 'high'
      ctx.filter = filter
      ctx.drawImage(big, crop.x * big.width, crop.y * big.height, crop.w * big.width, crop.h * big.height, 0, 0, finalW, finalH)
      const blob = await new Promise((resolve, reject) => {
        try {
          out.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 만들지 못했어요.'))), type, quality)
        } catch (err) {
          reject(err)
        }
      })
      const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
      await onApply(new File([blob], `${fileName.replace(/\.\w+$/, '')}-edit.${ext}`, { type }), { edited: true })
    } catch (err) {
      setError(/tainted|insecure/i.test(String(err)) ? '다른 사이트의 사진이라 편집 결과를 저장할 수 없어요. 사진을 내려받아 직접 올려주세요.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const ratioOptions = [
    ...(g?.ratio ? [{ value: g.ratio, label: `${ratioLabel(g.ratio)} 권장` }] : []),
    { value: null, label: '자유' },
    { value: 'orig', label: '원본' },
    ...[1, 4 / 5, 4 / 3, 3 / 4, 16 / 9, 3, 5].filter((r) => !g?.ratio || Math.abs(r - g.ratio) > 0.01).map((r) => ({ value: r, label: ratioLabel(r) })),
  ]

  // body에 바로 붙여서 어디서 열어도 화면 전체를 덮어요.
  return createPortal(
    <div className="img-editor-backdrop" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="img-editor" role="dialog" aria-modal="true" aria-label="사진 편집">
        <div className="img-editor-head">
          <button type="button" className="btn small ghost" onClick={onCancel}>
            취소
          </button>
          <strong>사진 편집</strong>
          <button type="button" className="btn small primary" onClick={apply} disabled={!img || busy}>
            {busy ? '저장 중...' : '완료'}
          </button>
        </div>

        {g && (
          <div className="img-editor-guide">
            <i className="fa-solid fa-ruler-combined" />
            <span>
              <b>{g.label}</b> · {guideText(guide)}
              {g.note && <small>{g.note}</small>}
            </span>
          </div>
        )}
        {isGif && (
          <div className="img-editor-guide warn">
            <i className="fa-solid fa-film" />
            <span>
              GIF를 편집하면 움직임이 사라지고 첫 장면만 남아요. 움짤을 지키려면 <b>원본 그대로 올리기</b>를 눌러주세요.
            </span>
          </div>
        )}

        <div className="img-editor-stage">
          {error ? (
            <p className="form-error">{error}</p>
          ) : !img ? (
            <div className="spinner">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="img-editor-canvas" ref={wrapRef}>
              <canvas ref={canvasRef} style={{ filter }} />
              <div
                className={`crop-box ${g?.shape === 'circle' ? 'circle' : ''}`}
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
                onPointerDown={(e) => onPointerDown(e, 'move')}
              >
                <span className="crop-grid" />
                {['nw', 'ne', 'sw', 'se'].map((h) => (
                  <span key={h} className={`crop-handle ${h}`} onPointerDown={(e) => onPointerDown(e, h)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="img-editor-tabs segmented">
          {[
            ['crop', '자르기', 'fa-solid fa-crop-simple'],
            ['size', '크기', 'fa-solid fa-up-right-and-down-left-from-center'],
            ['adjust', '보정', 'fa-solid fa-sliders'],
          ].map(([k, label, icon]) => (
            <button type="button" key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              <i className={icon} /> {label}
            </button>
          ))}
        </div>

        <div className="img-editor-panel">
          {tab === 'crop' && (
            <>
              <div className="chip-scroll">
                {ratioOptions.map((o) => (
                  <button type="button" key={String(o.value)} className={`chip ${aspect === o.value ? 'active' : ''}`} onClick={() => setAspect(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="row gap-s wrap">
                <button type="button" className="btn small" onClick={() => setRot((r) => (r + 270) % 360)}>
                  <i className="fa-solid fa-rotate-left" /> 왼쪽으로
                </button>
                <button type="button" className="btn small" onClick={() => setRot((r) => (r + 90) % 360)}>
                  <i className="fa-solid fa-rotate-right" /> 오른쪽으로
                </button>
                <button type="button" className={`btn small ${flipH ? 'primary' : ''}`} onClick={() => setFlipH((v) => !v)}>
                  <i className="fa-solid fa-arrows-left-right" /> 좌우 반전
                </button>
                <button type="button" className={`btn small ${flipV ? 'primary' : ''}`} onClick={() => setFlipV((v) => !v)}>
                  <i className="fa-solid fa-arrows-up-down" /> 상하 반전
                </button>
                <button type="button" className="btn small ghost" onClick={() => setCrop(fitCrop(aspect))}>
                  틀 가운데로
                </button>
              </div>
            </>
          )}

          {tab === 'size' && (
            <div className="fields">
              <div className="field">
                <span className="field-label">잘린 부분 원래 크기</span>
                <span>
                  {cropPx.w} × {cropPx.h}px
                </span>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="ie-w">
                  저장할 가로 크기 (세로는 비율에 맞춰 자동)
                </label>
                <div className="row gap-s">
                  <input id="ie-w" type="number" min="1" max="6000" value={finalW} onChange={(e) => setOutW(Number(e.target.value) || null)} />
                  <span className="muted nowrap">× {finalH}px</span>
                </div>
                <div className="chip-scroll">
                  {g?.size?.[0] && (
                    <button type="button" className="chip" onClick={() => setOutW(null)}>
                      권장 {autoW}px
                    </button>
                  )}
                  {[cropPx.w, 1600, 1080, 800, 400, 200].filter((v, i, arr) => arr.indexOf(v) === i).map((v) => (
                    <button type="button" key={v} className={`chip ${finalW === v ? 'active' : ''}`} onClick={() => setOutW(v)}>
                      {v === cropPx.w ? `원래 크기 ${v}` : v}
                    </button>
                  ))}
                </div>
                {upscale && <p className="field-help warn">원래보다 크게 늘리면 흐릿해질 수 있어요.</p>}
              </div>
              <div className="field">
                <span className="field-label">저장 형식</span>
                <div className="segmented">
                  {[
                    ['auto', '자동'],
                    ['image/jpeg', 'JPG'],
                    ['image/png', 'PNG (투명 유지)'],
                    ['image/webp', 'WebP'],
                  ].map(([v, l]) => (
                    <button type="button" key={v} className={format === v ? 'active' : ''} onClick={() => setFormat(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {format !== 'image/png' && (
                <div className="field">
                  <span className="field-label">화질</span>
                  <div className="range-row">
                    <input type="range" min="0.5" max="1" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
                    <output>{Math.round(quality * 100)}%</output>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'adjust' && (
            <div className="fields">
              {[
                ['brightness', '밝기'],
                ['contrast', '대비'],
                ['saturate', '채도'],
              ].map(([k, l]) => (
                <div className="field" key={k}>
                  <span className="field-label">{l}</span>
                  <div className="range-row">
                    <input type="range" min="0" max="200" value={adj[k]} onChange={(e) => setAdj((a) => ({ ...a, [k]: Number(e.target.value) }))} />
                    <output>{adj[k]}%</output>
                  </div>
                </div>
              ))}
              <div className="row gap-s">
                <button type="button" className={`btn small ${adj.gray ? 'primary' : ''}`} onClick={() => setAdj((a) => ({ ...a, gray: !a.gray }))}>
                  흑백
                </button>
                <button type="button" className="btn small ghost" onClick={() => setAdj({ brightness: 100, contrast: 100, saturate: 100, gray: false })}>
                  보정 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="img-editor-foot">
          <span className="muted">
            저장: {finalW} × {finalH}px
          </span>
          {originalFile && (
            <button type="button" className="btn small ghost" onClick={() => onApply(originalFile, { edited: false })} disabled={busy}>
              원본 그대로 올리기
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function drawTransformed(canvas, img, rot, flipH, flipV, scale) {
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const swap = rot % 180 !== 0
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  // 뒤집기를 먼저 해야 회전한 뒤에도 화면 기준 좌우/상하로 뒤집혀요.
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}
