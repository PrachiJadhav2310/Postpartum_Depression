const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schema
const questionnaireResponseSchema = Joi.object({
  questionnaire_type: Joi.string().valid('initial', 'followup', 'custom').default('initial'),
  responses: Joi.object().required(),
  metadata: Joi.object().optional()
});

// Submit questionnaire response
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { error, value } = questionnaireResponseSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const { questionnaire_type, responses, metadata } = value;
    
    // Check if user already has an initial questionnaire
    if (questionnaire_type === 'initial') {
      const existing = await query(
        `SELECT id FROM questionnaire_responses 
         WHERE user_id = $1 AND questionnaire_type = 'initial'`,
        [req.user.id]
      );
      
      if (existing.rows.length > 0) {
        // Update existing initial questionnaire
        const result = await query(
          `UPDATE questionnaire_responses 
           SET responses = $1, metadata = $2, completed_at = NOW()
           WHERE user_id = $3 AND questionnaire_type = 'initial'
           RETURNING *`,
          [JSON.stringify(responses), JSON.stringify(metadata || {}), req.user.id]
        );
        
        return res.json({
          success: true,
          message: 'Questionnaire updated successfully',
          data: { response: result.rows[0] }
        });
      }
    }
    
    // Create new questionnaire response
    const result = await query(
      `INSERT INTO questionnaire_responses 
       (user_id, questionnaire_type, responses, metadata, completed_at, created_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [req.user.id, questionnaire_type, JSON.stringify(responses), JSON.stringify(metadata || {})]
    );
    
    logger.info(`Questionnaire submitted by user ${req.user.id}: ${questionnaire_type}`);
    
    res.status(201).json({
      success: true,
      message: 'Questionnaire submitted successfully',
      data: { response: result.rows[0] }
    });
  } catch (error) {
    logger.error('Submit questionnaire error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit questionnaire'
    });
  }
});

// Get user's questionnaire responses
router.get('/responses', authenticateToken, async (req, res) => {
  try {
    const { type, limit = 10, offset = 0 } = req.query;
    
    let queryText = `
      SELECT * FROM questionnaire_responses 
      WHERE user_id = $1
    `;
    let queryParams = [req.user.id];
    let paramCount = 1;
    
    if (type) {
      queryText += ` AND questionnaire_type = $${++paramCount}`;
      queryParams.push(type);
    }
    
    queryText += ` ORDER BY completed_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const result = await query(queryText, queryParams);
    
    res.json({
      success: true,
      data: {
        responses: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });
  } catch (error) {
    logger.error('Get questionnaire responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get questionnaire responses'
    });
  }
});

// Get latest questionnaire response
router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const { type } = req.query;
    
    let queryText = `
      SELECT * FROM questionnaire_responses 
      WHERE user_id = $1
    `;
    let queryParams = [req.user.id];
    
    if (type) {
      queryText += ` AND questionnaire_type = $2`;
      queryParams.push(type);
    }
    
    queryText += ` ORDER BY completed_at DESC LIMIT 1`;
    
    const result = await query(queryText, queryParams);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { response: null }
      });
    }
    
    res.json({
      success: true,
      data: { response: result.rows[0] }
    });
  } catch (error) {
    logger.error('Get latest questionnaire error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get latest questionnaire'
    });
  }
});

// Get questionnaire statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await query(
      `SELECT 
        questionnaire_type,
        COUNT(*) as count,
        MAX(completed_at) as last_completed
       FROM questionnaire_responses 
       WHERE user_id = $1 
       GROUP BY questionnaire_type`,
      [req.user.id]
    );
    
    res.json({
      success: true,
      data: { statistics: stats.rows }
    });
  } catch (error) {
    logger.error('Get questionnaire stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get questionnaire statistics'
    });
  }
});

module.exports = router;
