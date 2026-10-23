import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { IN_PREVIEW } from '../lib/device.js'
import { youtubeId } from '../lib/format.js'
import { useApp } from '../lib/store.jsx'

const BgmContext = createContext(null)

let apiPromise = null
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        resolve(window.YT)
      }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.onerror = () => {
        apiPromise = null
        reject(new Error('YouTube를 불러오지 못했어요.'))
      }
      document.head.appendChild(tag)
    })
  }
  return apiPromise
}

// 사이트 전체에서 하나만 쓰는 BGM 플레이어입니다. (서랍 메뉴와 BGM 위젯이 같은 플레이어를 조작해요)
export function BgmProvider({ children }) {
  const { site } = useApp()
  const tracks = (site.bgm || []).map((t, i) => ({ title: t.title || `Track ${i + 1}`, id: youtubeId(t.url) })).filter((t) => t.id)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolumeState] = useState(50)
  const [error, setError] = useState(null)
  const [videoOpen, setVideoOpen] = useState(false)
  const playerRef = useRef(null)
  const creatingRef = useRef(null)
  const startedRef = useRef(false)
  const holderRef = useRef(null)
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks
  const indexRef = useRef(index)
  indexRef.current = index
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  // 플레이어는 한 번만 만들어요. (미리 준비하는 중에 재생을 눌러도 두 개가 생기지 않게)
  const ensurePlayer = useCallback(() => {
    if (playerRef.current) return Promise.resolve(playerRef.current)
    if (creatingRef.current) return creatingRef.current
    creatingRef.current = loadYouTubeApi()
      .then(
        (YT) =>
          new Promise((resolve) => {
            const el = document.createElement('div')
            holderRef.current.appendChild(el)
            const player = new YT.Player(el, {
              height: '100%',
              width: '100%',
              videoId: tracksRef.current[indexRef.current]?.id,
              playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0 },
              events: {
                onReady: () => {
                  player.setVolume(volumeRef.current)
                  playerRef.current = player
                  setReady(true)
                  resolve(player)
                },
                onStateChange: (e) => {
                  const S = YT.PlayerState
                  setBuffering(e.data === S.BUFFERING)
                  if (e.data === S.PLAYING) {
                    startedRef.current = true
                    setPlaying(true)
                  } else if (e.data === S.PAUSED) setPlaying(false)
                  else if (e.data === S.ENDED) {
                    const n = tracksRef.current.length
                    if (n) {
                      const next = (indexRef.current + 1) % n
                      setIndex(next)
                      player.loadVideoById(tracksRef.current[next].id)
                    }
                  }
                },
                onError: () => setError('이 곡을 재생할 수 없어요. (퍼가기 금지 영상일 수 있어요)'),
              },
            })
          }),
      )
      .catch((e) => {
        creatingRef.current = null
        throw e
      })
    return creatingRef.current
  }, [])

  // 1) 미리 준비: 사이트를 열면 잠시 뒤 플레이어만 불러와 둬요. (소리는 나지 않아요)
  useEffect(() => {
    if (!tracks.length || site.bgmPreload === false || IN_PREVIEW) return
    const t = setTimeout(() => ensurePlayer().catch(() => {}), 1500)
    return () => clearTimeout(t)
  }, [tracks.length, site.bgmPreload, ensurePlayer])

  // 2) 첫 클릭/터치 때 자동 재생 (브라우저는 사용자가 한 번 누르기 전엔 소리를 못 내게 막아요)
  useEffect(() => {
    if (!tracks.length || !site.bgmAutoplay || IN_PREVIEW) return
    const start = (e) => {
      if (startedRef.current || e.target.closest?.('.bgm-card, .bgm-video')) return
      startedRef.current = true
      ensurePlayer()
        .then((p) => p.playVideo())
        .catch(() => {})
      cleanup()
    }
    const cleanup = () => {
      window.removeEventListener('pointerdown', start, true)
      window.removeEventListener('keydown', start, true)
    }
    window.addEventListener('pointerdown', start, true)
    window.addEventListener('keydown', start, true)
    return cleanup
  }, [tracks.length, site.bgmAutoplay, ensurePlayer])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const p = playerRef.current
      if (!p?.getDuration) return
      const d = p.getDuration()
      if (d > 0) setProgress((p.getCurrentTime() / d) * 100)
    }, 500)
    return () => clearInterval(t)
  }, [playing])

  const toggle = useCallback(async () => {
    if (!tracks.length) return
    try {
      setError(null)
      const p = await ensurePlayer()
      startedRef.current = true
      if (p.getPlayerState() === window.YT.PlayerState.PLAYING) p.pauseVideo()
      else p.playVideo()
    } catch (e) {
      setError(e.message)
    }
  }, [tracks.length, ensurePlayer])

  const go = useCallback(
    async (delta) => {
      if (!tracks.length) return
      const next = (index + delta + tracks.length) % tracks.length
      setIndex(next)
      setProgress(0)
      try {
        const p = await ensurePlayer()
        startedRef.current = true
        p.loadVideoById(tracks[next].id)
      } catch (e) {
        setError(e.message)
      }
    },
    [index, tracks, ensurePlayer],
  )

  const setVolume = useCallback((v) => {
    setVolumeState(v)
    playerRef.current?.setVolume?.(v)
  }, [])

  const toggleVideo = useCallback(() => {
    setVideoOpen((v) => !v)
    ensurePlayer().catch((e) => setError(e.message))
  }, [ensurePlayer])

  const value = {
    tracks,
    current: tracks[index] || null,
    playing,
    buffering,
    ready,
    progress,
    volume,
    error,
    videoOpen,
    toggle,
    toggleVideo,
    next: () => go(1),
    prev: () => go(-1),
    setVolume,
  }
  return (
    <BgmContext.Provider value={value}>
      {children}
      {/* 유튜브 플레이어 본체. 접혀 있을 땐 화면 밖에 두고, 펼치면 오른쪽 아래에 떠요. (광고 건너뛰기용) */}
      <div className={`bgm-video ${videoOpen ? 'open' : ''}`} aria-hidden={!videoOpen} inert={videoOpen ? undefined : ''}>
        <div className="bgm-video-head">
          <span>
            <i className="fa-brands fa-youtube" /> {tracks[index]?.title || 'BGM'}
          </span>
          <button type="button" onClick={() => setVideoOpen(false)} aria-label="영상 접기">
            <i className="fa-solid fa-chevron-down" />
          </button>
        </div>
        <div className="bgm-video-frame" ref={holderRef} />
        <p className="bgm-video-help">광고가 나오면 영상 안의 "건너뛰기"를 눌러주세요.</p>
      </div>
    </BgmContext.Provider>
  )
}

export function useBgm() {
  return useContext(BgmContext)
}

export function BgmCard({ compact = false }) {
  const bgm = useBgm()
  const { site } = useApp()
  const empty = !bgm.tracks.length
  return (
    <div className={`bgm-card ${compact ? 'compact' : ''}`}>
      <div className="bgm-info">
        <div className={`bgm-thumb ${bgm.playing ? 'spinning' : ''}`}>
          <i className="fa-solid fa-music" />
        </div>
        <div className="bgm-meta">
          <span className="bgm-title">{empty ? 'BGM이 설정되지 않음' : bgm.current?.title}</span>
          <span className="bgm-sub">{bgm.error || (bgm.playing ? site.bgmLabel || 'Now playing' : bgm.buffering ? '불러오는 중…' : bgm.ready ? 'Ready to play' : '준비 중')}</span>
        </div>
      </div>
      <div className="bgm-controls">
        <button type="button" onClick={bgm.prev} disabled={empty} aria-label="이전 곡">
          <i className="fa-solid fa-backward-step" />
        </button>
        <button type="button" className="bgm-play" onClick={bgm.toggle} disabled={empty} aria-label={bgm.playing ? '일시정지' : '재생'}>
          <i className={`fa-solid ${bgm.playing ? 'fa-pause' : 'fa-play'}`} />
        </button>
        <button type="button" onClick={bgm.next} disabled={empty} aria-label="다음 곡">
          <i className="fa-solid fa-forward-step" />
        </button>
        <button type="button" className={`bgm-video-toggle ${bgm.videoOpen ? 'active' : ''}`} onClick={bgm.toggleVideo} disabled={empty} aria-label={bgm.videoOpen ? '영상 접기' : '영상 펼치기 (광고 건너뛰기)'} title="영상 펼치기 · 광고 건너뛰기">
          <i className="fa-brands fa-youtube" />
        </button>
        <label className="bgm-volume">
          <i className="fa-solid fa-volume-high" aria-hidden="true" />
          <input type="range" min="0" max="100" step="5" value={bgm.volume} onChange={(e) => bgm.setVolume(Number(e.target.value))} disabled={empty} aria-label="음량" />
        </label>
      </div>
      <div className="bgm-progress">
        <div style={{ width: `${bgm.progress}%` }} />
      </div>
    </div>
  )
}
