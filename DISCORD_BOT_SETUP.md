# Discord Bot Setup Guide

This guide will help you set up the Discord bot for token price alerts that works 24/7, providing the same functionality as the Telegram bot.

## Features

✅ **Real-time token monitoring** - Checks prices every minute  
✅ **24/7 operation** - Works continuously even when users are offline  
✅ **Discord slash commands** - Modern Discord commands with autocomplete  
✅ **Interactive embeds** - Beautiful formatted messages with buttons  
✅ **Multiple alert types** - Price and market cap alerts  
✅ **Instant notifications** - Get notified immediately when conditions are met  
✅ **Multi-platform sync** - Works alongside Telegram bot and web app  

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Discord account
- Basic knowledge of environment variables

## Step 1: Create a Discord Application & Bot

1. **Go to Discord Developer Portal**
   - Visit https://discord.com/developers/applications
   - Sign in with your Discord account

2. **Create New Application**
   ```
   Click "New Application"
   ```

3. **Choose an application name**
   - Example: `Solana Token Alerts Bot`

4. **Go to Bot Section**
   - Click on "Bot" in the left sidebar
   - Click "Add Bot"

5. **Configure Bot Settings**
   - **Username**: Choose a bot username (e.g., `SolanaAlerts`)
   - **Public Bot**: Turn OFF (unless you want others to invite your bot)
   - **Requires OAuth2 Code Grant**: Turn OFF
   - **Message Content Intent**: Turn ON (required for reading messages)
   - **Server Members Intent**: Turn OFF
   - **Presence Intent**: Turn OFF

6. **Save your bot token**
   - Click "Reset Token" and copy the new token
   - **Keep this token secure!**

7. **Get your Application ID**
   - Go to "General Information" tab
   - Copy the "Application ID"

## Step 2: Configure Environment Variables

1. **Add Discord bot configuration to `.env`**
   ```bash
   # Discord Bot Configuration
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   DISCORD_CLIENT_ID=your_application_id_here
   ENABLE_DISCORD_NOTIFICATIONS=true
   ```

2. **Complete environment configuration**
   ```bash
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/solana_alerts
   
   # JWT Secret (generate a random string)
   JWT_SECRET=your_super_secret_random_string_here
   
   # Token Data API (recommended)
   MORALIS_API_KEY=your_moralis_api_key_here
   
   # Enable/Disable Services
   ENABLE_EMAIL_NOTIFICATIONS=true
   ENABLE_TELEGRAM_NOTIFICATIONS=true
   ENABLE_DISCORD_NOTIFICATIONS=true
   ```

## Step 3: Install Dependencies

1. **Install Discord.js**
   ```bash
   cd backend
   npm install discord.js@^14.14.1
   ```

## Step 4: Database Setup

The database migrations already include Discord support. Run:

```bash
cd backend
npm run migrate
```

This creates the necessary tables including support for `discord_user_id`.

## Step 5: Start the Services

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

## Step 6: Invite Bot to Your Server

1. **Generate invite link**
   - Go back to Discord Developer Portal > Your App > OAuth2 > URL Generator
   - **Scopes**: Select `bot` and `applications.commands`
   - **Bot Permissions**: Select:
     - Send Messages
     - Use Slash Commands
     - Embed Links
     - Read Message History

2. **Copy the generated URL and visit it**
   - Select your Discord server
   - Click "Authorize"

## Step 7: Test Your Bot

1. **Use slash commands in your Discord server**
   ```
   /start
   /help
   /token So11111111111111111111111111111111111111112
   /prices
   ```

2. **Send token addresses directly**
   ```
   So11111111111111111111111111111111111111112
   4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R
   ```

## Discord Bot Commands

### Slash Commands
- `/start` - Get started with the bot
- `/help` - Show all available commands
- `/token <address>` - Get detailed token information
- `/alerts` - View your active alerts
- `/prices` - Show current SOL price and tracked tokens
- `/clear` - Clear all your active alerts

### Interactive Features
- **Token Analysis**: Send any Solana token address to get detailed info
- **Interactive Buttons**: Set alerts, refresh data, view on Solscan
- **Rich Embeds**: Beautiful formatted messages with colors and emojis
- **Button Navigation**: Easy-to-use interface for setting up alerts

### Alert Types (Coming Soon)
- **Market Cap Alerts**: Get notified when market cap reaches specific values
- **Price Increase Alerts**: Get notified when price increases by percentage
- **Price Decrease Alerts**: Get notified when price decreases by percentage

## How It Works

### 1. Modern Discord Integration
- Uses Discord.js v14 with slash commands
- Interactive embeds with buttons
- Rich message formatting with colors and emojis
- Direct message notifications for triggered alerts

### 2. Continuous Monitoring
- Same monitoring service as Telegram bot
- Checks all active alerts every minute
- Fetches real-time price data from Moralis/Jupiter APIs
- Supports Discord notifications alongside email and Telegram

### 3. Alert Processing
- When a price/market cap condition is met, the alert triggers
- Notification is sent instantly via Discord DM
- Alert is automatically disabled to prevent spam
- Full integration with web app and Telegram bot

### 4. Token Support
- Supports any Solana token with a valid address
- Automatically fetches token metadata (name, symbol, description)
- Works with pump.fun tokens, established tokens, etc.
- Rich token information display with market data

## Multi-Platform Integration

### Web App Integration
- Link your Discord account through the web interface
- Alerts sync between Discord, Telegram, and web app
- Manage all notifications from one dashboard

### Telegram Bot Compatibility
- Run both Discord and Telegram bots simultaneously
- Users can choose their preferred platform
- Shared backend and database
- Consistent functionality across platforms

## Production Deployment

### Environment Variables for Production
```bash
NODE_ENV=production
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_TELEGRAM_NOTIFICATIONS=true
ENABLE_DISCORD_NOTIFICATIONS=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Discord Configuration
DISCORD_BOT_TOKEN=your_production_discord_token
DISCORD_CLIENT_ID=your_production_application_id
```

### Recommended Services
- **Database**: PostgreSQL on Railway/Supabase/AWS RDS
- **Backend**: Railway/Heroku/DigitalOcean
- **Monitoring**: Built-in monitoring service (included)

## Troubleshooting

### Bot Not Responding
1. Check if `DISCORD_BOT_TOKEN` is correct
2. Verify `DISCORD_CLIENT_ID` is correct
3. Ensure the backend server is running
4. Check server logs for errors
5. Verify bot has proper permissions in Discord server

### Slash Commands Not Appearing
1. Make sure bot has `applications.commands` scope
2. Check if commands are registered (server logs should show registration)
3. Wait a few minutes for Discord to update commands
4. Try refreshing Discord client

### Alerts Not Triggering
1. Verify monitoring service is running (check `/api/admin/stats`)
2. Ensure `MORALIS_API_KEY` is configured
3. Check token addresses are valid (44 characters)
4. Verify Discord user is linked in database

### Database Connection Issues
1. Verify `DATABASE_URL` is correct
2. Ensure database tables are created (`npm run migrate`)
3. Check database user permissions
4. Verify Discord user ID is stored correctly

### Permission Issues
1. Ensure bot has "Send Messages" permission
2. Check "Embed Links" permission for rich embeds
3. Verify "Use Slash Commands" permission
4. Ensure bot can send DMs to users

## Security Notes

- **Never share your bot token publicly**
- Use environment variables for all secrets
- Enable rate limiting in production
- Consider implementing user authentication for web interface
- Bot token has access to all servers it's invited to

## Discord-Specific Features

### Rich Embeds
```javascript
// Example of how the bot creates rich embeds
const embed = new EmbedBuilder()
    .setColor(0x9945FF)
    .setTitle('🪙 Solana (SOL)')
    .setDescription('So11111111111111111111111111111111111111112')
    .addFields(
        { name: '💰 Price (USD)', value: '$220.50', inline: true },
        { name: '📊 Market Cap', value: '$103.2B', inline: true }
    )
    .setTimestamp();
```

### Interactive Buttons
```javascript
// Example button creation
const actionRow = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('alert_token')
            .setLabel('Set Alert')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔔')
    );
```

## API Endpoints

### Admin Endpoints
- `GET /api/admin/stats` - Check Discord bot status alongside other services
- `POST /api/admin/restart` - Restart Discord bot service

### User Endpoints
- All existing API endpoints support Discord notifications
- Choose `"discord"` as notification type when creating alerts

## Differences from Telegram Bot

### Advantages
- **Modern UI**: Rich embeds, buttons, and interactive elements
- **Slash Commands**: Autocomplete and better user experience
- **Server Integration**: Works in Discord servers, not just DMs
- **Better Formatting**: Rich text, colors, and embedded links

### Considerations
- **Server Permissions**: Requires proper bot permissions
- **Platform Dependency**: Users need Discord account
- **Command Registration**: Slash commands need to be registered

## Future Enhancements

### Planned Features
- **Server-wide alerts**: Share token alerts with entire Discord server
- **Role-based notifications**: Different alert types for different Discord roles
- **Chart integration**: Embedded price charts in messages
- **Voice alerts**: Audio notifications in voice channels
- **Custom embed themes**: Configurable colors and branding

### Community Features
- **Token discussions**: Discussion threads for tracked tokens
- **Shared watchlists**: Community-driven token tracking
- **Social features**: Share successful alerts with community

---

**Need Help?**
- Check the logs for detailed error messages
- Ensure all environment variables are set correctly
- Verify Discord bot permissions and invite scopes
- Test with `/help` command first

The Discord bot provides the same powerful functionality as the Telegram bot with a modern Discord-native experience! 