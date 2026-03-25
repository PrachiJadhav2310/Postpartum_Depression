const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get user analytics dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const { timeframe = '30' } = req.query; // days

    // Get mood trends
    const moodTrends = await query(`
      SELECT 
        DATE_TRUNC('day', recorded_at) as date,
        AVG(mood_score) as avg_mood,
        AVG(energy_level) as avg_energy,
        AVG(anxiety_level) as avg_anxiety,
        COUNT(*) as entries
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '${parseInt(timeframe)} days'
      GROUP BY DATE_TRUNC('day', recorded_at)
      ORDER BY date DESC
    `, [req.user.id]);

    // Get health metrics trends
    const healthTrends = await query(`
      SELECT 
        record_type,
        DATE_TRUNC('day', recorded_at) as date,
        AVG(value) as avg_value,
        COUNT(*) as readings
      FROM health_records 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '${parseInt(timeframe)} days'
      GROUP BY record_type, DATE_TRUNC('day', recorded_at)
      ORDER BY date DESC
    `, [req.user.id]);

    // Get symptom frequency
    const symptomFrequency = await query(`
      SELECT 
        symptom_name,
        COUNT(*) as frequency,
        AVG(severity) as avg_severity
      FROM symptoms 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '${parseInt(timeframe)} days'
      GROUP BY symptom_name
      ORDER BY frequency DESC
    `, [req.user.id]);

    // Get assessment history
    const assessmentHistory = await query(`
      SELECT 
        assessment_type,
        score,
        risk_level,
        completed_at
      FROM mental_health_assessments 
      WHERE user_id = $1 
      ORDER BY completed_at DESC
      LIMIT 10
    `, [req.user.id]);

    res.json({
      success: true,
      data: {
        moodTrends: moodTrends.rows,
        healthTrends: healthTrends.rows,
        symptomFrequency: symptomFrequency.rows,
        assessmentHistory: assessmentHistory.rows,
        timeframe: parseInt(timeframe)
      }
    });

  } catch (error) {
    logger.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics data'
    });
  }
});

// Get health insights
router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const insights = [];

    // Get recent data for analysis
    const recentMoods = await query(`
      SELECT AVG(mood_score) as avg_mood, AVG(anxiety_level) as avg_anxiety
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
    `, [req.user.id]);

    const recentSymptoms = await query(`
      SELECT COUNT(*) as symptom_count, AVG(severity) as avg_severity
      FROM symptoms 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
    `, [req.user.id]);

    // Generate insights based on data
    const moodData = recentMoods.rows[0];
    const symptomData = recentSymptoms.rows[0];

    if (moodData.avg_mood && moodData.avg_mood < 5) {
      insights.push({
        type: 'warning',
        title: 'Low Mood Pattern',
        message: 'Your mood has been below average this week. Consider reaching out for support.',
        priority: 'high'
      });
    }

    if (moodData.avg_anxiety && moodData.avg_anxiety > 7) {
      insights.push({
        type: 'warning',
        title: 'Elevated Anxiety',
        message: 'Your anxiety levels have been high. Try relaxation techniques or speak with a professional.',
        priority: 'high'
      });
    }

    if (symptomData.symptom_count > 5) {
      insights.push({
        type: 'info',
        title: 'Multiple Symptoms',
        message: 'You\'ve reported several symptoms this week. Consider discussing with your healthcare provider.',
        priority: 'medium'
      });
    }

    // Add positive insights
    if (moodData.avg_mood && moodData.avg_mood >= 7) {
      insights.push({
        type: 'positive',
        title: 'Good Mood Trend',
        message: 'Your mood has been consistently good this week. Keep up the great work!',
        priority: 'low'
      });
    }

    res.json({
      success: true,
      data: { insights }
    });

  } catch (error) {
    logger.error('Health insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate insights'
    });
  }
});

module.exports = router;