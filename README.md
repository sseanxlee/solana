# Solana Token Alerts

A comprehensive token alert system for Solana blockchain tokens with real-time price monitoring and multi-channel notifications.

## Overview

This full-stack application enables users to create and manage price alerts for Solana tokens, including newly launched tokens from Pump.fun. The system provides real-time monitoring with automated notifications via email and Telegram when price or market cap thresholds are reached.

## Key Features

- **Phantom Wallet Authentication**: Secure sign-in using Solana wallet signatures with SIWS (Sign-In With Solana)
- **Real-time Token Monitoring**: Automated price checking every 60 seconds with intelligent alert triggering
- **Dual Notification System**: Email notifications via SendGrid and Telegram bot integration
- **Alert Management**: Create, update, and delete price/market cap alerts with customizable thresholds
- **Auto-cleanup**: Alerts automatically disable after triggering to prevent spam

## Technology Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, Phantom Wallet Integration  
**Backend**: Node.js, Express, TypeScript, JWT Authentication  
**Database**: PostgreSQL with optimized indexes  
**Cache/Queue**: Redis for notification processing  
**External APIs**: Moralis API (primary), Jupiter API (fallback), SendGrid, Telegram Bot API  
**Security**: Rate limiting, input validation, SQL injection protection

## Architecture

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

## Database Schema

The application uses PostgreSQL with two primary tables:

**Users**: Stores wallet addresses, email, and Telegram chat IDs for notification routing  
**Token Alerts**: Manages alert configurations including token addresses, threshold values, conditions, and trigger states

## API Endpoints

- Authentication: Nonce generation and wallet signature verification
- Alert Management: CRUD operations for user alerts with validation
- Token Data: Real-time price and market cap retrieval
- Admin: System monitoring and manual alert testing

## Security Features

- Cryptographic wallet signature verification
- JWT-based session management with secure token handling
- Comprehensive rate limiting and input validation
- Parameterized database queries preventing SQL injection
- CORS configuration for cross-origin request protection

## Premium Features

### Moralis API Integration

This application includes ready-to-use integration with the Moralis Deep Index API for enhanced token search capabilities. The premium search provides:

- **Enhanced Token Discovery**: Search by contract address, token name, or symbol
- **Rich Metadata**: Includes logos, security scores, and verification status
- **Advanced Filtering**: Filter by verified contracts, sort by volume/liquidity/market cap
- **Real-time Data**: Fresh token data with comprehensive market metrics
- **Solana Network Support**: Optimized for Solana blockchain tokens

#### Enabling Premium Search

To enable the Moralis API integration:

1. **Get Moralis API Key**: Visit [Moralis.io](https://moralis.io) and upgrade to a premium plan
2. **Configure Environment Variables**:
   ```bash
   NEXT_PUBLIC_USE_MORALIS_SEARCH=true
   NEXT_PUBLIC_MORALIS_API_KEY=your-premium-moralis-api-key
   ```
3. **Restart the Application**: The search functionality will automatically switch to use Moralis API

#### API Comparison

| Feature | Legacy API | Moralis Premium API |
|---------|------------|-------------------|
| Search Method | Contract address only | Address, name, symbol |
| Token Logos | ❌ | ✅ |
| Security Scores | ❌ | ✅ |
| Verification Status | ❌ | ✅ |
| Market Data | Basic | Comprehensive |
| Sorting Options | None | Volume, Liquidity, Market Cap |
| Rate Limits | Standard | Enhanced |

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TP3
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   # Start MongoDB
   mongod
   
   # Run database migration
   cd backend
   npm run migrate
   ```

5. **Start the development servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Configuration

### Environment Variables

#### Required
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation
- `NEXT_PUBLIC_API_URL`: Backend API URL for frontend

#### Optional
- `NEXT_PUBLIC_USE_MORALIS_SEARCH`: Enable premium Moralis search (default: false)
- `NEXT_PUBLIC_MORALIS_API_KEY`: Your Moralis API key for premium features
- Email configuration for notifications (SMTP settings)
- Telegram bot configuration for alerts

### Database Setup

The application uses MongoDB for data storage. Run the migration script to set up the required collections and indexes:

```bash
cd backend
npm run migrate
```

## Usage

1. **Connect Wallet**: Use Phantom wallet to authenticate
2. **Search Tokens**: Enter token contract addresses to find tokens
3. **Create Alerts**: Set price thresholds for notifications
4. **Monitor Dashboard**: View alerts and token performance
5. **Manage Settings**: Configure notification preferences

## API Endpoints

### Authentication
- `GET /api/auth/nonce` - Get authentication nonce
- `POST /api/auth/signin` - Sign in with wallet signature

### Alerts
- `GET /api/alerts` - Get user alerts
- `POST /api/alerts` - Create new alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

### Tokens
- `GET /api/tokens/search` - Search tokens (switches between legacy and Moralis based on config)
- `GET /api/tokens/:address` - Get token details
- `GET /api/tokens/:address/pairs` - Get token trading pairs

## Development

### Project Structure
```
TP3/
├── frontend/          # Next.js frontend application
├── backend/           # Express.js backend API
├── env.example        # Environment configuration template
└── README.md         # This file
```

### Frontend Structure
```
frontend/src/
├── app/              # Next.js app router pages
├── components/       # React components
├── contexts/         # React contexts (Auth, Wallet)
└── services/         # API service layer
```

### Backend Structure
```
backend/src/
├── routes/           # API route handlers
├── middleware/       # Express middleware
├── services/         # Business logic services
└── types/           # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation for configuration details
- Review the environment variable setup for premium features

## Roadmap

- [ ] Advanced portfolio analytics
- [ ] Multi-wallet support
- [ ] Mobile application
- [ ] Advanced charting and technical indicators
- [ ] Social trading features
- [ ] DeFi protocol integrations

---

**Note**: The Moralis API integration is ready for immediate use once you upgrade your API key. Simply toggle the environment variable to enable premium search features.
