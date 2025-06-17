'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { toast } from 'react-hot-toast';
import { MagnifyingGlassIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';
import DashboardLayout from '@/components/DashboardLayout';

interface TokenData {
    address: string;
    name: string;
    symbol: string;
    price: number;
    market_cap?: number;
    last_updated?: string;
    logo?: string;
}

export default function TokenSearch() {
    const { isAuthenticated, user, isLoading: authLoading, signOut } = useAuth();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [tokenData, setTokenData] = useState<TokenData | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchHistory, setSearchHistory] = useState<TokenData[]>([]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }

        // Load search history from localStorage
        const savedHistory = localStorage.getItem('token_search_history');
        if (savedHistory) {
            try {
                setSearchHistory(JSON.parse(savedHistory));
            } catch (error) {
                console.error('Error loading search history:', error);
            }
        }
    }, [isAuthenticated, authLoading, router]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!searchQuery.trim()) {
            toast.error('Please enter a token contract address');
            return;
        }

        // Basic Solana address validation
        if (searchQuery.length < 32 || searchQuery.length > 44) {
            toast.error('Invalid Solana token address format (must be 32-44 characters)');
            return;
        }

        // Check for valid base58 characters
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(searchQuery)) {
            toast.error('Invalid characters in token address (must be base58)');
            return;
        }

        try {
            setIsSearching(true);
            setTokenData(null);

            const response = await apiService.searchTokens(searchQuery.trim());

            if (response.success && response.data && response.data.length > 0) {
                const tokenResult = response.data[0];
                setTokenData(tokenResult);

                // Add to search history
                const newHistory = [tokenResult, ...searchHistory.filter(item => item.address !== tokenResult.address)].slice(0, 10);
                setSearchHistory(newHistory);
                localStorage.setItem('token_search_history', JSON.stringify(newHistory));

                toast.success('Token data loaded successfully!');
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

    const handleHistorySelect = (token: TokenData) => {
        setSearchQuery(token.address);
        setTokenData(token);
    };

    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem('token_search_history');
        toast.success('Search history cleared');
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
                    <h1 className="text-3xl font-bold text-white mb-2">Token Search</h1>
                    <p className="text-slate-400">Search for Solana tokens by contract address</p>
                </div>

                {/* Search Form */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div>
                            <label htmlFor="contractAddress" className="block text-sm font-medium text-slate-300 mb-2">
                                Contract Address
                            </label>
                            <div className="relative">
                                <input
                                    id="contractAddress"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Enter Solana token contract address (e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)"
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                                    disabled={isSearching}
                                />
                                <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            {isSearching ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Searching...</span>
                                </>
                            ) : (
                                <>
                                    <MagnifyingGlassIcon className="h-5 w-5" />
                                    <span>Search Token</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Token Results */}
                {tokenData && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Token Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-700 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-1">Name</div>
                                <div className="text-white font-medium">{tokenData.name}</div>
                            </div>
                            <div className="bg-slate-700 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-1">Symbol</div>
                                <div className="text-white font-medium">{tokenData.symbol}</div>
                            </div>
                            <div className="bg-slate-700 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-1">Price</div>
                                <div className="text-white font-medium">${formatPrice(tokenData.price)}</div>
                            </div>
                            <div className="bg-slate-700 rounded-lg p-4">
                                <div className="text-sm text-slate-400 mb-1">Market Cap</div>
                                <div className="text-white font-medium">{formatMarketCap(tokenData.market_cap || 0)}</div>
                            </div>
                        </div>
                        <div className="mt-4 bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-400 mb-1">Contract Address</div>
                            <div className="text-white font-mono text-sm break-all">{tokenData.address}</div>
                        </div>
                    </div>
                )}

                {/* Search History */}
                {searchHistory.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                                <ClockIcon className="h-5 w-5" />
                                <span>Search History</span>
                            </h2>
                            <button
                                onClick={clearHistory}
                                className="text-slate-400 hover:text-red-400 transition-colors"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {searchHistory.map((token, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleHistorySelect(token)}
                                    className="bg-slate-700 hover:bg-slate-600 rounded-lg p-3 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <div className="text-white font-medium">{token.name} ({token.symbol})</div>
                                            <div className="text-slate-400 text-sm font-mono">{token.address}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-white font-medium">${formatPrice(token.price)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
} 