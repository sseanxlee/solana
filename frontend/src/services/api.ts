import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

console.log('API Service initialized with base URL:', API_BASE_URL);

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
    notification_type: 'email' | 'telegram';
    is_active: boolean;
    is_triggered: boolean;
    triggered_at?: string;
    created_at: string;
    updated_at: string;
}

interface CreateAlertRequest {
    tokenAddress: string;
    thresholdType: 'price' | 'market_cap';
    thresholdValue: number;
    condition: 'above' | 'below';
    notificationType: 'email' | 'telegram';
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

    async searchTokens(query: string): Promise<ApiResponse<{
        address: string;
        name: string;
        symbol: string;
        price: number;
        market_cap?: number;
        last_updated?: string;
    }[]>> {
        return this.request('GET', `/tokens/search?query=${encodeURIComponent(query)}`);
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

    // Profile endpoints
    async updateProfile(data: {
        email?: string;
        telegramChatId?: string;
    }): Promise<ApiResponse> {
        return this.request('PUT', '/profile', data);
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

    async forceCheck(tokenAddress?: string): Promise<ApiResponse<{
        alertsChecked: number;
    }>> {
        return this.request('POST', '/admin/force-check', { tokenAddress });
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
    TokenMetadata,
    TokenAnalytics
}; 