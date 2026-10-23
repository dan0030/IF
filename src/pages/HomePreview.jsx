import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { hasMobileLayout } from '../lib/device.js'

// 휴대폰 크기(390×844) 창에 실제 사이트를 띄워서, 편집 중인 홈 화면을 저장 전에 미리 보여줘요.
// iframe 안은 진짜 휴대폰 너비라서 모바일용 글자 크기·여백·하단 탭까지 그대로 보여요.
const PHONE_W = 390
const PHONE_H = 844

export function PhonePreview({ home, target, onClose }) {
  const frameRef = useRef(null)
  const panelRef = useRef(null)
  const shellRef = useRef(null)
  const homeRef = useRef(home)
  homeRef.current = home
  const [scale, setScale] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [min, setMin] = useState(false)

  const send = () => {
    const win = frameRef.current?.contentWindow
    if (win) win.postMessage({ type: 'od-home-preview', home: homeRef.current }, window.location.origin)
  }

  // 미리보기 창이 준비됐다고 알려오면 지금 편집본을 보내요.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return
      if (e.data?.type === 'od-preview-ready') send()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // 편집할 때마다 바로 반영 (너무 잦지 않게 살짝 모아서)
  useEffect(() => {
    const t = setTimeout(send, 120)
    return () => clearTimeout(t)
  }, [home])

  useEffect(() => {
    document.documentElement.classList.add('phone-preview-open')
    return () => document.documentElement.classList.remove('phone-preview-open')
  }, [])

  // 창 높이 안에 미리보기 전체(제목줄 포함)가 들어가도록 휴대폰 화면 크기를 줄여요.
  useEffect(() => {
    const fit = () => {
      const panel = panelRef.current
      const shell = shellRef.current
      if (!panel || !shell) return
      // 휴대폰 화면을 뺀 나머지(제목줄·안내·여백) 높이
      const chrome = panel.offsetHeight - shell.offsetHeight + 20
      const availH = window.innerHeight - 24 - chrome
      const availW = window.innerWidth - 56
      setScale(Math.max(0.3, Math.min(1, availH / PHONE_H, availW / PHONE_W)))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [min, target])

  const separate = hasMobileLayout(home)
  const note = separate ? '모바일 전용 홈 화면' : home.mobile?.pages ? '모바일 배치가 꺼져 있어 PC 배치가 보여요' : 'PC 배치가 그대로 보여요'

  return createPortal(
    <aside ref={panelRef} className={`phone-preview ${min ? 'min' : ''}`} aria-label="모바일 홈 화면 미리보기">
      <div className="phone-preview-head">
        <span className="phone-preview-title">
          <span>
            <i className="fa-solid fa-mobile-screen" /> 모바일 미리보기
          </span>
          <small className={separate ? 'on' : ''}>{note}</small>
        </span>
        <div className="row gap-xs">
          <button type="button" className="icon-btn small" onClick={() => setReloadKey((k) => k + 1)} aria-label="새로고침" title="새로고침 (다른 페이지로 넘어갔다면 홈으로 돌아와요)">
            <i className="fa-solid fa-rotate-right" />
          </button>
          <button type="button" className="icon-btn small" onClick={() => setMin((v) => !v)} aria-label={min ? '펼치기' : '접기'}>
            <i className={`fa-solid ${min ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
          </button>
          <button type="button" className="icon-btn small" onClick={onClose} aria-label="미리보기 닫기">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>
      {!min && (
        <>
          {target === 'pc' && separate && <p className="phone-preview-hint">지금은 PC 화면을 편집 중이에요. 휴대폰에는 모바일 전용 배치가 보여요.</p>}
          <div className="phone-shell" ref={shellRef} style={{ width: PHONE_W * scale + 20, height: PHONE_H * scale + 20 }}>
            <iframe
              key={reloadKey}
              ref={frameRef}
              title="모바일 홈 화면 미리보기"
              src="/?preview=mobile"
              style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}
            />
          </div>
        </>
      )}
    </aside>,
    document.body,
  )
}
