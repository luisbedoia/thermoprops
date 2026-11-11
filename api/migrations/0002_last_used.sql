-- The day a link was last opened or answered (src/links.ts): links unused
-- for a year may be deleted. Those kept before count from their creation.
ALTER TABLE links ADD COLUMN last_used TEXT;
UPDATE links SET last_used = date(created);
