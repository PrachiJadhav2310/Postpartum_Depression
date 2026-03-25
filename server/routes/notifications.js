const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get user notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unread_only = false } = req.query;

    let queryText = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (unread_only === 'true') {
      queryText += ` AND is_read = false`;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    // Get unread count
    const unreadCount = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: parseInt(unreadCount.rows[0].count),
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });

  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications'
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    const result = await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification: result.rows[0] }
    });

  } catch (error) {
    logger.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Create notification (internal use)
const createNotification = async (userId, title, message, type = 'info', actionUrl = null) => {
  try {
    await query(
      `INSERT INTO notifications (user_id, title, message, type, action_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, title, message, type, actionUrl]
    );
  } catch (error) {
    logger.error('Create notification error:', error);
  }
};

module.exports = { router, createNotification };