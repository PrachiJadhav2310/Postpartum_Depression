const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { sendHealthAlertEmail } = require('../services/emailService');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'emergency-alerts.json');
const SAFETY_PLAN_FILE = path.join(DATA_DIR, 'emergency-safety-plans.json');
const TRUSTED_CONTACT_FILE = path.join(DATA_DIR, 'emergency-trusted-contacts.json');
const EVENTS_FILE = path.join(DATA_DIR, 'emergency-events.json');

const CONTACTS_BY_STATE = {
  national: {
    crisis: [
      { id: 'telemanas', name: 'Tele-MANAS Mental Health Helpline', phone: '14416', sms: '18008914416', description: 'National tele-mental health support', availability: '24/7' },
      { id: 'women', name: 'Women Helpline', phone: '181', description: 'Support for women in distress', availability: '24/7' }
    ],
    medical: [
      { id: 'nres', name: 'National Emergency Number', phone: '112', description: 'Life-threatening emergencies', availability: '24/7' },
      { id: 'ambulance', name: 'Ambulance Services', phone: '108', description: 'Emergency ambulance and transport', availability: '24/7' },
      { id: 'healthline', name: 'National Health Helpline', phone: '104', description: 'Medical guidance and support', availability: '24/7' }
    ],
    support: [
      { id: 'childline', name: 'CHILDLINE', phone: '1098', description: 'Emergency support for children', availability: '24/7' }
    ],
    nearest: {
      hospital: '108',
      police: '112',
      womenCell: '181',
      ambulance: '108'
    }
  },
  maharashtra: {
    nearest: {
      hospital: '108',
      police: '112',
      womenCell: '181',
      ambulance: '108'
    }
  },
  delhi: {
    nearest: {
      hospital: '102',
      police: '112',
      womenCell: '181',
      ambulance: '102'
    }
  },
  karnataka: {
    nearest: {
      hospital: '108',
      police: '112',
      womenCell: '181',
      ambulance: '108'
    }
  }
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const nowIso = () => new Date().toISOString();
const alertId = () => `alert_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
const readJson = async (filePath, fallback = []) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};
const writeJson = async (filePath, value) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
};
const getLocalizedScript = (language = 'en') => {
  const scripts = {
    en: {
      sos: 'I need immediate help. Please stay with me and call emergency support.',
      calm: 'Breathe slowly. You are not alone. Help is on the way.'
    },
    hi: {
      sos: 'Mujhe turant madad chahiye. Kripya mere saath rahiye aur emergency support ko call kijiye.',
      calm: 'Dheere saans lijiye. Aap akeli nahi hain. Madad raste mein hai.'
    },
    mr: {
      sos: 'Mala tvarit madat havi aahe. Krupaya majhyasobat raha ani emergency support la call kara.',
      calm: 'Halu shwas ghya. Tumhi ekte nahi. Madat yet aahe.'
    }
  };
  return scripts[language] || scripts.en;
};
const getStateResources = (state = 'national') => {
  const lower = String(state || 'national').toLowerCase();
  const base = clone(CONTACTS_BY_STATE.national);
  const override = CONTACTS_BY_STATE[lower] || {};
  return {
    ...base,
    ...override,
    nearest: { ...base.nearest, ...(override.nearest || {}) }
  };
};

router.get('/states', (req, res) => {
  res.json({
    success: true,
    data: {
      states: Object.keys(CONTACTS_BY_STATE).map((key) => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1)
      }))
    }
  });
});

router.get('/resources', (req, res) => {
  try {
    const { type, state = 'national', language = 'en' } = req.query;
    const resources = getStateResources(state);
    const data = type && resources[type] ? { [type]: resources[type] } : resources;
    res.json({
      success: true,
      data: {
        resources: data,
        state,
        language,
        script: getLocalizedScript(language)
      }
    });
  } catch (error) {
    logger.error('Get emergency resources error:', error);
    res.status(500).json({ success: false, message: 'Failed to get emergency resources' });
  }
});

router.get('/trusted-contact', authenticateToken, async (req, res) => {
  try {
    const contacts = await readJson(TRUSTED_CONTACT_FILE, []);
    const contact = contacts.find((entry) => entry.userId === req.user.id) || null;
    res.json({ success: true, data: { contact } });
  } catch (error) {
    logger.error('Get trusted contact error:', error);
    res.status(500).json({ success: false, message: 'Failed to load trusted contact' });
  }
});

router.put('/trusted-contact', authenticateToken, async (req, res) => {
  try {
    const { name, phone, relationship, email } = req.body || {};
    const contacts = await readJson(TRUSTED_CONTACT_FILE, []);
    const filtered = contacts.filter((entry) => entry.userId !== req.user.id);
    const contact = { userId: req.user.id, name, phone, relationship, email, updatedAt: nowIso() };
    filtered.push(contact);
    await writeJson(TRUSTED_CONTACT_FILE, filtered);
    res.json({ success: true, message: 'Trusted contact saved', data: { contact } });
  } catch (error) {
    logger.error('Save trusted contact error:', error);
    res.status(500).json({ success: false, message: 'Failed to save trusted contact' });
  }
});

router.get('/safety-plan', authenticateToken, async (req, res) => {
  try {
    const plans = await readJson(SAFETY_PLAN_FILE, []);
    const plan = plans.find((entry) => entry.userId === req.user.id) || null;
    res.json({ success: true, data: { plan } });
  } catch (error) {
    logger.error('Get safety plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to load safety plan' });
  }
});

router.post('/safety-plan', authenticateToken, async (req, res) => {
  try {
    const payload = req.body || {};
    const plans = await readJson(SAFETY_PLAN_FILE, []);
    const filtered = plans.filter((entry) => entry.userId !== req.user.id);
    const plan = { userId: req.user.id, ...payload, updatedAt: nowIso() };
    filtered.push(plan);
    await writeJson(SAFETY_PLAN_FILE, filtered);
    res.json({ success: true, message: 'Safety plan saved', data: { plan } });
  } catch (error) {
    logger.error('Save safety plan error:', error);
    res.status(500).json({ success: false, message: 'Failed to save safety plan' });
  }
});

router.post('/track', authenticateToken, async (req, res) => {
  try {
    const { eventType, metadata } = req.body || {};
    const events = await readJson(EVENTS_FILE, []);
    events.push({
      id: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      userId: req.user.id,
      eventType: eventType || 'unknown',
      metadata: metadata || {},
      createdAt: nowIso()
    });
    await writeJson(EVENTS_FILE, events);
    res.json({ success: true, message: 'Event tracked' });
  } catch (error) {
    logger.error('Track emergency event error:', error);
    res.status(500).json({ success: false, message: 'Failed to track event' });
  }
});

router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const limit = Number(req.query.limit || 20);
    const offset = Number(req.query.offset || 0);
    const alerts = await readJson(ALERTS_FILE, []);
    const scoped = alerts
      .filter((entry) => entry.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const paged = scoped.slice(offset, offset + limit);
    res.json({ success: true, data: { alerts: paged, total: scoped.length } });
  } catch (error) {
    logger.error('Get emergency alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
});

router.put('/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body || {};
    const alerts = await readJson(ALERTS_FILE, []);
    const index = alerts.findIndex((entry) => entry.id === req.params.id && entry.userId === req.user.id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    alerts[index] = {
      ...alerts[index],
      status: status || alerts[index].status,
      resolutionNotes: resolutionNotes || alerts[index].resolutionNotes || null,
      updatedAt: nowIso()
    };
    await writeJson(ALERTS_FILE, alerts);
    res.json({ success: true, message: 'Alert updated', data: { alert: alerts[index] } });
  } catch (error) {
    logger.error('Update emergency alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to update alert' });
  }
});

router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const events = await readJson(EVENTS_FILE, []);
    const userEvents = events.filter((entry) => entry.userId === req.user.id);
    const counts = userEvents.reduce((acc, item) => {
      acc[item.eventType] = (acc[item.eventType] || 0) + 1;
      return acc;
    }, {});
    res.json({ success: true, data: { eventCounts: counts, total: userEvents.length } });
  } catch (error) {
    logger.error('Emergency analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

router.post('/alert', authenticateToken, async (req, res) => {
  try {
    const { type, message, location, state = 'national', language = 'en', trustedContact } = req.body || {};
    const resources = getStateResources(state);
    const alerts = await readJson(ALERTS_FILE, []);
    const alert = {
      id: alertId(),
      userId: req.user.id,
      type: type || 'sos',
      message: message || 'Emergency alert triggered',
      location: location || null,
      state,
      language,
      trustedContact: trustedContact || null,
      status: 'open',
      notificationStatus: {
        sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        whatsapp: Boolean(process.env.WHATSAPP_API_TOKEN),
        email: Boolean(trustedContact?.email)
      },
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    alerts.push(alert);
    await writeJson(ALERTS_FILE, alerts);

    if (trustedContact?.email) {
      sendHealthAlertEmail(
        trustedContact.email,
        trustedContact.name || 'Trusted Contact',
        'Emergency SOS',
        `${message || 'Emergency alert triggered'}${location ? ` | Location: ${location}` : ''}`
      ).catch((error) => logger.error('Emergency email notification failed:', error.message));
    }

    logger.warn(`Emergency alert from user ${req.user.id}`, {
      alertId: alert.id,
      type: alert.type,
      location: alert.location
    });

    res.json({
      success: true,
      message: 'Emergency alert logged successfully',
      data: {
        alertId: alert.id,
        timestamp: alert.createdAt,
        resources: resources.crisis,
        nearest: resources.nearest,
        followUpActions: [
          'Practice grounding (5-4-3-2-1 technique)',
          'Call your healthcare provider for urgent appointment',
          'Notify clinician or trusted caregiver'
        ],
        notificationStatus: alert.notificationStatus
      }
    });
  } catch (error) {
    logger.error('Emergency alert error:', error);
    res.status(500).json({ success: false, message: 'Failed to process emergency alert' });
  }
});

module.exports = router;