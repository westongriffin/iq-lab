CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  mode TEXT NOT NULL,
  iq INTEGER NOT NULL,
  raw INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL,
  low_effort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS responses (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  item_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  rt REAL
);

CREATE INDEX IF NOT EXISTS idx_responses_item ON responses(item_id);
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
