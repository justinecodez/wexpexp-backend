-- SQLite migration to remove CHECK constraint from venue_city
-- Run this with: sqlite3 database.sqlite < fix-venue-city.sql

BEGIN TRANSACTION;

-- 1. Create new table without CHECK constraint
CREATE TABLE events_new (
  id varchar PRIMARY KEY NOT NULL,
  user_id varchar NOT NULL,
  title varchar NOT NULL,
  description varchar,
  event_type varchar NOT NULL,
  event_date datetime NOT NULL,
  start_time varchar NOT NULL,
  end_time varchar,
  timezone varchar NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  venue_name varchar,
  venue_address varchar,
  venue_city varchar,  -- No CHECK constraint here
  max_guests integer NOT NULL,
  current_rsvp_count integer NOT NULL DEFAULT 0,
  budget decimal(12,2),
  currency varchar NOT NULL DEFAULT 'TZS',
  status varchar NOT NULL DEFAULT 'DRAFT',
  is_public boolean NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT (datetime('now')),
  updated_at datetime NOT NULL DEFAULT (datetime('now')),
  last_autosave_at datetime,
  published_at datetime,
  message_template varchar,
  template_config text,
  host_name varchar,
  bride_name varchar,
  groom_name varchar,
  CONSTRAINT FK_user_event FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 2. Copy all data
INSERT INTO events_new SELECT * FROM events;

-- 3. Drop old table
DROP TABLE events;

-- 4. Rename new table
ALTER TABLE events_new RENAME TO events;

-- 5. Recreate indexes
CREATE INDEX IDX_user_events ON events(user_id);
CREATE INDEX IDX_event_date ON events(event_date);
CREATE INDEX IDX_event_status ON events(status);

COMMIT;

-- Verify
SELECT 'Migration completed successfully!' as status;
