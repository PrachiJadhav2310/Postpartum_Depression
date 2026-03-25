const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schema
const educationResourceSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  type: Joi.string().valid('article', 'video', 'podcast', 'guide', 'course').required(),
  category: Joi.string().required(),
  duration: Joi.string().optional(),
  rating: Joi.number().min(0).max(5).optional(),
  author: Joi.string().optional(),
  content_url: Joi.string().uri().optional(),
  thumbnail_url: Joi.string().uri().optional(),
  featured: Joi.boolean().optional()
});

// Get education resources
router.get('/resources', async (req, res) => {
  try {
    const { category, type, featured, search, limit = 50, offset = 0 } = req.query;
    
    let queryText = `
      SELECT * FROM education_resources 
      WHERE is_active = true
    `;
    let queryParams = [];
    let paramCount = 0;
    
    if (category && category !== 'all') {
      queryText += ` AND category = $${++paramCount}`;
      queryParams.push(category);
    }
    
    if (type) {
      queryText += ` AND type = $${++paramCount}`;
      queryParams.push(type);
    }
    
    if (featured === 'true') {
      queryText += ` AND featured = true`;
    }
    
    if (search) {
      queryText += ` AND (title ILIKE $${++paramCount} OR description ILIKE $${++paramCount})`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    queryText += ` ORDER BY featured DESC, rating DESC, created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const result = await query(queryText, queryParams);
    
    res.json({
      success: true,
      data: {
        resources: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });
  } catch (error) {
    logger.error('Get education resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get education resources'
    });
  }
});

// Get single education resource
router.get('/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      `SELECT * FROM education_resources WHERE id = $1 AND is_active = true`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Education resource not found'
      });
    }
    
    // Increment view count
    await query(
      `UPDATE education_resources SET view_count = view_count + 1 WHERE id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      data: { resource: result.rows[0] }
    });
  } catch (error) {
    logger.error('Get education resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get education resource'
    });
  }
});

// Create education resource (admin only - for now, allow authenticated)
router.post('/resources', authenticateToken, async (req, res) => {
  try {
    const { error, value } = educationResourceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const {
      title, description, type, category, duration, rating, author,
      content_url, thumbnail_url, featured
    } = value;
    
    const result = await query(
      `INSERT INTO education_resources 
       (title, description, type, category, duration, rating, author, content_url, thumbnail_url, featured, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [title, description, type, category, duration || null, rating || 0, author || null, content_url || null, thumbnail_url || null, featured || false]
    );
    
    res.status(201).json({
      success: true,
      message: 'Education resource created successfully',
      data: { resource: result.rows[0] }
    });
  } catch (error) {
    logger.error('Create education resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create education resource'
    });
  }
});

// Update education resource
router.put('/resources/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = educationResourceSchema.validate(req.body, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    
    const {
      title, description, type, category, duration, rating, author,
      content_url, thumbnail_url, featured
    } = value;
    
    const result = await query(
      `UPDATE education_resources 
       SET title = $1, description = $2, type = $3, category = $4, duration = $5, 
           rating = $6, author = $7, content_url = $8, thumbnail_url = $9, 
           featured = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [title, description, type, category, duration || null, rating || 0, author || null, content_url || null, thumbnail_url || null, featured || false, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Education resource not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Education resource updated successfully',
      data: { resource: result.rows[0] }
    });
  } catch (error) {
    logger.error('Update education resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update education resource'
    });
  }
});

// Get categories
router.get('/categories', async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT category, COUNT(*) as count 
       FROM education_resources 
       WHERE is_active = true 
       GROUP BY category 
       ORDER BY category`
    );
    
    res.json({
      success: true,
      data: { categories: result.rows }
    });
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get categories'
    });
  }
});

module.exports = router;
