import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { swapNames, useApp } from '../lib/store.jsx'
import { loadFontsIn } from '../lib/theme.js'

// 글 본문/HTML 위젯을 그려줍니다. 관리자가 쓴 HTML 안의 <script>도 실행해줘요.
export function Content({ html, className = 'prose', runScripts = true }) {
  const { site } = useApp()
  const ref = useRef(null)
  const [lightbox, setLightbox] = useState(null)
  const fnId = useId().replace(/:/g, '')

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
    // 각주: 본문의 각주 표시에 순서대로 번호를 붙이고, 맨 아래에 각주 모음을 만들어요. (서로 눌러서 오갈 수 있게)
    const refs = Array.from(el.querySelectorAll('sup.fn'))
    if (refs.length) {
      const list = document.createElement('ol')
      refs.forEach((sup, i) => {
        const n = i + 1
        const note = sup.dataset.note || ''
        sup.removeAttribute('contenteditable')
        sup.id = `fnref-${fnId}-${n}`
        sup.innerHTML = ''
        const a = document.createElement('a')
        a.href = `#fn-${fnId}-${n}`
        a.className = 'fn-link'
        a.textContent = `[${n}]`
        a.title = note
        a.setAttribute('aria-label', `각주 ${n}: ${note}`)
        sup.appendChild(a)
        const li = document.createElement('li')
        li.id = `fn-${fnId}-${n}`
        li.append(note + ' ')
        const back = document.createElement('a')
        back.href = `#fnref-${fnId}-${n}`
        back.className = 'fn-back'
        back.textContent = '↩'
        back.setAttribute('aria-label', `${n}번 각주가 있는 곳으로`)
        li.appendChild(back)
        list.appendChild(li)
      })
      const section = document.createElement('section')
      section.className = 'footnotes'
      section.setAttribute('aria-label', '각주')
      section.appendChild(list)
      el.appendChild(section)
    }
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
  }, [html, site, runScripts, fnId])

  function onClick(e) {
    // 각주 ↔ 각주 모음: 부드럽게 옮겨가고 잠깐 강조해요.
    const fnLink = e.target.closest?.('a.fn-link, a.fn-back')
    if (fnLink) {
      e.preventDefault()
      const target = ref.current?.querySelector(fnLink.getAttribute('href'))
      if (target) {
        target.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
        target.classList.remove('fn-flash')
        void target.offsetWidth
        target.classList.add('fn-flash')
      }
      return
    }
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
