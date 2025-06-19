'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { apiService, TokenPairsResponse, TokenMetadata } from '../../services/api';
import { toast } from 'react-hot-toast';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/DashboardLayout';
import { PriceChartWidget } from '../../components/PriceChartWidget';

interface TokenData {
    address: string;
    name: string;
    symbol: string;
    price: number;
    market_cap?: number;
    last_updated?: string;
    logo?: string;
}

function WatchlistContent() {
    const { isAuthenticated, user, isLoading: authLoading, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tokenData, setTokenData] = useState<TokenData | null>(null);
    const [tokenPairs, setTokenPairs] = useState<TokenPairsResponse | null>(null);
    const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);
    const [isLoadingToken, setIsLoadingToken] = useState(false);
    const [isLoadingPairs, setIsLoadingPairs] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }

        // Check for token parameter in URL
        const tokenAddress = searchParams.get('token');
        if (tokenAddress) {
            loadTokenData(tokenAddress);
        }
    }, [isAuthenticated, authLoading, router, searchParams]);

    const loadTokenData = async (tokenAddress: string) => {
        try {
            setIsLoadingToken(true);
            setTokenData(null);
            setTokenPairs(null);
            setTokenMetadata(null);

            const response = await apiService.searchTokens(tokenAddress);

            if (response.success && response.data && response.data.length > 0) {
                const tokenResult = response.data[0];
                setTokenData(tokenResult);

                // Fetch pairs and metadata data in parallel
                fetchTokenPairs(tokenAddress);
                fetchTokenMetadata(tokenAddress);
            } else {
                toast.error('Token not found');
            }
        } catch (error: any) {
            console.error('Error loading token:', error);
            toast.error(error.error || 'Failed to fetch token data');
        } finally {
            setIsLoadingToken(false);
        }
    };

    const fetchTokenPairs = async (tokenAddress: string) => {
        try {
            setIsLoadingPairs(true);
            const pairsResponse = await apiService.getTokenPairs(tokenAddress);

            if (pairsResponse.success && pairsResponse.data) {
                setTokenPairs(pairsResponse.data);
            } else {
                console.log('No pairs data available for this token');
                setTokenPairs(null);
            }
        } catch (error: any) {
            console.error('Error fetching pairs:', error);
            setTokenPairs(null);
        } finally {
            setIsLoadingPairs(false);
        }
    };

    const fetchTokenMetadata = async (tokenAddress: string) => {
        try {
            setIsLoadingMetadata(true);
            const metadataResponse = await apiService.getTokenMetadata(tokenAddress);

            if (metadataResponse.success && metadataResponse.data) {
                setTokenMetadata(metadataResponse.data);
            } else {
                console.log('No metadata available for this token');
                setTokenMetadata(null);
            }
        } catch (error: any) {
            console.error('Error fetching metadata:', error);
            setTokenMetadata(null);
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    const getCurrentPrice = () => {
        // Use highest liquidity pair's price if available
        if (tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0) {
            const sortedPairs = [...tokenPairs.pairs].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
            return sortedPairs[0].usdPrice;
        }

        // Fallback to token data price
        return tokenData?.price || 0;
    };

    const calculateMarketCap = () => {
        if (!tokenMetadata) return 0;

        const supply = parseFloat(tokenMetadata.totalSupplyFormatted);
        const currentPrice = getCurrentPrice();

        return supply * currentPrice;
    };

    const formatPrice = (price: number) => {
        if (!price || typeof price !== 'number' || isNaN(price)) {
            return '0.0000';
        }
        if (price < 0.000001) {
            return price.toExponential(4);
        }
        return price < 0.01 ? price.toFixed(6) : price.toFixed(4);
    };

    const formatMarketCap = (marketCap: number) => {
        if (!marketCap || typeof marketCap !== 'number' || isNaN(marketCap)) {
            return '$0.00';
        }
        if (marketCap >= 1e9) {
            return `$${(marketCap / 1e9).toFixed(2)}B`;
        } else if (marketCap >= 1e6) {
            return `$${(marketCap / 1e6).toFixed(2)}M`;
        } else if (marketCap >= 1e3) {
            return `$${(marketCap / 1e3).toFixed(2)}K`;
        }
        return `$${marketCap.toFixed(2)}`;
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    {tokenData ? (
                        <>
                            <h1 className="text-base font-normal text-white mb-2">Token Information</h1>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold text-white mb-2">Token Search</h1>
                            <p className="text-slate-400">Search for Solana tokens by contract address</p>
                        </>
                    )}
                </div>

                {/* Instructions when no token is selected */}
                {!tokenData && !isLoadingToken && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
                        <div className="text-center">
                            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <h3 className="text-lg font-semibold text-slate-200 mb-2">Search for Tokens</h3>
                            <p className="text-slate-400 mb-4">
                                Use the search bar in the sidebar to find and view detailed Solana token information including prices, market cap, trading pairs, and more.
                            </p>
                            <p className="text-slate-500 text-sm">
                                Enter a valid Solana token contract address to get started.
                            </p>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoadingToken && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                            <p className="text-slate-400">Loading token data...</p>
                        </div>
                    </div>
                )}

                {/* Side-by-side Layout: Price Chart (Left) + Token Info (Right) */}
                {tokenData && (
                    <div className="grid grid-cols-4 gap-6" style={{ height: '80vh' }}>
                        {/* Price Chart Widget - Left Side (3/4 width) */}
                        <div className="col-span-3 h-full">
                            <PriceChartWidget tokenAddress={tokenData.address} height="80vh" />
                        </div>
                        {/* Token Information Panel - Right Side (1/4 width) */}
                        <div className="col-span-1 h-full">
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-full flex flex-col">
                                {/* Token Header with Logo, Name and Social Links */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-4">
                                        {/* Token Logo */}
                                        {isLoadingMetadata ? (
                                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                            </div>
                                        ) : tokenMetadata?.logo ? (
                                            <img
                                                src={tokenMetadata.logo}
                                                alt={tokenData.name}
                                                className="w-12 h-12 rounded-full object-cover bg-slate-700"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                                                <span className="text-white text-lg font-bold">
                                                    {tokenData.symbol.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                        {/* Token Name and Symbol */}
                                        <div>
                                            <h2 className="text-xl font-bold text-white">{tokenData.name}</h2>
                                            <p className="text-slate-400">${tokenData.symbol}</p>
                                        </div>
                                    </div>
                                    {/* Social Links */}
                                    <div className="flex items-center space-x-3">
                                        <a
                                            href={`https://solscan.io/token/${tokenData.address}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                                        >
                                            Website
                                        </a>
                                        <a
                                            href={`https://solscan.io/token/${tokenData.address}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                                        >
                                            Twitter
                                        </a>
                                        {tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 && (
                                            <a
                                                href={`https://axiom.trade/meme/${tokenPairs.pairs[0].pairAddress}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                                            >
                                                Telegram
                                            </a>
                                        )}
                                    </div>
                                </div>
                                {/* Price Information */}
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <div className="text-slate-400 text-sm mb-1">PRICE USD</div>
                                        <div className="text-white text-2xl font-bold">
                                            {isLoadingPairs ? (
                                                <div className="flex items-center space-x-2">
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                                    <span className="text-lg">Loading...</span>
                                                </div>
                                            ) : (
                                                `$${formatPrice(getCurrentPrice())}`
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 text-sm mb-1">PRICE SOL</div>
                                        <div className="text-white text-2xl font-bold">
                                            {isLoadingPairs ? (
                                                "Loading..."
                                            ) : tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 ? (
                                                `${(getCurrentPrice() / 220).toFixed(6)} SOL`
                                            ) : (
                                                "N/A"
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">LIQUIDITY</div>
                                        <div className="text-white font-medium">
                                            {isLoadingPairs ? "..." : tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 ?
                                                formatMarketCap([...tokenPairs.pairs].sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0].liquidityUsd) :
                                                "N/A"
                                            }
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">FDV</div>
                                        <div className="text-white font-medium">{formatMarketCap(calculateMarketCap())}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">MKT CAP</div>
                                        <div className="text-white font-medium">{formatMarketCap(calculateMarketCap())}</div>
                                    </div>
                                </div>
                                {/* Time-based Performance */}
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">5M</div>
                                        <div className="text-green-400 font-medium">0.05%</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">1H</div>
                                        <div className="text-green-400 font-medium">1.67%</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">6H</div>
                                        <div className="text-green-400 font-medium">4.24%</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">24H</div>
                                        <div className="text-green-400 font-medium">30.61%</div>
                                    </div>
                                </div>
                                {/* Transaction Stats */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">TXNS</div>
                                        <div className="text-white font-medium">19,643</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">BUYS</div>
                                        <div className="text-green-400 font-medium">10,376</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">SELLS</div>
                                        <div className="text-red-400 font-medium">9,267</div>
                                    </div>
                                </div>
                                {/* Volume Stats */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">VOLUME</div>
                                        <div className="text-white font-medium">$19.2M</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">BUY VOL</div>
                                        <div className="text-green-400 font-medium">$9.8M</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">SELL VOL</div>
                                        <div className="text-red-400 font-medium">$9.4M</div>
                                    </div>
                                </div>
                                {/* Makers Stats */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">MAKERS</div>
                                        <div className="text-white font-medium">4,015</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">BUYERS</div>
                                        <div className="text-green-400 font-medium">2,735</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">SELLERS</div>
                                        <div className="text-red-400 font-medium">2,590</div>
                                    </div>
                                </div>
                                {/* Contract Address */}
                                <div className="bg-slate-700 rounded-lg p-4">
                                    <div className="text-slate-400 text-xs mb-1">CONTRACT ADDRESS</div>
                                    <div className="text-white font-mono text-sm break-all">{tokenData.address}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

// Loading fallback component
function WatchlistFallback() {
    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Watchlist</h1>
                    <p className="text-slate-400">Loading...</p>
                </div>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-slate-400">Loading page...</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function WatchlistPage() {
    return (
        <Suspense fallback={<WatchlistFallback />}>
            <WatchlistContent />
        </Suspense>
    );
} 