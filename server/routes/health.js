const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { analyzeHealthTrends, generateHealthInsights } = require('../services/healthAnalytics');

const router = express.Router();

// Validation schemas
const healthRecordSchema = Joi.object({
  recordType: Joi.string().valid(
    'temperature', 'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
    'weight', 'sleep_hours', 'sleep_quality', 'water_intake', 'exercise_minutes'
  ).required(),
  value: Joi.number().required(),
  unit: Joi.string().required(),
  notes: Joi.string().optional(),
  recordedAt: Joi.date().optional()
});

const symptomSchema = Joi.object({
  symptomName: Joi.string().required(),
  severity: Joi.number().integer().min(1).max(5).required(),
  notes: Joi.string().optional(),
  recordedAt: Joi.date().optional()
});

// Update health record
router.put('/records/:recordId', authenticateToken, async (req, res) => {
  try {
    const { error, value } = healthRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { recordType, value: recordValue, unit, notes, recordedAt } = value;
    const { recordId } = req.params;

    const result = await query(
      `UPDATE health_records
       SET record_type = $1, value = $2, unit = $3, notes = $4, recorded_at = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [recordType, recordValue, unit, notes, recordedAt || new Date(), recordId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Health record not found'
      });
    }

    res.json({
      success: true,
      message: 'Health record updated successfully',
      data: { record: result.rows[0] }
    });
  } catch (error) {
    logger.error('Update health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update health record'
    });
  }
});

// Delete health record
router.delete('/records/:recordId', authenticateToken, async (req, res) => {
  try {
    const { recordId } = req.params;
    const result = await query(
      'DELETE FROM health_records WHERE id = $1 AND user_id = $2 RETURNING id',
      [recordId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Health record not found'
      });
    }

    res.json({
      success: true,
      message: 'Health record deleted successfully'
    });
  } catch (error) {
    logger.error('Delete health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete health record'
    });
  }
});

// Add health record
router.post('/records', authenticateToken, async (req, res) => {
  try {
    const { error, value } = healthRecordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { recordType, value: recordValue, unit, notes, recordedAt } = value;

    const result = await query(
      `INSERT INTO health_records (user_id, record_type, value, unit, notes, recorded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [req.user.id, recordType, recordValue, unit, notes, recordedAt || new Date()]
    );

    // Trigger health analysis (async)
    analyzeHealthTrends(req.user.id).catch(error => {
      logger.error('Health analysis error:', error);
    });

    res.status(201).json({
      success: true,
      message: 'Health record added successfully',
      data: { record: result.rows[0] }
    });

  } catch (error) {
    logger.error('Add health record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add health record'
    });
  }
});

// Get health records
router.get('/records', authenticateToken, async (req, res) => {
  try {
    const { type, limit = 50, offset = 0, startDate, endDate } = req.query;

    let queryText = `
      SELECT * FROM health_records 
      WHERE user_id = $1
    `;
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (type) {
      queryText += ` AND record_type = $${++paramCount}`;
      queryParams.push(type);
    }

    if (startDate) {
      queryText += ` AND recorded_at >= $${++paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      queryText += ` AND recorded_at <= $${++paramCount}`;
      queryParams.push(endDate);
    }

    queryText += ` ORDER BY recorded_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: {
        records: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });

  } catch (error) {
    logger.error('Get health records error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health records'
    });
  }
});

// Add symptom
router.post('/symptoms', authenticateToken, async (req, res) => {
  try {
    const { error, value } = symptomSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { symptomName, severity, notes, recordedAt } = value;

    const result = await query(
      `INSERT INTO symptoms (user_id, symptom_name, severity, notes, recorded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [req.user.id, symptomName, severity, notes, recordedAt || new Date()]
    );

    res.status(201).json({
      success: true,
      message: 'Symptom recorded successfully',
      data: { symptom: result.rows[0] }
    });

  } catch (error) {
    logger.error('Add symptom error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record symptom'
    });
  }
});

// Update symptom
router.put('/symptoms/:symptomId', authenticateToken, async (req, res) => {
  try {
    const { error, value } = symptomSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { symptomName, severity, notes, recordedAt } = value;
    const { symptomId } = req.params;

    const result = await query(
      `UPDATE symptoms
       SET symptom_name = $1, severity = $2, notes = $3, recorded_at = $4
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [symptomName, severity, notes, recordedAt || new Date(), symptomId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Symptom record not found'
      });
    }

    res.json({
      success: true,
      message: 'Symptom updated successfully',
      data: { symptom: result.rows[0] }
    });
  } catch (error) {
    logger.error('Update symptom error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update symptom'
    });
  }
});

// Delete symptom
router.delete('/symptoms/:symptomId', authenticateToken, async (req, res) => {
  try {
    const { symptomId } = req.params;
    const result = await query(
      'DELETE FROM symptoms WHERE id = $1 AND user_id = $2 RETURNING id',
      [symptomId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Symptom record not found'
      });
    }

    res.json({
      success: true,
      message: 'Symptom deleted successfully'
    });
  } catch (error) {
    logger.error('Delete symptom error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete symptom'
    });
  }
});

// Get symptoms
router.get('/symptoms', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, startDate, endDate } = req.query;

    let queryText = `
      SELECT * FROM symptoms 
      WHERE user_id = $1
    `;
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (startDate) {
      queryText += ` AND recorded_at >= $${++paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      queryText += ` AND recorded_at <= $${++paramCount}`;
      queryParams.push(endDate);
    }

    queryText += ` ORDER BY recorded_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: {
        symptoms: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });

  } catch (error) {
    logger.error('Get symptoms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get symptoms'
    });
  }
});

// Get health dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get latest vital signs
    const vitalsResult = await query(`
      SELECT DISTINCT ON (record_type) 
        record_type, value, unit, recorded_at
      FROM health_records 
      WHERE user_id = $1 
      ORDER BY record_type, recorded_at DESC
    `, [req.user.id]);

    // Get recent symptoms
    const symptomsResult = await query(`
      SELECT symptom_name, severity, recorded_at
      FROM symptoms 
      WHERE user_id = $1 
      ORDER BY recorded_at DESC 
      LIMIT 5
    `, [req.user.id]);

    // Get health trends
    const trendsResult = await query(`
      SELECT 
        record_type,
        AVG(value) as avg_value,
        COUNT(*) as count,
        DATE_TRUNC('day', recorded_at) as date
      FROM health_records 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
      GROUP BY record_type, DATE_TRUNC('day', recorded_at)
      ORDER BY date DESC
    `, [req.user.id]);

    // Generate health insights
    const insights = await generateHealthInsights(req.user.id);

    res.json({
      success: true,
      data: {
        vitals: vitalsResult.rows,
        recentSymptoms: symptomsResult.rows,
        trends: trendsResult.rows,
        insights
      }
    });

  } catch (error) {
    logger.error('Get health dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health dashboard data'
    });
  }
});

// Health predictions endpoint
router.get('/predictions', authenticateToken, async (req, res) => {
  try {
    // Get user's health history
    const healthHistory = await query(`
      SELECT record_type, value, recorded_at
      FROM health_records 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '30 days'
      ORDER BY recorded_at DESC
    `, [req.user.id]);

    const moodHistory = await query(`
      SELECT mood_score, energy_level, anxiety_level, recorded_at
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '30 days'
      ORDER BY recorded_at DESC
    `, [req.user.id]);

    // Simple prediction algorithm (in production, use ML models)
    const predictions = {
      riskFactors: [],
      recommendations: [],
      trends: {}
    };

    // Analyze trends and generate predictions
    if (healthHistory.rows.length > 0) {
      const heartRateData = healthHistory.rows.filter(r => r.record_type === 'heart_rate');
      if (heartRateData.length >= 3) {
        const avgHeartRate = heartRateData.reduce((sum, r) => sum + parseFloat(r.value), 0) / heartRateData.length;
        if (avgHeartRate > 100) {
          predictions.riskFactors.push({
            type: 'elevated_heart_rate',
            severity: 'medium',
            message: 'Your heart rate has been consistently elevated'
          });
          predictions.recommendations.push({
            type: 'lifestyle',
            message: 'Consider stress reduction techniques and gentle exercise'
          });
        }
      }
    }

    if (moodHistory.rows.length > 0) {
      const avgMood = moodHistory.rows.reduce((sum, r) => sum + r.mood_score, 0) / moodHistory.rows.length;
      if (avgMood < 5) {
        predictions.riskFactors.push({
          type: 'low_mood',
          severity: 'high',
          message: 'Your mood scores indicate potential depression risk'
        });
        predictions.recommendations.push({
          type: 'mental_health',
          message: 'Consider speaking with a mental health professional'
        });
      }
    }

    res.json({
      success: true,
      data: { predictions }
    });

  } catch (error) {
    logger.error('Health predictions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate health predictions'
    });
  }
});

module.exports = router;