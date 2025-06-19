'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { apiService, TokenPairsResponse, TokenMetadata } from '../../services/api';
import { toast } from 'react-hot-toast';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/DashboardLayout';

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
                            <h1 className="text-3xl font-bold text-white mb-2">Token Information</h1>
                            <p className="text-slate-400">Search results for {tokenData.name} ({tokenData.symbol})</p>
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

                {/* Token Results */}
                {tokenData && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Token Information</h2>

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Left side - External Links */}
                            <div className="lg:col-span-1">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-slate-300 mb-3">External Tools</h3>

                                    {/* Solscan Link */}
                                    <a
                                        href={`https://solscan.io/token/${tokenData.address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 rounded-lg p-3 transition-colors"
                                    >
                                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">S</span>
                                        </div>
                                        <span className="text-white text-sm">View on Solscan</span>
                                    </a>

                                    {/* Single Axiom Link */}
                                    {tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 && (
                                        <a
                                            href={`https://axiom.trade/meme/${tokenPairs.pairs[0].pairAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 rounded-lg p-3 transition-colors"
                                        >
                                            <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">A</span>
                                            </div>
                                            <span className="text-white text-sm">View in Axiom - Token/SOL</span>
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Right side - Token Details and Pairs */}
                            <div className="lg:col-span-3">
                                {/* Token Logo and Basic Info */}
                                <div className="flex items-start space-x-6 mb-6">
                                    {/* Logo */}
                                    <div className="flex-shrink-0">
                                        {isLoadingMetadata ? (
                                            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                            </div>
                                        ) : tokenMetadata?.logo ? (
                                            <img
                                                src={tokenMetadata.logo}
                                                alt={tokenData.name}
                                                className="w-16 h-16 rounded-full object-cover bg-slate-700"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center">
                                                <span className="text-white text-lg font-bold">
                                                    {tokenData.symbol.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Basic Token Info */}
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-slate-700 rounded-lg p-4">
                                            <div className="text-sm text-slate-400 mb-1">Name</div>
                                            <div className="text-white font-medium">{tokenData.name}</div>
                                        </div>
                                        <div className="bg-slate-700 rounded-lg p-4">
                                            <div className="text-sm text-slate-400 mb-1">Symbol</div>
                                            <div className="text-white font-medium">{tokenData.symbol}</div>
                                        </div>
                                        <div className="bg-slate-700 rounded-lg p-4">
                                            <div className="text-sm text-slate-400 mb-1">
                                                Price
                                                {tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 && !isLoadingPairs && (
                                                    <span className="ml-1 text-xs">
                                                        ({[...tokenPairs.pairs].sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0].exchangeName})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-white font-medium">
                                                {isLoadingPairs ? (
                                                    <div className="flex items-center space-x-2">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                        <span>Loading...</span>
                                                    </div>
                                                ) : (
                                                    `$${formatPrice(getCurrentPrice())}`
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-slate-700 rounded-lg p-4">
                                            <div className="text-sm text-slate-400 mb-1">Market Cap</div>
                                            <div className="text-white font-medium">{formatMarketCap(calculateMarketCap())}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Supply Info */}
                                {tokenMetadata && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-700 rounded-lg p-4">
                                            <div className="text-sm text-slate-400 mb-1">Total Supply</div>
                                            <div className="text-white font-medium">{parseFloat(tokenMetadata.totalSupplyFormatted).toLocaleString()} {tokenData.symbol}</div>
                                        </div>
                                        <div className="bg-slate-700 rounded-lg p-4">
                                            <div className="text-sm text-slate-400 mb-1">Decimals</div>
                                            <div className="text-white font-medium">{tokenMetadata.decimals}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Contract Address */}
                                <div className="bg-slate-700 rounded-lg p-4 mb-6">
                                    <div className="text-sm text-slate-400 mb-1">Contract Address</div>
                                    <div className="text-white font-mono text-sm break-all">{tokenData.address}</div>
                                </div>

                                {/* Trading Pairs - More Compact */}
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center space-x-2">
                                        <CurrencyDollarIcon className="h-4 w-4" />
                                        <span>Trading Pairs</span>
                                    </h3>

                                    {isLoadingPairs ? (
                                        <div className="flex items-center justify-center py-6">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                            <span className="ml-2 text-slate-400 text-sm">Loading pairs...</span>
                                        </div>
                                    ) : tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 ? (
                                        <div className="space-y-2">
                                            {tokenPairs.pairs
                                                .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
                                                .slice(0, 2)
                                                .map((pair, index) => (
                                                    <div key={index} className="bg-slate-700 rounded-lg p-3">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center space-x-2">
                                                                {pair.exchangeLogo && (
                                                                    <img
                                                                        src={pair.exchangeLogo}
                                                                        alt={pair.exchangeName}
                                                                        className="w-4 h-4 rounded-full"
                                                                    />
                                                                )}
                                                                <div>
                                                                    <div className="text-white font-medium text-sm">{pair.pairLabel}</div>
                                                                    <div className="text-slate-400 text-xs">{pair.exchangeName}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-white font-medium text-sm">${formatPrice(pair.usdPrice)}</div>
                                                                <div className={`text-xs ${pair.usdPrice24hrPercentChange && pair.usdPrice24hrPercentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {pair.usdPrice24hrPercentChange !== null ?
                                                                        `${pair.usdPrice24hrPercentChange >= 0 ? '+' : ''}${pair.usdPrice24hrPercentChange.toFixed(2)}%` :
                                                                        'N/A'
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <span className="text-slate-400">Liquidity: </span>
                                                                <span className="text-white">{formatMarketCap(pair.liquidityUsd)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400">Pair: </span>
                                                                <span className="text-white font-mono">{pair.pairAddress.slice(0, 8)}...{pair.pairAddress.slice(-4)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            {tokenPairs.pairs.length > 2 && (
                                                <div className="text-center text-slate-400 text-xs">
                                                    Showing top 2 highest liquidity pairs out of {tokenPairs.pairs.length} available
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-slate-400 text-sm">
                                            No trading pairs found for this token
                                        </div>
                                    )}
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