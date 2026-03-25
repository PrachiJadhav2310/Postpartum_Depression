const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { analyzeTextSentiment, generateHealthPrediction } = require('../services/aiPredictionService');

const socketHandler = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userResult = await query(
        'SELECT id, email, full_name FROM user_profiles WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = userResult.rows[0];
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.email}`);

    // Join user to their personal room
    socket.join(`user_${socket.user.id}`);

    // Handle real-time health data
    socket.on('health_data_update', async (data) => {
      try {
        // Validate and save health data
        const { recordType, value, unit } = data;
        
        await query(
          `INSERT INTO health_records (user_id, record_type, value, unit, recorded_at, created_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [socket.user.id, recordType, value, unit]
        );

        // Emit confirmation back to user
        socket.emit('health_data_saved', {
          success: true,
          recordType,
          value,
          timestamp: new Date()
        });

        // Check for alerts
        if (recordType === 'heart_rate' && value > 120) {
          socket.emit('health_alert', {
            type: 'warning',
            message: 'Heart rate is elevated. Consider resting and monitoring.',
            value,
            recordType
          });
        }

        if (recordType === 'blood_pressure_systolic' && value > 140) {
          socket.emit('health_alert', {
            type: 'critical',
            message: 'Blood pressure is high. Please contact your healthcare provider.',
            value,
            recordType
          });
        }

      } catch (error) {
        logger.error('Health data update error:', error);
        socket.emit('error', { message: 'Failed to save health data' });
      }
    });

    // Handle mood updates
    socket.on('mood_update', async (data) => {
      try {
        const { moodScore, energyLevel, anxietyLevel, notes } = data;
        
        await query(
          `INSERT INTO mood_entries (user_id, mood_score, energy_level, anxiety_level, notes, recorded_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [socket.user.id, moodScore, energyLevel, anxietyLevel, notes]
        );

        // Analyze text sentiment if notes provided
        let textAnalysis = null;
        if (notes) {
          textAnalysis = analyzeTextSentiment(notes);
          
          // Check for severe indicators
          const severeIndicators = textAnalysis.indicators.filter(i => i.severity === 'severe');
          if (severeIndicators.length > 0) {
            socket.emit('crisis_alert', {
              type: 'severe_language_detected',
              message: 'Your message contains concerning language. Please reach out for immediate support.',
              resources: [
                { name: 'Crisis Text Line', contact: 'Text HOME to 741741' },
                { name: 'National Suicide Prevention Lifeline', contact: '988' },
                { name: 'Emergency Services', contact: '911' }
              ],
              indicators: severeIndicators
            });
          }
        }

        socket.emit('mood_saved', {
          success: true,
          moodScore,
          timestamp: new Date(),
          textAnalysis
        });

        // Check for concerning mood patterns
        if (moodScore <= 3 || anxietyLevel >= 8) {
          socket.emit('mental_health_alert', {
            type: 'concern',
            message: 'Your mood entry shows concerning patterns. Consider reaching out for support.',
            resources: [
              { name: 'Crisis Text Line', contact: 'Text HOME to 741741' },
              { name: 'National Suicide Prevention Lifeline', contact: '988' }
            ]
          });
        }

        // Generate updated health prediction
        try {
          const prediction = await generateHealthPrediction(socket.user.id);
          socket.emit('prediction_update', {
            prediction: {
              needsConsultation: prediction.needsDoctorConsultation,
              urgentCare: prediction.urgentCareNeeded,
              riskLevel: prediction.mentalHealth.riskLevel,
              recommendations: prediction.recommendations.slice(0, 3)
            }
          });
        } catch (predictionError) {
          logger.error('Real-time prediction error:', predictionError);
        }
      } catch (error) {
        logger.error('Mood update error:', error);
        socket.emit('error', { message: 'Failed to save mood entry' });
      }
    });

    // Handle real-time text analysis
    socket.on('analyze_text', (data) => {
      try {
        const { text } = data;
        const analysis = analyzeTextSentiment(text);
        
        socket.emit('text_analysis_result', {
          analysis,
          needsAttention: analysis.score >= 30 || 
            analysis.indicators.some(i => i.severity === 'severe'),
          timestamp: new Date()
        });
        
      } catch (error) {
        logger.error('Real-time text analysis error:', error);
        socket.emit('error', { message: 'Failed to analyze text' });
      }
    });

    // Handle emergency alerts
    socket.on('emergency_alert', async (data) => {
      try {
        const { type, message, location } = data;
        
        logger.warn(`Emergency alert from user ${socket.user.id}: ${type} - ${message}`);
        
        // In a real application, this would trigger emergency protocols
        // For now, we'll just log and acknowledge
        
        socket.emit('emergency_acknowledged', {
          success: true,
          message: 'Emergency alert received. Help is on the way.',
          timestamp: new Date()
        });

        // Notify emergency contacts (if configured)
        // This would integrate with SMS/email services

      } catch (error) {
        logger.error('Emergency alert error:', error);
        socket.emit('error', { message: 'Failed to process emergency alert' });
      }
    });

    // Handle community interactions
    socket.on('join_community_room', (roomId) => {
      socket.join(`community_${roomId}`);
      logger.info(`User ${socket.user.id} joined community room ${roomId}`);
    });

    socket.on('leave_community_room', (roomId) => {
      socket.leave(`community_${roomId}`);
      logger.info(`User ${socket.user.id} left community room ${roomId}`);
    });

    socket.on('community_message', (data) => {
      const { roomId, message } = data;
      
      // Broadcast message to all users in the community room
      socket.to(`community_${roomId}`).emit('new_community_message', {
        userId: socket.user.id,
        userName: socket.user.full_name,
        message,
        timestamp: new Date()
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.user.email}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  // Periodic health check broadcasts
  setInterval(() => {
    io.emit('server_heartbeat', {
      timestamp: new Date(),
      status: 'healthy'
    });
  }, 30000); // Every 30 seconds
};

module.exports = socketHandler;