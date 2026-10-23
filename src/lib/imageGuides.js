// 사진이 들어가는 자리마다 권장 크기·비율입니다.
// 사진 편집기는 여기 적힌 비율로 자르기 틀을 먼저 맞춰주고, 관리 › 이미지 가이드에 표로도 보여줘요.
// ratio: 가로/세로 (null이면 자유), size: [가로, 세로] 권장 픽셀, shape: 'circle'이면 동그랗게 보이는 자리

export const IMAGE_GUIDES = {
  avatar: { label: '프로필 사진', ratio: 1, size: [400, 400], shape: 'circle', where: '프로필 위젯 · 타래 · 댓글', note: '동그랗게 잘려 보여요. 얼굴을 가운데에 두세요.' },
  profileCover: { label: '프로필 커버', ratio: 4, size: [1600, 400], where: '프로필 위젯 (커버 배치)', note: '아래쪽 가운데는 프로필 사진에 가려져요.' },
  banner: { label: '배너 위젯', ratio: 3, size: [1500, 500], where: '홈 › 배너 위젯 (3:1 기본)', note: '위젯 설정에서 2:1·16:9·1:1로 바꿨다면 그 비율로 잘라주세요. 글자는 아래쪽을 피하세요(설명 문구가 덮여요).' },
  postCover: { label: '글 상단 커버', ratio: 3, size: [1500, 500], where: '글 보기 맨 위', note: '모바일에서는 양옆이 조금 더 잘려요. 중요한 건 가운데에.' },
  thumbnail: { label: '대표 이미지 (썸네일)', ratio: 1, size: [800, 800], where: '목록 · 갤러리 · 카드', note: '카드 목록에서는 16:10으로 위아래가 살짝 잘려요.' },
  gallery: { label: '갤러리 위젯', ratio: 1, size: [1080, 1080], where: '홈 › 갤러리 위젯 (1:1 기본)', note: '위젯 설정의 칸 비율(3:4·4:3·16:9)에 맞추면 더 깔끔해요.' },
  slide: { label: '흐르는 갤러리', ratio: null, size: [null, 400], where: '홈 › 흐르는 갤러리', note: '높이만 맞춰지고 가로는 자유예요. 세로 400px이면 충분해요.' },
  photo: { label: '사진 한 장 위젯', ratio: 1, size: [1080, 1080], where: '홈 › 사진 한 장 위젯', note: '위젯에서 고른 비율(1:1·4:5·16:9)로 잘라주세요.' },
  appIcon: { label: '앱 아이콘 이미지', ratio: 1, size: [256, 256], where: '홈 › 앱 아이콘', note: '둥근 사각형으로 잘려 보여요. 가장자리 여백을 조금 두세요.' },
  ddayBg: { label: '디데이 배경', ratio: 3, size: [1200, 400], where: '홈 › 디데이 위젯', note: '흐리게 깔리는 배경이라 해상도가 낮아도 괜찮아요.' },
  album: { label: '플레이리스트 앨범', ratio: 1, size: [300, 300], where: '홈 › 플레이리스트', note: '비우면 유튜브 썸네일이 쓰여요.' },
  widgetBg: { label: '위젯 배경', ratio: null, size: [1200, 800], where: '모든 위젯 › 배경 이미지', note: '위젯 크기에 맞춰 가운데 기준으로 잘려요.' },
  pageBg: { label: '사이트 배경', ratio: 16 / 9, size: [1920, 1080], where: '디자인 › 배경 › 이미지', note: '세로 화면(휴대폰)에서는 양옆이 많이 잘려요. 반복 무늬라면 작은 정사각형도 좋아요.' },
  homeTitle: { label: '홈 제목 배경', ratio: 3, size: [1500, 500], where: '디자인 › 배치 › 홈 큰 제목 배경', note: '글자가 왼쪽 아래에 올라가요. 그 부분은 너무 복잡하지 않은 사진이 좋아요.' },
  pageHeader: { label: '페이지 제목 위 이미지', ratio: null, size: [640, 320], where: '관리 › 페이지 문구', note: '최대 가로 320px·세로 160px 안에 맞춰 보여요. 배경이 투명한 PNG가 잘 어울려요.' },
  linkBanner: { label: '링크 배너', ratio: 5, size: [200, 40], where: '배너 게시판', note: '200×40이 가장 흔하고, 88×31(작은 배너)도 많이 써요. 움짤은 GIF 그대로 올려주세요.' },
  cursor: { label: '마우스 커서', ratio: 1, size: [32, 32], where: '디자인 › 커서', note: '32×32 이하, 투명 배경 PNG.' },
  fullBody: { label: '캐릭터 전신 이미지', ratio: null, size: [1000, 1600], where: '캐릭터 페어 페이지', note: '세로로 긴 전신 이미지(약 5:8)가 가장 잘 어울려요. 배경을 지운 투명 PNG면 대표 색 배경 위에 자연스럽게 올라가요.' },
  post: { label: '글 속 사진', ratio: null, size: [1600, null], where: '글쓰기 본문', note: '가로 1600px이면 넉넉해요. 더 크면 자동으로 줄여요.' },
}

export function guideText(key) {
  const g = IMAGE_GUIDES[key]
  if (!g) return ''
  const [w, h] = g.size
  const size = w && h ? `${w}×${h}px` : w ? `가로 ${w}px` : `세로 ${h}px`
  return `권장 ${size}${g.ratio ? ` (${ratioLabel(g.ratio)})` : ''}`
}

export function ratioLabel(r) {
  if (!r) return '자유'
  const known = [
    [1, '1:1'], [4 / 3, '4:3'], [3 / 4, '3:4'], [16 / 9, '16:9'], [9 / 16, '9:16'], [3, '3:1'], [2, '2:1'], [4, '4:1'], [5, '5:1'], [4 / 5, '4:5'], [16 / 10, '16:10'],
  ]
  const hit = known.find(([v]) => Math.abs(v - r) < 0.01)
  return hit ? hit[1] : `${r.toFixed(2)}:1`
}
