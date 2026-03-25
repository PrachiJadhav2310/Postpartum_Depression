const { query } = require('../config/database');
const logger = require('../utils/logger');

// Analyze health trends for a user
const analyzeHealthTrends = async (userId) => {
  try {
    // Get health data from the last 30 days
    const healthData = await query(`
      SELECT record_type, value, recorded_at
      FROM health_records 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '30 days'
      ORDER BY recorded_at DESC
    `, [userId]);

    const trends = {};
    const records = healthData.rows;

    // Group by record type
    const groupedData = records.reduce((acc, record) => {
      if (!acc[record.record_type]) {
        acc[record.record_type] = [];
      }
      acc[record.record_type].push({
        value: parseFloat(record.value),
        date: record.recorded_at
      });
      return acc;
    }, {});

    // Analyze trends for each record type
    Object.keys(groupedData).forEach(recordType => {
      const data = groupedData[recordType];
      if (data.length >= 3) {
        const values = data.map(d => d.value);
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // Calculate trend direction
        const recent = data.slice(0, Math.min(7, data.length));
        const older = data.slice(Math.min(7, data.length));
        
        let trendDirection = 'stable';
        if (recent.length > 0 && older.length > 0) {
          const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
          const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;
          
          const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
          
          if (percentChange > 5) trendDirection = 'increasing';
          else if (percentChange < -5) trendDirection = 'decreasing';
        }

        trends[recordType] = {
          average: avg,
          minimum: min,
          maximum: max,
          trend: trendDirection,
          dataPoints: data.length,
          lastValue: data[0].value,
          lastRecorded: data[0].date
        };
      }
    });

    return trends;
  } catch (error) {
    logger.error('Health trends analysis error:', error);
    throw error;
  }
};

// Generate health insights based on user data
const generateHealthInsights = async (userId) => {
  try {
    const insights = [];

    // Get user profile for context
    const userProfile = await query(`
      SELECT birth_date, due_date FROM user_profiles WHERE id = $1
    `, [userId]);

    const user = userProfile.rows[0];
    let daysPostpartum = 0;

    if (user && user.birth_date) {
      const birthDate = new Date(user.birth_date);
      const today = new Date();
      daysPostpartum = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
    }

    // Get recent health trends
    const trends = await analyzeHealthTrends(userId);

    // Generate insights based on trends and postpartum stage
    if (trends.heart_rate) {
      const hr = trends.heart_rate;
      if (hr.average > 100) {
        insights.push({
          type: 'warning',
          category: 'cardiovascular',
          title: 'Elevated Heart Rate',
          message: `Your average heart rate (${hr.average.toFixed(1)} bpm) is above normal range. This could indicate stress, dehydration, or other factors.`,
          recommendations: [
            'Stay hydrated',
            'Practice relaxation techniques',
            'Consult with your healthcare provider if persistent'
          ],
          priority: 'medium'
        });
      } else if (hr.trend === 'increasing') {
        insights.push({
          type: 'info',
          category: 'cardiovascular',
          title: 'Heart Rate Trending Up',
          message: 'Your heart rate has been gradually increasing. Monitor for any concerning symptoms.',
          recommendations: [
            'Monitor stress levels',
            'Ensure adequate rest',
            'Consider gentle exercise'
          ],
          priority: 'low'
        });
      }
    }

    if (trends.blood_pressure_systolic) {
      const bp = trends.blood_pressure_systolic;
      if (bp.average > 140) {
        insights.push({
          type: 'warning',
          category: 'cardiovascular',
          title: 'High Blood Pressure',
          message: `Your systolic blood pressure (${bp.average.toFixed(1)} mmHg) is elevated. This requires medical attention.`,
          recommendations: [
            'Contact your healthcare provider immediately',
            'Monitor blood pressure regularly',
            'Reduce sodium intake',
            'Practice stress management'
          ],
          priority: 'high'
        });
      }
    }

    if (trends.sleep_hours) {
      const sleep = trends.sleep_hours;
      if (sleep.average < 6) {
        insights.push({
          type: 'info',
          category: 'lifestyle',
          title: 'Insufficient Sleep',
          message: `You're averaging ${sleep.average.toFixed(1)} hours of sleep. New mothers need adequate rest for recovery.`,
          recommendations: [
            'Sleep when your baby sleeps',
            'Ask for help with night duties',
            'Create a relaxing bedtime routine',
            'Consider napping during the day'
          ],
          priority: 'medium'
        });
      }
    }

    // Postpartum-specific insights
    if (daysPostpartum > 0) {
      if (daysPostpartum <= 7) {
        insights.push({
          type: 'info',
          category: 'postpartum',
          title: 'Early Postpartum Recovery',
          message: `You're ${daysPostpartum} days postpartum. Focus on rest and recovery during this critical period.`,
          recommendations: [
            'Rest as much as possible',
            'Stay hydrated',
            'Monitor for signs of infection',
            'Don\'t hesitate to ask for help'
          ],
          priority: 'high'
        });
      } else if (daysPostpartum <= 42) {
        insights.push({
          type: 'info',
          category: 'postpartum',
          title: 'Postpartum Recovery Phase',
          message: `You're ${daysPostpartum} days postpartum. Your body is still healing and adjusting.`,
          recommendations: [
            'Gradually increase activity levels',
            'Continue monitoring your health',
            'Attend your postpartum checkup',
            'Be patient with your recovery'
          ],
          priority: 'medium'
        });
      }
    }

    // Sort insights by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    insights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return insights;
  } catch (error) {
    logger.error('Health insights generation error:', error);
    throw error;
  }
};

// Detect health anomalies
const detectHealthAnomalies = async (userId) => {
  try {
    const anomalies = [];

    // Get recent health records
    const recentRecords = await query(`
      SELECT record_type, value, recorded_at
      FROM health_records 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
      ORDER BY recorded_at DESC
    `, [userId]);

    // Define normal ranges (these would be more sophisticated in production)
    const normalRanges = {
      temperature: { min: 97.0, max: 99.5 },
      heart_rate: { min: 60, max: 100 },
      blood_pressure_systolic: { min: 90, max: 140 },
      blood_pressure_diastolic: { min: 60, max: 90 }
    };

    // Check for values outside normal ranges
    recentRecords.rows.forEach(record => {
      const range = normalRanges[record.record_type];
      if (range) {
        const value = parseFloat(record.value);
        if (value < range.min || value > range.max) {
          anomalies.push({
            type: 'out_of_range',
            recordType: record.record_type,
            value: value,
            normalRange: range,
            recordedAt: record.recorded_at,
            severity: value < range.min * 0.8 || value > range.max * 1.2 ? 'high' : 'medium'
          });
        }
      }
    });

    return anomalies;
  } catch (error) {
    logger.error('Health anomaly detection error:', error);
    throw error;
  }
};

module.exports = {
  analyzeHealthTrends,
  generateHealthInsights,
  detectHealthAnomalies
};