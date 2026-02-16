# BeeCastly - AI-Powered Omnichannel Sales & Marketing Automation Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%2B-red.svg)](https://redis.io/)

BeeCastly is a **multi-tenant SaaS platform** for AI-powered omnichannel sales and marketing automation. Unlike single-user scripts, BeeCastly stores all third-party integrations in the database, making it a true multi-tenant platform where each user configures their own API credentials via the Dashboard.

## 🏗️ Architecture Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEEASTLY ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  .env file (System Secrets ONLY)          Dashboard UI          │
│  ───────────────────────────────          ───────────           │
│  • Database credentials                   • WhatsApp API        │
│  • Redis credentials                      • SMS (Twilio, etc.)  │
│  • JWT secrets                            • Email SMTP          │
│  • Encryption key                         • Payment Gateways    │
│  • Server config                          • Telegram Bot        │
│                                           • Custom Webhooks     │
│                                                    │            │
│                                                    ▼            │
│                                           ┌─────────────┐       │
│                                           │  DATABASE   │       │
│                                           │  (Encrypted)│       │
│                                           └─────────────┘       │
│                                                                 │
│  👉 .env = Server engine secrets ONLY                           │
│  👉 Dashboard = Business integrations & user APIs               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**⚠️ CRITICAL:** If you put Razorpay, SMTP, WhatsApp tokens in `.env` → Your project becomes a **single-user script**, NOT SaaS.

## ✨ Features

### 🤖 AI-Powered Automation
- **AI Lead Capture** - Intelligent form qualification with intent detection
- **AI Conversation Engine** - GPT-4 powered chat responses
- **AI Voice Calling** - Twilio integration with AI scripts
- **Lead Scoring** - AI-powered lead quality assessment
- **Sentiment Analysis** - Real-time conversation sentiment tracking

### 📱 Omnichannel Messaging
- **WhatsApp** - Cloud API & Evolution API support
- **SMS** - Twilio, MSG91, Vonage, Fast2SMS, TextLocal
- **Email** - SMTP, Gmail OAuth, SendGrid, Mailgun
- **Telegram** - Bot API integration
- **Voice** - Twilio voice calls

### 🔄 Workflow Automation
- **Visual Workflow Builder** - Drag-and-drop automation
- **Trigger System** - Event-based automation
- **Conditional Logic** - IF/ELSE branching
- **Delay & Schedule** - Time-based actions
- **Webhooks** - External system integration

### 💰 Payment Integration
- **Stripe** - Global payments
- **Razorpay** - Indian payments
- **PayPal** - International payments
- **Subscription Management** - Automated billing

### 👥 Team Collaboration
- **Multi-tenant** - True SaaS architecture
- **Role-based Access** - Admin, Manager, Agent roles
- **Team Assignment** - Lead and conversation routing
- **Activity Logging** - Full audit trail

### 📊 Analytics & Reporting
- **Real-time Dashboard** - Live metrics
- **Campaign Analytics** - ROI tracking
- **Lead Analytics** - Conversion funnel
- **Custom Reports** - Exportable data

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** 15+
- **Redis** 7+
- **npm** or **yarn**

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/beecastly.git
cd beecastly

# Install dependencies (installs all workspace packages)
npm install
```

### 2. Environment Setup

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your system secrets
# ⚠️ ONLY put system-level secrets here (DB, Redis, JWT)
# DO NOT put API keys for WhatsApp, SMS, Email, Payments here!
nano .env
```

**Required environment variables:**

```env
# Database (System-level)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=beecastly
DB_USER=beecastly
DB_PASSWORD=your_secure_password

# Redis (System-level)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (System-level)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars

# Encryption (System-level - CRITICAL!)
# Generate with: openssl rand -base64 32
ENCRYPTION_KEY=your_base64_encoded_encryption_key
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb beecastly

# Create user
psql -c "CREATE USER beecastly WITH PASSWORD 'your_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE beecastly TO beecastly;"

# Run migrations
npm run db:migrate

# Or run schema directly
psql -U beecastly -d beecastly -f packages/api/database/schema.sql
```

### 4. Start Development

```bash
# Start all services (API + Web + Redis + PostgreSQL)
npm run dev

# Or start services individually:
npm run dev:api      # API server only (port 3001)
npm run dev:web      # Web app only (port 3000)
npm run dev:worker   # Background workers only
```

The application will be available at:
- **Web Dashboard**: http://localhost:3000
- **API Server**: http://localhost:3001
- **API Documentation**: http://localhost:3001/docs

### 5. First Login

```bash
# Default admin credentials (change immediately!)
Email: admin@beecastly.com
Password: admin123
```

## 📁 Project Structure

```
beecastly/
├── packages/
│   ├── shared/           # Shared types and utilities
│   │   └── src/
│   │       └── types/    # TypeScript interfaces
│   │
│   ├── api/              # Fastify backend API
│   │   ├── src/
│   │   │   ├── routes/   # API route handlers
│   │   │   ├── services/ # Business logic
│   │   │   ├── utils/    # Utilities (encryption, etc.)
│   │   │   └── plugins/  # Fastify plugins
│   │   └── database/
│   │       └── schema.sql # Database schema
│   │
│   └── web/              # Next.js frontend
│       ├── src/
│       │   ├── app/      # Next.js app router
│       │   ├── components/ # React components
│       │   └── lib/      # Utilities
│       └── public/
│
├── docker/               # Docker configurations
├── .env.example          # Environment template
├── package.json          # Workspace root
└── README.md
```

## 🔐 Security Architecture

### Encryption

All third-party API credentials are **encrypted at rest** using AES-256-CBC:

```typescript
// Credentials are encrypted before storage
const { encrypted, iv } = encryptCredentials({
  accessToken: 'user_whatsapp_token',
  phoneNumberId: '123456789'
});

// Stored in database as encrypted blob
await db.query(
  'INSERT INTO user_integrations (credentials_encrypted, credentials_iv) VALUES ($1, $2)',
  [encrypted, iv]
);
```

### Key Masking

API keys are masked in the UI (show only last 4 characters):

```typescript
maskApiKey('sk_live_abcdefghijklmnopqrstuvwxyz')
// Returns: 'sk_live_************************wxyz'
```

### Multi-tenant Isolation

Each tenant's data is completely isolated:

```sql
-- All queries include tenant_id filter
SELECT * FROM messages WHERE tenant_id = $1;
SELECT * FROM leads WHERE tenant_id = $1;
```

## 🔧 Configuration Guide

### For Platform Owners (Admin Dashboard)

1. **Access Admin Dashboard** at `/admin`
2. **Configure Platform Settings**:
   - Platform name, logo, support email
   - Default quotas and limits
   - Security policies
   
3. **Set Up Payment Gateways**:
   - Navigate to Admin → Payment Gateways
   - Add Stripe/Razorpay/PayPal credentials
   - Set default gateway

4. **Configure Fallback Providers** (optional):
   - Add SMS fallback for reliability
   - Configure global SMTP for system emails

### For End Users (User Dashboard)

1. **Sign up** and create a workspace
2. **Configure Integrations**:
   - Go to Settings → Integrations
   - Add WhatsApp Cloud API credentials
   - Configure SMS provider (Twilio, etc.)
   - Set up Email (SMTP, Gmail, etc.)
   - Add Telegram bot token

3. **Test Integrations**:
   - Click "Test" button next to each integration
   - Verify credentials are working

4. **Create Workflows**:
   - Use visual workflow builder
   - Set up automation triggers
   - Connect channels

## 🐳 Docker Deployment

### Development

```bash
# Start all services with Docker Compose
docker-compose -f docker/docker-compose.dev.yml up

# Or build and run
docker-compose -f docker/docker-compose.dev.yml up --build
```

### Production

```bash
# Production deployment
docker-compose -f docker/docker-compose.yml up -d

# With custom env file
docker-compose -f docker/docker-compose.yml --env-file .env.production up -d
```

### Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/web.yaml
kubectl apply -f k8s/ingress.yaml
```

## 📚 API Documentation

### Authentication

```bash
# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Response: { "token": "jwt_token_here" }

# Use token in subsequent requests
curl -H "Authorization: Bearer jwt_token_here" \
  http://localhost:3001/leads
```

### User Integrations API

```bash
# List integrations
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/settings/integrations

# Create WhatsApp integration
curl -X POST http://localhost:3001/settings/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "whatsapp",
    "provider": "cloud_api",
    "name": "My WhatsApp",
    "credentials": {
      "accessToken": "EAAB...",
      "phoneNumberId": "123456789",
      "businessAccountId": "987654321"
    },
    "isDefault": true
  }'

# Test integration
curl -X POST http://localhost:3001/settings/integrations/{id}/test \
  -H "Authorization: Bearer $TOKEN"
```

### Admin API

```bash
# Get system status (admin only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/admin/status

# Update platform setting
curl -X PATCH http://localhost:3001/admin/settings/platform.name \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "My SaaS Platform"}'

# Create payment gateway
curl -X POST http://localhost:3001/admin/payment-gateways \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "stripe",
    "name": "Stripe Production",
    "credentials": {
      "secretKey": "sk_live_...",
      "publishableKey": "pk_live_..."
    },
    "isDefault": true
  }'
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run API tests only
npm run test:api

# Run web tests only
npm run test:web

# Run with coverage
npm run test:coverage
```

## 🛠️ Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify database exists
psql -U beecastly -d beecastly -c "SELECT 1;"

# Check connection in app
npm run db:health
```

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check connection in app
npm run redis:health
```

### Encryption Key Issues

```bash
# Generate a new encryption key
openssl rand -base64 32

# Add to .env
ENCRYPTION_KEY=your_new_key_here
```

### Integration Test Failures

1. **Check credentials are correct** in Dashboard → Integrations
2. **Verify API keys have correct permissions** in provider dashboard
3. **Check webhook URLs** are accessible from internet
4. **Review integration logs** in Dashboard → Logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: https://docs.beecastly.com
- **Discord**: https://discord.gg/beecastly
- **Email**: support@beecastly.com
- **Issues**: https://github.com/yourusername/beecastly/issues

## 🙏 Acknowledgments

- [Fastify](https://www.fastify.io/) - Fast and low overhead web framework
- [Next.js](https://nextjs.org/) - React framework for production
- [BullMQ](https://docs.bullmq.io/) - Queue system for Node.js
- [PostgreSQL](https://www.postgresql.org/) - World's most advanced open source database
- [Redis](https://redis.io/) - In-memory data structure store

---

**Built with ❤️ by the BeeCastly Team**

*Remember: `.env` = System secrets only. Dashboard = Business integrations.*
