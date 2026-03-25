/*
  # Add persistent reply likes for community

  1. Schema updates
    - Add `likes_count` to `community_replies` if missing
    - Create `community_reply_likes` join table
    - Add unique constraint to enforce one like per user per reply

  2. Performance
    - Index on `reply_id` and `user_id`
*/

ALTER TABLE community_replies
ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS community_reply_likes (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reply_id bigint NOT NULL REFERENCES community_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_reply_likes_user_reply_unique UNIQUE (user_id, reply_id)
);

CREATE INDEX IF NOT EXISTS idx_community_reply_likes_reply_id
ON community_reply_likes(reply_id);

CREATE INDEX IF NOT EXISTS idx_community_reply_likes_user_id
ON community_reply_likes(user_id);
