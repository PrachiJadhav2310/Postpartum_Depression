const { query } = require('../config/database');
const logger = require('../utils/logger');

// Sentiment analysis keywords and weights
const DEPRESSION_KEYWORDS = {
  severe: {
    keywords: ['suicide', 'kill myself', 'end it all', 'worthless', 'hopeless', 'can\'t go on', 'better off dead', 'no point living'],
    weight: 10
  },
  high: {
    keywords: ['depressed', 'sad', 'crying', 'empty', 'numb', 'exhausted', 'overwhelmed', 'alone', 'isolated', 'helpless'],
    weight: 7
  },
  moderate: {
    keywords: ['tired', 'stressed', 'anxious', 'worried', 'difficult', 'hard', 'struggling', 'challenging', 'tough'],
    weight: 4
  },
  positive: {
    keywords: ['happy', 'good', 'better', 'improving', 'grateful', 'blessed', 'love', 'joy', 'peaceful', 'hopeful'],
    weight: -3
  }
};

const HEALTH_CONCERN_KEYWORDS = {
  physical: {
    keywords: ['pain', 'bleeding', 'fever', 'headache', 'dizzy', 'nausea', 'vomiting', 'infection', 'swelling', 'rash'],
    weight: 6
  },
  breastfeeding: {
    keywords: ['breastfeeding problems', 'latch issues', 'sore nipples', 'low milk supply', 'engorgement', 'mastitis'],
    weight: 5
  },
  sleep: {
    keywords: ['can\'t sleep', 'insomnia', 'nightmares', 'restless', 'tired all the time', 'no energy'],
    weight: 4
  }
};

// Analyze text sentiment and extract health indicators
const analyzeTextSentiment = (text) => {
  if (!text || typeof text !== 'string') return { score: 0, indicators: [] };

  const lowerText = text.toLowerCase();
  let sentimentScore = 0;
  const indicators = [];

  // Analyze depression indicators
  Object.entries(DEPRESSION_KEYWORDS).forEach(([severity, data]) => {
    data.keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        sentimentScore += data.weight;
        indicators.push({
          type: 'mental_health',
          severity,
          keyword,
          category: 'depression'
        });
      }
    });
  });

  // Analyze health concerns
  Object.entries(HEALTH_CONCERN_KEYWORDS).forEach(([category, data]) => {
    data.keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        sentimentScore += data.weight;
        indicators.push({
          type: 'physical_health',
          severity: 'moderate',
          keyword,
          category
        });
      }
    });
  });

  return { score: sentimentScore, indicators };
};

// Predict depression risk based on multiple factors
const predictDepressionRisk = async (userId) => {
  try {
    // Get recent mood entries
    const moodData = await query(`
      SELECT mood_score, energy_level, anxiety_level, notes, recorded_at
      FROM mood_entries 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '14 days'
      ORDER BY recorded_at DESC
    `, [userId]);

    // Get recent assessments
    const assessments = await query(`
      SELECT score, risk_level, assessment_type, completed_at
      FROM mental_health_assessments 
      WHERE user_id = $1 
      ORDER BY completed_at DESC 
      LIMIT 3
    `, [userId]);

    // Get user profile for context
    const userProfile = await query(`
      SELECT birth_date, due_date FROM user_profiles WHERE id = $1
    `, [userId]);

    const moods = moodData.rows;
    const recentAssessments = assessments.rows;
    const user = userProfile.rows[0];

    let riskScore = 0;
    let riskLevel = 'low';
    let recommendations = [];
    let textAnalysis = { totalSentimentScore: 0, concerningIndicators: [] };

    // Calculate days postpartum for context
    let daysPostpartum = 0;
    if (user && user.birth_date) {
      const birthDate = new Date(user.birth_date);
      const today = new Date();
      daysPostpartum = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
    }

    // Analyze mood patterns
    if (moods.length >= 3) {
      const avgMood = moods.reduce((sum, m) => sum + m.mood_score, 0) / moods.length;
      const avgEnergy = moods.reduce((sum, m) => sum + m.energy_level, 0) / moods.length;
      const avgAnxiety = moods.reduce((sum, m) => sum + m.anxiety_level, 0) / moods.length;

      // Mood-based risk calculation
      if (avgMood <= 3) riskScore += 30;
      else if (avgMood <= 5) riskScore += 20;
      else if (avgMood <= 6) riskScore += 10;

      if (avgEnergy <= 3) riskScore += 20;
      else if (avgEnergy <= 5) riskScore += 10;

      if (avgAnxiety >= 8) riskScore += 25;
      else if (avgAnxiety >= 6) riskScore += 15;

      // Analyze text from mood notes
      let totalSentimentScore = 0;
      const allIndicators = [];

      moods.forEach(mood => {
        if (mood.notes) {
          const analysis = analyzeTextSentiment(mood.notes);
          totalSentimentScore += analysis.score;
          allIndicators.push(...analysis.indicators);
        }
      });

      textAnalysis = {
        totalSentimentScore,
        concerningIndicators: allIndicators.filter(i => 
          i.severity === 'severe' || i.severity === 'high'
        )
      };

      // Add sentiment score to risk calculation
      if (totalSentimentScore >= 50) riskScore += 40;
      else if (totalSentimentScore >= 30) riskScore += 25;
      else if (totalSentimentScore >= 15) riskScore += 15;

      // Check for concerning language patterns
      const severeIndicators = allIndicators.filter(i => i.severity === 'severe');
      if (severeIndicators.length > 0) {
        riskScore += 50;
      }
    }

    // Factor in recent assessments
    if (recentAssessments.length > 0) {
      const latestAssessment = recentAssessments[0];
      if (latestAssessment.risk_level === 'severe') riskScore += 40;
      else if (latestAssessment.risk_level === 'moderate') riskScore += 25;
      else if (latestAssessment.risk_level === 'mild') riskScore += 15;
    }

    // Postpartum period risk factors
    if (daysPostpartum > 0 && daysPostpartum <= 365) {
      if (daysPostpartum <= 30) riskScore += 10; // Higher risk in first month
      else if (daysPostpartum <= 90) riskScore += 5; // Moderate risk in first 3 months
    }

    // Determine risk level and recommendations
    if (riskScore >= 70) {
      riskLevel = 'critical';
      recommendations = [
        'URGENT: Contact your healthcare provider immediately',
        'Call crisis hotline: 988 or text HOME to 741741',
        'Do not be alone - stay with family or friends',
        'Go to emergency room if having thoughts of self-harm',
        'Remove any means of self-harm from environment'
      ];
    } else if (riskScore >= 50) {
      riskLevel = 'high';
      recommendations = [
        'Schedule appointment with healthcare provider within 24-48 hours',
        'Contact mental health professional',
        'Increase social support and check-ins',
        'Consider therapy or counseling',
        'Monitor symptoms closely'
      ];
    } else if (riskScore >= 30) {
      riskLevel = 'moderate';
      recommendations = [
        'Schedule appointment with healthcare provider within 1 week',
        'Consider speaking with a counselor',
        'Increase self-care activities',
        'Maintain social connections',
        'Monitor mood patterns'
      ];
    } else if (riskScore >= 15) {
      riskLevel = 'mild';
      recommendations = [
        'Continue monitoring your mood',
        'Practice self-care strategies',
        'Stay connected with support system',
        'Consider lifestyle improvements',
        'Schedule routine check-up'
      ];
    } else {
      riskLevel = 'low';
      recommendations = [
        'Continue current wellness practices',
        'Maintain healthy routines',
        'Stay connected with loved ones',
        'Keep tracking your mood'
      ];
    }

    return {
      riskScore,
      riskLevel,
      recommendations,
      needsDoctorConsultation: riskScore >= 30,
      urgentCare: riskScore >= 70,
      textAnalysis,
      factors: {
        moodPatterns: moods.length >= 3,
        recentAssessments: recentAssessments.length > 0,
        postpartumPeriod: daysPostpartum > 0 && daysPostpartum <= 365,
        daysPostpartum
      }
    };

  } catch (error) {
    logger.error('Depression risk prediction error:', error);
    throw error;
  }
};

// Predict physical health concerns
const predictHealthConcerns = async (userId) => {
  try {
    // Get recent health records
    const healthData = await query(`
      SELECT record_type, value, unit, notes, recorded_at
      FROM health_records 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
      ORDER BY recorded_at DESC
    `, [userId]);

    // Get recent symptoms
    const symptoms = await query(`
      SELECT symptom_name, severity, notes, recorded_at
      FROM symptoms 
      WHERE user_id = $1 
        AND recorded_at >= NOW() - INTERVAL '7 days'
      ORDER BY recorded_at DESC
    `, [userId]);

    const records = healthData.rows;
    const symptomData = symptoms.rows;

    let healthRiskScore = 0;
    let concerns = [];
    let needsDoctorConsultation = false;

    // Analyze vital signs
    records.forEach(record => {
      const value = parseFloat(record.value);
      
      switch (record.record_type) {
        case 'temperature':
          if (value >= 100.4) {
            healthRiskScore += 25;
            concerns.push({
              type: 'fever',
              severity: 'high',
              message: `Fever detected: ${value}°F`,
              recommendation: 'Contact healthcare provider immediately'
            });
            needsDoctorConsultation = true;
          }
          break;
          
        case 'heart_rate':
          if (value > 120) {
            healthRiskScore += 20;
            concerns.push({
              type: 'tachycardia',
              severity: 'moderate',
              message: `Elevated heart rate: ${value} bpm`,
              recommendation: 'Monitor and consult if persistent'
            });
          }
          break;
          
        case 'blood_pressure_systolic':
          if (value > 140) {
            healthRiskScore += 30;
            concerns.push({
              type: 'hypertension',
              severity: 'high',
              message: `High blood pressure: ${value} mmHg`,
              recommendation: 'Contact healthcare provider immediately'
            });
            needsDoctorConsultation = true;
          }
          break;
      }

      // Analyze notes for health concerns
      if (record.notes) {
        const analysis = analyzeTextSentiment(record.notes);
        analysis.indicators.forEach(indicator => {
          if (indicator.type === 'physical_health') {
            healthRiskScore += 10;
            concerns.push({
              type: indicator.category,
              severity: 'moderate',
              message: `Health concern mentioned: ${indicator.keyword}`,
              recommendation: 'Discuss with healthcare provider'
            });
          }
        });
      }
    });

    // Analyze symptoms
    symptomData.forEach(symptom => {
      if (symptom.severity >= 4) {
        healthRiskScore += 15;
        concerns.push({
          type: 'severe_symptom',
          severity: 'high',
          message: `Severe ${symptom.symptom_name} (${symptom.severity}/5)`,
          recommendation: 'Contact healthcare provider'
        });
        needsDoctorConsultation = true;
      }

      // Analyze symptom notes
      if (symptom.notes) {
        const analysis = analyzeTextSentiment(symptom.notes);
        analysis.indicators.forEach(indicator => {
          if (indicator.severity === 'severe' || indicator.severity === 'high') {
            healthRiskScore += 15;
            needsDoctorConsultation = true;
          }
        });
      }
    });

    return {
      healthRiskScore,
      concerns,
      needsDoctorConsultation: needsDoctorConsultation || healthRiskScore >= 40,
      urgentCare: healthRiskScore >= 60,
      recommendations: concerns.map(c => c.recommendation).filter((r, i, arr) => arr.indexOf(r) === i)
    };

  } catch (error) {
    logger.error('Health concerns prediction error:', error);
    throw error;
  }
};

// Generate comprehensive health prediction
const generateHealthPrediction = async (userId) => {
  try {
    const [depressionRisk, healthConcerns] = await Promise.all([
      predictDepressionRisk(userId),
      predictHealthConcerns(userId)
    ]);

    const overallRisk = Math.max(depressionRisk.riskScore, healthConcerns.healthRiskScore);
    const needsConsultation = depressionRisk.needsDoctorConsultation || healthConcerns.needsDoctorConsultation;
    const urgentCare = depressionRisk.urgentCare || healthConcerns.urgentCare;

    // Generate personalized recommendations
    const allRecommendations = [
      ...depressionRisk.recommendations,
      ...healthConcerns.recommendations
    ].filter((r, i, arr) => arr.indexOf(r) === i);

    return {
      overallRiskScore: overallRisk,
      needsDoctorConsultation: needsConsultation,
      urgentCareNeeded: urgentCare,
      mentalHealth: {
        riskLevel: depressionRisk.riskLevel,
        riskScore: depressionRisk.riskScore,
        textAnalysis: depressionRisk.textAnalysis,
        factors: depressionRisk.factors
      },
      physicalHealth: {
        riskScore: healthConcerns.healthRiskScore,
        concerns: healthConcerns.concerns
      },
      recommendations: allRecommendations,
      nextSteps: urgentCare ? [
        'Seek immediate medical attention',
        'Call emergency services if necessary',
        'Contact crisis hotline for mental health emergencies'
      ] : needsConsultation ? [
        'Schedule appointment with healthcare provider',
        'Prepare list of symptoms and concerns',
        'Continue monitoring symptoms'
      ] : [
        'Continue current wellness practices',
        'Keep tracking health metrics',
        'Maintain regular check-ups'
      ],
      generatedAt: new Date()
    };

  } catch (error) {
    logger.error('Health prediction generation error:', error);
    throw error;
  }
};

module.exports = {
  analyzeTextSentiment,
  predictDepressionRisk,
  predictHealthConcerns,
  generateHealthPrediction
};