import TelegramBot from 'node-telegram-bot-api';
import { BirdeyeService, BirdeyeTokenMarketData } from './birdeyeService';
import { SolanaStreamingService } from './solanaStreamingService';
import { SolPriceService } from './solPriceService';
import { query } from '../config/database';
import axios from 'axios';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const MORALIS_API_KEY = process.env.MORALIS_API_KEY || '';
const SOLANA_GATEWAY_URL = 'https://solana-gateway.moralis.io';
const SOLANA_CHAIN = 'mainnet';
const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';

// Regex for Solana addresses
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Interface for storing token alert data
interface TokenAlertData {
    address: string;
    name: string;
    symbol: string;
    circulatingSupply: number;
    lastPrice: number;
}

export class TelegramBotService {
    private static instance: TelegramBotService | null = null;
    private bot: TelegramBot | null = null;
    private isRunning: boolean = false;
    private birdeyeService: BirdeyeService;
    private streamingService: SolanaStreamingService;
    private solPriceService: SolPriceService;
    private tokenAlerts: Map<string, TokenAlertData> = new Map(); // Store token data for alerts
    private solPriceCache: { price: number; lastUpdated: number } | null = null;

    private constructor() {
        if (!TELEGRAM_TOKEN) {
            throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
        }
        this.bot = new TelegramBot(TELEGRAM_TOKEN);
        this.birdeyeService = BirdeyeService.getInstance();
        this.streamingService = SolanaStreamingService.getInstance();
        this.solPriceService = SolPriceService.getInstance();

        // Set up streaming service callbacks
        this.setupStreamingCallbacks();
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
                { command: 'start', description: 'Start the bot and get welcome message' },
                { command: 'help', description: 'Show help and available commands' },
                { command: 'setalert', description: 'Set market cap alert for a token' },
                { command: 'stopalert', description: 'Stop market cap monitoring' },
                { command: 'alertstatus', description: 'Check current alert status' },
                { command: 'prices', description: 'Show current SOL price and prices for tracked tokens' },
                { command: 'watchlist', description: 'View your token watchlist (coming soon)' },
                { command: 'addtoken', description: 'Add token to watchlist (coming soon)' },
                { command: 'removetoken', description: 'Remove token from watchlist (coming soon)' },
                { command: 'alerts', description: 'View your price alerts (coming soon)' },
                { command: 'removealert', description: 'Remove a price alert (coming soon)' },
                { command: 'portfolio', description: 'View portfolio summary (coming soon)' },
                { command: 'price', description: 'Get current token price (coming soon)' },
                { command: 'trending', description: 'See trending tokens (coming soon)' },
                { command: 'settings', description: 'Configure preferences (coming soon)' }
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

        // Handle /help command
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const helpMessage = `
*Welcome to SolanaBot*

Available Commands:

/start - Welcome message
/help - Show this help message

*Token Information:*
Send any Solana token address to get detailed info
/prices - Show current SOL price and prices for tracked tokens

*Market Cap Alerts:*
/setalert - Set market cap alert for a token
/stopalert - Stop market cap monitoring
/alertstatus - Check current alert status

*Coming Soon:*
/watchlist - View your token watchlist
/addtoken - Add token to watchlist
/removetoken - Remove token from watchlist
/alerts - View your price alerts
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

            } else if (data.startsWith('mcap_')) {
                const alertId = data.replace('mcap_', '');
                const tokenData = this.getTokenForAlert(alertId);

                if (!tokenData) {
                    await this.bot?.answerCallbackQuery(callbackQuery.id, {
                        text: 'Alert expired. Please try again.',
                        show_alert: true
                    });
                    return;
                }

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Please enter target market cap...',
                    show_alert: false
                });

                await this.handleMarketCapAlertSetup(chatId, messageId, tokenData.address);

            } else if (data.startsWith('pinc_')) {
                const alertId = data.replace('pinc_', '');
                const tokenData = this.getTokenForAlert(alertId);

                if (!tokenData) {
                    await this.bot?.answerCallbackQuery(callbackQuery.id, {
                        text: 'Alert expired. Please try again.',
                        show_alert: true
                    });
                    return;
                }

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Select market cap increase percentage...',
                    show_alert: false
                });

                await this.handlePriceIncreaseAlertSetup(chatId, messageId, tokenData.address, alertId);

            } else if (data.startsWith('pdec_')) {
                const alertId = data.replace('pdec_', '');
                const tokenData = this.getTokenForAlert(alertId);

                if (!tokenData) {
                    await this.bot?.answerCallbackQuery(callbackQuery.id, {
                        text: 'Alert expired. Please try again.',
                        show_alert: true
                    });
                    return;
                }

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Select market cap decrease percentage...',
                    show_alert: false
                });

                await this.handlePriceDecreaseAlertSetup(chatId, messageId, tokenData.address, alertId);

            } else if (data.startsWith('cancel_')) {
                const alertId = data.replace('cancel_', '');
                this.clearTokenForAlert(alertId);

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Alert setup cancelled.',
                    show_alert: false
                });

                await this.bot?.editMessageText('❌ Alert setup cancelled.', {
                    chat_id: chatId,
                    message_id: messageId
                });

            } else if (data.startsWith('edit_presets_increase_')) {
                const alertId = data.split('_')[3];
                const tokenData = this.getTokenForAlert(alertId);

                if (!tokenData) {
                    await this.bot?.answerCallbackQuery(callbackQuery.id, {
                        text: 'Alert expired. Please try again.',
                        show_alert: true
                    });
                    return;
                }

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Opening preset editor...',
                    show_alert: false
                });

                await this.handlePresetEdit(chatId, messageId, tokenData.address, alertId, 'price_increase');

            } else if (data.startsWith('edit_presets_decrease_')) {
                const alertId = data.split('_')[3];
                const tokenData = this.getTokenForAlert(alertId);

                if (!tokenData) {
                    await this.bot?.answerCallbackQuery(callbackQuery.id, {
                        text: 'Alert expired. Please try again.',
                        show_alert: true
                    });
                    return;
                }

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Opening preset editor...',
                    show_alert: false
                });

                await this.handlePresetEdit(chatId, messageId, tokenData.address, alertId, 'price_decrease');

            } else if (data.startsWith('pi_')) {
                const [, percentage, alertId] = data.split('_');
                const tokenData = this.getTokenForAlert(alertId);

                if (!tokenData) {
                    await this.bot?.answerCallbackQuery(callbackQuery.id, {
                        text: 'Alert expired. Please try again.',
                        show_alert: true
                    });
                    return;
                }

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: `Setting ${percentage}% market cap increase alert...`,
                    show_alert: false
                });

                await this.createPricePercentageAlert(chatId, messageId, tokenData.address, parseInt(percentage), 'increase');
                this.clearTokenForAlert(alertId);

            } else if (data.startsWith('pd_')) {
                const [, percentage, alertId] = data.split('_');
                const tokenData = this.getTokenForAlert(alertId);

                if (!tokenData) {
                    await this.bot?.answerCallbackQuery(callbackQuery.id, {
                        text: 'Alert expired. Please try again.',
                        show_alert: true
                    });
                    return;
                }

                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: `Setting ${percentage}% market cap decrease alert...`,
                    show_alert: false
                });

                await this.createPricePercentageAlert(chatId, messageId, tokenData.address, parseInt(percentage), 'decrease');
                this.clearTokenForAlert(alertId);

            } else if (data.startsWith('alert_')) {
                // Legacy alert button from token info
                await this.bot?.answerCallbackQuery(callbackQuery.id, {
                    text: 'Use /setalert <token_address> to set alerts!',
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

        // Handle /setalert command
        this.bot.onText(/\/setalert(?:\s+(.+))?/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const tokenAddress = match?.[1]?.trim();

            if (!tokenAddress) {
                await this.sendMessage(chatId, 'Please provide a token address.\n\nUsage: /setalert <token_address>');
                return;
            }

            if (!SOLANA_ADDRESS_REGEX.test(tokenAddress)) {
                await this.sendMessage(chatId, 'Invalid Solana token address format.');
                return;
            }

            try {
                console.log('TelegramBot: Setting up alert for token:', tokenAddress);

                // Fetch token data from Birdeye
                const [marketData, metadata] = await Promise.allSettled([
                    this.birdeyeService.getTokenMarketData(tokenAddress),
                    this.fetchTokenMetadata(tokenAddress)
                ]);

                let birdeyeData: BirdeyeTokenMarketData | null = null;
                let tokenMetadata: any = null;

                if (marketData.status === 'fulfilled' && marketData.value) {
                    birdeyeData = marketData.value;
                }

                if (metadata.status === 'fulfilled' && metadata.value) {
                    tokenMetadata = metadata.value;
                }

                if (!birdeyeData) {
                    await this.sendMessage(chatId, 'Unable to fetch token data. Please try again with a valid token address.');
                    return;
                }

                const tokenName = tokenMetadata?.name || 'Unknown Token';
                const tokenSymbol = tokenMetadata?.symbol || 'UNKNOWN';

                // Use Birdeye's direct market cap (already in USD)
                const currentMarketCap = birdeyeData.market_cap;
                // Convert SOL price to USD using current SOL price
                const currentPriceUSD = birdeyeData.price * await this.getSolPrice();

                // Log alert setup information to terminal
                console.log('═'.repeat(60));
                console.log('🚨 ALERT SETUP INITIATED');
                console.log('═'.repeat(60));
                console.log(`Token: ${tokenName} ($${tokenSymbol})`);
                console.log(`Address: ${tokenAddress}`);
                console.log(`Price: $${this.formatPrice(currentPriceUSD)}`);
                console.log(`Market Cap: ${this.formatLargeNumber(currentMarketCap)}`);
                console.log(`User: ${chatId}`);
                console.log(`Time: ${new Date().toLocaleString()}`);
                console.log('═'.repeat(60));

                // Store token data for callback reference
                const alertId = this.generateAlertId();
                this.storeTokenForAlert(alertId, tokenAddress, tokenName, tokenSymbol);

                // Show alert type selection
                const alertTypeMessage = `🚨 *Set Price Alert*

Token: *${tokenName}* ($${tokenSymbol})
Address: \`${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}\`

Current Price: *$${this.formatPrice(currentPriceUSD)}*
Current Market Cap: *${this.formatLargeNumber(currentMarketCap)}*

Choose alert type:`;

                const keyboard = {
                    inline_keyboard: [
                        [
                            {
                                text: '📊 Market Cap Alert',
                                callback_data: `mcap_${alertId}`
                            }
                        ],
                        [
                            {
                                text: '📈 Market Cap Increase Alert',
                                callback_data: `pinc_${alertId}`
                            }
                        ],
                        [
                            {
                                text: '📉 Market Cap Decrease Alert',
                                callback_data: `pdec_${alertId}`
                            }
                        ],
                        [
                            {
                                text: '❌ Cancel',
                                callback_data: `cancel_${alertId}`
                            }
                        ]
                    ]
                };

                await this.sendMessage(chatId, alertTypeMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });

            } catch (error) {
                console.error('Error setting up alert:', error);
                await this.sendMessage(chatId, 'Error setting up alert. Please try again later.');
            }
        });

        // Handle /stopalert command
        this.bot.onText(/\/stopalert/, async (msg) => {
            const chatId = msg.chat.id.toString();

            try {
                await this.streamingService.stopMonitoring();
                this.removeMonitoringUser(chatId);
                this.tokenAlerts.clear();
                await this.sendMessage(chatId, '🛑 Market cap monitoring stopped.');
            } catch (error) {
                console.error('Error stopping alert:', error);
                await this.sendMessage(chatId, 'Error stopping alert. Please try again.');
            }
        });

        // Handle /alertstatus command
        this.bot.onText(/\/alertstatus/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const isMonitoring = this.streamingService.isMonitoring();
            const currentToken = this.streamingService.getCurrentToken();

            if (!isMonitoring || !currentToken) {
                await this.sendMessage(chatId, '📊 *Alert Status*\n\nNo active alerts.', { parse_mode: 'Markdown' });
                return;
            }

            const tokenData = this.tokenAlerts.get(currentToken);
            if (!tokenData) {
                await this.sendMessage(chatId, '📊 *Alert Status*\n\nMonitoring active but no token data found.', { parse_mode: 'Markdown' });
                return;
            }

            const currentMarketCap = await this.calculateMarketCap(tokenData.lastPrice, tokenData.circulatingSupply);

            const statusMessage = `
📊 *Alert Status*

Token: *${tokenData.name}* ($${tokenData.symbol})
Address: \`${currentToken.slice(0, 8)}...${currentToken.slice(-8)}\`

Current Market Cap: *${this.formatLargeNumber(currentMarketCap)}*
Current Price: *$${this.formatPrice(tokenData.lastPrice)}*
Circulating Supply: *${this.formatLargeNumber(tokenData.circulatingSupply)}*

Status: 🟢 Active
Monitoring Users: ${this.getMonitoringUsers().length}
            `.trim();

            await this.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
        });

        // Handle /prices command
        this.bot.onText(/\/prices/, async (msg) => {
            const chatId = msg.chat.id.toString();

            try {
                // Get SOL price
                const solPrice = await this.getSolPrice();

                // Get all unique token addresses with active alerts
                const alertsResult = await query(`
                    SELECT DISTINCT token_address, token_name, token_symbol
                    FROM token_alerts 
                    WHERE is_active = true AND is_triggered = false
                    ORDER BY token_name
                `);

                let pricesMessage = `💰 *Current Prices*\n\n🟣 *Solana (SOL)*: *$${this.formatPrice(solPrice)}*\n\n`;

                if (alertsResult.rows.length === 0) {
                    pricesMessage += '📊 *Tracked Tokens*\n\nNo tokens with active alerts.';
                } else {
                    pricesMessage += '📊 *Tracked Tokens*\n';

                    // Fetch current market data for each token
                    for (const alert of alertsResult.rows) {
                        try {
                            const marketData = await this.birdeyeService.getTokenMarketData(alert.token_address);

                            if (marketData) {
                                const tokenPriceUSD = marketData.price * solPrice;
                                const marketCap = marketData.market_cap;
                                const shortAddress = `${alert.token_address.slice(0, 6)}...${alert.token_address.slice(-6)}`;

                                pricesMessage += `\n*${alert.token_name}* ($${alert.token_symbol})\n`;
                                pricesMessage += `Address: \`${shortAddress}\`\n`;
                                pricesMessage += `Price: *$${this.formatPrice(tokenPriceUSD)}*\n`;
                                pricesMessage += `Market Cap: *${this.formatLargeNumber(marketCap)}*\n`;
                            } else {
                                const shortAddress = `${alert.token_address.slice(0, 6)}...${alert.token_address.slice(-6)}`;
                                pricesMessage += `\n*${alert.token_name}* ($${alert.token_symbol})\n`;
                                pricesMessage += `Address: \`${shortAddress}\`\n`;
                                pricesMessage += `Price: *Data unavailable*\n`;
                            }
                        } catch (error) {
                            console.error(`Error fetching data for token ${alert.token_address}:`, error);
                            const shortAddress = `${alert.token_address.slice(0, 6)}...${alert.token_address.slice(-6)}`;
                            pricesMessage += `\n*${alert.token_name}* ($${alert.token_symbol})\n`;
                            pricesMessage += `Address: \`${shortAddress}\`\n`;
                            pricesMessage += `Price: *Error fetching data*\n`;
                        }
                    }
                }

                pricesMessage += `\n\n🕐 *Updated*: ${new Date().toLocaleString()}`;

                await this.sendMessage(chatId, pricesMessage, { parse_mode: 'Markdown' });

            } catch (error) {
                console.error('Error in /prices command:', error);
                await this.sendMessage(chatId, '❌ Error fetching prices. Please try again later.');
            }
        });

        // Handle any other message
        this.bot.on('message', async (msg) => {
            const text = msg.text;
            const chatId = msg.chat.id.toString();

            // Skip if it's a command we already handle
            if (text?.startsWith('/start') || text?.startsWith('/help') || text?.startsWith('/setalert') || text?.startsWith('/stopalert') || text?.startsWith('/alertstatus') || text?.startsWith('/prices')) {
                return;
            }

            console.log(`Received message: "${text}" from chat ${msg.chat.id}`);

            // Check for pending alert input
            const pendingAlert = this.pendingAlerts.get(chatId);
            if (pendingAlert && text) {
                if (pendingAlert.type === 'marketcap' && pendingAlert.step === 'awaiting_value') {
                    await this.handleMarketCapInput(chatId, text, pendingAlert.tokenAddress);
                    return;
                } else if (pendingAlert.type === 'price_increase' && pendingAlert.step === 'awaiting_percentage') {
                    await this.handlePricePercentageInput(chatId, text, pendingAlert.tokenAddress, pendingAlert.alertId, 'increase');
                    return;
                } else if (pendingAlert.type === 'price_decrease' && pendingAlert.step === 'awaiting_percentage') {
                    await this.handlePricePercentageInput(chatId, text, pendingAlert.tokenAddress, pendingAlert.alertId, 'decrease');
                    return;
                } else if (pendingAlert.type === 'preset_edit' && pendingAlert.step === 'awaiting_percentages') {
                    await this.handlePresetInput(chatId, text, pendingAlert);
                    return;
                }
            }

            // Check if the message contains a Solana address
            if (text && SOLANA_ADDRESS_REGEX.test(text.trim())) {
                const tokenAddress = text.trim();

                console.log(`Detected Solana address: ${tokenAddress}`);
                await this.handleTokenAddressMessage(chatId, tokenAddress);
                return;
            }

            // Don't send "Hi there" message for unrecognized input - just ignore
            // This prevents unwanted messages during alert setup flows
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
                // Get token details for logging
                const tokenName = tokenMetadata?.name || 'Unknown Token';
                const tokenSymbol = tokenMetadata?.symbol || 'UNKNOWN';
                const solPrice = await this.getSolPrice();
                const currentPriceUSD = birdeyeData.price * solPrice;
                const currentMarketCap = birdeyeData.market_cap;

                // Log token information to terminal
                console.log('═'.repeat(60));
                console.log('📋 TOKEN INFORMATION DISPLAYED');
                console.log('═'.repeat(60));
                console.log(`Token: ${tokenName} ($${tokenSymbol})`);
                console.log(`Address: ${tokenAddress}`);
                console.log(`Price: $${this.formatPrice(currentPriceUSD)}`);
                console.log(`Market Cap: ${this.formatLargeNumber(currentMarketCap)}`);
                console.log(`User: ${chatId}`);
                console.log(`Time: ${new Date().toLocaleString()}`);
                console.log('═'.repeat(60));

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
        try {
            const response = await axios.get(
                'https://public-api.birdeye.so/defi/v3/token/meta-data/single',
                {
                    params: {
                        address: tokenAddress
                    },
                    headers: {
                        'X-API-KEY': process.env.BIRDEYE_API_KEY || '5e51a538dc184b669b532714a315ea2e',
                        'accept': 'application/json',
                        'x-chain': 'solana'
                    },
                    timeout: 10000,
                }
            );

            // Birdeye returns data in a nested structure
            if (response.data && response.data.success && response.data.data) {
                return response.data.data;
            }

            return null;
        } catch (error) {
            console.error('Error fetching token metadata from Birdeye:', error);
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

    public async sendMessage(chatId: string, message: string, options?: any): Promise<void> {
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

    private setupStreamingCallbacks(): void {
        console.log('TelegramBot: Setting up streaming callbacks...');
        this.streamingService.setCallbacks({
            onSwap: (notification) => {
                console.log('TelegramBot: onSwap callback triggered');
                this.handleSwapNotification(notification);
            },
            onPing: () => {
                console.log('TelegramBot: onPing callback triggered');
                this.handlePingNotification();
            },
            onError: (error) => {
                console.log('TelegramBot: onError callback triggered');
                this.handleStreamingError(error);
            },
            onStatus: (status) => {
                console.log('TelegramBot: onStatus callback triggered');
                this.handleStreamingStatus(status);
            }
        });
        console.log('TelegramBot: Streaming callbacks set up successfully');
    }

    private async handleSwapNotification(notification: any): Promise<void> {
        console.log('TelegramBot: handleSwapNotification called!', notification);

        const { swap, blockTime, signature, slot } = notification;
        const tokenAddress = swap.baseTokenMint;
        const shortToken = `${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}`;

        // Get token data for market cap calculation
        const tokenData = this.tokenAlerts.get(tokenAddress);
        if (!tokenData) {
            console.log('TelegramBot: No token data found for market cap calculation');
            return;
        }

        // Update the last price
        const newPrice = parseFloat(swap.quotePrice);
        tokenData.lastPrice = newPrice;
        this.tokenAlerts.set(tokenAddress, tokenData);

        // Calculate new market cap using the correct formula: circulating_supply * sol_price_usd * quote_price
        const newMarketCap = this.solPriceService.calculateMarketCap(tokenData.circulatingSupply, newPrice);

        // Check for triggered alerts
        await this.checkAndTriggerAlerts(tokenAddress, newPrice, newMarketCap);

        const solPriceUSD = this.solPriceService.getSolPriceUSD();
        const tokenPriceUSD = newPrice * solPriceUSD;

        const message = `
📊 *MARKET CAP UPDATE*

Token: *${tokenData.name}* ($${tokenData.symbol})
Address: \`${shortToken}\`

New Price: *$${this.formatPrice(tokenPriceUSD)}*
Market Cap: *${this.formatLargeNumber(newMarketCap)}*
SOL Price: *$${this.formatPrice(solPriceUSD)}*

Swap Type: *${swap.swapType.toUpperCase()}*
Amount: ${this.formatLargeNumber(parseFloat(swap.baseAmount))}
Exchange: ${swap.sourceExchange || 'Unknown'}
Time: ${new Date(blockTime * 1000).toLocaleString()}

Tx: \`${signature.slice(0, 16)}...\`
        `.trim();

        console.log('TelegramBot: Broadcasting market cap update to users:', this.getMonitoringUsers());

        // Send to all monitoring users
        await this.broadcastToMonitoringUsers(message);
    }

    private async handlePingNotification(): Promise<void> {
        console.log('TelegramBot: handlePingNotification called!');

        const currentToken = this.streamingService.getCurrentToken();
        const message = `
*WebSocket Ping*

Monitoring: ${currentToken ? `\`${currentToken.slice(0, 8)}...${currentToken.slice(-8)}\`` : 'None'}
Status: Active
Time: ${new Date().toLocaleString()}
        `.trim();

        console.log('TelegramBot: Broadcasting ping message to users:', this.getMonitoringUsers());
        await this.broadcastToMonitoringUsers(message);
    }

    private async handleStreamingError(error: string): Promise<void> {
        const message = `*WebSocket Error*\n\n${error}`;
        await this.broadcastToMonitoringUsers(message);
    }

    private async handleStreamingStatus(status: string): Promise<void> {
        const message = `*WebSocket Status*\n\n${status}`;
        await this.broadcastToMonitoringUsers(message);
    }

    private async broadcastToMonitoringUsers(message: string): Promise<void> {
        // For now, store active monitoring users in memory
        // In production, you'd use a database
        const monitoringUsers = this.getMonitoringUsers();

        for (const chatId of monitoringUsers) {
            try {
                await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error(`Failed to send message to ${chatId}:`, error);
            }
        }
    }

    private monitoringUsers: Set<string> = new Set();

    private addMonitoringUser(chatId: string): void {
        this.monitoringUsers.add(chatId);
    }

    private removeMonitoringUser(chatId: string): void {
        this.monitoringUsers.delete(chatId);
    }

    private getMonitoringUsers(): string[] {
        return Array.from(this.monitoringUsers);
    }

    // SOL price fetching with caching
    private async getSolPrice(): Promise<number> {
        const now = Date.now();
        const cacheValidTime = 60000; // 1 minute cache

        // Return cached price if valid
        if (this.solPriceCache && (now - this.solPriceCache.lastUpdated) < cacheValidTime) {
            return this.solPriceCache.price;
        }

        try {
            const response = await axios.get(`${SOLANA_GATEWAY_URL}/token/${SOLANA_CHAIN}/${SOL_TOKEN_ADDRESS}/price`, {
                headers: {
                    'X-API-Key': MORALIS_API_KEY,
                    'accept': 'application/json',
                },
                timeout: 10000,
            });

            const solPrice = response.data.usdPrice;

            // Cache the price
            this.solPriceCache = {
                price: solPrice,
                lastUpdated: now
            };

            console.log(`SOL price fetched: $${solPrice}`);
            return solPrice;
        } catch (error) {
            console.error('Error fetching SOL price:', error);
            // Return cached price if available, otherwise fallback
            return this.solPriceCache?.price || 135; // Fallback price
        }
    }

    // Calculate market cap: price in SOL * circulating supply * SOL price in USD
    private async calculateMarketCap(priceInSol: number, circulatingSupply: number): Promise<number> {
        const solPriceUsd = await this.getSolPrice();
        const tokenPriceUsd = priceInSol * solPriceUsd;
        return tokenPriceUsd * circulatingSupply;
    }

    // Handle market cap alert setup
    private async handleMarketCapAlertSetup(chatId: string, messageId: number, tokenAddress: string): Promise<void> {
        const message = `💰 *Market Cap Alert Setup*

Please enter your target market cap.

*Examples:*
• \`30k\` (30,000)
• \`4.5m\` (4,500,000)  
• \`100m\` (100,000,000)
• \`2.5b\` (2,500,000,000)

Send your target market cap in the chat:`;

        await this.bot?.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });

        // Store the pending alert state
        this.storePendingAlert(chatId, {
            type: 'marketcap',
            tokenAddress,
            step: 'awaiting_value'
        });
    }

    // Handle price increase alert setup
    private async handlePriceIncreaseAlertSetup(chatId: string, messageId: number, tokenAddress: string, alertId: string): Promise<void> {
        const presets = await this.getUserPresets(chatId, 'price_increase');

        const message = `📈 *Market Cap Increase Alert*

Select the percentage increase or type a custom percentage (e.g., "25%" or "150%"):`;

        // Build dynamic keyboard based on user presets
        const buttons: any[][] = [];

        // Add preset buttons in rows of 3
        for (let i = 0; i < presets.length; i += 3) {
            const row = presets.slice(i, i + 3).map(percentage => ({
                text: `${percentage}%`,
                callback_data: `pi_${percentage}_${alertId}`
            }));
            buttons.push(row);
        }

        // Add Edit Presets and Cancel buttons
        buttons.push([
            { text: '⚙️ Edit Presets', callback_data: `edit_presets_increase_${alertId}` },
            { text: '❌ Cancel', callback_data: `cancel_${alertId}` }
        ]);

        const keyboard = { inline_keyboard: buttons };

        // Store pending alert for manual input
        this.storePendingAlert(chatId, {
            type: 'price_increase',
            step: 'awaiting_percentage',
            tokenAddress,
            alertId
        });

        await this.bot?.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Handle price decrease alert setup
    private async handlePriceDecreaseAlertSetup(chatId: string, messageId: number, tokenAddress: string, alertId: string): Promise<void> {
        const presets = await this.getUserPresets(chatId, 'price_decrease');

        const message = `📉 *Market Cap Decrease Alert*

Select the percentage decrease or type a custom percentage (e.g., "25%" or "80%"):`;

        // Build dynamic keyboard based on user presets
        const buttons: any[][] = [];

        // Add preset buttons in rows of 3
        for (let i = 0; i < presets.length; i += 3) {
            const row = presets.slice(i, i + 3).map(percentage => ({
                text: `${percentage}%`,
                callback_data: `pd_${percentage}_${alertId}`
            }));
            buttons.push(row);
        }

        // Add Edit Presets and Cancel buttons
        buttons.push([
            { text: '⚙️ Edit Presets', callback_data: `edit_presets_decrease_${alertId}` },
            { text: '❌ Cancel', callback_data: `cancel_${alertId}` }
        ]);

        const keyboard = { inline_keyboard: buttons };

        // Store pending alert for manual input
        this.storePendingAlert(chatId, {
            type: 'price_decrease',
            step: 'awaiting_percentage',
            tokenAddress,
            alertId
        });

        await this.bot?.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // Create market cap percentage alert
    private async createPricePercentageAlert(chatId: string, messageId: number, tokenAddress: string, percentage: number, direction: 'increase' | 'decrease'): Promise<void> {
        try {
            // Get current token data
            const [marketData, metadata] = await Promise.allSettled([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            let birdeyeData: BirdeyeTokenMarketData | null = null;
            let tokenMetadata: any = null;

            if (marketData.status === 'fulfilled' && marketData.value) {
                birdeyeData = marketData.value;
            }

            if (metadata.status === 'fulfilled' && metadata.value) {
                tokenMetadata = metadata.value;
            }

            if (!birdeyeData) {
                await this.bot?.editMessageText('❌ Unable to fetch current token data. Please try again.', {
                    chat_id: chatId,
                    message_id: messageId
                });
                return;
            }

            // Use Birdeye's direct market cap (already in USD)
            const currentMarketCap = birdeyeData.market_cap;
            const circulatingSupply = birdeyeData.circulating_supply || birdeyeData.total_supply;

            let targetMarketCap: number;
            let condition: string;

            if (direction === 'increase') {
                targetMarketCap = currentMarketCap * (1 + percentage / 100);
                condition = 'above';
            } else {
                targetMarketCap = currentMarketCap * (1 - percentage / 100);
                condition = 'below';
            }

            // Create alert in database using market_cap type
            await this.createAlert(chatId, tokenAddress, tokenMetadata?.name || 'Unknown Token', tokenMetadata?.symbol || 'UNKNOWN', 'market_cap', targetMarketCap, condition, circulatingSupply, currentMarketCap);

            // Start monitoring if not already active
            await this.startMonitoringIfNeeded(tokenAddress);

            const message = `✅ *Alert Created Successfully*

Token: *${tokenMetadata?.name || 'Unknown Token'}* ($${tokenMetadata?.symbol || 'UNKNOWN'})
Alert Type: *Market Cap ${direction === 'increase' ? 'Increase' : 'Decrease'}*
Target: *${direction === 'increase' ? '+' : '-'}${percentage}%*

Current Market Cap: *${this.formatLargeNumber(currentMarketCap)}*
Target Market Cap: *${this.formatLargeNumber(targetMarketCap)}*

You'll be notified when the market cap goes ${condition} your target!`;

            await this.bot?.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('Error creating market cap percentage alert:', error);
            await this.bot?.editMessageText('❌ Error creating alert. Please try again.', {
                chat_id: chatId,
                message_id: messageId
            });
        }
    }

    // Parse market cap input (e.g., "30k", "4.5m", "2b")
    private parseMarketCapInput(input: string): number | null {
        const cleanInput = input.toLowerCase().trim();
        const match = cleanInput.match(/^(\d+(?:\.\d+)?)\s*([kmb]?)$/);

        if (!match) return null;

        const [, numStr, suffix] = match;
        const num = parseFloat(numStr);

        if (isNaN(num) || num <= 0) return null;

        switch (suffix) {
            case 'k': return num * 1000;
            case 'm': return num * 1000000;
            case 'b': return num * 1000000000;
            default: return num;
        }
    }

    // Parse percentage input (e.g., "25%", "150", "1.5%")
    private parsePercentageInput(input: string): number | null {
        const cleanInput = input.trim();

        // Remove % symbol if present
        const numericPart = cleanInput.replace(/%$/g, '');

        // Extract number
        const num = parseFloat(numericPart);

        if (isNaN(num) || num <= 0) return null;

        return num;
    }

    // Store pending alert state
    private pendingAlerts: Map<string, any> = new Map();

    private storePendingAlert(chatId: string, alertData: any): void {
        this.pendingAlerts.set(chatId, alertData);

        // Auto-cleanup after 5 minutes
        setTimeout(() => {
            this.pendingAlerts.delete(chatId);
        }, 5 * 60 * 1000);
    }

    // Create alert in database
    private async createAlert(chatId: string, tokenAddress: string, tokenName: string, tokenSymbol: string, thresholdType: string, thresholdValue: number, condition: string, circulatingSupply?: number, currentMarketCap?: number): Promise<void> {
        try {
            // First ensure user exists
            await this.ensureUserExists(chatId);

            // Create the alert
            await query(`
                INSERT INTO token_alerts (user_id, token_address, token_name, token_symbol, threshold_type, threshold_value, condition, notification_type, circulating_supply, current_market_cap)
                SELECT u.id, $2, $3, $4, $5, $6, $7, 'telegram', $8, $9
                FROM users u WHERE u.telegram_chat_id = $1
            `, [chatId, tokenAddress, tokenName, tokenSymbol, thresholdType, thresholdValue, condition, circulatingSupply, currentMarketCap]);

            console.log(`Alert created for user ${chatId}: ${tokenSymbol} ${condition} ${thresholdType} ${thresholdValue} (circulating: ${circulatingSupply}, mcap: ${currentMarketCap})`);
        } catch (error) {
            console.error('Error creating alert in database:', error);
            throw error;
        }
    }

    // Ensure user exists in database
    private async ensureUserExists(chatId: string): Promise<void> {
        try {
            await query(`
                INSERT INTO users (telegram_chat_id)
                VALUES ($1)
                ON CONFLICT (telegram_chat_id) DO NOTHING
            `, [chatId]);
        } catch (error) {
            console.error('Error ensuring user exists:', error);
            throw error;
        }
    }

    // Start monitoring if needed
    private async startMonitoringIfNeeded(tokenAddress: string): Promise<void> {
        if (!this.streamingService.isMonitoring() || this.streamingService.getCurrentToken() !== tokenAddress) {
            await this.streamingService.startMonitoring(tokenAddress);

            // Store token data for monitoring
            const [marketData, metadata] = await Promise.allSettled([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            if (marketData.status === 'fulfilled' && marketData.value && metadata.status === 'fulfilled' && metadata.value) {
                const tokenAlertData: TokenAlertData = {
                    address: tokenAddress,
                    name: metadata.value?.name || 'Unknown Token',
                    symbol: metadata.value?.symbol || 'UNKNOWN',
                    circulatingSupply: marketData.value.circulating_supply || marketData.value.total_supply,
                    lastPrice: marketData.value.price
                };
                this.tokenAlerts.set(tokenAddress, tokenAlertData);
            }
        }
    }

    // Handle price percentage input from user
    private async handlePricePercentageInput(chatId: string, input: string, tokenAddress: string, alertId: string, direction: 'increase' | 'decrease'): Promise<void> {
        try {
            // Parse percentage input (e.g., "25%", "150", "1.5%")
            const percentage = this.parsePercentageInput(input);

            if (!percentage) {
                await this.sendMessage(chatId, '❌ Invalid percentage format. Please use examples like: 25%, 150%, or just 50');
                return;
            }

            // Validate percentage range
            if (direction === 'increase' && (percentage < 1 || percentage > 10000)) {
                await this.sendMessage(chatId, '❌ Market cap increase percentage must be between 1% and 10000%');
                return;
            }

            if (direction === 'decrease' && (percentage < 1 || percentage >= 100)) {
                await this.sendMessage(chatId, '❌ Market cap decrease percentage must be between 1% and 99%');
                return;
            }

            // Clear pending alert and create the percentage alert
            this.clearTokenForAlert(alertId);
            this.pendingAlerts.delete(chatId);

            // Get current market data to calculate target price
            const [marketData, metadata] = await Promise.allSettled([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            let birdeyeData: BirdeyeTokenMarketData | null = null;
            let tokenMetadata: any = null;

            if (marketData.status === 'fulfilled' && marketData.value) {
                birdeyeData = marketData.value;
            }

            if (metadata.status === 'fulfilled' && metadata.value) {
                tokenMetadata = metadata.value;
            }

            if (!birdeyeData) {
                await this.sendMessage(chatId, '❌ Unable to fetch current token data. Please try again.');
                return;
            }

            const currentPriceSOL = birdeyeData.price;
            const currentPriceUSD = currentPriceSOL * await this.getSolPrice();

            let targetPrice: number;
            let condition: string;

            if (direction === 'increase') {
                targetPrice = currentPriceUSD * (1 + percentage / 100);
                condition = 'above';
            } else {
                targetPrice = currentPriceUSD * (1 - percentage / 100);
                condition = 'below';
            }

            // Create alert in database
            await this.createAlert(chatId, tokenAddress, tokenMetadata?.name || 'Unknown Token', tokenMetadata?.symbol || 'UNKNOWN', 'price', targetPrice, condition);

            // Start monitoring if not already active
            await this.startMonitoringIfNeeded(tokenAddress);

            const directionText = direction === 'increase' ? 'Increase' : 'Decrease';
            const directionEmoji = direction === 'increase' ? '📈' : '📉';

            const message = `✅ *Price ${directionText} Alert Created*

Token: *${tokenMetadata?.name || 'Unknown Token'}* ($${tokenMetadata?.symbol || 'UNKNOWN'})
${directionEmoji} *${percentage}% ${directionText}*

Current Price: *$${this.formatPrice(currentPriceUSD)}*
Target Price: *$${this.formatPrice(targetPrice)}*

You'll be notified when the price goes ${condition} your target!`;

            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('Error handling price percentage input:', error);
            await this.sendMessage(chatId, '❌ Error creating alert. Please try again.');
            this.pendingAlerts.delete(chatId);
        }
    }

    // Handle market cap input from user
    private async handleMarketCapInput(chatId: string, input: string, tokenAddress: string): Promise<void> {
        try {
            const targetMarketCap = this.parseMarketCapInput(input);

            if (!targetMarketCap) {
                await this.sendMessage(chatId, '❌ Invalid market cap format. Please use examples like: 30k, 4.5m, 100m, 2.5b');
                return;
            }

            // Get current token data
            const [marketData, metadata] = await Promise.allSettled([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            let birdeyeData: BirdeyeTokenMarketData | null = null;
            let tokenMetadata: any = null;

            if (marketData.status === 'fulfilled' && marketData.value) {
                birdeyeData = marketData.value;
            }

            if (metadata.status === 'fulfilled' && metadata.value) {
                tokenMetadata = metadata.value;
            }

            if (!birdeyeData) {
                await this.sendMessage(chatId, '❌ Unable to fetch current token data. Please try again.');
                return;
            }

            const circulatingSupply = birdeyeData.circulating_supply || birdeyeData.total_supply;
            const currentMarketCap = await this.calculateMarketCap(birdeyeData.price, circulatingSupply);
            const condition = targetMarketCap > currentMarketCap ? 'above' : 'below';

            // Create alert in database
            await this.createAlert(chatId, tokenAddress, tokenMetadata?.name || 'Unknown Token', tokenMetadata?.symbol || 'UNKNOWN', 'market_cap', targetMarketCap, condition, circulatingSupply, currentMarketCap);

            // Start monitoring if not already active
            await this.startMonitoringIfNeeded(tokenAddress);

            // Clear pending alert
            this.pendingAlerts.delete(chatId);

            const message = `✅ *Market Cap Alert Created*

Token: *${tokenMetadata?.name || 'Unknown Token'}* ($${tokenMetadata?.symbol || 'UNKNOWN'})
Target Market Cap: *${this.formatLargeNumber(targetMarketCap)}*

Current Market Cap: *${this.formatLargeNumber(currentMarketCap)}*
Alert Condition: *${condition.toUpperCase()}*

You'll be notified when the market cap goes ${condition} your target!`;

            await this.sendMessage(chatId, message, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('Error handling market cap input:', error);
            await this.sendMessage(chatId, '❌ Error creating alert. Please try again.');
            this.pendingAlerts.delete(chatId);
        }
    }

    // Check and trigger alerts based on current price/market cap
    private async checkAndTriggerAlerts(tokenAddress: string, currentPrice: number, currentMarketCap: number): Promise<void> {
        try {
            // Get all active alerts for this token
            const alerts = await query(`
                SELECT ta.*, u.telegram_chat_id 
                FROM token_alerts ta 
                JOIN users u ON ta.user_id = u.id 
                WHERE ta.token_address = $1 AND ta.is_active = true AND ta.is_triggered = false
            `, [tokenAddress]);

            for (const alert of alerts.rows) {
                let shouldTrigger = false;
                let currentValue = 0;

                if (alert.threshold_type === 'price') {
                    const solPriceUSD = this.solPriceService.getSolPriceUSD();
                    currentValue = currentPrice * solPriceUSD;
                } else if (alert.threshold_type === 'market_cap') {
                    // Use the stored circulating supply for more accurate calculation
                    if (alert.circulating_supply) {
                        currentValue = this.solPriceService.calculateMarketCap(alert.circulating_supply, currentPrice);
                    } else {
                        // Fallback to passed market cap if no circulating supply stored
                        currentValue = currentMarketCap;
                    }
                }

                // Check if alert should trigger
                if (alert.condition === 'above' && currentValue >= alert.threshold_value) {
                    shouldTrigger = true;
                } else if (alert.condition === 'below' && currentValue <= alert.threshold_value) {
                    shouldTrigger = true;
                }

                if (shouldTrigger) {
                    // Mark alert as triggered
                    await query(`
                        UPDATE token_alerts 
                        SET is_triggered = true, triggered_at = CURRENT_TIMESTAMP 
                        WHERE id = $1
                    `, [alert.id]);

                    // Send notification
                    const message = `🚨 *ALERT TRIGGERED!*

Token: *${alert.token_name}* ($${alert.token_symbol})

Alert Type: *${alert.threshold_type === 'price' ? 'Price' : 'Market Cap'}*
Target: *${this.formatLargeNumber(alert.threshold_value)}*
Current: *${alert.threshold_type === 'price' ? this.formatPrice(currentValue) : this.formatLargeNumber(currentValue)}*

Condition: *${alert.condition.toUpperCase()}*

🎯 Your alert has been triggered and removed!`;

                    await this.sendMessage(alert.telegram_chat_id, message, { parse_mode: 'Markdown' });

                    // Print horizontal rule for visibility
                    console.log('═'.repeat(80));
                    console.log('🚨 ALERT TRIGGERED 🚨');
                    console.log(`Alert triggered for user ${alert.telegram_chat_id}: ${alert.token_symbol} ${alert.threshold_type} ${alert.condition} ${alert.threshold_value} (current: ${currentValue})`);
                    console.log('═'.repeat(80));
                }
            }
        } catch (error) {
            console.error('Error checking and triggering alerts:', error);
        }
    }

    // Alert ID management for callback data
    private alertTokenMap: Map<string, { address: string, name: string, symbol: string }> = new Map();

    private generateAlertId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    private storeTokenForAlert(alertId: string, address: string, name: string, symbol: string): void {
        this.alertTokenMap.set(alertId, { address, name, symbol });
        // Clean up after 10 minutes to prevent memory leaks
        setTimeout(() => {
            this.alertTokenMap.delete(alertId);
        }, 10 * 60 * 1000);
    }

    private getTokenForAlert(alertId: string): { address: string, name: string, symbol: string } | undefined {
        return this.alertTokenMap.get(alertId);
    }

    private clearTokenForAlert(alertId: string): void {
        this.alertTokenMap.delete(alertId);
    }

    // User preset management
    private async getUserPresets(chatId: string, presetType: 'price_increase' | 'price_decrease'): Promise<number[]> {
        try {
            const result = await query(`
                SELECT percentages 
                FROM user_presets up
                JOIN users u ON up.user_id = u.id
                WHERE u.telegram_chat_id = $1 AND up.preset_type = $2
            `, [chatId, presetType]);

            if (result.rows.length > 0) {
                return result.rows[0].percentages;
            }

            // Return default presets if none found
            if (presetType === 'price_increase') {
                return [10, 25, 50, 100, 200, 500, 1000];
            } else {
                return [10, 25, 50, 75, 90];
            }
        } catch (error) {
            console.error('Error getting user presets:', error);
            // Return default presets on error
            if (presetType === 'price_increase') {
                return [10, 25, 50, 100, 200, 500, 1000];
            } else {
                return [10, 25, 50, 75, 90];
            }
        }
    }

    private async saveUserPresets(chatId: string, presetType: 'price_increase' | 'price_decrease', percentages: number[]): Promise<void> {
        try {
            await this.ensureUserExists(chatId);

            await query(`
                INSERT INTO user_presets (user_id, preset_type, percentages)
                SELECT u.id, $2, $3
                FROM users u WHERE u.telegram_chat_id = $1
                ON CONFLICT (user_id, preset_type) 
                DO UPDATE SET percentages = $3, updated_at = CURRENT_TIMESTAMP
            `, [chatId, presetType, percentages]);

            console.log(`User presets saved for ${chatId}: ${presetType} = [${percentages.join(', ')}]`);
        } catch (error) {
            console.error('Error saving user presets:', error);
            throw error;
        }
    }

    private async handlePresetEdit(chatId: string, messageId: number, tokenAddress: string, alertId: string, presetType: 'price_increase' | 'price_decrease'): Promise<void> {
        const currentPresets = await this.getUserPresets(chatId, presetType);
        const typeText = presetType === 'price_increase' ? 'Increase' : 'Decrease';
        const emoji = presetType === 'price_increase' ? '📈' : '📉';
        const example = presetType === 'price_increase' ? '5, 15, 30, 75, 150' : '5, 15, 30, 75, 90';

        const message = `${emoji} *Edit ${typeText} Presets*

Current presets: ${currentPresets.map(p => `${p}%`).join(', ')}

Enter your new preset percentages separated by commas.
Example: ${example}

Valid range: ${presetType === 'price_increase' ? '1-10000%' : '1-99%'}`;

        // Store pending preset edit
        this.storePendingAlert(chatId, {
            type: 'preset_edit',
            step: 'awaiting_percentages',
            presetType,
            tokenAddress,
            alertId,
            messageId
        });

        const keyboard = {
            inline_keyboard: [
                [
                    { text: '↩️ Back', callback_data: presetType === 'price_increase' ? `pinc_${alertId}` : `pdec_${alertId}` },
                    { text: '❌ Cancel', callback_data: `cancel_${alertId}` }
                ]
            ]
        };

        await this.bot?.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    private async handlePresetInput(chatId: string, input: string, pendingAlert: any): Promise<void> {
        try {
            // Parse percentages from input like "5, 15, 30, 75, 150"
            const percentageStrings = input.split(',').map(s => s.trim());
            const percentages: number[] = [];

            for (const str of percentageStrings) {
                const percentage = this.parsePercentageInput(str);
                if (!percentage) {
                    const example = pendingAlert.presetType === 'price_increase' ? '5, 15, 30, 75, 150' : '5, 15, 30, 75, 90';
                    await this.sendMessage(chatId, `❌ Invalid percentage format. Please use numbers like: ${example}`);
                    return;
                }

                // Validate range
                if (pendingAlert.presetType === 'price_increase' && (percentage < 1 || percentage > 10000)) {
                    await this.sendMessage(chatId, '❌ Market cap increase percentages must be between 1% and 10000%');
                    return;
                }

                if (pendingAlert.presetType === 'price_decrease' && (percentage < 1 || percentage >= 100)) {
                    await this.sendMessage(chatId, '❌ Market cap decrease percentages must be between 1% and 99%');
                    return;
                }

                percentages.push(percentage);
            }

            if (percentages.length === 0 || percentages.length > 8) {
                await this.sendMessage(chatId, '❌ Please provide 1-8 percentages separated by commas');
                return;
            }

            // Sort percentages
            percentages.sort((a, b) => a - b);

            // Save presets
            await this.saveUserPresets(chatId, pendingAlert.presetType, percentages);

            // Clear pending alert
            this.pendingAlerts.delete(chatId);

            // Go back to the price alert setup with new presets
            if (pendingAlert.presetType === 'price_increase') {
                await this.handlePriceIncreaseAlertSetup(chatId, pendingAlert.messageId, pendingAlert.tokenAddress, pendingAlert.alertId);
            } else {
                await this.handlePriceDecreaseAlertSetup(chatId, pendingAlert.messageId, pendingAlert.tokenAddress, pendingAlert.alertId);
            }

            await this.sendMessage(chatId, `✅ Presets updated successfully!`);

        } catch (error) {
            console.error('Error handling preset input:', error);
            await this.sendMessage(chatId, '❌ Error updating presets. Please try again.');
            this.pendingAlerts.delete(chatId);
        }
    }
} 