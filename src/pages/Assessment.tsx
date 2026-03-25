import React, { useState } from 'react';
import { Brain, ArrowRight, CheckCircle, Heart, Moon, Users, Baby, Activity } from 'lucide-react';
import { mentalHealthAPI } from '../services/api';
import { calculateRiskScore } from '../services/riskScoring';
import RiskResponse from '../components/RiskResponse';

interface AssessmentProps {
  userName: string;
  userId: string;
  onComplete: () => void;
}

interface Question {
  id: string;
  question: string;
  category: string;
}

interface AssessmentResponses {
  [key: string]: number; // questionId -> rating (0-3)
}

const Assessment: React.FC<AssessmentProps> = ({ userName, userId, onComplete }) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<AssessmentResponses>({});
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [riskResult, setRiskResult] = useState<any>(null);
  const [showRiskResponse, setShowRiskResponse] = useState(false);

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
      ],
    },
    {
      id: 'physical_mental_link',
      title: 'Physical-Mental Link',
      icon: Activity,
      color: 'from-red-500 to-rose-500',
      questions: [
        { id: 'physical_1', question: 'I have experienced physical symptoms related to stress (headaches, tension, etc.)', category: 'physical_mental_link' },
        { id: 'physical_2', question: 'I have noticed my mood affecting my physical recovery', category: 'physical_mental_link' },
        { id: 'physical_3', question: 'I have felt that my physical health impacts my mental wellbeing', category: 'physical_mental_link' },
        { id: 'physical_4', question: 'I have been able to manage physical discomfort effectively', category: 'physical_mental_link' },
      ],
    },
  ];

  const ratingLabels = [
    { value: 0, label: 'Not at all', color: 'bg-green-500 hover:bg-green-600 border-green-600' },
    { value: 1, label: 'Rarely', color: 'bg-green-400 hover:bg-green-500 border-green-500' },
    { value: 2, label: 'Sometimes', color: 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600' },
    { value: 3, label: 'Very often', color: 'bg-red-500 hover:bg-red-600 border-red-600' },
  ];

  const currentSectionData = sections[currentSection];
  const currentQuestionData = currentSectionData.questions[currentQuestion];
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
  const answeredQuestions = Object.keys(responses).length;
  const progress = (answeredQuestions / totalQuestions) * 100;

  const handleRating = (rating: number) => {
    setResponses({
      ...responses,
      [currentQuestionData.id]: rating,
    });
  };

  const handleNext = () => {
    if (currentQuestion < currentSectionData.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
      setCurrentQuestion(0);
    } else {
      submitAssessment();
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    } else if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
      setCurrentQuestion(sections[currentSection - 1].questions.length - 1);
    }
  };

  const submitAssessment = async () => {
    setLoading(true);
    try {
      // Calculate scores for each category
      const categoryScores: { [key: string]: number } = {};
      
      sections.forEach((section) => {
        const sectionResponses = section.questions
          .map((q) => responses[q.id] ?? 0)
          .filter((val) => val !== undefined);
        categoryScores[section.id] = sectionResponses.reduce((sum, val) => sum + val, 0);
      });

      // Calculate total score
      const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);

      // Use intelligent risk scoring system
      const calculatedRisk = calculateRiskScore(categoryScores, responses);
      const riskLevel = calculatedRisk.riskLevel;

      // Prepare assessment data with full risk result for dashboard display
      const assessmentData = {
        assessment_type: 'initial_postpartum',
        score: totalScore,
        responses: responses,
        category_scores: categoryScores,
        risk_level: riskLevel,
        risk_percentage: calculatedRisk.riskPercentage,
        recommendations: calculatedRisk.recommendations,
        actions: calculatedRisk.actions,
        emergencyContact: calculatedRisk.emergencyContact,
        completed_at: new Date().toISOString(),
      };

      // Convert responses object to array for backend (maintain order from sections)
      const responsesArray: number[] = [];
      sections.forEach((section) => {
        section.questions.forEach((question) => {
          responsesArray.push(responses[question.id] ?? 0);
        });
      });

      // Save to backend API
      // Send full assessment data - backend now accepts objects
      const response = await mentalHealthAPI.submitAssessment({
        assessmentType: 'custom',
        responses: assessmentData, // Send full assessment data object
        notes: `Risk Percentage: ${calculatedRisk.riskPercentage}%, Risk Level: ${riskLevel}`,
      });

      if (!response.success) {
        console.error('Error saving assessment:', response.message);
        throw new Error(response.message || 'Failed to save assessment');
      }

      // Store risk result and show response
      setRiskResult(calculatedRisk);
      setShowRiskResponse(true);
      setCompleted(true);
    } catch (error) {
      console.error('Error submitting assessment:', error);
      alert('Failed to save assessment. Please try again.');
      setLoading(false);
    }
  };

  if (completed && showRiskResponse && riskResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 py-8">
        <RiskResponse 
          riskResult={riskResult} 
          userName={userName}
          onClose={() => {
            setShowRiskResponse(false);
            setTimeout(() => {
              onComplete();
            }, 500);
          }}
        />
      </div>
    );
  }

  if (completed && !showRiskResponse) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-r from-green-400 to-emerald-400 p-4 rounded-xl mb-6 inline-block">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank you, {userName}!</h1>
          <p className="text-gray-600 mb-4">Your assessment has been completed successfully.</p>
          <p className="text-sm text-gray-500">Setting up your personalized wellness dashboard...</p>
        </div>
      </div>
    );
  }

  const IconComponent = currentSectionData.icon;
  const hasAnswered = responses[currentQuestionData.id] !== undefined;
  const isLastQuestion = currentQuestion === currentSectionData.questions.length - 1 && currentSection === sections.length - 1;

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
            const sectionAnswered = sectionQuestions.every((q) => responses[q.id] !== undefined);
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
              {currentQuestionData.question}
            </h2>
          </div>

          {/* Rating Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {ratingLabels.map((rating) => {
              const isSelected = responses[currentQuestionData.id] === rating.value;
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
                isLastQuestion
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                  : `bg-gradient-to-r ${currentSectionData.color} hover:opacity-90 text-white`
              }`}
            >
              <span>{isLastQuestion ? 'Complete Assessment' : 'Next'}</span>
              {!isLastQuestion && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="text-sm text-blue-800">
            <strong>Privacy Notice:</strong> Your responses are confidential and help us provide personalized support tailored to your unique postpartum journey. This assessment helps us understand your current wellbeing across six key areas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Assessment;

