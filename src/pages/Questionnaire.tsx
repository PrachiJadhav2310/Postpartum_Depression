import React, { useState } from 'react';
import { Brain, ArrowRight, CheckCircle } from 'lucide-react';

interface QuestionnaireProps {
  userName: string;
  onComplete: () => void;
}

const Questionnaire: React.FC<QuestionnaireProps> = ({ userName, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);

  const questions = [
    {
      id: 'delivery_type',
      question: 'What type of delivery did you have?',
      options: ['Vaginal', 'C-Section', 'Planned C-Section', 'Emergency C-Section', 'VBAC'],
    },
    {
      id: 'support_system',
      question: 'Do you have adequate support from family or partner?',
      options: ['Yes, very supportive', 'Somewhat', 'Not much', 'No support'],
    },
    {
      id: 'sleep_pattern',
      question: 'How would you describe your current sleep pattern?',
      options: ['Good, sleeping well', 'Fair, some disruption', 'Poor, very disrupted', 'Severe insomnia'],
    },
    {
      id: 'mood_concern',
      question: 'Have you experienced any concerning mood changes?',
      options: ['No', 'Mild mood swings', 'Moderate concern', 'Severe concerns'],
    },
    {
      id: 'feeding_method',
      question: 'How are you feeding your baby?',
      options: ['Breastfeeding', 'Formula feeding', 'Mixed feeding', 'Not applicable'],
    },
    {
      id: 'physical_recovery',
      question: 'How is your physical recovery progressing?',
      options: ['Very good', 'Good', 'Fair', 'Having difficulties'],
    },
    {
      id: 'stress_level',
      question: 'What is your current stress level?',
      options: ['Low', 'Moderate', 'High', 'Very high'],
    },
    {
      id: 'healthcare_access',
      question: 'Do you have access to healthcare if needed?',
      options: ['Yes, easily accessible', 'Somewhat accessible', 'Limited access', 'No access'],
    },
  ];

  const handleAnswer = (answer: string) => {
    const newResponses = [...responses];
    newResponses[currentQuestion] = answer;
    setResponses(newResponses);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitQuestionnaire(newResponses);
    }
  };

  const submitQuestionnaire = async (finalResponses: string[]) => {
    setLoading(true);
    try {
      const questionnaireData = {
        responses: finalResponses,
        completed_at: new Date().toISOString(),
      };

      console.log('Questionnaire data:', questionnaireData);

      setCompleted(true);
      setTimeout(onComplete, 2000);
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      alert('Failed to save questionnaire. Please try again.');
      setLoading(false);
    }
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="bg-gradient-to-r from-green-400 to-emerald-400 p-4 rounded-xl mb-6 inline-block">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {userName}!</h1>
          <p className="text-gray-600 mb-4">Thank you for completing the questionnaire.</p>
          <p className="text-sm text-gray-500">Setting up your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="bg-gradient-to-r from-rose-400 to-pink-400 p-3 rounded-xl">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              Welcome to Your Journey
            </h1>
          </div>
          <p className="text-gray-600 mb-6">
            Let's learn more about you to personalize your postpartum experience.
          </p>

          <div className="bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-gradient-to-r from-rose-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            Question {currentQuestion + 1} of {questions.length}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-8">{currentQ.question}</h2>

          <div className="space-y-3">
            {currentQ.options.map((option) => (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={loading}
                className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-rose-400 hover:bg-rose-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="font-medium text-gray-700">{option}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0 || loading}
              className="px-4 py-2 text-rose-600 hover:text-rose-700 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
            >
              Back
            </button>

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>
                {currentQuestion + 1}/{questions.length}
              </span>
            </div>

            <button
              onClick={() =>
                currentQuestion === questions.length - 1
                  ? submitQuestionnaire(responses)
                  : setCurrentQuestion(currentQuestion + 1)
              }
              disabled={responses[currentQuestion] === undefined || loading}
              className="flex items-center space-x-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
            >
              {currentQuestion === questions.length - 1 ? 'Complete' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="text-sm text-blue-800">
            <strong>Privacy Notice:</strong> Your responses are confidential and help us provide personalized support tailored to your unique postpartum journey.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
