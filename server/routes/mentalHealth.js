const express = require('express');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { assessDepressionRisk, generateMentalHealthInsights } = require('../services/mentalHealthService');
const { predictPPD } = require('../services/bertPPDPredictionService');
const { checkCrisisIndicators, triggerCrisisIntervention, monitorDailyPatterns } = require('../services/realTimeMonitoringService');

const router = express.Router();

// Validation schemas
const moodEntrySchema = Joi.object({
  moodScore: Joi.number().integer().min(1).max(10).required(),
  energyLevel: Joi.number().integer().min(1).max(10).required(),
  anxietyLevel: Joi.number().integer().min(1).max(10).required(),
  notes: Joi.string().optional(),
  recordedAt: Joi.date().optional()
});

const assessmentSchema = Joi.object({
  assessmentType: Joi.string().valid('edinburgh', 'phq9', 'gad7', 'custom').required(),
  responses: Joi.alternatives().try(
    Joi.array().items(Joi.number()),
    Joi.object()
  ).required(),
  notes: Joi.string().optional()
});

// Add mood entry
router.post('/mood', authenticateToken, async (req, res) => {
  try {
    const { error, value } = moodEntrySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { moodScore, energyLevel, anxietyLevel, notes, recordedAt } = value;

    const result = await query(
      `INSERT INTO mood_entries (user_id, mood_score, energy_level, anxiety_level, notes, recorded_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [req.user.id, moodScore, energyLevel, anxietyLevel, notes, recordedAt || new Date()]
    );

    // Check for concerning patterns
    const recentMoods = await query(
      `SELECT mood_score, anxiety_level FROM mood_entries 
       WHERE user_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 7`,
      [req.user.id]
    );

    let alert = null;
    if (recentMoods.rows.length >= 3) {
      const avgMood = recentMoods.rows.reduce((sum, entry) => sum + entry.mood_score, 0) / recentMoods.rows.length;
      const avgAnxiety = recentMoods.rows.reduce((sum, entry) => sum + entry.anxiety_level, 0) / recentMoods.rows.length;
      
      if (avgMood <= 3 || avgAnxiety >= 8) {
        alert = {
          type: 'mental_health_concern',
          severity: 'high',
          message: 'Your recent mood entries show concerning patterns. Consider reaching out for support.'
        };
      }
    }

    res.status(201).json({
      success: true,
      message: 'Mood entry recorded successfully',
      data: { 
        moodEntry: result.rows[0],
        alert
      }
    });

  } catch (error) {
    logger.error('Add mood entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record mood entry'
    });
  }
});

// Get mood entries
router.get('/mood', authenticateToken, async (req, res) => {
  try {
    const { limit = 30, offset = 0, startDate, endDate } = req.query;

    let queryText = `
      SELECT * FROM mood_entries 
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

    // Calculate mood statistics
    const statsResult = await query(`
      SELECT 
        AVG(mood_score) as avg_mood,
        AVG(energy_level) as avg_energy,
        AVG(anxiety_level) as avg_anxiety,
        COUNT(*) as total_entries
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '30 days'
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        moodEntries: result.rows,
        statistics: statsResult.rows[0],
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });

  } catch (error) {
    logger.error('Get mood entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mood entries'
    });
  }
});

// Submit mental health assessment
router.post('/assessment', authenticateToken, async (req, res) => {
  try {
    const { error, value } = assessmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { assessmentType, responses, notes } = value;

    // Calculate score based on assessment type
    let score = 0;
    let riskLevel = 'low';
    
    // Handle both array and object responses
    let responsesArray = Array.isArray(responses) ? responses : [];
    let assessmentData = null;

    // If responses is an object (full assessment data), extract array and data
    if (!Array.isArray(responses) && typeof responses === 'object') {
      assessmentData = responses;
      // Try to extract responses array from object
      if (responses.responses && Array.isArray(responses.responses)) {
        responsesArray = responses.responses;
      } else if (responses.category_scores) {
        // Calculate array from category scores
        responsesArray = Object.values(responses.category_scores);
      }
      // Use stored score and risk level if available
      if (responses.score) score = responses.score;
      if (responses.risk_level) riskLevel = responses.risk_level;
    }

    switch (assessmentType) {
      case 'edinburgh':
        if (responsesArray.length > 0) {
          score = responsesArray.reduce((sum, response) => sum + response, 0);
        }
        if (score >= 13) riskLevel = 'severe';
        else if (score >= 10) riskLevel = 'moderate';
        else if (score >= 6) riskLevel = 'mild';
        break;
      
      case 'phq9':
        if (responsesArray.length > 0) {
          score = responsesArray.reduce((sum, response) => sum + response, 0);
        }
        // PHQ-9 Clinical Standard Thresholds:
        // 0-4: Minimal, 5-9: Mild, 10-14: Moderate, 15-19: Moderately Severe, 20-27: Severe
        if (score >= 20) riskLevel = 'severe';
        else if (score >= 15) riskLevel = 'moderate'; // Moderately severe mapped to moderate
        else if (score >= 10) riskLevel = 'moderate';
        else if (score >= 5) riskLevel = 'mild';
        else riskLevel = 'low'; // Minimal depression
        break;
      
      default:
        if (responsesArray.length > 0 && !score) {
          score = responsesArray.reduce((sum, response) => sum + response, 0);
        }
        if (!assessmentData || !assessmentData.risk_level) {
          riskLevel = assessDepressionRisk(score, responsesArray.length);
        }
    }

    // Store full assessment data if provided, otherwise store responses array
    const responsesToStore = assessmentData || responsesArray;

    const result = await query(
      `INSERT INTO mental_health_assessments 
       (user_id, assessment_type, score, responses, risk_level, completed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [req.user.id, assessmentType, score, JSON.stringify(responsesToStore), riskLevel]
    );

    // Generate recommendations based on risk level
    const recommendations = [];
    if (riskLevel === 'severe') {
      recommendations.push({
        type: 'urgent',
        message: 'Please consider contacting a mental health professional immediately.',
        resources: ['Crisis Hotline: 988', 'Emergency: 911']
      });
    } else if (riskLevel === 'moderate') {
      recommendations.push({
        type: 'professional_help',
        message: 'We recommend speaking with a healthcare provider about your mental health.',
        resources: ['Find a therapist', 'Contact your doctor']
      });
    } else if (riskLevel === 'mild') {
      recommendations.push({
        type: 'self_care',
        message: 'Consider incorporating stress-reduction activities into your routine.',
        resources: ['Meditation apps', 'Support groups', 'Exercise routines']
      });
    }

    res.status(201).json({
      success: true,
      message: 'Assessment completed successfully',
      data: {
        assessment: result.rows[0],
        recommendations
      }
    });

  } catch (error) {
    logger.error('Submit assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assessment'
    });
  }
});

// Get mental health assessments
router.get('/assessments', authenticateToken, async (req, res) => {
  try {
    const { type, limit = 10, offset = 0 } = req.query;

    let queryText = `
      SELECT * FROM mental_health_assessments 
      WHERE user_id = $1
    `;
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (type) {
      queryText += ` AND assessment_type = $${++paramCount}`;
      queryParams.push(type);
    }

    queryText += ` ORDER BY completed_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    res.json({
      success: true,
      data: {
        assessments: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });

  } catch (error) {
    logger.error('Get assessments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assessments'
    });
  }
});

// Get mental health insights
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const insights = await generateMentalHealthInsights(req.user.id);

    res.json({
      success: true,
      data: { insights }
    });

  } catch (error) {
    logger.error('Get mental health insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate mental health insights'
    });
  }
});

// Mental health dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get recent mood trends
    const moodTrends = await query(`
      SELECT 
        DATE_TRUNC('day', recorded_at) as date,
        AVG(mood_score) as avg_mood,
        AVG(energy_level) as avg_energy,
        AVG(anxiety_level) as avg_anxiety
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE_TRUNC('day', recorded_at)
      ORDER BY date DESC
    `, [req.user.id]);

    // Get latest assessment
    const latestAssessment = await query(`
      SELECT * FROM mental_health_assessments 
      WHERE user_id = $1 
      ORDER BY completed_at DESC 
      LIMIT 1
    `, [req.user.id]);

    // Get mood statistics
    const moodStats = await query(`
      SELECT 
        AVG(mood_score) as avg_mood,
        MIN(mood_score) as min_mood,
        MAX(mood_score) as max_mood,
        COUNT(*) as total_entries
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '30 days'
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        moodTrends: moodTrends.rows,
        latestAssessment: latestAssessment.rows[0] || null,
        moodStatistics: moodStats.rows[0]
      }
    });

  } catch (error) {
    logger.error('Mental health dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get mental health dashboard data'
    });
  }
});

// Submit detailed assessment with BERT-based PPD prediction
router.post('/detailed-assessment', authenticateToken, async (req, res) => {
  try {
    const { assessmentData } = req.body;

    if (!assessmentData) {
      return res.status(400).json({
        success: false,
        message: 'Assessment data is required'
      });
    }

    // Use BERT-based prediction service
    const prediction = await predictPPD(req.user.id, assessmentData);

    // Determine risk level from prediction
    const riskLevel = prediction.riskLevel;

    // Validate required fields
    if (typeof assessmentData.score !== 'number') {
      assessmentData.score = 0;
    }
    
    // Normalize assessment_type to match database constraint
    // Database only allows: 'edinburgh', 'phq9', 'gad7', 'custom'
    let assessmentType = assessmentData.assessment_type || 'custom';
    if (assessmentType === 'detailed_ppd' || assessmentType === 'initial_postpartum') {
      // Store original type in the data for reference
      assessmentData.original_assessment_type = assessmentData.assessment_type;
      assessmentType = 'custom'; // Convert to 'custom' for database constraint
    }
    
    // Store assessment in database
    const result = await query(
      `INSERT INTO mental_health_assessments 
       (user_id, assessment_type, score, responses, risk_level, completed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [
        req.user.id,
        assessmentType,
        assessmentData.score || 0,
        JSON.stringify(assessmentData),
        riskLevel || 'low'
      ]
    );
    
    if (!result.rows || result.rows.length === 0) {
      throw new Error('Failed to save assessment to database');
    }

    // Store prediction in health_predictions table (don't fail if this fails)
    try {
      await query(
        `INSERT INTO health_predictions 
         (user_id, overall_risk_score, needs_consultation, urgent_care, 
          mental_health_risk, physical_health_risk, recommendations, prediction_data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          req.user.id,
          Math.round(prediction.riskScore),
          prediction.needsDoctorConsultation,
          prediction.urgentCare,
          Math.round(prediction.riskCalculation.mental_health_score),
          Math.round((prediction.riskCalculation.physical_multiplier - 1) * 100),
          JSON.stringify(prediction.recommendations),
          JSON.stringify(prediction)
        ]
      );
    } catch (predictionError) {
      logger.warn('Failed to save health prediction (non-critical):', predictionError);
      // Continue even if prediction save fails - assessment is more important
    }

    // Format response similar to RiskResponse component expectations
    // `crisisIntervention`/`crisisIndicators` are used by the UI layer (and should never be undefined).
    const crisisIndicators = Array.isArray(prediction.riskIndicators)
      ? prediction.riskIndicators
      : [];

    // `urgentCare`/`needsDoctorConsultation` are booleans from the prediction service.
    const crisisIntervention =
      prediction.urgentCare
        ? 'Immediate support may be needed. Please contact a healthcare provider or call your local crisis line.'
        : prediction.needsDoctorConsultation
        ? 'Consider contacting a healthcare provider soon for follow-up and support.'
        : null;

    const riskResult = {
      riskLevel: prediction.riskLevel,
      riskPercentage: prediction.riskPercentage,
      confidence: prediction.confidence,
      recommendations: prediction.recommendations.map(rec => 
        typeof rec === 'string' ? rec : (rec.message || rec.title || '')
      ),
      actions: prediction.recommendations.map((rec, index) => ({
        type: rec.type || 'self-care',
        title: rec.title || rec.message || 'Take Action',
        description: rec.description || rec.message || 'Follow this recommendation',
        priority: rec.priority || 'medium',
        actionUrl: rec.actionUrl,
      })),
      emergencyContact: prediction.urgentCare,
      categoryScores: assessmentData.category_scores || {},
      factors: prediction.factors,
      features: prediction.features,
    };

    res.status(201).json({
      success: true,
      message: 'Detailed assessment completed successfully',
      data: {
        assessment: result.rows[0],
        prediction: riskResult,
        mlAnalysis: {
          confidence: prediction.confidence,
          features: prediction.features,
          textFeatures: prediction.textFeatures,
        },
        crisisIntervention: crisisIntervention || null,
        crisisIndicators: crisisIndicators.length > 0 ? crisisIndicators : null
      }
    });

  } catch (error) {
    logger.error('Detailed assessment error:', error);
    logger.error('Error stack:', error.stack);
    logger.error('Request body:', req.body);
    
    // Provide more detailed error message
    let errorMessage = 'Failed to process detailed assessment';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code) {
      errorMessage = `Database error: ${error.code}`;
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;