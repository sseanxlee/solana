import axios from 'axios';

const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY;
const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so/defi/v3';

export interface BirdeyeTokenMarketData {
    address: string;
    price: number;
    liquidity: number;
    total_supply: number;
    circulating_supply: number;
    fdv: number;
    market_cap: number;
}

export interface BirdeyeResponse {
    data: BirdeyeTokenMarketData;
    success: boolean;
}

export class BirdeyeService {
    private static instance: BirdeyeService | null = null;

    private constructor() {
        if (!BIRDEYE_API_KEY) {
            console.warn('Birdeye API key not configured');
        }
    }

    public static getInstance(): BirdeyeService {
        if (!BirdeyeService.instance) {
            BirdeyeService.instance = new BirdeyeService();
        }
        return BirdeyeService.instance;
    }

    async getTokenMarketData(tokenAddress: string): Promise<BirdeyeTokenMarketData | null> {
        if (!BIRDEYE_API_KEY) {
            console.warn('Birdeye API key not configured, skipping market data fetch');
            return null;
        }

        try {
            console.log(`Fetching token market data from Birdeye for: ${tokenAddress}`);

            const response = await axios.get(`${BIRDEYE_BASE_URL}/token/market-data`, {
                params: {
                    address: tokenAddress
                },
                headers: {
                    'X-API-KEY': BIRDEYE_API_KEY,
                    'accept': 'application/json',
                    'x-chain': 'solana'
                },
                timeout: 10000
            });

            const birdeyeResponse: BirdeyeResponse = response.data;

            if (birdeyeResponse.success && birdeyeResponse.data) {
                console.log('Birdeye market data fetched successfully:', birdeyeResponse.data);
                return birdeyeResponse.data;
            } else {
                console.warn('Birdeye API returned unsuccessful response or no data');
                return null;
            }
        } catch (error: any) {
            console.error('Birdeye API error:', {
                message: error?.message,
                status: error?.response?.status,
                statusText: error?.response?.statusText,
                data: error?.response?.data,
                url: error?.config?.url
            });
            return null;
        }
    }

    async getMultipleTokenMarketData(tokenAddresses: string[]): Promise<Map<string, BirdeyeTokenMarketData>> {
        const marketDataMap = new Map<string, BirdeyeTokenMarketData>();

        // Birdeye doesn't support batch requests for market data, so we make individual calls
        // To avoid rate limiting, we can add a small delay between requests
        for (const address of tokenAddresses) {
            try {
                const marketData = await this.getTokenMarketData(address);
                if (marketData) {
                    marketDataMap.set(address, marketData);
                }

                // Small delay to be respectful to the API
                if (tokenAddresses.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                console.error(`Error fetching market data for ${address}:`, error);
            }
        }

        return marketDataMap;
    }

    isConfigured(): boolean {
        return !!BIRDEYE_API_KEY;
    }
}

export default BirdeyeService; 