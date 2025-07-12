import { Client, GatewayIntentBits, Events, Message, SlashCommandBuilder, REST, Routes, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { BirdeyeService, BirdeyeTokenMarketData } from './birdeyeService';
import { SolanaStreamingService } from './solanaStreamingService';
import { SolPriceService } from './solPriceService';
import { query } from '../config/database';
import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
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

// Interface for tracking user alert setup state
interface UserAlertState {
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    currentMarketCap: number;
    circulatingSupply: number;
    step: 'awaiting_type' | 'awaiting_market_cap' | 'awaiting_percentage';
    direction?: 'increase' | 'decrease';
    messageId: string; // Track the original message to edit
    channelId: string;
}

export class DiscordBotService {
    private static instance: DiscordBotService | null = null;
    private client: Client | null = null;
    private isRunning: boolean = false;
    private birdeyeService: BirdeyeService;
    private streamingService: SolanaStreamingService;
    private solPriceService: SolPriceService;
    private tokenAlerts: Map<string, TokenAlertData> = new Map();
    private solPriceCache: { price: number; lastUpdated: number } | null = null;
    private pendingAlerts: Map<string, UserAlertState> = new Map();
    private skipCommandRegistration: boolean = false;

    private constructor() {
        if (!DISCORD_TOKEN) {
            throw new Error('DISCORD_BOT_TOKEN environment variable is required');
        }
        if (!DISCORD_CLIENT_ID) {
            throw new Error('DISCORD_CLIENT_ID environment variable is required');
        }

        // Check if command registration should be skipped
        this.skipCommandRegistration = process.env.DISCORD_SKIP_COMMAND_REGISTRATION === 'true';
        if (this.skipCommandRegistration) {
            console.log('🚫 Discord command registration is disabled via environment variable');
        }

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.birdeyeService = BirdeyeService.getInstance();
        this.streamingService = SolanaStreamingService.getInstance();
        this.solPriceService = SolPriceService.getInstance();

        this.setupStreamingCallbacks();
    }

    public static getInstance(): DiscordBotService {
        if (!DiscordBotService.instance) {
            DiscordBotService.instance = new DiscordBotService();
        }
        return DiscordBotService.instance;
    }

    async start(): Promise<void> {
        if (!this.client || this.isRunning) {
            console.log('Discord bot already running or client not initialized');
            return;
        }

        try {
            console.log('🤖 Starting Discord bot...');
            this.isRunning = true;

            console.log('📋 Setting up event handlers...');
            this.setupEventHandlers();

            if (!this.skipCommandRegistration) {
                console.log('📝 Registering slash commands...');
                // Make command registration non-blocking
                this.registerSlashCommands().catch(error => {
                    console.error('⚠️ Command registration failed, but continuing bot startup:', error);
                });
            } else {
                console.log('⏭️ Skipping slash command registration (disabled)');
            }

            // Add more specific logging for the login process
            console.log('🔐 Attempting to login to Discord...');
            console.log('Token present:', !!DISCORD_TOKEN);
            console.log('Token length:', DISCORD_TOKEN ? DISCORD_TOKEN.length : 0);
            console.log('Client ID present:', !!DISCORD_CLIENT_ID);

            if (!DISCORD_TOKEN || DISCORD_TOKEN === 'your_discord_bot_token_here') {
                throw new Error('DISCORD_BOT_TOKEN is not properly configured');
            }

            if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID === 'your_discord_client_id_here') {
                throw new Error('DISCORD_CLIENT_ID is not properly configured');
            }

            await this.client.login(DISCORD_TOKEN);

            console.log('✅ Discord login completed');
            await this.resumeMonitoringForExistingAlerts();
            console.log('Discord bot started successfully');
        } catch (error) {
            console.error('💥 Error starting Discord bot:', error);
            if (error instanceof Error) {
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    code: (error as any).code,
                    stack: error.stack
                });
            }
            this.isRunning = false;
            throw error; // Re-throw to see the error in the main logs
        }
    }

    async stop(): Promise<void> {
        if (!this.client || !this.isRunning) {
            return;
        }

        try {
            await this.client.destroy();
            this.isRunning = false;
            console.log('Discord bot stopped');
        } catch (error) {
            console.error('Error stopping Discord bot:', error);
        }
    }

    private async registerSlashCommands(): Promise<void> {
        if (!DISCORD_CLIENT_ID) {
            console.log('❌ No DISCORD_CLIENT_ID provided, skipping command registration');
            return;
        }

        console.log('🔧 Building slash commands...');
        const commands = [
            new SlashCommandBuilder()
                .setName('start')
                .setDescription('Get started with the Solana Token Alerts bot'),

            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Show help and available commands'),

            new SlashCommandBuilder()
                .setName('alerts')
                .setDescription('View your active token alerts'),

            new SlashCommandBuilder()
                .setName('prices')
                .setDescription('Show current SOL price and tracked token prices'),

            new SlashCommandBuilder()
                .setName('price')
                .setDescription('Show current SOL price and tracked token prices'),

            new SlashCommandBuilder()
                .setName('clear')
                .setDescription('Clear all your active alerts'),

            new SlashCommandBuilder()
                .setName('hi')
                .setDescription('Get a professional welcome message from the Solana Token Alerts bot'),

            new SlashCommandBuilder()
                .setName('setalert')
                .setDescription('Set an alert for a Solana token')
                .addStringOption(option =>
                    option.setName('address')
                        .setDescription('The Solana token address')
                        .setRequired(true)
                ),

            new SlashCommandBuilder()
                .setName('link')
                .setDescription('Link your Discord account to the web app for synced alerts'),

            new SlashCommandBuilder()
                .setName('stopalert')
                .setDescription('Stop all market cap monitoring'),

            new SlashCommandBuilder()
                .setName('alertstatus')
                .setDescription('Check detailed alert status and system monitoring info'),
        ];

        try {
            console.log('🏗️ Creating REST client...');
            const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

            console.log('🧹 Started refreshing Discord application (/) commands.');

            // First, clear all existing commands to ensure clean registration
            console.log('🗑️ Clearing existing commands...');

            const clearWithTimeout = new Promise(async (resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Clear commands timed out after 15 seconds'));
                }, 15000);

                try {
                    const result = await rest.put(
                        Routes.applicationCommands(DISCORD_CLIENT_ID),
                        { body: [] }
                    );
                    clearTimeout(timeout);
                    resolve(result);
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            await clearWithTimeout;
            console.log('✅ Cleared existing Discord commands.');

            // Wait a moment between clear and register
            console.log('⏱️ Waiting 2 seconds before registering new commands...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Now register the new commands with longer timeout
            console.log('📝 Registering new commands...');

            const registerWithTimeout = new Promise(async (resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Command registration timed out after 45 seconds'));
                }, 45000);

                try {
                    const result = await rest.put(
                        Routes.applicationCommands(DISCORD_CLIENT_ID),
                        { body: commands.map(command => command.toJSON()) }
                    );
                    clearTimeout(timeout);
                    resolve(result);
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            const result = await registerWithTimeout;

            console.log('✅ Successfully reloaded Discord application (/) commands.');
            console.log('📋 Registered commands:', commands.map(cmd => cmd.name).join(', '));
            console.log('🔢 Total commands registered:', Array.isArray(result) ? result.length : 'unknown');

            console.log('🎯 Command registration completed successfully');

        } catch (error) {
            console.error('💥 Error registering Discord commands:', error);

            if (error instanceof Error) {
                console.error('Error details:', {
                    name: error.name,
                    message: error.message,
                    code: (error as any).code,
                    status: (error as any).status
                });
            }

            console.error('💥 Command registration failed. Bot will continue without slash commands.');
            // Don't throw - let the bot continue to start
        }
    }

    private setupEventHandlers(): void {
        if (!this.client) return;

        this.client.once(Events.ClientReady, (client) => {
            console.log(`Discord bot ready! Logged in as ${client.user.tag}`);
        });

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isChatInputCommand()) {
                await this.handleSlashCommand(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            }
        });

        this.client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot) return;
            await this.handleMessage(message);
        });
    }

    private async handleSlashCommand(interaction: any): Promise<void> {
        const { commandName } = interaction;

        try {
            switch (commandName) {
                case 'start':
                    await this.handleStartCommand(interaction);
                    break;
                case 'help':
                    await this.handleHelpCommand(interaction);
                    break;
                case 'alerts':
                    await this.handleAlertsCommand(interaction);
                    break;
                case 'prices':
                case 'price':
                    await this.handlePricesCommand(interaction);
                    break;
                case 'clear':
                    await this.handleClearCommand(interaction);
                    break;
                case 'hi':
                    await this.handleHiCommand(interaction);
                    break;
                case 'setalert':
                    await this.handleSetAlertCommand(interaction);
                    break;
                case 'link':
                    await this.handleLinkCommand(interaction);
                    break;
                case 'stopalert':
                    await this.handleStopAlertCommand(interaction);
                    break;
                case 'alertstatus':
                    await this.handleAlertStatusCommand(interaction);
                    break;
                default:
                    await interaction.reply('Unknown command!');
            }
        } catch (error) {
            console.error(`Error handling command ${commandName}:`, error);
            const errorMessage = 'An error occurred while processing your command.';

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }

    private async handleStartCommand(interaction: any): Promise<void> {
        const username = interaction.user.displayName || interaction.user.username;

        const embed = new EmbedBuilder()
            .setColor(0x9945FF)
            .setTitle('Welcome to Solana Token Alerts Bot')
            .setDescription(`Hello ${username}!\n\nI'm here to help you track Solana tokens, set price alerts, and manage your watchlist.`)
            .addFields(
                { name: '🚀 Get Started', value: '• Use `/help` to see all commands\n• Send any Solana token address for info\n• Use `/setalert <address>` for setting alerts' },
                { name: '📊 Features', value: '• Real-time price monitoring\n• Market cap alerts\n• Price percentage alerts\n• Multi-platform sync' }
            )
            .setFooter({ text: 'Start by using /help to see all available commands!' });

        await interaction.reply({ embeds: [embed] });
    }

    private async handleHelpCommand(interaction: any): Promise<void> {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🤖 Solana Token Alerts Bot - Commands')
            .setDescription('Here are all the available commands:')
            .addFields(
                {
                    name: '🔰 Basic Commands',
                    value: '`/start` - Get started with the bot\n`/help` - Show this help message\n`/link` - Link your Discord account\n`/setalert <address>` - Set alert for a token'
                },
                {
                    name: '📊 Alert Management',
                    value: '`/alerts` - View your active alerts\n`/alertstatus` - Detailed alert status\n`/prices` - Show current prices\n`/clear` - Clear all alerts\n`/stopalert` - Stop monitoring system'
                },
                {
                    name: '💡 How to Use',
                    value: 'Send any Solana token address in chat to get detailed info and set up alerts!\n\nExample: `So11111111111111111111111111111111111111112`'
                }
            )
            .setFooter({ text: 'Need more help? Just send a token address to get started!' });

        await interaction.reply({ embeds: [embed] });
    }

    private async handleAlertsCommand(interaction: any): Promise<void> {
        try {
            await interaction.deferReply();

            // Check if user is linked before showing alerts
            if (!(await this.requireLinkedAccount(interaction))) return;

            const userId = interaction.user.id;

            // Get user's active alerts
            const alertsResult = await query(`
                SELECT ta.*, u.discord_user_id
                FROM token_alerts ta
                JOIN users u ON ta.user_id = u.id 
                WHERE u.discord_user_id = $1 AND ta.is_active = true
                ORDER BY ta.created_at DESC
            `, [userId]);

            const alerts = alertsResult.rows;

            if (alerts.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📊 Your Token Alerts')
                    .setDescription('You have no active alerts set up.')
                    .addFields({
                        name: '🚀 Get Started',
                        value: 'Use `/setalert <token_address>` to create your first alert!'
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`📊 Your Active Alerts (${alerts.length})`)
                .setTimestamp();

            let description = '';
            let alertCount = 0;

            for (const alert of alerts) {
                alertCount++;
                const conditionEmoji = alert.condition === 'above' ? '📈' : '📉';
                const typeText = alert.threshold_type === 'price' ? 'Price' : 'Market Cap';
                const value = alert.threshold_type === 'price'
                    ? `$${this.formatPrice(alert.threshold_value)}`
                    : this.formatLargeNumber(alert.threshold_value);

                // Handle different status types
                let status = '🟢 Active';
                if (alert.is_triggered) {
                    status = alert.cleared_at ? '🗑️ Cleared' : '✅ Triggered';
                }

                const shortAddress = `${alert.token_address.slice(0, 6)}...${alert.token_address.slice(-6)}`;

                description += `**${alertCount}. ${alert.token_name || 'Unknown'} (${alert.token_symbol || 'N/A'})**\n`;
                description += `${conditionEmoji} ${typeText} ${alert.condition} ${value}\n`;
                description += `📍 \`${shortAddress}\` • ${status}\n`;
                description += `📅 Created: ${new Date(alert.created_at).toLocaleDateString()}\n\n`;

                // Discord embed description has a 4096 character limit
                if (description.length > 3500) {
                    description += `... and ${alerts.length - alertCount} more alerts\n`;
                    break;
                }
            }

            embed.setDescription(description);

            // Add summary field
            const activeCount = alerts.filter(a => !a.is_triggered).length;
            const triggeredCount = alerts.filter(a => a.is_triggered && !a.cleared_at).length;
            const clearedCount = alerts.filter(a => a.cleared_at).length;

            let summaryValue = `🟢 Active: ${activeCount}\n✅ Triggered: ${triggeredCount}`;
            if (clearedCount > 0) {
                summaryValue += `\n🗑️ Cleared: ${clearedCount}`;
            }
            summaryValue += `\n📊 Total: ${alerts.length}`;

            embed.addFields({
                name: '📈 Summary',
                value: summaryValue,
                inline: true
            });

            // Add clear button if there are active alerts
            if (activeCount > 0) {
                const clearButton = new ButtonBuilder()
                    .setCustomId('clear_all_alerts')
                    .setLabel('🗑️ Clear All Alerts')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(clearButton);

                await interaction.editReply({ embeds: [embed], components: [row] });
            } else {
                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in /alerts command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Error fetching your alerts. Please try again later.');
            } else {
                await interaction.reply('❌ Error fetching your alerts. Please try again later.');
            }
        }
    }

    private async handlePricesCommand(interaction: any): Promise<void> {
        try {
            const userId = interaction.user.id;

            // Get SOL price
            const solPrice = await this.getSolPrice();

            // Get all unique token addresses with active alerts for this user
            // Since discord_user_id column doesn't exist yet, we'll return empty for now
            // TODO: Add discord_user_id column to users table
            let alertsResult: { rows: any[] } = { rows: [] };

            try {
                alertsResult = await query(`
                    SELECT DISTINCT ta.token_address, ta.token_name, ta.token_symbol
                    FROM token_alerts ta
                    JOIN users u ON ta.user_id = u.id 
                    WHERE ta.is_active = true AND ta.is_triggered = false 
                    AND u.discord_user_id = $1
                    ORDER BY ta.token_name
                `, [userId]);
            } catch (error: any) {
                if (error.code === '42703') { // Column does not exist
                    console.log(`[DISCORD PRICES] discord_user_id column does not exist yet - returning empty results`);
                    alertsResult = { rows: [] };
                } else {
                    throw error; // Re-throw if it's a different error
                }
            }

            // Filter to only show tokens that are actively being tracked
            const activelyTrackedTokens = alertsResult.rows.filter(token =>
                this.tokenAlerts.has(token.token_address) ||
                this.streamingService.getCurrentToken() === token.token_address
            );

            // Debug logging
            console.log(`[DISCORD PRICES] User ${userId} requested prices:`);
            console.log(`[DISCORD PRICES] - Found ${alertsResult.rows.length} tokens with active alerts`);
            console.log(`[DISCORD PRICES] - ${activelyTrackedTokens.length} tokens are actively tracked`);
            activelyTrackedTokens.forEach((row, index) => {
                console.log(`[DISCORD PRICES] ${index + 1}. ${row.token_name} (${row.token_symbol}) - ${row.token_address}`);
            });

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle('💰 Current Prices')
                .addFields({
                    name: '🟣 Solana (SOL)',
                    value: `**$${this.formatPrice(solPrice)}**`,
                    inline: true
                });

            if (activelyTrackedTokens.length === 0) {
                if (alertsResult.rows.length > 0) {
                    embed.addFields({
                        name: '📊 Tracked Tokens',
                        value: '⚠️ You have active alerts, but no tokens are currently being monitored.\nThis may happen after a server restart. Your alerts will activate when monitoring resumes.',
                        inline: false
                    });
                } else {
                    embed.addFields({
                        name: '📊 Tracked Tokens',
                        value: 'No tokens with active alerts.',
                        inline: false
                    });
                }
            } else {
                // Add tracked tokens info
                let trackedTokensText = '';

                // Fetch current market data for each actively tracked token
                for (const alert of activelyTrackedTokens) {
                    try {
                        const marketData = await this.birdeyeService.getTokenMarketData(alert.token_address);

                        const isCurrentlyMonitored = this.streamingService.getCurrentToken() === alert.token_address;
                        const monitoringStatus = isCurrentlyMonitored ? '🟢' : '🟡';

                        if (marketData) {
                            const tokenPriceUSD = marketData.price * solPrice;
                            const marketCap = marketData.market_cap;
                            const shortAddress = `${alert.token_address.slice(0, 6)}...${alert.token_address.slice(-6)}`;

                            trackedTokensText += `${monitoringStatus} **${alert.token_name}** ($${alert.token_symbol})\n`;
                            trackedTokensText += `Address: \`${alert.token_address}\`\n`;
                            trackedTokensText += `Price: **$${this.formatPrice(tokenPriceUSD)}**\n`;
                            trackedTokensText += `Market Cap: **${this.formatLargeNumber(marketCap)}**\n\n`;
                        } else {
                            trackedTokensText += `${monitoringStatus} **${alert.token_name}** ($${alert.token_symbol})\n`;
                            trackedTokensText += `Address: \`${alert.token_address}\`\n`;
                            trackedTokensText += `Price: **Data unavailable**\n\n`;
                        }
                    } catch (error) {
                        console.error(`Error fetching data for token ${alert.token_address}:`, error);
                        const isCurrentlyMonitored = this.streamingService.getCurrentToken() === alert.token_address;
                        const monitoringStatus = isCurrentlyMonitored ? '🟢' : '🟡';
                        trackedTokensText += `${monitoringStatus} **${alert.token_name}** ($${alert.token_symbol})\n`;
                        trackedTokensText += `Address: \`${alert.token_address}\`\n`;
                        trackedTokensText += `Price: **Error fetching data**\n\n`;
                    }
                }

                trackedTokensText += '🟢 = Currently monitored | 🟡 = Tracked';

                // Split long content if needed (Discord embeds have field value limits)
                if (trackedTokensText.length > 1024) {
                    // Split into multiple fields if content is too long
                    const chunks = [];
                    let currentChunk = '';
                    const lines = trackedTokensText.split('\n');

                    for (const line of lines) {
                        if (currentChunk.length + line.length + 1 <= 1024) {
                            currentChunk += (currentChunk ? '\n' : '') + line;
                        } else {
                            if (currentChunk) chunks.push(currentChunk);
                            currentChunk = line;
                        }
                    }
                    if (currentChunk) chunks.push(currentChunk);

                    chunks.forEach((chunk, index) => {
                        embed.addFields({
                            name: index === 0 ? '📊 Actively Tracked Tokens' : '\u200B', // invisible character for continuation
                            value: chunk,
                            inline: false
                        });
                    });
                } else {
                    embed.addFields({
                        name: '📊 Actively Tracked Tokens',
                        value: trackedTokensText,
                        inline: false
                    });
                }
            }

            embed.setFooter({ text: `🕐 Updated: ${new Date().toLocaleString()}` });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /prices command:', error);
            await interaction.reply('❌ Error fetching prices. Please try again later.');
        }
    }

    private async handleClearCommand(interaction: any): Promise<void> {
        try {
            const userId = interaction.user.id;

            // Get user's active alerts count
            const alertsCountResult = await query(`
                SELECT COUNT(*) as count
                FROM token_alerts ta
                JOIN users u ON ta.user_id = u.id 
                WHERE u.discord_user_id = $1 AND ta.is_active = true AND ta.is_triggered = false
            `, [userId]);

            const activeCount = parseInt(alertsCountResult.rows[0].count);

            if (activeCount === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('🔍 No Active Alerts')
                    .setDescription('You have no active alerts to clear.')
                    .addFields({
                        name: '🚀 Create New Alerts',
                        value: 'Use `/setalert <token_address>` to set up alerts!'
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                return;
            }

            // Create confirmation buttons
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_clear_all')
                .setLabel('✅ Yes, Clear All')
                .setStyle(ButtonStyle.Danger);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_clear_all')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(confirmButton, cancelButton);

            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('⚠️ Confirm Clear All Alerts')
                .setDescription(`Are you sure you want to clear **${activeCount}** active alert${activeCount === 1 ? '' : 's'}?`)
                .addFields({
                    name: '📋 What will happen:',
                    value: '• All your active alerts will be deactivated\n• You will stop receiving notifications\n• Token monitoring may be updated\n• This action cannot be undone'
                })
                .setFooter({ text: 'Click "Yes, Clear All" to confirm or "Cancel" to abort' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Error in /clear command:', error);
            await interaction.reply('❌ Error accessing your alerts. Please try again later.');
        }
    }

    private async handleHiCommand(interaction: any): Promise<void> {
        const username = interaction.user.displayName || interaction.user.username;
        const serverName = interaction.guild?.name || 'Direct Message';

        const embed = new EmbedBuilder()
            .setColor(0x9945FF)
            .setTitle('👋 Professional Greetings!')
            .setDescription(`Hello **${username}**! Welcome to the **Solana Token Alerts Bot**.`)
            .addFields(
                {
                    name: '🚀 About This Bot',
                    value: 'I am a professional-grade Discord bot designed to provide real-time Solana token monitoring and price alerts. Built with enterprise-level reliability and user experience in mind.'
                },
                {
                    name: '💼 Core Capabilities',
                    value: '• **Real-time token analysis** with market data\n• **Intelligent price alerts** for market movements\n• **Multi-platform integration** (Discord, Telegram, Web)\n• **Professional-grade monitoring** with 99.9% uptime\n• **Secure data handling** with enterprise security'
                },
                {
                    name: '🔧 Quick Start Guide',
                    value: '1. Use `/help` to explore all available commands\n2. Try `/token <address>` for detailed token analysis\n3. Send any Solana token address for instant information\n4. Use `/prices` to monitor current market conditions'
                },
                {
                    name: '📊 Sample Commands',
                    value: '`/setalert So11111111111111111111111111111111111111112`\n`/prices` - Current market overview\n`/alerts` - Manage your alert portfolio'
                },
                {
                    name: '🌐 Integration',
                    value: `Currently serving in: **${serverName}**\nMulti-platform sync available with our web dashboard`
                }
            )
            .addFields(
                {
                    name: '💡 Pro Tips',
                    value: '• Token addresses can be sent directly in chat\n• Use interactive buttons for enhanced experience\n• Set up alerts for automated market monitoring\n• Access detailed analytics for informed decisions'
                }
            )
            .setFooter({
                text: '🔒 Enterprise-grade security • 24/7 uptime • Professional support',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    private async handleSetAlertCommand(interaction: any): Promise<void> {
        const tokenAddress = interaction.options.getString('address');

        if (!SOLANA_ADDRESS_REGEX.test(tokenAddress)) {
            await interaction.reply('❌ Invalid Solana token address. Please provide a valid 32-44 character address.');
            return;
        }

        await interaction.deferReply();

        // Check if user is linked before allowing alert creation
        if (!(await this.requireLinkedAccount(interaction))) return;

        await this.handleTokenAddressMessage(interaction, tokenAddress, true);
    }

    // Function to check if user has linked account
    private async requireLinkedAccount(interaction: any): Promise<boolean> {
        const userId = interaction.user.id;

        const user = await query(`
            SELECT u.wallet_address 
            FROM users u 
            WHERE u.discord_user_id = $1 AND u.wallet_address IS NOT NULL
            AND u.wallet_address != '' 
            AND NOT u.wallet_address LIKE 'discord_%_placeholder'
        `, [userId]);

        if (user.rows.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('🔗 Account Not Linked')
                .setDescription('You need to link your Discord account first!')
                .addFields({
                    name: '👇 How to link:',
                    value: 'Use the `/link` command to connect your Discord to your wallet.'
                });

            await interaction.editReply({ embeds: [embed] });
            return false;
        }

        return true;
    }

    private async handleLinkCommand(interaction: any): Promise<void> {
        try {
            await interaction.deferReply({ ephemeral: true });
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Check if user already has a linked account
            const userResult = await query(`
                SELECT id, wallet_address FROM users WHERE discord_user_id = $1
            `, [userId]);

            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];

                // Check if they have a real wallet (not a placeholder)
                if (user.wallet_address &&
                    user.wallet_address !== null &&
                    user.wallet_address !== '' &&
                    !user.wallet_address.startsWith('discord_')) {

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('✅ Account Already Linked')
                        .setDescription(`Your Discord account is already linked to wallet: \`${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-6)}\``)
                        .addFields({
                            name: '🎯 What you can do now:',
                            value: '• Use `/setalert` to create alerts\n• Use `/alerts` to view your alerts\n• Send token addresses for analysis'
                        })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
            }

            // Generate linking token
            try {
                const response = await axios.post(`${API_BASE_URL}/api/auth/discord/generate-link-token`, {
                    discordUserId: userId,
                    discordUsername: username
                });

                if (!response.data.success) {
                    if (response.data.data?.isAlreadyLinked) {
                        await interaction.editReply({
                            content: '✅ Your Discord account is already linked to a wallet!'
                        });
                        return;
                    }
                    throw new Error(response.data.error || 'Failed to generate linking token');
                }

                const token = response.data.data.token;
                const linkingUrl = `${FRONTEND_URL}/link-discord?token=${token}`;

                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🔗 Link Your Discord Account')
                    .setDescription('Click the button below to securely link your Discord account to your wallet!')
                    .addFields(
                        {
                            name: '🛡️ Secure Process',
                            value: 'This creates a secure, time-limited link between your Discord and wallet accounts.'
                        },
                        {
                            name: '⏰ Important',
                            value: 'This link expires in **15 minutes** for security.'
                        },
                        {
                            name: '🚀 After linking:',
                            value: '• Alerts sync across Discord, Telegram, and web\n• Create alerts from any platform\n• Real-time Discord notifications'
                        }
                    )
                    .setFooter({ text: 'Secure linking via stride.so' })
                    .setTimestamp();

                const linkButton = new ButtonBuilder()
                    .setLabel('Link Account')
                    .setStyle(ButtonStyle.Link)
                    .setURL(linkingUrl)
                    .setEmoji('🔗');

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(linkButton);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row]
                });

                console.log(`[DISCORD LINK] Generated linking URL for user ${userId} (${username})`);

            } catch (apiError) {
                console.error('Error generating linking token:', apiError);

                // Fallback to manual linking instructions
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setTitle('🔗 Manual Linking Required')
                    .setDescription('Automatic linking is temporarily unavailable. Please link manually:')
                    .addFields(
                        {
                            name: '🌐 Manual Steps:',
                            value: '1. Visit our web app\n2. Connect your wallet\n3. Go to Integrations page\n4. Enter your Discord User ID'
                        },
                        {
                            name: '🆔 Your Discord User ID:',
                            value: `\`${userId}\``
                        },
                        {
                            name: '🔗 Web App:',
                            value: `${FRONTEND_URL}/integrations`
                        }
                    )
                    .setFooter({ text: 'Copy your User ID from above' })
                    .setTimestamp();

                const webButton = new ButtonBuilder()
                    .setLabel('Open Web App')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${FRONTEND_URL}/integrations`)
                    .setEmoji('🌐');

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(webButton);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row]
                });
            }

        } catch (error) {
            console.error('Error in link command:', error);
            await interaction.editReply({
                content: '❌ Error processing link command. Please try again later.'
            });
        }
    }

    private async handleStopAlertCommand(interaction: any): Promise<void> {
        try {
            await interaction.deferReply();

            // Check if user is linked before allowing stop alert
            if (!(await this.requireLinkedAccount(interaction))) return;

            await this.streamingService.stopMonitoring();
            this.tokenAlerts.clear();

            const embed = new EmbedBuilder()
                .setColor(0xFF6B6B)
                .setTitle('🛑 Monitoring Stopped')
                .setDescription('Market cap monitoring has been stopped.')
                .addFields({
                    name: '📊 Status',
                    value: '• All monitoring halted\n• Token tracking cleared\n• Alerts remain in database'
                })
                .setFooter({ text: 'Monitoring will resume when new alerts are created.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /stopalert command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Error stopping monitoring. Please try again later.');
            } else {
                await interaction.reply('❌ Error stopping monitoring. Please try again later.');
            }
        }
    }

    private async handleAlertStatusCommand(interaction: any): Promise<void> {
        try {
            await interaction.deferReply();

            // Check if user is linked before showing status
            if (!(await this.requireLinkedAccount(interaction))) return;

            const userId = interaction.user.id;

            // Query database for user's active alerts
            const alertsResult = await query(`
                SELECT ta.*, ta.token_address, ta.token_name, ta.token_symbol, ta.threshold_value, ta.threshold_type, ta.condition
                FROM token_alerts ta
                JOIN users u ON ta.user_id = u.id 
                WHERE ta.is_active = true AND ta.is_triggered = false 
                AND u.discord_user_id = $1
                ORDER BY ta.created_at DESC
            `, [userId]);

            if (alertsResult.rows.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📊 Alert Status')
                    .setDescription('No active alerts.')
                    .addFields({
                        name: '🚀 Get Started',
                        value: 'Use `/setalert <token_address>` to create your first alert!'
                    })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('📊 Alert Status')
                .setTimestamp();

            // Group alerts by token
            const alertsByToken = new Map();
            for (const alert of alertsResult.rows) {
                const key = alert.token_address;
                if (!alertsByToken.has(key)) {
                    alertsByToken.set(key, {
                        name: alert.token_name,
                        symbol: alert.token_symbol,
                        address: alert.token_address,
                        alerts: []
                    });
                }
                alertsByToken.get(key).alerts.push(alert);
            }

            let description = '';
            for (const [tokenAddress, tokenData] of alertsByToken) {
                const shortAddress = `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-6)}`;
                description += `🪙 **${tokenData.name}** ($${tokenData.symbol})\n`;
                description += `Address: \`${shortAddress}\`\n`;
                description += `Active Alerts: ${tokenData.alerts.length}\n\n`;

                for (const alert of tokenData.alerts) {
                    // Debug logging for threshold value
                    console.log(`[DISCORD ALERT STATUS] Alert threshold debug:`, {
                        threshold_type: alert.threshold_type,
                        threshold_value: alert.threshold_value,
                        threshold_value_type: typeof alert.threshold_value,
                        condition: alert.condition,
                        token_symbol: alert.token_symbol
                    });

                    if (alert.threshold_type === 'market_cap') {
                        description += `• Market Cap ${alert.condition} ${this.formatLargeNumber(alert.threshold_value)}\n`;
                    } else if (alert.threshold_type === 'price_percentage') {
                        description += `• Price ${alert.condition} ${this.formatLargeNumber(alert.threshold_value)}\n`;
                    } else if (alert.threshold_type === 'price') {
                        description += `• Price ${alert.condition} $${this.formatPrice(alert.threshold_value)}\n`;
                    }
                }
                description += '\n';
            }

            embed.setDescription(description);

            const isMonitoring = this.streamingService.isMonitoring();
            const currentToken = this.streamingService.getCurrentToken();

            // Add system status field
            let systemStatus = `Monitoring: ${isMonitoring ? '🟢 Active' : '🔴 Inactive'}\n`;
            if (currentToken) {
                const shortCurrentToken = `${currentToken.slice(0, 6)}...${currentToken.slice(-6)}`;
                systemStatus += `Current Token: \`${shortCurrentToken}\`\n`;
            }

            embed.addFields({
                name: '📡 System Status',
                value: systemStatus,
                inline: true
            });

            // Add tracking status
            const trackedTokens = Array.from(this.tokenAlerts.keys());
            let trackingStatus = '';
            if (trackedTokens.length > 0) {
                trackingStatus = `Actively tracking ${trackedTokens.length} token(s)`;
            } else {
                trackingStatus = `No tokens actively tracked`;
            }

            embed.addFields({
                name: '🔍 Tracking Status',
                value: trackingStatus,
                inline: true
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /alertstatus command:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Error fetching alert status. Please try again later.');
            } else {
                await interaction.reply('❌ Error fetching alert status. Please try again later.');
            }
        }
    }

    private async handleMessage(message: Message): Promise<void> {
        const content = message.content.trim();
        const userId = message.author.id;

        // Check if user has a pending alert setup
        if (this.pendingAlerts.has(userId)) {
            await this.handleAlertTextInput(message, content);
            return;
        }

        // Check if the message contains a Solana address
        if (SOLANA_ADDRESS_REGEX.test(content)) {
            console.log(`Detected Solana address: ${content}`);
            await this.handleTokenAddressMessage(message, content, false);
            return;
        }

        // If it's a DM and not a command or token address, provide help
        if (message.channel.type === 1 && !content.startsWith('/')) {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('👋 Hi there!')
                .setDescription('Try using `/help` to see what I can do, or send a Solana token address to get started!')
                .addFields({
                    name: '💡 Example',
                    value: 'Send: `So11111111111111111111111111111111111111112` to get SOL token info'
                });

            await message.reply({ embeds: [embed] });
        }
    }

    private async handleTokenAddressMessage(interaction: any, tokenAddress: string, isSlashCommand: boolean): Promise<void> {
        try {
            let loadingMessage;
            if (!isSlashCommand) {
                const loadingEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🔍 Analyzing Token...')
                    .setDescription(`Loading data for token: \`${tokenAddress}\`\n\nPlease wait...`);

                loadingMessage = await interaction.reply({ embeds: [loadingEmbed] });
            }

            const [marketData, metadata] = await Promise.all([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            if (!marketData && !metadata) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Token Not Found')
                    .setDescription(`Could not find data for token: \`${tokenAddress}\`\n\nPlease verify the address is correct.`);

                if (isSlashCommand) {
                    await interaction.editReply({ embeds: [errorEmbed] });
                } else {
                    await loadingMessage.edit({ embeds: [errorEmbed] });
                }
                return;
            }

            const tokenEmbed = this.createTokenInfoEmbed(tokenAddress, marketData, metadata);

            const actionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`alert_${tokenAddress}`)
                        .setLabel('Set Alert')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔔'),
                    new ButtonBuilder()
                        .setCustomId(`refresh_${tokenAddress}`)
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setURL(`https://solscan.io/token/${tokenAddress}`)
                        .setLabel('View on Solscan')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🔗')
                );

            if (isSlashCommand) {
                await interaction.editReply({ embeds: [tokenEmbed], components: [actionRow] });
            } else {
                await loadingMessage.edit({ embeds: [tokenEmbed], components: [actionRow] });
            }

        } catch (error) {
            console.error('Error handling token address:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching token data. Please try again later.');

            if (isSlashCommand) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed] });
            }
        }
    }

    private createTokenInfoEmbed(address: string, marketData: BirdeyeTokenMarketData | null, metadata: any): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setColor(0x9945FF)
            .setTimestamp();

        const name = metadata?.name || 'Unknown Token';
        const symbol = metadata?.symbol || 'Unknown';

        embed.setTitle(`🪙 ${name} ($${symbol})`);
        embed.setDescription(`\`${address}\``);

        if (marketData) {
            // Calculate USD price by multiplying SOL price with token price
            const solPrice = this.solPriceService.getSolPriceUSD();
            const tokenPriceUSD = marketData.price * solPrice;

            embed.addFields(
                {
                    name: '💰 Price (USD)',
                    value: `$${this.formatPrice(tokenPriceUSD)}`,
                    inline: true
                },
                {
                    name: '🟣 Price (SOL)',
                    value: `${this.formatPrice(marketData.price)} SOL`,
                    inline: true
                },
                {
                    name: '📊 Market Cap',
                    value: `${this.formatLargeNumber(marketData.market_cap)}`,
                    inline: true
                }
            );

            // Add FDV if available
            if (marketData.fdv) {
                embed.addFields({
                    name: '💎 Fully Diluted Value',
                    value: `${this.formatLargeNumber(marketData.fdv)}`,
                    inline: true
                });
            }

            // Add liquidity if available
            if (marketData.liquidity) {
                embed.addFields({
                    name: '💧 Liquidity',
                    value: `${this.formatLargeNumber(marketData.liquidity)}`,
                    inline: true
                });
            }
        }

        if (metadata && metadata.description) {
            embed.addFields({
                name: '📝 Description',
                value: metadata.description.length > 200
                    ? metadata.description.substring(0, 200) + '...'
                    : metadata.description,
                inline: false
            });
        }

        embed.setFooter({
            text: 'Click "Set Alert" to create price or market cap alerts for this token'
        });

        return embed;
    }

    private async handleButtonInteraction(interaction: any): Promise<void> {
        const customIdParts = interaction.customId.split('_');
        const action = customIdParts[0];
        const tokenAddress = customIdParts[1];

        try {
            switch (action) {
                case 'alert':
                    await this.showAlertTypeSelection(interaction, tokenAddress);
                    break;
                case 'refresh':
                    await this.refreshTokenMessage(interaction, tokenAddress);
                    break;
                case 'mcap':
                    // Clear text input state since user chose button
                    this.pendingAlerts.delete(interaction.user.id);
                    await this.showMarketCapModal(interaction, tokenAddress);
                    break;
                case 'pinc':
                    // Clear text input state since user chose button
                    this.pendingAlerts.delete(interaction.user.id);
                    await this.showPercentageButtons(interaction, tokenAddress, 'increase');
                    break;
                case 'pdec':
                    // Clear text input state since user chose button
                    this.pendingAlerts.delete(interaction.user.id);
                    await this.showPercentageButtons(interaction, tokenAddress, 'decrease');
                    break;
                case 'pi':
                    const increasePercentage = parseInt(customIdParts[1]);
                    const increaseTokenAddress = customIdParts[2];
                    await this.createPercentageAlert(interaction, increaseTokenAddress, increasePercentage, 'increase');
                    break;
                case 'pd':
                    const decreasePercentage = parseInt(customIdParts[1]);
                    const decreaseTokenAddress = customIdParts[2];
                    await this.createPercentageAlert(interaction, decreaseTokenAddress, decreasePercentage, 'decrease');
                    break;
                case 'cancel':
                    // Clear any pending alert state
                    this.pendingAlerts.delete(interaction.user.id);
                    await interaction.update({
                        content: '❌ Alert setup cancelled.',
                        embeds: [],
                        components: []
                    });
                    break;
                case 'back':
                    const backTokenAddress = customIdParts[1];
                    await this.showAlertTypeSelection(interaction, backTokenAddress);
                    break;
                case 'custom':
                    const direction = customIdParts[1] as 'increase' | 'decrease';
                    const customTokenAddress = customIdParts[2];
                    await this.showCustomPercentageModal(interaction, customTokenAddress, direction);
                    break;
                case 'clear':
                    if (interaction.customId === 'clear_all_alerts') {
                        await this.handleClearAllAlerts(interaction);
                    }
                    break;
                case 'confirm':
                    if (interaction.customId === 'confirm_clear_all') {
                        await this.handleClearAllAlerts(interaction);
                    }
                    break;
                case 'cancel':
                    if (interaction.customId === 'cancel_clear_all') {
                        await this.handleCancelClear(interaction);
                    }
                    break;
                default:
                    console.log(`Unknown button action: ${action}`);
                    await interaction.reply({ content: 'Unknown action!', ephemeral: true });
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
            }
        }
    }

    private async refreshTokenMessage(interaction: any, tokenAddress: string): Promise<void> {
        await interaction.deferUpdate();

        try {
            const [marketData, metadata] = await Promise.all([
                this.birdeyeService.getTokenMarketData(tokenAddress),
                this.fetchTokenMetadata(tokenAddress)
            ]);

            const tokenEmbed = this.createTokenInfoEmbed(tokenAddress, marketData, metadata);

            const actionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`alert_${tokenAddress}`)
                        .setLabel('Set Alert')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔔'),
                    new ButtonBuilder()
                        .setCustomId(`refresh_${tokenAddress}`)
                        .setLabel('Refresh')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setURL(`https://solscan.io/token/${tokenAddress}`)
                        .setLabel('View on Solscan')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🔗')
                );

            await interaction.editReply({ embeds: [tokenEmbed], components: [actionRow] });
        } catch (error) {
            console.error('Error refreshing token data:', error);
            await interaction.editReply({ content: '❌ Error refreshing token data.', embeds: [], components: [] });
        }
    }

    private async getSolPrice(): Promise<number> {
        const cacheValid = this.solPriceCache &&
            (Date.now() - this.solPriceCache.lastUpdated) < 60000;

        if (cacheValid) {
            return this.solPriceCache!.price;
        }

        try {
            const marketData = await this.birdeyeService.getTokenMarketData(SOL_TOKEN_ADDRESS);
            if (marketData) {
                // For SOL token, we need to get the USD price from our price service
                const solPriceUSD = this.solPriceService.getSolPriceUSD();
                this.solPriceCache = {
                    price: solPriceUSD,
                    lastUpdated: Date.now()
                };
                return solPriceUSD;
            }
        } catch (error) {
            console.error('Error fetching SOL price from Birdeye:', error);
        }

        try {
            const price = this.solPriceService.getSolPriceUSD();
            if (price && price > 0) {
                this.solPriceCache = {
                    price,
                    lastUpdated: Date.now()
                };
                return price;
            }
        } catch (error) {
            console.error('Error fetching SOL price from SolPriceService:', error);
        }

        // Fallback price if all methods fail
        return 220;
    }

    private formatPrice(price: number | string | null | undefined): string {
        // Convert to number if it's a string (common with database DECIMAL fields)
        let priceValue: number;

        if (price === null || price === undefined) {
            return '0.00';
        }

        if (typeof price === 'string') {
            priceValue = parseFloat(price);
            if (isNaN(priceValue)) {
                return '0.00';
            }
        } else if (typeof price === 'number') {
            priceValue = price;
            if (isNaN(priceValue)) {
                return '0.00';
            }
        } else {
            return '0.00';
        }

        if (priceValue >= 1) {
            return priceValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
        } else {
            return priceValue.toFixed(8).replace(/\.?0+$/, '');
        }
    }

    private formatLargeNumber(num: number | string | null | undefined): string {
        // Convert to number if it's a string (common with database DECIMAL fields)
        let numValue: number;

        if (num === null || num === undefined) {
            console.warn('formatLargeNumber received null/undefined value');
            return '$0.00';
        }

        if (typeof num === 'string') {
            numValue = parseFloat(num);
            if (isNaN(numValue)) {
                console.warn('formatLargeNumber received invalid string value:', num);
                return '$0.00';
            }
        } else if (typeof num === 'number') {
            numValue = num;
            if (isNaN(numValue)) {
                console.warn('formatLargeNumber received NaN');
                return '$0.00';
            }
        } else {
            console.warn('formatLargeNumber received unexpected type:', typeof num, num);
            return '$0.00';
        }

        // Handle zero value specifically
        if (numValue === 0) {
            return '$0.00';
        }

        if (numValue >= 1e12) {
            return `$${(numValue / 1e12).toFixed(2)}T`;
        } else if (numValue >= 1e9) {
            return `$${(numValue / 1e9).toFixed(2)}B`;
        } else if (numValue >= 1e6) {
            return `$${(numValue / 1e6).toFixed(2)}M`;
        } else if (numValue >= 1e3) {
            return `$${(numValue / 1e3).toFixed(2)}K`;
        } else {
            return `$${numValue.toFixed(2)}`;
        }
    }

    private async fetchTokenMetadata(tokenAddress: string): Promise<any> {
        if (!MORALIS_API_KEY) {
            console.log('MORALIS_API_KEY not provided, skipping metadata fetch');
            return null;
        }

        try {
            const response = await axios.get(
                `${SOLANA_GATEWAY_URL}/token/${SOLANA_CHAIN}/${tokenAddress}/metadata`,
                {
                    headers: {
                        'X-API-Key': MORALIS_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            return null;
        }
    }

    private setupStreamingCallbacks(): void {
        console.log('DiscordBot: Setting up streaming callbacks...');
        this.streamingService.setCallbacks({
            onSwap: (notification) => {
                console.log('DiscordBot: onSwap callback triggered');
                this.handleSwapNotification(notification);
            },
            onPing: () => {
                console.log('DiscordBot: onPing callback triggered');
                this.handlePingNotification();
            },
            onError: (error) => {
                console.log('DiscordBot: onError callback triggered');
                this.handleStreamingError(error);
            },
            onStatus: (status) => {
                console.log('DiscordBot: onStatus callback triggered');
                this.handleStreamingStatus(status);
            }
        });
        console.log('DiscordBot: Streaming callbacks set up successfully');
    }

    private async handleSwapNotification(notification: any): Promise<void> {
        console.log('DiscordBot: handleSwapNotification called!', notification);

        const { swap, blockTime, signature, slot } = notification;
        const tokenAddress = swap.baseTokenMint;
        const shortToken = `${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}`;

        // Get token data for market cap calculation
        const tokenData = this.tokenAlerts.get(tokenAddress);
        if (!tokenData) {
            console.log('DiscordBot: No token data found for market cap calculation');
            return;
        }

        // Update the last price
        const newPrice = parseFloat(swap.quotePrice);
        tokenData.lastPrice = newPrice;
        this.tokenAlerts.set(tokenAddress, tokenData);

        // Get current global SOL price
        const solPriceUSD = this.solPriceService.getSolPriceUSD();

        // Calculate new market cap using the correct formula: circulating_supply * sol_price_usd * quote_price
        const newMarketCap = this.solPriceService.calculateMarketCap(tokenData.circulatingSupply, newPrice);

        // Display market cap calculation in terminal with clear formatting
        console.log('═'.repeat(80));
        console.log('📊 MARKET CAP CALCULATION - PRICE PING [DISCORD BOT]');
        console.log('═'.repeat(80));
        console.log(`Token: ${tokenData.name} (${tokenData.symbol})`);
        console.log(`Address: ${tokenAddress}`);
        console.log('');
        console.log('Market Cap Formula: circulating_supply × sol_price_usd × quote_price');
        console.log(`Circulating Supply: ${tokenData.circulatingSupply.toLocaleString()}`);
        console.log(`SOL Price (USD): $${solPriceUSD.toFixed(8)}`);
        console.log(`Quote Price (SOL): ${newPrice.toFixed(8)}`);
        console.log(`Token Price (USD): $${(newPrice * solPriceUSD).toFixed(8)}`);
        console.log('');
        console.log(`Calculation: ${tokenData.circulatingSupply.toLocaleString()} × ${solPriceUSD.toFixed(8)} × ${newPrice.toFixed(8)}`);
        console.log(`Market Cap: $${newMarketCap.toLocaleString()}`);
        console.log('');
        console.log(`Swap Type: ${swap.swapType.toUpperCase()}`);
        console.log(`Amount: ${parseFloat(swap.baseAmount).toLocaleString()}`);
        console.log(`Exchange: ${swap.sourceExchange || 'Unknown'}`);
        console.log(`Time: ${new Date(blockTime * 1000).toLocaleString()}`);
        console.log(`Tx: ${signature}`);
        console.log('═'.repeat(80));

        // Check for triggered alerts (assuming this method exists in monitoring service)
        await this.checkAndTriggerAlertsForToken(tokenAddress, newPrice, newMarketCap);
    }

    private async handlePingNotification(): Promise<void> {
        console.log('DiscordBot: handlePingNotification called!');

        const currentToken = this.streamingService.getCurrentToken();
        console.log(`[DISCORD] WebSocket Ping - Monitoring: ${currentToken ? `${currentToken.slice(0, 8)}...${currentToken.slice(-8)}` : 'None'} - Status: Active - Time: ${new Date().toLocaleString()}`);
    }

    private async handleStreamingError(error: string): Promise<void> {
        console.log(`[DISCORD] WebSocket Error: ${error}`);
    }

    private async handleStreamingStatus(status: string): Promise<void> {
        console.log(`[DISCORD] WebSocket Status: ${status}`);
    }

    private async checkAndTriggerAlertsForToken(tokenAddress: string, currentPrice: number, currentMarketCap: number): Promise<void> {
        try {
            // Get all active alerts for this token with Discord notification type
            const alerts = await query(`
                SELECT ta.*, u.discord_user_id 
                FROM token_alerts ta 
                JOIN users u ON ta.user_id = u.id 
                WHERE ta.token_address = $1 AND ta.is_active = true AND ta.is_triggered = false 
                AND (ta.notification_type = 'discord' OR ta.notification_type = 'extension')
            `, [tokenAddress]);

            let alertsTriggered = false;

            for (const alert of alerts.rows) {
                let shouldTrigger = false;
                let currentValue = 0;

                if (alert.threshold_type === 'price') {
                    const solPriceUSD = this.solPriceService.getSolPriceUSD();
                    currentValue = currentPrice * solPriceUSD;
                } else if (alert.threshold_type === 'market_cap') {
                    currentValue = currentMarketCap;
                }

                // Check if alert should trigger
                if (alert.condition === 'above') {
                    shouldTrigger = currentValue > alert.threshold_value;
                } else if (alert.condition === 'below') {
                    shouldTrigger = currentValue < alert.threshold_value;
                }

                if (shouldTrigger) {
                    alertsTriggered = true;

                    // Mark alert as triggered
                    await query(`
                        UPDATE token_alerts 
                        SET is_triggered = TRUE, triggered_at = CURRENT_TIMESTAMP, is_active = FALSE
                        WHERE id = $1
                    `, [alert.id]);

                    // Send Discord notification if it's a Discord alert
                    if (alert.notification_type === 'discord' && alert.discord_user_id) {
                        const message = `🚨 **ALERT TRIGGERED!** 🚨

**Token:** ${alert.token_name || 'Unknown'} ($${alert.token_symbol || 'UNKNOWN'})
**Alert Type:** ${alert.threshold_type.replace('_', ' ').toUpperCase()}
**Target:** $${alert.threshold_value.toLocaleString()}
**Current:** $${currentValue.toLocaleString()}
**Condition:** ${alert.condition.toUpperCase()}

🎯 Your alert has been triggered and removed!`;

                        await this.sendMessage(alert.discord_user_id, message);
                    }

                    // Print horizontal rule for visibility
                    console.log('═'.repeat(80));
                    console.log('🚨 DISCORD ALERT TRIGGERED 🚨');
                    console.log(`Alert triggered for user ${alert.discord_user_id || 'extension'}: ${alert.token_symbol} ${alert.threshold_type} ${alert.condition} ${alert.threshold_value} (current: ${currentValue})`);
                    console.log('═'.repeat(80));
                }
            }

            // If any alerts were triggered, check if we should stop monitoring this token
            if (alertsTriggered) {
                await this.checkAndUpdateMonitoring(tokenAddress);
            }
        } catch (error) {
            console.error('DiscordBot: Error checking and triggering alerts:', error);
        }
    }

    private async resumeMonitoringForExistingAlerts(): Promise<void> {
        // Implementation similar to Telegram bot
    }

    public async sendMessage(userId: string, message: string): Promise<void> {
        if (!this.client) return;

        try {
            const user = await this.client.users.fetch(userId);
            await user.send(message);
        } catch (error) {
            console.error('Error sending Discord message:', error);
        }
    }

    public isRunningBot(): boolean {
        return this.isRunning;
    }

    public setSkipCommandRegistration(skip: boolean): void {
        this.skipCommandRegistration = skip;
        console.log(`🔧 Discord command registration ${skip ? 'disabled' : 'enabled'}`);
    }

    public isCommandRegistrationSkipped(): boolean {
        return this.skipCommandRegistration;
    }

    // Alert system methods

    private async handleAlertTextInput(message: Message, content: string): Promise<void> {
        const userId = message.author.id;
        const alertState = this.pendingAlerts.get(userId);

        if (!alertState) {
            return;
        }

        try {
            if (alertState.step === 'awaiting_type') {
                // User can type: "mcap", "increase", "decrease", or percentage/market cap values directly
                const lowerContent = content.toLowerCase();

                // Check if it's a direct value input
                const marketCapValue = this.parseMarketCapInput(content);
                const percentageValue = this.parsePercentageInput(content);

                if (marketCapValue !== null) {
                    // Direct market cap input
                    await this.processMarketCapAlert(message, alertState, marketCapValue);
                    return;
                } else if (percentageValue !== null) {
                    // Direct percentage input - determine direction from sign
                    const direction = content.includes('-') ? 'decrease' : 'increase';
                    await this.processPercentageAlert(message, alertState, Math.abs(percentageValue), direction);
                    return;
                } else if (lowerContent.includes('mcap') || lowerContent.includes('market')) {
                    // User wants market cap alert
                    alertState.step = 'awaiting_market_cap';
                    this.pendingAlerts.set(userId, alertState);

                    await message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(0x9945FF)
                            .setTitle('📊 Market Cap Alert Setup')
                            .setDescription(`**Token:** ${alertState.tokenName} ($${alertState.tokenSymbol})
**Current Market Cap:** ${this.formatLargeNumber(alertState.currentMarketCap)}

Please type your target market cap (e.g., "30k", "4.5m", "100m", "2.5b"):`)]
                    });
                    return;
                } else if (lowerContent.includes('increase') || lowerContent.includes('inc') || lowerContent.includes('+')) {
                    // User wants increase alert
                    alertState.step = 'awaiting_percentage';
                    alertState.direction = 'increase';
                    this.pendingAlerts.set(userId, alertState);

                    await message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('📈 Market Cap Increase Alert')
                            .setDescription(`**Token:** ${alertState.tokenName} ($${alertState.tokenSymbol})
**Current Market Cap:** ${this.formatLargeNumber(alertState.currentMarketCap)}

Please type the increase percentage (e.g., "25", "50%", "100"):`)]
                    });
                    return;
                } else if (lowerContent.includes('decrease') || lowerContent.includes('dec') || lowerContent.includes('-')) {
                    // User wants decrease alert
                    alertState.step = 'awaiting_percentage';
                    alertState.direction = 'decrease';
                    this.pendingAlerts.set(userId, alertState);

                    await message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('📉 Market Cap Decrease Alert')
                            .setDescription(`**Token:** ${alertState.tokenName} ($${alertState.tokenSymbol})
**Current Market Cap:** ${this.formatLargeNumber(alertState.currentMarketCap)}

Please type the decrease percentage (e.g., "25", "50%", "100"):`)]
                    });
                    return;
                } else {
                    // Invalid input, show help
                    await message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('❌ Invalid Input')
                            .setDescription(`Please type one of the following:
• **Market cap value**: "30k", "4.5m", "100m", "2.5b"
• **Percentage**: "25%", "50%", "-25%" (negative for decrease)
• **Type**: "mcap", "increase", "decrease"
• **Cancel**: "cancel" or "stop"`)]
                    });
                    return;
                }
            } else if (alertState.step === 'awaiting_market_cap') {
                const marketCapValue = this.parseMarketCapInput(content);
                if (marketCapValue !== null) {
                    await this.processMarketCapAlert(message, alertState, marketCapValue);
                } else {
                    await message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('❌ Invalid Market Cap Format')
                            .setDescription('Please use formats like: "30k", "4.5m", "100m", "2.5b" or type "cancel" to stop.')]
                    });
                }
            } else if (alertState.step === 'awaiting_percentage') {
                const percentageValue = this.parsePercentageInput(content);
                if (percentageValue !== null && alertState.direction) {
                    await this.processPercentageAlert(message, alertState, percentageValue, alertState.direction);
                } else {
                    await message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('❌ Invalid Percentage Format')
                            .setDescription('Please use formats like: "25", "50%", "100" or type "cancel" to stop.')]
                    });
                }
            }

            // Check for cancel
            if (content.toLowerCase().includes('cancel') || content.toLowerCase().includes('stop')) {
                this.pendingAlerts.delete(userId);
                await message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(0x5865F2)
                        .setTitle('❌ Alert Setup Cancelled')
                        .setDescription('Alert setup has been cancelled.')]
                });
            }

        } catch (error) {
            console.error('Error handling alert text input:', error);
            this.pendingAlerts.delete(userId);
            await message.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xED4245)
                    .setTitle('❌ Error')
                    .setDescription('An error occurred while processing your input. Please try again.')]
            });
        }
    }

    private async processMarketCapAlert(message: Message, alertState: UserAlertState, targetMarketCap: number): Promise<void> {
        const userId = message.author.id;
        const condition = targetMarketCap > alertState.currentMarketCap ? 'above' : 'below';

        await this.createAlert(userId, alertState.tokenAddress, alertState.tokenName, alertState.tokenSymbol, 'market_cap', targetMarketCap, condition, alertState.circulatingSupply, alertState.currentMarketCap);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Market Cap Alert Created!')
            .addFields(
                { name: 'Token', value: `${alertState.tokenName} ($${alertState.tokenSymbol})`, inline: true },
                { name: 'Current Market Cap', value: this.formatLargeNumber(alertState.currentMarketCap), inline: true },
                { name: 'Target Market Cap', value: this.formatLargeNumber(targetMarketCap), inline: true },
                { name: 'Condition', value: `Alert when ${condition} target`, inline: true }
            )
            .setFooter({ text: 'You will be notified when this condition is met!' });

        await message.reply({ embeds: [embed] });
        this.pendingAlerts.delete(userId);
    }

    private async processPercentageAlert(message: Message, alertState: UserAlertState, percentage: number, direction: 'increase' | 'decrease'): Promise<void> {
        const userId = message.author.id;
        const currentMarketCap = alertState.currentMarketCap;
        const multiplier = direction === 'increase' ? (1 + percentage / 100) : (1 - percentage / 100);
        const targetMarketCap = currentMarketCap * multiplier;
        const condition = direction === 'increase' ? 'above' : 'below';

        await this.createAlert(userId, alertState.tokenAddress, alertState.tokenName, alertState.tokenSymbol, 'percentage', percentage, condition, alertState.circulatingSupply, currentMarketCap);

        const embed = new EmbedBuilder()
            .setColor(direction === 'increase' ? 0x00FF00 : 0xFF0000)
            .setTitle(`✅ ${direction === 'increase' ? '📈' : '📉'} Market Cap ${direction === 'increase' ? 'Increase' : 'Decrease'} Alert Created!`)
            .addFields(
                { name: 'Token', value: `${alertState.tokenName} ($${alertState.tokenSymbol})`, inline: true },
                { name: 'Current Market Cap', value: this.formatLargeNumber(currentMarketCap), inline: true },
                { name: 'Target Market Cap', value: this.formatLargeNumber(targetMarketCap), inline: true },
                { name: 'Percentage', value: `${percentage}% ${direction}`, inline: true }
            )
            .setFooter({ text: 'You will be notified when this condition is met!' });

        await message.reply({ embeds: [embed] });
        this.pendingAlerts.delete(userId);
    }

    private async showAlertTypeSelection(interaction: any, tokenAddress: string): Promise<void> {
        try {
            // Fetch fresh token data
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
                await interaction.update({
                    content: '❌ Unable to fetch current token data. Please try again.',
                    embeds: [],
                    components: []
                });
                return;
            }

            const tokenName = tokenMetadata?.name || 'Unknown Token';
            const tokenSymbol = tokenMetadata?.symbol || 'UNKNOWN';
            const currentMarketCap = birdeyeData.market_cap;
            const solPrice = await this.getSolPrice();
            const currentPriceUSD = birdeyeData.price * solPrice;

            // Set up text-based input state for this user
            const userId = interaction.user.id;
            const circulatingSupply = birdeyeData.circulating_supply || birdeyeData.total_supply;

            const alertState: UserAlertState = {
                tokenAddress,
                tokenName,
                tokenSymbol,
                currentMarketCap,
                circulatingSupply,
                step: 'awaiting_type',
                messageId: interaction.message.id,
                channelId: interaction.channelId
            };

            this.pendingAlerts.set(userId, alertState);

            const embed = new EmbedBuilder()
                .setColor(0x9945FF)
                .setTitle('🚨 Set Price Alert')
                .setDescription(`**Token:** ${tokenName} ($${tokenSymbol})
**Address:** \`${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}\`

**Current Price:** $${this.formatPrice(currentPriceUSD)}
**Current Market Cap:** ${this.formatLargeNumber(currentMarketCap)}

🎯 **Quick Setup - Just type your next message:**
• **Market cap**: "30k", "4.5m", "100m", "2.5b"
• **Percentage**: "25%", "50%", "-25%" (negative for decrease)
• **Or type**: "mcap", "increase", "decrease" for step-by-step

Type "cancel" anytime to stop.`)
                .setFooter({ text: 'You can also use the buttons below if you prefer' });

            const actionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mcap_${tokenAddress}`)
                        .setLabel('📊 Market Cap Alert')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`pinc_${tokenAddress}`)
                        .setLabel('📈 MC Increase Alert')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`pdec_${tokenAddress}`)
                        .setLabel('📉 MC Decrease Alert')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`cancel_${tokenAddress}`)
                        .setLabel('❌ Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.update({ embeds: [embed], components: [actionRow] });

        } catch (error) {
            console.error('Error showing alert type selection:', error);
            await interaction.update({
                content: '❌ Error loading alert options. Please try again.',
                embeds: [],
                components: []
            });
        }
    }

    private async showMarketCapModal(interaction: any, tokenAddress: string): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`mcap_modal_${tokenAddress}`)
            .setTitle('Market Cap Alert Setup');

        const marketCapInput = new TextInputBuilder()
            .setCustomId('market_cap_value')
            .setLabel('Target Market Cap')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 30k, 4.5m, 100m, 2.5b')
            .setRequired(true)
            .setMaxLength(20);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(marketCapInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }

    private async showCustomPercentageModal(interaction: any, tokenAddress: string, direction: 'increase' | 'decrease'): Promise<void> {
        const modal = new ModalBuilder()
            .setCustomId(`custom_modal_${direction}_${tokenAddress}`)
            .setTitle(`Custom ${direction === 'increase' ? 'Increase' : 'Decrease'} Alert`);

        const percentageInput = new TextInputBuilder()
            .setCustomId('percentage_value')
            .setLabel(`${direction === 'increase' ? 'Increase' : 'Decrease'} Percentage`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 25, 50, 150')
            .setRequired(true)
            .setMaxLength(10);

        const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(percentageInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    }

    private async showPercentageButtons(interaction: any, tokenAddress: string, direction: 'increase' | 'decrease'): Promise<void> {
        const presets = await this.getUserPresets(interaction.user.id, direction === 'increase' ? 'price_increase' : 'price_decrease');

        const embed = new EmbedBuilder()
            .setColor(direction === 'increase' ? 0x00FF00 : 0xFF0000)
            .setTitle(`�${direction === 'increase' ? '📈' : '📉'} Market Cap ${direction === 'increase' ? 'Increase' : 'Decrease'} Alert`)
            .setDescription(`Select the percentage ${direction} or use a custom value:`)
            .setFooter({ text: 'You can also type a custom percentage value in the modal' });

        // Create buttons for presets
        const buttons: ButtonBuilder[] = [];
        presets.forEach(percentage => {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`p${direction.charAt(0)}_${percentage}_${tokenAddress}`)
                    .setLabel(`${percentage}%`)
                    .setStyle(direction === 'increase' ? ButtonStyle.Success : ButtonStyle.Danger)
            );
        });

        // Add custom input button
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`custom_${direction}_${tokenAddress}`)
                .setLabel('🔧 Custom %')
                .setStyle(ButtonStyle.Secondary)
        );

        // Add back and cancel buttons
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`back_${tokenAddress}`)
                .setLabel('⬅️ Back')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`cancel_${tokenAddress}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        // Split buttons into rows (max 5 per row)
        const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
        for (let i = 0; i < buttons.length; i += 5) {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(buttons.slice(i, i + 5));
            actionRows.push(row);
        }

        await interaction.update({ embeds: [embed], components: actionRows });
    }

    private async createPercentageAlert(interaction: any, tokenAddress: string, percentage: number, direction: 'increase' | 'decrease'): Promise<void> {
        try {
            await interaction.deferUpdate();

            // Get token data
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
                await interaction.editReply({
                    content: '❌ Unable to fetch token data. Please try again.',
                    embeds: [],
                    components: []
                });
                return;
            }

            const tokenName = tokenMetadata?.name || 'Unknown Token';
            const tokenSymbol = tokenMetadata?.symbol || 'UNKNOWN';
            const currentMarketCap = birdeyeData.market_cap;
            const circulatingSupply = birdeyeData.circulating_supply || birdeyeData.total_supply;

            // Calculate target market cap
            const multiplier = direction === 'increase' ? (1 + percentage / 100) : (1 - percentage / 100);
            const targetMarketCap = currentMarketCap * multiplier;
            const condition = direction === 'increase' ? 'above' : 'below';

            // Create alert
            await this.createAlert(interaction.user.id, tokenAddress, tokenName, tokenSymbol, 'market_cap', targetMarketCap, condition, circulatingSupply, currentMarketCap);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Alert Created Successfully!')
                .addFields(
                    { name: 'Token', value: `${tokenName} ($${tokenSymbol})`, inline: true },
                    { name: 'Alert Type', value: `Market Cap ${direction === 'increase' ? 'Increase' : 'Decrease'}`, inline: true },
                    { name: 'Percentage', value: `${percentage}%`, inline: true },
                    { name: 'Current Market Cap', value: this.formatLargeNumber(currentMarketCap), inline: true },
                    { name: 'Target Market Cap', value: this.formatLargeNumber(targetMarketCap), inline: true },
                    { name: 'Condition', value: `Alert when ${condition} target`, inline: true }
                )
                .setFooter({ text: 'You will be notified when this condition is met!' });

            await interaction.editReply({ embeds: [embed], components: [] });

        } catch (error) {
            console.error('Error creating percentage alert:', error);

            if (error instanceof Error && error.message === 'DISCORD_ACCOUNT_LINKING_REQUIRED') {
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🔗 Account Linking Required')
                    .setDescription('To create alerts, you need to link your Discord account to a wallet.')
                    .addFields(
                        { name: '🎯 Quick Start', value: 'Use the `/link` command to get your Discord User ID and linking instructions!' },
                        { name: '🌐 Link Your Account', value: '1. Visit our website and connect your wallet\n2. Go to Settings → Discord Integration\n3. Enter your Discord User ID\n4. Click "Link Account"' },
                        { name: '🎉 After Linking', value: 'Create alerts that sync across Discord, web app, and Telegram!' }
                    )
                    .setFooter({ text: 'Use /link for step-by-step instructions!' });

                await interaction.editReply({ embeds: [embed], components: [] });
            } else {
                await interaction.editReply({
                    content: '❌ Error creating alert. Please try again.',
                    embeds: [],
                    components: []
                });
            }
        }
    }

    private async handleModalSubmit(interaction: any): Promise<void> {
        try {
            if (interaction.customId.startsWith('mcap_modal_')) {
                const tokenAddress = interaction.customId.replace('mcap_modal_', '');
                const marketCapValue = interaction.fields.getTextInputValue('market_cap_value');

                await this.createMarketCapAlert(interaction, tokenAddress, marketCapValue);
            } else if (interaction.customId.startsWith('custom_modal_')) {
                const parts = interaction.customId.replace('custom_modal_', '').split('_');
                const direction = parts[0] as 'increase' | 'decrease';
                const tokenAddress = parts[1];
                const percentageValue = interaction.fields.getTextInputValue('percentage_value');

                const percentage = this.parsePercentageInput(percentageValue);
                if (percentage === null) {
                    await interaction.reply({
                        content: '❌ Invalid percentage format. Please use a number followed by % (e.g., "25%" or "150%")',
                        ephemeral: true
                    });
                    return;
                }

                await this.createPercentageAlert(interaction, tokenAddress, percentage, direction);
            }
        } catch (error) {
            console.error('Error handling modal submit:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
            }
        }
    }

    private async createMarketCapAlert(interaction: any, tokenAddress: string, marketCapInput: string): Promise<void> {
        try {
            await interaction.deferReply();

            const targetMarketCap = this.parseMarketCapInput(marketCapInput);
            if (targetMarketCap === null) {
                await interaction.editReply({
                    content: '❌ Invalid market cap format. Please use formats like: 30k, 4.5m, 100m, 2.5b'
                });
                return;
            }

            // Get token data
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
                await interaction.editReply({
                    content: '❌ Unable to fetch token data. Please try again.'
                });
                return;
            }

            const tokenName = tokenMetadata?.name || 'Unknown Token';
            const tokenSymbol = tokenMetadata?.symbol || 'UNKNOWN';
            const currentMarketCap = birdeyeData.market_cap;
            const circulatingSupply = birdeyeData.circulating_supply || birdeyeData.total_supply;
            const condition = targetMarketCap > currentMarketCap ? 'above' : 'below';

            // Create alert
            await this.createAlert(interaction.user.id, tokenAddress, tokenName, tokenSymbol, 'market_cap', targetMarketCap, condition, circulatingSupply, currentMarketCap);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Market Cap Alert Created!')
                .addFields(
                    { name: 'Token', value: `${tokenName} ($${tokenSymbol})`, inline: true },
                    { name: 'Current Market Cap', value: this.formatLargeNumber(currentMarketCap), inline: true },
                    { name: 'Target Market Cap', value: this.formatLargeNumber(targetMarketCap), inline: true },
                    { name: 'Condition', value: `Alert when ${condition} target`, inline: true }
                )
                .setFooter({ text: 'You will be notified when this condition is met!' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating market cap alert:', error);

            if (error instanceof Error && error.message === 'DISCORD_ACCOUNT_LINKING_REQUIRED') {
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🔗 Account Linking Required')
                    .setDescription('To create alerts, you need to link your Discord account to a wallet.')
                    .addFields(
                        { name: '🎯 Quick Start', value: 'Use the `/link` command to get your Discord User ID and linking instructions!' },
                        { name: '🌐 Link Your Account', value: '1. Visit our website and connect your wallet\n2. Go to Settings → Discord Integration\n3. Enter your Discord User ID\n4. Click "Link Account"' },
                        { name: '🎉 After Linking', value: 'Create alerts that sync across Discord, web app, and Telegram!' }
                    )
                    .setFooter({ text: 'Use /link for step-by-step instructions!' });

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({
                    content: '❌ Error creating alert. Please try again.'
                });
            }
        }
    }

    // Utility methods for alerts

    private async getUserPresets(userId: string, presetType: 'price_increase' | 'price_decrease'): Promise<number[]> {
        try {
            const result = await query(`
                SELECT up.percentages
                FROM user_presets up
                JOIN users u ON up.user_id = u.id
                WHERE u.discord_user_id = $1 AND up.preset_type = $2
            `, [userId, presetType]);

            if (result.rows.length > 0) {
                return result.rows[0].percentages;
            }

            // Default presets
            return presetType === 'price_increase' ? [25, 50, 100] : [25, 50, 75];
        } catch (error) {
            console.error('Error fetching user presets:', error);
            return presetType === 'price_increase' ? [25, 50, 100] : [25, 50, 75];
        }
    }

    private parseMarketCapInput(input: string): number | null {
        try {
            const cleanInput = input.trim().toLowerCase();
            const numberMatch = cleanInput.match(/^(\d+(?:\.\d+)?)(k|m|b|t)?$/);

            if (!numberMatch) {
                return null;
            }

            const number = parseFloat(numberMatch[1]);
            const suffix = numberMatch[2];

            let multiplier = 1;
            switch (suffix) {
                case 'k': multiplier = 1000; break;
                case 'm': multiplier = 1000000; break;
                case 'b': multiplier = 1000000000; break;
                case 't': multiplier = 1000000000000; break;
            }

            return number * multiplier;
        } catch (error) {
            return null;
        }
    }

    private parsePercentageInput(input: string): number | null {
        try {
            const cleanInput = input.trim().replace('%', '');
            const number = parseFloat(cleanInput);

            if (isNaN(number) || number <= 0) {
                return null;
            }

            return number;
        } catch (error) {
            return null;
        }
    }

    private async createAlert(userId: string, tokenAddress: string, tokenName: string, tokenSymbol: string, thresholdType: string, thresholdValue: number, condition: string, circulatingSupply?: number, currentMarketCap?: number): Promise<void> {
        try {
            // First ensure user exists and is properly linked
            await this.ensureUserExists(userId);

            // Create the alert
            await query(`
                INSERT INTO token_alerts (user_id, token_address, token_name, token_symbol, threshold_type, threshold_value, condition, notification_type, circulating_supply, current_market_cap)
                SELECT u.id, $2, $3, $4, $5, $6, $7, 'discord', $8, $9
                FROM users u WHERE u.discord_user_id = $1
            `, [userId, tokenAddress, tokenName, tokenSymbol, thresholdType, thresholdValue, condition, circulatingSupply, currentMarketCap]);

            console.log(`Discord alert created for user ${userId}: ${tokenSymbol} ${condition} ${thresholdType} ${thresholdValue} (circulating: ${circulatingSupply}, mcap: ${currentMarketCap})`);

            // Start monitoring if needed
            await this.startMonitoringIfNeeded(tokenAddress);
        } catch (error) {
            if (error instanceof Error && error.message === 'DISCORD_USER_NOT_LINKED') {
                // User needs to link their account - provide helpful Discord-native guidance
                throw new Error('DISCORD_ACCOUNT_LINKING_REQUIRED');
            }
            console.error('Error creating Discord alert in database:', error);
            throw error;
        }
    }

    private async ensureUserExists(userId: string): Promise<void> {
        try {
            // Check if user already exists with this discord_user_id
            const existingResult = await query(`
                SELECT id, wallet_address FROM users WHERE discord_user_id = $1
            `, [userId]);

            if (existingResult.rows.length === 0) {
                // User doesn't exist - this means they need to link their account
                throw new Error('DISCORD_USER_NOT_LINKED');
            }

            const user = existingResult.rows[0];

            // Check if wallet_address is null, empty, or a placeholder account
            if (!user.wallet_address ||
                user.wallet_address === null ||
                user.wallet_address === '' ||
                (user.wallet_address.startsWith('discord_') && user.wallet_address.includes('_placeholder'))) {
                throw new Error('DISCORD_USER_NOT_LINKED');
            }

            console.log(`[DISCORD] User ${userId} is properly linked to wallet ${user.wallet_address}`);
        } catch (error) {
            if (error instanceof Error && error.message === 'DISCORD_USER_NOT_LINKED') {
                throw error; // Re-throw our custom error
            }
            console.error('Error ensuring Discord user exists:', error);
            throw error;
        }
    }

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

    // Clear alerts functionality
    private async handleClearAllAlerts(interaction: any): Promise<void> {
        try {
            await interaction.deferReply();
            const userId = interaction.user.id;

            // Get all tokens that have alerts for this user (for cleanup later)
            const affectedTokensResult = await query(`
                SELECT DISTINCT ta.token_address
                FROM token_alerts ta
                JOIN users u ON ta.user_id = u.id 
                WHERE u.discord_user_id = $1 AND ta.is_active = true AND ta.is_triggered = false
            `, [userId]);

            const affectedTokens = affectedTokensResult.rows.map(row => row.token_address);

            // Deactivate all alerts for this user
            const clearResult = await query(`
                UPDATE token_alerts 
                SET is_active = false, is_triggered = true
                WHERE id IN (
                    SELECT ta.id 
                    FROM token_alerts ta 
                    JOIN users u ON ta.user_id = u.id 
                    WHERE u.discord_user_id = $1 AND ta.is_active = true
                )
            `, [userId]);

            const clearedCount = clearResult.rowCount || 0;

            // Create success embed
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Alerts Cleared Successfully')
                .setDescription(`Successfully cleared **${clearedCount}** alert${clearedCount === 1 ? '' : 's'}.`)
                .addFields({
                    name: '📊 What happened:',
                    value: '• All your active alerts have been deactivated\n• You will no longer receive notifications\n• Monitoring has been updated'
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`[DISCORD] Cleared ${clearedCount} alerts for user ${userId}`);

            // Now check each affected token to see if monitoring should continue
            for (const tokenAddress of affectedTokens) {
                await this.checkAndUpdateTokenMonitoring(tokenAddress);
            }

        } catch (error) {
            console.error('Error clearing Discord alerts:', error);
            await interaction.editReply({
                content: '❌ Error clearing alerts. Please try again later.'
            });
        }
    }

    private async handleCancelClear(interaction: any): Promise<void> {
        try {
            const embed = new EmbedBuilder()
                .setColor(0x6C757D)
                .setTitle('❌ Clear Operation Cancelled')
                .setDescription('Your alerts remain active and unchanged.')
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [] });
        } catch (error) {
            console.error('Error handling cancel clear:', error);
        }
    }

    // Monitoring cleanup functionality (similar to Telegram bot)
    public async checkAndUpdateTokenMonitoring(tokenAddress: string): Promise<void> {
        return this.checkAndUpdateMonitoring(tokenAddress);
    }

    // Public method to start monitoring when a new alert is created
    public async startMonitoringForNewAlert(tokenAddress: string): Promise<void> {
        try {
            console.log(`[DISCORD] Starting monitoring for new alert on token: ${tokenAddress.slice(0, 8)}...`);

            // Check if this token has active alerts
            const activeAlertsResult = await query(`
                SELECT COUNT(*) as count 
                FROM token_alerts 
                WHERE token_address = $1 AND is_active = true AND is_triggered = false
            `, [tokenAddress]);

            const activeAlertsCount = parseInt(activeAlertsResult.rows[0].count);

            if (activeAlertsCount > 0) {
                // Start monitoring this token - this will fetch token data and set up websocket callbacks
                await this.startMonitoringIfNeeded(tokenAddress);
                console.log(`[DISCORD] Started websocket monitoring for token with ${activeAlertsCount} active alerts`);
                console.log(`[DISCORD] Token data stored in alerts map for market cap calculations`);
            } else {
                console.log(`[DISCORD] No active alerts found for token, skipping monitoring start`);
            }
        } catch (error) {
            console.error('[DISCORD] Error starting monitoring for new alert:', error);
            throw error;
        }
    }

    private async checkAndUpdateMonitoring(triggeredTokenAddress: string): Promise<void> {
        try {
            // Check if there are any remaining active alerts for this token
            const remainingAlertsForToken = await query(`
                SELECT COUNT(*) as count 
                FROM token_alerts 
                WHERE token_address = $1 AND is_active = true AND is_triggered = false
            `, [triggeredTokenAddress]);

            const remainingCount = parseInt(remainingAlertsForToken.rows[0].count);

            if (remainingCount > 0) {
                console.log(`[DISCORD] Token ${triggeredTokenAddress.slice(0, 8)}... still has ${remainingCount} active alerts. Continuing monitoring.`);
                return;
            }

            // No more alerts for this token, remove it from our alerts map
            this.tokenAlerts.delete(triggeredTokenAddress);

            console.log('═'.repeat(80));
            console.log(`🔄 DISCORD TOKEN MONITORING UPDATE`);
            console.log(`No more active alerts for token: ${triggeredTokenAddress.slice(0, 8)}...`);
            console.log('Checking for other tokens to monitor...');

            // Get all other tokens that still have active alerts
            const otherActiveTokens = await query(`
                SELECT DISTINCT token_address, token_name, token_symbol
                FROM token_alerts 
                WHERE is_active = true AND is_triggered = false AND token_address != $1
            `, [triggeredTokenAddress]);

            if (otherActiveTokens.rows.length > 0) {
                // Switch to monitoring the first available token with active alerts
                const nextToken = otherActiveTokens.rows[0];
                console.log(`[DISCORD] Switching monitoring to: ${nextToken.token_name} (${nextToken.token_symbol})`);
                console.log(`[DISCORD] Address: ${nextToken.token_address}`);

                // Start monitoring the new token and get its data
                await this.startMonitoringIfNeeded(nextToken.token_address);

                console.log(`[DISCORD] Now monitoring ${otherActiveTokens.rows.length} tokens with active alerts`);
            } else {
                // No other tokens have active alerts, stop monitoring entirely
                console.log('[DISCORD] No other tokens have active alerts. Stopping websocket monitoring.');
                await this.streamingService.stopMonitoring();

                // Clear token alerts since no tokens are being monitored
                this.tokenAlerts.clear();
            }
            console.log('═'.repeat(80));

        } catch (error) {
            console.error('[DISCORD] Error updating monitoring after alert trigger:', error);
        }
    }
} 