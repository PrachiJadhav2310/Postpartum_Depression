const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get user dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get latest health prediction
    const predictionResult = await query(`
      SELECT * FROM health_predictions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [req.user.id]);

    // Get recent mood entries
    const moodResult = await query(`
      SELECT mood_score, energy_level, anxiety_level, recorded_at
      FROM mood_entries 
      WHERE user_id = $1 
      ORDER BY recorded_at DESC 
      LIMIT 7
    `, [req.user.id]);

    // Get recent health records
    const healthResult = await query(`
      SELECT DISTINCT ON (record_type) 
        record_type, value, unit, recorded_at
      FROM health_records 
      WHERE user_id = $1 
      ORDER BY record_type, recorded_at DESC
    `, [req.user.id]);

    // Get user profile
    const profileResult = await query(`
      SELECT full_name, birth_date, due_date FROM user_profiles WHERE id = $1
    `, [req.user.id]);

    const user = profileResult.rows[0];
    let daysPostpartum = 0;

    if (user && user.birth_date) {
      const birthDate = new Date(user.birth_date);
      const today = new Date();
      daysPostpartum = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
    }

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          daysPostpartum
        },
        latestPrediction: predictionResult.rows[0] || null,
        recentMoods: moodResult.rows,
        vitals: healthResult.rows,
        summary: {
          needsAttention: predictionResult.rows[0]?.needs_consultation || false,
          urgentCare: predictionResult.rows[0]?.urgent_care || false,
          overallRisk: predictionResult.rows[0]?.overall_risk_score || 0
        }
      }
    });

  } catch (error) {
    logger.error('User dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data'
    });
  }
});

module.exports = router;