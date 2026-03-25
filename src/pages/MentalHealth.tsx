import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Heart, Smile, AlertTriangle, TrendingUp, Play, Book, Users, Loader2, CheckCircle, RefreshCw, Calendar, Clock, Download, Languages, Bell } from 'lucide-react';
import { mentalHealthAPI, getAccessToken } from '../services/api';

interface MoodEntry {
  id?: string;
  date: string;
  mood: number;
  energy: number;
  anxiety: number;
  notes: string;
  recorded_at?: string;
}

interface AssessmentHistoryItem {
  id?: string;
  completed_at?: string;
  created_at?: string;
  risk_level?: string;
  assessment_type?: string;
  score?: number | string;
}

interface MoodEntryApiRow {
  id?: string;
  recorded_at?: string;
  created_at?: string;
  mood_score: number;
  energy_level: number;
  anxiety_level: number;
  notes?: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const MentalHealth: React.FC = () => {
  const navigate = useNavigate();
  type Lang = 'en' | 'hi' | 'mr';
  const [lang, setLang] = useState<Lang>('en');
  const i18n: Record<Lang, Record<string, string>> = {
    en: {
      title: 'Mental Health Support',
      subtitle: 'Your mental health matters. Track your mood, access resources, and get the support you need.',
      moodTracker: 'Mood Tracker',
      assessment: 'Assessment',
      resources: 'Resources',
      exportReport: 'Export Report',
      reminder: 'Reminder: You have not logged mood in the last 2+ days.',
      crisis: 'Immediate Support Recommended',
      language: 'Language',
      logMood: "Log Today's Mood",
      saveEntry: 'Save Entry',
      saving: 'Saving...',
      recentMoodHistory: 'Recent Mood History',
      refresh: 'Refresh',
      noMoodEntries: 'No mood entries yet. Log your first entry above!',
      moodTrendLine: 'Mood Trend (Line Chart)',
      moodTrendHint: 'The line shows day-to-day mood direction. Higher points indicate better mood.',
      recommendations: 'Personalized Recommendations',
      journalInsights: 'Journal Insights',
      addNotesForInsights: 'Add notes in mood entries to generate insights.',
      followUpActions: 'Follow-up Actions',
      assessmentHistory: 'Assessment History',
      quickAssessment: 'Quick Assessment',
      detailedAssessment: 'TAKE DETAILED ASSESSMENT',
      crisisResources: 'Crisis Resources',
      noDataYet: 'No data yet'
    },
    hi: {
      title: 'मानसिक स्वास्थ्य सहायता',
      subtitle: 'आपका मानसिक स्वास्थ्य महत्वपूर्ण है। अपने मूड को ट्रैक करें और सहायता प्राप्त करें।',
      moodTracker: 'मूड ट्रैकर',
      assessment: 'आकलन',
      resources: 'संसाधन',
      exportReport: 'रिपोर्ट डाउनलोड करें',
      reminder: 'रिमाइंडर: आपने पिछले 2+ दिनों से मूड लॉग नहीं किया है।',
      crisis: 'तुरंत सहायता की सिफारिश',
      language: 'भाषा',
      logMood: 'आज का मूड दर्ज करें',
      saveEntry: 'एंट्री सेव करें',
      saving: 'सेव हो रहा है...',
      recentMoodHistory: 'हाल का मूड इतिहास',
      refresh: 'रीफ्रेश',
      noMoodEntries: 'अभी कोई मूड एंट्री नहीं है। ऊपर अपनी पहली एंट्री दर्ज करें!',
      moodTrendLine: 'मूड ट्रेंड (लाइन चार्ट)',
      moodTrendHint: 'लाइन दिन-प्रतिदिन मूड का रुझान दिखाती है। ऊँचे बिंदु बेहतर मूड दर्शाते हैं।',
      recommendations: 'व्यक्तिगत सुझाव',
      journalInsights: 'जर्नल इनसाइट्स',
      addNotesForInsights: 'इनसाइट्स के लिए मूड एंट्री में नोट्स जोड़ें।',
      followUpActions: 'फॉलो-अप कार्य',
      assessmentHistory: 'आकलन इतिहास',
      quickAssessment: 'त्वरित आकलन',
      detailedAssessment: 'विस्तृत आकलन लें',
      crisisResources: 'संकट संसाधन',
      noDataYet: 'अभी डेटा नहीं है'
    },
    mr: {
      title: 'मानसिक आरोग्य सहाय्य',
      subtitle: 'तुमचे मानसिक आरोग्य महत्त्वाचे आहे. मूड ट्रॅक करा आणि योग्य मदत मिळवा.',
      moodTracker: 'मूड ट्रॅकर',
      assessment: 'मूल्यांकन',
      resources: 'संसाधने',
      exportReport: 'रिपोर्ट डाउनलोड करा',
      reminder: 'रिमाइंडर: गेल्या 2+ दिवसांत तुम्ही मूड नोंदवलेला नाही.',
      crisis: 'तातडीची मदत शिफारसीय',
      language: 'भाषा',
      logMood: 'आजचा मूड नोंदवा',
      saveEntry: 'नोंद जतन करा',
      saving: 'जतन करत आहे...',
      recentMoodHistory: 'अलीकडील मूड इतिहास',
      refresh: 'रिफ्रेश',
      noMoodEntries: 'अजून मूड नोंदी नाहीत. वर तुमची पहिली नोंद करा!',
      moodTrendLine: 'मूड ट्रेंड (लाइन चार्ट)',
      moodTrendHint: 'रेषा दिवसागणिक मूडचा कल दाखवते. जास्त बिंदू म्हणजे चांगला मूड.',
      recommendations: 'वैयक्तिक शिफारसी',
      journalInsights: 'जर्नल अंतर्दृष्टी',
      addNotesForInsights: 'अंतर्दृष्टीसाठी मूड नोंदींमध्ये टिपणे जोडा.',
      followUpActions: 'फॉलो-अप कृती',
      assessmentHistory: 'मूल्यांकन इतिहास',
      quickAssessment: 'झटपट मूल्यांकन',
      detailedAssessment: 'तपशीलवार मूल्यांकन घ्या',
      crisisResources: 'संकट संसाधने',
      noDataYet: 'अद्याप डेटा नाही'
    }
  };
  const t = i18n[lang];
  const moodStorageKey = useMemo(() => {
    try {
      const token = getAccessToken();
      if (!token) return 'mh_mood_logs_guest';
      const parts = token.split('.');
      if (parts.length !== 3) return 'mh_mood_logs_guest';
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const userId = payload?.sub || payload?.id || 'guest';
      return `mh_mood_logs_${userId}`;
    } catch {
      return 'mh_mood_logs_guest';
    }
  }, []);
  const followUpStorageKey = useMemo(() => `${moodStorageKey}_follow_up_actions`, [moodStorageKey]);
  const [activeTab, setActiveTab] = useState('mood');
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentType, setAssessmentType] = useState<'quick' | 'phq9' | 'gad7'>('quick');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [assessmentScore, setAssessmentScore] = useState(0);
  const [assessmentResponses, setAssessmentResponses] = useState<number[]>([]);
  const [showIntervention, setShowIntervention] = useState(false);
  const [breathingStep, setBreathingStep] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [breathingSecondsLeft, setBreathingSecondsLeft] = useState(120);
  const [followUpActions, setFollowUpActions] = useState<Record<string, boolean>>({
    breathing: false,
    consult: false,
    support: false
  });
  const [showReminder, setShowReminder] = useState(false);
  
  // Mood entry form state
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [anxietyLevel, setAnxietyLevel] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [savingMood, setSavingMood] = useState(false);
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [moodSuccess, setMoodSuccess] = useState(false);
  const [assessmentSuccess, setAssessmentSuccess] = useState(false);
  
  // Mood entries from backend
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([]);
  const [loadingMoods, setLoadingMoods] = useState(true);
  
  // Assessment history
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentHistoryItem[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  const quickQuestions = [
    "Over the past 2 weeks, how often have you felt down, depressed, or hopeless?",
    "How often have you had little interest or pleasure in doing things?",
    "How often have you had trouble falling or staying asleep?",
    "How often have you felt tired or had little energy?",
    "How often have you felt bad about yourself or that you are a failure?",
  ];
  const phq9Questions = [
    "Little interest or pleasure in doing things?",
    "Feeling down, depressed, or hopeless?",
    "Trouble falling/staying asleep, or sleeping too much?",
    "Feeling tired or having little energy?",
    "Poor appetite or overeating?",
    "Feeling bad about yourself — or that you are a failure?",
    "Trouble concentrating on things?",
    "Moving/speaking slowly or being very restless?",
    "Thoughts that you would be better off dead or self-harm?"
  ];
  const gad7Questions = [
    "Feeling nervous, anxious, or on edge?",
    "Not being able to stop or control worrying?",
    "Worrying too much about different things?",
    "Trouble relaxing?",
    "Being so restless that it is hard to sit still?",
    "Becoming easily annoyed or irritable?",
    "Feeling afraid as if something awful might happen?"
  ];

  const answerOptions = [
    { value: 0, label: "Not at all" },
    { value: 1, label: "Several days" },
    { value: 2, label: "More than half the days" },
    { value: 3, label: "Nearly every day" },
  ];

  useEffect(() => {
    const saved = localStorage.getItem(followUpStorageKey);
    if (saved) {
      try {
        setFollowUpActions(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, [followUpStorageKey]);

  useEffect(() => {
    localStorage.setItem(followUpStorageKey, JSON.stringify(followUpActions));
  }, [followUpActions, followUpStorageKey]);

  useEffect(() => {
    if (recentMoods.length === 0) return;
    const latest = recentMoods[0];
    const latestDate = new Date(latest.recorded_at || latest.date);
    const diffDays = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
    setShowReminder(diffDays >= 2);
  }, [recentMoods]);

  useEffect(() => {
    if (!showIntervention) return;
    const sequence: Array<'inhale' | 'hold' | 'exhale'> = ['inhale', 'hold', 'exhale'];
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % sequence.length;
      setBreathingStep(sequence[index]);
    }, 3000);
    return () => clearInterval(timer);
  }, [showIntervention]);

  useEffect(() => {
    if (!showIntervention) return;
    setBreathingSecondsLeft(120);
    const countdown = setInterval(() => {
      setBreathingSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          setShowIntervention(false);
          setFollowUpActions((actions) => ({ ...actions, breathing: true }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [showIntervention]);

  const activeQuestions =
    assessmentType === 'phq9' ? phq9Questions : assessmentType === 'gad7' ? gad7Questions : quickQuestions;

  const fetchMoodEntries = useCallback(async () => {
    try {
      setLoadingMoods(true);
      const response = await mentalHealthAPI.getMoodEntries({ limit: 10 });
      if (response.success && response.data?.moodEntries) {
        const entries = (response.data.moodEntries as MoodEntryApiRow[]).map((entry) => ({
          id: entry.id,
          date: new Date(entry.recorded_at || entry.created_at || Date.now()).toLocaleDateString(),
          mood: entry.mood_score,
          energy: entry.energy_level,
          anxiety: entry.anxiety_level,
          notes: entry.notes || '',
          recorded_at: entry.recorded_at || entry.created_at,
        }));
        setRecentMoods(entries);
        localStorage.setItem(moodStorageKey, JSON.stringify(entries));
      }
    } catch (error) {
      console.error('Error fetching mood entries:', error);
      // Fallback to user-scoped local cache.
      try {
        const cached = localStorage.getItem(moodStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setRecentMoods(parsed);
          }
        }
      } catch {
        // ignore cache errors
      }
    } finally {
      setLoadingMoods(false);
    }
  }, [moodStorageKey]);

  const fetchAssessmentHistory = useCallback(async () => {
    try {
      setLoadingAssessments(true);
      const response = await mentalHealthAPI.getAssessments({ limit: 10 });
      if (response.success && response.data?.assessments) {
        setAssessmentHistory(response.data.assessments as AssessmentHistoryItem[]);
      }
    } catch (error) {
      console.error('Error fetching assessment history:', error);
    } finally {
      setLoadingAssessments(false);
    }
  }, []);

  // Fetch mood/assessment data when tab changes.
  useEffect(() => {
    if (activeTab === 'mood') {
      // Hydrate immediately from user-scoped local cache for fast refresh UX.
      try {
        const cached = localStorage.getItem(moodStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentMoods(parsed);
          }
        }
      } catch {
        // ignore cache errors
      }
      fetchMoodEntries();
    } else if (activeTab === 'assessment') {
      fetchAssessmentHistory();
    }
  }, [activeTab, fetchMoodEntries, fetchAssessmentHistory, moodStorageKey]);

  const resources = [
    {
      title: "Postpartum Depression Guide",
      description: "Comprehensive information about postpartum depression symptoms and treatment options.",
      type: "article",
      duration: "10 min read",
      icon: Book,
    },
    {
      title: "New Mother Support Group",
      description: "Connect with other new mothers facing similar challenges in a safe, supportive environment.",
      type: "community",
      duration: "Join now",
      icon: Users,
    },
    {
      title: "Relaxation Exercises",
      description: "Guided breathing and mindfulness exercises designed for new mothers.",
      type: "audio",
      duration: "5-15 min",
      icon: Play,
    },
  ];

  const handleAnswerSelect = async (value: number) => {
    const newResponses = [...assessmentResponses, value];
    setAssessmentResponses(newResponses);
    setAssessmentScore(prev => prev + value);
    
    if (currentQuestion < activeQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // Assessment complete - save to backend
      setCurrentQuestion(activeQuestions.length);
      await saveAssessment(newResponses, assessmentScore + value);
    }
  };

  const saveAssessment = async (responses: number[], finalScore: number) => {
    try {
      setSavingAssessment(true);
      const interpretation = getScoreInterpretation(finalScore);
      
      const response = await mentalHealthAPI.submitAssessment({
        assessmentType: assessmentType === 'quick' ? 'custom' : assessmentType,
        responses: responses,
        notes: `Score: ${finalScore}. ${interpretation.level} Risk Level - ${interpretation.message}`,
      });

      if (response.success) {
        setAssessmentSuccess(true);
        setTimeout(() => {
          setShowAssessment(false);
          setCurrentQuestion(0);
          setAssessmentScore(0);
          setAssessmentResponses([]);
          setAssessmentSuccess(false);
          setSavingAssessment(false);
        }, 3000);
      } else {
        throw new Error(response.message || 'Failed to save assessment');
      }
    } catch (error: unknown) {
      console.error('Error saving assessment:', error);
      alert(getErrorMessage(error, 'Failed to save assessment. Please try again.'));
      setCurrentQuestion(0);
      setSavingAssessment(false);
    }
  };

  const handleResourceAccess = (resourceType: string) => {
    if (resourceType === 'community') {
      navigate('/community');
      return;
    }
    // article/audio currently live under education resources.
    navigate('/education');
  };

  const openAssessmentModal = (type?: 'quick' | 'phq9' | 'gad7') => {
    if (type) {
      setAssessmentType(type);
    }
    setShowAssessment(true);
    setCurrentQuestion(0);
    setAssessmentScore(0);
    setAssessmentResponses([]);
    setAssessmentSuccess(false);
    setSavingAssessment(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSaveMoodEntry = async () => {
    if (moodScore === null || energyLevel === null || anxietyLevel === null) {
      alert('Please select values for mood, energy, and anxiety levels');
      return;
    }

    try {
      setSavingMood(true);
      const response = await mentalHealthAPI.addMoodEntry({
        moodScore,
        energyLevel,
        anxietyLevel,
        notes: notes.trim() || undefined,
      });

      if (response.success) {
        setMoodSuccess(true);
        const newEntry: MoodEntry = {
          date: new Date().toLocaleDateString(),
          mood: moodScore,
          energy: energyLevel,
          anxiety: anxietyLevel,
          notes: notes.trim() || '',
          recorded_at: new Date().toISOString()
        };
        setRecentMoods((prev) => {
          const updated = [newEntry, ...prev].slice(0, 30);
          localStorage.setItem(moodStorageKey, JSON.stringify(updated));
          return updated;
        });
        // Reset form
        setMoodScore(null);
        setEnergyLevel(null);
        setAnxietyLevel(null);
        setNotes('');
        // Refresh mood entries
        await fetchMoodEntries();
        // Hide success message after 3 seconds
        setTimeout(() => {
          setMoodSuccess(false);
        }, 3000);
      } else {
        throw new Error(response.message || 'Failed to save mood entry');
      }
    } catch (error: unknown) {
      console.error('Error saving mood entry:', error);
      alert(getErrorMessage(error, 'Failed to save mood entry. Please try again.'));
    } finally {
      setSavingMood(false);
    }
  };

  const getMoodColor = (mood: number) => {
    if (mood >= 8) return 'bg-green-500';
    if (mood >= 6) return 'bg-yellow-500';
    if (mood >= 4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreInterpretation = (score: number) => {
    if (assessmentType === 'gad7') {
      if (score <= 4) return { level: 'Low', color: 'text-green-600', message: 'Minimal anxiety symptoms.' };
      if (score <= 9) return { level: 'Mild', color: 'text-yellow-600', message: 'Mild anxiety symptoms.' };
      if (score <= 14) return { level: 'Moderate', color: 'text-orange-600', message: 'Moderate anxiety symptoms. Consider professional support.' };
      return { level: 'Severe', color: 'text-red-600', message: 'Severe anxiety symptoms. Please seek help soon.' };
    }
    if (score <= 5) return { level: 'Low', color: 'text-green-600', message: 'Your responses suggest minimal depression symptoms.' };
    if (score <= 10) return { level: 'Mild', color: 'text-yellow-600', message: 'Your responses suggest mild depression symptoms. Consider speaking with a healthcare provider.' };
    if (score <= 15) return { level: 'Moderate', color: 'text-orange-600', message: 'Your responses suggest moderate depression symptoms. We recommend consulting with a healthcare professional.' };
    return { level: 'Severe', color: 'text-red-600', message: 'Your responses suggest severe depression symptoms. Please reach out to a healthcare provider immediately.' };
  };

  const moodTrendData = recentMoods
    .slice()
    .reverse()
    .map((m) => ({
      label: new Date(m.recorded_at || m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: m.mood
    }));
  const anxietyTrend = recentMoods.slice().reverse().map((m) => m.anxiety);
  const energyTrend = recentMoods.slice().reverse().map((m) => m.energy);

  const renderMoodLineChart = () => {
    if (moodTrendData.length === 0) {
      return <p className="text-xs text-gray-400">{t.noDataYet}</p>;
    }

    const width = 720;
    const height = 220;
    const paddingX = 36;
    const paddingTop = 18;
    const paddingBottom = 44;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingTop - paddingBottom;

    const pointX = (index: number) =>
      moodTrendData.length === 1
        ? width / 2
        : paddingX + (index * usableWidth) / (moodTrendData.length - 1);
    const pointY = (value: number) => paddingTop + ((10 - value) / 10) * usableHeight;

    const linePoints = moodTrendData.map((point, index) => `${pointX(index)},${pointY(point.value)}`).join(' ');

    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
          {[0, 2, 4, 6, 8, 10].map((tick) => (
            <g key={`tick-${tick}`}>
              <line
                x1={paddingX}
                y1={pointY(tick)}
                x2={width - paddingX}
                y2={pointY(tick)}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <text x={8} y={pointY(tick) + 4} fontSize="10" fill="#6B7280">
                {tick}
              </text>
            </g>
          ))}

          <polyline
            points={linePoints}
            fill="none"
            stroke="#F43F5E"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {moodTrendData.map((point, index) => (
            <g key={`mood-line-point-${index}`}>
              <circle cx={pointX(index)} cy={pointY(point.value)} r="4" fill="#F43F5E" />
              <circle cx={pointX(index)} cy={pointY(point.value)} r="8" fill="transparent">
                <title>{`${point.label}: ${point.value}/10`}</title>
              </circle>
              <text x={pointX(index)} y={height - 14} textAnchor="middle" fontSize="10" fill="#6B7280">
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  const renderTrendBars = (label: string, values: number[]) => (
    <div className="mb-4">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex items-end space-x-1 h-20">
        {values.length === 0 ? (
          <p className="text-xs text-gray-400">{t.noDataYet}</p>
        ) : (
          values.map((value, idx) => (
            <div
              key={`${label}-${idx}`}
              className="flex-1 bg-rose-300 rounded-t"
              style={{ height: `${Math.max(10, value * 10)}%` }}
              title={`${label}: ${value}/10`}
            />
          ))
        )}
      </div>
    </div>
  );

  const avgMood = recentMoods.length > 0 ? recentMoods.reduce((s, e) => s + e.mood, 0) / recentMoods.length : 0;
  const avgAnxiety = recentMoods.length > 0 ? recentMoods.reduce((s, e) => s + e.anxiety, 0) / recentMoods.length : 0;
  const latestRisk = assessmentHistory[0]?.risk_level || 'unknown';
  const showCrisisCard = latestRisk === 'severe' || latestRisk === 'critical' || avgMood <= 3 || avgAnxiety >= 8;

  const journalInsights = useMemo(() => {
    const text = recentMoods.map((m) => (m.notes || '').toLowerCase()).join(' ');
    const keywords = ['sleep', 'anxiety', 'overwhelmed', 'tired', 'support', 'panic'];
    return keywords
      .map((k) => ({ keyword: k, count: (text.match(new RegExp(k, 'g')) || []).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [recentMoods]);

  const exportReport = () => {
    const report = [
      'Mental Health Summary Report',
      `Generated: ${new Date().toLocaleString()}`,
      `Average mood: ${avgMood.toFixed(1)}/10`,
      `Average anxiety: ${avgAnxiety.toFixed(1)}/10`,
      `Latest risk level: ${latestRisk}`,
      '',
      'Recent Mood Entries:',
      ...recentMoods.slice(0, 10).map((m) => `${m.date} | mood:${m.mood} energy:${m.energy} anxiety:${m.anxiety} | ${m.notes || 'No notes'}`)
    ].join('\n');
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mental-health-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MoodTrackerTab = () => (
    <div className="space-y-6">
      {showReminder && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center space-x-3">
          <Bell className="h-5 w-5 text-amber-600" />
          <p className="text-amber-800 text-sm">{t.reminder}</p>
        </div>
      )}

      {showCrisisCard && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
          <h4 className="font-semibold text-red-900 mb-2">{t.crisis}</h4>
          <p className="text-sm text-red-800 mb-3">
            Your recent trends suggest elevated distress. Please consider immediate support.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/emergency')} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">Open Emergency Support</button>
            <button onClick={() => setShowIntervention(true)} className="px-3 py-2 border border-red-300 text-red-700 rounded-lg text-sm">Start 2-min Breathing</button>
          </div>
        </div>
      )}

      {/* Success Message */}
      {moodSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-green-800 font-medium">Mood entry saved successfully!</p>
        </div>
      )}

      {/* Mood Entry Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.logMood}</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How are you feeling today?</label>
            <div className="flex justify-between items-center space-x-2">
              <span className="text-xs text-gray-500">Very Low</span>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setMoodScore(num)}
                    className={`w-8 h-8 rounded-full border-2 transition-colors flex items-center justify-center text-sm font-medium ${
                      moodScore === num
                        ? 'border-rose-500 bg-rose-500 text-white'
                        : 'border-gray-300 hover:border-rose-400 hover:bg-rose-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">Very High</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Energy Level</label>
            <div className="flex justify-between items-center space-x-2">
              <span className="text-xs text-gray-500">Exhausted</span>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setEnergyLevel(num)}
                    className={`w-8 h-8 rounded-full border-2 transition-colors flex items-center justify-center text-sm font-medium ${
                      energyLevel === num
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">Energetic</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Anxiety Level</label>
            <div className="flex justify-between items-center space-x-2">
              <span className="text-xs text-gray-500">Calm</span>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    onClick={() => setAnxietyLevel(num)}
                    className={`w-8 h-8 rounded-full border-2 transition-colors flex items-center justify-center text-sm font-medium ${
                      anxietyLevel === num
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500">Very Anxious</span>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors"
              placeholder="How are you feeling today? What's on your mind?"
            ></textarea>
          </div>

          <button
            onClick={handleSaveMoodEntry}
            disabled={savingMood || moodScore === null || energyLevel === null || anxietyLevel === null}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
          >
            {savingMood ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t.saving}</span>
              </>
            ) : (
              <span>{t.saveEntry}</span>
            )}
          </button>
        </div>
      </div>

      {/* Recent Mood History */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t.recentMoodHistory}</h3>
          <button
            onClick={fetchMoodEntries}
            className="text-rose-500 hover:text-rose-600 text-sm font-medium"
          >
            {t.refresh}
          </button>
        </div>
        {loadingMoods ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
          </div>
        ) : recentMoods.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>{t.noMoodEntries}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMoods.map((entry, index) => (
              <div key={entry.id || index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getMoodColor(entry.mood)}`}></div>
                  <span className="text-sm font-medium">{entry.date}</span>
                </div>
                <div className="flex-1 flex items-center space-x-4 text-sm text-gray-600">
                  <span>Mood: {entry.mood}/10</span>
                  <span>Energy: {entry.energy}/10</span>
                  <span>Anxiety: {entry.anxiety}/10</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 truncate">{entry.notes || 'No notes'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.moodTrendLine}</h3>
        <div className="mb-5">
          {renderMoodLineChart()}
          <p className="text-xs text-gray-500 mt-2">
            {t.moodTrendHint}
          </p>
        </div>
        {renderTrendBars('Anxiety', anxietyTrend)}
        {renderTrendBars('Energy', energyTrend)}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.recommendations}</h3>
        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
          {avgAnxiety >= 7 && <li>High anxiety trend detected. Try guided breathing and reduce caffeine where possible.</li>}
          {avgMood <= 4 && <li>Low mood trend detected. Consider connecting with your support network today.</li>}
          {latestRisk === 'moderate' || latestRisk === 'severe' ? (
            <li>Recent assessment indicates elevated risk. Schedule a professional consultation soon.</li>
          ) : (
            <li>Current risk trend appears stable. Continue regular check-ins and self-care.</li>
          )}
        </ul>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.journalInsights}</h3>
        {journalInsights.length === 0 ? (
          <p className="text-sm text-gray-500">{t.addNotesForInsights}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {journalInsights.map((item) => (
              <span key={item.keyword} className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                {item.keyword}: {item.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t.followUpActions}</h3>
        <div className="space-y-2 text-sm">
          {[
            { id: 'breathing', label: 'Completed breathing exercise today' },
            { id: 'consult', label: 'Booked/attended healthcare consultation' },
            { id: 'support', label: 'Reached out to support person/group' }
          ].map((item) => (
            <label key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(followUpActions[item.id])}
                onChange={(e) => setFollowUpActions((prev) => ({ ...prev, [item.id]: e.target.checked }))}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const AssessmentTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500 p-3 rounded-xl">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Mental Health Assessment</h3>
              <p className="text-gray-600">Comprehensive screening with AI-powered PPD prediction</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => openAssessmentModal('quick')}
            className={`px-3 py-2 rounded-lg border text-sm ${assessmentType === 'quick' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-300 text-gray-600'}`}
          >
            Quick (5)
          </button>
          <button
            onClick={() => openAssessmentModal('phq9')}
            className={`px-3 py-2 rounded-lg border text-sm ${assessmentType === 'phq9' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-300 text-gray-600'}`}
          >
            PHQ-9
          </button>
          <button
            onClick={() => openAssessmentModal('gad7')}
            className={`px-3 py-2 rounded-lg border text-sm ${assessmentType === 'gad7' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-300 text-gray-600'}`}
          >
            GAD-7
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Important Note</p>
              <p>
                This assessment is not a diagnostic tool and cannot replace professional medical advice. 
                Mental conditions can change over time, so you can retake this assessment whenever needed.
                If you're experiencing thoughts of self-harm, please seek immediate help.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <button
            onClick={() => navigate('/detailed-assessment')}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl transition-all font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 inline-flex items-center justify-center space-x-3 border-2 border-blue-400"
          >
            <Brain className="h-6 w-6" />
            <span>{`🔄 ${t.detailedAssessment}`}</span>
          </button>
          <button
            onClick={() => openAssessmentModal()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-all font-medium shadow-md hover:shadow-lg inline-flex items-center justify-center space-x-2"
          >
            <Brain className="h-5 w-5" />
            <span>{t.quickAssessment}</span>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <Smile className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700">10-15 minutes</p>
            <p className="text-xs text-green-600">Detailed assessment duration</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <TrendingUp className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-purple-700">AI-Powered</p>
            <p className="text-xs text-purple-600">BERT-based predictions</p>
          </div>
          <div className="text-center p-4 bg-rose-50 rounded-xl">
            <Heart className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-rose-700">Confidential</p>
            <p className="text-xs text-rose-600">Your privacy protected</p>
          </div>
        </div>
      </div>

      {/* Assessment History */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            {t.assessmentHistory}
          </h3>
          <button
            onClick={fetchAssessmentHistory}
            className="text-blue-500 hover:text-blue-600 transition-colors"
            disabled={loadingAssessments}
          >
            <RefreshCw className={`h-5 w-5 ${loadingAssessments ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingAssessments ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : assessmentHistory.length > 0 ? (
          <div className="space-y-3">
            {assessmentHistory.map((assessment: AssessmentHistoryItem, index: number) => {
              const completedDate = new Date(assessment.completed_at || assessment.created_at || Date.now());
              const riskColors: { [key: string]: string } = {
                critical: 'bg-red-100 text-red-800 border-red-300',
                severe: 'bg-red-100 text-red-800 border-red-300',
                high: 'bg-orange-100 text-orange-800 border-orange-300',
                moderate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                mild: 'bg-blue-100 text-blue-800 border-blue-300',
                low: 'bg-green-100 text-green-800 border-green-300',
              };
              const riskColor = riskColors[assessment.risk_level || ''] || 'bg-gray-100 text-gray-800 border-gray-300';
              
              return (
                <div
                  key={assessment.id || index}
                  className="border-2 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {completedDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${riskColor}`}>
                      {assessment.risk_level?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {assessment.assessment_type === 'detailed_ppd' ? 'Detailed Assessment' : 
                         assessment.assessment_type === 'custom' ? 'Standard Assessment' :
                         assessment.assessment_type || 'Assessment'}
                      </p>
                      <p className="text-xs text-gray-500">Score: {assessment.score || 'N/A'}</p>
                      {assessmentHistory[index + 1] && (
                        <p className="text-xs mt-1 text-gray-500">
                          Trend vs previous:{' '}
                          {Number(assessment.score || 0) > Number(assessmentHistory[index + 1].score || 0)
                            ? 'Worsened'
                            : Number(assessment.score || 0) < Number(assessmentHistory[index + 1].score || 0)
                            ? 'Improved'
                            : 'Stable'}
                        </p>
                      )}
                    </div>
                    {index === 0 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Latest
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="mb-4">No assessments completed yet</p>
            <button
              onClick={() => navigate('/detailed-assessment')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
            >
              Take Your First Assessment
            </button>
          </div>
        )}
        <div className="mt-4">
          <button
            onClick={exportReport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            {t.exportReport}
          </button>
        </div>
      </div>
    </div>
  );

  const ResourcesTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((resource, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
                <resource.icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{resource.type}</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{resource.title}</h3>
            <p className="text-gray-600 text-sm mb-4">{resource.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{resource.duration}</span>
              <button
                onClick={() => handleResourceAccess(resource.type)}
                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Access
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Crisis Resources */}
      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <h3 className="text-xl font-semibold text-red-900">{t.crisisResources}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Tele-MANAS Mental Health Helpline</h4>
            <p className="text-sm text-gray-600 mb-2">Call 14416 / 1-800-89-14416</p>
            <p className="text-xs text-gray-500">24/7 national mental health support</p>
          </div>
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">National Emergency & Women Support</h4>
            <p className="text-sm text-gray-600 mb-2">Call 112 (Emergency) or 181 (Women Helpline)</p>
            <p className="text-xs text-gray-500">Immediate safety support, available 24/7</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
          <div className="inline-flex items-center gap-2">
            <Languages className="h-4 w-4 text-gray-500" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
          </div>
        </div>
        <p className="text-gray-600">{t.subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { id: 'mood', name: t.moodTracker, icon: Smile },
          { id: 'assessment', name: t.assessment, icon: Brain },
          { id: 'resources', name: t.resources, icon: Heart },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-rose-50 hover:text-rose-600 border border-gray-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'mood' && <MoodTrackerTab />}
        {activeTab === 'assessment' && <AssessmentTab />}
        {activeTab === 'resources' && <ResourcesTab />}
      </div>

      {/* Assessment Modal */}
      {showAssessment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Mental Health Assessment</h3>
                <button
                  onClick={() => {
                    setShowAssessment(false);
                    setCurrentQuestion(0);
                    setAssessmentScore(0);
                    setAssessmentResponses([]);
                    setAssessmentSuccess(false);
                    setSavingAssessment(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={savingAssessment}
                >
                  ✕
                </button>
              </div>
              <div className="bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${((Math.min(currentQuestion + 1, activeQuestions.length)) / activeQuestions.length) * 100}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">Question {Math.min(currentQuestion + 1, activeQuestions.length)} of {activeQuestions.length}</p>
            </div>

            {currentQuestion < activeQuestions.length ? (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-6">
                  {activeQuestions[currentQuestion]}
                </h4>
                <div className="space-y-3">
                  {answerOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(option.value)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                {savingAssessment ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                    <p className="text-gray-600">Saving your assessment...</p>
                  </div>
                ) : assessmentSuccess ? (
                  <div className="mb-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">Assessment Saved!</h4>
                    <p className="text-gray-600">Your assessment has been recorded successfully.</p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Brain className="h-8 w-8 text-green-600" />
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">Assessment Complete</h4>
                    <div className="mb-4">
                      <p className={`text-lg font-medium ${getScoreInterpretation(assessmentScore).color}`}>
                        {getScoreInterpretation(assessmentScore).level} Risk Level
                      </p>
                      <p className="text-gray-600 mt-2">
                        {getScoreInterpretation(assessmentScore).message}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800">
                        Remember: This is a screening tool, not a diagnosis. 
                        Please consult with a healthcare professional for proper evaluation.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2-minute breathing intervention modal */}
      {showIntervention && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">2-Minute Guided Breathing</h3>
            <p className="text-sm text-gray-600 mb-4">Follow the pace shown below.</p>

            <div className="mb-4">
              <div
                className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center text-white text-lg font-semibold transition-all duration-700 ${
                  breathingStep === 'inhale'
                    ? 'bg-blue-500 scale-105'
                    : breathingStep === 'hold'
                    ? 'bg-purple-500 scale-95'
                    : 'bg-green-500 scale-90'
                }`}
              >
                {breathingStep === 'inhale' ? 'Inhale' : breathingStep === 'hold' ? 'Hold' : 'Exhale'}
              </div>
              <p className="mt-3 text-sm text-gray-700">
                {breathingStep === 'inhale'
                  ? 'Breathe in slowly through your nose'
                  : breathingStep === 'hold'
                  ? 'Hold your breath gently'
                  : 'Breathe out slowly through your mouth'}
              </p>
            </div>

            <p className="text-lg font-semibold text-rose-600 mb-4">{formatTime(breathingSecondsLeft)}</p>

            <button
              onClick={() => setShowIntervention(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentalHealth;