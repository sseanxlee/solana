'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { apiService, TokenPairsResponse, TokenMetadata } from '../../services/api';
import toast from 'react-hot-toast';
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
        // Market Cap = Total Supply × Current Price
        if (!tokenMetadata?.totalSupplyFormatted) return 0;

        const totalSupply = parseFloat(tokenMetadata.totalSupplyFormatted);
        const currentPrice = getCurrentPrice();

        return totalSupply * currentPrice;
    };

    const getFullyDilutedValue = () => {
        // Use the fullyDilutedValue from metadata if available
        if (tokenMetadata?.fullyDilutedValue) {
            return parseFloat(tokenMetadata.fullyDilutedValue);
        }

        // Fallback: Calculate FDV using total supply * current price
        if (tokenMetadata?.totalSupplyFormatted) {
            const totalSupply = parseFloat(tokenMetadata.totalSupplyFormatted);
            const currentPrice = getCurrentPrice();
            return totalSupply * currentPrice;
        }

        return 0;
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
                            <h1 className="text-base font-normal text-white mb-2 font-heading">Token Information</h1>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold text-white mb-2 font-heading">Token Search</h1>
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

                {/* Mobile Token Info - Shown only on small screens */}
                {tokenData && (
                    <div className="lg:hidden mb-6">
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                            {/* Mobile Token Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                    {/* Token Logo */}
                                    {isLoadingMetadata ? (
                                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                        </div>
                                    ) : tokenMetadata?.logo ? (
                                        <img
                                            src={tokenMetadata.logo}
                                            alt={tokenData.name}
                                            className="w-10 h-10 rounded-full object-cover bg-slate-700 flex-shrink-0"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-white text-sm font-bold">
                                                {tokenData.symbol.charAt(0)}
                                            </span>
                                        </div>
                                    )}
                                    {/* Token Name and Symbol */}
                                    <div className="flex-1 min-w-0">
                                        <h2
                                            className="text-lg font-bold text-white cursor-pointer hover:text-blue-400 transition-colors truncate"
                                            onClick={() => {
                                                navigator.clipboard.writeText(tokenData.address);
                                                toast.success('Contract address copied!');
                                            }}
                                            title="Click to copy contract address"
                                        >
                                            {tokenData.name}
                                        </h2>
                                        <p className="text-slate-400 text-sm">${tokenData.symbol}</p>
                                    </div>
                                </div>

                                {/* Social Links Icons */}
                                <div className="flex items-center space-x-1">
                                    {/* Website Link */}
                                    {tokenMetadata?.links?.website && (
                                        <a
                                            href={tokenMetadata.links.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                            title="Visit Website"
                                        >
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                                            </svg>
                                        </a>
                                    )}

                                    {/* Twitter/X Link */}
                                    {tokenMetadata?.links?.twitter && (
                                        <a
                                            href={tokenMetadata.links.twitter}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                            title="Follow on X (Twitter)"
                                        >
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                            </svg>
                                        </a>
                                    )}

                                    {/* Telegram Link */}
                                    {tokenMetadata?.links?.telegram && (
                                        <a
                                            href={tokenMetadata.links.telegram}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                            title="Join Telegram"
                                        >
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                            </svg>
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Price and Stats */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <div className="text-slate-400 text-xs mb-1">PRICE USD</div>
                                    <div className="text-white text-lg font-bold">
                                        {isLoadingPairs ? "Loading..." : `$${formatPrice(getCurrentPrice())}`}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-1">FDV</div>
                                    <div className="text-white text-lg font-bold">
                                        {isLoadingMetadata ? "..." : formatMarketCap(getFullyDilutedValue())}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Platform Links */}
                            <div className="flex flex-wrap items-center gap-2">
                                <a
                                    href={`https://solscan.io/token/${tokenData.address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                                    title="View on Solscan"
                                >
                                    <img src="/solscanlogo.png" alt="Solscan" className="w-4 h-4" />
                                    <span>Solscan</span>
                                </a>

                                {tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 && (
                                    <a
                                        href={`https://axiom.trade/meme/${tokenPairs.pairs[0].pairAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                                        title="Trade on Axiom"
                                    >
                                        <img src="/axiomlogo.jpg" alt="Axiom" className="w-4 h-4 rounded" />
                                        <span>Axiom</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Side-by-side Layout: Price Chart (Left) + Token Info (Right) */}
                {tokenData && (
                    <div className="flex gap-6" style={{ height: '80vh' }}>
                        {/* Price Chart Widget - Left Side (flexible width) */}
                        <div className="flex-1 min-w-0 h-full">
                            <PriceChartWidget tokenAddress={tokenData.address} height="80vh" />
                        </div>
                        {/* Token Information Panel - Right Side (fixed width, hidden on small screens) */}
                        <div className="w-80 h-full hidden lg:block">
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-full flex flex-col">
                                {/* Token Header with Logo, Name and Social Links */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-4">
                                        {/* Token Logo */}
                                        {isLoadingMetadata ? (
                                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                            </div>
                                        ) : tokenMetadata?.logo ? (
                                            <img
                                                src={tokenMetadata.logo}
                                                alt={tokenData.name}
                                                className="w-12 h-12 rounded-full object-cover bg-slate-700 flex-shrink-0"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                                                <span className="text-white text-lg font-bold">
                                                    {tokenData.symbol.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                        {/* Token Name and Symbol */}
                                        <div className="flex-1 min-w-0">
                                            <h2
                                                className="text-xl font-bold text-white cursor-pointer hover:text-blue-400 transition-colors truncate"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(tokenData.address);
                                                    toast.success('Contract address copied!');
                                                }}
                                                title="Click to copy contract address"
                                            >
                                                {tokenData.name}
                                            </h2>
                                            <p className="text-slate-400">${tokenData.symbol}</p>
                                        </div>
                                    </div>

                                    {/* Social Links Icons */}
                                    <div className="flex items-center space-x-2">
                                        {/* Website Link */}
                                        {tokenMetadata?.links?.website && (
                                            <a
                                                href={tokenMetadata.links.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                                title="Visit Website"
                                            >
                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                                                </svg>
                                            </a>
                                        )}

                                        {/* Twitter/X Link */}
                                        {tokenMetadata?.links?.twitter && (
                                            <a
                                                href={tokenMetadata.links.twitter}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                                title="Follow on X (Twitter)"
                                            >
                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                                </svg>
                                            </a>
                                        )}

                                        {/* Telegram Link */}
                                        {tokenMetadata?.links?.telegram && (
                                            <a
                                                href={tokenMetadata.links.telegram}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                                                title="Join Telegram"
                                            >
                                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Platform Links */}
                                <div className="flex flex-wrap items-center gap-2 mb-6">
                                    {/* Solscan Link */}
                                    <a
                                        href={`https://solscan.io/token/${tokenData.address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                                        title="View on Solscan"
                                    >
                                        <img src="/solscanlogo.png" alt="Solscan" className="w-4 h-4" />
                                        <span>Solscan</span>
                                    </a>

                                    {/* Axiom Link */}
                                    {tokenPairs && tokenPairs.pairs && tokenPairs.pairs.length > 0 && (
                                        <a
                                            href={`https://axiom.trade/meme/${tokenPairs.pairs[0].pairAddress}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm transition-colors"
                                            title="Trade on Axiom"
                                        >
                                            <img src="/axiomlogo.jpg" alt="Axiom" className="w-4 h-4 rounded" />
                                            <span>Axiom</span>
                                        </a>
                                    )}
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
                                        <div className="text-white font-medium">
                                            {isLoadingMetadata ? "..." : formatMarketCap(getFullyDilutedValue())}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-slate-400 text-xs mb-1">MKT CAP</div>
                                        <div className="text-white font-medium">
                                            {isLoadingMetadata ? "..." : formatMarketCap(calculateMarketCap())}
                                        </div>
                                    </div>
                                </div>

                                {/* Contract Address */}
                                <div className="bg-slate-700 rounded-lg p-4">
                                    <div className="text-slate-400 text-xs mb-1">CONTRACT ADDRESS</div>
                                    <div
                                        className="text-white font-mono text-sm cursor-pointer hover:text-blue-400 transition-colors"
                                        onClick={() => {
                                            navigator.clipboard.writeText(tokenData.address);
                                            toast.success('Contract address copied!');
                                        }}
                                        title="Click to copy contract address"
                                    >
                                        {`${tokenData.address.slice(0, 6)}...${tokenData.address.slice(-6)}`}
                                    </div>
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