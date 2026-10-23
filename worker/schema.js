// D1 테이블은 첫 요청 때 자동으로 만들어집니다. (따로 마이그레이션을 돌리지 않아도 돼요)
// 컬럼을 추가할 때는 아래 MIGRATIONS 배열 끝에 ALTER 문을 덧붙이면 됩니다.

const TABLES = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    list_style TEXT,
    parent_id INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'post',
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT 'rich',
    excerpt TEXT NOT NULL DEFAULT '',
    plain TEXT NOT NULL DEFAULT '',
    thumbnail TEXT,
    category_id INTEGER,
    tags TEXT NOT NULL DEFAULT '[]',
    visibility TEXT NOT NULL DEFAULT 'public',
    password_hash TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    allow_comments INTEGER NOT NULL DEFAULT 1,
    views INTEGER NOT NULL DEFAULT 0,
    reactions TEXT NOT NULL DEFAULT '{}',
    extra TEXT NOT NULL DEFAULT '{}',
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_posts_list ON posts (type, visibility, published_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category_id, published_at DESC)`,
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    parent_id INTEGER,
    name TEXT NOT NULL,
    password_hash TEXT,
    body TEXT NOT NULL,
    secret INTEGER NOT NULL DEFAULT 0,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS files (
    key TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB,
    created_at TEXT NOT NULL
  )`,
]

// 이미 만들어진 데이터베이스에 나중에 추가된 컬럼들. (이미 있으면 조용히 넘어가요)
const MIGRATIONS = [
  `ALTER TABLE categories ADD COLUMN page_type TEXT NOT NULL DEFAULT 'posts'`,
  `ALTER TABLE posts ADD COLUMN thread_id INTEGER`,
  `CREATE INDEX IF NOT EXISTS idx_posts_thread ON posts (thread_id, published_at)`,
  // 페어 소개 같은 특수 페이지의 내용(JSON)
  `ALTER TABLE categories ADD COLUMN config TEXT`,
]

let ready = null

async function migrate(db) {
  await db.batch(TABLES.map((sql) => db.prepare(sql)))
  for (const sql of MIGRATIONS) {
    try {
      await db.prepare(sql).run()
    } catch (err) {
      if (!/duplicate column/i.test(String(err?.message || err))) throw err
    }
  }
}

export function ensureSchema(db) {
  if (!ready) {
    ready = migrate(db).catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}
