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
  // 글마다 이미 본 방문자 (같은 사람이 여러 번 열어도 조회수는 한 번만 세요)
  `CREATE TABLE IF NOT EXISTS post_views (
    post_id INTEGER NOT NULL,
    viewer TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (post_id, viewer)
  )`,
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
  // R2로 아직 안 옮긴 파일만 빠르게 찾게 (예전엔 요청마다 files 표 전체를 훑었어요)
  `CREATE INDEX IF NOT EXISTS idx_files_pending ON files (key) WHERE data IS NOT NULL`,
]

// 표 구조를 바꾸면 이 숫자를 1 올려요. 데이터베이스에 적힌 숫자가 같으면 서버가 새로 뜰 때
// 표 검사(CREATE·ALTER 여러 번)를 건너뛰고 질의 한 번으로 끝내요. (첫 접속이 느리던 원인)
const SCHEMA_VERSION = 2

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

async function check(db) {
  try {
    const row = await db.prepare("SELECT value FROM settings WHERE key = '__schema'").first()
    if (Number(row?.value) >= SCHEMA_VERSION) return
  } catch {
    // settings 표가 아직 없으면(첫 실행) 아래에서 만들어요.
  }
  await migrate(db)
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES ('__schema', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
    .bind(String(SCHEMA_VERSION), new Date().toISOString())
    .run()
}

export function ensureSchema(db) {
  if (!ready) {
    ready = check(db).catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}
