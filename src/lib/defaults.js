// 사이트 · 디자인 · 홈 화면의 기본값입니다.
// 관리자 화면에서 저장한 값이 있으면 그 값이 이 기본값 위에 덮어씌워져요.

export const DEFAULT_SITE = {
  title: '우리의 기록',
  description: '드림 페어 아카이브',
  favicon: '💌',
  pair: {
    pairName: '최애 × 나',
    bio: '둘만의 이야기를 차곡차곡 모아두는 곳',
    me: { name: '나', sub: '@me', image: '', color: '#ff8fab' },
    partner: { name: '최애', sub: '@partner', image: '', color: '#6c9cff' },
    symbol: 'fa-solid fa-heart',
    startDate: '',
    startLabel: '함께한 지',
  },
  links: [
    { name: 'X (Twitter)', url: '', icon: 'fa-brands fa-x-twitter' },
    { name: 'Instagram', url: '', icon: 'fa-brands fa-instagram' },
  ],
  bgm: [],
  bgmLabel: 'Now playing',
  bgmPreload: true,
  bgmAutoplay: false,
  menu: { archive: true, calendar: true, notice: true, guestbook: true, tags: true, banners: true },
  banners: [],
  myBanner: { image: '', url: '', alt: '', note: '' },
  bannerIntro: '함께해 주시는 분들의 배너예요.',
  bannerBoard: { columns: '', columnsMobile: '', fit: 'original', width: 200, height: 0, gap: 14, caption: true },
  bottomNav: [
    { label: '홈', icon: 'fa-solid fa-house', href: '/' },
    { label: '기록', icon: 'fa-solid fa-book-open', href: '/archive' },
    { label: '캘린더', icon: 'fa-regular fa-calendar', href: '/calendar' },
    { label: '방명록', icon: 'fa-regular fa-comment-dots', href: '/guestbook' },
  ],
  features: { comments: true, guestbook: true, reactions: true, showViews: false, nameSwap: true },
  reactions: ['❤️', '🥹', '😭', '✨', '👏'],
  postsPerPage: 12,
  footer: 'ODAN DREAMPAIR',
  events: [], // 캘린더 일정 { id, date, endDate, time, label, note, color, annual }
  guestbookIntro: '다녀간 흔적을 남겨주세요.',
}

/* ------------------------------------------------------------------ */
/* 글꼴                                                                */
/* ------------------------------------------------------------------ */

// family: CSS font-family 이름, google: Google Fonts css2 의 family 파라미터
export const FONTS = [
  { key: 'pretendard', label: 'Pretendard (기본)', family: "'Pretendard Variable', Pretendard" },
  { key: 'system', label: '시스템 글꼴', family: 'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic"' },
  { key: 'noto-sans', label: '본고딕 (Noto Sans KR)', family: "'Noto Sans KR'", google: 'Noto+Sans+KR:wght@300;400;500;700;900' },
  { key: 'ibm-plex', label: 'IBM Plex Sans KR', family: "'IBM Plex Sans KR'", google: 'IBM+Plex+Sans+KR:wght@300;400;500;700' },
  { key: 'gothic-a1', label: 'Gothic A1', family: "'Gothic A1'", google: 'Gothic+A1:wght@300;400;500;700;900' },
  { key: 'nanum-gothic', label: '나눔고딕', family: "'Nanum Gothic'", google: 'Nanum+Gothic:wght@400;700;800' },
  { key: 'gowun-dodum', label: '고운돋움', family: "'Gowun Dodum'", google: 'Gowun+Dodum' },
  { key: 'orbit', label: 'Orbit', family: "'Orbit'", google: 'Orbit' },
  { key: 'noto-serif', label: '본명조 (Noto Serif KR)', family: "'Noto Serif KR'", google: 'Noto+Serif+KR:wght@300;400;600;700;900' },
  { key: 'nanum-myeongjo', label: '나눔명조', family: "'Nanum Myeongjo'", google: 'Nanum+Myeongjo:wght@400;700;800' },
  { key: 'gowun-batang', label: '고운바탕', family: "'Gowun Batang'", google: 'Gowun+Batang:wght@400;700' },
  { key: 'hahmlet', label: '함렛', family: "'Hahmlet'", google: 'Hahmlet:wght@300;400;600;800' },
  { key: 'song-myung', label: '송명', family: "'Song Myung'", google: 'Song+Myung' },
  { key: 'diphylleia', label: 'Diphylleia', family: "'Diphylleia'", google: 'Diphylleia' },
  { key: 'gaegu', label: '개구 (손글씨)', family: "'Gaegu'", google: 'Gaegu:wght@300;400;700' },
  { key: 'hi-melody', label: '하이멜로디 (손글씨)', family: "'Hi Melody'", google: 'Hi+Melody' },
  { key: 'nanum-pen', label: '나눔펜 (손글씨)', family: "'Nanum Pen Script'", google: 'Nanum+Pen+Script' },
  { key: 'gamja', label: '감자꽃 (손글씨)', family: "'Gamja Flower'", google: 'Gamja+Flower' },
  { key: 'poor-story', label: '푸어스토리', family: "'Poor Story'", google: 'Poor+Story' },
  { key: 'single-day', label: '싱글데이', family: "'Single Day'", google: 'Single+Day' },
  { key: 'cute-font', label: '귀여운 글꼴', family: "'Cute Font'", google: 'Cute+Font' },
  { key: 'dongle', label: '동글', family: "'Dongle'", google: 'Dongle:wght@300;400;700' },
  { key: 'jua', label: '주아', family: "'Jua'", google: 'Jua' },
  { key: 'do-hyeon', label: '도현', family: "'Do Hyeon'", google: 'Do+Hyeon' },
  { key: 'sunflower', label: '해바라기', family: "'Sunflower'", google: 'Sunflower:wght@300;500;700' },
  { key: 'yeon-sung', label: '연성', family: "'Yeon Sung'", google: 'Yeon+Sung' },
  { key: 'stylish', label: 'Stylish', family: "'Stylish'", google: 'Stylish' },
  { key: 'gugi', label: '구기', family: "'Gugi'", google: 'Gugi' },
  { key: 'black-han', label: '검은고딕', family: "'Black Han Sans'", google: 'Black+Han+Sans' },
  { key: 'east-sea', label: '동해독도', family: "'East Sea Dokdo'", google: 'East+Sea+Dokdo' },
  { key: 'custom', label: '직접 올린 글꼴', family: "'OD Custom Font'" },
]

/* ------------------------------------------------------------------ */
/* 디자인(테마)                                                         */
/* ------------------------------------------------------------------ */

const ONEUI_LIGHT = {
  accent: '#3e91ff',
  accentText: '#ffffff',
  bg: '#f4f4f6',
  bg2: '#e9eefb',
  surface: '#ffffff',
  surface2: '#f2f2f5',
  text: '#111114',
  textSub: '#6d6d72',
  line: '#e6e6ea',
  drawer: '#f4f4f6',
  memo: '#fff6c2',
  memoText: '#2b2a20',
}

const ONEUI_DARK = {
  accent: '#5ea2ff',
  accentText: '#ffffff',
  bg: '#000000',
  bg2: '#0d1424',
  surface: '#171717',
  surface2: '#252527',
  text: '#f7f7f8',
  textSub: '#9c9ca2',
  line: '#2c2c2f',
  drawer: '#121212',
  memo: '#3a3828',
  memoText: '#f6f2d8',
}

export const DEFAULT_THEME = {
  preset: 'oneui',
  mode: 'auto',
  allowToggle: true,
  light: ONEUI_LIGHT,
  dark: ONEUI_DARK,

  // 배경
  bgType: 'solid', // solid | gradient | image | pattern
  bgAngle: 160,
  bgImage: '',
  bgImageDark: '',
  bgFit: 'cover', // cover | repeat | contain
  bgBlur: 0,
  bgOverlay: 0.2,
  pattern: 'dots', // dots | grid | lines | diagonal | hearts | stars | checker
  patternSize: 22,

  // 글자
  font: 'pretendard',
  headingFont: 'same',
  customFontUrl: '',
  fontScale: 1,
  titleWeight: 800,
  letterSpacing: -0.01,
  lineHeight: 1.8,

  // 모양
  radius: 26,
  cardStyle: 'flat', // flat | shadow | outline | glass | soft | sticker
  gap: 14,
  contentWidth: 760,
  buttonShape: 'pill', // pill | rounded | square

  // 배치
  headerStyle: 'expanded', // expanded | compact | centered
  expandedHeight: 30,
  titleTop: 72, // 큰 제목 위 여백(px) — 홈을 뺀 모든 페이지(게시판·역극·페어 등)에 똑같이
  homeTitle: true,
  homeTitleHeight: 14, // 홈 큰 제목 영역 높이(vh). 다른 페이지 제목 높이(expandedHeight)와 따로예요
  homeTitleBg: 'none', // none | card | glass | image
  homeTitleImage: '',
  homeTitleDim: 0.35,
  navStyle: 'drawer', // drawer | bottom | both
  drawerSide: 'left',
  homeLayout: 'swipe', // swipe | stack
  homeFixed: true,
  homeAlign: 'top', // 홈 위젯 세로 정렬: top | center | bottom (페이지마다 따로 정할 수도 있어요) // 홈 화면을 한 화면 높이에 고정(스크롤 없음)
  dots: 'pill', // pill | dot | line | number | none
  dotsPosition: 'bottom',

  // 목록
  listStyle: 'list', // LIST_STYLES 참고
  noticeStyle: 'list',
  galleryColumns: 3,
  showThumbs: true,
  showExcerpt: true,

  // 효과
  animations: true,
  hoverLift: true,
  iconStyle: 'solid',
  scrollbarColor: '', // 비우면 포인트 색

  // 상단바 · 본문 창
  topbarStyle: 'blur', // blur(반투명 흐림) | solid(불투명) | transparent(투명)
  topbarOpacity: 82,
  contentFrame: 'auto', // auto(배경이 이미지·패턴일 때) | always | never
  frameOnHome: false,
  frameOpacity: 92,
  frameBar: true,
  frameTop: 14, // 본문 창 위쪽 띄우기(px)
  frameWidth: 0, // 본문 창 너비(px), 0이면 '본문 최대 너비'를 따라요
  // bottomNav: 하단 탭 메뉴 (없으면 사이트 설정의 예전 값)

  // 마우스 커서
  cursor: 'default', // default | heart | star | paw | sparkle | custom
  cursorImage: '',
  cursorX: 0,
  cursorY: 0,
  cursorPointerImage: '',
  cursorPointerX: 0,
  cursorPointerY: 0,
  cursorSize: 28,

  customCss: '',
}

export const PRESETS = [
  { key: 'oneui', label: 'One UI 블루', theme: { light: ONEUI_LIGHT, dark: ONEUI_DARK, bgType: 'solid', cardStyle: 'flat', radius: 26, font: 'pretendard' } },
  {
    key: 'mint',
    label: '민트 소다',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#1fae99', bg: '#eef7f5', bg2: '#dff3ee', drawer: '#eef7f5', line: '#dcebe7', surface2: '#eef6f4' },
      dark: { ...ONEUI_DARK, accent: '#3fd1b9', bg: '#05100e', surface: '#111c1a', surface2: '#1b2926', line: '#21302d', drawer: '#0b1513' },
      bgType: 'solid',
    },
  },
  {
    key: 'cherry',
    label: '체리블라썸',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#f2668b', bg: '#fff3f6', bg2: '#ffe1ea', surface2: '#fdeef2', line: '#f6dfe6', drawer: '#fff3f6', memo: '#ffe3ea', memoText: '#4a2530' },
      dark: { ...ONEUI_DARK, accent: '#ff8fab', bg: '#120a0d', surface: '#1e1317', surface2: '#2a1c21', line: '#33232a', drawer: '#170e12', memo: '#3b2129', memoText: '#ffe6ed' },
      bgType: 'pattern',
      pattern: 'hearts',
    },
  },
  {
    key: 'lavender',
    label: '라벤더 새벽',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#8a72f0', bg: '#f4f2ff', bg2: '#e7e2ff', surface2: '#f1eefc', line: '#e4dff8', drawer: '#f4f2ff', memo: '#ece6ff', memoText: '#2d2448' },
      dark: { ...ONEUI_DARK, accent: '#a895ff', bg: '#0b0914', surface: '#16131f', surface2: '#221d2e', line: '#2a2438', drawer: '#100d19', memo: '#2a2440', memoText: '#ece6ff' },
      bgType: 'gradient',
    },
  },
  {
    key: 'peach',
    label: '피치 에이드',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#ff7d4d', bg: '#fff5ef', bg2: '#ffe7da', surface2: '#fff0e8', line: '#f7e1d6', drawer: '#fff5ef', memo: '#ffe9d6' },
      dark: { ...ONEUI_DARK, accent: '#ff9a72', bg: '#120b08', surface: '#1e1511', surface2: '#2a1e18', line: '#33251e', drawer: '#170f0b' },
    },
  },
  {
    key: 'lemon',
    label: '레몬 메모지',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#d79a00', bg: '#fffbea', bg2: '#fff3bf', surface: '#fffef7', surface2: '#fff6d1', line: '#f2e7bb', drawer: '#fffbea', memo: '#fff1a8', text: '#2b2615' },
      dark: { ...ONEUI_DARK, accent: '#ffc933', bg: '#0f0d05', surface: '#1b180c', surface2: '#272314', line: '#312c18', drawer: '#14110a' },
      font: 'gaegu',
      fontScale: 1.12,
      cardStyle: 'sticker',
      bgType: 'pattern',
      pattern: 'lines',
      listStyle: 'memo',
    },
  },
  {
    key: 'mono',
    label: '모노 미니멀',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#111111', bg: '#f6f6f6', bg2: '#ececec', surface2: '#f1f1f1', line: '#e1e1e1', drawer: '#f6f6f6', memo: '#f1f1f1' },
      dark: { ...ONEUI_DARK, accent: '#f5f5f5', accentText: '#111111', bg: '#0a0a0a', surface: '#141414', memo: '#202020', memoText: '#f5f5f5' },
      radius: 12,
      cardStyle: 'outline',
      buttonShape: 'square',
      bgType: 'solid',
    },
  },
  {
    key: 'midnight',
    label: '미드나잇 블루',
    theme: {
      mode: 'dark',
      light: { ...ONEUI_LIGHT, accent: '#3a5bd9', bg: '#eef1fb', bg2: '#dfe5fa' },
      dark: { ...ONEUI_DARK, accent: '#86a8ff', bg: '#070a16', bg2: '#16133a', surface: '#11162a', surface2: '#1a2038', line: '#222a46', drawer: '#0b0f20', memo: '#232a4a', memoText: '#e3e9ff' },
      bgType: 'gradient',
      bgAngle: 200,
      cardStyle: 'glass',
    },
  },
  {
    key: 'forest',
    label: '숲속 산책',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#3b8a57', bg: '#f1f5ef', bg2: '#e1ecdc', surface2: '#eef3ec', line: '#dfe8db', drawer: '#f1f5ef', memo: '#e6f0d8' },
      dark: { ...ONEUI_DARK, accent: '#6cc28a', bg: '#070c08', surface: '#121a13', surface2: '#1c271d', line: '#233024', drawer: '#0c130d' },
      font: 'gowun-dodum',
    },
  },
  {
    key: 'rosegold',
    label: '로즈골드 편지',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#b9786b', bg: '#fbf3f1', bg2: '#f3e1dc', surface: '#fffaf8', surface2: '#f7ebe8', line: '#efdcd7', drawer: '#fbf3f1', memo: '#f8e4de', text: '#3a2a27' },
      dark: { ...ONEUI_DARK, accent: '#e0a597', bg: '#100b0a', surface: '#1c1514', surface2: '#281e1c', line: '#332825', drawer: '#151010' },
      font: 'gowun-batang',
      headingFont: 'gowun-batang',
      cardStyle: 'shadow',
    },
  },
  {
    key: 'glass',
    label: '하늘 유리',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#4a8dff', bg: '#cfe4ff', bg2: '#fbe1f1', surface: 'rgba(255,255,255,0.62)', surface2: 'rgba(255,255,255,0.55)', line: 'rgba(255,255,255,0.7)', drawer: 'rgba(245,248,255,0.85)' },
      dark: { ...ONEUI_DARK, accent: '#7fb0ff', bg: '#0b1630', bg2: '#2a1030', surface: 'rgba(30,36,60,0.55)', surface2: 'rgba(255,255,255,0.07)', line: 'rgba(255,255,255,0.1)', drawer: 'rgba(14,18,34,0.9)' },
      bgType: 'gradient',
      bgAngle: 135,
      cardStyle: 'glass',
    },
  },
  {
    key: 'paper',
    label: '클래식 원고지',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#8a5a44', bg: '#f4eee2', bg2: '#ebe2cf', surface: '#fbf8f1', surface2: '#f1eadc', line: '#e2d6bf', drawer: '#f4eee2', memo: '#efe3c8', text: '#2f2620', textSub: '#7a6a5c' },
      dark: { ...ONEUI_DARK, accent: '#d2a184', bg: '#14110d', surface: '#1e1a15', surface2: '#29231c', line: '#342c23', drawer: '#18140f' },
      font: 'nanum-myeongjo',
      headingFont: 'nanum-myeongjo',
      radius: 6,
      cardStyle: 'outline',
      bgType: 'pattern',
      pattern: 'grid',
      buttonShape: 'rounded',
    },
  },
  {
    key: 'dream',
    label: '드림 투톤',
    theme: {
      light: { ...ONEUI_LIGHT, accent: '#8f7cff', bg: '#fde3f1', bg2: '#dce8ff', surface: 'rgba(255,255,255,0.75)', surface2: 'rgba(255,255,255,0.6)', line: 'rgba(143,124,255,0.18)', drawer: '#fbf2fb', memo: '#fff0f7' },
      dark: { ...ONEUI_DARK, accent: '#b3a6ff', bg: '#1a0f24', bg2: '#0c1630', surface: 'rgba(40,32,62,0.6)', surface2: 'rgba(255,255,255,0.06)', line: 'rgba(179,166,255,0.18)', drawer: '#140c1d' },
      bgType: 'gradient',
      bgAngle: 145,
      cardStyle: 'glass',
      font: 'gowun-dodum',
    },
  },
]

/* ------------------------------------------------------------------ */
/* 홈 화면                                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_HOME = {
  pages: [
    {
      id: 'page-1',
      widgets: [
        { id: 'w-profile', type: 'profile', size: 'L', config: {} },
        { id: 'w-dday', type: 'dday', size: 'M', config: { items: [{ title: '함께한 지', date: '', icon: 'fa-solid fa-heart', mode: 'dplus' }] } },
        { id: 'w-clock', type: 'clock', size: 'M', config: {} },
        { id: 'w-s1', type: 'shortcut', size: 'S', config: { label: '기록', icon: 'fa-solid fa-book-open', href: '/archive' } },
        { id: 'w-s2', type: 'shortcut', size: 'S', config: { label: '캘린더', icon: 'fa-regular fa-calendar', href: '/calendar' } },
        { id: 'w-s3', type: 'shortcut', size: 'S', config: { label: '방명록', icon: 'fa-regular fa-comment-dots', href: '/guestbook' } },
        { id: 'w-s4', type: 'shortcut', size: 'S', config: { label: '태그', icon: 'fa-solid fa-hashtag', href: '/tags' } },
        { id: 'w-recent', type: 'recent', size: 'L', config: { title: '최근 기록', count: 4, style: 'list' } },
      ],
    },
    {
      id: 'page-2',
      widgets: [
        { id: 'w-cal', type: 'calendar', size: 'L', config: { title: '이번 달' } },
        { id: 'w-notice', type: 'notice', size: 'L', config: { source: 'latest', count: 2 } },
        { id: 'w-todo', type: 'todo', size: 'M', config: { title: '하고 싶은 것', items: [{ text: '같이 노을 보기', done: false }, { text: '첫 편지 쓰기', done: true }] } },
        { id: 'w-quote', type: 'quote', size: 'M', config: { title: '오늘의 한마디', items: [{ text: '오늘도 네 생각.' }, { text: '천천히, 오래오래.' }] } },
      ],
    },
    {
      id: 'page-3',
      widgets: [
        { id: 'w-gallery', type: 'gallery', size: 'L', config: { title: '갤러리', source: 'posts', count: 6, columns: 3 } },
        { id: 'w-tags', type: 'tagcloud', size: 'L', config: { title: '태그' } },
      ],
    },
  ],
}

// 카테고리 페이지 종류. 새 종류를 만들면 여기와 worker/index.js 의 PAGE_TYPES에 추가해요.
export const PAGE_TYPES = [
  { value: 'posts', label: '일반 게시판', icon: 'fa-regular fa-file-lines', desc: '제목이 있는 글을 목록(리스트·갤러리·메모 등)으로 보여줘요.' },
  { value: 'thread', label: '타임라인 타래', icon: 'fa-solid fa-diagram-next', desc: '트위터처럼 글 아래로 글을 계속 이어 다는 타래를 세워요.' },
  { value: 'rp', label: '역극 로그', icon: 'fa-solid fa-masks-theater', desc: '장문 역극 로그를 카드로 정리해요. 본편·IF·AU 같은 세계선별로 나눠 보고, 이 페이지 안에서만 검색할 수 있어요.' },
  { value: 'pair', label: '캐릭터 페어', icon: 'fa-solid fa-user-group', desc: '두 사람의 전신 이미지·프로필·스테이터스·위키 문서를 정리하는 소개 페이지예요.' },
]

export const LIST_STYLES = [
  { value: 'list', label: '리스트' },
  { value: 'group', label: 'One UI 설정 목록 (한 카드에 줄로 묶기)' },
  { value: 'card', label: '카드' },
  { value: 'magazine', label: '매거진 (첫 글 크게)' },
  { value: 'gallery', label: '갤러리 (정사각 격자)' },
  { value: 'masonry', label: '벽돌 갤러리 (사진 원래 비율대로 쌓기)' },
  { value: 'album', label: '앨범 (갤러리 앱처럼 달별로)' },
  { value: 'memo', label: '메모' },
  { value: 'timeline', label: '타임라인' },
]

// 목록 모양별 한 페이지 글 수 (디자인 › 목록에서 정해요). 비우면 사이트 기본값, 'all'이면 모든 글을 한 페이지에.
export function perPageFor(site, theme, style) {
  const v = theme?.[`perPage_${style}`]
  if (v === 'all') return 'all'
  const n = Number(v) || Number(site?.postsPerPage) || 12
  return Math.min(60, Math.max(1, Math.round(n)))
}

/* ------------------------------------------------------------------ */
/* 병합                                                                */
/* ------------------------------------------------------------------ */

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

export function deepMerge(base, over) {
  if (!isPlainObject(over)) return over === undefined ? base : over
  const out = { ...base }
  for (const [k, v] of Object.entries(over)) {
    out[k] = isPlainObject(v) && isPlainObject(base?.[k]) ? deepMerge(base[k], v) : v
  }
  return out
}

export function resolveSite(site) {
  return deepMerge(DEFAULT_SITE, site || {})
}

export function resolveTheme(theme) {
  return deepMerge(DEFAULT_THEME, theme || {})
}

export function resolveHome(home) {
  return home?.pages?.length ? home : DEFAULT_HOME
}
