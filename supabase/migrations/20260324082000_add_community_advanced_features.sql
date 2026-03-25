/*
  # Community advanced feature tables

  1. community_post_reports
  2. community_bookmarks
  3. community_post_reactions
  4. support columns for ownership/display
*/

ALTER TABLE community_posts
ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

ALTER TABLE community_replies
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS community_post_reports (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_bookmarks (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id bigint NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_bookmarks_user_post_unique UNIQUE (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS community_post_reactions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id bigint NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like', 'heart', 'hug', 'pray', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_post_reactions_user_post_unique UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_community_reports_post_id ON community_post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_community_reports_user_id ON community_post_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_user_id ON community_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_community_bookmarks_post_id ON community_bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reactions_post_id ON community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reactions_user_id ON community_post_reactions(user_id);
