import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Globe, Heart, MapPin, MessageCircle, Phone, Shield, Users } from 'lucide-react';
import { emergencyAPI, getAccessToken } from '../services/api';
import { useNavigate } from 'react-router-dom';

type Language = 'en' | 'hi' | 'mr';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  sms?: string;
  description: string;
  availability: string;
}

interface TrustedContact {
  name: string;
  phone: string;
  relationship: string;
  email?: string;
}

interface SafetyPlan {
  warningSigns: string[];
  copingActions: string[];
  trustedPeople: string[];
  emergencySteps: string[];
}

const defaultPlan: SafetyPlan = {
  warningSigns: [],
  copingActions: [],
  trustedPeople: [],
  emergencySteps: []
};

const translationMap: Record<Language, Record<string, string>> = {
  en: {
    title: 'Emergency Resources',
    subtitle: 'Immediate support when you need it most',
    sos: 'Trigger SOS Now',
    followup: 'Post-Crisis Follow-up',
    safetyPlan: 'Safety Plan Builder',
    shareLocation: 'Share Location Link',
    callTrusted: 'Call Trusted Contact',
    immediateScript: 'Immediate Script',
    emergencyContacts: 'Emergency Contacts (Live)',
    loadingContacts: 'Loading emergency contacts...',
    locationRouting: 'Location-Aware Quick Routing',
    hospital: 'Hospital',
    police: 'Police',
    womenCell: 'Women Cell',
    ambulance: 'Ambulance',
    trustedContactSection: 'Trusted Contact Integration',
    locationLabel: 'Location',
    name: 'Name',
    phone: 'Phone',
    relationship: 'Relationship',
    nameRequired: 'Name is required',
    phoneRequired: 'Phone is required',
    relationshipRequired: 'Relationship is required',
    emailOptional: 'Email (optional)',
    saveTrustedContact: 'Save Trusted Contact',
    sendAlertMessage: 'Send Alert Message',
    grounding: 'Start Grounding Steps',
    bookConsultation: 'Book Consultation',
    notifyClinician: 'Notify Clinician',
    call: 'Call',
    selfCare: 'Self-Care Strategies',
    immediateComfort: 'Immediate Comfort',
    shortTermSupport: 'Short-term Support',
    longTermWellness: 'Long-term Wellness',
    immediateComfortDesc: 'Slow breathing, hydration, and contact someone trusted.',
    shortTermSupportDesc: 'Accept help, rest, and seek professional support quickly.',
    longTermWellnessDesc: 'Build routines, strengthen support network, keep follow-ups.',
    statusLocationUnsupported: 'Location is not supported on this device.',
    statusLocationCaptured: 'Location link captured.',
    statusLocationDenied: 'Location permission denied. You can still call emergency numbers.',
    statusTrustedMissing: 'Please save a trusted contact number first.',
    statusTrustedValidation: 'Please enter trusted contact name, phone, and relationship before saving.',
    statusTrustedSaved: 'Trusted contact saved.',
    statusTrustedSaveFailed: 'Failed to save trusted contact.',
    statusPlanValidation: 'Please enter safety plan information before saving.',
    statusPlanAtLeastOne: 'Please add at least one safety plan item before saving.',
    statusPleaseCallNow: 'Please call me immediately.',
    statusPleaseCallMeNow: 'Please call me now.',
    statusAlertPhoneMissing: 'Please add a trusted contact phone first.',
    statusSOSSuccess: 'SOS triggered. Alert logged and emergency call initiated.',
    statusSOSFailed: 'SOS failed. Please call emergency number manually.',
    statusClinicianLogged: 'Clinician follow-up request logged.',
    statusClinicianFailed: 'Unable to notify clinician right now.',
    statusGrounding: 'Start with 5-4-3-2-1 grounding and deep breathing.'
  },
  hi: {
    title: 'आपातकालीन सहायता',
    subtitle: 'ज़रूरत पड़ने पर तुरंत सहायता',
    sos: 'अभी SOS ट्रिगर करें',
    followup: 'संकट के बाद फॉलो-अप',
    safetyPlan: 'सुरक्षा योजना बनाएं',
    shareLocation: 'लोकेशन लिंक साझा करें',
    callTrusted: 'विश्वसनीय संपर्क को कॉल करें',
    immediateScript: 'तुरंत बोलने के लिए संदेश',
    emergencyContacts: 'आपातकालीन संपर्क (लाइव)',
    loadingContacts: 'आपातकालीन संपर्क लोड हो रहे हैं...',
    locationRouting: 'स्थान-आधारित त्वरित सहायता',
    hospital: 'अस्पताल',
    police: 'पुलिस',
    womenCell: 'महिला हेल्पलाइन',
    ambulance: 'एम्बुलेंस',
    trustedContactSection: 'विश्वसनीय संपर्क विवरण',
    locationLabel: 'लोकेशन',
    name: 'नाम',
    phone: 'फोन',
    relationship: 'रिश्ता',
    nameRequired: 'नाम आवश्यक है',
    phoneRequired: 'फोन आवश्यक है',
    relationshipRequired: 'रिश्ता आवश्यक है',
    emailOptional: 'ईमेल (वैकल्पिक)',
    saveTrustedContact: 'विश्वसनीय संपर्क सेव करें',
    sendAlertMessage: 'अलर्ट संदेश भेजें',
    grounding: 'ग्राउंडिंग शुरू करें',
    bookConsultation: 'कंसल्टेशन बुक करें',
    notifyClinician: 'क्लिनिशियन को सूचित करें',
    call: 'कॉल',
    selfCare: 'स्व-देखभाल रणनीतियां',
    immediateComfort: 'तुरंत आराम',
    shortTermSupport: 'अल्पकालिक सहायता',
    longTermWellness: 'दीर्घकालिक स्वास्थ्य',
    immediateComfortDesc: 'धीरे-धीरे सांस लें, पानी पिएं, और किसी भरोसेमंद व्यक्ति से संपर्क करें।',
    shortTermSupportDesc: 'मदद स्वीकार करें, आराम करें, और जल्दी पेशेवर सहायता लें।',
    longTermWellnessDesc: 'दिनचर्या बनाएं, सपोर्ट नेटवर्क मजबूत करें, और फॉलो-अप जारी रखें।',
    statusLocationUnsupported: 'इस डिवाइस में लोकेशन सुविधा उपलब्ध नहीं है।',
    statusLocationCaptured: 'लोकेशन लिंक मिल गया।',
    statusLocationDenied: 'लोकेशन अनुमति नहीं मिली। फिर भी आपातकालीन नंबर पर कॉल कर सकते हैं।',
    statusTrustedMissing: 'पहले विश्वसनीय संपर्क नंबर सेव करें।',
    statusTrustedValidation: 'सेव करने से पहले नाम, फोन और रिश्ता भरें।',
    statusTrustedSaved: 'विश्वसनीय संपर्क सेव हो गया।',
    statusTrustedSaveFailed: 'विश्वसनीय संपर्क सेव नहीं हो पाया।',
    statusPlanValidation: 'सेव करने से पहले सुरक्षा योजना की जानकारी भरें।',
    statusPlanAtLeastOne: 'सेव करने से पहले कम से कम एक सुरक्षा योजना बिंदु जोड़ें।',
    statusPleaseCallNow: 'कृपया मुझे तुरंत कॉल करें।',
    statusPleaseCallMeNow: 'कृपया मुझे अभी कॉल करें।',
    statusAlertPhoneMissing: 'पहले विश्वसनीय संपर्क का फोन जोड़ें।',
    statusSOSSuccess: 'SOS ट्रिगर हो गया। अलर्ट लॉग हो गया और कॉल शुरू हो गई।',
    statusSOSFailed: 'SOS विफल रहा। कृपया आपातकालीन नंबर पर मैन्युअली कॉल करें।',
    statusClinicianLogged: 'क्लिनिशियन फॉलो-अप अनुरोध लॉग हो गया।',
    statusClinicianFailed: 'अभी क्लिनिशियन को सूचित नहीं कर सके।',
    statusGrounding: '5-4-3-2-1 ग्राउंडिंग और गहरी सांस से शुरू करें।'
  },
  mr: {
    title: 'आपत्कालीन मदत',
    subtitle: 'गरज असताना त्वरित मदत',
    sos: 'आता SOS ट्रिगर करा',
    followup: 'संकटनंतर फॉलो-अप',
    safetyPlan: 'सुरक्षा योजना तयार करा',
    shareLocation: 'लोकेशन लिंक शेअर करा',
    callTrusted: 'विश्वासू संपर्काला कॉल करा',
    immediateScript: 'तात्काळ सांगण्यासाठी संदेश',
    emergencyContacts: 'आपत्कालीन संपर्क (लाइव्ह)',
    loadingContacts: 'आपत्कालीन संपर्क लोड होत आहेत...',
    locationRouting: 'स्थानानुसार त्वरित मदत',
    hospital: 'रुग्णालय',
    police: 'पोलीस',
    womenCell: 'महिला हेल्पलाइन',
    ambulance: 'अॅम्ब्युलन्स',
    trustedContactSection: 'विश्वासू संपर्क माहिती',
    locationLabel: 'लोकेशन',
    name: 'नाव',
    phone: 'फोन',
    relationship: 'नाते',
    nameRequired: 'नाव आवश्यक आहे',
    phoneRequired: 'फोन आवश्यक आहे',
    relationshipRequired: 'नाते आवश्यक आहे',
    emailOptional: 'ईमेल (पर्यायी)',
    saveTrustedContact: 'विश्वासू संपर्क सेव करा',
    sendAlertMessage: 'अलर्ट संदेश पाठवा',
    grounding: 'ग्राउंडिंग सुरू करा',
    bookConsultation: 'कन्सल्टेशन बुक करा',
    notifyClinician: 'क्लिनिशियनला कळवा',
    call: 'कॉल',
    selfCare: 'स्व-देखभाल उपाय',
    immediateComfort: 'तात्काळ आराम',
    shortTermSupport: 'अल्पकालीन मदत',
    longTermWellness: 'दीर्घकालीन आरोग्य',
    immediateComfortDesc: 'हळू श्वास घ्या, पाणी प्या आणि विश्वासू व्यक्तीशी संपर्क करा.',
    shortTermSupportDesc: 'मदत स्वीकारा, विश्रांती घ्या आणि लवकर तज्ञांची मदत घ्या.',
    longTermWellnessDesc: 'दिनचर्या ठेवा, सपोर्ट नेटवर्क मजबूत करा आणि फॉलो-अप सुरू ठेवा.',
    statusLocationUnsupported: 'या डिव्हाइसवर लोकेशन सुविधा उपलब्ध नाही.',
    statusLocationCaptured: 'लोकेशन लिंक मिळाली.',
    statusLocationDenied: 'लोकेशन परवानगी मिळाली नाही. तरीही आपत्कालीन नंबरवर कॉल करू शकता.',
    statusTrustedMissing: 'कृपया आधी विश्वासू संपर्क क्रमांक सेव करा.',
    statusTrustedValidation: 'सेव करण्यापूर्वी नाव, फोन आणि नाते भरा.',
    statusTrustedSaved: 'विश्वासू संपर्क सेव झाला.',
    statusTrustedSaveFailed: 'विश्वासू संपर्क सेव झाला नाही.',
    statusPlanValidation: 'सेव करण्यापूर्वी सुरक्षा योजनेची माहिती भरा.',
    statusPlanAtLeastOne: 'सेव करण्यापूर्वी किमान एक सुरक्षा योजना मुद्दा जोडा.',
    statusPleaseCallNow: 'कृपया मला त्वरित कॉल करा.',
    statusPleaseCallMeNow: 'कृपया मला आत्ताच कॉल करा.',
    statusAlertPhoneMissing: 'कृपया आधी विश्वासू संपर्काचा फोन भरा.',
    statusSOSSuccess: 'SOS ट्रिगर झाला. अलर्ट लॉग झाला आणि कॉल सुरू झाला.',
    statusSOSFailed: 'SOS अयशस्वी. कृपया आपत्कालीन नंबरवर थेट कॉल करा.',
    statusClinicianLogged: 'क्लिनिशियन फॉलो-अप विनंती लॉग झाली.',
    statusClinicianFailed: 'आत्ता क्लिनिशियनला कळवता आले नाही.',
    statusGrounding: '5-4-3-2-1 ग्राउंडिंग आणि खोल श्वास घेण्यापासून सुरू करा.'
  }
};

const sanitizePhone = (phone: string) => (phone || '').replace(/[^\d+]/g, '');
const openCall = (phone: string) => {
  const cleaned = sanitizePhone(phone);
  if (!cleaned) return;
  window.location.href = `tel:${cleaned}`;
};
const openSms = (phone: string, body: string) => {
  const cleaned = sanitizePhone(phone);
  if (!cleaned) return;
  window.location.href = `sms:${cleaned}?body=${encodeURIComponent(body)}`;
};
const uniqueByPhone = (contacts: EmergencyContact[]) => {
  const seen = new Set<string>();
  return contacts.filter((item) => {
    if (seen.has(item.phone)) return false;
    seen.add(item.phone);
    return true;
  });
};

const Emergency: React.FC = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>('en');
  const [selectedState, setSelectedState] = useState('national');
  const [states, setStates] = useState<{ id: string; name: string }[]>([]);
  const [contactsByType, setContactsByType] = useState<{ crisis: EmergencyContact[]; medical: EmergencyContact[]; support: EmergencyContact[] }>({
    crisis: [],
    medical: [],
    support: []
  });
  const [nearest, setNearest] = useState<{ hospital?: string; police?: string; womenCell?: string; ambulance?: string }>({});
  const [localizedScript, setLocalizedScript] = useState({ sos: 'I need immediate support', calm: 'Help is available' });
  const [trustedContact, setTrustedContact] = useState<TrustedContact>({ name: '', phone: '', relationship: '', email: '' });
  const [safetyPlan, setSafetyPlan] = useState<SafetyPlan>(defaultPlan);
  const [sosStatus, setSosStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationLink, setLocationLink] = useState('');
  const [trustedErrors, setTrustedErrors] = useState<{ name?: string; phone?: string; relationship?: string }>({});
  const [planError, setPlanError] = useState<string>('');

  const t = translationMap[language];
  const emergencyCacheKey = useMemo(() => {
    try {
      const token = getAccessToken();
      if (!token) return 'emergency_cached_data_guest';
      const parts = token.split('.');
      if (parts.length !== 3) return 'emergency_cached_data_guest';
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return `emergency_cached_data_${payload?.sub || payload?.id || 'guest'}`;
    } catch {
      return 'emergency_cached_data_guest';
    }
  }, []);
  const trackEvent = (eventType: string, metadata?: Record<string, unknown>) => {
    return emergencyAPI.trackEvent(eventType, metadata).catch(() => null);
  };

  const allContacts = useMemo(
    () => uniqueByPhone([...(contactsByType.crisis || []), ...(contactsByType.medical || []), ...(contactsByType.support || [])]),
    [contactsByType]
  );

  const cacheEmergencyData = (payload: any) => {
    localStorage.setItem(emergencyCacheKey, JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }));
  };

  const hydrateFromCache = () => {
    const raw = localStorage.getItem(emergencyCacheKey);
    if (!raw) return false;
    try {
      const cached = JSON.parse(raw);
      setContactsByType(cached.contactsByType || { crisis: [], medical: [], support: [] });
      setNearest(cached.nearest || {});
      setLocalizedScript(cached.localizedScript || localizedScript);
      if (cached.selectedState) setSelectedState(cached.selectedState);
      if (cached.language) setLanguage(cached.language);
      return true;
    } catch {
      return false;
    }
  };

  const loadEmergencyData = async () => {
    setLoading(true);
    const [statesResult, resourcesResult, trustedResult, planResult] = await Promise.allSettled([
        emergencyAPI.getStates(),
        emergencyAPI.getResources({ state: selectedState, language }),
        emergencyAPI.getTrustedContact(),
        emergencyAPI.getSafetyPlan()
      ]);
    try {
      const statesResponse = statesResult.status === 'fulfilled' ? statesResult.value : null;
      const resourcesResponse = resourcesResult.status === 'fulfilled' ? resourcesResult.value : null;
      const trustedResponse = trustedResult.status === 'fulfilled' ? trustedResult.value : null;
      const planResponse = planResult.status === 'fulfilled' ? planResult.value : null;

      if (statesResponse?.success) {
        setStates(statesResponse.data?.states || []);
      }

      if (resourcesResponse?.success) {
        const resources = resourcesResponse.data?.resources || {};
        setContactsByType({
          crisis: resources.crisis || [],
          medical: resources.medical || [],
          support: resources.support || []
        });
        setNearest(resources.nearest || {});
        setLocalizedScript(resourcesResponse.data?.script || localizedScript);
      }

      if (trustedResponse?.success && trustedResponse.data?.contact) {
        setTrustedContact({
          name: trustedResponse.data.contact.name || '',
          phone: trustedResponse.data.contact.phone || '',
          relationship: trustedResponse.data.contact.relationship || '',
          email: trustedResponse.data.contact.email || ''
        });
      }

      if (planResponse?.success && planResponse.data?.plan) {
        setSafetyPlan({
          warningSigns: planResponse.data.plan.warningSigns || [],
          copingActions: planResponse.data.plan.copingActions || [],
          trustedPeople: planResponse.data.plan.trustedPeople || [],
          emergencySteps: planResponse.data.plan.emergencySteps || []
        });
      }

      cacheEmergencyData({
        contactsByType: {
          crisis: resourcesResponse?.data?.resources?.crisis || [],
          medical: resourcesResponse?.data?.resources?.medical || [],
          support: resourcesResponse?.data?.resources?.support || []
        },
        nearest: resourcesResponse?.data?.resources?.nearest || {},
        localizedScript: resourcesResponse?.data?.script || localizedScript,
        selectedState,
        language
      });
    } catch {
      // ignore; cache fallback below
    } finally {
      if (resourcesResult.status !== 'fulfilled') {
        hydrateFromCache();
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmergencyData();
  }, [selectedState, language]);

  const saveTrustedContact = async () => {
    const errors: { name?: string; phone?: string; relationship?: string } = {};
    if (!trustedContact.name.trim()) errors.name = t.nameRequired;
    if (!trustedContact.phone.trim()) errors.phone = t.phoneRequired;
    if (!trustedContact.relationship.trim()) errors.relationship = t.relationshipRequired;

    if (Object.keys(errors).length > 0) {
      setTrustedErrors(errors);
      setSosStatus(t.statusTrustedValidation);
      window.alert(t.statusTrustedValidation);
      return;
    }

    setTrustedErrors({});
    try {
      await emergencyAPI.saveTrustedContact(trustedContact);
      await trackEvent('trusted_contact_saved', { hasEmail: !!trustedContact.email });
      setSosStatus(t.statusTrustedSaved);
    } catch {
      setSosStatus(t.statusTrustedSaveFailed);
    }
  };

  const savePlan = async () => {
    const hasAnyPlanContent =
      safetyPlan.warningSigns.length > 0 ||
      safetyPlan.copingActions.length > 0 ||
      safetyPlan.trustedPeople.length > 0 ||
      safetyPlan.emergencySteps.length > 0;

    if (!hasAnyPlanContent) {
      setPlanError(t.statusPlanAtLeastOne);
      setSosStatus(t.statusPlanValidation);
      window.alert(t.statusPlanValidation);
      return;
    }

    setPlanError('');
    try {
      await emergencyAPI.saveSafetyPlan(safetyPlan);
      await trackEvent('safety_plan_saved', { warningSigns: safetyPlan.warningSigns.length });
      setSosStatus('Safety plan saved.');
    } catch {
      setSosStatus('Failed to save safety plan.');
    }
  };

  const updatePlanText = (key: keyof SafetyPlan, value: string) => {
    const items = value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    setSafetyPlan((prev) => ({ ...prev, [key]: items }));
  };

  const requestLocationLink = async () => {
    if (!navigator.geolocation) {
      setSosStatus(t.statusLocationUnsupported);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const link = `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
        setLocationLink(link);
        setSosStatus(t.statusLocationCaptured);
      },
      () => setSosStatus(t.statusLocationDenied)
    );
  };

  const triggerSOS = async () => {
    try {
      await trackEvent('sos_triggered', { state: selectedState, language });
      await emergencyAPI.logAlert({
        type: 'sos',
        message: localizedScript.sos,
        location: locationLink || undefined,
        state: selectedState,
        language,
        trustedContact: trustedContact?.phone ? trustedContact : null
      });

      if (trustedContact?.phone) {
        openSms(
          trustedContact.phone,
          `${localizedScript.sos}. ${locationLink ? `Location: ${locationLink}` : t.statusPleaseCallNow}`
        );
      }

      const firstCrisis = contactsByType.crisis?.[0] || contactsByType.medical?.[0];
      if (firstCrisis?.phone) {
        openCall(firstCrisis.phone);
      }
      setSosStatus(t.statusSOSSuccess);
    } catch {
      setSosStatus(t.statusSOSFailed);
    }
  };

  const notifyClinician = async () => {
    try {
      await emergencyAPI.logAlert({
        type: 'notify_clinician',
        message: 'Post-crisis follow-up requested',
        state: selectedState,
        language
      });
      await trackEvent('notify_clinician_clicked', {});
      setSosStatus(t.statusClinicianLogged);
    } catch {
      setSosStatus(t.statusClinicianFailed);
    }
  };

  const callTrustedNow = () => {
    if (trustedContact.phone) {
      openCall(trustedContact.phone);
      trackEvent('trusted_contact_called', {});
    } else {
      setSosStatus(t.statusTrustedMissing);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-red-500 p-3 rounded-xl">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
              <p className="text-gray-600">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 text-gray-500" />
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="border rounded-lg px-3 py-2">
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
            <MapPin className="h-4 w-4 text-gray-500" />
            <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="border rounded-lg px-3 py-2">
              {states.length === 0 ? <option value="national">National</option> : states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={requestLocationLink} className="bg-gray-100 hover:bg-gray-200 rounded-lg p-3 text-sm font-medium">
            {t.shareLocation}
          </button>
          <button onClick={callTrustedNow} className="bg-amber-100 hover:bg-amber-200 rounded-lg p-3 text-sm font-medium">
            {t.callTrusted}
          </button>
          <button onClick={triggerSOS} className="bg-red-600 hover:bg-red-700 text-white rounded-lg p-3 text-sm font-semibold">
            {t.sos}
          </button>
        </div>
        {locationLink && <p className="text-xs text-blue-700 mt-3 break-all">{t.locationLabel}: {locationLink}</p>}
        {sosStatus && <p className="text-sm text-red-700 mt-3">{sosStatus}</p>}
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <AlertTriangle className="h-8 w-8 text-red-600 mt-1 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-semibold text-red-900 mb-2">{t.immediateScript}</h2>
            <p className="text-red-800 mb-2">{localizedScript.sos}</p>
            <p className="text-sm text-red-700">{localizedScript.calm}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">{t.emergencyContacts}</h2>
        {loading ? (
          <div className="text-gray-600">{t.loadingContacts}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allContacts.map((contact) => (
              <div key={contact.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-red-500 p-2 rounded-lg">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{contact.availability}</span>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-4">{contact.description}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      openCall(contact.phone);
                      trackEvent('contact_called', { contactId: contact.id });
                    }}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {t.call} {contact.phone}
                  </button>
                  {contact.sms && (
                    <button
                      onClick={() => {
                        openSms(contact.sms as string, localizedScript.sos);
                        trackEvent('contact_sms', { contactId: contact.id });
                      }}
                      className="px-4 py-2 border border-rose-300 text-rose-700 rounded-lg text-sm font-medium"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">{t.locationRouting}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <button className="bg-white rounded-lg p-3 border" onClick={() => openCall(nearest.hospital || '108')}>{t.hospital} ({nearest.hospital || '108'})</button>
          <button className="bg-white rounded-lg p-3 border" onClick={() => openCall(nearest.police || '112')}>{t.police} ({nearest.police || '112'})</button>
          <button className="bg-white rounded-lg p-3 border" onClick={() => openCall(nearest.womenCell || '181')}>{t.womenCell} ({nearest.womenCell || '181'})</button>
          <button className="bg-white rounded-lg p-3 border" onClick={() => openCall(nearest.ambulance || '108')}>{t.ambulance} ({nearest.ambulance || '108'})</button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">{t.trustedContactSection}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              className={`border rounded-lg px-3 py-2 w-full ${trustedErrors.name ? 'border-red-500' : ''}`}
              placeholder={t.name}
              value={trustedContact.name}
              onChange={(e) => {
                setTrustedContact((prev) => ({ ...prev, name: e.target.value }));
                setTrustedErrors((prev) => ({ ...prev, name: undefined }));
              }}
            />
            {trustedErrors.name && <p className="text-xs text-red-600 mt-1">{trustedErrors.name}</p>}
          </div>
          <div>
            <input
              className={`border rounded-lg px-3 py-2 w-full ${trustedErrors.phone ? 'border-red-500' : ''}`}
              placeholder={t.phone}
              value={trustedContact.phone}
              onChange={(e) => {
                setTrustedContact((prev) => ({ ...prev, phone: e.target.value }));
                setTrustedErrors((prev) => ({ ...prev, phone: undefined }));
              }}
            />
            {trustedErrors.phone && <p className="text-xs text-red-600 mt-1">{trustedErrors.phone}</p>}
          </div>
          <div>
            <input
              className={`border rounded-lg px-3 py-2 w-full ${trustedErrors.relationship ? 'border-red-500' : ''}`}
              placeholder={t.relationship}
              value={trustedContact.relationship}
              onChange={(e) => {
                setTrustedContact((prev) => ({ ...prev, relationship: e.target.value }));
                setTrustedErrors((prev) => ({ ...prev, relationship: undefined }));
              }}
            />
            {trustedErrors.relationship && <p className="text-xs text-red-600 mt-1">{trustedErrors.relationship}</p>}
          </div>
          <input className="border rounded-lg px-3 py-2" placeholder={t.emailOptional} value={trustedContact.email || ''} onChange={(e) => setTrustedContact((prev) => ({ ...prev, email: e.target.value }))} />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={saveTrustedContact} className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg">{t.saveTrustedContact}</button>
          <button
            onClick={() => {
              if (!trustedContact.phone) {
                setSosStatus(t.statusAlertPhoneMissing);
                return;
              }
              openSms(trustedContact.phone, `${localizedScript.sos}. ${t.statusPleaseCallMeNow}`);
              trackEvent('trusted_contact_sms', {});
            }}
            className="border border-rose-300 text-rose-700 px-4 py-2 rounded-lg"
          >
            {t.sendAlertMessage}
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-emerald-900 mb-3">{t.followup}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button onClick={() => { trackEvent('grounding_started', {}); setSosStatus(t.statusGrounding); }} className="bg-white rounded-lg p-3 border text-sm">{t.grounding}</button>
          <button onClick={() => { trackEvent('book_consult_clicked', {}); navigate('/mental-health'); }} className="bg-white rounded-lg p-3 border text-sm">{t.bookConsultation}</button>
          <button onClick={notifyClinician} className="bg-white rounded-lg p-3 border text-sm">{t.notifyClinician}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.selfCare}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-gray-50"><div className="flex items-center gap-2 font-medium mb-2"><Heart className="h-4 w-4 text-rose-500" /> {t.immediateComfort}</div><p>{t.immediateComfortDesc}</p></div>
          <div className="p-4 rounded-lg bg-gray-50"><div className="flex items-center gap-2 font-medium mb-2"><Users className="h-4 w-4 text-purple-500" /> {t.shortTermSupport}</div><p>{t.shortTermSupportDesc}</p></div>
          <div className="p-4 rounded-lg bg-gray-50"><div className="flex items-center gap-2 font-medium mb-2"><Shield className="h-4 w-4 text-blue-500" /> {t.longTermWellness}</div><p>{t.longTermWellnessDesc}</p></div>
        </div>
      </div>
    </div>
  );
};

export default Emergency;