import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { swapNames, useApp } from '../lib/store.jsx'
import { loadFontsIn } from '../lib/theme.js'

// 글 본문/HTML 위젯을 그려줍니다. 관리자가 쓴 HTML 안의 <script>도 실행해줘요.
export function Content({ html, className = 'prose', runScripts = true }) {
  const { site } = useApp()
  const ref = useRef(null)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = swapNames(html || '', site)
    if (runScripts) {
      el.querySelectorAll('script').forEach((old) => {
        const s = document.createElement('script')
        for (const attr of old.attributes) s.setAttribute(attr.name, attr.value)
        s.textContent = old.textContent
        old.replaceWith(s)
      })
    }
    el.querySelectorAll('table').forEach((t) => {
      if (t.parentElement?.classList.contains('table-wrap')) return
      const wrap = document.createElement('div')
      wrap.className = 'table-wrap'
      t.replaceWith(wrap)
      wrap.appendChild(t)
    })
    loadFontsIn(el)
    el.querySelectorAll('img').forEach((img) => {
      img.loading = 'lazy'
    })
    // 스포일러 사진은 흐리게 가린 틀로 감싸고, 누르면 보여줘요.
    el.querySelectorAll('img.spoiler-img').forEach((img) => {
      if (img.parentElement?.classList.contains('spoiler-img-wrap')) return
      const wrap = document.createElement('span')
      wrap.className = 'spoiler-img-wrap'
      wrap.setAttribute('role', 'button')
      wrap.setAttribute('tabindex', '0')
      wrap.setAttribute('aria-label', '스포일러 사진 · 눌러서 보기')
      const label = document.createElement('span')
      label.className = 'spoiler-img-label'
      label.innerHTML = '<i class="fa-solid fa-eye-slash"></i><span>스포일러 · 눌러서 보기</span>'
      img.replaceWith(wrap)
      wrap.append(img, label)
    })
  }, [html, site, runScripts])

  function onClick(e) {
    const spoilerImg = e.target.closest('.spoiler-img-wrap')
    if (spoilerImg && !spoilerImg.classList.contains('revealed')) {
      e.preventDefault()
      spoilerImg.classList.add('revealed')
      spoilerImg.removeAttribute('role')
      spoilerImg.removeAttribute('aria-label')
      return
    }
    const spoiler = e.target.closest('.spoiler')
    if (spoiler) {
      spoiler.classList.toggle('revealed')
      return
    }
    const img = e.target.closest('img')
    if (img && !img.closest('a') && !img.dataset.noZoom) setLightbox(img.src)
  }

  return (
    <>
      <div
        ref={ref}
        className={className}
        onClick={onClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('spoiler-img-wrap')) onClick(e)
        }}
      />
      {lightbox &&
        createPortal(
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="이미지 크게 보기">
          <img src={lightbox} alt="" />
          <button type="button" className="icon-btn" aria-label="닫기">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>,
          document.body,
        )}
    </>
  )
}
