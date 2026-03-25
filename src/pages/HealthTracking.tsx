import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Thermometer, Heart, Activity, Moon, Droplets, Weight, Loader2, CheckCircle, X, Pencil, Trash2, AlertTriangle, Download } from 'lucide-react';
import { healthAPI, mentalHealthAPI, getAccessToken } from '../services/api';

interface HealthRecord {
  id: string;
  record_type: string;
  value: number | string;
  unit: string;
  recorded_at: string;
  notes?: string;
  diastolic_value?: number;
}

interface Symptom {
  id: string;
  symptom_name: string;
  severity: number;
  recorded_at: string;
  notes?: string;
}

interface MoodLite {
  recorded_at?: string;
  mood_score: number;
}

interface UnitPrefs {
  temperature: 'F' | 'C';
  weight: 'lbs' | 'kg';
  water: 'glasses' | 'ml';
}

const HealthTracking: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('vitals');
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Form states
  const [vitalType, setVitalType] = useState('');
  const [vitalValue, setVitalValue] = useState('');
  const [systolicBP, setSystolicBP] = useState('');
  const [diastolicBP, setDiastolicBP] = useState('');
  const [symptomName, setSymptomName] = useState('');
  const [symptomSeverity, setSymptomSeverity] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [waterIntake, setWaterIntake] = useState('');
  const [notes, setNotes] = useState('');
  const [symptomTags, setSymptomTags] = useState<string[]>([]);
  const [customSymptomTag, setCustomSymptomTag] = useState('');
  const [recordedAtMode, setRecordedAtMode] = useState<'now' | 'yesterday' | 'custom'>('now');
  const [recordedAtCustom, setRecordedAtCustom] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [softWarnings, setSoftWarnings] = useState<string[]>([]);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingPairDiastolicId, setEditingPairDiastolicId] = useState<string | null>(null);
  const [editingSymptomId, setEditingSymptomId] = useState<string | null>(null);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [moodEntries, setMoodEntries] = useState<MoodLite[]>([]);
  const [unitPrefs, setUnitPrefs] = useState<UnitPrefs>({
    temperature: 'F',
    weight: 'lbs',
    water: 'glasses'
  });

  const symptomLibrary = ['Headache', 'Fatigue', 'Anxiety', 'Poor Sleep', 'Low Appetite', 'Mood Swings'];

  const userScopedPrefsKey = useMemo(() => {
    try {
      const token = getAccessToken();
      if (!token) return 'health_unit_prefs_guest';
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return `health_unit_prefs_${payload?.sub || payload?.id || 'guest'}`;
    } catch {
      return 'health_unit_prefs_guest';
    }
  }, []);

  const getRecordedAtIso = () => {
    if (recordedAtMode === 'custom' && recordedAtCustom) {
      return new Date(recordedAtCustom).toISOString();
    }
    if (recordedAtMode === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
    return new Date().toISOString();
  };

  const convertDisplayToCanonical = (type: string, value: number) => {
    if (type === 'temperature' && unitPrefs.temperature === 'C') return value * (9 / 5) + 32;
    if (type === 'weight' && unitPrefs.weight === 'kg') return value * 2.20462;
    if (type === 'water_intake' && unitPrefs.water === 'ml') return value / 240;
    return value;
  };

  const convertCanonicalToDisplay = (type: string, value: number) => {
    if (type === 'temperature' && unitPrefs.temperature === 'C') return (value - 32) * (5 / 9);
    if (type === 'weight' && unitPrefs.weight === 'kg') return value / 2.20462;
    if (type === 'water_intake' && unitPrefs.water === 'ml') return value * 240;
    return value;
  };

  const getDisplayUnit = (type: string, fallbackUnit: string) => {
    if (type === 'temperature') return unitPrefs.temperature === 'C' ? '°C' : '°F';
    if (type === 'weight') return unitPrefs.weight;
    if (type === 'water_intake') return unitPrefs.water;
    return fallbackUnit;
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const quickAdd = params.get('quickAdd');
    const validTabs = new Set(['vitals', 'symptoms', 'sleep', 'nutrition']);
    if (tab && validTabs.has(tab)) {
      setActiveTab(tab);
    }
    if (!quickAdd) return;
    if (quickAdd === 'sleep') {
      setModalType('sleep');
      setShowAddModal(true);
      return;
    }
    if (quickAdd === 'water_intake') {
      setModalType('nutrition');
      setShowAddModal(true);
      return;
    }
    if (quickAdd === 'symptom') {
      setModalType('symptom');
      setShowAddModal(true);
      return;
    }
    const vitals = new Set(['temperature', 'heart_rate', 'blood_pressure', 'weight']);
    if (vitals.has(quickAdd)) {
      setModalType('vital');
      setVitalType(quickAdd);
      setShowAddModal(true);
    }
  }, [location.search]);

  useEffect(() => {
    const saved = localStorage.getItem(userScopedPrefsKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as UnitPrefs;
        setUnitPrefs(parsed);
      } catch {
        // ignore parse errors
      }
    }
  }, [userScopedPrefsKey]);

  useEffect(() => {
    localStorage.setItem(userScopedPrefsKey, JSON.stringify(unitPrefs));
  }, [unitPrefs, userScopedPrefsKey]);

  useEffect(() => {
    if (!showAddModal) return;
    setSoftWarnings(getOutlierWarnings());
  }, [showAddModal, vitalType, vitalValue, systolicBP, diastolicBP, sleepHours, unitPrefs]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recordsResponse, symptomsResponse, moodsResponse] = await Promise.all([
        healthAPI.getRecords({ limit: 200 }),
        healthAPI.getSymptoms({ limit: 200 }),
        mentalHealthAPI.getMoodEntries({ limit: 120 })
      ]);
      if (recordsResponse.success && recordsResponse.data?.records) {
        setRecords(recordsResponse.data.records);
      }
      if (symptomsResponse.success && symptomsResponse.data?.symptoms) {
        setSymptoms(symptomsResponse.data.symptoms);
      }
      if (moodsResponse.success && moodsResponse.data?.moodEntries) {
        setMoodEntries(moodsResponse.data.moodEntries);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'vitals', name: 'Vital Signs', icon: Heart },
    { id: 'symptoms', name: 'Symptoms', icon: Activity },
    { id: 'sleep', name: 'Sleep', icon: Moon },
    { id: 'nutrition', name: 'Nutrition', icon: Droplets },
  ];

  const vitalTypes = [
    { id: 'temperature', name: 'Temperature', icon: Thermometer, unit: '°F', color: 'bg-red-500' },
    { id: 'heart_rate', name: 'Heart Rate', icon: Heart, unit: 'bpm', color: 'bg-pink-500' },
    { id: 'blood_pressure', name: 'Blood Pressure', icon: Activity, unit: 'mmHg', color: 'bg-blue-500' },
    { id: 'weight', name: 'Weight', icon: Weight, unit: 'lbs', color: 'bg-green-500' },
  ];

  const getRecordsByType = (type: string) => {
    return records
      .filter(record => record.record_type === type)
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  const clearValidation = () => {
    setFormErrors({});
    setSoftWarnings([]);
  };

  const getOutlierWarnings = () => {
    const warnings: string[] = [];
    if (vitalType === 'temperature' && vitalValue) {
      const tempF = convertDisplayToCanonical('temperature', Number(vitalValue));
      if (tempF > 100.4 || tempF < 95) warnings.push('Temperature is outside typical range. Consider contacting clinician.');
    }
    if (vitalType === 'heart_rate' && vitalValue) {
      const hr = Number(vitalValue);
      if (hr > 120 || hr < 45) warnings.push('Heart rate is outside typical range. Consider contacting clinician.');
    }
    if (vitalType === 'blood_pressure' && systolicBP && diastolicBP) {
      const s = Number(systolicBP);
      const d = Number(diastolicBP);
      if (s > 140 || d > 90 || s < 90 || d < 60) warnings.push('Blood pressure is outside typical range. Consider contacting clinician.');
    }
    if (vitalType === 'weight' && vitalValue) {
      const weightLbs = convertDisplayToCanonical('weight', Number(vitalValue));
      if (weightLbs < 70 || weightLbs > 330) warnings.push('Weight value looks unusual. Please double-check.');
    }
    if (sleepHours && Number(sleepHours) < 3) warnings.push('Sleep less than 3 hours can affect recovery. Consider contacting clinician.');
    return warnings;
  };

  const getTrendData = (type: string) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - trendDays);
    return getRecordsByType(type)
      .filter((r) => new Date(r.recorded_at) >= cutoff)
      .slice()
      .reverse();
  };

  const MiniTrendChart = ({
    type,
    color,
    title,
    unit
  }: {
    type: string;
    color: string;
    title: string;
    unit: string;
  }) => {
    const data = getTrendData(type);
    if (data.length < 2) {
      return (
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-700 mb-1">{title} Trend ({trendDays} days)</p>
          <p className="text-xs text-gray-400">Not enough data to show a clear trend yet</p>
        </div>
      );
    }
    const values = data.map((d) => Number(convertCanonicalToDisplay(type, Number(d.value))));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const min = Math.floor(rawMin);
    const max = Math.ceil(rawMax);
    const spread = max - min || 1;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const latest = values[values.length - 1];
    const prev = values[values.length - 2];
    const delta = latest - prev;
    const trendLabel = delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable';
    const chartWidth = 640;
    const chartHeight = 240;
    const leftPad = 44;
    const rightPad = 12;
    const topPad = 16;
    const bottomPad = 34;
    const innerW = chartWidth - leftPad - rightPad;
    const innerH = chartHeight - topPad - bottomPad;
    const points = data.map((d, i) => {
      const x = leftPad + (i / (data.length - 1)) * innerW;
      const value = Number(convertCanonicalToDisplay(type, Number(d.value)));
      const y = topPad + (1 - (value - min) / spread) * innerH;
      const date = new Date(d.recorded_at);
      const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return { x, y, label, value };
    });
    const pointsPath = points.map((p) => `${p.x},${p.y}`).join(' ');
    const ticks = Array.from({ length: 6 }, (_, i) => min + (spread * i) / 5);
    const firstLabel = points[0].label;
    const lastLabel = points[points.length - 1].label;

    return (
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700">{title} Trend ({trendDays}d)</p>
          <p className="text-[11px] text-gray-600">
            Latest: <span className="font-semibold">{latest.toFixed(1)} {unit}</span> | Avg: <span className="font-semibold">{avg.toFixed(1)} {unit}</span> | {trendLabel}
          </p>
        </div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-40">
          {ticks.map((tick, index) => {
            const y = topPad + (1 - (tick - min) / spread) * innerH;
            return (
              <g key={`tick-${index}`}>
                <line x1={leftPad} y1={y} x2={chartWidth - rightPad} y2={y} stroke="#E5E7EB" strokeWidth="1" />
                <text x={8} y={y + 4} fontSize="11" fill="#6B7280">
                  {tick.toFixed(0)}
                </text>
              </g>
            );
          })}
          <polyline points={pointsPath} fill="none" stroke={color} strokeWidth="3" />
          {points.map((point, index) => (
            <g key={`${type}-pt-${index}`}>
              <circle cx={point.x} cy={point.y} r="4" fill={color}>
                <title>{`${point.label}: ${point.value.toFixed(1)} ${unit}`}</title>
              </circle>
            </g>
          ))}
          <text x={leftPad} y={chartHeight - 8} fontSize="11" fill="#6B7280">
            {firstLabel}
          </text>
          <text x={chartWidth - rightPad} y={chartHeight - 8} textAnchor="end" fontSize="11" fill="#6B7280">
            {lastLabel}
          </text>
        </svg>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
          <span>Range: {rawMin.toFixed(1)}-{rawMax.toFixed(1)} {unit}</span>
          <span>{data.length} points</span>
        </div>
      </div>
    );
  };

  const getDailyStreak = () => {
    const dates = new Set<string>();
    records.forEach((r) => dates.add(new Date(r.recorded_at).toDateString()));
    symptoms.forEach((s) => dates.add(new Date(s.recorded_at).toDateString()));
    let streak = 0;
    const cursor = new Date();
    while (dates.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };

  const getCorrelationInsights = () => {
    const sleepByDate = new Map<string, number>();
    getRecordsByType('sleep_hours').forEach((r) => {
      const key = new Date(r.recorded_at).toDateString();
      if (!sleepByDate.has(key)) sleepByDate.set(key, Number(r.value));
    });
    const symptomByDate = new Map<string, number>();
    symptoms.forEach((s) => {
      const key = new Date(s.recorded_at).toDateString();
      symptomByDate.set(key, Math.max(symptomByDate.get(key) || 0, s.severity));
    });
    const moodByDate = new Map<string, number>();
    moodEntries.forEach((m) => {
      const key = new Date(m.recorded_at || Date.now()).toDateString();
      if (!moodByDate.has(key)) moodByDate.set(key, m.mood_score);
    });
    const lowSleepDays = Array.from(sleepByDate.entries()).filter(([, h]) => h < 6).map(([d]) => d);
    const highSymptomOnLowSleep = lowSleepDays.filter((d) => (symptomByDate.get(d) || 0) >= 3).length;
    const lowMoodOnLowSleep = lowSleepDays.filter((d) => (moodByDate.get(d) || 10) <= 5).length;
    return [
      lowSleepDays.length > 0
        ? `${highSymptomOnLowSleep}/${lowSleepDays.length} low-sleep days had moderate/high symptoms.`
        : 'Need more sleep logs for symptom correlation.',
      lowSleepDays.length > 0
        ? `${lowMoodOnLowSleep}/${lowSleepDays.length} low-sleep days had lower mood scores.`
        : 'Need more mood logs for sleep correlation.'
    ];
  };

  const exportClinicianSummary = () => {
    const start = exportStartDate ? new Date(exportStartDate) : new Date(Date.now() - 7 * 86400000);
    const end = exportEndDate ? new Date(exportEndDate) : new Date();
    const inRange = (d: string) => {
      const x = new Date(d).getTime();
      return x >= start.getTime() && x <= end.getTime();
    };
    const filteredRecords = records.filter((r) => inRange(r.recorded_at));
    const filteredSymptoms = symptoms.filter((s) => inRange(s.recorded_at));
    const rows = [
      'Section,Date,Type,Value,Unit,Notes',
      ...filteredRecords.map((r) => `Record,${new Date(r.recorded_at).toISOString()},${r.record_type},${r.value},${r.unit},"${(r.notes || '').replace(/"/g, '""')}"`),
      ...filteredSymptoms.map((s) => `Symptom,${new Date(s.recorded_at).toISOString()},${s.symptom_name},${s.severity},1-5,"${(s.notes || '').replace(/"/g, '""')}"`)
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `health-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveVital = async () => {
    clearValidation();
    const errors: Record<string, string> = {};
    if (!vitalType) {
      errors.vitalType = 'Select a vital type';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSaving(true);
      const recordType = vitalType;
      const value = parseFloat(vitalValue);
      let unit = '';

      // Set unit based on type
      if (vitalType === 'temperature') {
        unit = '°F';
      } else if (vitalType === 'heart_rate') {
        unit = 'bpm';
      } else if (vitalType === 'blood_pressure') {
        // Blood pressure needs two records
        if (!systolicBP || !diastolicBP) {
          setFormErrors({
            systolicBP: !systolicBP ? 'Required' : '',
            diastolicBP: !diastolicBP ? 'Required' : ''
          });
          setSaving(false);
          return;
        }
        if (Number(systolicBP) <= 0 || Number(diastolicBP) <= 0) {
          setFormErrors({
            systolicBP: Number(systolicBP) <= 0 ? 'Must be positive' : '',
            diastolicBP: Number(diastolicBP) <= 0 ? 'Must be positive' : ''
          });
          setSaving(false);
          return;
        }
        // Save systolic
        const payloadS = {
          recordType: 'blood_pressure_systolic',
          value: parseFloat(systolicBP),
          unit: 'mmHg',
          notes: notes || undefined,
          recordedAt: getRecordedAtIso()
        };
        const payloadD = {
          recordType: 'blood_pressure_diastolic',
          value: parseFloat(diastolicBP),
          unit: 'mmHg',
          notes: notes || undefined,
          recordedAt: getRecordedAtIso()
        };
        if (editingRecordId) {
          await healthAPI.updateRecord(editingRecordId, payloadS);
          if (editingPairDiastolicId) {
            await healthAPI.updateRecord(editingPairDiastolicId, payloadD);
          } else {
            await healthAPI.addRecord(payloadD);
          }
        } else {
          await healthAPI.addRecord(payloadS);
          await healthAPI.addRecord(payloadD);
        }
        showSuccess(editingRecordId ? 'Blood pressure updated successfully!' : 'Blood pressure recorded successfully!');
        resetForm();
        await fetchData();
        return;
      } else if (vitalType === 'weight') {
        unit = 'lbs';
      }

      if (!vitalValue || Number.isNaN(value)) {
        setFormErrors({ vitalValue: 'Enter a valid value' });
        setSaving(false);
        return;
      }
      if (value <= 0) {
        setFormErrors({ vitalValue: 'Value must be positive' });
        setSaving(false);
        return;
      }

      setSoftWarnings(getOutlierWarnings());

      const payload = {
        recordType,
        value: convertDisplayToCanonical(recordType, value),
        unit,
        notes: notes || undefined,
        recordedAt: getRecordedAtIso()
      };
      const response = editingRecordId
        ? await healthAPI.updateRecord(editingRecordId, payload)
        : await healthAPI.addRecord(payload);

      if (response.success) {
        showSuccess(editingRecordId ? 'Vital sign updated successfully!' : 'Vital sign recorded successfully!');
        resetForm();
        await fetchData();
      } else {
        throw new Error(response.message || 'Failed to save');
      }
    } catch (error: any) {
      console.error('Error saving vital:', error);
      setFormErrors({ general: error.message || 'Failed to save vital sign. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSymptom = async () => {
    clearValidation();
    if (!symptomName || symptomSeverity === null) {
      setFormErrors({
        symptomName: !symptomName ? 'Symptom is required' : '',
        symptomSeverity: symptomSeverity === null ? 'Severity is required' : ''
      });
      return;
    }

    try {
      setSaving(true);
      const combinedNotes = [notes.trim(), symptomTags.length ? `tags:${symptomTags.join('|')}` : '']
        .filter(Boolean)
        .join(' | ');
      const payload = {
        symptomName,
        severity: symptomSeverity,
        notes: combinedNotes || undefined,
        recordedAt: getRecordedAtIso()
      };
      const response = editingSymptomId
        ? await healthAPI.updateSymptom(editingSymptomId, payload)
        : await healthAPI.addSymptom(payload);

      if (response.success) {
        showSuccess(editingSymptomId ? 'Symptom updated successfully!' : 'Symptom recorded successfully!');
        resetForm();
        await fetchData();
      } else {
        throw new Error(response.message || 'Failed to save');
      }
    } catch (error: any) {
      console.error('Error saving symptom:', error);
      setFormErrors({ general: error.message || 'Failed to save symptom. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSleep = async () => {
    clearValidation();
    if (!sleepHours || sleepQuality === null) {
      setFormErrors({
        sleepHours: !sleepHours ? 'Sleep hours required' : '',
        sleepQuality: sleepQuality === null ? 'Sleep quality required' : ''
      });
      return;
    }
    if (Number(sleepHours) <= 0) {
      setFormErrors({ sleepHours: 'Sleep hours must be positive' });
      return;
    }

    try {
      setSaving(true);
      setSoftWarnings(getOutlierWarnings());
      // Save sleep hours
      const sleepHoursPayload = {
        recordType: 'sleep_hours',
        value: parseFloat(sleepHours),
        unit: 'hours',
        notes: notes || undefined,
        recordedAt: getRecordedAtIso()
      };
      // Save sleep quality
      const sleepQualityPayload = {
        recordType: 'sleep_quality',
        value: sleepQuality,
        unit: '1-10',
        notes: notes || undefined,
        recordedAt: getRecordedAtIso()
      };
      if (editingRecordId) {
        await healthAPI.updateRecord(editingRecordId, sleepHoursPayload);
        if (editingPairDiastolicId) {
          await healthAPI.updateRecord(editingPairDiastolicId, sleepQualityPayload);
        } else {
          await healthAPI.addRecord(sleepQualityPayload);
        }
      } else {
        await healthAPI.addRecord(sleepHoursPayload);
        await healthAPI.addRecord(sleepQualityPayload);
      }

      showSuccess(editingRecordId ? 'Sleep data updated successfully!' : 'Sleep data recorded successfully!');
      resetForm();
      await fetchData();
    } catch (error: any) {
      console.error('Error saving sleep:', error);
      setFormErrors({ general: error.message || 'Failed to save sleep data. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNutrition = async () => {
    clearValidation();
    if (!waterIntake) {
      setFormErrors({ waterIntake: 'Water intake is required' });
      return;
    }
    if (Number(waterIntake) <= 0) {
      setFormErrors({ waterIntake: 'Water intake must be positive' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        recordType: 'water_intake',
        value: convertDisplayToCanonical('water_intake', parseFloat(waterIntake)),
        unit: 'glasses',
        notes: notes || undefined,
        recordedAt: getRecordedAtIso()
      };
      const response = editingRecordId
        ? await healthAPI.updateRecord(editingRecordId, payload)
        : await healthAPI.addRecord(payload);

      if (response.success) {
        showSuccess(editingRecordId ? 'Water intake updated successfully!' : 'Water intake recorded successfully!');
        resetForm();
        await fetchData();
      } else {
        throw new Error(response.message || 'Failed to save');
      }
    } catch (error: any) {
      console.error('Error saving nutrition:', error);
      setFormErrors({ general: error.message || 'Failed to save water intake. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setVitalType('');
    setVitalValue('');
    setSystolicBP('');
    setDiastolicBP('');
    setSymptomName('');
    setSymptomSeverity(null);
    setSleepHours('');
    setSleepQuality(null);
    setWaterIntake('');
    setNotes('');
    setSymptomTags([]);
    setCustomSymptomTag('');
    setRecordedAtMode('now');
    setRecordedAtCustom('');
    setEditingRecordId(null);
    setEditingPairDiastolicId(null);
    setEditingSymptomId(null);
    clearValidation();
    setShowAddModal(false);
    setModalType('');
  };

  const openModal = (type: string, vitalTypeId?: string) => {
    clearValidation();
    setEditingRecordId(null);
    setEditingPairDiastolicId(null);
    setEditingSymptomId(null);
    setModalType(type);
    if (vitalTypeId) {
      setVitalType(vitalTypeId);
    }
    setShowAddModal(true);
  };

  const handleEditRecord = (record: HealthRecord) => {
    clearValidation();
    setEditingSymptomId(null);
    setEditingPairDiastolicId(null);
    if (record.record_type === 'sleep_hours') {
      setModalType('sleep');
      setEditingRecordId(record.id);
      setSleepHours(String(record.value));
      const match = getRecordsByType('sleep_quality').find((q) => new Date(q.recorded_at).toDateString() === new Date(record.recorded_at).toDateString());
      setSleepQuality(match ? Number(match.value) : null);
      setEditingPairDiastolicId(match?.id || null);
      setShowAddModal(true);
    } else if (record.record_type === 'water_intake') {
      setModalType('nutrition');
      setEditingRecordId(record.id);
      setWaterIntake(String(Number(convertCanonicalToDisplay('water_intake', Number(record.value))).toFixed(2)));
      setShowAddModal(true);
    } else {
      setModalType('vital');
      setEditingRecordId(record.id);
      setVitalType(record.record_type === 'blood_pressure_systolic' || record.record_type === 'blood_pressure_diastolic' ? 'blood_pressure' : record.record_type);
      if (record.record_type === 'blood_pressure_systolic' || record.record_type === 'blood_pressure_diastolic') {
        const systolicRecord = record.record_type === 'blood_pressure_systolic' ? record : getRecordsByType('blood_pressure_systolic').find((s) => new Date(s.recorded_at).toDateString() === new Date(record.recorded_at).toDateString());
        const diastolicRecord = getRecordsByType('blood_pressure_diastolic').find((d) => new Date(d.recorded_at).toDateString() === new Date(record.recorded_at).toDateString());
        if (systolicRecord) {
          setEditingRecordId(systolicRecord.id);
          setSystolicBP(String(systolicRecord.value));
        }
        if (diastolicRecord) {
          setEditingPairDiastolicId(diastolicRecord.id);
          setDiastolicBP(String(diastolicRecord.value));
        }
      } else {
        const displayValue = convertCanonicalToDisplay(record.record_type, Number(record.value));
        setVitalValue(String(Number(displayValue.toFixed(2))));
      }
      setShowAddModal(true);
    }
    setNotes(record.notes || '');
    setRecordedAtMode('custom');
    setRecordedAtCustom(new Date(record.recorded_at).toISOString().slice(0, 16));
  };

  const handleDeleteRecord = async (id: string, type?: string, recordedAt?: string) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      setActionBusyId(id);
      await healthAPI.deleteRecord(id);
      if (type === 'blood_pressure_systolic' && recordedAt) {
        const pair = getRecordsByType('blood_pressure_diastolic').find((d) => new Date(d.recorded_at).toDateString() === new Date(recordedAt).toDateString());
        if (pair) await healthAPI.deleteRecord(pair.id);
      }
      if (type === 'sleep_hours' && recordedAt) {
        const pair = getRecordsByType('sleep_quality').find((d) => new Date(d.recorded_at).toDateString() === new Date(recordedAt).toDateString());
        if (pair) await healthAPI.deleteRecord(pair.id);
      }
      showSuccess('Record deleted');
      fetchData();
    } catch (error: any) {
      setFormErrors({ general: error.message || 'Failed to delete record' });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleEditSymptom = (symptom: Symptom) => {
    setModalType('symptom');
    setEditingSymptomId(symptom.id);
    setSymptomName(symptom.symptom_name);
    setSymptomSeverity(symptom.severity);
    const rawNotes = symptom.notes || '';
    const parts = rawNotes.split(' | ');
    const tagPart = parts.find((p) => p.startsWith('tags:'));
    setSymptomTags(tagPart ? tagPart.replace('tags:', '').split('|').filter(Boolean) : []);
    setNotes(parts.filter((p) => !p.startsWith('tags:')).join(' | '));
    setRecordedAtMode('custom');
    setRecordedAtCustom(new Date(symptom.recorded_at).toISOString().slice(0, 16));
    setShowAddModal(true);
  };

  const handleDeleteSymptom = async (id: string) => {
    if (!window.confirm('Delete this symptom entry?')) return;
    try {
      setActionBusyId(id);
      await healthAPI.deleteSymptom(id);
      showSuccess('Symptom deleted');
      fetchData();
    } catch (error: any) {
      setFormErrors({ general: error.message || 'Failed to delete symptom' });
    } finally {
      setActionBusyId(null);
    }
  };

  const VitalSignsTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {vitalTypes.map((vital) => {
          let vitalRecords = getRecordsByType(vital.id);
          // For blood pressure, combine systolic and diastolic
          if (vital.id === 'blood_pressure') {
            const systolicRecords = getRecordsByType('blood_pressure_systolic');
            const diastolicRecords = getRecordsByType('blood_pressure_diastolic');
            // Combine matching records
            vitalRecords = systolicRecords.map((s, i) => ({
              ...s,
              value: `${s.value}/${diastolicRecords[i]?.value || '--'}`,
            }));
          }
          const latest = vitalRecords[0];
        
        return (
          <div key={vital.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`${vital.color} p-2 rounded-lg`}>
                  <vital.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{vital.name}</h3>
                  <p className="text-sm text-gray-600">
                    {latest
                      ? vital.id === 'blood_pressure'
                        ? `Last: ${latest.value} ${vital.unit}`
                        : `Last: ${Number(convertCanonicalToDisplay(vital.id, Number(latest.value))).toFixed(1)} ${getDisplayUnit(vital.id, vital.unit)}`
                      : 'No records yet'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => openModal('vital', vital.id)}
                className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {vitalRecords.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Readings</h4>
                {vitalRecords.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">
                        {vital.id === 'blood_pressure'
                          ? `${record.value} ${record.unit}`
                          : `${Number(convertCanonicalToDisplay(vital.id, Number(record.value))).toFixed(1)} ${getDisplayUnit(vital.id, record.unit)}`}
                      </span>
                      {record.notes && <p className="text-sm text-gray-600">{record.notes}</p>}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      <span>{new Date(record.recorded_at).toLocaleString()}</span>
                      <button
                        onClick={() => handleEditRecord(record)}
                        className="text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Edit"
                        disabled={saving || actionBusyId === record.id}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(record.id, record.record_type, record.recorded_at)}
                        className="text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Delete"
                        disabled={saving || actionBusyId === record.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <vital.icon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No {vital.name.toLowerCase()} records yet</p>
                <p className="text-sm">Tap the + button to add your first reading</p>
              </div>
            )}
            <div className="mt-4">
              <MiniTrendChart
                type={vital.id === 'blood_pressure' ? 'blood_pressure_systolic' : vital.id}
                color="#e11d48"
                title={vital.name}
                unit={getDisplayUnit(vital.id === 'blood_pressure' ? 'blood_pressure_systolic' : vital.id, vital.unit)}
              />
            </div>
          </div>
        );
      })}
      </div>
    );
  };

  const SymptomsTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Symptom Tracker</h3>
            <button
              onClick={() => openModal('symptom')}
              className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Symptom</span>
            </button>
          </div>

          {symptoms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No symptoms recorded yet. Add your first symptom above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {symptoms.slice(0, 20).map((symptom) => (
                <div key={symptom.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="font-medium text-gray-900">{symptom.symptom_name}</span>
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`w-4 h-4 rounded-full ${
                              level <= symptom.severity ? 'bg-rose-500' : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">Severity: {symptom.severity}/5</span>
                    </div>
                    {symptom.notes && (
                      <p className="text-sm text-gray-600">{symptom.notes.split(' | ').filter((p) => !p.startsWith('tags:')).join(' | ')}</p>
                    )}
                    {(symptom.notes || '').includes('tags:') && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(((symptom.notes || '').split('tags:')[1]?.split('|') || []).filter(Boolean)).map((tag) => (
                          <span key={`${symptom.id}-${tag}`} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 ml-4 flex items-center gap-2">
                    <span>{new Date(symptom.recorded_at).toLocaleDateString()}</span>
                    <button
                      onClick={() => handleEditSymptom(symptom)}
                      className="text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Edit"
                      disabled={saving || actionBusyId === symptom.id}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSymptom(symptom.id)}
                      className="text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Delete"
                      disabled={saving || actionBusyId === symptom.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">💡 Symptom Tracking Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Rate symptoms on a scale of 1-5 (1 = mild, 5 = severe)</li>
            <li>• Track patterns to identify triggers</li>
            <li>• Note any medications or treatments used</li>
            <li>• Share this data with your healthcare provider</li>
          </ul>
        </div>
      </div>
    );
  };

  const SleepTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      );
    }

    const sleepHoursRecords = getRecordsByType('sleep_hours');
    const sleepQualityRecords = getRecordsByType('sleep_quality');
    const latestHours = sleepHoursRecords[0];
    const latestQuality = sleepQualityRecords[0];
    const weeklyAvg = sleepHoursRecords.slice(0, 7).reduce((sum, r) => sum + parseFloat(String(r.value)), 0) / Math.min(7, sleepHoursRecords.length);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Sleep Tracker</h3>
            <button
              onClick={() => openModal('sleep')}
              className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Log Sleep</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-6 bg-purple-50 rounded-xl">
              <Moon className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-600">{latestHours ? latestHours.value : '--'}</p>
              <p className="text-sm text-purple-700">Hours Last Night</p>
            </div>
            <div className="text-center p-6 bg-blue-50 rounded-xl">
              <Activity className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-600">{latestQuality ? `${Number(latestQuality.value) * 10}%` : '--'}</p>
              <p className="text-sm text-blue-700">Sleep Quality</p>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-xl">
              <Heart className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{weeklyAvg > 0 ? weeklyAvg.toFixed(1) : '--'}</p>
              <p className="text-sm text-green-700">Weekly Average</p>
            </div>
          </div>
          <MiniTrendChart type="sleep_hours" color="#7c3aed" title="Sleep Hours" unit="hours" />

          {sleepHoursRecords.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Sleep Records</h4>
              <div className="space-y-2">
                {sleepHoursRecords.slice(0, 7).map((record, index) => {
                  const qualityRecord = sleepQualityRecords[index];
                  return (
                    <div key={record.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{record.value} hours</span>
                        {qualityRecord && (
                          <span className="text-sm text-gray-600 ml-3">Quality: {qualityRecord.value}/10</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <span>{new Date(record.recorded_at).toLocaleDateString()}</span>
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Edit"
                          disabled={saving || actionBusyId === record.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id, record.record_type, record.recorded_at)}
                          className="text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Delete"
                          disabled={saving || actionBusyId === record.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">🌙 Sleep Recommendations</h4>
            <p className="text-sm text-amber-800">
              New mothers need 7-9 hours of sleep, but this can be challenging with a newborn. 
              Try to rest when your baby sleeps and don't hesitate to ask for help with night duties.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const NutritionTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        </div>
      );
    }

    const waterRecords = getRecordsByType('water_intake');
    const today = new Date().toDateString();
    const todayWater = waterRecords
      .filter(r => new Date(r.recorded_at).toDateString() === today)
      .reduce((sum, r) => sum + parseFloat(String(r.value)), 0);
    const targetWater = 8;
    const waterPercentage = Math.min((todayWater / targetWater) * 100, 100);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Nutrition & Hydration</h3>
            <button
              onClick={() => openModal('nutrition')}
              className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Entry</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="p-6 bg-blue-50 rounded-xl">
              <div className="flex items-center space-x-3 mb-4">
                <Droplets className="h-6 w-6 text-blue-500" />
                <h4 className="text-lg font-semibold text-blue-900">Water Intake</h4>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{convertCanonicalToDisplay('water_intake', todayWater).toFixed(1)}/{convertCanonicalToDisplay('water_intake', targetWater).toFixed(0)}</p>
                  <p className="text-sm text-blue-700">{unitPrefs.water} Today</p>
                </div>
                <div className="flex-1">
                  <div className="bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${waterPercentage}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-green-50 rounded-xl">
              <div className="flex items-center space-x-3 mb-4">
                <Heart className="h-6 w-6 text-green-500" />
                <h4 className="text-lg font-semibold text-green-900">Recent Records</h4>
              </div>
              {waterRecords.length > 0 ? (
                <div className="space-y-2">
                  {waterRecords.slice(0, 5).map((record) => (
                    <div key={record.id} className="flex justify-between items-center">
                      <span className="text-sm">{convertCanonicalToDisplay('water_intake', Number(record.value)).toFixed(1)} {unitPrefs.water}</span>
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <span>{new Date(record.recorded_at).toLocaleDateString()}</span>
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Edit"
                          disabled={saving || actionBusyId === record.id}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id, record.record_type, record.recorded_at)}
                          className="text-red-600 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Delete"
                          disabled={saving || actionBusyId === record.id}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No water intake records yet</p>
              )}
            </div>
          </div>
          <MiniTrendChart type="water_intake" color="#3b82f6" title="Water Intake" unit={unitPrefs.water} />

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">🥗 Nutrition Tips for Postpartum</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Stay hydrated - aim for 8-10 glasses of water daily</li>
              <li>• Include iron-rich foods to prevent anemia</li>
              <li>• Continue prenatal vitamins while breastfeeding</li>
              <li>• Eat frequent, nutritious meals to maintain energy</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Health Tracking</h1>
        <p className="text-gray-600">Monitor your postpartum health journey with detailed tracking and insights.</p>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Daily streak</p>
            <p className="text-lg font-semibold text-rose-600">{getDailyStreak()} days</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Trend Window</p>
            <div className="flex gap-2">
              <button onClick={() => setTrendDays(7)} className={`px-2 py-1 rounded text-xs ${trendDays === 7 ? 'bg-rose-500 text-white' : 'bg-gray-100'}`}>7d</button>
              <button onClick={() => setTrendDays(30)} className={`px-2 py-1 rounded text-xs ${trendDays === 30 ? 'bg-rose-500 text-white' : 'bg-gray-100'}`}>30d</button>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Unit Preferences</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <select value={unitPrefs.temperature} onChange={(e) => setUnitPrefs((prev) => ({ ...prev, temperature: e.target.value as 'F' | 'C' }))} className="border rounded px-2 py-1">
                <option value="F">F</option><option value="C">C</option>
              </select>
              <select value={unitPrefs.weight} onChange={(e) => setUnitPrefs((prev) => ({ ...prev, weight: e.target.value as 'lbs' | 'kg' }))} className="border rounded px-2 py-1">
                <option value="lbs">lbs</option><option value="kg">kg</option>
              </select>
              <select value={unitPrefs.water} onChange={(e) => setUnitPrefs((prev) => ({ ...prev, water: e.target.value as 'glasses' | 'ml' }))} className="border rounded px-2 py-1">
                <option value="glasses">glasses</option><option value="ml">ml</option>
              </select>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Reminders</p>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remindersEnabled} onChange={(e) => setRemindersEnabled(e.target.checked)} />
              Enable gentle reminders
            </label>
          </div>
        </div>
        {remindersEnabled && getDailyStreak() === 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            You have no log for today. A quick entry can help build better health insights.
          </div>
        )}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Correlation Insights</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {getCorrelationInsights().map((insight) => <li key={insight}>- {insight}</li>)}
          </ul>
        </div>
        <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Export + Clinician Share</h4>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-gray-600">Start</label>
              <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="block border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600">End</label>
              <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="block border rounded px-2 py-1 text-sm" />
            </div>
            <button onClick={exportClinicianSummary} className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm">
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button onClick={() => window.print()} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">Print Visit Summary (PDF)</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map((tab) => (
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
        {activeTab === 'vitals' && <VitalSignsTab />}
        {activeTab === 'symptoms' && <SymptomsTab />}
        {activeTab === 'sleep' && <SleepTab />}
        {activeTab === 'nutrition' && <NutritionTab />}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3 shadow-lg z-50">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {modalType === 'vital' ? 'Add Vital Sign' :
                 modalType === 'symptom' ? 'Add Symptom' :
                 modalType === 'sleep' ? 'Log Sleep' :
                 modalType === 'nutrition' ? 'Add Water Intake' : 'Add Health Record'}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
                disabled={saving}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formErrors.general && (
              <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{formErrors.general}</div>
            )}
            {softWarnings.length > 0 && (
              <div className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                <div className="flex items-center gap-1 font-medium"><AlertTriangle className="h-4 w-4" /> Soft warnings</div>
                {softWarnings.map((w) => <div key={w}>- {w}</div>)}
              </div>
            )}
            <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <label className="block text-xs font-medium text-gray-700 mb-2">Recorded at</label>
              <div className="flex flex-wrap gap-2 mb-2">
                <button type="button" onClick={() => setRecordedAtMode('now')} className={`px-2 py-1 text-xs rounded ${recordedAtMode === 'now' ? 'bg-rose-500 text-white' : 'bg-white border'}`}>Now</button>
                <button type="button" onClick={() => setRecordedAtMode('yesterday')} className={`px-2 py-1 text-xs rounded ${recordedAtMode === 'yesterday' ? 'bg-rose-500 text-white' : 'bg-white border'}`}>Yesterday</button>
                <button type="button" onClick={() => setRecordedAtMode('custom')} className={`px-2 py-1 text-xs rounded ${recordedAtMode === 'custom' ? 'bg-rose-500 text-white' : 'bg-white border'}`}>Custom</button>
              </div>
              {recordedAtMode === 'custom' && (
                <input type="datetime-local" value={recordedAtCustom} onChange={(e) => setRecordedAtCustom(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              )}
            </div>

            {/* Vital Signs Form */}
            {modalType === 'vital' && (
              <div className="space-y-4">
                {vitalType === 'blood_pressure' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Systolic (top number)</label>
                      <input
                        type="number"
                        value={systolicBP}
                        onChange={(e) => setSystolicBP(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        placeholder="e.g., 120"
                      />
                      {formErrors.systolicBP && <p className="text-xs text-red-600 mt-1">{formErrors.systolicBP}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Diastolic (bottom number)</label>
                      <input
                        type="number"
                        value={diastolicBP}
                        onChange={(e) => setDiastolicBP(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        placeholder="e.g., 80"
                      />
                      {formErrors.diastolicBP && <p className="text-xs text-red-600 mt-1">{formErrors.diastolicBP}</p>}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {vitalTypes.find(v => v.id === vitalType)?.name} Value
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitalValue}
                      onChange={(e) => setVitalValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                      placeholder={`Enter ${vitalTypes.find(v => v.id === vitalType)?.name.toLowerCase()}`}
                    />
                    {formErrors.vitalValue && <p className="text-xs text-red-600 mt-1">{formErrors.vitalValue}</p>}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="Any additional notes..."
                  />
                </div>
                <button
                  onClick={handleSaveVital}
                  disabled={saving}
                  className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white py-2 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            )}

            {/* Symptoms Form */}
            {modalType === 'symptom' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Symptom Name</label>
                  <input
                    type="text"
                    value={symptomName}
                    onChange={(e) => setSymptomName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="e.g., Headache, Fatigue, etc."
                  />
                  {formErrors.symptomName && <p className="text-xs text-red-600 mt-1">{formErrors.symptomName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {symptomLibrary.map((chip) => (
                      <button type="button" key={chip} onClick={() => setSymptomName(chip)} className="px-2 py-1 text-xs rounded-full border border-rose-200 text-rose-700 hover:bg-rose-50">{chip}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Severity (1-5)</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setSymptomSeverity(level)}
                        className={`flex-1 py-2 rounded-lg border-2 transition-colors ${
                          symptomSeverity === level
                            ? 'border-rose-500 bg-rose-500 text-white'
                            : 'border-gray-300 hover:border-rose-300'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">1 = Mild, 5 = Severe</p>
                  {formErrors.symptomSeverity && <p className="text-xs text-red-600 mt-1">{formErrors.symptomSeverity}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <div className="flex items-center gap-2">
                    <input value={customSymptomTag} onChange={(e) => setCustomSymptomTag(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" placeholder="Add custom tag" />
                    <button type="button" onClick={() => {
                      const tag = customSymptomTag.trim();
                      if (tag && !symptomTags.includes(tag)) setSymptomTags((prev) => [...prev, tag]);
                      setCustomSymptomTag('');
                    }} className="px-3 py-2 border rounded-lg">Add</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {symptomTags.map((tag) => (
                      <button type="button" key={tag} onClick={() => setSymptomTags((prev) => prev.filter((t) => t !== tag))} className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs">{tag} x</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="Any additional details..."
                  />
                </div>
                <button
                  onClick={handleSaveSymptom}
                  disabled={saving}
                  className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white py-2 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            )}

            {/* Sleep Form */}
            {modalType === 'sleep' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sleep Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="e.g., 7.5"
                  />
                  {formErrors.sleepHours && <p className="text-xs text-red-600 mt-1">{formErrors.sleepHours}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sleep Quality (1-10)</label>
                  <div className="flex space-x-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                      <button
                        key={level}
                        onClick={() => setSleepQuality(level)}
                        className={`flex-1 py-2 rounded-lg border-2 transition-colors text-sm ${
                          sleepQuality === level
                            ? 'border-purple-500 bg-purple-500 text-white'
                            : 'border-gray-300 hover:border-purple-300'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">1 = Poor, 10 = Excellent</p>
                  {formErrors.sleepQuality && <p className="text-xs text-red-600 mt-1">{formErrors.sleepQuality}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="Any additional details..."
                  />
                </div>
                <button
                  onClick={handleSaveSleep}
                  disabled={saving}
                  className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white py-2 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            )}

            {/* Nutrition Form */}
            {modalType === 'nutrition' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{`Water Intake (${unitPrefs.water})`}</label>
                  <input
                    type="number"
                    value={waterIntake}
                    onChange={(e) => setWaterIntake(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder={unitPrefs.water === 'ml' ? 'e.g., 500' : 'e.g., 2'}
                  />
                  {formErrors.waterIntake && <p className="text-xs text-red-600 mt-1">{formErrors.waterIntake}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    placeholder="Any additional details..."
                  />
                </div>
                <button
                  onClick={handleSaveNutrition}
                  disabled={saving}
                  className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-gray-300 text-white py-2 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthTracking;