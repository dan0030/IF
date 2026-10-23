// 카테고리를 메뉴(서랍)에 보이는 순서대로 펼쳐요: 상위 카테고리 → 그 아래 하위 카테고리 → 다음 상위 …
// (상위가 사라진 하위 카테고리는 맨 뒤에 붙여요)
export function orderCategories(list = []) {
  const ids = new Set(list.map((c) => c.id))
  const out = []
  for (const root of list.filter((c) => !c.parent_id || !ids.has(c.parent_id))) {
    out.push(root)
    for (const kid of list.filter((c) => c.parent_id === root.id)) out.push(kid)
  }
  // 손자 단계 등 위에서 빠진 것이 있으면 뒤에 덧붙여요
  for (const c of list) if (!out.includes(c)) out.push(c)
  return out
}
