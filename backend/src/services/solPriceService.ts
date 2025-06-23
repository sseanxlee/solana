import axios from 'axios';

export class SolPriceService {
    private static instance: SolPriceService | null = null;
    private solPriceUSD: number = 0;
    private lastUpdated: Date = new Date(0);
    private updateInterval: NodeJS.Timeout | null = null;
    private isUpdating: boolean = false;

    private constructor() {
        this.startPriceUpdates();
    }

    public static getInstance(): SolPriceService {
        if (!SolPriceService.instance) {
            SolPriceService.instance = new SolPriceService();
        }
        return SolPriceService.instance;
    }

    /**
     * Get the current SOL price in USD
     * @returns Current SOL price in USD
     */
    public getSolPriceUSD(): number {
        return this.solPriceUSD;
    }

    /**
     * Get the last update timestamp
     * @returns Last update timestamp
     */
    public getLastUpdated(): Date {
        return this.lastUpdated;
    }

    /**
     * Force update the SOL price immediately
     * @returns Promise that resolves when update is complete
     */
    public async forceUpdate(): Promise<number> {
        await this.updateSolPrice();
        return this.solPriceUSD;
    }

    /**
     * Start automatic price updates every 30 seconds
     */
    private startPriceUpdates(): void {
        // Initial fetch
        this.updateSolPrice();

        // Update every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateSolPrice();
        }, 30000);

        console.log('SOL price service started - updating every 30 seconds');
    }

    /**
     * Stop automatic price updates
     */
    public stopPriceUpdates(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('SOL price service stopped');
        }
    }

    /**
     * Update SOL price from Jupiter API
     */
    private async updateSolPrice(): Promise<void> {
        if (this.isUpdating) {
            return; // Prevent concurrent updates
        }

        this.isUpdating = true;

        try {
            // Use Jupiter API to get SOL price (most reliable for Solana ecosystem)
            const response = await axios.get(
                'https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112',
                { timeout: 10000 }
            );

            const data = response.data;
            if (data && data.data && data.data.So11111111111111111111111111111111111111112) {
                const solData = data.data.So11111111111111111111111111111111111111112;
                this.solPriceUSD = parseFloat(solData.price);
                this.lastUpdated = new Date();

                console.log(`SOL price updated: $${this.solPriceUSD.toFixed(2)} USD`);
            } else {
                console.warn('Invalid response from Jupiter SOL price API');
            }
        } catch (error: any) {
            console.error('Failed to update SOL price:', error.message);

            // Fallback to CoinGecko if Jupiter fails
            try {
                const fallbackResponse = await axios.get(
                    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
                    { timeout: 10000 }
                );

                if (fallbackResponse.data && fallbackResponse.data.solana && fallbackResponse.data.solana.usd) {
                    this.solPriceUSD = fallbackResponse.data.solana.usd;
                    this.lastUpdated = new Date();
                    console.log(`SOL price updated (fallback): $${this.solPriceUSD.toFixed(2)} USD`);
                }
            } catch (fallbackError: any) {
                console.error('Fallback SOL price update also failed:', fallbackError.message);
            }
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Calculate market cap using the formula: circulating_supply * sol_price_usd * quote_price
     * @param circulatingSupply - The circulating supply of the token
     * @param quotePrice - The quote price from websocket (token price in SOL)
     * @returns Calculated market cap in USD
     */
    public calculateMarketCap(circulatingSupply: number, quotePrice: number): number {
        if (!circulatingSupply || !quotePrice || this.solPriceUSD <= 0) {
            return 0;
        }

        // Formula: circulating_supply * sol_price_usd * quote_price
        const marketCap = circulatingSupply * this.solPriceUSD * quotePrice;

        console.log(`Market cap calculation: ${circulatingSupply} * ${this.solPriceUSD} * ${quotePrice} = ${marketCap}`);

        return marketCap;
    }

    /**
     * Check if the SOL price data is fresh (updated within last 2 minutes)
     * @returns True if data is fresh, false otherwise
     */
    public isDataFresh(): boolean {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        return this.lastUpdated > twoMinutesAgo;
    }
}

export default SolPriceService; 