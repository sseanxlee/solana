import axios from 'axios';
import { query } from '../config/database';
import { TokenData, MoralisTokenData, JupiterPriceData, TokenPairsResponse, TokenMetadata, TokenAnalytics, TokenPairStats } from '../types';
import { BirdeyeService, BirdeyeTokenMarketData } from './birdeyeService';

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const SOLANA_GATEWAY_URL = 'https://solana-gateway.moralis.io';
const SOLANA_CHAIN = 'mainnet';

// Debug environment setup
console.log('TokenService initialized with:', {
    hasApiKey: !!MORALIS_API_KEY,
    apiKeyLength: MORALIS_API_KEY?.length || 0,
    baseUrl: SOLANA_GATEWAY_URL,
    chain: SOLANA_CHAIN
});

export class TokenService {
    private birdeyeService = BirdeyeService.getInstance();

    async getTokenData(tokenAddress: string): Promise<TokenData | null> {
        try {
            // First check cache
            const cachedData = await this.getCachedTokenData(tokenAddress);
            if (cachedData && this.isCacheValid(cachedData.last_updated)) {
                return cachedData;
            }

            // Try Birdeye first for comprehensive market data
            const birdeyeData = await this.birdeyeService.getTokenMarketData(tokenAddress);
            if (birdeyeData) {
                // Create TokenData from Birdeye response
                const tokenData: TokenData = {
                    address: birdeyeData.address,
                    name: 'Unknown Token', // Birdeye doesn't provide name/symbol, we'll get this from other sources
                    symbol: 'UNKNOWN',
                    price: birdeyeData.price,
                    market_cap: birdeyeData.market_cap,
                    last_updated: new Date(),
                };

                // Try to enrich with metadata from Moralis or Jupiter
                const enrichedData = await this.enrichTokenData(tokenData, tokenAddress);

                if (enrichedData) {
                    await this.updateTokenCache(enrichedData);
                    return enrichedData;
                }
            }

            // Fallback to legacy method if Birdeye fails
            // Fetch from Moralis using correct endpoints
            let tokenData = await this.fetchFromMoralis(tokenAddress);

            // Fallback to Jupiter if Moralis fails
            if (!tokenData) {
                tokenData = await this.fetchFromJupiter(tokenAddress);
            }

            if (tokenData) {
                await this.updateTokenCache(tokenData);
            }

            return tokenData;
        } catch (error) {
            console.error('Error fetching token data:', error);
            return null;
        }
    }

    private async enrichTokenData(baseData: TokenData, tokenAddress: string): Promise<TokenData | null> {
        try {
            // Try to get name and symbol from Moralis metadata
            let enrichedData = { ...baseData };

            if (MORALIS_API_KEY) {
                try {
                    const metadataResponse = await axios.get(
                        `${SOLANA_GATEWAY_URL}/token/${SOLANA_CHAIN}/${tokenAddress}/metadata`,
                        {
                            headers: {
                                'X-API-Key': MORALIS_API_KEY,
                                'accept': 'application/json',
                            },
                            timeout: 5000,
                        }
                    );

                    const metadata = metadataResponse.data;
                    if (metadata.name) enrichedData.name = metadata.name;
                    if (metadata.symbol) enrichedData.symbol = metadata.symbol;
                } catch (error) {
                    console.warn('Failed to enrich token data with Moralis metadata:', error);
                }
            }

            // If still no name/symbol, try Jupiter as a last resort
            if (enrichedData.name === 'Unknown Token' || enrichedData.symbol === 'UNKNOWN') {
                try {
                    const jupiterResponse = await axios.get(
                        `https://price.jup.ag/v6/price?ids=${tokenAddress}`,
                        { timeout: 5000 }
                    );

                    const jupiterData: JupiterPriceData = jupiterResponse.data;
                    const tokenPrice = jupiterData.data[tokenAddress];

                    if (tokenPrice?.mintSymbol) {
                        if (enrichedData.name === 'Unknown Token') {
                            enrichedData.name = tokenPrice.mintSymbol;
                        }
                        if (enrichedData.symbol === 'UNKNOWN') {
                            enrichedData.symbol = tokenPrice.mintSymbol;
                        }
                    }
                } catch (error) {
                    console.warn('Failed to enrich token data with Jupiter:', error);
                }
            }

            return enrichedData;
        } catch (error) {
            console.error('Error enriching token data:', error);
            return baseData;
        }
    }

    private async fetchFromMoralis(tokenAddress: string): Promise<TokenData | null> {
        try {
            if (!MORALIS_API_KEY) {
                console.warn('Moralis API key not configured, skipping...');
                return null;
            }

            console.log(`Fetching token data from Moralis for: ${tokenAddress}`);

            // Use the WORKING Moralis Solana Gateway endpoints
            const [metadataResponse, priceResponse] = await Promise.allSettled([
                // Get Token Metadata - WORKING endpoint
                axios.get(
                    `${SOLANA_GATEWAY_URL}/token/${SOLANA_CHAIN}/${tokenAddress}/metadata`,
                    {
                        headers: {
                            'X-API-Key': MORALIS_API_KEY,
                            'accept': 'application/json',
                        },
                        timeout: 15000,
                    }
                ),
                // Get Token Price - WORKING endpoint
                axios.get(
                    `${SOLANA_GATEWAY_URL}/token/${SOLANA_CHAIN}/${tokenAddress}/price`,
                    {
                        headers: {
                            'X-API-Key': MORALIS_API_KEY,
                            'accept': 'application/json',
                        },
                        timeout: 15000,
                    }
                )
            ]);

            let metadata: any = {};
            let priceData: any = {};

            // Handle metadata response
            if (metadataResponse.status === 'fulfilled') {
                metadata = metadataResponse.value.data;
                console.log('Moralis metadata response:', metadata);
            } else {
                console.warn('Moralis metadata fetch failed:', metadataResponse.reason?.message || metadataResponse.reason);
            }

            // Handle price response
            if (priceResponse.status === 'fulfilled') {
                priceData = priceResponse.value.data;
                console.log('Moralis price response:', priceData);
            } else {
                console.warn('Moralis price fetch failed:', priceResponse.reason?.message || priceResponse.reason);
            }

            // If we have at least some data, return it
            if (metadata.name || metadata.symbol || priceData.usdPrice) {
                const price = parseFloat(priceData.usdPrice || '0');
                const marketCap = priceData.marketCap ? parseFloat(priceData.marketCap) : undefined;

                const result = {
                    address: tokenAddress,
                    name: metadata.name || 'Unknown Token',
                    symbol: metadata.symbol || 'UNKNOWN',
                    price: price,
                    market_cap: marketCap,
                    last_updated: new Date(),
                };

                console.log('Moralis token data processed:', result);
                return result;
            }

            console.log('No valid data from Moralis');
            return null;
        } catch (error) {
            console.error('Moralis API error:', {
                message: (error as any)?.message,
                status: (error as any)?.response?.status,
                statusText: (error as any)?.response?.statusText,
                data: (error as any)?.response?.data,
                url: (error as any)?.config?.url,
                headers: (error as any)?.config?.headers
            });
            return null;
        }
    }

    // Search by contract address - simplified to just get token by address
    async searchTokens(contractAddress: string): Promise<TokenData[]> {
        try {
            console.log(`Searching token by contract address: ${contractAddress}`);

            // Validate that the input looks like a Solana address
            if (!contractAddress || contractAddress.length < 32) {
                console.warn('Invalid contract address format');
                return [];
            }

            // Get token data for the specific address
            const tokenData = await this.getTokenData(contractAddress);

            if (tokenData) {
                return [tokenData];
            } else {
                return [];
            }
        } catch (error) {
            console.error('Contract address search error:', (error as any)?.response?.data || (error as any)?.message || error);
            return [];
        }
    }

    private async fetchFromJupiter(tokenAddress: string): Promise<TokenData | null> {
        try {
            console.log(`Fetching token data from Jupiter for: ${tokenAddress}`);

            // Try Jupiter v6 API first, then fallback to v4
            let response;
            try {
                response = await axios.get(
                    `https://price.jup.ag/v6/price?ids=${tokenAddress}`,
                    { timeout: 10000 }
                );
            } catch (v6Error) {
                console.warn('Jupiter v6 failed, trying v4:', v6Error);
                response = await axios.get(
                    `https://price.jup.ag/v4/price?ids=${tokenAddress}`,
                    { timeout: 10000 }
                );
            }

            const data: JupiterPriceData = response.data;
            const tokenPrice = data.data[tokenAddress];

            if (!tokenPrice) {
                console.log('Token not found in Jupiter');
                return null;
            }

            // Try to get a better name/symbol from token list if available
            let tokenName = tokenPrice.mintSymbol || 'Unknown Token';
            let tokenSymbol = tokenPrice.mintSymbol || 'UNKNOWN';

            // For pump.fun tokens, try to extract better info
            if (tokenName === 'Unknown Token' || tokenName === 'UNKNOWN') {
                try {
                    // This is a basic approach - in production you might want to use
                    // a token list or metadata service
                    tokenName = `Token ${tokenAddress.slice(0, 8)}`;
                    tokenSymbol = tokenAddress.slice(0, 6).toUpperCase();
                } catch (e) {
                    // Keep defaults
                }
            }

            const result = {
                address: tokenAddress,
                name: tokenName,
                symbol: tokenSymbol,
                price: tokenPrice.price,
                market_cap: undefined, // Jupiter doesn't provide market cap
                last_updated: new Date(),
            };

            console.log('Jupiter token data processed:', result);
            return result;
        } catch (error) {
            console.error('Jupiter API error:', (error as any)?.response?.data || (error as any)?.message || error);
            return null;
        }
    }

    private async getCachedTokenData(tokenAddress: string): Promise<TokenData | null> {
        try {
            const result = await query(
                'SELECT * FROM token_data WHERE address = $1',
                [tokenAddress]
            );

            if (result.rows.length > 0) {
                return result.rows[0] as TokenData;
            }

            return null;
        } catch (error) {
            console.error('Error fetching cached token data:', error);
            return null;
        }
    }

    private async updateTokenCache(tokenData: TokenData): Promise<void> {
        try {
            await query(
                `INSERT INTO token_data (address, name, symbol, price, market_cap, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (address) 
         DO UPDATE SET 
           name = EXCLUDED.name,
           symbol = EXCLUDED.symbol,
           price = EXCLUDED.price,
           market_cap = EXCLUDED.market_cap,
           last_updated = EXCLUDED.last_updated`,
                [
                    tokenData.address,
                    tokenData.name,
                    tokenData.symbol,
                    tokenData.price,
                    tokenData.market_cap,
                    tokenData.last_updated,
                ]
            );
        } catch (error) {
            console.error('Error updating token cache:', error);
        }
    }

    private isCacheValid(lastUpdated: Date): boolean {
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
        const now = new Date();
        return (now.getTime() - new Date(lastUpdated).getTime()) < CACHE_DURATION;
    }

    async validateTokenAddress(tokenAddress: string): Promise<boolean> {
        try {
            // Enhanced Solana address validation
            if (!tokenAddress || typeof tokenAddress !== 'string') {
                return false;
            }

            // Remove whitespace
            tokenAddress = tokenAddress.trim();

            // Basic Solana address validation (32-44 characters, base58)
            if (tokenAddress.length < 32 || tokenAddress.length > 44) {
                return false;
            }

            // Check for valid base58 characters
            const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
            if (!base58Regex.test(tokenAddress)) {
                return false;
            }

            // Try to fetch token data to validate it exists
            console.log(`Validating token address: ${tokenAddress}`);
            const tokenData = await this.getTokenData(tokenAddress);
            const isValid = tokenData !== null;

            console.log(`Token validation result for ${tokenAddress}: ${isValid}`);
            return isValid;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    async getMultipleTokenPrices(tokenAddresses: string[]): Promise<Map<string, number>> {
        const prices = new Map<string, number>();

        try {
            // Try Jupiter for batch pricing first
            const jupiterResponse = await axios.get(
                `https://price.jup.ag/v4/price?ids=${tokenAddresses.join(',')}`
            );

            const data: JupiterPriceData = jupiterResponse.data;

            for (const address of tokenAddresses) {
                if (data.data[address]) {
                    prices.set(address, data.data[address].price);
                }
            }

            // For any missing prices, try individual Moralis calls
            for (const address of tokenAddresses) {
                if (!prices.has(address)) {
                    const tokenData = await this.fetchFromMoralis(address);
                    if (tokenData) {
                        prices.set(address, tokenData.price);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching multiple token prices:', error);

            // Fallback to individual calls
            for (const address of tokenAddresses) {
                try {
                    const tokenData = await this.getTokenData(address);
                    if (tokenData) {
                        prices.set(address, tokenData.price);
                    }
                } catch (err) {
                    console.error(`Error fetching price for ${address}:`, err);
                }
            }
        }

        return prices;
    }

    async getTokenPairs(tokenAddress: string): Promise<TokenPairsResponse | null> {
        try {
            if (!MORALIS_API_KEY) {
                console.warn('Moralis API key not configured, skipping pairs fetch...');
                return null;
            }

            console.log(`Fetching token pairs from Moralis for: ${tokenAddress}`);

            const response = await axios.get(
                `${SOLANA_GATEWAY_URL}/token/${SOLANA_CHAIN}/${tokenAddress}/pairs`,
                {
                    headers: {
                        'X-API-Key': MORALIS_API_KEY,
                        'accept': 'application/json',
                    },
                    params: {
                        limit: 10 // Limit to 10 pairs for better performance
                    },
                    timeout: 15000,
                }
            );

            console.log('Moralis pairs response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Moralis pairs API error:', {
                message: (error as any)?.message,
                status: (error as any)?.response?.status,
                statusText: (error as any)?.response?.statusText,
                data: (error as any)?.response?.data,
                url: (error as any)?.config?.url
            });
            return null;
        }
    }

    async getTokenMetadata(address: string): Promise<TokenMetadata> {
        const response = await fetch(
            `https://solana-gateway.moralis.io/token/mainnet/${address}/metadata`,
            {
                headers: {
                    'X-API-Key': process.env.MORALIS_API_KEY || ''
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch token metadata: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }

    async getTokenAnalytics(address: string): Promise<TokenAnalytics> {
        const response = await fetch(
            `https://deep-index.moralis.io/api/v2.2/tokens/${address}/analytics?chain=solana`,
            {
                headers: {
                    'X-API-Key': process.env.MORALIS_API_KEY || ''
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch token analytics: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }

    async getPairStats(pairAddress: string): Promise<TokenPairStats> {
        const response = await fetch(
            `https://solana-gateway.moralis.io/token/mainnet/pairs/${pairAddress}/stats`,
            {
                headers: {
                    'X-API-Key': process.env.MORALIS_API_KEY || ''
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch pair stats: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }
} 