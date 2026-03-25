import React, { useState, useEffect } from 'react';
import { Brain, ArrowRight, CheckCircle, Heart, Moon, Users, Baby, Activity, Thermometer, HeartPulse, Scale, Droplet } from 'lucide-react';
import { mentalHealthAPI, healthAPI } from '../services/api';
import RiskResponse from '../components/RiskResponse';

interface DetailedAssessmentProps {
  userName: string;
  userId: string;
  onComplete: () => void;
}

interface PhysicalCondition {
  temperature?: number;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  weight?: number;
  sleepHours?: number;
  sleepQuality?: number; // 1-5
  waterIntake?: number; // in liters
}

interface AssessmentResponses {
  [key: string]: number; // questionId -> rating (0-3)
}

const DetailedAssessment: React.FC<DetailedAssessmentProps> = ({ userName, userId, onComplete }) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<AssessmentResponses>({});
  const [physicalConditions, setPhysicalConditions] = useState<PhysicalCondition>({});
  const [freeTextResponses, setFreeTextResponses] = useState<{ [key: string]: string }>({});
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [riskResult, setRiskResult] = useState<any>(null);
  const [showRiskResponse, setShowRiskResponse] = useState(false);
  const [transitioningSection, setTransitioningSection] = useState(false);

  // 6 Clinical Categories with questions
  const sections = [
    {
      id: 'emotional_wellbeing',
      title: 'Emotional Well-being',
      icon: Heart,
      color: 'from-rose-500 to-pink-500',
      questions: [
        { id: 'emotion_1', question: 'I have been able to laugh and see the funny side of things', category: 'emotional_wellbeing' },
        { id: 'emotion_2', question: 'I have looked forward with enjoyment to things', category: 'emotional_wellbeing' },
        { id: 'emotion_3', question: 'I have felt sad or miserable', category: 'emotional_wellbeing' },
        { id: 'emotion_4', question: 'I have been so unhappy that I have been crying', category: 'emotional_wellbeing' },
        { id: 'emotion_5', question: 'I have felt hopeless about the future', category: 'emotional_wellbeing' },
      ],
    },
    {
      id: 'anxiety',
      title: 'Anxiety',
      icon: Brain,
      color: 'from-purple-500 to-indigo-500',
      questions: [
        { id: 'anxiety_1', question: 'I have felt anxious or worried for no good reason', category: 'anxiety' },
        { id: 'anxiety_2', question: 'I have felt scared or panicky for no very good reason', category: 'anxiety' },
        { id: 'anxiety_3', question: 'I have been anxious or worried about my baby\'s health', category: 'anxiety' },
        { id: 'anxiety_4', question: 'I have felt tense or on edge', category: 'anxiety' },
        { id: 'anxiety_5', question: 'I have had difficulty controlling my worries', category: 'anxiety' },
      ],
    },
    {
      id: 'sleep_fatigue',
      title: 'Sleep & Fatigue',
      icon: Moon,
      color: 'from-blue-500 to-cyan-500',
      questions: [
        { id: 'sleep_1', question: 'I have had trouble sleeping even when my baby was asleep', category: 'sleep_fatigue' },
        { id: 'sleep_2', question: 'I have felt tired or exhausted', category: 'sleep_fatigue' },
        { id: 'sleep_3', question: 'I have had difficulty falling asleep', category: 'sleep_fatigue' },
        { id: 'sleep_4', question: 'I have felt rested and refreshed upon waking', category: 'sleep_fatigue' },
        { id: 'sleep_5', question: 'I have had difficulty staying asleep', category: 'sleep_fatigue' },
      ],
    },
    {
      id: 'support_system',
      title: 'Support System',
      icon: Users,
      color: 'from-green-500 to-emerald-500',
      questions: [
        { id: 'support_1', question: 'I have felt supported by my partner or family', category: 'support_system' },
        { id: 'support_2', question: 'I have had someone to talk to about my feelings', category: 'support_system' },
        { id: 'support_3', question: 'I have felt isolated or alone', category: 'support_system' },
        { id: 'support_4', question: 'I have felt comfortable asking for help when needed', category: 'support_system' },
        { id: 'support_5', question: 'I have felt judged by others', category: 'support_system' },
      ],
    },
    {
      id: 'mother_infant_bonding',
      title: 'Mother-Infant Bonding',
      icon: Baby,
      color: 'from-yellow-500 to-orange-500',
      questions: [
        { id: 'bonding_1', question: 'I have felt close to my baby', category: 'mother_infant_bonding' },
        { id: 'bonding_2', question: 'I have enjoyed being with my baby', category: 'mother_infant_bonding' },
        { id: 'bonding_3', question: 'I have felt confident in caring for my baby', category: 'mother_infant_bonding' },
        { id: 'bonding_4', question: 'I have worried about my ability to care for my baby', category: 'mother_infant_bonding' },
        { id: 'bonding_5', question: 'I have felt disconnected from my baby', category: 'mother_infant_bonding' },
      ],
    },
    {
      id: 'physical_conditions',
      title: 'Physical Conditions',
      icon: Activity,
      color: 'from-red-500 to-rose-500',
      questions: [], // Physical conditions are handled separately
    },
  ];

  // Free-text questions for better BERT analysis
  const freeTextQuestions = [
    {
      id: 'free_text_emotional',
      question: 'How have you been feeling emotionally? Please describe your emotional state in your own words.',
      category: 'emotional_wellbeing',
      section: 'emotional_wellbeing'
    },
    {
      id: 'free_text_concerns',
      question: 'What are your biggest concerns or worries right now?',
      category: 'anxiety',
      section: 'anxiety'
    },
    {
      id: 'free_text_support',
      question: 'Tell us about your support system. Who can you talk to when you need help?',
      category: 'support_system',
      section: 'support_system'
    },
    {
      id: 'free_text_additional',
      question: 'Is there anything else you would like to share about how you\'ve been feeling?',
      category: 'general',
      section: 'physical_conditions' // Show at the end
    }
  ];

  const ratingLabels = [
    { value: 0, label: 'Not at all', color: 'bg-green-500 hover:bg-green-600 border-green-600' },
    { value: 1, label: 'Rarely', color: 'bg-green-400 hover:bg-green-500 border-green-500' },
    { value: 2, label: 'Sometimes', color: 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600' },
    { value: 3, label: 'Very often', color: 'bg-red-500 hover:bg-red-600 border-red-600' },
  ];

  const [showFreeText, setShowFreeText] = useState(false);
  const [currentFreeTextIndex, setCurrentFreeTextIndex] = useState(0);

  const currentSectionData = sections[currentSection];
  const isPhysicalSection = currentSectionData.id === 'physical_conditions';
  const isFreeTextMode = showFreeText;
  const totalQuestions = sections.reduce((sum, section) => sum + (section.id === 'physical_conditions' ? 0 : section.questions.length), 0);
  const answeredQuestions = Object.keys(responses).length;
  const progress = (answeredQuestions / totalQuestions) * 100;
  
  const currentFreeTextQuestion = freeTextQuestions[currentFreeTextIndex];

  const handleRating = (rating: number) => {
    setResponses({
      ...responses,
      [currentQuestionData.id]: rating,
    });
  };

  const handlePhysicalChange = (field: keyof PhysicalCondition, value: number) => {
    setPhysicalConditions({
      ...physicalConditions,
      [field]: value,
    });
  };

  const handleNext = () => {
    if (isFreeTextMode) {
      // Free-text question mode
      if (currentFreeTextIndex < freeTextQuestions.length - 1) {
        setCurrentFreeTextIndex(currentFreeTextIndex + 1);
      } else {
        // All free-text questions done, submit assessment
        submitAssessment();
      }
    } else if (isPhysicalSection) {
      // Physical section -> free-text: force immediate UI transition.
      setTransitioningSection(true);
      requestAnimationFrame(() => {
        setShowFreeText(true);
        setCurrentFreeTextIndex(0);
        setTransitioningSection(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      // Regular question section
      if (currentQuestion < currentSectionData.questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else if (currentSection < sections.length - 1) {
        setCurrentSection(currentSection + 1);
        setCurrentQuestion(0);
      } else {
        // All sections done, move to free-text questions
        setShowFreeText(true);
        setCurrentFreeTextIndex(0);
      }
    }
  };

  const handleBack = () => {
    if (isPhysicalSection) {
      if (currentSection > 0) {
        setCurrentSection(currentSection - 1);
        const prevSection = sections[currentSection - 1];
        setCurrentQuestion(prevSection.questions.length - 1);
      }
    } else {
      if (currentQuestion > 0) {
        setCurrentQuestion(currentQuestion - 1);
      } else if (currentSection > 0) {
        setCurrentSection(currentSection - 1);
        const prevSection = sections[currentSection - 1];
        if (prevSection.id === 'physical_conditions') {
          setCurrentQuestion(0);
        } else {
          setCurrentQuestion(prevSection.questions.length - 1);
        }
      }
    }
  };

  const submitAssessment = async () => {
    setLoading(true);
    try {
      // Save physical conditions to health_records
      const healthRecords = [];
      if (physicalConditions.temperature !== undefined) {
        healthRecords.push({
          recordType: 'temperature',
          value: physicalConditions.temperature,
          unit: '°F',
        });
      }
      if (physicalConditions.systolicBP !== undefined) {
        healthRecords.push({
          recordType: 'blood_pressure_systolic',
          value: physicalConditions.systolicBP,
          unit: 'mmHg',
        });
      }
      if (physicalConditions.diastolicBP !== undefined) {
        healthRecords.push({
          recordType: 'blood_pressure_diastolic',
          value: physicalConditions.diastolicBP,
          unit: 'mmHg',
        });
      }
      if (physicalConditions.heartRate !== undefined) {
        healthRecords.push({
          recordType: 'heart_rate',
          value: physicalConditions.heartRate,
          unit: 'bpm',
        });
      }
      if (physicalConditions.weight !== undefined) {
        healthRecords.push({
          recordType: 'weight',
          value: physicalConditions.weight,
          unit: 'lbs',
        });
      }
      if (physicalConditions.sleepHours !== undefined) {
        healthRecords.push({
          recordType: 'sleep_hours',
          value: physicalConditions.sleepHours,
          unit: 'hours',
        });
      }
      if (physicalConditions.sleepQuality !== undefined) {
        healthRecords.push({
          recordType: 'sleep_quality',
          value: physicalConditions.sleepQuality,
          unit: '1-5',
        });
      }
      if (physicalConditions.waterIntake !== undefined) {
        healthRecords.push({
          recordType: 'water_intake',
          value: physicalConditions.waterIntake,
          unit: 'liters',
        });
      }

      // Save all health records (don't fail assessment if health records fail)
      for (const record of healthRecords) {
        try {
          await healthAPI.addRecord(record);
        } catch (healthError) {
          console.warn('Failed to save health record:', record, healthError);
          // Continue even if health record fails
        }
      }

      // Calculate scores for each category
      const categoryScores: { [key: string]: number } = {};
      
      sections.forEach((section) => {
        if (section.id !== 'physical_conditions') {
          const sectionResponses = section.questions
            .map((q) => responses[q.id] ?? 0)
            .filter((val) => val !== undefined);
          categoryScores[section.id] = sectionResponses.reduce((sum, val) => sum + val, 0);
        }
      });

      // Calculate total score
      const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);

      // Build questions map for BERT analysis
      const questionsMap: { [key: string]: string } = {};
      sections.forEach((section) => {
        section.questions.forEach((q) => {
          questionsMap[q.id] = q.question;
        });
      });
      
      // Build free-text questions map
      const freeTextQuestionsMap: { [key: string]: string } = {};
      freeTextQuestions.forEach((q) => {
        freeTextQuestionsMap[q.id] = q.question;
      });

      // Prepare detailed assessment data for ML prediction with enhanced BERT input
      const assessmentData = {
        assessment_type: 'custom', // Use 'custom' to match database constraint
        assessment_subtype: 'detailed_ppd', // Store detailed type in data
        score: totalScore,
        responses: responses,
        questions: questionsMap, // Include question text for BERT
        category_scores: categoryScores,
        physical_conditions: physicalConditions,
        freeTextResponses: freeTextResponses, // Free-text responses for better BERT analysis
        freeTextQuestions: freeTextQuestionsMap, // Free-text question text
        completed_at: new Date().toISOString(),
      };

      // Submit to backend for BERT-based prediction
      const response = await mentalHealthAPI.submitDetailedAssessment({
        assessmentData: assessmentData,
      });

      if (!response.success) {
        console.error('Error saving assessment:', response);
        const errorMessage = response.message || response.error || 'Failed to save assessment';
        throw new Error(errorMessage);
      }

      // Store risk result and show response
      if (response.data && response.data.prediction) {
        const prediction = response.data.prediction;
        
        // Ensure categoryScores exists
        if (!prediction.categoryScores && assessmentData.category_scores) {
          prediction.categoryScores = assessmentData.category_scores;
        }
        
        // Ensure recommendations is an array
        if (!Array.isArray(prediction.recommendations)) {
          prediction.recommendations = [];
        }
        
        // Ensure actions is an array with proper structure
        if (!Array.isArray(prediction.actions)) {
          prediction.actions = prediction.recommendations.map((rec: any, index: number) => ({
            type: rec.type || 'self-care',
            title: rec.title || rec.message || `Action ${index + 1}`,
            description: rec.description || rec.message || '',
            priority: rec.priority || 'medium',
          }));
        }
        
        setRiskResult(prediction);
        setShowRiskResponse(true);
        setCompleted(true);
      } else {
        // If no prediction but assessment was saved, redirect to dashboard
        console.warn('Assessment saved but no prediction data. Redirecting to dashboard.');
        setCompleted(true);
        setShowRiskResponse(false);
      }
    } catch (error: any) {
      console.error('Error submitting assessment:', error);
      const errorMessage = error.message || error.response?.data?.message || error.response?.data?.error || 'Failed to save assessment. Please try again.';
      
      // Show user-friendly error
      alert(`Error: ${errorMessage}\n\nPlease check your connection and try again.`);
      setLoading(false);
      
      // Don't set completed state on error
      setCompleted(false);
      setShowRiskResponse(false);
    }
  };

  useEffect(() => {
    if (!completed || showRiskResponse) return;
    const timer = setTimeout(() => {
      window.location.href = '/';
      onComplete();
    }, 800);
    return () => clearTimeout(timer);
  }, [completed, showRiskResponse, onComplete]);

  if (completed && showRiskResponse && riskResult) {
    try {
      return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 py-8">
          <RiskResponse 
            riskResult={riskResult} 
            userName={userName}
            onClose={() => {
              setShowRiskResponse(false);
              // Navigate to dashboard immediately to show updated assessment
              window.location.href = '/';
            }}
          />
        </div>
      );
    } catch (error) {
      console.error('Error rendering RiskResponse:', error);
      // Fallback: redirect to dashboard if RiskResponse fails
      window.location.href = '/';
      return null;
    }
  }

  if (completed && !showRiskResponse) {
    // Redirect is handled by top-level effect.
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-r from-green-400 to-emerald-400 p-4 rounded-xl mb-6 inline-block">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank you, {userName}!</h1>
          <p className="text-gray-600 mb-4">Your detailed assessment has been completed successfully.</p>
          <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  const IconComponent = isFreeTextMode ? Brain : currentSectionData.icon;
  const currentQuestionData = isFreeTextMode ? null : (!isPhysicalSection ? currentSectionData.questions[currentQuestion] : null);
  const hasAnswered = isFreeTextMode 
    ? (freeTextResponses[currentFreeTextQuestion?.id || '']?.trim().length > 0 || true) // Free-text is optional
    : (isPhysicalSection ? true : (currentQuestionData ? responses[currentQuestionData.id] !== undefined : false));
  const isLastSection = isFreeTextMode 
    ? (currentFreeTextIndex === freeTextQuestions.length - 1)
    : (currentSection === sections.length - 1 && !showFreeText);

  // Render physical conditions section
  if (isPhysicalSection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className={`bg-gradient-to-r ${currentSectionData.color} p-3 rounded-xl`}>
                <IconComponent className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {currentSectionData.title}
                </h1>
                <p className="text-sm text-gray-600">
                  Section {currentSection + 1} of {sections.length}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-200 rounded-full h-3 mb-2 max-w-2xl mx-auto">
              <div
                className={`bg-gradient-to-r ${currentSectionData.color} h-3 rounded-full transition-all duration-300`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {answeredQuestions} of {totalQuestions} questions answered
            </p>
          </div>

          {/* Physical Conditions Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <p className="text-sm text-gray-500 mb-6">
              Please provide your current physical measurements. These help us make a more accurate assessment.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Temperature */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Thermometer className="h-4 w-4" />
                  Body Temperature (°F)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="90"
                  max="110"
                  value={physicalConditions.temperature || ''}
                  onChange={(e) => handlePhysicalChange('temperature', parseFloat(e.target.value) || 0)}
                  placeholder="98.6"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Blood Pressure */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Activity className="h-4 w-4" />
                  Blood Pressure (mmHg)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="60"
                    max="200"
                    value={physicalConditions.systolicBP || ''}
                    onChange={(e) => handlePhysicalChange('systolicBP', parseInt(e.target.value) || 0)}
                    placeholder="120"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <span className="self-center text-gray-500">/</span>
                  <input
                    type="number"
                    min="40"
                    max="120"
                    value={physicalConditions.diastolicBP || ''}
                    onChange={(e) => handlePhysicalChange('diastolicBP', parseInt(e.target.value) || 0)}
                    placeholder="80"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Heart Rate */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <HeartPulse className="h-4 w-4" />
                  Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  min="40"
                  max="200"
                  value={physicalConditions.heartRate || ''}
                  onChange={(e) => handlePhysicalChange('heartRate', parseInt(e.target.value) || 0)}
                  placeholder="72"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Weight */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Scale className="h-4 w-4" />
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="80"
                  max="300"
                  value={physicalConditions.weight || ''}
                  onChange={(e) => handlePhysicalChange('weight', parseFloat(e.target.value) || 0)}
                  placeholder="150"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Sleep Hours */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Moon className="h-4 w-4" />
                  Sleep Hours (last night)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={physicalConditions.sleepHours || ''}
                  onChange={(e) => handlePhysicalChange('sleepHours', parseFloat(e.target.value) || 0)}
                  placeholder="7.5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {/* Sleep Quality */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Moon className="h-4 w-4" />
                  Sleep Quality (1-5)
                </label>
                <select
                  value={physicalConditions.sleepQuality || ''}
                  onChange={(e) => handlePhysicalChange('sleepQuality', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Select quality</option>
                  <option value="1">1 - Very Poor</option>
                  <option value="2">2 - Poor</option>
                  <option value="3">3 - Fair</option>
                  <option value="4">4 - Good</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </div>

              {/* Water Intake */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Droplet className="h-4 w-4" />
                  Water Intake (liters per day)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={physicalConditions.waterIntake || ''}
                  onChange={(e) => handlePhysicalChange('waterIntake', parseFloat(e.target.value) || 0)}
                  placeholder="2.0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                onClick={handleBack}
                disabled={currentSection === 0 || loading}
                className="px-6 py-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                ← Back
              </button>

              <div className="text-sm text-gray-600">
                Physical Conditions
              </div>

              <button
                onClick={handleNext}
                disabled={loading || transitioningSection}
                className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                }`}
              >
                <span>{transitioningSection ? 'Opening...' : 'Next: Additional Questions'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Physical measurements are optional but help improve prediction accuracy. If you don't have current measurements, you can skip fields or use approximate values.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render free-text questions section
  if (isFreeTextMode && currentFreeTextQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-3 rounded-xl">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Additional Information
                </h1>
                <p className="text-sm text-gray-600">
                  Question {currentFreeTextIndex + 1} of {freeTextQuestions.length}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Your detailed responses help us better understand your situation
            </p>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 leading-relaxed mb-4">
                {currentFreeTextQuestion.question}
              </h2>
            </div>

            {/* Text Area */}
            <textarea
              value={freeTextResponses[currentFreeTextQuestion.id] || ''}
              onChange={(e) => handleFreeTextChange(currentFreeTextQuestion.id, e.target.value)}
              placeholder="Please share your thoughts here... (optional)"
              className="w-full h-48 p-4 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none text-gray-900 placeholder-gray-400"
              disabled={loading}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={handleBack}
                disabled={loading}
                className="px-6 py-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                ← Back
              </button>

              <div className="text-sm text-gray-600">
                {currentFreeTextIndex + 1} / {freeTextQuestions.length}
              </div>

              <button
                onClick={handleNext}
                disabled={loading}
                className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLastSection
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 text-white'
                }`}
              >
                <span>{isLastSection ? 'Complete Assessment' : 'Next'}</span>
                {!isLastSection && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render regular question section
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className={`bg-gradient-to-r ${currentSectionData.color} p-3 rounded-xl`}>
              <IconComponent className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentSectionData.title}
              </h1>
              <p className="text-sm text-gray-600">
                Section {currentSection + 1} of {sections.length}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-200 rounded-full h-3 mb-2 max-w-2xl mx-auto">
            <div
              className={`bg-gradient-to-r ${currentSectionData.color} h-3 rounded-full transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {answeredQuestions} of {totalQuestions} questions answered
          </p>
        </div>

        {/* Section Progress Indicators */}
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {sections.map((section, idx) => {
            const SectionIcon = section.icon;
            const sectionQuestions = section.questions;
            const sectionAnswered = section.id === 'physical_conditions' 
              ? true 
              : sectionQuestions.every((q) => responses[q.id] !== undefined);
            const isCurrent = idx === currentSection;
            
            return (
              <div
                key={section.id}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all ${
                  isCurrent
                    ? `bg-gradient-to-r ${section.color} text-white border-transparent`
                    : sectionAnswered
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <SectionIcon className="h-4 w-4" />
                <span className="text-xs font-medium">{idx + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">
              Question {currentQuestion + 1} of {currentSectionData.questions.length} in this section
            </p>
            <h2 className="text-xl font-semibold text-gray-900 leading-relaxed">
              {currentQuestionData?.question}
            </h2>
          </div>

          {/* Rating Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {ratingLabels.map((rating) => {
              const isSelected = currentQuestionData ? responses[currentQuestionData.id] === rating.value : false;
              return (
                <button
                  key={rating.value}
                  onClick={() => handleRating(rating.value)}
                  disabled={loading}
                  className={`${rating.color} text-white font-medium py-4 px-4 rounded-lg border-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected ? 'ring-4 ring-offset-2 ring-gray-400 scale-105' : ''
                  }`}
                >
                  <div className="text-2xl font-bold mb-1">{rating.value}</div>
                  <div className="text-sm">{rating.label}</div>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              disabled={currentSection === 0 && currentQuestion === 0 || loading}
              className="px-6 py-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              ← Back
            </button>

            <div className="text-sm text-gray-600">
              {answeredQuestions} / {totalQuestions}
            </div>

            <button
              onClick={handleNext}
              disabled={!hasAnswered || loading}
              className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isLastSection
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                  : `bg-gradient-to-r ${currentSectionData.color} hover:opacity-90 text-white`
              }`}
            >
              <span>{isLastSection ? 'Next: Additional Questions' : 'Next'}</span>
              {!isLastSection && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="text-sm text-blue-800">
            <strong>Privacy Notice:</strong> Your responses are confidential and help us provide personalized support tailored to your unique postpartum journey. This detailed assessment uses AI to provide more accurate predictions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DetailedAssessment;
