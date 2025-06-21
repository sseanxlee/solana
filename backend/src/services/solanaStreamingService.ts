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

export class SolanaStreamingService {
    private static instance: SolanaStreamingService | null = null;
    private ws: WebSocket | null = null;
    private apiKey: string;
    private isConnected: boolean = false;
    private subscriptionId: number | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000; // 5 seconds
    private pingInterval: NodeJS.Timeout | null = null;

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

    public async connect(): Promise<void> {
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
            console.log('Already connected to SolanaStreaming');
            return;
        }

        try {
            console.log('Connecting to SolanaStreaming WebSocket...');

            this.ws = new WebSocket('wss://api.solanastreaming.com', {
                headers: {
                    'X-API-KEY': this.apiKey
                }
            });

            this.setupEventHandlers();

            // Wait for connection to be established
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
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        this.ws.on('close', (code, reason) => {
            console.log(`WebSocket connection closed: ${code} - ${reason}`);
            this.isConnected = false;
            this.stopPingInterval();
            this.handleReconnection();
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        this.ws.on('pong', () => {
            console.log('Received pong from server');
        });
    }

    private handleMessage(message: any): void {
        // Handle subscription response
        if (message.id && message.result && message.result.subscription_id) {
            this.subscriptionId = message.result.subscription_id;
            console.log(`Subscription created with ID: ${this.subscriptionId}`);
            return;
        }

        // Handle swap notifications
        if (message.slot && message.swap) {
            this.handleSwapNotification(message as SwapNotification);
            return;
        }

        console.log('Received message:', message);
    }

    private handleSwapNotification(notification: SwapNotification): void {
        const { swap, blockTime, signature } = notification;

        console.log(`
🔄 Swap Detected:
Token: ${swap.baseTokenMint}
Type: ${swap.swapType.toUpperCase()}
USD Value: $${swap.usdValue.toLocaleString()}
Price: ${swap.quotePrice} SOL
Time: ${new Date(blockTime * 1000).toISOString()}
Signature: ${signature}
        `);

        // Here you can add logic to:
        // 1. Calculate market cap changes
        // 2. Trigger alerts for large movements
        // 3. Store data in database
        // 4. Send notifications via Telegram
    }

    public async subscribeToSwaps(params: SubscriptionParams): Promise<void> {
        if (!this.isConnected || !this.ws) {
            throw new Error('Not connected to WebSocket');
        }

        const subscribeMessage = {
            jsonrpc: "2.0",
            id: 1,
            method: "swapSubscribe",
            params
        };

        console.log('Subscribing to swaps with params:', JSON.stringify(params, null, 2));
        this.ws.send(JSON.stringify(subscribeMessage));
    }

    public async unsubscribe(): Promise<void> {
        if (!this.isConnected || !this.ws || !this.subscriptionId) {
            return;
        }

        const unsubscribeMessage = {
            jsonrpc: "2.0",
            id: 2,
            method: "swapUnsubscribe",
            params: {
                subscription_id: this.subscriptionId
            }
        };

        this.ws.send(JSON.stringify(unsubscribeMessage));
        this.subscriptionId = null;
    }

    private startPingInterval(): void {
        // Send ping every 30 seconds to keep connection alive
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
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(async () => {
            try {
                await this.connect();
                // Re-subscribe if we had a subscription before
                if (this.subscriptionId) {
                    // You might want to store the last subscription params to re-subscribe
                    console.log('Reconnected successfully');
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
        console.log('Disconnected from SolanaStreaming');
    }

    public isWebSocketConnected(): boolean {
        return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
    }
} 