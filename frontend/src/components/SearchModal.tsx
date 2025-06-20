'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService, TokenData } from '../services/api';
import toast from 'react-hot-toast';

interface SearchHistoryItem extends TokenData {
    search_timestamp: number;
    metadata?: {
        logo?: string;
        decimals?: number;
        totalSupplyFormatted?: string;
    };
    pairs?: {
        topPrice?: number;
        liquidityUsd?: number;
        volume24h?: number;
    };
    isLoading?: boolean;
    isLoadingPricing?: boolean;
    isLoadingMetadata?: boolean;
    metadata_last_updated?: number;
}

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    searchHistory: SearchHistoryItem[];
    onUpdateHistory: (newHistory: SearchHistoryItem[]) => void;
}

export default function SearchModal({ isOpen, onClose, searchHistory, onUpdateHistory }: SearchModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
    const router = useRouter();

    // Auto-refresh history data when modal opens
    useEffect(() => {
        if (isOpen && searchHistory.length > 0 && !isRefreshingHistory) {
            refreshHistoryData();
        }
    }, [isOpen]);

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const refreshHistoryData = async () => {
        if (searchHistory.length === 0) return;

        setIsRefreshingHistory(true);

        try {
            // Refresh data for all tokens in parallel
            const refreshPromises = searchHistory.map(async (token) => {
                const currentTime = Date.now();
                const oneDayMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

                // Check if we need to refresh metadata (logo, decimals, supply)
                const needsMetadataRefresh = !token.metadata ||
                    !token.metadata.logo ||
                    !token.metadata.decimals ||
                    !token.metadata.totalSupplyFormatted ||
                    !token.metadata_last_updated ||
                    (currentTime - token.metadata_last_updated) > oneDayMs;

                // Set appropriate loading states - only show loading for data that's being refreshed
                const initialLoadingState = {
                    ...token,
                    isLoadingPricing: true, // Always refresh pricing
                    isLoadingMetadata: needsMetadataRefresh, // Only if needed
                    isLoading: false // Keep general loading false since we have granular states
                };

                // Update the history immediately with loading states
                onUpdateHistory(searchHistory.map(item =>
                    item.address === token.address ? initialLoadingState : item
                ));

                try {
                    // Always refresh pairs data (price, liquidity) as it changes frequently
                    const pairsPromise = apiService.getTokenPairs(token.address);

                    // Conditionally fetch metadata if needed
                    let metadataPromise = null;
                    if (needsMetadataRefresh) {
                        metadataPromise = apiService.getTokenMetadata(token.address);
                    }

                    // Wait for both requests to complete
                    const [pairsResponse, metadataResponse] = await Promise.all([
                        pairsPromise,
                        metadataPromise
                    ]);

                    let updatedToken = { ...token };

                    // Update metadata only if we fetched it
                    if (metadataResponse && metadataResponse.success && metadataResponse.data) {
                        updatedToken.metadata = {
                            logo: metadataResponse.data.logo,
                            decimals: metadataResponse.data.decimals,
                            totalSupplyFormatted: metadataResponse.data.totalSupplyFormatted
                        };
                        updatedToken.logo = metadataResponse.data.logo;
                        updatedToken.metadata_last_updated = currentTime;
                    }

                    // Always update pairs data (price, liquidity)
                    if (pairsResponse.success && pairsResponse.data && pairsResponse.data.pairs?.length > 0) {
                        const sortedPairs = [...pairsResponse.data.pairs].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
                        const topPair = sortedPairs[0];

                        updatedToken.pairs = {
                            topPrice: topPair.usdPrice,
                            liquidityUsd: topPair.liquidityUsd,
                            volume24h: topPair.liquidityUsd * 0.1
                        };
                        updatedToken.price = topPair.usdPrice;
                    }

                    // Calculate market cap if we have both supply and price
                    if (updatedToken.metadata?.totalSupplyFormatted && updatedToken.price) {
                        const supply = parseFloat(updatedToken.metadata.totalSupplyFormatted);
                        updatedToken.market_cap = supply * updatedToken.price;
                    }

                    // Final update with all loading states set to false
                    const finalToken = {
                        ...updatedToken,
                        isLoading: false,
                        isLoadingPricing: false,
                        isLoadingMetadata: false,
                        search_timestamp: token.search_timestamp
                    };

                    // Update the history immediately with the final data
                    onUpdateHistory(searchHistory.map(item =>
                        item.address === token.address ? finalToken : item
                    ));

                    return finalToken;
                } catch (error) {
                    console.error(`Error refreshing data for ${token.symbol}:`, error);

                    // Remove loading states on error
                    const errorToken = {
                        ...token,
                        isLoading: false,
                        isLoadingPricing: false,
                        isLoadingMetadata: false
                    };

                    onUpdateHistory(searchHistory.map(item =>
                        item.address === token.address ? errorToken : item
                    ));

                    return errorToken;
                }
            });

            await Promise.all(refreshPromises);
        } catch (error) {
            console.error('Error refreshing history data:', error);
            // Remove loading states on error
            const resetHistory = searchHistory.map(item => ({
                ...item,
                isLoading: false,
                isLoadingPricing: false,
                isLoadingMetadata: false
            }));
            onUpdateHistory(resetHistory);
        } finally {
            setIsRefreshingHistory(false);
        }
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

    const formatLargeNumber = (num: number) => {
        if (!num || typeof num !== 'number' || isNaN(num)) return '0';

        if (num >= 1e9) {
            return `$${(num / 1e9).toFixed(1)}B`;
        } else if (num >= 1e6) {
            return `$${(num / 1e6).toFixed(1)}M`;
        } else if (num >= 1e3) {
            return `$${(num / 1e3).toFixed(1)}K`;
        }
        return `$${num.toFixed(0)}`;
    };

    const getTokenAge = (lastUpdated?: string) => {
        if (!lastUpdated) return '';

        const now = new Date();
        const updated = new Date(lastUpdated);
        const diffMs = now.getTime() - updated.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '1d';
        if (diffDays < 30) return `${diffDays}d`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}m`;
        return `${Math.floor(diffDays / 365)}y`;
    };

    const getTimeSinceSearch = (searchTimestamp?: number) => {
        if (!searchTimestamp) return '1m';

        const now = Date.now();
        const diffMs = now - searchTimestamp;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return '1m';
        if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 30) return `${diffDays}d`;
        return `${Math.floor(diffDays / 30)}mo`;
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!searchQuery.trim()) {
            toast.error('Please enter a token contract address');
            return;
        }

        // Basic Solana address validation
        if (searchQuery.length < 32 || searchQuery.length > 44) {
            toast.error('Invalid Solana token address format');
            return;
        }

        // Check for valid base58 characters
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(searchQuery)) {
            toast.error('Invalid characters in token address');
            return;
        }

        try {
            setIsSearching(true);

            const response = await apiService.searchTokens(searchQuery.trim());

            if (response.success && response.data && response.data.length > 0) {
                const tokenResult = response.data[0];

                // Ensure we have a valid price - if not, use 0
                const tokenWithValidPrice: SearchHistoryItem = {
                    ...tokenResult,
                    price: typeof tokenResult.price === 'number' && !isNaN(tokenResult.price) ? tokenResult.price : 0,
                    search_timestamp: Date.now(),
                    // Initialize with basic data, will be enriched when clicked
                    metadata: tokenResult.logo ? { logo: tokenResult.logo } : undefined,
                    isLoading: false
                };

                // Add to search history
                const newHistory = [tokenWithValidPrice, ...searchHistory.filter(item => item.address !== tokenWithValidPrice.address)].slice(0, 10);
                onUpdateHistory(newHistory);

                toast.success('Token found! Loading details...');

                // Navigate to search page with the token address
                router.push(`/search?token=${tokenResult.address}`);

                // Close modal and clear search
                onClose();
                setSearchQuery('');
            } else {
                toast.error('Token not found or invalid address');
            }
        } catch (error: any) {
            console.error('Search error:', error);
            toast.error(error.error || 'Failed to fetch token data');
        } finally {
            setIsSearching(false);
        }
    };

    const handleHistorySelect = async (token: SearchHistoryItem) => {
        // Mark this history item as loading
        const updatedHistory = searchHistory.map(item =>
            item.address === token.address
                ? { ...item, isLoading: true }
                : item
        );
        onUpdateHistory(updatedHistory);

        try {
            // Make API calls to get fresh token data
            const [metadataResponse, pairsResponse] = await Promise.all([
                apiService.getTokenMetadata(token.address),
                apiService.getTokenPairs(token.address)
            ]);

            // Process the responses
            let updatedToken = { ...token };

            if (metadataResponse.success && metadataResponse.data) {
                updatedToken.metadata = {
                    logo: metadataResponse.data.logo,
                    decimals: metadataResponse.data.decimals,
                    totalSupplyFormatted: metadataResponse.data.totalSupplyFormatted
                };
                // Update the logo in the main token data too
                updatedToken.logo = metadataResponse.data.logo;
            }

            if (pairsResponse.success && pairsResponse.data && pairsResponse.data.pairs?.length > 0) {
                // Get the highest liquidity pair
                const sortedPairs = [...pairsResponse.data.pairs].sort((a, b) => b.liquidityUsd - a.liquidityUsd);
                const topPair = sortedPairs[0];

                updatedToken.pairs = {
                    topPrice: topPair.usdPrice,
                    liquidityUsd: topPair.liquidityUsd,
                    volume24h: topPair.liquidityUsd * 0.1 // Estimate volume as 10% of liquidity
                };
                // Update the price in the main token data too
                updatedToken.price = topPair.usdPrice;
            }

            // Calculate market cap if we have both supply and price
            if (updatedToken.metadata?.totalSupplyFormatted && updatedToken.price) {
                const supply = parseFloat(updatedToken.metadata.totalSupplyFormatted);
                updatedToken.market_cap = supply * updatedToken.price;
            }

            // Update the search history with the enriched data
            const finalHistory = searchHistory.map(item =>
                item.address === token.address
                    ? { ...updatedToken, isLoading: false, search_timestamp: Date.now() }
                    : item
            );
            onUpdateHistory(finalHistory);

            toast.success(`Updated ${token.symbol} data`);
        } catch (error: any) {
            console.error('Error loading token details for history:', error);
            // Remove loading state on error
            const resetHistory = searchHistory.map(item =>
                item.address === token.address
                    ? { ...item, isLoading: false }
                    : item
            );
            onUpdateHistory(resetHistory);
            toast.error('Failed to load token details');
        }

        // Still navigate to the search page
        router.push(`/search?token=${token.address}`);
        onClose();
    };

    const clearHistory = () => {
        onUpdateHistory([]);
        toast.success('Search history cleared');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content - Made wider */}
            <div className="relative w-full max-w-4xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white font-heading">Search by name, ticker, or CA...</h2>
                        <div className="flex items-center space-x-3">
                            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Esc</span>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Search Form */}
                <div className="px-6 py-6">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                id="tokenAddress"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, ticker, or CA..."
                                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                                disabled={isSearching}
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching || !searchQuery.trim()}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            {isSearching ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Searching...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <span>Search Token</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Search History */}
                {searchHistory.length > 0 && (
                    <div className="border-t border-slate-700">
                        <div className="px-6 py-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-slate-300 font-heading">History</h3>
                                <button
                                    onClick={clearHistory}
                                    className="text-slate-400 hover:text-red-400 transition-colors text-xs"
                                >
                                    Clear all
                                </button>
                            </div>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {searchHistory.map((token, index) => (
                                    <div
                                        key={index}
                                        onClick={() => handleHistorySelect(token)}
                                        className="group bg-slate-800/40 hover:bg-slate-700/60 rounded-xl p-4 cursor-pointer transition-all duration-200 border border-slate-700/50 hover:border-slate-600"
                                    >
                                        <div className="flex items-center space-x-4">
                                            {/* Token Logo */}
                                            <div className="relative flex-shrink-0">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center overflow-hidden border border-slate-600">
                                                    {token.isLoadingMetadata ? (
                                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                                    ) : (token.metadata?.logo || token.logo) ? (
                                                        <img
                                                            src={token.metadata?.logo || token.logo}
                                                            alt={token.symbol}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                const fallback = target.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                                                                if (fallback) fallback.classList.remove('hidden');
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div className={`logo-fallback ${(token.metadata?.logo || token.logo) ? 'hidden' : ''} text-slate-400 font-medium text-sm`}>
                                                        {token.symbol?.charAt(0) || '?'}
                                                    </div>
                                                </div>
                                                {/* Time since search or loading indicator */}
                                                <div className="absolute -bottom-1 -right-1 bg-slate-600 border border-slate-500 rounded-full w-6 h-6 flex items-center justify-center">
                                                    {token.isLoadingPricing ? (
                                                        <div className="animate-spin rounded-full h-3 w-3 border border-blue-500 border-t-transparent"></div>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 font-medium">
                                                            {getTimeSinceSearch(token.search_timestamp)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Token Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <h4 className="text-white font-medium truncate font-body">{token.name}</h4>
                                                    <span className="text-slate-400 text-sm">${token.symbol}</span>
                                                    {/* Copy indicator */}
                                                    <div className="w-4 h-4 bg-slate-600 rounded-sm flex items-center justify-center opacity-50">
                                                        <svg className="w-2.5 h-2.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M8 3a1 1 0 011-1h6a1 1 0 011 1v2a1 1 0 11-2 0V4H9v10h1a1 1 0 110 2H8a1 1 0 01-1-1V3z" />
                                                            <path d="M6 7a1 1 0 012 0v10a1 1 0 001 1h6a1 1 0 001-1V7a1 1 0 112 0v10a3 3 0 01-3 3H9a3 3 0 01-3-3V7z" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-4 text-xs text-slate-400">
                                                    {/* Additional token indicators */}
                                                    <div className="flex items-center space-x-1">
                                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                                        <span>Verified</span>
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Market Data */}
                                            <div className="flex items-center space-x-6 text-sm">
                                                <div className="text-right">
                                                    <div className="text-slate-400 text-xs">Price</div>
                                                    <div className="text-white font-medium">
                                                        {token.isLoadingPricing ? '...' : `$${formatPrice(token.pairs?.topPrice || token.price)}`}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-slate-400 text-xs">MC</div>
                                                    <div className="text-white font-medium">
                                                        {token.isLoadingPricing ? '...' : formatLargeNumber(token.market_cap || 0)}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-slate-400 text-xs">Liq</div>
                                                    <div className="text-white font-medium">
                                                        {token.isLoadingPricing ? '...' : formatLargeNumber(token.pairs?.liquidityUsd || (token.market_cap || 0) * 0.05)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 