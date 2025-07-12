# Stride - Solana Token Alert System

A token alert platform for Solana that monitors price movements and sends notifications across Discord, Telegram, email, and browser extension.

## What it does

Set price alerts for any Solana token. Get notified when thresholds are hit via:
- Discord bot with slash commands
- Telegram bot
- Email notifications
- Chrome extension overlay

Connect your Phantom wallet to manage alerts through the web dashboard or create alerts directly from token pages using the browser extension.

## Tech Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS, Phantom wallet integration  
**Backend**: Node.js/Express, TypeScript, PostgreSQL, Redis  
**Bots**: Discord.js, Telegram Bot API  
**Extension**: Chrome Extension API  
**APIs**: Moralis, Jupiter, Birdeye, Solana streaming  
**Notifications**: SendGrid, WebSockets  

## Project Structure

```

```

## Quick Start

1. **Run setup script**:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Configure environment**:
   ```bash
   # Edit .env with your API keys and database connection
   cp env.example .env
   ```

3. **Set up PostgreSQL database**:
   ```bash
   # Create database and run migrations
   cd backend
   npm run migrate
   ```

4. **Start development servers**:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend  
   cd frontend
   npm run dev
   ```

5. **Load Chrome extension**:
   - Open `chrome://extensions/`
   - Enable Developer mode
   - Load unpacked extension from `chrome-extension/` folder

## Features

### Web Dashboard
- Connect Phantom wallet
- Search and add tokens
- Create price/market cap alerts
- View alert history
- Link Discord/Telegram accounts

### Discord Bot
- `/alert create` - Create new alerts
- `/alert list` - View your alerts
- `/alert delete` - Remove alerts
- `/link` - Connect Discord to wallet
- Real-time price notifications

### Telegram Bot
- Similar commands as Discord
- Private message notifications
- Account linking

### Chrome Extension
- Overlay on token pages (pump.fun, dexscreener, etc.)
- One-click alert creation
- Sync with main platform

## Database Schema

**PostgreSQL tables**:
- `users` - Wallet addresses and notification preferences
- `token_alerts` - Alert configurations and states
- `notification_queue` - Pending notifications
- `user_presets` - Custom percentage presets
- `discord_linking_tokens` - Discord account linking
- `extension_linking_tokens` - Extension connection tokens

## API Endpoints

### Authentication
- `GET /api/auth/nonce` - Get wallet nonce
- `POST /api/auth/signin` - Sign in with wallet

### Alerts
- `GET /api/alerts` - Get user alerts
- `POST /api/alerts` - Create alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

### Tokens
- `GET /api/tokens/search` - Search tokens
- `GET /api/tokens/:address` - Get token data

### Integrations
- `POST /api/discord/link` - Link Discord account
- `POST /api/telegram/link` - Link Telegram account
- `POST /api/extension/link` - Link browser extension

## Environment Variables

Required:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
MORALIS_API_KEY=your-moralis-key
SENDGRID_API_KEY=your-sendgrid-key
TELEGRAM_BOT_TOKEN=your-telegram-token
DISCORD_BOT_TOKEN=your-discord-token
DISCORD_CLIENT_ID=your-discord-client-id
```

Optional:
```bash
BIRDEYE_API_KEY=enhanced-data-source
SOLANA_STREAMING_API_KEY=real-time-updates
NEXT_PUBLIC_USE_MORALIS_SEARCH=true
```

## Services

The backend runs several services:

- **Monitoring Service**: Checks prices every 60 seconds
- **Notification Service**: Processes alert notifications
- **Discord Bot Service**: Handles Discord commands and notifications
- **Telegram Bot Service**: Manages Telegram interactions
- **Solana Streaming Service**: Real-time price updates
- **Token Service**: Caches and fetches token data

## Bot Setup

### Discord Bot
1. Create application at https://discord.com/developers/applications
2. Add bot to server with permissions: `Send Messages`, `Use Slash Commands`
3. Set `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID` in .env

### Telegram Bot
1. Message @BotFather on Telegram
2. Create new bot with `/newbot`
3. Set `TELEGRAM_BOT_TOKEN` in .env

## Chrome Extension

The extension adds alert functionality to token pages:

- **Supported sites**: pump.fun, dexscreener, solscan, axiom.trade
- **Features**: Price overlay, one-click alerts, account sync
- **Installation**: Load unpacked in Chrome developer mode

## Production Deployment

Using PM2 for process management:

```bash
# Build project
npm run build

# Start with PM2
cd backend
npm run start:production

# Monitor
npm run monitor
```

## Development

### Backend Development
```bash
cd backend
npm run dev              # Start API server
npm run dev:websocket    # Start WebSocket service
```

### Frontend Development
```bash
cd frontend
npm run dev             # Start Next.js dev server
npm run build           # Build for production
```

### Database Migrations
```bash
cd backend
npm run migrate         # Run SQL migrations
```

## Contributing

1. Fork the repo
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit PR

## License

MIT License - see LICENSE file for details.
