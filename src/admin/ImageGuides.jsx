import React, { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { api } from '../lib/api.js'
import { pickFile } from '../lib/image.js'
import { IMAGE_GUIDES, guideText, ratioLabel } from '../lib/imageGuides.js'
import { ImageEditor } from '../components/ImageEditor.jsx'

// 관리 › 이미지 가이드: 자리별 권장 크기표 + 바로 편집해서 올리는 도구
export default function ImageGuidesTab() {
  const app = useApp()
  const [editing, setEditing] = useState(null)
  const [result, setResult] = useState(null)

  async function start(guide) {
    const [file] = await pickFile('image/*')
    if (!file) return
    setEditing({ src: URL.createObjectURL(file), file, guide })
  }

  async function apply(file) {
    try {
      const { url } = await api.upload(file)
      const full = location.origin + url
      setResult({ url, full })
      try {
        await navigator.clipboard.writeText(full)
        app.showToast('올리고 주소를 복사했어요.')
      } catch {
        app.showToast('올렸어요.')
      }
      URL.revokeObjectURL(editing.src)
      setEditing(null)
    } catch (e) {
      app.showToast(e.message)
    }
  }

  return (
    <>
      <div className="card padded">
        <p className="muted guide-intro">
          사진을 올리는 칸마다 <b>업로드</b>를 누르면 사진 편집기가 열리고, 그 자리에 맞는 비율로 자르기 틀이 먼저 맞춰져 있어요. 이미 올린 사진도 <b>편집</b>
          버튼으로 다시 자를 수 있어요. 아래 표는 자리별 권장 크기예요. 권장 크기보다 크게 올려도 자동으로 맞춰 보여주지만, 비율이 다르면 가장자리가 잘려요.
        </p>
      </div>

      <div className="guide-grid">
        {Object.entries(IMAGE_GUIDES).map(([key, g]) => {
          const [w, h] = g.size
          const r = g.ratio || (w && h ? w / h : 1.6)
          return (
            <div className="card guide-card" key={key}>
              <div className="guide-shape-wrap">
                <div
                  className={`guide-shape ${g.shape === 'circle' ? 'circle' : ''} ${g.ratio ? '' : 'free'}`}
                  style={{ aspectRatio: String(r), width: r >= 1 ? '100%' : 'auto', height: r >= 1 ? 'auto' : '100%' }}
                >
                  <span>{g.ratio ? ratioLabel(g.ratio) : '자유'}</span>
                </div>
              </div>
              <div className="guide-info">
                <strong>{g.label}</strong>
                <span className="guide-size">{guideText(key)}</span>
                <span className="muted guide-where">{g.where}</span>
                {g.note && <p className="guide-note">{g.note}</p>}
                <button type="button" className="btn small" onClick={() => start(key)}>
                  <i className="fa-solid fa-crop-simple" /> 이 크기로 편집해서 올리기
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {result && (
        <div className="card padded guide-result">
          <img src={result.url} alt="" />
          <div className="my-banner-code">
            <code>{result.full}</code>
            <button
              type="button"
              className="btn small primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.full)
                  app.showToast('복사했어요.')
                } catch {
                  window.prompt('주소', result.full)
                }
              }}
            >
              <i className="fa-regular fa-copy" /> 주소 복사
            </button>
          </div>
        </div>
      )}

      {editing && (
        <ImageEditor
          src={editing.src}
          fileName={editing.file.name}
          guide={editing.guide}
          originalFile={editing.file}
          onCancel={() => {
            URL.revokeObjectURL(editing.src)
            setEditing(null)
          }}
          onApply={apply}
        />
      )}
    </>
  )
}
