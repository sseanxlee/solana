import TelegramBot from 'node-telegram-bot-api';
import { BirdeyeService, BirdeyeTokenMarketData } from './birdeyeService';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const SOLANA_GATEWAY_URL = 'https://solana-gateway.moralis.io';
const SOLANA_CHAIN = 'mainnet';

// Solana address regex pattern
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export class TelegramBotService {
    private static instance: TelegramBotService | null = null;
    private bot: TelegramBot | null = null;
    private isRunning: boolean = false;
    private birdeyeService: BirdeyeService;

    private constructor() {
        this.birdeyeService = BirdeyeService.getInstance();

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
*Welcome to Solana Token Alerts Bot*

Hello ${username}!

I'm here to help you track Solana tokens, set price alerts, and manage your watchlist.

Type /help to see all available commands.

Let's get started!
            `;

            await this.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        });

        // Help command - show all commands
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id.toString();

            const helpMessage = `
*Solana Token Alerts Bot - Commands*

*Currently Available:*
/start - Start the bot and get welcome message
/help - Show this help message


*Coming Soon:*
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


Stay tuned for more features!
            `;

            await this.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
        });

        // Handle callback queries (for inline keyboard buttons)
        this.bot.on('callback_query', async (callbackQuery) => {
            const msg = callbackQuery.message;
            const data = callbackQuery.data;

            if (!msg || !data) return;

            const chatId = msg.chat.id.toString();
            const messageId = msg.message_id;

            if (data.startsWith('refresh_')) {
                const tokenAddress = data.replace('refresh_', '');

                // Answer the callback query immediately
                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Refreshing token data...',
                    show_alert: false
                });

                // Refresh the token information and update the existing message
                await this.refreshTokenMessage(chatId, messageId, tokenAddress);

            } else if (data.startsWith('alert_')) {
                // Placeholder for Set Alert functionality
                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Set Alert feature coming soon!',
                    show_alert: true
                });

            } else if (data.startsWith('settings_')) {
                // Placeholder for Settings functionality
                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Settings feature coming soon!',
                    show_alert: true
                });
            }
        });

        // Handle any other message
        this.bot.on('message', async (msg) => {
            const text = msg.text;

            // Skip if it's a command we already handle
            if (text?.startsWith('/start') || text?.startsWith('/help')) {
                return;
            }

            console.log(`Received message: "${text}" from chat ${msg.chat.id}`);

            // Check if the message contains a Solana address
            if (text && SOLANA_ADDRESS_REGEX.test(text.trim())) {
                const chatId = msg.chat.id.toString();
                const tokenAddress = text.trim();

                console.log(`Detected Solana address: ${tokenAddress}`);
                await this.handleTokenAddressMessage(chatId, tokenAddress);
                return;
            }

            // For any other message, suggest using commands
            if (text && !text.startsWith('/')) {
                const chatId = msg.chat.id.toString();
                this.sendMessage(chatId, 'Hi there! Try using /help to see what I can do, or send me a Solana token address to get token info.');
            }
        });
    }

    private async handleTokenAddressMessage(chatId: string, tokenAddress: string): Promise<void> {
        try {
            // Fetch market data and metadata in parallel (no loading message)
            const [marketData, metadata] = await Promise.allSettled([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            let birdeyeData: BirdeyeTokenMarketData | null = null;
            let tokenMetadata: any = null;

            // Process Birdeye data
            if (marketData.status === 'fulfilled' && marketData.value) {
                birdeyeData = marketData.value;
            }

            // Process metadata
            if (metadata.status === 'fulfilled' && metadata.value) {
                tokenMetadata = metadata.value;
            }

            // Only send message if we have valid market data
            if (birdeyeData) {
                // Format and send the token information with inline keyboard
                const tokenInfo = this.formatTokenInfo(tokenAddress, birdeyeData, tokenMetadata);
                const keyboard = {
                    inline_keyboard: [
                        [
                            {
                                text: '🔄 Refresh',
                                callback_data: `refresh_${tokenAddress}`
                            },
                            {
                                text: '🚨 Set Alert',
                                callback_data: `alert_${tokenAddress}`
                            },
                            {
                                text: '⚙️ Settings',
                                callback_data: `settings_${tokenAddress}`
                            }
                        ]
                    ]
                };

                await this.sendMessage(chatId, tokenInfo, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            // If no valid data, silently ignore (no message sent)

        } catch (error) {
            console.error('Error handling token address:', error);
            // Don't send error message, just log and silently fail
        }
    }

    private async refreshTokenMessage(chatId: string, messageId: number, tokenAddress: string): Promise<void> {
        try {
            // Fetch fresh market data and metadata in parallel
            const [marketData, metadata] = await Promise.allSettled([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            let birdeyeData: BirdeyeTokenMarketData | null = null;
            let tokenMetadata: any = null;

            // Process Birdeye data
            if (marketData.status === 'fulfilled' && marketData.value) {
                birdeyeData = marketData.value;
            }

            // Process metadata
            if (metadata.status === 'fulfilled' && metadata.value) {
                tokenMetadata = metadata.value;
            }

            // Only update message if we have valid market data
            if (birdeyeData) {
                // Format the updated token information
                const tokenInfo = this.formatTokenInfo(tokenAddress, birdeyeData, tokenMetadata);
                const keyboard = {
                    inline_keyboard: [
                        [
                            {
                                text: '🔄 Refresh',
                                callback_data: `refresh_${tokenAddress}`
                            },
                            {
                                text: '🚨 Set Alert',
                                callback_data: `alert_${tokenAddress}`
                            },
                            {
                                text: '⚙️ Settings',
                                callback_data: `settings_${tokenAddress}`
                            }
                        ]
                    ]
                };

                // Edit the existing message with updated data
                if (this.bot) {
                    await this.bot.editMessageText(tokenInfo, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                }
            }
            // If no valid data, silently ignore (no message update)

        } catch (error) {
            console.error('Error refreshing token message:', error);
            // Don't send error message, just log and silently fail
        }
    }

    private async fetchTokenMetadata(tokenAddress: string): Promise<any> {
        if (!MORALIS_API_KEY) {
            console.warn('Moralis API key not configured');
            return null;
        }

        try {
            const response = await axios.get(
                `${SOLANA_GATEWAY_URL}/token/${SOLANA_CHAIN}/${tokenAddress}/metadata`,
                {
                    headers: {
                        'X-API-Key': MORALIS_API_KEY,
                        'accept': 'application/json',
                    },
                    timeout: 10000,
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            return null;
        }
    }

    private formatTokenInfo(
        address: string,
        marketData: BirdeyeTokenMarketData | null,
        metadata: any
    ): string {
        const name = metadata?.name || 'Unknown Token';
        const symbol = metadata?.symbol || 'UNKNOWN';
        const shortAddress = `${address.slice(0, 6)}...${address.slice(-6)}`;

        if (!marketData) {
            return `
*Token Information Not Available*

*${name}* ($${symbol})
Address: \`${shortAddress}\`

Market data not available for this token.
            `.trim();
        }

        const price = this.formatPrice(marketData.price);
        const marketCap = this.formatLargeNumber(marketData.market_cap);
        const liquidity = this.formatLargeNumber(marketData.liquidity);
        const fdv = this.formatLargeNumber(marketData.fdv);

        return `
*${name}* ($${symbol})
Address: \`${shortAddress}\`

Price: *$${price}*
Market Cap: *${marketCap}*
Liquidity: *${liquidity}*
FDV: *${fdv}*
        `.trim();
    }

    private formatPrice(price: number): string {
        if (!price || typeof price !== 'number' || isNaN(price)) {
            return '0.0000';
        }
        if (price < 0.000001) {
            return price.toExponential(4);
        }
        return price < 0.01 ? price.toFixed(6) : price.toFixed(4);
    }

    private formatLargeNumber(num: number): string {
        if (!num || typeof num !== 'number' || isNaN(num)) {
            return '$0.00';
        }

        if (num >= 1e9) {
            return `$${(num / 1e9).toFixed(2)}B`;
        } else if (num >= 1e6) {
            return `$${(num / 1e6).toFixed(2)}M`;
        } else if (num >= 1e3) {
            return `$${(num / 1e3).toFixed(2)}K`;
        }
        return `$${num.toFixed(2)}`;
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