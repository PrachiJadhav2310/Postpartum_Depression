const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const postSchema = Joi.object({
  title: Joi.string().max(255).optional(),
  content: Joi.string().required(),
  category: Joi.string().max(100).default('general'),
  tags: Joi.array().items(Joi.string()).optional(),
  isAnonymous: Joi.boolean().default(false),
  isSupportRequest: Joi.boolean().default(false)
});

const replySchema = Joi.object({
  content: Joi.string().required(),
  isAnonymous: Joi.boolean().default(false)
});

const updatePostSchema = Joi.object({
  content: Joi.string().required(),
  category: Joi.string().max(100).optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

const reportSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required()
});

const reactionSchema = Joi.object({
  reactionType: Joi.string().valid('like', 'heart', 'hug', 'pray', 'strong').required()
});

// Get community posts
router.get('/posts', authenticateToken, async (req, res) => {
  try {
    const { category, limit = 20, offset = 0, search } = req.query;

    let queryText = `
      SELECT 
        cp.*,
        CASE 
          WHEN cp.is_anonymous THEN 'Anonymous'
          ELSE up.full_name
        END as author_name,
        up.id as author_id,
        (cp.user_id = $1) as is_owner,
        EXISTS (
          SELECT 1 FROM community_bookmarks cb
          WHERE cb.user_id = $1 AND cb.post_id = cp.id
        ) as is_bookmarked
      FROM community_posts cp
      LEFT JOIN user_profiles up ON cp.user_id = up.id
      WHERE 1=1
    `;
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (category && category !== 'all') {
      queryText += ` AND cp.category = $${++paramCount}`;
      queryParams.push(category);
    }

    if (search) {
      queryText += ` AND (cp.title ILIKE $${++paramCount} OR cp.content ILIKE $${++paramCount})`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    queryText += ` ORDER BY cp.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: {
        posts: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });

  } catch (error) {
    logger.error('Get community posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get community posts'
    });
  }
});

// Create community post
router.post('/posts', authenticateToken, async (req, res) => {
  try {
    const { error, value } = postSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { title, content, category, tags, isAnonymous, isSupportRequest } = value;

    const result = await query(
      `INSERT INTO community_posts 
       (user_id, title, content, category, tags, is_anonymous, is_support_request, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [req.user.id, title, content, category, tags || [], isAnonymous, isSupportRequest]
    );

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post: result.rows[0] }
    });

  } catch (error) {
    logger.error('Create community post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post'
    });
  }
});

// Get post replies
router.get('/posts/:postId/replies', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(`
      SELECT 
        cr.*,
        CASE 
          WHEN cr.is_anonymous THEN 'Anonymous'
          ELSE up.full_name
        END as author_name,
        (cr.user_id = $4) as is_owner
      FROM community_replies cr
      LEFT JOIN user_profiles up ON cr.user_id = up.id
      WHERE cr.post_id = $1
      ORDER BY cr.created_at ASC
      LIMIT $2 OFFSET $3
    `, [postId, parseInt(limit), parseInt(offset), req.user.id]);

    res.json({
      success: true,
      data: { replies: result.rows }
    });

  } catch (error) {
    logger.error('Get post replies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get replies'
    });
  }
});

// Add reply to post
router.post('/posts/:postId/replies', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { error, value } = replySchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { content, isAnonymous } = value;

    // Check if post exists
    const postExists = await query(
      'SELECT id FROM community_posts WHERE id = $1',
      [postId]
    );

    if (postExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const result = await query(
      `INSERT INTO community_replies (post_id, user_id, content, is_anonymous, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [postId, req.user.id, content, isAnonymous]
    );

    // Update reply count
    await query(
      'UPDATE community_posts SET replies_count = replies_count + 1 WHERE id = $1',
      [postId]
    );

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      data: { reply: result.rows[0] }
    });

  } catch (error) {
    logger.error('Add reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reply'
    });
  }
});

// Update own post
router.put('/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { error, value } = updatePostSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message)
      });
    }

    const result = await query(
      `UPDATE community_posts
       SET content = $1, category = COALESCE($2, category), tags = COALESCE($3, tags), updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [value.content, value.category, value.tags, postId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or not authorized'
      });
    }

    return res.json({
      success: true,
      message: 'Post updated successfully',
      data: { post: result.rows[0] }
    });
  } catch (error) {
    logger.error('Update post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update post'
    });
  }
});

// Delete own post
router.delete('/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const result = await query(
      'DELETE FROM community_posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [postId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or not authorized'
      });
    }

    return res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    logger.error('Delete post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete post'
    });
  }
});

// Like/unlike post
router.post('/posts/:postId/like', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if already liked
    const existingLike = await query(
      'SELECT id FROM community_likes WHERE user_id = $1 AND post_id = $2',
      [req.user.id, postId]
    );

    if (existingLike.rows.length > 0) {
      // Unlike
      await query(
        'DELETE FROM community_likes WHERE user_id = $1 AND post_id = $2',
        [req.user.id, postId]
      );
      await query(
        'UPDATE community_posts SET likes_count = likes_count - 1 WHERE id = $1',
        [postId]
      );
      
      res.json({
        success: true,
        message: 'Post unliked',
        data: { liked: false }
      });
    } else {
      // Like
      await query(
        'INSERT INTO community_likes (user_id, post_id, created_at) VALUES ($1, $2, NOW())',
        [req.user.id, postId]
      );
      await query(
        'UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = $1',
        [postId]
      );
      
      res.json({
        success: true,
        message: 'Post liked',
        data: { liked: true }
      });
    }

  } catch (error) {
    logger.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like/unlike post'
    });
  }
});

// React to post (rich reactions)
router.post('/posts/:postId/react', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { error, value } = reactionSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message)
      });
    }

    const { reactionType } = value;
    const existing = await query(
      'SELECT id, reaction_type FROM community_post_reactions WHERE user_id = $1 AND post_id = $2',
      [req.user.id, postId]
    );

    if (existing.rows.length > 0 && existing.rows[0].reaction_type === reactionType) {
      await query(
        'DELETE FROM community_post_reactions WHERE user_id = $1 AND post_id = $2 AND reaction_type = $3',
        [req.user.id, postId, reactionType]
      );
      return res.json({
        success: true,
        message: 'Reaction removed',
        data: { reacted: false, reactionType }
      });
    }

    if (existing.rows.length > 0) {
      await query(
        'UPDATE community_post_reactions SET reaction_type = $1, created_at = NOW() WHERE user_id = $2 AND post_id = $3',
        [reactionType, req.user.id, postId]
      );
    } else {
      await query(
        'INSERT INTO community_post_reactions (user_id, post_id, reaction_type, created_at) VALUES ($1, $2, $3, NOW())',
        [req.user.id, postId, reactionType]
      );
    }

    return res.json({
      success: true,
      message: 'Reaction updated',
      data: { reacted: true, reactionType }
    });
  } catch (error) {
    logger.error('React post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to react to post'
    });
  }
});

// Report post
router.post('/posts/:postId/report', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const { error, value } = reportSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((detail) => detail.message)
      });
    }

    await query(
      `INSERT INTO community_post_reports (post_id, user_id, reason, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [postId, req.user.id, value.reason]
    );

    return res.json({
      success: true,
      message: 'Post reported successfully'
    });
  } catch (error) {
    logger.error('Report post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to report post'
    });
  }
});

// Bookmark toggle
router.post('/posts/:postId/bookmark', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const existing = await query(
      'SELECT id FROM community_bookmarks WHERE user_id = $1 AND post_id = $2',
      [req.user.id, postId]
    );

    if (existing.rows.length > 0) {
      await query('DELETE FROM community_bookmarks WHERE user_id = $1 AND post_id = $2', [req.user.id, postId]);
      return res.json({
        success: true,
        message: 'Bookmark removed',
        data: { bookmarked: false }
      });
    }

    await query(
      'INSERT INTO community_bookmarks (user_id, post_id, created_at) VALUES ($1, $2, NOW())',
      [req.user.id, postId]
    );

    return res.json({
      success: true,
      message: 'Post bookmarked',
      data: { bookmarked: true }
    });
  } catch (error) {
    logger.error('Bookmark post error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bookmark post'
    });
  }
});

// Get bookmarks
router.get('/bookmarks', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT cp.*
       FROM community_bookmarks cb
       JOIN community_posts cp ON cp.id = cb.post_id
       WHERE cb.user_id = $1
       ORDER BY cb.created_at DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      data: { posts: result.rows }
    });
  } catch (error) {
    logger.error('Get bookmarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bookmarks'
    });
  }
});

// Community analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const countsResult = await query(
      `SELECT
         COUNT(*)::int AS total_posts,
         COALESCE(SUM(replies_count), 0)::int AS total_replies,
         COALESCE(SUM(likes_count), 0)::int AS total_likes
       FROM community_posts`
    );

    const tagsResult = await query(
      `SELECT tag, COUNT(*)::int AS usage_count
       FROM (
         SELECT unnest(tags) AS tag
         FROM community_posts
       ) t
       GROUP BY tag
       ORDER BY usage_count DESC
       LIMIT 8`
    );

    return res.json({
      success: true,
      data: {
        summary: countsResult.rows[0] || { total_posts: 0, total_replies: 0, total_likes: 0 },
        trendingTags: tagsResult.rows || []
      }
    });
  } catch (error) {
    logger.error('Community analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get community analytics'
    });
  }
});

// Expert list (API driven)
router.get('/experts', authenticateToken, async (req, res) => {
  try {
    return res.json({
      success: true,
      data: {
        experts: [
          { name: 'Dr. Sarah Johnson', role: 'Postpartum Psychiatrist', avatar: '👩‍⚕️', verified: true },
          { name: 'Mary Chen', role: 'Lactation Consultant', avatar: '🤱', verified: true },
          { name: 'Lisa Rodriguez', role: 'Licensed Therapist', avatar: '🧠', verified: true },
          { name: 'Jennifer Brown', role: 'Certified Midwife', avatar: '👩‍⚕️', verified: true }
        ]
      }
    });
  } catch (error) {
    logger.error('Get experts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get experts'
    });
  }
});

// Like/unlike reply
router.post('/posts/:postId/replies/:replyId/like', authenticateToken, async (req, res) => {
  try {
    const { postId, replyId } = req.params;

    // Ensure reply belongs to the post
    const replyExists = await query(
      'SELECT id FROM community_replies WHERE id = $1 AND post_id = $2',
      [replyId, postId]
    );

    if (replyExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Reply not found'
      });
    }

    const existingLike = await query(
      'SELECT id FROM community_reply_likes WHERE user_id = $1 AND reply_id = $2',
      [req.user.id, replyId]
    );

    if (existingLike.rows.length > 0) {
      await query(
        'DELETE FROM community_reply_likes WHERE user_id = $1 AND reply_id = $2',
        [req.user.id, replyId]
      );
      await query(
        'UPDATE community_replies SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = $1',
        [replyId]
      );

      return res.json({
        success: true,
        message: 'Reply unliked',
        data: { liked: false }
      });
    }

    await query(
      'INSERT INTO community_reply_likes (user_id, reply_id, created_at) VALUES ($1, $2, NOW())',
      [req.user.id, replyId]
    );
    await query(
      'UPDATE community_replies SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = $1',
      [replyId]
    );

    return res.json({
      success: true,
      message: 'Reply liked',
      data: { liked: true }
    });
  } catch (error) {
    logger.error('Like reply error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to like/unlike reply'
    });
  }
});

module.exports = router;