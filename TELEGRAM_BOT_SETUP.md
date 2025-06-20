# Telegram Bot Setup Guide

This guide will help you set up the Telegram bot for token price alerts that works 24/7, even when users are offline.

## Features

✅ **Real-time token monitoring** - Checks prices every minute  
✅ **24/7 operation** - Works continuously even when users are offline  
✅ **Easy bot commands** - Simple commands to create and manage alerts  
✅ **Multiple alert types** - Price and market cap alerts  
✅ **Instant notifications** - Get notified immediately when conditions are met  

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Telegram account
- Basic knowledge of environment variables

## Step 1: Create a Telegram Bot

1. **Start a chat with @BotFather on Telegram**
   - Search for `@BotFather` in Telegram
   - Send `/start` to begin

2. **Create a new bot**
   ```
   /newbot
   ```

3. **Choose a bot name**
   - Example: `Solana Token Alerts Bot`

4. **Choose a bot username**
   - Must end with `bot`
   - Example: `solana_alerts_bot` or `your_project_alerts_bot`

5. **Save your bot token**
   - You'll receive a message like: `Use this token to access the HTTP API: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`
   - **Keep this token secure!**

## Step 2: Configure Environment Variables

1. **Copy the environment template**
   ```bash
   cp env.example .env
   ```

2. **Add your Telegram bot token to `.env`**
   ```bash
   # Telegram Bot Configuration
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   ENABLE_TELEGRAM_NOTIFICATIONS=true
   ```

3. **Configure other required variables**
   ```bash
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/solana_alerts
   
   # JWT Secret (generate a random string)
   JWT_SECRET=your_super_secret_random_string_here
   
   # Token Data API (recommended)
   MORALIS_API_KEY=your_moralis_api_key_here
   ```

## Step 3: Database Setup

1. **Run database migrations**
   ```bash
   cd backend
   npm run migrate
   ```

   This creates the necessary tables including support for `telegram_chat_id`.

## Step 4: Start the Services

1. **Start the backend server**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start the frontend (optional, for web interface)**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Step 5: Test Your Bot

1. **Find your bot on Telegram**
   - Search for your bot username (e.g., `@your_project_alerts_bot`)

2. **Start the bot**
   ```
   /start
   ```

3. **Test basic commands**
   ```
   /help
   /status
   ```

## Bot Commands

### Basic Commands
- `/start` - Register with the bot
- `/help` - Show all available commands
- `/status` - Show your alert statistics

### Alert Management
- `/alert <token_address> <type> <condition> <value>` - Create new alert
- `/list` - List all your active alerts  
- `/delete <alert_id>` - Delete an alert
- `/price <token_address>` - Check current token price

### Examples

**Create price alerts:**
```
/alert So11111111111111111111111111111111111111112 price above 100
/alert 4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R price below 0.1
```

**Create market cap alerts:**
```
/alert EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v marketcap above 1000000
```

**Check token price:**
```
/price So11111111111111111111111111111111111111112
```

## How It Works

### 1. Continuous Monitoring
- The monitoring service runs 24/7 in the background
- Checks all active alerts every minute
- Fetches real-time price data from Moralis/Jupiter APIs

### 2. Alert Processing
- When a price/market cap condition is met, the alert triggers
- Notification is sent instantly via Telegram
- Alert is automatically disabled to prevent spam

### 3. Token Support
- Supports any Solana token with a valid address
- Automatically fetches token metadata (name, symbol)
- Works with pump.fun tokens, established tokens, etc.

## Production Deployment

### Environment Variables for Production
```bash
NODE_ENV=production
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_TELEGRAM_NOTIFICATIONS=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Recommended Services
- **Database**: PostgreSQL on Railway/Supabase/AWS RDS
- **Backend**: Railway/Heroku/DigitalOcean
- **Monitoring**: Built-in monitoring service (included)

## Troubleshooting

### Bot Not Responding
1. Check if `TELEGRAM_BOT_TOKEN` is correct
2. Verify the backend server is running
3. Check server logs for errors

### Alerts Not Triggering
1. Verify monitoring service is running (check `/api/admin/stats`)
2. Ensure `MORALIS_API_KEY` is configured
3. Check token addresses are valid (44 characters)

### Database Connection Issues
1. Verify `DATABASE_URL` is correct
2. Ensure database tables are created (`npm run migrate`)
3. Check database user permissions

## Security Notes

- **Never share your bot token publicly**
- Use environment variables for all secrets
- Enable rate limiting in production
- Consider implementing user authentication for web interface

## API Endpoints

### Admin Endpoints
- `GET /api/admin/stats` - Get monitoring statistics
- `POST /api/admin/force-check` - Force check specific token

### Health Check
- `GET /health` - Server health status

## Support

If you encounter issues:
1. Check the server logs for error messages
2. Verify all environment variables are set correctly
3. Test with well-known tokens first (e.g., SOL, USDC)
4. Ensure your database is properly configured

## Next Steps

- Set up email notifications for redundancy
- Add more sophisticated alert conditions
- Implement alert scheduling
- Add portfolio tracking features

Your Telegram bot is now ready to monitor Solana tokens 24/7! 🚀 