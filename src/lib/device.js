import { useEffect, useState } from 'react'

// 이 너비 이하를 '모바일'로 봐요. (CSS의 @media (max-width: 640px)와 같은 기준)
export const MOBILE_QUERY = '(max-width: 640px)'

// 홈 편집의 '모바일 미리보기' 창(iframe) 안에서 열린 사이트인지
export const IN_PREVIEW = (() => {
  try {
    return window.self !== window.top && new URLSearchParams(window.location.search).get('preview') === 'mobile'
  } catch {
    return false
  }
})()

export function useIsMobile() {
  const get = () => !!window.matchMedia?.(MOBILE_QUERY).matches
  const [mobile, setMobile] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_QUERY)
    if (!mq) return
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return mobile
}

// 모바일 전용 배치를 켜두었고 페이지가 있으면 그걸, 아니면 PC 배치를 그대로 써요.
export function hasMobileLayout(home) {
  return !!(home?.mobile && home.mobile.enabled !== false && home.mobile.pages?.length)
}
