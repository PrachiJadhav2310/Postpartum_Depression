import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Activity, Brain, TrendingUp, AlertCircle, Calendar, Clock, CheckCircle, Loader2, Phone, Shield, ArrowRight, Eye } from 'lucide-react';
import { authAPI, mentalHealthAPI, healthAPI } from '../services/api';
import { getRiskLevelLabel } from '../services/riskScoring';

interface DashboardProps {
  user: {
    id?: string;
    name?: string;
    fullName?: string;
  } | null;
}

interface HealthMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  change: number;
}

interface MoodEntry {
  id: string;
  date: string;
  mood: number;
  notes: string;
}

interface AssessmentData {
  score: number;
  risk_level: string;
  risk_percentage?: number;
  category_scores: { [key: string]: number };
  completed_at: string;
  responses?: any;
}

interface AssessmentHistoryItem {
  id: string;
  completed_at: string;
  score: number;
  risk_level: string;
  risk_percentage?: number | null;
}

interface RiskAction {
  type: 'self-care' | 'exercise' | 'consultation' | 'emergency';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([]);
  const [moodAnxietyTrend, setMoodAnxietyTrend] = useState<
    Array<{ rawTs: number; dateLabel: string; mood: number; anxiety: number; notes?: string }>
  >([]);
  const [sleepTrend, setSleepTrend] = useState<
    Array<{ rawTs: number; dateLabel: string; hours: number }>
  >([]);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [daysPostpartum, setDaysPostpartum] = useState<number | null>(null);
  const [showAssessmentDetails, setShowAssessmentDetails] = useState(false);
  const [assessmentRecommendations, setAssessmentRecommendations] = useState<string[]>([]);
  const [assessmentActions, setAssessmentActions] = useState<RiskAction[]>([]);
  const [riskPercentage, setRiskPercentage] = useState<number | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentHistoryItem[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id]);

  // Refresh dashboard when returning from assessment
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id && document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user?.id]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    // Force refresh by clearing any cached data
    setAssessment(null);
    setHealthMetrics([]);
    setRecentMoods([]);

    try {
      // Fetch user profile
      try {
        const userResponse = await authAPI.getCurrentUser();
        if (userResponse.success && userResponse.data.user) {
          const profileData = userResponse.data.user;
          // Calculate days postpartum
          if (profileData.birthDate) {
            const birthDate = new Date(profileData.birthDate);
            const today = new Date();
            const days = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24));
            setDaysPostpartum(days);
          } else if (profileData.dueDate) {
            const dueDate = new Date(profileData.dueDate);
            const today = new Date();
            const days = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            setDaysPostpartum(Math.max(0, days));
          }
        }
      } catch (err) {
        console.error('Profile error:', err);
      }

      // Fetch assessment history (latest first).
      // We use this to power both current state + progress timeline.
      try {
        const assessmentResponse = await mentalHealthAPI.getAssessments({ 
          limit: 10 
        });
        
        if (assessmentResponse.success && assessmentResponse.data?.assessments?.length > 0) {
          const historyMapped: AssessmentHistoryItem[] = assessmentResponse.data.assessments.map((item: any) => {
            let parsedResponses: any = {};
            try {
              parsedResponses = typeof item.responses === 'string'
                ? JSON.parse(item.responses)
                : (item.responses || {});
            } catch {
              parsedResponses = {};
            }

            const itemRiskPct =
              parsedResponses.risk_percentage ||
              parsedResponses.prediction?.riskPercentage ||
              null;

            return {
              id: String(item.id),
              completed_at: item.completed_at,
              score: item.score,
              risk_level: item.risk_level,
              risk_percentage: itemRiskPct,
            };
          });

          setAssessmentHistory(historyMapped);

          const assessmentData = assessmentResponse.data.assessments[0];
          let responses;
          
          try {
            responses = typeof assessmentData.responses === 'string' 
              ? JSON.parse(assessmentData.responses) 
              : assessmentData.responses;
          } catch (parseError) {
            console.warn('Failed to parse assessment responses:', parseError);
            responses = {};
          }
          
          // Check if this is a detailed assessment
          const isDetailedAssessment = assessmentData.assessment_type === 'custom' &&
                                      (responses.assessment_subtype === 'detailed_ppd' ||
                                       responses.assessment_type === 'detailed_ppd');
          void isDetailedAssessment;

          // Extract risk percentage if available (from prediction or responses)
          const riskPct = responses.risk_percentage || 
                         (responses.prediction?.riskPercentage) ||
                         null;
          setRiskPercentage(riskPct);
          
          // Extract recommendations and actions from responses if available
          if (responses.recommendations) {
            setAssessmentRecommendations(responses.recommendations);
          } else if (responses.prediction?.recommendations) {
            setAssessmentRecommendations(responses.prediction.recommendations.map((r: any) => r.message || r));
          }
          
          if (responses.actions) {
            setAssessmentActions(responses.actions);
          } else if (responses.prediction?.actions) {
            setAssessmentActions(responses.prediction.actions);
          }
          
          setAssessment({
            score: assessmentData.score,
            risk_level: assessmentData.risk_level,
            risk_percentage: riskPct,
            category_scores: responses.category_scores || {},
            completed_at: assessmentData.completed_at,
            responses: responses,
          });
        } else {
          // No assessment found - clear state
          setAssessment(null);
          setRiskPercentage(null);
          setAssessmentRecommendations([]);
          setAssessmentActions([]);
          setAssessmentHistory([]);
        }
      } catch (err) {
        console.error('Assessment fetch error:', err);
        // Don't set error state for assessment fetch - it's optional
      }

      // Fetch recent mood entries
      try {
        const moodResponse = await mentalHealthAPI.getMoodEntries({ limit: 14 });
        if (moodResponse.success && moodResponse.data?.moodEntries) {
          const mapped = moodResponse.data.moodEntries
            .map((entry: any) => ({
              id: entry.id,
              rawTs: new Date(entry.recorded_at).getTime(),
              dateLabel: new Date(entry.recorded_at).toLocaleDateString(),
              mood: Number(entry.mood_score ?? 0),
              anxiety: Number(entry.anxiety_level ?? 0),
              notes: entry.notes || 'No notes',
            }))
            .filter((p: any) => Number.isFinite(p.rawTs));

          const sortedAsc = [...mapped].sort((a, b) => a.rawTs - b.rawTs);
          const sortedDesc = [...mapped].sort((a, b) => b.rawTs - a.rawTs);

          setMoodAnxietyTrend(
            sortedAsc.map(({ rawTs, dateLabel, mood, anxiety, notes }) => ({
              rawTs,
              dateLabel,
              mood,
              anxiety,
              notes,
            }))
          );

          // Keep the existing UI list as "recent" (top 5).
          setRecentMoods(
            sortedDesc.slice(0, 5).map(({ id, dateLabel, mood, notes }: any) => ({
              id: String(id),
              date: dateLabel,
              mood,
              notes,
            }))
          );
        }
      } catch (err) {
        console.error('Mood entries fetch error:', err);
      }

      // Fetch recent health records for metrics
      try {
        const healthResponse = await healthAPI.getRecords({ limit: 20 });
        if (healthResponse.success && healthResponse.data?.records) {
          const healthData = healthResponse.data.records;
          const metricsMap = new Map<string, HealthMetric>();
          
          healthData.forEach((record: any) => {
            if (!metricsMap.has(record.record_type)) {
              const status = getHealthStatus(record.record_type, record.value);
              metricsMap.set(record.record_type, {
                id: record.record_type,
                name: formatRecordType(record.record_type),
                value: Math.round(record.value),
                unit: record.unit || '',
                status,
                change: 0,
              });
            }
          });

          if (metricsMap.size === 0) {
            setHealthMetrics([
              { id: 'heart_rate', name: 'Heart Rate', value: 0, unit: 'bpm', status: 'good', change: 0 },
              { id: 'blood_pressure', name: 'Blood Pressure', value: 0, unit: 'mmHg', status: 'good', change: 0 },
              { id: 'sleep', name: 'Sleep Quality', value: 0, unit: 'hours', status: 'good', change: 0 },
              { id: 'stress', name: 'Stress Level', value: 0, unit: '%', status: 'good', change: 0 },
            ]);
          } else {
            setHealthMetrics(Array.from(metricsMap.values()));
          }
        } else {
          setHealthMetrics([
            { id: 'heart_rate', name: 'Heart Rate', value: 0, unit: 'bpm', status: 'good', change: 0 },
            { id: 'blood_pressure', name: 'Blood Pressure', value: 0, unit: 'mmHg', status: 'good', change: 0 },
            { id: 'sleep', name: 'Sleep Quality', value: 0, unit: 'hours', status: 'good', change: 0 },
            { id: 'stress', name: 'Stress Level', value: 0, unit: '%', status: 'good', change: 0 },
          ]);
        }
      } catch (err) {
        console.error('Health records fetch error:', err);
        setHealthMetrics([
          { id: 'heart_rate', name: 'Heart Rate', value: 0, unit: 'bpm', status: 'good', change: 0 },
          { id: 'blood_pressure', name: 'Blood Pressure', value: 0, unit: 'mmHg', status: 'good', change: 0 },
          { id: 'sleep', name: 'Sleep Quality', value: 0, unit: 'hours', status: 'good', change: 0 },
          { id: 'stress', name: 'Stress Level', value: 0, unit: '%', status: 'good', change: 0 },
        ]);
      }

      // Fetch sleep trend series (hours over time)
      try {
        const sleepResponse = await healthAPI.getRecords({
          type: 'sleep_hours',
          limit: 30,
        });

        if (sleepResponse.success && Array.isArray(sleepResponse.data?.records)) {
          const mappedSleep = sleepResponse.data.records
            .map((record: any) => ({
              rawTs: new Date(record.recorded_at).getTime(),
              dateLabel: new Date(record.recorded_at).toLocaleDateString(),
              hours: Number(record.value ?? 0),
            }))
            .filter((p: any) => Number.isFinite(p.rawTs));

          const sortedAsc = mappedSleep.sort((a, b) => a.rawTs - b.rawTs);
          setSleepTrend(sortedAsc);
        }
      } catch (err) {
        console.error('Sleep trend fetch error:', err);
      }
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatus = (type: string, value: number): 'good' | 'warning' | 'critical' => {
    // Basic health status logic
    switch (type) {
      case 'heart_rate':
        return value >= 60 && value <= 100 ? 'good' : value >= 50 && value <= 110 ? 'warning' : 'critical';
      case 'blood_pressure_systolic':
        return value >= 90 && value <= 120 ? 'good' : value >= 80 && value <= 140 ? 'warning' : 'critical';
      default:
        return 'good';
    }
  };

  const formatRecordType = (type: string): string => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getMetricAction = (metricId: string) => {
    if (metricId.includes('sleep')) {
      return { tab: 'sleep', quickAdd: 'sleep', label: 'Log sleep' };
    }
    if (metricId.includes('water')) {
      return { tab: 'nutrition', quickAdd: 'water_intake', label: 'Add water intake' };
    }
    if (metricId.includes('temperature')) {
      return { tab: 'vitals', quickAdd: 'temperature', label: 'Add temperature' };
    }
    if (metricId.includes('heart_rate')) {
      return { tab: 'vitals', quickAdd: 'heart_rate', label: 'Add heart rate' };
    }
    if (metricId.includes('blood_pressure')) {
      return { tab: 'vitals', quickAdd: 'blood_pressure', label: 'Add blood pressure' };
    }
    if (metricId.includes('weight')) {
      return { tab: 'vitals', quickAdd: 'weight', label: 'Add weight' };
    }
    return { tab: 'vitals', quickAdd: '', label: 'Open tracking' };
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
    return <div className="h-4 w-4" />;
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      case 'mild': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'moderate': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'severe': return 'bg-red-100 text-red-800 border-red-300';
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  const getRiskLevelDisplayColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-green-500 text-white border-green-600';
      case 'mild': return 'bg-yellow-500 text-white border-yellow-600';
      case 'moderate': return 'bg-yellow-500 text-white border-yellow-600';
      case 'high': return 'bg-orange-500 text-white border-orange-600';
      case 'severe': return 'bg-red-600 text-white border-red-700';
      case 'critical': return 'bg-red-600 text-white border-red-700';
      default: return 'bg-gray-500 text-white border-gray-600';
    }
  };
  
  const handleActionClick = (action: RiskAction) => {
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
    } else if (action.type === 'emergency') {
      navigate('/emergency');
    }
  };
  
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'emergency': return <Phone className="h-5 w-5" />;
      case 'consultation': return <Heart className="h-5 w-5" />;
      case 'exercise': return <Brain className="h-5 w-5" />;
      case 'self-care': return <Activity className="h-5 w-5" />;
      default: return <CheckCircle className="h-5 w-5" />;
    }
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-green-500 bg-green-50';
    }
  };

  const getAssessmentRecommendations = (riskLevel: string, categoryScores: { [key: string]: number }) => {
    const recommendations: string[] = [];
    const highCategories = Object.entries(categoryScores)
      .filter(([_, score]) => score >= 8)
      .map(([category, _]) => category);

    if (riskLevel === 'severe' || riskLevel === 'high' || riskLevel === 'moderate') {
      recommendations.push('Consider speaking with a healthcare provider about your current wellbeing.');
    }

    if (highCategories.includes('anxiety')) {
      recommendations.push('Try deep breathing exercises or meditation to help manage anxiety.');
    }

    if (highCategories.includes('sleep_fatigue')) {
      recommendations.push('Focus on establishing a consistent sleep routine and rest when possible.');
    }

    if (highCategories.includes('support_system')) {
      recommendations.push('Reach out to friends, family, or support groups for connection.');
    }

    if (highCategories.includes('emotional_wellbeing')) {
      recommendations.push('Consider journaling or talking to someone about your feelings.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue maintaining your wellness routine. You\'re doing great!');
    }

    return recommendations;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-rose-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Use stored recommendations if available, otherwise generate them
  const recommendations = assessmentRecommendations.length > 0
    ? assessmentRecommendations
    : assessment
    ? getAssessmentRecommendations(assessment.risk_level, assessment.category_scores)
    : ['Complete your initial assessment to get personalized recommendations.'];

  const getRiskWeight = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 5;
      case 'severe': return 4;
      case 'high': return 4;
      case 'moderate': return 3;
      case 'mild': return 2;
      case 'low': return 1;
      default: return 2;
    }
  };

  const getRetakeSuggestion = (history: AssessmentHistoryItem[]) => {
    if (!history.length) {
      return {
        title: 'Complete your first assessment',
        detail: 'Take an assessment to start tracking your postpartum progress over time.',
        level: 'info',
      };
    }

    const latest = history[0];
    const previous = history[1] || null;
    const latestDate = new Date(latest.completed_at);
    const daysSinceLatest = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24));

    let trendLabel = 'stable';
    if (previous) {
      const latestScore = latest.risk_percentage ?? latest.score;
      const previousScore = previous.risk_percentage ?? previous.score;
      if (latestScore > previousScore + 3) trendLabel = 'worsening';
      else if (latestScore < previousScore - 3) trendLabel = 'improving';
    }

    const riskWeight = getRiskWeight(latest.risk_level);
    const dueDays =
      riskWeight >= 4 ? 7 :
      riskWeight === 3 ? 14 : 30;

    if (trendLabel === 'worsening' && daysSinceLatest >= 3) {
      return {
        title: 'Retake soon (trend worsening)',
        detail: `Your latest trend looks higher risk than before. Consider retaking within 3-5 days (last taken ${daysSinceLatest} day(s) ago).`,
        level: 'high',
      };
    }

    if (daysSinceLatest >= dueDays) {
      return {
        title: 'Time for a retake',
        detail: `Based on your current risk level (${latest.risk_level}), retake every ~${dueDays} days. You are at ${daysSinceLatest} days since last assessment.`,
        level: riskWeight >= 3 ? 'medium' : 'info',
      };
    }

    return {
      title: 'On track',
      detail: `Latest trend is ${trendLabel}. Next suggested retake in about ${Math.max(1, dueDays - daysSinceLatest)} day(s).`,
      level: 'good',
    };
  };

  const retakeSuggestion = getRetakeSuggestion(assessmentHistory);

  const renderLineTrendChart = (opts: {
    title: string;
    color: string; // tailwind class for stroke
    unit?: string;
    series: Array<{ dateLabel: string; value: number }>;
  }) => {
    const { title, color, unit, series } = opts;
    const width = 360;
    const height = 190;
    const pad = { left: 36, right: 14, top: 16, bottom: 30 };

    const values = series.map((p) => p.value);
    const hasData = series.length >= 1 && values.some((v) => Number.isFinite(v));

    const min = hasData ? Math.min(...values) : 0;
    const max = hasData ? Math.max(...values) : 1;
    const safeMin = min === max ? min - 1 : min;
    const safeMax = min === max ? max + 1 : max;
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;

    const xAt = (i: number) => {
      if (series.length <= 1) return pad.left + chartWidth / 2;
      const t = i / (series.length - 1);
      return pad.left + t * chartWidth;
    };

    const yAt = (v: number) => {
      const t = (safeMax - v) / (safeMax - safeMin);
      return pad.top + t * chartHeight;
    };

    const normalizedSeries =
      series.length === 1
        ? [
            { ...series[0], dateLabel: series[0].dateLabel },
            { ...series[0], dateLabel: series[0].dateLabel }
          ]
        : series;
    const points = normalizedSeries.map((p, i) => `${xAt(i)},${yAt(p.value)}`).join(' ');
    const last = series[series.length - 1];
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => safeMin + (safeMax - safeMin) * t);

    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {hasData ? (
              <p className="text-xs text-gray-600">
                Latest: <span className="font-semibold">{last.value}{unit ? ` ${unit}` : ''}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-600">No trend data yet</p>
            )}
          </div>
          {hasData && (
            <div className="text-xs font-medium text-gray-600">
              {series[0].dateLabel} → {series[series.length - 1].dateLabel}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg bg-gray-50">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px]">
            {/* Baseline + grid + y-axis ticks */}
            <line
              x1={pad.left}
              y1={height - pad.bottom}
              x2={width - pad.right}
              y2={height - pad.bottom}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
            {yTicks.map((tick, idx) => {
              const y = yAt(tick);
              return (
                <g key={`${title}-y-${idx}`}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={width - pad.right}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth={idx === 0 || idx === yTicks.length - 1 ? 1 : 0.8}
                  />
                  <text
                    x={6}
                    y={y + 4}
                    fontSize={10}
                    fill="#6b7280"
                  >
                    {tick.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {hasData ? (
              <>
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {normalizedSeries.map((p, i) => (
                  <g key={`${p.dateLabel}-${i}`}>
                    <circle
                      cx={xAt(i)}
                      cy={yAt(p.value)}
                      r={3.5}
                      fill={color}
                      stroke="white"
                      strokeWidth={2}
                    >
                      <title>
                        {p.dateLabel}: {p.value}
                        {unit ? ` ${unit}` : ''}
                      </title>
                    </circle>
                  </g>
                ))}
              </>
            ) : (
              <text
                x={width / 2}
                y={height / 2}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={12}
              >
                Track more entries to see trends
              </text>
            )}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl p-6 md:p-8 text-white mb-8 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {user?.fullName || user?.name || 'there'}! 🌸
            </h1>
            <p className="text-rose-100 mb-4">Here's your wellness overview for today</p>
            <div className="flex items-center space-x-4 text-rose-100">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">{currentTime.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{currentTime.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex gap-4">
            {daysPostpartum !== null && (
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <p className="text-sm text-rose-100">Days Postpartum</p>
                <p className="text-2xl font-bold">{daysPostpartum}</p>
              </div>
            )}
            {assessment && (
              <div className={`bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center border-2 ${getRiskLevelDisplayColor(assessment.risk_level).split(' ')[2]}`}>
                <p className="text-sm text-rose-100">Risk Score</p>
                <p className="text-2xl font-bold">
                  {riskPercentage !== null ? `${riskPercentage}%` : assessment.score}
                </p>
                <p className="text-xs text-rose-100 mt-1 capitalize">{assessment.risk_level}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assessment Results Card - Expandable */}
      {assessment && (
        <div className={`mb-8 rounded-xl border-2 overflow-hidden ${getRiskLevelColor(assessment.risk_level)}`}>
          {/* Header - Clickable to expand/collapse */}
          <div 
            className="p-6 cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setShowAssessmentDetails(!showAssessmentDetails)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <CheckCircle className="h-6 w-6" />
                  <div>
                    <h3 className="text-xl font-semibold">Assessment Results</h3>
                    <p className="text-sm opacity-90">
                      Completed on {new Date(assessment.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {/* Risk Score */}
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
                    <p className="text-xs opacity-90 mb-1">Risk Score</p>
                    <p className="text-3xl font-bold">
                      {riskPercentage !== null ? `${riskPercentage}%` : 'N/A'}
                    </p>
                  </div>
                  
                  {/* Risk Level */}
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
                    <p className="text-xs opacity-90 mb-1">Risk Level</p>
                    <p className="text-lg font-bold capitalize">{assessment.risk_level}</p>
                    <p className="text-xs opacity-75 mt-1">
                      {getRiskLevelLabel(assessment.risk_level).split(' - ')[1] || assessment.risk_level}
                    </p>
                  </div>
                  
                  {/* Total Score */}
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
                    <p className="text-xs opacity-90 mb-1">Total Score</p>
                    <p className="text-3xl font-bold">{assessment.score}</p>
                    <p className="text-xs opacity-75 mt-1">/ 72</p>
                  </div>
                  
                  {/* Categories */}
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
                    <p className="text-xs opacity-90 mb-1">Categories</p>
                    <p className="text-3xl font-bold">{Object.keys(assessment.category_scores).length}</p>
                    <p className="text-xs opacity-75 mt-1">Assessed</p>
                  </div>
                </div>
              </div>
              
              <button className="ml-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <Eye className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Expandable Details */}
          {showAssessmentDetails && (
            <div className="bg-white/95 p-6 border-t-2 border-gray-200">
              {/* Category Scores */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Category Scores Breakdown</h4>

                {/* Category Visualization Graph */}
                <div className="mb-5">
                  <h5 className="text-sm font-semibold text-gray-800 mb-3">Category Visualization</h5>
                  {assessment.category_scores && Object.keys(assessment.category_scores).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(assessment.category_scores).map(([category, score]) => {
                        const maxScore = 12;
                        const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100));
                        const statusColor =
                          percentage >= 67 ? 'bg-red-500' :
                          percentage >= 33 ? 'bg-yellow-500' :
                          'bg-green-500';

                        return (
                          <div key={category} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-medium text-gray-700 truncate">
                                {category.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs font-semibold text-gray-900">
                                {score} / {maxScore}
                              </p>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                              <div className={`h-3 rounded-full ${statusColor}`} style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No category visualization available.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Object.entries(assessment.category_scores).map(([category, score]) => {
                    const maxScore = 12;
                    const percentage = (score / maxScore) * 100;
                    const statusColor = percentage >= 67 ? 'bg-red-100 text-red-800 border-red-300' :
                                       percentage >= 33 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                       'bg-green-100 text-green-800 border-green-300';
                    
                    return (
                      <div key={category} className={`${statusColor} rounded-lg p-3 border-2 text-center`}>
                        <p className="text-xs font-medium mb-2 capitalize">
                          {category.replace(/_/g, ' ')}
                        </p>
                        <p className="text-2xl font-bold">{score}</p>
                        <p className="text-xs mt-1">/ {maxScore}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Personalized Recommendations */}
              {recommendations.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    Personalized Recommendations
                  </h4>
                  <div className="space-y-2">
                    {recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-rose-500 font-bold mt-1">•</span>
                        <p className="text-gray-700 flex-1">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Action Items */}
              {assessmentActions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Recommended Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assessmentActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleActionClick(action)}
                        className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${getPriorityColor(action.priority)}`}
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
                        <h5 className="font-semibold text-gray-900 mb-1">{action.title}</h5>
                        <p className="text-sm text-gray-600">{action.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Fallback: Generate actions if not stored */}
              {assessmentActions.length === 0 && assessment && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Recommended Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assessment.risk_level === 'critical' && (
                      <>
                        <button
                          onClick={() => window.location.href = 'tel:14416'}
                          className="p-4 rounded-lg border-2 border-red-500 bg-red-50 text-left transition-all hover:shadow-md"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="p-2 rounded-lg bg-red-500 text-white">
                                <Phone className="h-5 w-5" />
                              </div>
                              <span className="text-xs font-semibold px-2 py-1 rounded bg-red-200 text-red-800">
                                CRITICAL
                              </span>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400" />
                          </div>
                          <h5 className="font-semibold text-gray-900 mb-1">Call 14416 (Tele-MANAS)</h5>
                          <p className="text-sm text-gray-600">Immediate support available 24/7</p>
                        </button>
                        <button
                          onClick={() => navigate('/emergency')}
                          className="p-4 rounded-lg border-2 border-red-500 bg-red-50 text-left transition-all hover:shadow-md"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="p-2 rounded-lg bg-red-500 text-white">
                                <Shield className="h-5 w-5" />
                              </div>
                              <span className="text-xs font-semibold px-2 py-1 rounded bg-red-200 text-red-800">
                                CRITICAL
                              </span>
                            </div>
                            <ArrowRight className="h-5 w-5 text-gray-400" />
                          </div>
                          <h5 className="font-semibold text-gray-900 mb-1">View Emergency Resources</h5>
                          <p className="text-sm text-gray-600">Access all emergency contacts</p>
                        </button>
                      </>
                    )}
                    {assessment.risk_level === 'high' && (
                      <button
                        onClick={() => navigate('/emergency')}
                        className="p-4 rounded-lg border-2 border-orange-500 bg-orange-50 text-left transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 rounded-lg bg-orange-500 text-white">
                              <Heart className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-orange-200 text-orange-800">
                              HIGH
                            </span>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                        <h5 className="font-semibold text-gray-900 mb-1">Schedule Doctor Consultation</h5>
                        <p className="text-sm text-gray-600">Consult healthcare provider within 48 hours</p>
                      </button>
                    )}
                    {assessment.risk_level === 'moderate' && (
                      <button
                        onClick={() => navigate('/mental-health')}
                        className="p-4 rounded-lg border-2 border-yellow-500 bg-yellow-50 text-left transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 rounded-lg bg-yellow-500 text-white">
                              <Brain className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-yellow-200 text-yellow-800">
                              MEDIUM
                            </span>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                        <h5 className="font-semibold text-gray-900 mb-1">Try Guided Exercises</h5>
                        <p className="text-sm text-gray-600">Access meditation and breathing exercises</p>
                      </button>
                    )}
                    {assessment.risk_level === 'low' && (
                      <button
                        onClick={() => navigate('/education')}
                        className="p-4 rounded-lg border-2 border-green-500 bg-green-50 text-left transition-all hover:shadow-md"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 rounded-lg bg-green-500 text-white">
                              <Activity className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-200 text-green-800">
                              LOW
                            </span>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                        <h5 className="font-semibold text-gray-900 mb-1">View Self-Care Tips</h5>
                        <p className="text-sm text-gray-600">Continue your wellness journey</p>
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Assessment Actions */}
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/mental-health')}
                  className="px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-lg transition-all font-medium shadow-md hover:shadow-lg"
                >
                  View Full Assessment Details
                </button>
                <button
                  onClick={() => navigate('/detailed-assessment')}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center gap-3 border-2 border-blue-400"
                >
                  <Brain className="h-6 w-6" />
                  <span>🔄 RETAKE ASSESSMENT</span>
                </button>
              </div>
              
              {/* Last Assessment Date */}
              {assessment.completed_at && (
                <div className="mt-4 text-center">
                  <div className="text-sm text-gray-500 mb-2">
                    Last assessment: {new Date(assessment.completed_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      💡 Remember: Mental conditions can change over time
                    </p>
                    <p className="text-xs text-blue-700">
                      Retake the assessment whenever you feel your condition has changed to get the most accurate predictions.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {healthMetrics.length > 0 ? (
          healthMetrics.map((metric) => {
            const action = getMetricAction(metric.id);
            return (
            <button
              key={metric.id}
              onClick={() =>
                navigate(
                  `/health-tracking?tab=${encodeURIComponent(action.tab)}${
                    action.quickAdd ? `&quickAdd=${encodeURIComponent(action.quickAdd)}` : ''
                  }`
                )
              }
              className={`p-6 rounded-xl border-2 ${getStatusColor(metric.status)} shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-white rounded-lg">
                  {metric.name.includes('Heart') && <Heart className="h-5 w-5 text-rose-500" />}
                  {metric.name.includes('Blood') && <Activity className="h-5 w-5 text-blue-500" />}
                  {metric.name.includes('Sleep') && <Brain className="h-5 w-5 text-purple-500" />}
                  {metric.name.includes('Stress') && <AlertCircle className="h-5 w-5 text-orange-500" />}
                  {!metric.name.includes('Heart') && !metric.name.includes('Blood') && 
                   !metric.name.includes('Sleep') && !metric.name.includes('Stress') && 
                   <Activity className="h-5 w-5 text-gray-500" />}
                </div>
                {getChangeIcon(metric.change)}
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">{metric.name}</h3>
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-bold">
                  {metric.value > 0 ? metric.value : '--'}
                </span>
                {metric.value > 0 && <span className="text-sm text-gray-500">{metric.unit}</span>}
              </div>
              {metric.value === 0 && (
                <p className="text-xs mt-2 text-gray-500">
                  Start tracking to see your data
                </p>
              )}
            </button>
          )})
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500">
            <p>No health metrics recorded yet. Start tracking your health!</p>
          </div>
        )}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/mental-health')}
              className="p-4 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors text-left"
            >
              <div className="bg-rose-500 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
                <Heart className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-medium text-gray-900">Log Mood</h3>
              <p className="text-sm text-gray-600">Track your daily mood</p>
            </button>
            <button
              onClick={() => navigate('/health-tracking')}
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
            >
              <div className="bg-blue-500 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-medium text-gray-900">Add Symptoms</h3>
              <p className="text-sm text-gray-600">Record any symptoms</p>
            </button>
            <button
              onClick={() => navigate('/mental-health')}
              className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left"
            >
              <div className="bg-purple-500 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-medium text-gray-900">Meditation</h3>
              <p className="text-sm text-gray-600">Start guided session</p>
            </button>
            <button
              onClick={() => navigate('/health-tracking')}
              className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
            >
              <div className="bg-green-500 w-8 h-8 rounded-lg flex items-center justify-center mb-2">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <h3 className="font-medium text-gray-900">View Progress</h3>
              <p className="text-sm text-gray-600">See your journey</p>
            </button>
          </div>
        </div>

        {/* Recent Mood Entries */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Mood Entries</h2>
          {recentMoods.length > 0 ? (
            <>
              <div className="space-y-4">
                {recentMoods.map((entry) => (
                  <div key={entry.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                          entry.mood >= 8
                            ? 'bg-green-500'
                            : entry.mood >= 6
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                      >
                        {entry.mood}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{entry.date}</p>
                      <p className="text-sm text-gray-600 truncate">{entry.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/mental-health')}
                className="w-full mt-4 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors font-medium"
              >
                View All Entries
              </button>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No mood entries yet</p>
              <button
                onClick={() => navigate('/mental-health')}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors font-medium"
              >
                Log Your First Mood
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Trends Over Time */}
      <div className="mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Trends Over Time</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {renderLineTrendChart({
              title: 'Mood',
              color: '#10b981',
              series: moodAnxietyTrend.map((p) => ({ dateLabel: p.dateLabel, value: p.mood })),
            })}
            {renderLineTrendChart({
              title: 'Anxiety',
              color: '#8b5cf6',
              series: moodAnxietyTrend.map((p) => ({ dateLabel: p.dateLabel, value: p.anxiety })),
            })}
            {renderLineTrendChart({
              title: 'Sleep (hours)',
              color: '#3b82f6',
              unit: 'hrs',
              series: sleepTrend.map((p) => ({ dateLabel: p.dateLabel, value: p.hours })),
            })}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Hover points in the charts to see exact values.
          </p>
        </div>
      </div>

      {/* Assessment Progress Tracking */}
      {assessmentHistory.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Assessment Progress Tracking</h2>

          <div className={`rounded-lg p-4 mb-5 border ${
            retakeSuggestion.level === 'high'
              ? 'bg-red-50 border-red-200'
              : retakeSuggestion.level === 'medium'
              ? 'bg-yellow-50 border-yellow-200'
              : retakeSuggestion.level === 'good'
              ? 'bg-green-50 border-green-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{retakeSuggestion.title}</h3>
            <p className="text-sm text-gray-700">{retakeSuggestion.detail}</p>
          </div>

          <div className="space-y-4">
            {assessmentHistory.slice(0, 6).map((item, idx) => (
              <div key={item.id} className="flex items-start gap-4">
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-3 h-3 rounded-full ${
                    idx === 0 ? 'bg-rose-500' : 'bg-gray-400'
                  }`} />
                  {idx < Math.min(assessmentHistory.length, 6) - 1 && (
                    <div className="w-px h-10 bg-gray-300 mt-1" />
                  )}
                </div>

                <div className="flex-1 rounded-lg border border-gray-200 p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {idx === 0 ? 'Latest Assessment' : `Assessment #${assessmentHistory.length - idx}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-700">
                      Risk: <strong className="capitalize">{item.risk_level}</strong>
                    </span>
                    <span className="text-gray-700">
                      Score: <strong>{item.risk_percentage !== null && item.risk_percentage !== undefined ? `${item.risk_percentage}%` : item.score}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalized Recommendations */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-lg mb-8">
        <h2 className="text-xl font-semibold mb-3">💝 Personalized Wellness Recommendations</h2>
        <div className="space-y-2 mb-4">
          {recommendations.map((rec, index) => (
            <p key={index} className="text-purple-100 leading-relaxed flex items-start">
              <span className="mr-2">•</span>
              <span>{rec}</span>
            </p>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/education')}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Learn More
          </button>
          {!assessment && (
            <button
              onClick={() => navigate('/detailed-assessment')}
              className="bg-white text-blue-600 hover:bg-white/90 px-6 py-3 rounded-lg transition-all font-bold text-base shadow-lg hover:shadow-xl border-2 border-white"
            >
              Complete Assessment
            </button>
          )}
          {assessment && (
            <button
              onClick={() => navigate('/detailed-assessment')}
              className="bg-white text-blue-600 hover:bg-white/90 px-6 py-3 rounded-lg transition-all font-bold text-base shadow-lg hover:shadow-xl border-2 border-white flex items-center gap-2"
            >
              <Brain className="h-5 w-5" />
              <span>🔄 RETAKE ASSESSMENT</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
