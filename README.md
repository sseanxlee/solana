# 🚨 Solana Token Alerts - MVP

A comprehensive token alert system for Solana tokens, including Pump.fun launches. Users can set price and market cap alerts with email and Telegram notifications.

## ✅ Features

### Core MVP Features
- **Phantom Wallet Authentication**: Sign-in using Phantom wallet with SIWS (Sign-In With Solana)
- **Token Monitoring**: Support for any Solana token address including Pump.fun tokens
- **Price & Market Cap Alerts**: Set alerts for price movements or market cap thresholds
- **Dual Notification System**: Email (SendGrid) and Telegram notifications
- **Real-time Monitoring**: Background service checks prices every 60 seconds
- **Auto-cleanup**: Alerts are automatically disabled after triggering

### Technical Features
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Node.js with Express and TypeScript
- **Database**: PostgreSQL with optimized indexes
- **Authentication**: JWT with Solana wallet signature verification
- **Price Feeds**: Moralis API with Jupiter API fallback
- **Queue System**: Redis for notification processing
- **Rate Limiting**: API protection with Express rate limiter

## 🏗️ Architecture

```
Frontend (Next.js)     Backend (Express)     External APIs
     │                      │                     │
     ├─ Phantom Wallet ─────┼─ Auth Service ─────┤
     ├─ Dashboard ──────────┼─ Alert Service ────┼─ Moralis API
     ├─ Alert Management ───┼─ Token Service ────┼─ Jupiter API  
     └─ Profile Settings ───┼─ Notification ─────┼─ SendGrid
                             │   Service          │─ Telegram Bot
                             │                    │
                             ├─ PostgreSQL ───────┤
                             ├─ Redis Queue ──────┤
                             └─ Monitoring ───────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Redis instance
- Moralis API key
- SendGrid API key (for email)
- Telegram Bot token (for Telegram notifications)

### 1. Clone and Install
```bash
git clone <repository-url>
cd solana-token-alerts
npm install
```

### 2. Environment Setup
Copy the environment variables template:
```bash
cp env.example .env
```

Configure your environment variables in `.env`:
```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/solana_alerts
REDIS_URL=redis://localhost:6379

# API Keys
MORALIS_API_KEY=your_moralis_api_key_here
SENDGRID_API_KEY=your_sendgrid_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Application Configuration
API_PORT=3001
NODE_ENV=development

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

### 3. Database Setup
Run the database migration:
```bash
cd backend
npm run migrate
```

### 4. Start Development Servers
```bash
# Start both frontend and backend
npm run dev

# Or start individually:
npm run dev:frontend  # Frontend on http://localhost:3000
npm run dev:backend   # Backend on http://localhost:3001
```

## 📖 API Documentation

### Authentication Endpoints
- `GET /api/auth/nonce?walletAddress={address}` - Get signing nonce
- `POST /api/auth/signin` - Sign in with wallet signature

### Alert Management
- `GET /api/alerts` - Get user's alerts
- `POST /api/alerts` - Create new alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert
- `POST /api/alerts/:id/test` - Test alert notification

### Admin Endpoints
- `GET /api/admin/stats` - Get monitoring statistics
- `POST /api/admin/force-check` - Force check all alerts

## 🔧 Configuration

### Required Environment Variables

#### Database
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

#### External APIs
- `MORALIS_API_KEY`: Moralis Web3 API key for token data
- `SENDGRID_API_KEY`: SendGrid API key for email notifications
- `TELEGRAM_BOT_TOKEN`: Telegram bot token for Telegram notifications

#### Security
- `JWT_SECRET`: Secret key for JWT token signing

#### Application
- `API_PORT`: Backend server port (default: 3001)
- `FRONTEND_URL`: Frontend URL for email links
- `NODE_ENV`: Environment (development/production)

### Optional Configuration
- `RATE_LIMIT_WINDOW_MS`: Rate limiting window (default: 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)
- `PRICE_CHECK_INTERVAL_MS`: Price check interval (default: 60 seconds)

## 🗄️ Database Schema

### Users Table
```sql
users (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(44) UNIQUE,
  email VARCHAR(255),
  telegram_chat_id VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Token Alerts Table
```sql
token_alerts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token_address VARCHAR(44),
  token_name VARCHAR(255),
  token_symbol VARCHAR(10),
  threshold_type VARCHAR(20), -- 'price' or 'market_cap'
  threshold_value DECIMAL(20,8),
  condition VARCHAR(10), -- 'above' or 'below'
  notification_type VARCHAR(20), -- 'email' or 'telegram'
  is_active BOOLEAN DEFAULT TRUE,
  is_triggered BOOLEAN DEFAULT FALSE,
  triggered_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## 🚢 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_SOLANA_NETWORK`
3. Deploy

### Backend (Railway/Render)
1. Connect your GitHub repository
2. Set all required environment variables
3. Add build command: `cd backend && npm run build`
4. Add start command: `cd backend && npm start`
5. Deploy

### Database & Redis
- Use Railway PostgreSQL or any PostgreSQL provider
- Use Redis Cloud or any Redis provider
- Update connection strings in environment variables

## 🔐 Security Features

- **Wallet Authentication**: Cryptographic signature verification
- **JWT Tokens**: Secure session management
- **Rate Limiting**: API abuse protection
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Restricted cross-origin requests

## 🎯 Usage Examples

### Creating an Alert
```typescript
// Frontend API call
const alertData = {
  tokenAddress: 'So11111111111111111111111111111111111111112', // SOL
  thresholdType: 'price',
  thresholdValue: 100,
  condition: 'above',
  notificationType: 'email'
};

const response = await apiService.createAlert(alertData);
```

### Phantom Wallet Integration
```typescript
// Connect wallet and sign authentication message
const { publicKey, signMessage } = useWallet();
const message = await apiService.getNonce(publicKey.toBase58());
const signature = await signMessage(new TextEncoder().encode(message));
const authResponse = await apiService.signIn({
  walletAddress: publicKey.toBase58(),
  signature: Array.from(signature).join(','),
  message
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Create a GitHub issue
- Check the troubleshooting section below

## 🔧 Troubleshooting

### Common Issues

**Database Connection Error**
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists

**Token Validation Fails**
- Check Moralis API key
- Verify token address format (44 characters)
- Check network configuration

**Wallet Connection Issues**
- Ensure Phantom wallet is installed
- Check network configuration (mainnet-beta/devnet)
- Verify wallet has SOL for transaction fees

**Notifications Not Working**
- Verify SendGrid API key and from email
- Check Telegram bot token and chat ID
- Ensure user has configured notification preferences

### Development Setup Issues

**Port Already in Use**
- Change API_PORT in environment variables
- Kill existing processes on ports 3000/3001

**TypeScript Errors**
- Run `npm install` in both frontend and backend
- Check Node.js version (18+ required)

**Linter Errors**
- Install dependencies: `npm install`
- Fix imports and type declarations

## 🎉 What's Next?

This MVP provides the foundation for a comprehensive Solana token alert system. Future enhancements could include:

- Mobile app (React Native)
- Discord bot integration
- Advanced charting and analytics
- Portfolio tracking
- Price prediction models
- Multi-chain support

The architecture is designed to scale and accommodate these features as the platform grows. # stride
