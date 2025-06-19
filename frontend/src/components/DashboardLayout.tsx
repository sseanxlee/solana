'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';
import WalletButton from './WalletButton';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface DashboardLayoutProps {
    children: ReactNode;
}

interface TokenData {
    address: string;
    name: string;
    symbol: string;
    price: number;
    market_cap?: number;
    last_updated?: string;
    logo?: string;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { publicKey, disconnect } = useWallet();
    const { signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchHistory, setSearchHistory] = useState<TokenData[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        // Load search history from localStorage
        const savedHistory = localStorage.getItem('token_search_history');
        if (savedHistory) {
            try {
                setSearchHistory(JSON.parse(savedHistory));
            } catch (error) {
                console.error('Error loading search history:', error);
            }
        }
    }, []);

    const handleSignOut = async () => {
        try {
            signOut();
            await disconnect();
            router.push('/');
        } catch (error) {
            console.error('Sign out error:', error);
            toast.error('Failed to sign out');
        }
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
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
                setSearchHistory(newHistory);
                localStorage.setItem('token_search_history', JSON.stringify(newHistory));

                toast.success('Token found! Redirecting to search page...');

                // Navigate to search page with the token address
                router.push(`/search?token=${tokenResult.address}`);
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
    };

    const clearHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem('token_search_history');
        toast.success('Search history cleared');
    };

    const navItems = [
        {
            href: '/dashboard',
            label: 'Home',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            href: '/alerts',
            label: 'Alerts',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7H4l5-5v5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7h5l-5-5v5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17H4l5 5v-5z" />
                </svg>
            )
        },
        {
            href: '/search',
            label: 'Watchlist',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            )
        },
        {
            href: '/settings',
            label: 'Settings',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col">
            {/* Top Header */}
            <header className="h-12 bg-gray-900/30 flex items-center justify-end relative z-10 px-6">
                {/* Wallet Info */}
                {publicKey && (
                    <div className="flex items-center space-x-3">
                        <div className="text-sm text-gray-400">
                            Connected: {formatAddress(publicKey)}
                        </div>
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                )}
                {/* Header border that doesn't overlap sidebar */}
                <div className={`absolute bottom-0 right-0 h-px bg-gray-800/30 transition-all duration-300 ${sidebarCollapsed ? 'left-16' : 'left-64'}`}></div>
            </header>

            <div className="flex flex-1 relative">
                {/* Sidebar */}
                <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'
                    } bg-gray-900/20 border-r border-gray-800/30 flex flex-col transition-all duration-300 ease-in-out fixed top-0 left-0 h-full z-30 overflow-y-auto`}>
                    {/* Logo and Toggle */}
                    <div className="flex items-center justify-between p-4 flex-shrink-0">
                        {!sidebarCollapsed && (
                            <Link href="/dashboard" className="flex items-center space-x-3">
                                <img src="/logo.svg" alt="Stride Logo" className="w-6 h-6 text-primary-600" />
                                <span className="text-lg font-bold text-gray-100">Stride</span>
                            </Link>
                        )}
                        {sidebarCollapsed && (
                            <Link href="/dashboard" className="flex items-center justify-center w-full">
                                <img src="/logo.svg" alt="Stride Logo" className="w-6 h-6 text-primary-600" />
                            </Link>
                        )}
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800/30 transition-colors"
                            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <svg className={`w-4 h-4 transform transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    {/* Search Section */}
                    {!sidebarCollapsed && (
                        <div className="px-4 mb-4 flex-shrink-0">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                Search Tokens
                            </h3>
                            <form onSubmit={handleSearch} className="space-y-2">
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Enter token address..."
                                        className="w-full pl-10 pr-4 py-2 bg-gray-800/30 border border-gray-700/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-primary-500/50 focus:bg-gray-800/50 transition-colors"
                                        disabled={isSearching}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSearching || !searchQuery.trim()}
                                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center space-x-2"
                                >
                                    {isSearching ? (
                                        <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                            <span>Searching...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            <span>Search</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Navigation */}
                    <nav className="px-4 space-y-1 flex-shrink-0">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center rounded-lg transition-colors text-sm ${sidebarCollapsed
                                        ? `justify-center px-3 py-2.5 ${isActive
                                            ? 'bg-primary-600/15 text-primary-300 border border-primary-500/20'
                                            : 'text-gray-300 hover:text-gray-100 hover:bg-gray-800/30'
                                        }`
                                        : `space-x-3 px-3 py-2.5 ${isActive
                                            ? 'bg-primary-600/15 text-primary-300 border border-primary-500/20'
                                            : 'text-gray-300 hover:text-gray-100 hover:bg-gray-800/30'
                                        }`
                                        }`}
                                    title={sidebarCollapsed ? item.label : undefined}
                                >
                                    <span className="flex-shrink-0">{item.icon}</span>
                                    {!sidebarCollapsed && (
                                        <span className="font-medium">{item.label}</span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Search History Section */}
                    {!sidebarCollapsed && searchHistory.length > 0 && (
                        <div className="px-4 py-4 border-t border-gray-800/30">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Search History
                                </h3>
                                <button
                                    onClick={clearHistory}
                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                    title="Clear history"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-1 overflow-y-auto max-h-32">
                                {searchHistory.map((token, index) => (
                                    <div
                                        key={index}
                                        onClick={() => handleHistorySelect(token)}
                                        className="bg-gray-800/30 hover:bg-gray-800/50 rounded-lg p-2 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-300 font-medium truncate">{token.name}</div>
                                                <div className="text-xs text-gray-500 truncate">${token.symbol}</div>
                                            </div>
                                            <div className="text-right ml-2 flex-shrink-0">
                                                <div className="text-xs text-primary-400">${formatPrice(token.price)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Followed Tokens Section */}
                    {!sidebarCollapsed && (
                        <div className="px-4 py-4 border-t border-gray-800/30 flex-shrink-0">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                Followed Tokens
                            </h3>
                            <div className="text-center py-6">
                                <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <p className="text-xs text-gray-500">No tokens followed yet</p>
                            </div>
                        </div>
                    )}

                    {/* Disconnect Button */}
                    <div className="p-4 border-t border-gray-800/30 flex-shrink-0">
                        <button
                            onClick={handleSignOut}
                            className={`flex items-center space-x-3 w-full px-3 py-2.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/30 rounded-lg transition-colors text-sm ${sidebarCollapsed ? 'justify-center' : ''
                                }`}
                            title={sidebarCollapsed ? 'Disconnect' : undefined}
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            {!sidebarCollapsed && <span className="font-medium">Disconnect</span>}
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className={`flex-1 p-6 overflow-auto transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'
                    }`}>
                    {children}
                </main>
            </div>

            {/* Sidebar Overlay for mobile */}
            {!sidebarCollapsed && (
                <div
                    className="fixed inset-0 bg-black/50 z-10 lg:hidden"
                    onClick={() => setSidebarCollapsed(true)}
                />
            )}
        </div>
    );
} 