import TelegramBot from 'node-telegram-bot-api';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export class TelegramBotService {
    private static instance: TelegramBotService | null = null;
    private bot: TelegramBot | null = null;
    private isRunning: boolean = false;

    private constructor() {
        if (TELEGRAM_BOT_TOKEN) {
            // Initialize bot WITHOUT polling first - we'll start it manually
            this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
                polling: false
            });
            console.log('Telegram bot service initialized');
        } else {
            console.warn('Telegram bot token not configured');
        }
    }

    public static getInstance(): TelegramBotService {
        if (!TelegramBotService.instance) {
            TelegramBotService.instance = new TelegramBotService();
        }
        return TelegramBotService.instance;
    }

    async start(): Promise<void> {
        if (!this.bot || this.isRunning) {
            return;
        }

        try {
            this.isRunning = true;

            // Set up error handling (same as simple-bot.js)
            this.bot.on('polling_error', (error) => {
                console.log('Polling error:', error.message);
            });

            // Set up bot commands for autocomplete/suggestions
            await this.setupBotCommands();

            // Set up command handlers
            this.setupCommandHandlers();

            // Start polling exactly like simple-bot.js does it
            this.bot.startPolling();

            console.log('Telegram bot started successfully');
            console.log('Bot info: @stridesol_bot');
        } catch (error) {
            console.error('Error starting Telegram bot:', error);
            this.isRunning = false;
        }
    }

    async stop(): Promise<void> {
        if (!this.bot || !this.isRunning) {
            return;
        }

        try {
            this.bot.stopPolling();
            this.isRunning = false;
            console.log('Telegram bot stopped');
        } catch (error) {
            console.error('Error stopping Telegram bot:', error);
        }
    }

    private async setupBotCommands(): Promise<void> {
        if (!this.bot) return;

        try {
            // Define bot commands for autocomplete suggestions
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

            await this.bot.setMyCommands(commands);
            console.log('Bot commands set successfully for autocomplete');
        } catch (error) {
            console.error('Error setting bot commands:', error);
        }
    }

    private setupCommandHandlers(): void {
        if (!this.bot) return;

        // Start command - just respond with hello
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const username = msg.from?.username || msg.from?.first_name || 'there';

            const welcomeMessage = `
🚀 *Welcome to Solana Token Alerts Bot!* 

Hello ${username}! 👋

I'm here to help you track Solana tokens, set price alerts, and manage your watchlist.

Type /help to see all available commands.

Let's get started! 🌟
            `;

            await this.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        });

        // Help command - show all commands
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id.toString();

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

            await this.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
        });

        // Handle any other message
        this.bot.on('message', (msg) => {
            const text = msg.text;

            // Skip if it's a command we already handle
            if (text?.startsWith('/start') || text?.startsWith('/help')) {
                return;
            }

            console.log(`Received message: "${text}" from chat ${msg.chat.id}`);

            // For any other message, suggest using commands
            if (text && !text.startsWith('/')) {
                const chatId = msg.chat.id.toString();
                this.sendMessage(chatId, 'Hi there! 👋 Try using /help to see what I can do, or /start to begin.');
            }
        });
    }

    private async sendMessage(chatId: string, message: string, options?: any): Promise<void> {
        if (!this.bot) return;

        try {
            await this.bot.sendMessage(chatId, message, options);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    isRunningBot(): boolean {
        return this.isRunning;
    }
} 