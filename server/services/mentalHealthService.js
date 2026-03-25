const { query } = require('../config/database');
const logger = require('../utils/logger');

// Assess depression risk based on score and assessment type
const assessDepressionRisk = (score, maxScore) => {
  const percentage = (score / maxScore) * 100;
  
  if (percentage >= 75) return 'severe';
  if (percentage >= 50) return 'moderate';
  if (percentage >= 25) return 'mild';
  return 'low';
};

// Generate mental health insights
const generateMentalHealthInsights = async (userId) => {
  try {
    const insights = [];

    // Get recent mood data
    const moodData = await query(`
      SELECT mood_score, energy_level, anxiety_level, recorded_at
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '30 days'
      ORDER BY recorded_at DESC
    `, [userId]);

    // Get recent assessments
    const assessments = await query(`
      SELECT assessment_type, score, risk_level, completed_at
      FROM mental_health_assessments 
      WHERE user_id = $1 
      ORDER BY completed_at DESC 
      LIMIT 3
    `, [userId]);

    const moods = moodData.rows;
    const recentAssessments = assessments.rows;

    // Analyze mood patterns
    if (moods.length >= 7) {
      const avgMood = moods.reduce((sum, m) => sum + m.mood_score, 0) / moods.length;
      const avgEnergy = moods.reduce((sum, m) => sum + m.energy_level, 0) / moods.length;
      const avgAnxiety = moods.reduce((sum, m) => sum + m.anxiety_level, 0) / moods.length;

      // Low mood pattern
      if (avgMood <= 4) {
        insights.push({
          type: 'warning',
          category: 'mood',
          title: 'Persistent Low Mood',
          message: `Your average mood score (${avgMood.toFixed(1)}/10) indicates persistent low mood over the past month.`,
          recommendations: [
            'Consider speaking with a mental health professional',
            'Reach out to friends and family for support',
            'Try engaging in activities you previously enjoyed',
            'Consider joining a support group'
          ],
          priority: 'high',
          resources: [
            { name: 'Crisis Text Line', contact: 'Text HOME to 741741' },
            { name: 'National Suicide Prevention Lifeline', contact: '988' }
          ]
        });
      } else if (avgMood <= 6) {
        insights.push({
          type: 'info',
          category: 'mood',
          title: 'Below Average Mood',
          message: `Your mood has been below average (${avgMood.toFixed(1)}/10). This is common during postpartum period.`,
          recommendations: [
            'Practice self-care activities',
            'Maintain social connections',
            'Consider light exercise or walks',
            'Ensure adequate sleep when possible'
          ],
          priority: 'medium'
        });
      }

      // High anxiety pattern
      if (avgAnxiety >= 7) {
        insights.push({
          type: 'warning',
          category: 'anxiety',
          title: 'Elevated Anxiety Levels',
          message: `Your anxiety levels (${avgAnxiety.toFixed(1)}/10) have been consistently high.`,
          recommendations: [
            'Practice deep breathing exercises',
            'Try mindfulness or meditation',
            'Consider professional counseling',
            'Limit caffeine intake'
          ],
          priority: 'high'
        });
      }

      // Low energy pattern
      if (avgEnergy <= 4) {
        insights.push({
          type: 'info',
          category: 'energy',
          title: 'Low Energy Levels',
          message: `Your energy levels (${avgEnergy.toFixed(1)}/10) have been consistently low.`,
          recommendations: [
            'Ensure adequate nutrition',
            'Try to get sunlight exposure',
            'Consider gentle exercise',
            'Ask for help with daily tasks'
          ],
          priority: 'medium'
        });
      }

      // Mood volatility
      const moodVariance = moods.reduce((sum, m) => {
        return sum + Math.pow(m.mood_score - avgMood, 2);
      }, 0) / moods.length;

      if (moodVariance > 6) {
        insights.push({
          type: 'info',
          category: 'mood',
          title: 'Mood Fluctuations',
          message: 'Your mood has been fluctuating significantly, which is common during postpartum period.',
          recommendations: [
            'Track mood triggers in a journal',
            'Maintain consistent daily routines',
            'Practice stress management techniques',
            'Discuss with your healthcare provider'
          ],
          priority: 'low'
        });
      }
    }

    // Analyze assessment results
    if (recentAssessments.length > 0) {
      const latestAssessment = recentAssessments[0];
      
      if (latestAssessment.risk_level === 'severe') {
        insights.push({
          type: 'alert',
          category: 'assessment',
          title: 'High Risk Assessment Result',
          message: `Your recent ${latestAssessment.assessment_type} assessment indicates severe risk. Please seek immediate professional help.`,
          recommendations: [
            'Contact your healthcare provider immediately',
            'Reach out to a mental health crisis line',
            'Don\'t be alone - stay with family or friends',
            'Remove any means of self-harm from your environment'
          ],
          priority: 'critical',
          resources: [
            { name: 'Emergency Services', contact: '911' },
            { name: 'Crisis Text Line', contact: 'Text HOME to 741741' },
            { name: 'National Suicide Prevention Lifeline', contact: '988' }
          ]
        });
      } else if (latestAssessment.risk_level === 'moderate') {
        insights.push({
          type: 'warning',
          category: 'assessment',
          title: 'Moderate Risk Assessment',
          message: `Your recent assessment shows moderate risk for mental health concerns.`,
          recommendations: [
            'Schedule an appointment with a mental health professional',
            'Increase social support and connections',
            'Monitor your symptoms closely',
            'Consider therapy or counseling'
          ],
          priority: 'high'
        });
      }
    }

    // Positive reinforcement
    if (moods.length >= 7) {
      const recentMoods = moods.slice(0, 7);
      const recentAvg = recentMoods.reduce((sum, m) => sum + m.mood_score, 0) / recentMoods.length;
      const olderMoods = moods.slice(7, 14);
      
      if (olderMoods.length > 0) {
        const olderAvg = olderMoods.reduce((sum, m) => sum + m.mood_score, 0) / olderMoods.length;
        
        if (recentAvg > olderAvg + 1) {
          insights.push({
            type: 'positive',
            category: 'progress',
            title: 'Mood Improvement',
            message: 'Your mood has been improving recently. Keep up the good work!',
            recommendations: [
              'Continue with activities that are helping',
              'Maintain your current support systems',
              'Celebrate small victories',
              'Keep tracking your progress'
            ],
            priority: 'low'
          });
        }
      }
    }

    // Sort insights by priority
    const priorityOrder = { critical: 5, high: 4, warning: 3, medium: 2, low: 1 };
    insights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return insights;
  } catch (error) {
    logger.error('Mental health insights generation error:', error);
    throw error;
  }
};

// Detect mental health crisis indicators
const detectCrisisIndicators = async (userId) => {
  try {
    const indicators = [];

    // Check recent mood entries for crisis patterns
    const recentMoods = await query(`
      SELECT mood_score, anxiety_level, notes, recorded_at
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
      ORDER BY recorded_at DESC
    `, [userId]);

    const moods = recentMoods.rows;

    // Extremely low mood scores
    const criticalMoods = moods.filter(m => m.mood_score <= 2);
    if (criticalMoods.length >= 3) {
      indicators.push({
        type: 'critical_mood',
        severity: 'high',
        message: 'Multiple extremely low mood scores detected',
        count: criticalMoods.length,
        timeframe: '7 days'
      });
    }

    // Extremely high anxiety
    const highAnxiety = moods.filter(m => m.anxiety_level >= 9);
    if (highAnxiety.length >= 2) {
      indicators.push({
        type: 'severe_anxiety',
        severity: 'high',
        message: 'Severe anxiety levels detected',
        count: highAnxiety.length,
        timeframe: '7 days'
      });
    }

    // Check for concerning keywords in notes
    const concerningKeywords = [
      'hurt myself', 'end it all', 'can\'t go on', 'hopeless', 'worthless',
      'better off dead', 'suicide', 'kill myself', 'no point'
    ];

    moods.forEach(mood => {
      if (mood.notes) {
        const lowerNotes = mood.notes.toLowerCase();
        const foundKeywords = concerningKeywords.filter(keyword => 
          lowerNotes.includes(keyword)
        );
        
        if (foundKeywords.length > 0) {
          indicators.push({
            type: 'concerning_language',
            severity: 'critical',
            message: 'Concerning language detected in mood notes',
            keywords: foundKeywords,
            recordedAt: mood.recorded_at
          });
        }
      }
    });

    // Check recent assessments for high risk
    const recentAssessments = await query(`
      SELECT assessment_type, risk_level, score, completed_at
      FROM mental_health_assessments 
      WHERE user_id = $1 
        AND completed_at >= NOW() - INTERVAL '14 days'
        AND risk_level IN ('severe', 'moderate')
      ORDER BY completed_at DESC
    `, [userId]);

    if (recentAssessments.rows.length > 0) {
      recentAssessments.rows.forEach(assessment => {
        indicators.push({
          type: 'high_risk_assessment',
          severity: assessment.risk_level === 'severe' ? 'critical' : 'high',
          message: `${assessment.assessment_type} assessment shows ${assessment.risk_level} risk`,
          assessmentType: assessment.assessment_type,
          riskLevel: assessment.risk_level,
          completedAt: assessment.completed_at
        });
      });
    }

    return indicators;
  } catch (error) {
    logger.error('Crisis indicators detection error:', error);
    throw error;
  }
};

module.exports = {
  assessDepressionRisk,
  generateMentalHealthInsights,
  detectCrisisIndicators
};