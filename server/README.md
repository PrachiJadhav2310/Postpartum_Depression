# Whispers of Motherhood - Backend API

A comprehensive Node.js backend for the postpartum health monitoring and support application.

## Features

- **Authentication & Authorization**: JWT-based authentication with refresh tokens
- **Health Tracking**: Vital signs, symptoms, and health record management
- **Mental Health Support**: Mood tracking, depression assessments, and crisis detection
- **Real-time Communication**: Socket.IO for live health monitoring and alerts
- **Community Features**: Support forums and peer connections
- **Analytics & Insights**: Health trend analysis and predictive insights
- **Emergency Support**: Crisis detection and emergency resource integration
- **Notifications**: Real-time alerts and reminders

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Real-time**: Socket.IO
- **Authentication**: JWT
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Redis (optional, for caching)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd server
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database
```bash
# Create database
createdb whispers_motherhood

# Run migrations
psql -d whispers_motherhood -f scripts/createTables.sql
```

5. Start the server
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Health Tracking
- `POST /api/health/records` - Add health record
- `GET /api/health/records` - Get health records
- `POST /api/health/symptoms` - Add symptom
- `GET /api/health/symptoms` - Get symptoms
- `GET /api/health/dashboard` - Get health dashboard data
- `GET /api/health/predictions` - Get health predictions

### Mental Health
- `POST /api/mental-health/mood` - Add mood entry
- `GET /api/mental-health/mood` - Get mood entries
- `POST /api/mental-health/assessment` - Submit assessment
- `GET /api/mental-health/assessments` - Get assessments
- `GET /api/mental-health/insights` - Get mental health insights
- `GET /api/mental-health/dashboard` - Get mental health dashboard

### Community (Future Implementation)
- `GET /api/community/posts` - Get community posts
- `POST /api/community/posts` - Create post
- `POST /api/community/posts/:id/replies` - Add reply
- `POST /api/community/posts/:id/like` - Like/unlike post

## Real-time Features

The application uses Socket.IO for real-time communication:

### Events

**Client to Server:**
- `health_data_update` - Real-time health data
- `mood_update` - Real-time mood updates
- `emergency_alert` - Emergency situations
- `join_community_room` - Join community discussions
- `community_message` - Send community messages

**Server to Client:**
- `health_data_saved` - Confirmation of health data
- `health_alert` - Health-related alerts
- `mental_health_alert` - Mental health concerns
- `emergency_acknowledged` - Emergency response
- `new_community_message` - Community messages
- `server_heartbeat` - Server status

## Security Features

- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries
- **Authentication**: JWT with refresh tokens
- **CORS**: Configured for frontend domain
- **Helmet**: Security headers
- **Password Hashing**: bcrypt with salt rounds

## Health Analytics

The system includes sophisticated health analytics:

- **Trend Analysis**: Identifies patterns in health data
- **Risk Assessment**: Evaluates health risks based on data
- **Predictive Insights**: Basic prediction algorithms
- **Anomaly Detection**: Identifies unusual health patterns
- **Mental Health Screening**: Depression and anxiety assessment

## Crisis Detection

Advanced mental health crisis detection includes:

- **Mood Pattern Analysis**: Identifies concerning mood trends
- **Language Analysis**: Detects concerning language in notes
- **Assessment Risk Levels**: Monitors assessment results
- **Real-time Alerts**: Immediate notifications for high-risk situations

## Deployment

### Environment Variables

Required environment variables:

```env
PORT=5000
NODE_ENV=production
DB_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

### Production Considerations

- Use environment-specific configurations
- Set up proper logging and monitoring
- Configure SSL/TLS certificates
- Set up database backups
- Implement proper error tracking
- Use process managers (PM2, Docker)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.