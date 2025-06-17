'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiService, TokenAlert, TokenMetadata, TokenAnalytics } from '../../services/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import CreateAlertForm from '../../components/CreateAlertForm';
import AlertsList from '../../components/AlertsList';

interface TrendingTokenData {
    address: string;
    name: string;
    symbol: string;
    price: number | string;
    logo?: string;
    metadata?: TokenMetadata;
    analytics?: TokenAnalytics;
    // Calculated from analytics
    age: string;
    txns: number;
    volume: number;
    makers: number;
    changes: {
        '5m': number;
        '1h': number;
        '6h': number;
        '24h': number;
    };
    liquidity: number;
    marketCap: number;
}

const TRENDING_TOKENS = [
    'DtR4D9FtVoTX2569gaL837ZgrB6wNjj6tkmnX9Rdk9B2',
    'Dz9mQ9NzkBcCsuGPFJ3r1bS4wgqKMHBPiVuniW8Mbonk',
    '6MQpbiTC2YcogidTmKqMLK82qvE9z5QEm7EP3AEDpump',
    'JB2wezZLdzWfnaCfHxLg193RS3Rh51ThiXxEDWQDpump',
    '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump'
];

export default function Dashboard() {
    const { isAuthenticated, user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [alerts, setAlerts] = useState<TokenAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [prefilledTokenAddress, setPrefilledTokenAddress] = useState<string>('');
    const [trendingTokens, setTrendingTokens] = useState<TrendingTokenData[]>([]);
    const [isLoadingTrending, setIsLoadingTrending] = useState(true);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }

        if (isAuthenticated) {
            loadAlerts();
            loadTrendingTokens();

            // Check for create_alert query parameter
            const createAlert = searchParams.get('create_alert');
            if (createAlert) {
                setPrefilledTokenAddress(createAlert);
                setShowCreateForm(true);
                // Clear the query parameter
                router.replace('/dashboard');
            }
        }
    }, [isAuthenticated, authLoading, router, searchParams]);

    const loadAlerts = async () => {
        try {
            setIsLoading(true);
            const response = await apiService.getAlerts();
            if (response.success && response.data) {
                setAlerts(response.data);
            }
        } catch (error: any) {
            console.error('Error loading alerts:', error);
            toast.error(error.error || 'Failed to load alerts');
        } finally {
            setIsLoading(false);
        }
    };

    const loadTrendingTokens = async () => {
        try {
            setIsLoadingTrending(true);
            const trendingData: TrendingTokenData[] = [];

            for (const address of TRENDING_TOKENS) {
                try {
                    // Fetch token data, metadata, and analytics in parallel
                    const [tokenResponse, metadataResponse, analyticsResponse] = await Promise.allSettled([
                        apiService.searchTokens(address),
                        apiService.getTokenMetadata(address),
                        apiService.getTokenAnalytics(address)
                    ]);

                    let tokenData = null;
                    let metadata = null;
                    let analytics = null;

                    if (tokenResponse.status === 'fulfilled' && tokenResponse.value.success && tokenResponse.value.data?.[0]) {
                        tokenData = tokenResponse.value.data[0];
                    }

                    if (metadataResponse.status === 'fulfilled' && metadataResponse.value.success && metadataResponse.value.data) {
                        metadata = metadataResponse.value.data;
                    }

                    if (analyticsResponse.status === 'fulfilled' && analyticsResponse.value.success && analyticsResponse.value.data) {
                        analytics = analyticsResponse.value.data;
                    }

                    if (tokenData) {
                        // Use real analytics data or fallback to placeholder values
                        const realData: TrendingTokenData = {
                            address,
                            name: tokenData.name,
                            symbol: tokenData.symbol,
                            price: tokenData.price,
                            logo: metadata?.logo,
                            metadata: metadata || undefined,
                            analytics: analytics || undefined,
                            age: generateTokenAge(), // Still need to calculate this from creation date
                            txns: analytics ? analytics.totalBuys['24h'] + analytics.totalSells['24h'] : Math.floor(Math.random() * 100000) + 1000,
                            volume: analytics ? analytics.totalBuyVolume['24h'] + analytics.totalSellVolume['24h'] : Math.floor(Math.random() * 10000000) + 100000,
                            makers: analytics ? analytics.uniqueWallets['24h'] : Math.floor(Math.random() * 50000) + 1000,
                            changes: {
                                '5m': analytics?.pricePercentChange['5m'] || (Math.random() - 0.5) * 20,
                                '1h': analytics?.pricePercentChange['1h'] || (Math.random() - 0.5) * 30,
                                '6h': analytics?.pricePercentChange['6h'] || (Math.random() - 0.5) * 50,
                                '24h': analytics?.pricePercentChange['24h'] || (Math.random() - 0.5) * 100
                            },
                            liquidity: analytics ? parseFloat(analytics.totalLiquidityUsd) : Math.floor(Math.random() * 1000000) + 50000,
                            marketCap: analytics ?
                                parseFloat(analytics.totalFullyDilutedValuation) :
                                (metadata ?
                                    parseFloat(metadata.totalSupplyFormatted) * (typeof tokenData.price === 'string' ? parseFloat(tokenData.price) : tokenData.price) :
                                    Math.floor(Math.random() * 50000000) + 1000000)
                        };

                        trendingData.push(realData);
                    }
                } catch (error) {
                    console.error(`Error loading token ${address}:`, error);
                }
            }

            setTrendingTokens(trendingData);
        } catch (error) {
            console.error('Error loading trending tokens:', error);
        } finally {
            setIsLoadingTrending(false);
        }
    };

    const generateTokenAge = () => {
        // This would need to be calculated from token creation date
        // For now, using random values as placeholder
        const units = ['m', 'h', 'd'];
        const unit = units[Math.floor(Math.random() * units.length)];
        const value = Math.floor(Math.random() * 100) + 1;
        return `${value}${unit}`;
    };

    const formatPrice = (price: number | string | null | undefined) => {
        // Handle all possible input types
        if (price === null || price === undefined) return '0.0000';

        let numPrice: number;
        if (typeof price === 'string') {
            numPrice = parseFloat(price);
        } else if (typeof price === 'number') {
            numPrice = price;
        } else {
            return '0.0000';
        }

        if (isNaN(numPrice) || numPrice <= 0) return '0.0000';
        if (numPrice < 0.000001) return numPrice.toExponential(2);
        if (numPrice < 0.01) return numPrice.toFixed(6);
        return numPrice.toFixed(4);
    };

    const formatLargeNumber = (num: number | string | null | undefined) => {
        const numValue = typeof num === 'string' ? parseFloat(num) : (num || 0);
        if (!numValue || isNaN(numValue)) return '$0';
        if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`;
        if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`;
        if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(0)}K`;
        return `$${numValue.toFixed(0)}`;
    };

    const formatChange = (change: number) => {
        const formatted = Math.abs(change).toFixed(1);
        return change >= 0 ? `+${formatted}%` : `-${formatted}%`;
    };

    const handleAlertCreated = (newAlert: TokenAlert) => {
        setAlerts(prev => [newAlert, ...prev]);
        setShowCreateForm(false);
        toast.success('Alert created successfully!');
    };

    const handleAlertUpdated = (updatedAlert: TokenAlert) => {
        setAlerts(prev =>
            prev.map(alert =>
                alert.id === updatedAlert.id ? updatedAlert : alert
            )
        );
    };

    const handleAlertDeleted = (alertId: string) => {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    };

    if (authLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="card-elevated">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
                            <p className="text-gray-400 mt-1">
                                Welcome back, {user?.walletAddress?.slice(0, 4)}...{user?.walletAddress?.slice(-4)}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <Link
                                href="/search"
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span>Search Tokens</span>
                            </Link>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="btn-primary flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Create Alert</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-800/50 rounded-lg flex items-center justify-center border border-primary-700/50">
                                <span className="text-primary-300 text-sm font-semibold">
                                    {alerts.filter(a => a.is_active).length}
                                </span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Active Alerts</p>
                                <p className="text-lg font-semibold text-gray-200">
                                    {alerts.filter(a => a.is_active).length} / {alerts.length}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-accent-800/50 rounded-lg flex items-center justify-center border border-accent-700/50">
                                <span className="text-accent-300 text-sm font-semibold">
                                    {alerts.filter(a => a.is_triggered).length}
                                </span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Triggered</p>
                                <p className="text-lg font-semibold text-gray-200">
                                    {alerts.filter(a => a.is_triggered).length}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-800/50 rounded-lg flex items-center justify-center border border-primary-700/50">
                                <span className="text-primary-300 text-sm font-semibold">
                                    {new Set(alerts.map(a => a.token_address)).size}
                                </span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Unique Tokens</p>
                                <p className="text-lg font-semibold text-gray-200">
                                    {new Set(alerts.map(a => a.token_address)).size}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerts List */}
                <div className="card-elevated">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-gray-100">Your Alerts</h2>
                        {alerts.length > 0 && (
                            <button
                                onClick={loadAlerts}
                                className="btn-secondary text-sm flex items-center space-x-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="spinner w-3 h-3"></div>
                                        <span>Refreshing...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Refresh</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <AlertsList
                        alerts={alerts}
                        isLoading={isLoading}
                        onAlertUpdated={handleAlertUpdated}
                        onAlertDeleted={handleAlertDeleted}
                    />
                </div>

                {/* Trending Tokens */}
                <div className="card-elevated">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-gray-100">Trending Tokens</h2>
                        <button
                            onClick={loadTrendingTokens}
                            className="btn-secondary text-sm flex items-center space-x-2"
                            disabled={isLoadingTrending}
                        >
                            {isLoadingTrending ? (
                                <>
                                    <div className="spinner w-3 h-3"></div>
                                    <span>Loading...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Refresh</span>
                                </>
                            )}
                        </button>
                    </div>

                    {isLoadingTrending ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="spinner w-6 h-6 mr-3"></div>
                            <span className="text-gray-400">Loading trending tokens...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                                        <th className="text-center py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Age</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Txns</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Volume</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Makers</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">5m</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">1h</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">6h</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">24h</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Liquidity</th>
                                        <th className="text-right py-3 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider">MCap</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {trendingTokens.map((token, index) => (
                                        <tr key={token.address} className="hover:bg-gray-800/50 transition-colors">
                                            {/* Token Info */}
                                            <td className="py-3 px-2">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-xs text-gray-500 w-4">{index + 1}</span>
                                                    {token.logo ? (
                                                        <img
                                                            src={token.logo}
                                                            alt={token.symbol}
                                                            className="w-6 h-6 rounded-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
                                                            <span className="text-xs text-gray-300">{token.symbol.charAt(0)}</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-100">{token.symbol}</div>
                                                        <div className="text-xs text-gray-500 truncate max-w-24">{token.name}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="py-3 px-2 text-right">
                                                <span className="text-sm text-gray-100">${formatPrice(token.price)}</span>
                                            </td>

                                            {/* Age */}
                                            <td className="py-3 px-2 text-center">
                                                <span className="text-xs text-gray-400">{token.age}</span>
                                            </td>

                                            {/* Transactions */}
                                            <td className="py-3 px-2 text-right">
                                                <span className="text-xs text-gray-300">{token.txns.toLocaleString()}</span>
                                            </td>

                                            {/* Volume */}
                                            <td className="py-3 px-2 text-right">
                                                <span className="text-xs text-gray-300">{formatLargeNumber(token.volume)}</span>
                                            </td>

                                            {/* Makers */}
                                            <td className="py-3 px-2 text-right">
                                                <span className="text-xs text-gray-300">{token.makers.toLocaleString()}</span>
                                            </td>

                                            {/* 5m Change */}
                                            <td className="py-3 px-2 text-right">
                                                <span className={`text-xs font-medium ${token.changes['5m'] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatChange(token.changes['5m'])}
                                                </span>
                                            </td>

                                            {/* 1h Change */}
                                            <td className="py-3 px-2 text-right">
                                                <span className={`text-xs font-medium ${token.changes['1h'] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatChange(token.changes['1h'])}
                                                </span>
                                            </td>

                                            {/* 6h Change */}
                                            <td className="py-3 px-2 text-right">
                                                <span className={`text-xs font-medium ${token.changes['6h'] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatChange(token.changes['6h'])}
                                                </span>
                                            </td>

                                            {/* 24h Change */}
                                            <td className="py-3 px-2 text-right">
                                                <span className={`text-xs font-medium ${token.changes['24h'] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatChange(token.changes['24h'])}
                                                </span>
                                            </td>

                                            {/* Liquidity */}
                                            <td className="py-3 px-2 text-right">
                                                <span className="text-xs text-gray-300">{formatLargeNumber(token.liquidity)}</span>
                                            </td>

                                            {/* Market Cap */}
                                            <td className="py-3 px-2 text-right">
                                                <span className="text-xs text-gray-300">{formatLargeNumber(token.marketCap)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {trendingTokens.length === 0 && !isLoadingTrending && (
                                <div className="text-center py-12 text-gray-400">
                                    No trending tokens available
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Alert Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-100">Create New Alert</h2>
                                <button
                                    onClick={() => setShowCreateForm(false)}
                                    className="text-gray-400 hover:text-gray-200 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <CreateAlertForm
                                onAlertCreated={handleAlertCreated}
                                onCancel={() => setShowCreateForm(false)}
                                prefilledTokenAddress={prefilledTokenAddress}
                            />
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
} 