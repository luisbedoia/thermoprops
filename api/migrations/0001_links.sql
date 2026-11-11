-- A short link's script: its id is the script's hash (src/links.ts), so a
-- script is kept once however many answers link it.
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  script TEXT NOT NULL,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);
