CREATE TABLE users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, mobile TEXT UNIQUE, place TEXT,
  gender INTEGER, role TEXT NOT NULL DEFAULT 'user', avatar TEXT,
  bookmarked_booths TEXT NOT NULL DEFAULT '[]', visited_booths TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1, last_login TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE booths (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
  logo TEXT, audio_file TEXT, video_file TEXT, gallery_images TEXT NOT NULL DEFAULT '[]',
  resources TEXT NOT NULL DEFAULT '[]', is_published INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0, visit_count INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0, metadata TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_booths_order ON booths(sort_order);
CREATE TABLE questions (
  id TEXT PRIMARY KEY, booth_id TEXT NOT NULL, question TEXT NOT NULL, options TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '', difficulty TEXT NOT NULL DEFAULT 'medium', points INTEGER NOT NULL DEFAULT 10,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_questions_booth ON questions(booth_id);
CREATE TABLE guest_users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, age INTEGER NOT NULL, mobile TEXT NOT NULL, place TEXT NOT NULL,
  total_attempts INTEGER NOT NULL DEFAULT 0, last_attempt_date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_guest_mobile ON guest_users(mobile);
CREATE TABLE quiz_attempts (
  id TEXT PRIMARY KEY, user_id TEXT, guest_user_id TEXT, user_type TEXT NOT NULL, mobile TEXT,
  answers TEXT NOT NULL DEFAULT '[]', total_questions INTEGER NOT NULL DEFAULT 10,
  correct_answers INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, total_time REAL NOT NULL,
  percentage REAL NOT NULL DEFAULT 0, attempt_date TEXT NOT NULL, rank_pos INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_attempts_date ON quiz_attempts(attempt_date, score DESC, total_time);
CREATE INDEX idx_attempts_mobile ON quiz_attempts(mobile, attempt_date);
CREATE INDEX idx_attempts_user ON quiz_attempts(user_id);
CREATE TABLE quiz_configs (
  id TEXT PRIMARY KEY, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  daily_start_time TEXT NOT NULL DEFAULT '08:00', daily_end_time TEXT NOT NULL DEFAULT '21:00',
  top_count INTEGER NOT NULL DEFAULT 10, is_active INTEGER NOT NULL DEFAULT 1,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE feedback (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, ratings TEXT NOT NULL, text_feedback TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', admin_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at);
CREATE TABLE galleries (
  id TEXT PRIMARY KEY, images TEXT NOT NULL DEFAULT '[]', is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal', is_published INTEGER NOT NULL DEFAULT 1, publish_date TEXT NOT NULL,
  expiry_date TEXT, target_audience TEXT NOT NULL DEFAULT 'all', read_by TEXT NOT NULL DEFAULT '[]', metadata TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_notif_publish ON notifications(publish_date DESC, is_published);
CREATE TABLE programs (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL,
  start_time TEXT NOT NULL, end_time TEXT NOT NULL, speakers TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_programs_date ON programs(date, start_time);
