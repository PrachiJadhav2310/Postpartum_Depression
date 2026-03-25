const { query } = require('../config/database');
const { createNotification } = require('../routes/notifications');
const logger = require('../utils/logger');

/**
 * Real-Time Monitoring Service
 * Monitors user data for concerning patterns and triggers interventions
 */

/**
 * Check for crisis indicators in real-time
 */
const checkCrisisIndicators = async (userId, assessmentData) => {
  try {
    const crisisIndicators = [];
    
    // Check for severe keywords in responses
    const severeKeywords = ['suicide', 'hurt myself', 'end it all', 'better off dead', 'no point living'];
    const assessmentText = JSON.stringify(assessmentData).toLowerCase();
    
    severeKeywords.forEach(keyword => {
      if (assessmentText.includes(keyword)) {
        crisisIndicators.push({
          type: 'severe_keyword',
          keyword,
          severity: 'critical',
          action: 'immediate_intervention'
        });
      }
    });
    
    // Check for extremely high scores
    if (assessmentData.score >= 60) {
      crisisIndicators.push({
        type: 'high_score',
        score: assessmentData.score,
        severity: 'critical',
        action: 'urgent_consultation'
      });
    }
    
    // Check for rapid deterioration
    const previousAssessment = await query(`
      SELECT score, completed_at
      FROM mental_health_assessments 
      WHERE user_id = $1
        AND completed_at < NOW() - INTERVAL '1 minute'
      ORDER BY completed_at DESC 
      LIMIT 1
    `, [userId]);
    
    if (previousAssessment.rows.length > 0) {
      const previous = previousAssessment.rows[0];
      const scoreIncrease = assessmentData.score - previous.score;
      const hoursSinceLast = (new Date() - new Date(previous.completed_at)) / (1000 * 60 * 60);
      
      // Rapid deterioration: >20 point increase in <48 hours
      if (scoreIncrease > 20 && hoursSinceLast < 48) {
        crisisIndicators.push({
          type: 'rapid_deterioration',
          scoreIncrease,
          hoursSinceLast: Math.round(hoursSinceLast),
          severity: 'high',
          action: 'immediate_support'
        });
      }
    }
    
    return crisisIndicators;
  } catch (error) {
    logger.error('Crisis indicator check error:', error);
    return [];
  }
};

/**
 * Trigger crisis intervention
 */
const triggerCrisisIntervention = async (userId, crisisIndicators) => {
  try {
    // Create urgent notification
    await createNotification(
      userId,
      '🚨 Immediate Support Available',
      'Your recent assessment indicates you may need immediate support. Please reach out to crisis resources or your healthcare provider.',
      'critical',
      '/emergency'
    );
    
    // Log crisis event
    await query(`
      INSERT INTO emergency_alerts (user_id, type, message, status, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [
      userId,
      'crisis_detected',
      `Crisis indicators detected: ${crisisIndicators.map(ci => ci.type).join(', ')}`,
      'logged'
    ]);
    
    // TODO: Send SMS/Email to emergency contacts (with user consent)
    // TODO: Notify healthcare provider
    // TODO: Auto-dial crisis hotline (with user permission)
    
    return {
      interventionTriggered: true,
      indicators: crisisIndicators,
      resources: [
        { name: '988 Suicide & Crisis Lifeline', phone: '988', available: '24/7' },
        { name: 'Crisis Text Line', text: '741741', available: '24/7' },
        { name: 'Emergency Services', phone: '911', available: '24/7' }
      ]
    };
  } catch (error) {
    logger.error('Crisis intervention error:', error);
    throw error;
  }
};

/**
 * Monitor daily patterns and detect anomalies
 */
const monitorDailyPatterns = async (userId) => {
  try {
    // Get last 7 days of mood entries
    const moodData = await query(`
      SELECT mood_score, anxiety_level, energy_level, recorded_at
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
      ORDER BY recorded_at DESC
    `, [userId]);
    
    if (moodData.rows.length < 3) {
      return null; // Not enough data
    }
    
    const moods = moodData.rows;
    const avgMood = moods.reduce((sum, m) => sum + m.mood_score, 0) / moods.length;
    const avgAnxiety = moods.reduce((sum, m) => sum + m.anxiety_level, 0) / moods.length;
    
    // Check for concerning patterns
    const concerns = [];
    
    // Low mood for 3+ consecutive days
    const recentLowMoods = moods.slice(0, 3).filter(m => m.mood_score <= 3);
    if (recentLowMoods.length >= 3) {
      concerns.push({
        type: 'sustained_low_mood',
        severity: 'moderate',
        message: 'You\'ve had low mood for several days. Consider reaching out for support.',
        recommendation: 'schedule_assessment'
      });
    }
    
    // High anxiety for 3+ consecutive days
    const recentHighAnxiety = moods.slice(0, 3).filter(m => m.anxiety_level >= 8);
    if (recentHighAnxiety.length >= 3) {
      concerns.push({
        type: 'sustained_high_anxiety',
        severity: 'moderate',
        message: 'Your anxiety levels have been elevated. Consider relaxation techniques or speaking with a professional.',
        recommendation: 'anxiety_management'
      });
    }
    
    // Declining trend
    if (moods.length >= 5) {
      const recentAvg = moods.slice(0, 3).reduce((sum, m) => sum + m.mood_score, 0) / 3;
      const olderAvg = moods.slice(3, 5).reduce((sum, m) => sum + m.mood_score, 0) / 2;
      
      if (recentAvg < olderAvg - 2) {
        concerns.push({
          type: 'declining_trend',
          severity: 'moderate',
          message: 'Your mood has been declining. Consider taking an assessment or reaching out for support.',
          recommendation: 'take_assessment'
        });
      }
    }
    
    // Create notifications for concerns
    if (concerns.length > 0) {
      for (const concern of concerns) {
        await createNotification(
          userId,
          'Wellness Check-in',
          concern.message,
          concern.severity,
          concern.recommendation === 'take_assessment' ? '/detailed-assessment' : '/mental-health'
        );
      }
    }
    
    return {
      patternsDetected: concerns.length > 0,
      concerns,
      statistics: {
        avgMood,
        avgAnxiety,
        dataPoints: moods.length
      }
    };
    
  } catch (error) {
    logger.error('Daily pattern monitoring error:', error);
    return null;
  }
};

/**
 * Schedule daily check-in reminders
 */
const scheduleDailyCheckIns = async (userId, preferences = {}) => {
  try {
    // Get user's preferred check-in times
    const morningTime = preferences.morningCheckIn || '09:00';
    const eveningTime = preferences.eveningCheckIn || '20:00';
    
    // Check if user has checked in today
    const todayCheckIns = await query(`
      SELECT COUNT(*) as count
      FROM mood_entries 
      WHERE user_id = $1 
        AND DATE(recorded_at) = CURRENT_DATE
    `, [userId]);
    
    const hasCheckedIn = parseInt(todayCheckIns.rows[0].count) > 0;
    
    // Create reminder if no check-in today
    if (!hasCheckedIn) {
      const currentHour = new Date().getHours();
      
      // Morning reminder (if before 12 PM and no check-in)
      if (currentHour < 12) {
        await createNotification(
          userId,
          'Good Morning! 🌅',
          'Take a moment to check in with your mood and wellbeing today.',
          'info',
          '/mental-health'
        );
      }
      // Evening reminder (if after 6 PM and no check-in)
      else if (currentHour >= 18) {
        await createNotification(
          userId,
          'Evening Check-in 🌙',
          'How are you feeling today? A quick check-in helps track your wellbeing.',
          'info',
          '/mental-health'
        );
      }
    }
    
    return { reminderSent: !hasCheckedIn };
  } catch (error) {
    logger.error('Daily check-in scheduling error:', error);
    return { reminderSent: false };
  }
};

/**
 * Generate proactive recommendations based on patterns
 */
const generateProactiveRecommendations = async (userId) => {
  try {
    // Get recent data
    const [moodData, assessmentData, healthData] = await Promise.all([
      query(`
        SELECT AVG(mood_score) as avg_mood, AVG(anxiety_level) as avg_anxiety
        FROM mood_entries 
        WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '7 days'
      `, [userId]),
      query(`
        SELECT risk_level, score, completed_at
        FROM mental_health_assessments 
        WHERE user_id = $1 
        ORDER BY completed_at DESC 
        LIMIT 1
      `, [userId]),
      query(`
        SELECT AVG(value) as avg_sleep
        FROM health_records 
        WHERE user_id = $1 
          AND record_type = 'sleep_hours'
          AND recorded_at >= NOW() - INTERVAL '7 days'
      `, [userId])
    ]);
    
    const recommendations = [];
    
    // Sleep recommendations
    if (healthData.rows[0]?.avg_sleep && healthData.rows[0].avg_sleep < 6) {
      recommendations.push({
        type: 'sleep',
        priority: 'high',
        message: 'Your sleep has been below optimal levels. Poor sleep can significantly impact mental health.',
        action: 'improve_sleep_hygiene',
        resources: ['/education?category=sleep']
      });
    }
    
    // Mood-based recommendations
    if (moodData.rows[0]?.avg_mood && moodData.rows[0].avg_mood <= 4) {
      recommendations.push({
        type: 'mood',
        priority: 'medium',
        message: 'Your mood has been lower recently. Consider taking an assessment or reaching out for support.',
        action: 'take_assessment',
        resources: ['/detailed-assessment']
      });
    }
    
    // Assessment age recommendations
    if (assessmentData.rows.length > 0) {
      const lastAssessment = assessmentData.rows[0];
      const daysSinceAssessment = Math.floor(
        (new Date() - new Date(lastAssessment.completed_at)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceAssessment > 14 && lastAssessment.risk_level !== 'low') {
        recommendations.push({
          type: 'followup',
          priority: 'medium',
          message: `It's been ${daysSinceAssessment} days since your last assessment. Consider retaking to track your progress.`,
          action: 'retake_assessment',
          resources: ['/detailed-assessment']
        });
      }
    }
    
    return recommendations;
  } catch (error) {
    logger.error('Proactive recommendations error:', error);
    return [];
  }
};

module.exports = {
  checkCrisisIndicators,
  triggerCrisisIntervention,
  monitorDailyPatterns,
  scheduleDailyCheckIns,
  generateProactiveRecommendations
};
