import WebSocket from 'ws';

interface SwapNotification {
    slot: number;
    signature: string;
    blockTime: number;
    swap: {
        ammAccount: string;
        baseTokenMint: string;
        quoteTokenMint: string;
        walletAccount: string;
        quotePrice: string;
        usdValue: number;
        baseAmount: string;
        swapType: 'buy' | 'sell';
        sourceExchange?: string;
        quoteTokenLiquidity?: string;
    };
}

interface SubscriptionParams {
    include: {
        ammAccount?: string[];
        walletAccount?: string[];
        baseTokenMint?: string[];
        usdValue?: number;
    };
}

// Security Configuration
const SECURITY_CONFIG = {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    checkServerIdentity: (hostname: string, cert: any) => {
        if (hostname !== 'api.solanastreaming.com') {
            throw new Error('Hostname mismatch');
        }
        return undefined;
    }
};

export class SolanaStreamingService {
    private static instance: SolanaStreamingService | null = null;
    private ws: WebSocket | null = null;
    private apiKey: string;
    private isConnected: boolean = false;
    private subscriptionId: number | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000;
    private pingInterval: NodeJS.Timeout | null = null;
    private messageCounter: number = 1;
    private currentToken: string | null = null;

    // Callback for handling events
    private onSwapCallback?: (notification: SwapNotification) => void;
    private onPingCallback?: () => void;
    private onErrorCallback?: (error: string) => void;
    private onStatusCallback?: (status: string) => void;

    private constructor() {
        this.apiKey = process.env.SOLANA_STREAMING_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('SOLANA_STREAMING_API_KEY environment variable is required');
        }
    }

    public static getInstance(): SolanaStreamingService {
        if (!SolanaStreamingService.instance) {
            SolanaStreamingService.instance = new SolanaStreamingService();
        }
        return SolanaStreamingService.instance;
    }

    // Set callbacks for Telegram integration
    public setCallbacks(callbacks: {
        onSwap?: (notification: SwapNotification) => void;
        onPing?: () => void;
        onError?: (error: string) => void;
        onStatus?: (status: string) => void;
    }) {
        this.onSwapCallback = callbacks.onSwap;
        this.onPingCallback = callbacks.onPing;
        this.onErrorCallback = callbacks.onError;
        this.onStatusCallback = callbacks.onStatus;
    }

    public async startMonitoring(tokenAddress: string): Promise<boolean> {
        try {
            // Validate token address
            const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
            if (!SOLANA_ADDRESS_REGEX.test(tokenAddress)) {
                this.onErrorCallback?.('Invalid Solana token address format');
                return false;
            }

            this.currentToken = tokenAddress;

            if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
                // If already connected, just change subscription
                await this.updateSubscription(tokenAddress);
                return true;
            } else {
                // Connect and subscribe
                await this.connect();
                await this.subscribeToToken(tokenAddress);
                return true;
            }
        } catch (error) {
            console.error('Error starting monitoring:', error);
            this.onErrorCallback?.(`Failed to start monitoring: ${error}`);
            return false;
        }
    }

    public async stopMonitoring(): Promise<void> {
        this.onStatusCallback?.('Stopping WebSocket monitoring...');
        await this.disconnect();
    }

    public getCurrentToken(): string | null {
        return this.currentToken;
    }

    public isMonitoring(): boolean {
        return this.isConnected && this.currentToken !== null;
    }

    private async connect(): Promise<void> {
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            this.onStatusCallback?.('Connecting to SolanaStreaming...');

            this.ws = new WebSocket('wss://api.solanastreaming.com', {
                headers: {
                    'X-API-KEY': this.apiKey,
                    'User-Agent': 'SolanaBot/1.0',
                    'Accept': 'application/json'
                },
                ...SECURITY_CONFIG,
                handshakeTimeout: 10000,
                maxPayload: 1024 * 1024
            });

            this.setupEventHandlers();

            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);

                this.ws!.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                this.ws!.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

        } catch (error) {
            console.error('Failed to connect to SolanaStreaming:', error);
            this.onErrorCallback?.(`Connection failed: ${error}`);
            throw error;
        }
    }

    private setupEventHandlers(): void {
        if (!this.ws) return;

        this.ws.on('open', () => {
            console.log('Connected to SolanaStreaming WebSocket');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.startPingInterval();
            this.onStatusCallback?.('WebSocket connected successfully');
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                this.onErrorCallback?.('Failed to parse WebSocket message');
            }
        });

        this.ws.on('close', (code, reason) => {
            console.log(`WebSocket connection closed: ${code} - ${reason}`);
            this.isConnected = false;
            this.stopPingInterval();
            this.onStatusCallback?.(`WebSocket disconnected: ${code}`);
            this.handleReconnection();
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.onErrorCallback?.(`WebSocket error: ${error.message}`);
        });

        this.ws.on('pong', () => {
            console.log('Received pong from server');
            this.onPingCallback?.(); // Trigger Telegram message on ping
        });
    }

    private handleMessage(message: any): void {
        // Handle subscription response
        if (message.id && message.result && message.result.subscription_id) {
            this.subscriptionId = message.result.subscription_id;
            console.log(`Subscription created with ID: ${this.subscriptionId}`);
            this.onStatusCallback?.(`Monitoring started for token: ${this.currentToken?.slice(0, 8)}...`);
            return;
        }

        // Handle errors
        if (message.error) {
            console.error('Subscription error:', message.error);
            this.onErrorCallback?.(`Subscription error: ${message.error.message}`);
            return;
        }

        // Handle swap notifications - correct structure check
        if (message.method === 'swapNotification' && message.params) {
            const swapNotification: SwapNotification = {
                slot: message.params.slot,
                signature: message.params.signature,
                blockTime: message.params.blockTime,
                swap: message.params.swap
            };
            this.handleSwapNotification(swapNotification);
            return;
        }

        console.log('Received message:', message);
    }

    private handleSwapNotification(notification: SwapNotification): void {
        const { swap, blockTime, signature, slot } = notification;

        console.log(`Swap detected on ${swap.baseTokenMint}: ${swap.swapType} $${swap.usdValue}`);

        // Send to Telegram via callback
        this.onSwapCallback?.(notification);
    }

    private async subscribeToToken(tokenAddress: string): Promise<void> {
        if (!this.isConnected || !this.ws) {
            throw new Error('Not connected to WebSocket');
        }

        const subscribeMessage = {
            jsonrpc: "2.0",
            id: this.messageCounter++,
            method: "swapSubscribe",
            params: {
                include: {
                    baseTokenMint: [tokenAddress]
                }
            }
        };

        console.log('Subscribing to token:', tokenAddress);
        this.ws.send(JSON.stringify(subscribeMessage));
    }

    private async updateSubscription(tokenAddress: string): Promise<void> {
        // Unsubscribe from current token
        if (this.subscriptionId) {
            await this.unsubscribe();
        }

        // Subscribe to new token
        this.currentToken = tokenAddress;
        await this.subscribeToToken(tokenAddress);
    }

    private async unsubscribe(): Promise<void> {
        if (!this.isConnected || !this.ws || !this.subscriptionId) {
            return;
        }

        const unsubscribeMessage = {
            jsonrpc: "2.0",
            id: this.messageCounter++,
            method: "swapUnsubscribe",
            params: {
                subscription_id: this.subscriptionId
            }
        };

        this.ws.send(JSON.stringify(unsubscribeMessage));
        this.subscriptionId = null;
    }

    private startPingInterval(): void {
        // Send ping every 30 seconds
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.ping();
                console.log('Sent ping to server');
            }
        }, 30000);
    }

    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private async handleReconnection(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.onErrorCallback?.('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        this.onStatusCallback?.(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(async () => {
            try {
                await this.connect();
                if (this.currentToken) {
                    await this.subscribeToToken(this.currentToken);
                }
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.handleReconnection();
            }
        }, this.reconnectDelay);
    }

    public async disconnect(): Promise<void> {
        this.stopPingInterval();

        if (this.subscriptionId) {
            await this.unsubscribe();
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        this.currentToken = null;
        console.log('Disconnected from SolanaStreaming');
    }
} 