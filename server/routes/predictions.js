const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { generateHealthPrediction, predictDepressionRisk, predictHealthConcerns } = require('../services/aiPredictionService');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get comprehensive health prediction
router.get('/health-prediction', authenticateToken, async (req, res) => {
  try {
    const prediction = await generateHealthPrediction(req.user.id);

    // Store prediction in database for tracking
    await query(`
      INSERT INTO health_predictions 
      (user_id, overall_risk_score, needs_consultation, urgent_care, 
       mental_health_risk, physical_health_risk, recommendations, prediction_data, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      req.user.id,
      prediction.overallRiskScore,
      prediction.needsDoctorConsultation,
      prediction.urgentCareNeeded,
      prediction.mentalHealth.riskScore,
      prediction.physicalHealth.riskScore,
      JSON.stringify(prediction.recommendations),
      JSON.stringify(prediction)
    ]);

    res.json({
      success: true,
      data: { prediction }
    });

  } catch (error) {
    logger.error('Health prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate health prediction'
    });
  }
});

// Get depression risk assessment
router.get('/depression-risk', authenticateToken, async (req, res) => {
  try {
    const depressionRisk = await predictDepressionRisk(req.user.id);

    res.json({
      success: true,
      data: { depressionRisk }
    });

  } catch (error) {
    logger.error('Depression risk prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assess depression risk'
    });
  }
});

// Get physical health concerns
router.get('/health-concerns', authenticateToken, async (req, res) => {
  try {
    const healthConcerns = await predictHealthConcerns(req.user.id);

    res.json({
      success: true,
      data: { healthConcerns }
    });

  } catch (error) {
    logger.error('Health concerns prediction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assess health concerns'
    });
  }
});

// Get prediction history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const result = await query(`
      SELECT * FROM health_predictions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [req.user.id, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: {
        predictions: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      }
    });

  } catch (error) {
    logger.error('Prediction history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get prediction history'
    });
  }
});

// Analyze text sentiment (for real-time analysis)
router.post('/analyze-text', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text is required for analysis'
      });
    }

    const { analyzeTextSentiment } = require('../services/aiPredictionService');
    const analysis = analyzeTextSentiment(text);

    // Determine if immediate attention is needed
    const needsAttention = analysis.score >= 30 || 
      analysis.indicators.some(i => i.severity === 'severe');

    res.json({
      success: true,
      data: {
        analysis,
        needsAttention,
        recommendations: needsAttention ? [
          'Consider reaching out for support',
          'Contact healthcare provider if concerns persist',
          'Use crisis resources if having thoughts of self-harm'
        ] : [
          'Continue monitoring your wellbeing',
          'Practice self-care activities'
        ]
      }
    });

  } catch (error) {
    logger.error('Text analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze text'
    });
  }
});

module.exports = router;