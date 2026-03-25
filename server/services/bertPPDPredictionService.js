const { query } = require('../config/database');
const logger = require('../utils/logger');
const { predictPPDWithBERT, initializeModels } = require('./bertModelService');

/**
 * Enhanced BERT-based PPD Prediction Service
 * 
 * This service combines:
 * 1. Real BERT model analysis (via @xenova/transformers)
 * 2. Feature engineering with clinical research weights
 * 3. Historical trend analysis
 * 
 * The BERT model provides deep learning-based text analysis,
 * while feature engineering ensures clinical accuracy.
 */

// Feature weights based on clinical research on PPD risk factors
const FEATURE_WEIGHTS = {
  // Mental health features
  emotional_wellbeing: {
    weight: 0.25,
    high_risk_threshold: 8, // Sum of scores >= 8 indicates high risk
  },
  anxiety: {
    weight: 0.20,
    high_risk_threshold: 7,
  },
  sleep_fatigue: {
    weight: 0.15,
    high_risk_threshold: 6,
  },
  support_system: {
    weight: 0.15,
    high_risk_threshold: 6, // Lower score = less support = higher risk
    inverse: true, // Lower values are worse
  },
  mother_infant_bonding: {
    weight: 0.15,
    high_risk_threshold: 6,
    inverse: true,
  },
  physical_mental_link: {
    weight: 0.10,
    high_risk_threshold: 5,
  },
  
  // Physical condition features
  temperature: {
    weight: 0.05,
    normal_range: [97.0, 99.5],
    risk_multiplier: 1.2, // Fever increases risk
  },
  blood_pressure: {
    weight: 0.05,
    normal_systolic: [90, 140],
    normal_diastolic: [60, 90],
    risk_multiplier: 1.15,
  },
  heart_rate: {
    weight: 0.03,
    normal_range: [60, 100],
    risk_multiplier: 1.1,
  },
  sleep_hours: {
    weight: 0.08,
    optimal_range: [6, 9],
    risk_multiplier: 1.3, // Poor sleep significantly increases risk
  },
  sleep_quality: {
    weight: 0.07,
    optimal_value: 4, // 4-5 is good
    risk_multiplier: 1.25,
  },
  weight: {
    weight: 0.02,
    // Weight changes can indicate health issues
  },
  water_intake: {
    weight: 0.02,
    optimal_range: [1.5, 3.0], // liters
    risk_multiplier: 1.05,
  },
};

// Configurable risk thresholds (easy tuning via env without code edits).
const RISK_THRESHOLDS = {
  critical: parseInt(process.env.PPD_THRESHOLD_CRITICAL || '70', 10),
  high: parseInt(process.env.PPD_THRESHOLD_HIGH || '50', 10),
  moderate: parseInt(process.env.PPD_THRESHOLD_MODERATE || '30', 10),
  mild: parseInt(process.env.PPD_THRESHOLD_MILD || '15', 10),
};

const getRiskLevelByScore = (score) => {
  if (score >= RISK_THRESHOLDS.critical) return { level: 'critical', confidence: 0.9 };
  if (score >= RISK_THRESHOLDS.high) return { level: 'high', confidence: 0.85 };
  if (score >= RISK_THRESHOLDS.moderate) return { level: 'moderate', confidence: 0.75 };
  if (score >= RISK_THRESHOLDS.mild) return { level: 'mild', confidence: 0.7 };
  return { level: 'low', confidence: 0.65 };
};

/**
 * Rule-based clinician safety overrides.
 * These deterministic checks reduce false negatives in critical scenarios.
 */
const applyClinicalSafetyOverrides = (assessmentData, computedScore, baseRiskLevel, bertEnhancement) => {
  const overrides = [];
  const responses = assessmentData?.responses || {};
  const categoryScores = assessmentData?.category_scores || {};

  let score = computedScore;
  let riskLevel = baseRiskLevel;
  let forcedUrgentCare = false;

  // Rule 1: very high anxiety cluster
  const anxietyCluster = ['anxiety_1', 'anxiety_2', 'anxiety_3', 'anxiety_4', 'anxiety_5'];
  const severeAnxietyCount = anxietyCluster.filter((k) => Number(responses[k] || 0) >= 3).length;
  if (severeAnxietyCount >= 4) {
    score = Math.max(score, RISK_THRESHOLDS.high + 5);
    overrides.push('Severe anxiety cluster detected (>=4/5 anxiety questions scored 3)');
  }

  // Rule 2: severe emotional distress + hopelessness style signals.
  if (
    Number(responses.emotion_5 || 0) >= 3 &&
    Number(responses.emotion_4 || 0) >= 2
  ) {
    score = Math.max(score, RISK_THRESHOLDS.high + 8);
    overrides.push('High hopelessness + crying distress pattern detected');
  }

  // Rule 3: poor support + bonding risk together.
  if (
    Number(categoryScores.support_system || 0) >= 10 &&
    Number(categoryScores.mother_infant_bonding || 0) >= 10
  ) {
    score = Math.max(score, RISK_THRESHOLDS.high + 5);
    overrides.push('Combined social-support and bonding risk pattern detected');
  }

  // Rule 4: explicit high-risk indicators from BERT should escalate.
  const riskIndicators = bertEnhancement?.bertAnalysis?.riskIndicators || [];
  if (
    riskIndicators.includes('suicide_risk') ||
    riskIndicators.includes('severe_depression_risk')
  ) {
    score = Math.max(score, RISK_THRESHOLDS.critical + 5);
    forcedUrgentCare = true;
    overrides.push('BERT high-risk indicator detected (suicide/severe depression)');
  }

  // Re-map risk level after overrides.
  const remapped = getRiskLevelByScore(score);
  riskLevel = remapped.level;

  return {
    adjustedScore: score,
    riskLevel,
    forcedUrgentCare,
    rulesTriggered: overrides,
  };
};

/**
 * Extract features from assessment data
 */
const extractFeatures = (assessmentData) => {
  const features = {
    mental_health: {},
    physical: {},
    combined_score: 0,
  };

  // Extract mental health features
  if (assessmentData.category_scores) {
    Object.entries(assessmentData.category_scores).forEach(([category, score]) => {
      if (FEATURE_WEIGHTS[category]) {
        const config = FEATURE_WEIGHTS[category];
        let normalizedScore = score;
        
        // Normalize score (0-3 scale per question, typically 4-5 questions per category)
        const maxPossibleScore = 3 * 5; // Assuming max 5 questions
        normalizedScore = score / maxPossibleScore;
        
        // Apply inverse logic if needed (lower is worse)
        if (config.inverse) {
          normalizedScore = 1 - normalizedScore;
        }
        
        features.mental_health[category] = {
          raw_score: score,
          normalized: normalizedScore,
          risk_level: score >= config.high_risk_threshold ? 'high' : 
                     score >= config.high_risk_threshold * 0.7 ? 'moderate' : 'low',
        };
      }
    });
  }

  // Extract physical condition features
  if (assessmentData.physical_conditions) {
    const physical = assessmentData.physical_conditions;
    
    // Temperature analysis
    if (physical.temperature !== undefined) {
      const temp = physical.temperature;
      const config = FEATURE_WEIGHTS.temperature;
      const isNormal = temp >= config.normal_range[0] && temp <= config.normal_range[1];
      features.physical.temperature = {
        value: temp,
        is_normal: isNormal,
        risk_multiplier: isNormal ? 1.0 : config.risk_multiplier,
      };
    }

    // Blood pressure analysis
    if (physical.systolicBP !== undefined || physical.diastolicBP !== undefined) {
      const config = FEATURE_WEIGHTS.blood_pressure;
      const sysNormal = physical.systolicBP >= config.normal_systolic[0] && 
                       physical.systolicBP <= config.normal_systolic[1];
      const diaNormal = physical.diastolicBP >= config.normal_diastolic[0] && 
                       physical.diastolicBP <= config.normal_diastolic[1];
      features.physical.blood_pressure = {
        systolic: physical.systolicBP,
        diastolic: physical.diastolicBP,
        is_normal: sysNormal && diaNormal,
        risk_multiplier: (sysNormal && diaNormal) ? 1.0 : config.risk_multiplier,
      };
    }

    // Heart rate analysis
    if (physical.heartRate !== undefined) {
      const hr = physical.heartRate;
      const config = FEATURE_WEIGHTS.heart_rate;
      const isNormal = hr >= config.normal_range[0] && hr <= config.normal_range[1];
      features.physical.heart_rate = {
        value: hr,
        is_normal: isNormal,
        risk_multiplier: isNormal ? 1.0 : config.risk_multiplier,
      };
    }

    // Sleep hours analysis
    if (physical.sleepHours !== undefined) {
      const hours = physical.sleepHours;
      const config = FEATURE_WEIGHTS.sleep_hours;
      const isOptimal = hours >= config.optimal_range[0] && hours <= config.optimal_range[1];
      features.physical.sleep_hours = {
        value: hours,
        is_optimal: isOptimal,
        risk_multiplier: isOptimal ? 1.0 : config.risk_multiplier,
      };
    }

    // Sleep quality analysis
    if (physical.sleepQuality !== undefined) {
      const quality = physical.sleepQuality;
      const config = FEATURE_WEIGHTS.sleep_quality;
      const isGood = quality >= config.optimal_value;
      features.physical.sleep_quality = {
        value: quality,
        is_good: isGood,
        risk_multiplier: isGood ? 1.0 : config.risk_multiplier,
      };
    }

    // Water intake analysis
    if (physical.waterIntake !== undefined) {
      const intake = physical.waterIntake;
      const config = FEATURE_WEIGHTS.water_intake;
      const isOptimal = intake >= config.optimal_range[0] && intake <= config.optimal_range[1];
      features.physical.water_intake = {
        value: intake,
        is_optimal: isOptimal,
        risk_multiplier: isOptimal ? 1.0 : config.risk_multiplier,
      };
    }
  }

  return features;
};

/**
 * Calculate risk score using weighted features
 */
const calculateRiskScore = (features) => {
  let mentalHealthScore = 0;
  let physicalScore = 0;
  let totalWeight = 0;

  // Calculate mental health component
  Object.entries(features.mental_health).forEach(([category, data]) => {
    const config = FEATURE_WEIGHTS[category];
    const contribution = data.normalized * config.weight;
    mentalHealthScore += contribution;
    totalWeight += config.weight;
  });

  // Calculate physical health component
  let physicalMultiplier = 1.0;
  Object.entries(features.physical).forEach(([metric, data]) => {
    if (data.risk_multiplier) {
      physicalMultiplier *= data.risk_multiplier;
    }
  });

  // Combine scores (mental health is primary, physical is multiplier)
  const baseScore = (mentalHealthScore / totalWeight) * 100; // Scale to 0-100
  const adjustedScore = baseScore * physicalMultiplier;
  
  // Cap at 100
  const finalScore = Math.min(100, adjustedScore);

  return {
    mental_health_score: baseScore,
    physical_multiplier: physicalMultiplier,
    final_score: finalScore,
  };
};

/**
 * Generate text-based features for BERT-like analysis
 * This simulates what BERT would analyze from free-text responses
 */
const generateTextFeatures = (assessmentData) => {
  const textFeatures = {
    sentiment_score: 0,
    concern_keywords: [],
    positive_indicators: [],
    risk_indicators: [],
  };

  // Analyze responses for patterns
  if (assessmentData.responses) {
    const responses = assessmentData.responses;
    const highRiskResponses = Object.values(responses).filter(r => r >= 2).length;
    const veryHighRiskResponses = Object.values(responses).filter(r => r === 3).length;
    
    textFeatures.sentiment_score = -(highRiskResponses * 2 + veryHighRiskResponses * 3);
    
    if (veryHighRiskResponses > 3) {
      textFeatures.risk_indicators.push('multiple_high_risk_responses');
    }
    if (highRiskResponses > 5) {
      textFeatures.risk_indicators.push('elevated_concern_level');
    }
  }

  return textFeatures;
};

/**
 * Predict PPD using real BERT model + feature engineering
 */
const predictPPD = async (userId, assessmentData) => {
  try {
    // Initialize BERT models (first call will load models)
    await initializeModels();
    
    // Extract features
    const features = extractFeatures(assessmentData);
    const textFeatures = generateTextFeatures(assessmentData);
    
    // Calculate base risk score from features
    const riskCalculation = calculateRiskScore(features);
    
    // Get BERT-based prediction (enhances with deep learning)
    let bertEnhancement = null;
    try {
      bertEnhancement = await predictPPDWithBERT(assessmentData);
    } catch (bertError) {
      logger.warn('BERT prediction failed, using feature-based only:', bertError.message);
      // Continue with feature-based approach
    }
    
    // Get historical context (excluding current assessment)
    const historicalData = await query(`
      SELECT 
        COUNT(*) as assessment_count,
        AVG(score) as avg_score,
        MAX(score) as max_score,
        MIN(score) as min_score
      FROM mental_health_assessments 
      WHERE user_id = $1
        AND completed_at < NOW() - INTERVAL '1 minute'
    `, [userId]);
    
    // Get the most recent previous assessment for trend analysis
    const previousAssessment = await query(`
      SELECT score, risk_level, completed_at
      FROM mental_health_assessments 
      WHERE user_id = $1
        AND completed_at < NOW() - INTERVAL '1 minute'
      ORDER BY completed_at DESC 
      LIMIT 1
    `, [userId]);
    
    const history = historicalData.rows[0];
    const previous = previousAssessment.rows[0];
    
    // Adjust score based on trends
    let trendAdjustment = 0;
    let trendDescription = '';
    
    if (previous) {
      const currentScore = assessmentData.score || 0;
      const previousScore = parseFloat(previous.score) || 0;
      const scoreChange = currentScore - previousScore;
      const daysSinceLast = Math.floor((new Date() - new Date(previous.completed_at)) / (1000 * 60 * 60 * 24));
      
      // Significant worsening (score increased by 20% or more)
      if (scoreChange > previousScore * 0.2) {
        trendAdjustment = 15;
        trendDescription = `Worsening: Score increased by ${Math.round(scoreChange)} points since last assessment ${daysSinceLast} days ago`;
      } 
      // Significant improvement (score decreased by 20% or more)
      else if (scoreChange < -previousScore * 0.2) {
        trendAdjustment = -8;
        trendDescription = `Improving: Score decreased by ${Math.round(Math.abs(scoreChange))} points since last assessment ${daysSinceLast} days ago`;
      }
      // Moderate changes
      else if (scoreChange > 5) {
        trendAdjustment = 5;
        trendDescription = `Slight increase: Score up by ${Math.round(scoreChange)} points`;
      } else if (scoreChange < -5) {
        trendAdjustment = -3;
        trendDescription = `Slight improvement: Score down by ${Math.round(Math.abs(scoreChange))} points`;
      } else {
        trendDescription = `Stable: Score similar to last assessment ${daysSinceLast} days ago`;
      }
    } else if (history.assessment_count > 0) {
      const currentScore = assessmentData.score || 0;
      const avgScore = parseFloat(history.avg_score) || 0;
      
      // If current score is significantly higher than average, increase risk
      if (currentScore > avgScore * 1.2) {
        trendAdjustment = 10;
        trendDescription = 'Above average: Current score is higher than your historical average';
      } else if (currentScore < avgScore * 0.8) {
        trendAdjustment = -5;
        trendDescription = 'Below average: Current score is lower than your historical average';
      }
    }
    
    // Combine feature-based score with BERT enhancement if available
    let baseScore = riskCalculation.final_score + trendAdjustment;
    
    if (bertEnhancement && bertEnhancement.usingBERT) {
      // Enhanced weighted combination: 60% feature-based, 40% BERT
      // Increased BERT weight because we're now providing better natural language input
      // BERT provides deep learning insights from natural language, features provide clinical accuracy
      baseScore = (baseScore * 0.6) + (bertEnhancement.combinedRiskScore * 0.4);
      
      logger.info('Using enhanced BERT prediction', {
        featureScore: riskCalculation.final_score,
        bertRawScore: bertEnhancement.bertRawScore,
        bertCombinedScore: bertEnhancement.combinedRiskScore,
        riskIndicators: bertEnhancement.bertAnalysis?.riskIndicators || [],
        finalScore: baseScore,
        bertConfidence: bertEnhancement.confidence,
        textLength: bertEnhancement.assessmentTextLength
      });
    }
    
    const unclampedRiskScore = baseScore;
    let finalRiskScore = Math.min(100, unclampedRiskScore);

    // Determine initial risk level with tunable thresholds.
    const initialRisk = getRiskLevelByScore(finalRiskScore);
    let riskLevel = initialRisk.level;
    let confidence = bertEnhancement?.confidence || initialRisk.confidence;

    // Apply clinician safety overrides.
    const safety = applyClinicalSafetyOverrides(
      assessmentData,
      finalRiskScore,
      riskLevel,
      bertEnhancement
    );
    finalRiskScore = Math.min(100, safety.adjustedScore);
    riskLevel = safety.riskLevel;
    confidence = Math.max(confidence, getRiskLevelByScore(finalRiskScore).confidence);
    
    // Generate recommendations
    const recommendations = generateRecommendations(riskLevel, features, textFeatures);
    
    // Calculate risk percentage
    const riskPercentage = Math.round(finalRiskScore);
    
    return {
      riskScore: finalRiskScore,
      riskLevel,
      riskPercentage,
      confidence,
      features,
      textFeatures,
      riskCalculation,
      bertEnhancement: bertEnhancement ? {
        used: true,
        sentiment: bertEnhancement.bertAnalysis?.sentiment,
        bertConfidence: bertEnhancement.confidence,
        riskIndicators: bertEnhancement.bertAnalysis?.riskIndicators || [],
        keywords: bertEnhancement.bertAnalysis?.keywords || [],
        clinicalInsights: bertEnhancement.bertAnalysis?.clinicalInsights || [],
        sentimentAdjustment: bertEnhancement.sentimentAdjustment,
        riskIndicatorAdjustment: bertEnhancement.riskIndicatorAdjustment,
        bertRawScore: bertEnhancement.bertRawScore,
        assessmentTextLength: bertEnhancement.assessmentTextLength
      } : { used: false },
      recommendations,
      factors: {
        mental_health_contribution: riskCalculation.mental_health_score,
        physical_health_impact: (riskCalculation.physical_multiplier - 1) * 100,
        trend_adjustment: trendAdjustment,
        trend_description: trendDescription,
        thresholds: RISK_THRESHOLDS,
        clinician_rules_triggered: safety.rulesTriggered,
        historical_context: history,
        previous_assessment: previous ? {
          score: previous.score,
          risk_level: previous.risk_level,
          completed_at: previous.completed_at,
        } : null,
      },
      needsDoctorConsultation: finalRiskScore >= RISK_THRESHOLDS.moderate,
      urgentCare: finalRiskScore >= RISK_THRESHOLDS.critical || safety.forcedUrgentCare,
      emergencyContact: finalRiskScore >= RISK_THRESHOLDS.critical || safety.forcedUrgentCare,
    };
    
  } catch (error) {
    logger.error('PPD prediction error:', error);
    throw error;
  }
};

/**
 * Generate personalized recommendations
 */
const generateRecommendations = (riskLevel, features, textFeatures) => {
  const recommendations = [];
  
  if (riskLevel === 'critical' || riskLevel === 'high') {
    recommendations.push({
      type: 'urgent',
      priority: 'high',
      message: 'Please contact a healthcare provider immediately or call 988 for crisis support.',
      action: 'contact_professional',
    });
    
    if (features.physical.sleep_hours && !features.physical.sleep_hours.is_optimal) {
      recommendations.push({
        type: 'sleep',
        priority: 'high',
        message: 'Poor sleep is significantly impacting your wellbeing. Consider discussing sleep strategies with your healthcare provider.',
        action: 'improve_sleep',
      });
    }
  } else if (riskLevel === 'moderate') {
    recommendations.push({
      type: 'professional_help',
      priority: 'medium',
      message: 'We recommend scheduling an appointment with your healthcare provider within the next week.',
      action: 'schedule_appointment',
    });
    
    if (features.mental_health.anxiety && features.mental_health.anxiety.risk_level === 'high') {
      recommendations.push({
        type: 'anxiety',
        priority: 'medium',
        message: 'Your anxiety levels are elevated. Consider relaxation techniques and speaking with a mental health professional.',
        action: 'manage_anxiety',
      });
    }
  } else if (riskLevel === 'mild') {
    recommendations.push({
      type: 'self_care',
      priority: 'low',
      message: 'Continue monitoring your wellbeing and practice self-care strategies.',
      action: 'self_care',
    });
  } else {
    recommendations.push({
      type: 'maintenance',
      priority: 'low',
      message: 'Keep up the good work! Continue your current wellness practices.',
      action: 'maintain_wellness',
    });
  }
  
  // Physical health recommendations
  if (features.physical.temperature && !features.physical.temperature.is_normal) {
    recommendations.push({
      type: 'physical',
      priority: 'high',
      message: 'Your temperature is outside normal range. Please monitor and contact healthcare provider if it persists.',
      action: 'monitor_temperature',
    });
  }
  
  if (features.physical.blood_pressure && !features.physical.blood_pressure.is_normal) {
    recommendations.push({
      type: 'physical',
      priority: 'high',
      message: 'Your blood pressure is outside normal range. Please consult with your healthcare provider.',
      action: 'monitor_blood_pressure',
    });
  }
  
  return recommendations;
};

module.exports = {
  predictPPD,
  extractFeatures,
  calculateRiskScore,
  generateTextFeatures,
};
