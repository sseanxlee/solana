const TelegramBot = require('node-telegram-bot-api');

const token = '7982708926:AAEKtDzX0cM75Q5hxhcH2ezSxKTsVxLdcs0';

console.log('Starting simple Telegram bot...');

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

console.log('Bot initialized. Try sending /start to @stridesol_bot');

// Set up bot commands for autocomplete suggestions
async function setupBotCommands() {
    try {
        const commands = [
            { command: 'start', description: 'Start the bot and get a welcome message' },
            { command: 'help', description: 'Show all available commands' },
            { command: 'watchlist', description: 'View your token watchlist (coming soon)' },
            { command: 'addtoken', description: 'Add a token to your watchlist (coming soon)' },
            { command: 'removetoken', description: 'Remove a token from your watchlist (coming soon)' },
            { command: 'alerts', description: 'View your price alerts (coming soon)' },
            { command: 'setalert', description: 'Set a price alert for a token (coming soon)' },
            { command: 'removealert', description: 'Remove a price alert (coming soon)' },
            { command: 'portfolio', description: 'View your portfolio summary (coming soon)' },
            { command: 'price', description: 'Get current price of a token (coming soon)' },
            { command: 'trending', description: 'See trending tokens (coming soon)' },
            { command: 'settings', description: 'Configure your notification preferences (coming soon)' }
        ];

        await bot.setMyCommands(commands);
        console.log('Bot commands set successfully for autocomplete');
    } catch (error) {
        console.error('Error setting bot commands:', error);
    }
}

// Set up commands when bot starts
setupBotCommands();

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'there';

    console.log(`Received /start from ${firstName} (chat ID: ${chatId})`);

    const welcomeMessage = `
🚀 *Welcome to Solana Token Alerts Bot!* 

Hello ${firstName}! 👋

I'm here to help you track Solana tokens, set price alerts, and manage your watchlist.

Type /help to see all available commands.

Let's get started! 🌟
    `;

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    console.log(`Received /help from chat ID: ${chatId}`);

    const helpMessage = `
🤖 *Solana Token Alerts Bot - Commands*

*Currently Available:*
/start - Start the bot and get welcome message
/help - Show this help message

*Coming Soon:* 🚧
/watchlist - View your token watchlist
/addtoken - Add a token to your watchlist
/removetoken - Remove a token from your watchlist
/alerts - View your price alerts
/setalert - Set a price alert for a token
/removealert - Remove a price alert
/portfolio - View your portfolio summary
/price - Get current price of a token
/trending - See trending tokens
/settings - Configure notification preferences

*How to use commands:*
Just type / and you'll see suggestions! Try typing /he to see /help appear as a suggestion.

Stay tuned for more features! 🚀
    `;

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Handle any text message
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    console.log(`Received message: "${text}" from chat ${chatId}`);

    // Skip if it's a command we already handle
    if (text?.startsWith('/start') || text?.startsWith('/help')) {
        return;
    }

    // If it's not a handled command, send a helpful response
    if (text && !text.startsWith('/')) {
        bot.sendMessage(chatId, 'Hi there! 👋 Try using /help to see what I can do, or /start to begin.');
    }
});

// Handle polling errors
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.message);
});

console.log('Bot is running. Press Ctrl+C to stop.');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nStopping bot...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nStopping bot...');
    bot.stopPolling();
    process.exit(0);
});