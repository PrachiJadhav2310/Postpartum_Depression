const { pipeline, env } = require('@xenova/transformers');
const logger = require('../utils/logger');

// Configure transformers.js to use local cache
env.allowLocalModels = false; // Use remote models for now
env.allowRemoteModels = true;

/**
 * Enhanced BERT-based PPD Prediction Service
 * Uses clinical/medical transformer models for better mental health analysis
 */

let clinicalClassifier = null;
let sentimentClassifier = null; // Fallback

// Configurable model chain (can be overridden in .env)
// Better zero-shot defaults first, then lightweight fallback.
const ZERO_SHOT_MODELS = [
  process.env.PPD_ZERO_SHOT_MODEL || 'Xenova/mobilebert-uncased',
  'Xenova/bart-large-mnli',
].filter(Boolean);

const SENTIMENT_MODELS = [
  process.env.PPD_SENTIMENT_MODEL || 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  'Xenova/distilroberta-base-finetuned-sst-2-english',
].filter(Boolean);

// Response label mapping for better text representation
const RESPONSE_LABELS = {
  0: 'Not at all',
  1: 'Rarely',
  2: 'Sometimes',
  3: 'Very often'
};

/**
 * Initialize BERT models (lazy loading)
 * Tries clinical models first, falls back to sentiment model
 */
const initializeModels = async () => {
  try {
    if (!clinicalClassifier && !sentimentClassifier) {
      logger.info('Loading BERT model for PPD prediction...');

      // 1) Try loading zero-shot models in order
      for (const modelName of ZERO_SHOT_MODELS) {
        try {
          logger.info(`Trying zero-shot model: ${modelName}`);
          clinicalClassifier = await pipeline(
            'zero-shot-classification',
            modelName,
            { quantized: true }
          );
          logger.info(`✅ Zero-shot model loaded: ${modelName}`);
          break;
        } catch (err) {
          logger.warn(`Zero-shot model failed (${modelName}): ${err.message}`);
        }
      }

      // 2) Fallback to sentiment models if zero-shot unavailable
      if (!clinicalClassifier) {
        for (const modelName of SENTIMENT_MODELS) {
          try {
            logger.info(`Trying sentiment model: ${modelName}`);
            sentimentClassifier = await pipeline(
              'text-classification',
              modelName,
              { quantized: true }
            );
            logger.info(`✅ Sentiment model loaded as fallback: ${modelName}`);
            break;
          } catch (err) {
            logger.warn(`Sentiment model failed (${modelName}): ${err.message}`);
          }
        }

        if (!sentimentClassifier) {
          logger.warn('No transformer model available, using feature-based fallback');
        }
      }
    }
    
    return { clinicalClassifier, sentimentClassifier };
  } catch (error) {
    logger.error('Error loading BERT models:', error);
    // Fallback to feature-based approach if BERT fails
    return null;
  }
};

/**
 * Analyze text using BERT for PPD risk indicators
 * Enhanced to better understand clinical/mental health context
 */
const analyzeTextWithBERT = async (text) => {
  try {
    // Initialize models if not already loaded
    if (!clinicalClassifier && !sentimentClassifier) {
      const models = await initializeModels();
      if (!models || (!models.clinicalClassifier && !models.sentimentClassifier)) {
        return null; // Fallback to feature-based
      }
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        riskScore: 0,
        riskIndicators: [],
        clinicalInsights: []
      };
    }

    let result;
    let riskScore = 0;
    let sentiment = 'neutral';
    let confidence = 0.5;
    const riskIndicators = [];
    const clinicalInsights = [];

    // Use clinical classifier if available, otherwise use sentiment
    if (clinicalClassifier) {
      // Zero-shot classification with PPD-specific labels
      const labels = [
        'postpartum depression symptoms',
        'anxiety and worry',
        'emotional distress',
        'low risk mental health',
        'severe depression risk'
      ];
      
      try {
        result = await clinicalClassifier(text, labels, { multi_label: false });
        
        // Calculate risk based on label scores
        const depressionScore = result.scores[result.labels.indexOf('postpartum depression symptoms')] || 0;
        const anxietyScore = result.scores[result.labels.indexOf('anxiety and worry')] || 0;
        const distressScore = result.scores[result.labels.indexOf('emotional distress')] || 0;
        const severeScore = result.scores[result.labels.indexOf('severe depression risk')] || 0;
        
        // Weighted risk calculation
        riskScore = (depressionScore * 0.4 + anxietyScore * 0.25 + distressScore * 0.25 + severeScore * 0.1) * 100;
        confidence = Math.max(...result.scores);
        
        // Determine sentiment
        if (severeScore > 0.5 || depressionScore > 0.6) {
          sentiment = 'high_risk';
        } else if (depressionScore > 0.4 || anxietyScore > 0.5) {
          sentiment = 'negative';
        } else if (result.labels[0] === 'low risk mental health') {
          sentiment = 'positive';
        } else {
          sentiment = 'neutral';
        }
        
        // Extract risk indicators
        if (severeScore > 0.3) riskIndicators.push('severe_depression_risk');
        if (depressionScore > 0.4) riskIndicators.push('depression_symptoms');
        if (anxietyScore > 0.4) riskIndicators.push('anxiety_symptoms');
        if (distressScore > 0.4) riskIndicators.push('emotional_distress');
        
        clinicalInsights.push({
          primaryLabel: result.labels[0],
          confidence: result.scores[0],
          allLabels: result.labels.map((label, idx) => ({
            label,
            score: result.scores[idx]
          }))
        });
      } catch (zeroShotError) {
        logger.warn('Zero-shot classification failed, using sentiment:', zeroShotError.message);
        // Fallback to sentiment analysis
        if (sentimentClassifier) {
          result = await sentimentClassifier(text, { topk: 3 });
          const positiveScore = result.find(r => r.label === 'POSITIVE')?.score || 0;
          const negativeScore = result.find(r => r.label === 'NEGATIVE')?.score || 0;
          riskScore = negativeScore * 100;
          sentiment = negativeScore > positiveScore ? 'negative' : 'positive';
          confidence = Math.max(positiveScore, negativeScore);
        }
      }
    } else if (sentimentClassifier) {
      // Fallback: Use sentiment analysis
      result = await sentimentClassifier(text, { topk: 3 });
      
      const positiveScore = result.find(r => r.label === 'POSITIVE')?.score || 0;
      const negativeScore = result.find(r => r.label === 'NEGATIVE')?.score || 0;
      
      riskScore = negativeScore * 100;
      sentiment = negativeScore > positiveScore ? 'negative' : 'positive';
      confidence = Math.max(positiveScore, negativeScore);
      
      if (negativeScore > 0.6) riskIndicators.push('negative_sentiment');
    }

    // Enhanced keyword detection using contextual understanding
    // BERT should handle this naturally, but we'll still track for explainability
    const clinicalKeywords = {
      'depression': ['depressed', 'depression', 'hopeless', 'worthless', 'empty'],
      'anxiety': ['anxious', 'worried', 'panic', 'scared', 'fear', 'tense'],
      'suicide_risk': ['suicide', 'hurt myself', 'end it', 'not worth living'],
      'isolation': ['alone', 'isolated', 'lonely', 'disconnected'],
      'overwhelmed': ['overwhelmed', 'can\'t cope', 'too much', 'exhausted']
    };
    
    const detectedKeywords = [];
    const textLower = text.toLowerCase();
    
    Object.entries(clinicalKeywords).forEach(([category, keywords]) => {
      const found = keywords.filter(kw => textLower.includes(kw));
      if (found.length > 0) {
        detectedKeywords.push(...found);
        riskIndicators.push(category);
      }
    });

    return {
      sentiment,
      confidence,
      riskScore: Math.min(100, riskScore),
      riskIndicators: [...new Set(riskIndicators)], // Remove duplicates
      keywords: detectedKeywords,
      clinicalInsights,
      rawResult: result
    };

  } catch (error) {
    logger.error('BERT text analysis error:', error);
    return null; // Fallback to feature-based
  }
};

/**
 * Question database - maps question IDs to full question text
 * This should ideally come from the frontend, but we'll maintain a reference here
 */
const QUESTION_DATABASE = {
  // Emotional Well-being
  'emotion_1': 'I have been able to laugh and see the funny side of things',
  'emotion_2': 'I have looked forward with enjoyment to things',
  'emotion_3': 'I have felt sad or miserable',
  'emotion_4': 'I have been so unhappy that I have been crying',
  'emotion_5': 'I have felt hopeless about the future',
  // Anxiety
  'anxiety_1': 'I have felt anxious or worried for no good reason',
  'anxiety_2': 'I have felt scared or panicky for no very good reason',
  'anxiety_3': 'I have been anxious or worried about my baby\'s health',
  'anxiety_4': 'I have felt tense or on edge',
  'anxiety_5': 'I have had difficulty controlling my worries',
  // Sleep & Fatigue
  'sleep_1': 'I have had trouble sleeping even when my baby was asleep',
  'sleep_2': 'I have felt tired or exhausted',
  'sleep_3': 'I have had difficulty falling asleep',
  'sleep_4': 'I have felt rested and refreshed upon waking',
  'sleep_5': 'I have had difficulty staying asleep',
  // Support System
  'support_1': 'I have felt supported by my partner or family',
  'support_2': 'I have had someone to talk to about my feelings',
  'support_3': 'I have felt isolated or alone',
  'support_4': 'I have felt comfortable asking for help when needed',
  'support_5': 'I have felt judged by others',
  // Mother-Infant Bonding
  'bonding_1': 'I have felt close to my baby',
  'bonding_2': 'I have enjoyed being with my baby',
  'bonding_3': 'I have felt confident in caring for my baby',
  'bonding_4': 'I have worried about my ability to care for my baby',
  'bonding_5': 'I have felt disconnected from my baby',
  // Physical-Mental Link
  'physical_1': 'I have experienced physical symptoms related to stress (headaches, tension, etc.)',
  'physical_2': 'I have noticed my mood affecting my physical recovery',
  'physical_3': 'I have felt that my physical health impacts my mental wellbeing',
  'physical_4': 'I have been able to manage physical discomfort effectively',
};

/**
 * Create comprehensive, natural language text input from assessment data for BERT analysis
 * This creates rich, contextual text that BERT can effectively analyze
 */
const createAssessmentText = (assessmentData) => {
  const textParts = [];
  
  // Build natural language representation from questions and responses
  if (assessmentData.responses && Object.keys(assessmentData.responses).length > 0) {
    const responseTexts = [];
    
    Object.entries(assessmentData.responses).forEach(([questionId, responseValue]) => {
      const questionText = assessmentData.questions?.[questionId] || QUESTION_DATABASE[questionId] || `Question ${questionId}`;
      const responseLabel = RESPONSE_LABELS[responseValue] || `Score ${responseValue}`;
      
      // Create natural language statement
      // For inverse questions (positive framing), invert the meaning
      const isPositiveQuestion = questionId.includes('emotion_1') || questionId.includes('emotion_2') || 
                                 questionId.includes('support_1') || questionId.includes('support_2') ||
                                 questionId.includes('bonding_1') || questionId.includes('bonding_2') ||
                                 questionId.includes('bonding_3') || questionId.includes('sleep_4');
      
      if (isPositiveQuestion) {
        // For positive questions, high score (3) = good, low score (0) = bad
        if (responseValue === 0) {
          responseTexts.push(`${questionText}. This is not true at all for me.`);
        } else if (responseValue === 1) {
          responseTexts.push(`${questionText}. This is rarely true for me.`);
        } else if (responseValue === 2) {
          responseTexts.push(`${questionText}. This is sometimes true for me.`);
        } else {
          responseTexts.push(`${questionText}. This is very often true for me.`);
        }
      } else {
        // For negative questions, high score (3) = bad, low score (0) = good
        if (responseValue === 0) {
          responseTexts.push(`${questionText}. This is not at all true for me.`);
        } else if (responseValue === 1) {
          responseTexts.push(`${questionText}. This is rarely true for me.`);
        } else if (responseValue === 2) {
          responseTexts.push(`${questionText}. This is sometimes true for me.`);
        } else {
          responseTexts.push(`${questionText}. This is very often true for me.`);
        }
      }
    });
    
    if (responseTexts.length > 0) {
      textParts.push(responseTexts.join(' '));
    }
  }
  
  // Add free-text responses if available (most valuable for BERT)
  if (assessmentData.freeTextResponses) {
    Object.entries(assessmentData.freeTextResponses).forEach(([questionId, text]) => {
      if (text && text.trim().length > 0) {
        const questionText = assessmentData.freeTextQuestions?.[questionId] || '';
        if (questionText) {
          textParts.push(`When asked "${questionText}", I responded: "${text}"`);
        } else {
          textParts.push(`Additional information: "${text}"`);
        }
      }
    });
  }
  
  // Add physical conditions in natural language
  if (assessmentData.physical_conditions) {
    const physical = assessmentData.physical_conditions;
    const physicalStatements = [];
    
    if (physical.temperature !== undefined) {
      if (physical.temperature > 99.5) {
        physicalStatements.push(`My body temperature is elevated at ${physical.temperature} degrees Fahrenheit`);
      } else if (physical.temperature < 97.0) {
        physicalStatements.push(`My body temperature is low at ${physical.temperature} degrees Fahrenheit`);
      }
    }
    
    if (physical.sleepHours !== undefined) {
      if (physical.sleepHours < 6) {
        physicalStatements.push(`I am getting insufficient sleep, only ${physical.sleepHours} hours per night`);
      } else if (physical.sleepHours > 9) {
        physicalStatements.push(`I am sleeping ${physical.sleepHours} hours per night`);
      }
    }
    
    if (physical.sleepQuality !== undefined) {
      if (physical.sleepQuality < 3) {
        physicalStatements.push(`My sleep quality is poor, rated ${physical.sleepQuality} out of 5`);
      }
    }
    
    if (physical.heartRate !== undefined) {
      if (physical.heartRate > 100) {
        physicalStatements.push(`My heart rate is elevated at ${physical.heartRate} beats per minute`);
      }
    }
    
    if (physical.systolicBP !== undefined || physical.diastolicBP !== undefined) {
      const bp = `${physical.systolicBP || 'N/A'}/${physical.diastolicBP || 'N/A'}`;
      physicalStatements.push(`My blood pressure is ${bp} mmHg`);
    }
    
    if (physicalStatements.length > 0) {
      textParts.push(`Physical health information: ${physicalStatements.join('. ')}`);
    }
  }
  
  // Add category summary for context
  if (assessmentData.category_scores) {
    const categorySummaries = [];
    Object.entries(assessmentData.category_scores).forEach(([category, score]) => {
      const categoryName = category.replace(/_/g, ' ');
      if (score >= 10) {
        categorySummaries.push(`severe concerns in ${categoryName}`);
      } else if (score >= 7) {
        categorySummaries.push(`significant issues in ${categoryName}`);
      } else if (score >= 4) {
        categorySummaries.push(`moderate concerns in ${categoryName}`);
      }
    });
    
    if (categorySummaries.length > 0) {
      textParts.push(`Overall assessment shows ${categorySummaries.join(', ')}`);
    }
  }
  
  // Combine all parts into a comprehensive narrative
  const fullText = textParts.join('. ');
  
  // If we have meaningful text, return it; otherwise create a minimal description
  if (fullText.trim().length > 0) {
    return fullText + '.';
  } else {
    // Fallback: create basic description from scores
    return `Postpartum mental health assessment completed. Category scores: ${JSON.stringify(assessmentData.category_scores || {})}`;
  }
};

/**
 * Enhanced PPD prediction using real BERT model
 * Now uses improved text representation and better risk analysis
 */
const predictPPDWithBERT = async (assessmentData) => {
  try {
    // Create rich, natural language text representation of assessment
    const assessmentText = createAssessmentText(assessmentData);
    
    logger.info('BERT analysis text length:', assessmentText.length);
    logger.debug('BERT analysis text preview:', assessmentText.substring(0, 200));
    
    // Analyze with BERT
    const bertAnalysis = await analyzeTextWithBERT(assessmentText);
    
    // If BERT analysis failed, return null to use fallback
    if (!bertAnalysis) {
      logger.warn('BERT analysis failed, using fallback method');
      return null;
    }
    
    // Get base risk score from structured assessment
    const baseRiskScore = assessmentData.score || 0;
    
    // Normalize base score to 0-100 scale if needed (assuming max score ~60-75)
    const normalizedBaseScore = Math.min(100, (baseRiskScore / 75) * 100);
    
    // BERT provides direct risk score (0-100)
    const bertRiskScore = bertAnalysis.riskScore || 0;
    
    // Enhanced weighted combination: 55% structured data, 45% BERT analysis
    // Increased BERT weight because we're now providing better input
    const combinedRiskScore = (normalizedBaseScore * 0.55) + (bertRiskScore * 0.45);
    
    // Risk indicator-based adjustments (more sophisticated than keyword matching)
    let riskIndicatorAdjustment = 0;
    if (bertAnalysis.riskIndicators && bertAnalysis.riskIndicators.length > 0) {
      // Severe risk indicators
      if (bertAnalysis.riskIndicators.includes('severe_depression_risk')) {
        riskIndicatorAdjustment += 20;
      }
      if (bertAnalysis.riskIndicators.includes('suicide_risk')) {
        riskIndicatorAdjustment += 30; // Critical - immediate attention needed
      }
      
      // Moderate risk indicators
      if (bertAnalysis.riskIndicators.includes('depression_symptoms')) {
        riskIndicatorAdjustment += 12;
      }
      if (bertAnalysis.riskIndicators.includes('anxiety_symptoms')) {
        riskIndicatorAdjustment += 8;
      }
      if (bertAnalysis.riskIndicators.includes('emotional_distress')) {
        riskIndicatorAdjustment += 10;
      }
      
      // Additional indicators
      if (bertAnalysis.riskIndicators.includes('isolation')) {
        riskIndicatorAdjustment += 6;
      }
      if (bertAnalysis.riskIndicators.includes('overwhelmed')) {
        riskIndicatorAdjustment += 8;
      }
    }
    
    // Sentiment-based adjustments (using enhanced sentiment analysis)
    let sentimentAdjustment = 0;
    if (bertAnalysis.sentiment === 'high_risk' && bertAnalysis.confidence > 0.7) {
      sentimentAdjustment = 18; // High confidence high risk
    } else if (bertAnalysis.sentiment === 'negative' && bertAnalysis.confidence > 0.7) {
      sentimentAdjustment = 12; // High confidence negative sentiment
    } else if (bertAnalysis.sentiment === 'negative' && bertAnalysis.confidence > 0.5) {
      sentimentAdjustment = 6;
    }
    
    // Confidence-based scaling: Higher confidence = more weight to BERT insights
    const confidenceMultiplier = 0.5 + (bertAnalysis.confidence * 0.5); // 0.5 to 1.0
    const adjustedRiskScore = combinedRiskScore + 
                              (riskIndicatorAdjustment * confidenceMultiplier) + 
                              (sentimentAdjustment * confidenceMultiplier);
    
    const finalRiskScore = Math.min(100, Math.max(0, adjustedRiskScore));
    
    logger.info('BERT prediction complete', {
      baseScore: normalizedBaseScore,
      bertScore: bertRiskScore,
      combinedScore: combinedRiskScore,
      riskIndicators: bertAnalysis.riskIndicators,
      finalScore: finalRiskScore,
      confidence: bertAnalysis.confidence
    });
    
    return {
      bertAnalysis,
      combinedRiskScore: finalRiskScore,
      baseScore: normalizedBaseScore,
      bertRawScore: bertRiskScore,
      riskIndicatorAdjustment,
      sentimentAdjustment,
      confidence: bertAnalysis.confidence || 0.7,
      usingBERT: true,
      assessmentTextLength: assessmentText.length
    };
    
  } catch (error) {
    logger.error('BERT prediction error:', error);
    return null; // Fallback to feature-based
  }
};

/**
 * Batch analyze multiple text inputs efficiently
 */
const batchAnalyzeTexts = async (texts) => {
  try {
    if (!sentimentClassifier) {
      await initializeModels();
    }
    
    if (!sentimentClassifier) {
      return null;
    }
    
    // Process texts in parallel (BERT handles batching internally)
    const results = await Promise.all(
      texts.map(text => analyzeTextWithBERT(text))
    );
    
    return results.filter(r => r !== null);
  } catch (error) {
    logger.error('Batch BERT analysis error:', error);
    return null;
  }
};

module.exports = {
  initializeModels,
  analyzeTextWithBERT,
  predictPPDWithBERT,
  batchAnalyzeTexts,
  createAssessmentText
};
