'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService, TokenData } from '../services/api';
import toast from 'react-hot-toast';

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    searchHistory: TokenData[];
    onUpdateHistory: (newHistory: TokenData[]) => void;
}

export default function SearchModal({ isOpen, onClose, searchHistory, onUpdateHistory }: SearchModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const router = useRouter();

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

    const formatPrice = (price: number) => {
        if (!price || typeof price !== 'number' || isNaN(price)) {
            return '0.0000';
        }
        if (price < 0.000001) {
            return price.toExponential(4);
        }
        return price < 0.01 ? price.toFixed(6) : price.toFixed(4);
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
                const tokenWithValidPrice = {
                    ...tokenResult,
                    price: typeof tokenResult.price === 'number' && !isNaN(tokenResult.price) ? tokenResult.price : 0
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

    const handleHistorySelect = (token: TokenData) => {
        router.push(`/search?token=${token.address}`);
        onClose();
    };

    const clearHistory = () => {
        onUpdateHistory([]);
        toast.success('Search history cleared');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Search Tokens</h2>
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

                {/* Search Form */}
                <div className="px-6 py-6">
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div>
                            <label htmlFor="tokenAddress" className="block text-sm font-medium text-slate-300 mb-2">
                                Contract Address
                            </label>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    id="tokenAddress"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Enter Solana token contract address..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSearching}
                                    autoFocus
                                />
                            </div>
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
                    <div className="px-6 pb-6 border-t border-slate-700">
                        <div className="flex items-center justify-between mb-4 pt-4">
                            <h3 className="text-sm font-semibold text-slate-300">Recent Searches</h3>
                            <button
                                onClick={clearHistory}
                                className="text-slate-400 hover:text-red-400 transition-colors text-sm"
                            >
                                Clear all
                            </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {searchHistory.map((token, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleHistorySelect(token)}
                                    className="bg-slate-800 hover:bg-slate-700 rounded-lg p-3 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white font-medium truncate">{token.name}</div>
                                            <div className="text-xs text-slate-400 truncate">${token.symbol}</div>
                                        </div>
                                        <div className="text-right ml-3 flex-shrink-0">
                                            <div className="text-sm text-blue-400">${formatPrice(token.price)}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 