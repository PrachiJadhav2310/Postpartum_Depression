import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Heart, 
  Brain, 
  Activity, 
  Book, 
  CheckCircle,
  ArrowRight,
  Shield
} from 'lucide-react';
import { RiskScoreResult, getRiskLevelColor, getRiskLevelLabel } from '../services/riskScoring';

interface RiskResponseProps {
  riskResult: RiskScoreResult;
  userName: string;
  onClose?: () => void;
}

const RiskResponse: React.FC<RiskResponseProps> = ({ riskResult, userName, onClose }) => {
  const navigate = useNavigate();
  const { riskPercentage, riskLevel, recommendations, actions, emergencyContact } = riskResult;

  const handleActionClick = (action: typeof actions[0]) => {
    if (action.actionUrl) {
      if (action.actionUrl.startsWith('tel:')) {
        window.location.href = action.actionUrl;
      } else {
        window.open(action.actionUrl, '_blank');
      }
    } else if (action.type === 'exercise') {
      navigate('/mental-health');
    } else if (action.type === 'consultation') {
      navigate('/emergency');
    } else if (action.type === 'self-care') {
      navigate('/education');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-green-500 bg-green-50';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <Phone className="h-5 w-5" />;
      case 'consultation':
        return <Heart className="h-5 w-5" />;
      case 'exercise':
        return <Brain className="h-5 w-5" />;
      case 'self-care':
        return <Activity className="h-5 w-5" />;
      default:
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Emergency Banner */}
      {emergencyContact && (
        <div className="mb-6 bg-red-600 text-white rounded-xl p-6 shadow-lg border-2 border-red-700 animate-pulse">
          <div className="flex items-start space-x-4">
            <AlertTriangle className="h-8 w-8 flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">IMMEDIATE SUPPORT AVAILABLE</h2>
              <p className="text-lg mb-4">
                Your responses indicate you may need immediate support. Please reach out to one of these resources right now:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="tel:14416"
                  className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <Phone className="h-5 w-5" />
                  <span>Call 14416 (Tele-MANAS)</span>
                </a>
                <a
                  href="tel:112"
                  className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <Phone className="h-5 w-5" />
                  <span>Call 112 (Emergency)</span>
                </a>
                <a
                  href="sms:18008914416?body=I%20need%20urgent%20mental%20health%20support"
                  className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <MessageSquare className="h-5 w-5" />
                  <span>SMS Tele-MANAS</span>
                </a>
                <button
                  onClick={() => navigate('/emergency')}
                  className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center justify-center space-x-2"
                >
                  <Shield className="h-5 w-5" />
                  <span>View Emergency Resources</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Score Display */}
      <div className={`mb-8 rounded-2xl p-8 text-white shadow-lg border-2 ${getRiskLevelColor(riskLevel)}`}>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Assessment Complete</h1>
          <p className="text-xl mb-6 opacity-90">Thank you for completing your assessment, {userName}</p>
          
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 inline-block mb-4">
            <p className="text-sm opacity-90 mb-2">Risk Score</p>
            <p className="text-6xl font-bold">{riskPercentage}%</p>
          </div>
          
          <div className="mt-4">
            <p className="text-lg font-semibold">{getRiskLevelLabel(riskLevel)}</p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center">
          <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
          Recommendations
        </h2>
        <div className="space-y-3">
          {recommendations && recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-rose-500 font-bold mt-1">•</span>
                <p className="text-gray-700 flex-1">{typeof rec === 'string' ? rec : (rec.message || rec.title || '')}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic">No specific recommendations at this time.</p>
          )}
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Recommended Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions && actions.length > 0 ? (
            actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={`p-5 rounded-lg border-2 text-left transition-all hover:shadow-md ${getPriorityColor(action.priority)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-lg ${
                    action.priority === 'critical' ? 'bg-red-500' :
                    action.priority === 'high' ? 'bg-orange-500' :
                    action.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  } text-white`}>
                    {getActionIcon(action.type)}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    action.priority === 'critical' ? 'bg-red-200 text-red-800' :
                    action.priority === 'high' ? 'bg-orange-200 text-orange-800' :
                    action.priority === 'medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'
                  }`}>
                    {action.priority.toUpperCase()}
                  </span>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
              <p className="text-sm text-gray-600">{action.description || action.message || ''}</p>
            </button>
            ))
          ) : (
            <p className="text-gray-500 italic col-span-2">No specific actions required at this time.</p>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Category Visualization</h2>
        {riskResult.categoryScores && Object.keys(riskResult.categoryScores).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(riskResult.categoryScores).map(([category, score]) => {
              const maxScore = 12;
              const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100));
              const statusColor =
                percentage >= 67
                  ? { bg: 'bg-red-500', fg: 'text-red-900' }
                  : percentage >= 33
                  ? { bg: 'bg-yellow-500', fg: 'text-yellow-900' }
                  : { bg: 'bg-green-500', fg: 'text-green-900' };

              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {category.replace(/_/g, ' ')}
                    </p>
                    <p className={`text-sm font-semibold ${statusColor.fg}`}>
                      {score} / {maxScore}
                    </p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full ${statusColor.bg}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 italic">Category visualization not available.</p>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Category Scores</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {riskResult.categoryScores && Object.keys(riskResult.categoryScores).length > 0 ? (
            Object.entries(riskResult.categoryScores).map(([category, score]) => {
            const maxScore = 12;
            const percentage = (score / maxScore) * 100;
            const statusColor = percentage >= 67 ? 'bg-red-100 text-red-800' :
                               percentage >= 33 ? 'bg-yellow-100 text-yellow-800' :
                               'bg-green-100 text-green-800';
            
            return (
              <div key={category} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-600 mb-2 capitalize">
                  {category.replace(/_/g, ' ')}
                </p>
                <div className={`text-2xl font-bold mb-1 ${statusColor} rounded-lg p-2`}>
                  {score}
                </div>
                <p className="text-xs text-gray-500">/ {maxScore}</p>
              </div>
            );
            })
          ) : (
            <p className="text-gray-500 italic col-span-6">Category scores not available.</p>
          )}
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-lg">
        <h2 className="text-xl font-semibold mb-3">Next Steps</h2>
        <p className="text-purple-100 mb-4">
          {riskLevel === 'critical' || riskLevel === 'high' 
            ? 'Please prioritize your wellbeing and reach out for support. You are not alone in this journey.'
            : riskLevel === 'moderate'
            ? 'Continue monitoring your wellbeing and consider re-taking this assessment in 1-2 weeks.'
            : 'Continue with your self-care routine and remember that support is always available if needed.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (onClose) {
                onClose();
              } else {
                navigate('/');
              }
            }}
            className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition-colors font-medium"
          >
            Go to Dashboard
          </button>
          {riskLevel !== 'critical' && riskLevel !== 'high' && (
            <button
              onClick={() => navigate('/mental-health')}
              className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition-colors font-medium"
            >
              View Mental Health Resources
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskResponse;

