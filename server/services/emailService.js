const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create email transporter
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // For development, use ethereal email
    return nodemailer.createTestAccount().then(account => {
      return nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: account.user,
          pass: account.pass
        }
      });
    });
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, fullName) => {
  try {
    const transporter = await createTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@whispersmotherhood.com',
      to: email,
      subject: 'Welcome to Whispers of Motherhood 🌸',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f43f5e, #ec4899); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to Whispers of Motherhood</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your postpartum wellness companion</p>
          </div>
          
          <div style="padding: 30px; background: #fff;">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Hello ${fullName}! 👋</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 20px;">
              Welcome to our caring community of mothers! We're here to support you through your postpartum journey 
              with comprehensive health monitoring, mental wellness support, and a community that understands.
            </p>
            
            <div style="background: #fef3f2; border-left: 4px solid #f43f5e; padding: 20px; margin: 20px 0;">
              <h3 style="color: #991b1b; margin: 0 0 10px 0;">What you can do:</h3>
              <ul style="color: #7f1d1d; margin: 0; padding-left: 20px;">
                <li>Track your mood and health metrics</li>
                <li>Access mental health assessments</li>
                <li>Connect with other mothers</li>
                <li>Get personalized health insights</li>
                <li>Access emergency resources 24/7</li>
              </ul>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6; margin-bottom: 30px;">
              Remember, seeking help is a sign of strength. We're here for you every step of the way.
            </p>
            
            <div style="text-align: center;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" 
                 style="background: #f43f5e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Get Started
              </a>
            </div>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">
              If you need immediate help, call 988 (Suicide & Crisis Lifeline) or text HOME to 741741
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Welcome email sent:', info.messageId);
    
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Preview URL:', nodemailer.getTestMessageUrl(info));
    }
    
    return info;
  } catch (error) {
    logger.error('Send welcome email error:', error);
    throw error;
  }
};

// Send health alert email
const sendHealthAlertEmail = async (email, fullName, alertType, message) => {
  try {
    const transporter = await createTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_USER || 'alerts@whispersmotherhood.com',
      to: email,
      subject: `Health Alert - ${alertType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">⚠️ Health Alert</h1>
          </div>
          
          <div style="padding: 30px; background: #fff;">
            <h2 style="color: #1f2937;">Hello ${fullName},</h2>
            <p style="color: #4b5563; line-height: 1.6;">${message}</p>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 20px; margin: 20px 0; border-radius: 6px;">
              <p style="color: #991b1b; margin: 0; font-weight: bold;">
                If this is an emergency, please call 911 immediately.
              </p>
            </div>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Health alert email sent:', info.messageId);
    return info;
  } catch (error) {
    logger.error('Send health alert email error:', error);
    throw error;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendHealthAlertEmail
};