import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Legacy Moralis API Configuration (Deprecated - use backend endpoints instead)
const MORALIS_API_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
const USE_MORALIS_SEARCH = process.env.NEXT_PUBLIC_USE_MORALIS_SEARCH === 'true' || false;

console.log('API Service initialized with base URL:', API_BASE_URL);
console.log('Moralis integration status:', USE_MORALIS_SEARCH ? 'ENABLED' : 'DISABLED');

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

interface TokenAlert {
    id: string;
    user_id: string;
    token_address: string;
    token_name?: string;
    token_symbol?: string;
    threshold_type: 'price' | 'market_cap';
    threshold_value: number;
    condition: 'above' | 'below';
    notification_type: 'email' | 'telegram' | 'discord';
    is_active: boolean;
    is_triggered: boolean;
    triggered_at?: string;
    cleared_at?: string;
    created_at: string;
    updated_at: string;
}

interface CreateAlertRequest {
    tokenAddress: string;
    thresholdType: 'price' | 'market_cap';
    thresholdValue: number;
    condition: 'above' | 'below';
    notificationType: 'email' | 'telegram' | 'discord';
}

interface UpdateAlertRequest {
    thresholdValue?: number;
    condition?: 'above' | 'below';
    isActive?: boolean;
}

interface SignInRequest {
    walletAddress: string;
    signature: string;
    message: string;
}

interface AuthResponse {
    token: string;
    user: {
        id: string;
        walletAddress: string;
        email?: string;
        telegramChatId?: string;
        discordUserId?: string;
    };
}

interface NonceResponse {
    message: string;
    nonce: string;
}

interface TokenPair {
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenLogo: string;
    tokenDecimals: string;
    pairTokenType: string;
    liquidityUsd: number;
}

interface TokenPairData {
    exchangeAddress: string;
    exchangeName: string;
    exchangeLogo: string;
    pairLabel: string;
    pairAddress: string;
    usdPrice: number;
    usdPrice24hrPercentChange: number;
    usdPrice24hrUsdChange: number;
    liquidityUsd: number;
    baseToken: string;
    quoteToken: string;
    pair: TokenPair[];
}

interface TokenPairsResponse {
    cursor?: string;
    pageSize: number;
    page: number;
    pairs: TokenPairData[];
}

export interface TokenMetadata {
    name: string;
    symbol: string;
    decimals: number;
    logo?: string;
    totalSupply: string;
    totalSupplyFormatted: string;
    fullyDilutedValue?: string;
    links?: {
        website?: string;
        twitter?: string;
        telegram?: string;
        reddit?: string;
        moralis?: string;
    };
    description?: string;
    isVerifiedContract?: boolean;
    possibleSpam?: boolean;
}

export interface TokenAnalytics {
    tokenAddress: string;
    totalBuyVolume: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalSellVolume: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalBuyers: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalSellers: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalBuys: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    totalSells: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    uniqueWallets: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    pricePercentChange: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    usdPrice: string;
    totalLiquidityUsd: string;
    totalFullyDilutedValuation: string;
}

export interface TokenPairStats {
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenLogo: string;
    pairCreated: string | null;
    pairLabel: string;
    pairAddress: string;
    exchange: string;
    exchangeAddress: string;
    exchangeLogo: string;
    exchangeUrl: string | null;
    currentUsdPrice: string;
    currentNativePrice: string;
    totalLiquidityUsd: string;
    pricePercentChange: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    liquidityPercentChange: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    buys: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    sells: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    totalVolume: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    buyVolume: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    sellVolume: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    buyers: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
    sellers: {
        '5min': number;
        '1h': number;
        '4h': number;
        '24h': number;
    };
}

// Moralis API Interfaces (Premium Feature)
interface MoralisTokenResult {
    tokenAddress: string;
    chainId: string;
    name: string;
    symbol: string;
    blockNumber: number;
    blockTimestamp: number;
    usdPrice: number;
    marketCap: number;
    experiencedNetBuyers?: {
        oneDay: number;
        oneWeek: number;
    };
    netVolumeUsd?: {
        oneDay: number;
    };
    liquidityChangeUSD?: {
        oneDay: number;
    };
    usdPricePercentChange?: {
        oneDay: number;
    };
    volumeUsd?: {
        oneDay: number;
    };
    securityScore?: number;
    logo?: string;
    isVerifiedContract?: boolean;
}

interface MoralisSearchResponse {
    total: number;
    result: MoralisTokenResult[];
}

interface MoralisSearchParams {
    query: string;
    chains?: string;
    limit?: number;
    isVerifiedContract?: boolean;
    sortBy?: 'volume1hDesc' | 'volume24hDesc' | 'liquidityDesc' | 'marketCapDesc';
    boostVerifiedContracts?: boolean;
}

// Standard token data interface
export interface TokenData {
    address: string;
    name: string;
    symbol: string;
    price: number;
    market_cap?: number;
    last_updated?: string;
    logo?: string;
}

class ApiService {
    private authToken: string | null = null;

    constructor() {
        // Set up axios interceptors
        axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    // Handle unauthorized - clear auth and redirect
                    this.setAuthToken(null);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_user');
                        window.location.href = '/';
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    setAuthToken(token: string | null) {
        this.authToken = token;
    }

    private getHeaders() {
        const headers: any = {
            'Content-Type': 'application/json',
        };

        if (this.authToken) {
            headers.Authorization = `Bearer ${this.authToken}`;
        }

        return headers;
    }

    private async request<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        endpoint: string,
        data?: any
    ): Promise<ApiResponse<T>> {
        try {
            const fullUrl = `${API_BASE_URL}${endpoint}`;
            console.log(`API: ${method} ${fullUrl}`, data ? { data } : '');

            const response: AxiosResponse<ApiResponse<T>> = await axios({
                method,
                url: fullUrl,
                data,
                headers: this.getHeaders(),
                timeout: 10000, // 10 second timeout
            });

            console.log(`API: ${method} ${fullUrl} - Success:`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`API: ${method} ${endpoint} - Error:`, error);

            if (error.response?.data) {
                console.error('API: Error response data:', error.response.data);
                throw error.response.data;
            }

            if (error.code === 'ECONNREFUSED') {
                throw {
                    success: false,
                    error: 'Unable to connect to server. Please check if the backend is running.'
                };
            }

            if (error.code === 'ECONNABORTED') {
                throw {
                    success: false,
                    error: 'Request timeout. Please try again.'
                };
            }

            throw {
                success: false,
                error: error.message || 'Network error occurred'
            };
        }
    }

    // Auth endpoints
    async getNonce(walletAddress: string): Promise<ApiResponse<NonceResponse>> {
        return this.request<NonceResponse>('GET', `/auth/nonce?walletAddress=${walletAddress}`);
    }

    async signIn(data: SignInRequest): Promise<ApiResponse<AuthResponse>> {
        return this.request<AuthResponse>('POST', '/auth/signin', data);
    }

    async getCurrentUser(): Promise<ApiResponse<AuthResponse['user']>> {
        return this.request<AuthResponse['user']>('GET', '/auth/me');
    }

    // Alert endpoints
    async getAlerts(): Promise<ApiResponse<TokenAlert[]>> {
        return this.request<TokenAlert[]>('GET', '/alerts');
    }

    async createAlert(data: CreateAlertRequest): Promise<ApiResponse<TokenAlert>> {
        return this.request<TokenAlert>('POST', '/alerts', data);
    }

    async updateAlert(id: string, data: UpdateAlertRequest): Promise<ApiResponse<TokenAlert>> {
        return this.request<TokenAlert>('PUT', `/alerts/${id}`, data);
    }

    async deleteAlert(id: string): Promise<ApiResponse> {
        return this.request('DELETE', `/alerts/${id}`);
    }

    async testAlert(id: string): Promise<ApiResponse> {
        return this.request('POST', `/alerts/${id}/test`);
    }

    // Token endpoints
    async validateToken(tokenAddress: string): Promise<ApiResponse<{ isValid: boolean }>> {
        return this.request('GET', `/tokens/validate?address=${tokenAddress}`);
    }

    async getTokenData(tokenAddress: string): Promise<ApiResponse<{
        address: string;
        name: string;
        symbol: string;
        price: number;
        market_cap?: number;
        last_updated?: string;
    }>> {
        return this.request('GET', `/tokens/${tokenAddress}`);
    }

    async getTokenMarketData(tokenAddress: string): Promise<ApiResponse<{
        address: string;
        price: number;
        liquidity: number;
        total_supply: number;
        circulating_supply: number;
        fdv: number;
        market_cap: number;
    }>> {
        return this.request('GET', `/tokens/${tokenAddress}/market-data`);
    }

    async searchTokens(query: string): Promise<ApiResponse<TokenData[]>> {
        if (USE_MORALIS_SEARCH) {
            console.log('Using Moralis API for token search');
            return this.searchTokensMoralis({
                query,
                chains: 'solana',
                limit: 10,
                isVerifiedContract: true,
                sortBy: 'volume24hDesc',
                boostVerifiedContracts: true
            });
        } else {
            console.log('Using legacy API for token search');
            // Use the existing legacy API
            const response = await this.request<{
                address: string;
                name: string;
                symbol: string;
                price: number;
                market_cap?: number;
                last_updated?: string;
            }[]>('GET', `/tokens/search?query=${encodeURIComponent(query)}`);

            if (response.success && response.data) {
                const mappedData: TokenData[] = response.data.map(token => ({
                    address: token.address,
                    name: token.name,
                    symbol: token.symbol,
                    price: token.price,
                    market_cap: token.market_cap,
                    last_updated: token.last_updated,
                    logo: undefined // Legacy API doesn't provide logos
                }));

                return {
                    ...response,
                    data: mappedData
                };
            }

            return response as ApiResponse<TokenData[]>;
        }
    }

    async getTokenPairs(tokenAddress: string): Promise<ApiResponse<TokenPairsResponse>> {
        return this.request('GET', `/tokens/${tokenAddress}/pairs`);
    }

    async getTokenMetadata(tokenAddress: string): Promise<ApiResponse<TokenMetadata>> {
        return this.request('GET', `/tokens/${tokenAddress}/metadata`);
    }

    async getTokenAnalytics(tokenAddress: string): Promise<ApiResponse<TokenAnalytics>> {
        const response = await fetch(`${API_BASE_URL}/tokens/${tokenAddress}/analytics`);
        return response.json();
    }

    async getPairStats(pairAddress: string): Promise<ApiResponse<TokenPairStats>> {
        const response = await fetch(`${API_BASE_URL}/tokens/pairs/${pairAddress}/stats`);
        return response.json();
    }

    // Profile endpoints
    async updateProfile(data: {
        email?: string;
        telegramChatId?: string;
    }): Promise<ApiResponse> {
        return this.request('PUT', '/profile', data);
    }

    // Discord linking
    async linkDiscord(discordUserId: string): Promise<ApiResponse> {
        return this.request('POST', '/auth/link-discord', { discordUserId });
    }

    async getDiscordLinkingStatus(): Promise<ApiResponse<{ isLinked: boolean; discordUserId?: string }>> {
        return this.request('GET', '/auth/discord-status');
    }

    async getDiscordTokenInfo(token: string): Promise<ApiResponse<{
        discordUsername: string;
        discordUserId: string;
        isExpired: boolean;
        isUsed: boolean;
    }>> {
        return this.request('GET', `/auth/discord/token-info/${token}`);
    }

    async linkDiscordWithToken(linkingToken: string): Promise<ApiResponse<{
        discordUsername: string;
    }>> {
        return this.request('POST', '/auth/discord/link-with-token', { linkingToken });
    }

    // Admin endpoints
    async getStats(): Promise<ApiResponse<{
        totalAlerts: number;
        activeAlerts: number;
        triggeredAlerts: number;
        uniqueTokens: number;
        lastCheckTime: string;
    }>> {
        return this.request('GET', '/admin/stats');
    }

    async getMonitoringStatus(): Promise<ApiResponse<{
        system: {
            totalActiveAlerts: number;
            uniqueTokens: number;
            botRunning: boolean;
        };
        user: {
            activeAlerts: number;
            tokens: Array<{
                token_address: string;
                token_name: string;
                token_symbol: string;
            }>;
        };
    }>> {
        return this.request('GET', '/alerts/monitoring/status');
    }

    async forceCheck(tokenAddress?: string): Promise<ApiResponse<{
        alertsChecked: number;
    }>> {
        return this.request('POST', '/admin/force-check', { tokenAddress });
    }

    // Moralis API Methods (Premium Feature)
    private mapMoralisToTokenData(moralisToken: MoralisTokenResult): TokenData {
        return {
            address: moralisToken.tokenAddress,
            name: moralisToken.name,
            symbol: moralisToken.symbol,
            price: moralisToken.usdPrice || 0,
            market_cap: moralisToken.marketCap,
            last_updated: new Date(moralisToken.blockTimestamp * 1000).toISOString(),
            logo: moralisToken.logo
        };
    }

    private async searchTokensMoralis(params: MoralisSearchParams): Promise<ApiResponse<TokenData[]>> {
        try {
            if (!MORALIS_API_KEY) {
                return {
                    success: false,
                    error: 'Moralis API key not configured'
                };
            }

            const searchParams = new URLSearchParams({
                query: params.query,
                chains: params.chains || 'solana',
                limit: (params.limit || 10).toString(),
                ...(params.isVerifiedContract !== undefined && { isVerifiedContract: params.isVerifiedContract.toString() }),
                ...(params.sortBy && { sortBy: params.sortBy }),
                ...(params.boostVerifiedContracts !== undefined && { boostVerifiedContracts: params.boostVerifiedContracts.toString() })
            });

            const url = `https://deep-index.moralis.io/api/v2.2/tokens/search?${searchParams.toString()}`;

            console.log('Moralis API: Searching tokens with query:', params.query);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'X-API-Key': MORALIS_API_KEY
                }
            });

            if (!response.ok) {
                throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
            }

            const moralisResponse: MoralisSearchResponse = await response.json();
            console.log('Moralis API: Search results:', moralisResponse);

            const mappedTokens = moralisResponse.result.map(token => this.mapMoralisToTokenData(token));

            return {
                success: true,
                data: mappedTokens
            };
        } catch (error: any) {
            console.error('Moralis API: Search error:', error);
            return {
                success: false,
                error: error.message || 'Failed to search tokens with Moralis API'
            };
        }
    }
}

export const apiService = new ApiService();
export type {
    TokenAlert,
    CreateAlertRequest,
    UpdateAlertRequest,
    ApiResponse,
    TokenPair,
    TokenPairData,
    TokenPairsResponse,
    MoralisTokenResult,
    MoralisSearchResponse,
    MoralisSearchParams
}; 