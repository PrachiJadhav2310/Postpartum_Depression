/**
 * Intelligent Risk Scoring System
 * Calculates risk percentage and determines appropriate response level
 */

export interface RiskScoreResult {
  riskPercentage: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  categoryScores: { [key: string]: number };
  totalScore: number;
  maxPossibleScore: number;
  recommendations: string[];
  actions: RiskAction[];
  emergencyContact?: boolean;
}

export interface RiskAction {
  type: 'self-care' | 'exercise' | 'consultation' | 'emergency';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
}

/**
 * Calculate risk percentage using weighted ML-like algorithm
 * Considers category scores, patterns, and critical indicators
 */
export const calculateRiskScore = (
  categoryScores: { [key: string]: number },
  responses: { [key: string]: number }
): RiskScoreResult => {
  const maxPossibleScore = 72; // 6 categories × 4 questions × 3 max score
  const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);
  
  // Apply weighted adjustments based on critical categories
  const weights: { [key: string]: number } = {
    emotional_wellbeing: 1.2,  // Higher weight for emotional state
    anxiety: 1.3,                // Anxiety is a strong indicator
    sleep_fatigue: 1.1,          // Sleep affects everything
    support_system: 0.9,         // Support can mitigate risk
    mother_infant_bonding: 1.2, // Critical for postpartum
    physical_mental_link: 1.0,  // Baseline weight
  };
  
  // Calculate weighted risk
  let weightedRisk = 0;
  let totalWeight = 0;
  
  Object.entries(categoryScores).forEach(([category, score]) => {
    const weight = weights[category] || 1.0;
    const categoryMax = 12; // 4 questions × 3 max score
    const categoryPercentage = (score / categoryMax) * 100;
    weightedRisk += categoryPercentage * weight;
    totalWeight += weight;
  });
  
  weightedRisk = weightedRisk / totalWeight;
  
  // Check for critical indicators (specific high-risk responses)
  let criticalAdjustment = 0;
  const criticalQuestions = [
    'emotion_3', 'emotion_4', // Sadness and crying
    'anxiety_2', 'anxiety_3', // Panic and baby health anxiety
    'bonding_4',              // Worry about ability to care
  ];
  
  criticalQuestions.forEach((questionId) => {
    if (responses[questionId] === 3) {
      criticalAdjustment += 5; // Add 5% for each critical "very often" response
    }
  });
  
  // Final risk percentage
  const riskPercentage = Math.min(100, Math.max(0, weightedRisk + criticalAdjustment));
  
  // Determine risk level
  let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  if (riskPercentage >= 60) {
    riskLevel = 'critical';
  } else if (riskPercentage >= 40) {
    riskLevel = 'high';
  } else if (riskPercentage >= 25) {
    riskLevel = 'moderate';
  } else {
    riskLevel = 'low';
  }
  
  // Generate recommendations and actions
  const { recommendations, actions, emergencyContact } = generateRiskResponse(
    riskLevel,
    riskPercentage,
    categoryScores
  );
  
  // Use riskPercentage in return statement
  const finalRiskPercentage = riskPercentage;
  
  return {
    riskPercentage: Math.round(finalRiskPercentage * 10) / 10, // Round to 1 decimal
    riskLevel,
    categoryScores,
    totalScore,
    maxPossibleScore,
    recommendations,
    actions,
    emergencyContact,
  };
};

/**
 * Generate appropriate response based on risk level
 */
const generateRiskResponse = (
  riskLevel: 'low' | 'moderate' | 'high' | 'critical',
  _riskPercentage: number, // Used for future enhancements
  categoryScores: { [key: string]: number }
): {
  recommendations: string[];
  actions: RiskAction[];
  emergencyContact: boolean;
} => {
  const recommendations: string[] = [];
  const actions: RiskAction[] = [];
  let emergencyContact = false;
  
  // Identify high-scoring categories
  const highCategories = Object.entries(categoryScores)
    .filter(([_, score]) => score >= 8)
    .map(([category, _]) => category);
  
  switch (riskLevel) {
    case 'critical':
      emergencyContact = true;
      recommendations.push(
        '⚠️ SELF-HARM RISK DETECTED: Your assessment indicates a critical risk level (60%+).',
        'IMMEDIATE EMERGENCY RESPONSE REQUIRED: Please reach out to emergency services or a crisis helpline immediately.',
        'You are not alone, and help is available right now. Do not wait - call 14416 (Tele-MANAS), 112 (Emergency), or 181 (Women Helpline).'
      );
      actions.push(
        {
          type: 'emergency',
          title: 'Call Emergency Services',
          description: 'If you are having thoughts of self-harm, call 14416 (Tele-MANAS) or 112 immediately.',
          priority: 'critical',
          actionUrl: 'tel:14416',
        },
        {
          type: 'emergency',
          title: 'Call Women Helpline',
          description: 'Call 181 for women-focused emergency support services.',
          priority: 'critical',
          actionUrl: 'tel:181',
        },
        {
          type: 'consultation',
          title: 'Urgent Healthcare Consultation',
          description: 'Schedule an immediate consultation with your healthcare provider or mental health professional.',
          priority: 'critical',
        }
      );
      break;
      
    case 'high':
      recommendations.push(
        '⚠️ POSSIBLE POSTPARTUM DEPRESSION (PPD) DETECTED: Your assessment indicates a high risk level (40-59%).',
        'DOCTOR CONSULTATION REQUIRED: We strongly recommend consulting with a healthcare provider within 48 hours.',
        'Early intervention can significantly improve outcomes. This is a medical condition that responds well to treatment.'
      );
      
      if (highCategories.includes('anxiety')) {
        recommendations.push('High anxiety levels detected - consider anxiety management techniques.');
      }
      if (highCategories.includes('sleep_fatigue')) {
        recommendations.push('Sleep issues are affecting your wellbeing - discuss sleep strategies with your provider.');
      }
      if (highCategories.includes('support_system')) {
        recommendations.push('Building a support network is important - consider joining support groups.');
      }
      
      actions.push(
        {
          type: 'consultation',
          title: 'Schedule Doctor Consultation',
          description: 'Contact your healthcare provider within 48 hours to discuss your assessment results.',
          priority: 'high',
        },
        {
          type: 'exercise',
          title: 'Guided Breathing Exercises',
          description: 'Practice deep breathing exercises to help manage stress and anxiety.',
          priority: 'high',
        },
        {
          type: 'self-care',
          title: 'Self-Care Strategies',
          description: 'Implement self-care routines including rest, nutrition, and gentle movement.',
          priority: 'medium',
        }
      );
      break;
      
    case 'moderate':
      recommendations.push(
        '⚠️ AT RISK: Your assessment indicates a moderate risk level (25-39%). This is common during postpartum adjustment.',
        'GUIDED EXERCISES RECOMMENDED: Consider guided exercises and self-care strategies to support your wellbeing.',
        'RE-TEST RECOMMENDED: We recommend re-taking this assessment in 1-2 weeks to track your progress.'
      );
      
      if (highCategories.includes('anxiety')) {
        recommendations.push('Focus on anxiety-reduction techniques like meditation and breathing exercises.');
      }
      if (highCategories.includes('sleep_fatigue')) {
        recommendations.push('Prioritize rest and establish a sleep routine when possible.');
      }
      if (highCategories.includes('support_system')) {
        recommendations.push('Reach out to friends, family, or support groups for connection.');
      }
      
      actions.push(
        {
          type: 'exercise',
          title: 'Guided Meditation Session',
          description: 'Try a 10-minute guided meditation designed for postpartum mothers.',
          priority: 'medium',
        },
        {
          type: 'exercise',
          title: 'Breathing Exercises',
          description: 'Learn and practice deep breathing techniques to reduce stress.',
          priority: 'medium',
        },
        {
          type: 'exercise',
          title: 'Gentle Movement',
          description: 'Engage in gentle postpartum-safe exercises like walking or stretching.',
          priority: 'low',
        },
        {
          type: 'self-care',
          title: 'Self-Care Tips',
          description: 'Access personalized self-care recommendations based on your needs.',
          priority: 'medium',
        },
        {
          type: 'consultation',
          title: 'Re-test in 1-2 Weeks',
          description: 'Take this assessment again to track changes in your wellbeing.',
          priority: 'low',
        }
      );
      break;
      
    case 'low':
      recommendations.push(
        '✅ NORMAL ADJUSTMENT: Your assessment indicates a low risk level (0-24%). This is a positive sign!',
        'SELF-CARE TIPS: Continue with self-care practices and monitor your wellbeing.',
        'Remember that it\'s normal to have ups and downs during this time. Keep up your wellness routine!'
      );
      
      actions.push(
        {
          type: 'self-care',
          title: 'Self-Care Tips',
          description: 'Maintain your wellness routine with these evidence-based self-care strategies.',
          priority: 'low',
        },
        {
          type: 'self-care',
          title: 'Nutrition Guidance',
          description: 'Learn about postpartum nutrition to support your recovery.',
          priority: 'low',
        },
        {
          type: 'self-care',
          title: 'Rest & Recovery',
          description: 'Tips for getting quality rest as a new mother.',
          priority: 'low',
        },
        {
          type: 'exercise',
          title: 'Wellness Activities',
          description: 'Explore gentle activities that support your physical and mental health.',
          priority: 'low',
        }
      );
      break;
  }
  
  return { recommendations, actions, emergencyContact };
};

/**
 * Get risk level color for UI display
 */
export const getRiskLevelColor = (riskLevel: string) => {
  switch (riskLevel) {
    case 'critical':
      return 'bg-red-600 text-white border-red-700';
    case 'high':
      return 'bg-orange-500 text-white border-orange-600';
    case 'moderate':
      return 'bg-yellow-500 text-white border-yellow-600';
    case 'low':
      return 'bg-green-500 text-white border-green-600';
    default:
      return 'bg-gray-500 text-white border-gray-600';
  }
};

/**
 * Get risk level label
 */
export const getRiskLevelLabel = (riskLevel: string) => {
  switch (riskLevel) {
    case 'critical':
      return 'Critical (60%+) - Self-harm Risk - IMMEDIATE Emergency Response';
    case 'high':
      return 'High (40-59%) - Possible PPD - Doctor Consult Within 48hrs';
    case 'moderate':
      return 'Moderate (25-39%) - At Risk - Guided Exercises, Re-test';
    case 'low':
      return 'Low (0-24%) - Normal Adjustment - Self-care Tips';
    default:
      return 'Unknown';
  }
};

