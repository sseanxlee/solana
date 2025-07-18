'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';
import WalletButton from './WalletButton';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import SearchModal from './SearchModal';
import { TokenData } from '../services/api';
import { followedTokensService, FollowedToken } from '../services/followedTokens';
import TokenLogo from './TokenLogo';

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
}

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { publicKey, disconnect } = useWallet();
    const { signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [followedTokens, setFollowedTokens] = useState<FollowedToken[]>([]);

    useEffect(() => {
        // Load search history from localStorage
        const savedHistory = localStorage.getItem('token_search_history');
        if (savedHistory) {
            try {
                const parsedHistory = JSON.parse(savedHistory);
                // Ensure backward compatibility - add missing fields
                const historyWithTimestamps = parsedHistory.map((item: any) => ({
                    ...item,
                    search_timestamp: item.search_timestamp || Date.now(),
                    metadata: item.metadata || (item.logo ? { logo: item.logo } : undefined),
                    pairs: item.pairs || undefined,
                    isLoading: false
                }));
                setSearchHistory(historyWithTimestamps);
            } catch (error) {
                console.error('Error loading search history:', error);
            }
        }

        // Load followed tokens
        setFollowedTokens(followedTokensService.getFollowedTokens());

        // Listen for storage changes to update followed tokens across tabs
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'stride_followed_tokens') {
                setFollowedTokens(followedTokensService.getFollowedTokens());
            }
        };

        // Listen for custom follow/unfollow events within the same tab
        const handleFollowChange = () => {
            setFollowedTokens(followedTokensService.getFollowedTokens());
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('followedTokensChanged', handleFollowChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('followedTokensChanged', handleFollowChange);
        };
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

    const handleUpdateSearchHistory = (newHistory: SearchHistoryItem[]) => {
        setSearchHistory(newHistory);
        localStorage.setItem('token_search_history', JSON.stringify(newHistory));
    };

    const handleFollowedTokenClick = (tokenAddress: string) => {
        router.push(`/search?token=${tokenAddress}`);
    };

    const handleUnfollowToken = (tokenAddress: string, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent navigation
        followedTokensService.unfollowToken(tokenAddress);
        setFollowedTokens(followedTokensService.getFollowedTokens());
        toast.success('Token unfollowed');
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
            href: '/watchlist',
            label: 'Watchlist',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            )
        },
        {
            href: '/integrations',
            label: 'Integrations',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
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
        <>
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
                        } bg-gray-900/20 border-r border-gray-800/30 flex flex-col transition-all duration-300 ease-in-out fixed top-0 left-0 h-full z-30 overflow-y-auto overflow-x-hidden`}>
                        {/* Logo and Toggle */}
                        <div className="flex items-center justify-between p-4 flex-shrink-0 h-20">
                            <div className="flex items-center flex-1 min-w-0 overflow-hidden">
                                <Link href="/dashboard" className="flex items-center space-x-3 min-w-0">
                                    <img src="/logo.png" alt="Logo" className="w-12 h-12 filter invert flex-shrink-0" />
                                    <span
                                        className={`text-xl font-bold text-gray-100 font-heading whitespace-nowrap transition-all duration-300 ease-in-out ${sidebarCollapsed
                                            ? 'opacity-0 -translate-x-4 w-0'
                                            : 'opacity-100 translate-x-0 w-auto'
                                            }`}
                                        style={{ transitionProperty: 'opacity, transform, width' }}
                                    >
                                        Stride
                                    </span>
                                </Link>
                            </div>
                            <button
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800/30 transition-colors flex-shrink-0 ml-2"
                                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            >
                                <svg className={`w-4 h-4 transform transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>

                        {/* Search Button */}
                        <div className="px-4 mb-4 flex-shrink-0">
                            <button
                                onClick={() => setIsSearchModalOpen(true)}
                                className="flex items-center text-gray-300 hover:text-gray-100 hover:bg-gray-800/30 px-3 py-2.5 rounded-lg transition-colors text-sm w-full"
                                title={sidebarCollapsed ? 'Search' : undefined}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <span
                                    className={`font-medium font-body whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${sidebarCollapsed
                                        ? 'opacity-0 -translate-x-2 w-0 ml-0'
                                        : 'opacity-100 translate-x-0 w-auto ml-3'
                                        }`}
                                    style={{ transitionProperty: 'opacity, transform, width, margin-left' }}
                                >
                                    Search
                                </span>
                            </button>
                        </div>

                        {/* Navigation */}
                        <nav className="px-4 space-y-1 flex-shrink-0">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex items-center rounded-lg transition-all duration-200 ease-in-out text-sm px-3 py-2.5 ${isActive
                                            ? 'bg-primary-600/15 text-primary-300 border border-primary-500/20'
                                            : 'text-gray-300 hover:text-gray-100 hover:bg-gray-800/30'
                                            }`}
                                        title={sidebarCollapsed ? item.label : undefined}
                                    >
                                        <span className="flex-shrink-0">{item.icon}</span>
                                        <span
                                            className={`font-medium font-body whitespace-nowrap transition-all duration-300 ease-in-out ${sidebarCollapsed
                                                ? 'opacity-0 -translate-x-2 w-0 ml-0'
                                                : 'opacity-100 translate-x-0 w-auto ml-3'
                                                }`}
                                            style={{ transitionProperty: 'opacity, transform, width, margin-left' }}
                                        >
                                            {item.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* Padding after Settings */}
                        <div className="py-4"></div>

                        {/* Followed Tokens Section - Takes remaining space */}
                        {!sidebarCollapsed && (
                            <div className="px-4 py-4 border-t border-gray-800/30 flex-1">
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 font-heading">
                                    Followed Tokens
                                </h3>
                                {followedTokens.length === 0 ? (
                                    <div className="text-center py-6">
                                        <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        <p className="text-xs text-gray-500">No tokens followed yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {followedTokens.map((token) => (
                                            <div
                                                key={token.address}
                                                onClick={() => handleFollowedTokenClick(token.address)}
                                                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-800/30 cursor-pointer transition-colors group"
                                            >
                                                <TokenLogo
                                                    tokenAddress={token.address}
                                                    tokenSymbol={token.symbol}
                                                    size="sm"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-gray-200 truncate">
                                                        {token.symbol}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {token.name}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => handleUnfollowToken(token.address, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-400 transition-all"
                                                    title="Unfollow"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Spacer for collapsed sidebar */}
                        {sidebarCollapsed && (
                            <div className="flex-1"></div>
                        )}

                        {/* Disconnect Button - Always at bottom */}
                        <div className="p-4 border-t border-gray-800/30 flex-shrink-0 mt-auto">
                            <button
                                onClick={handleSignOut}
                                className="flex items-center w-full px-3 py-2.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/30 rounded-lg transition-colors text-sm"
                                title={sidebarCollapsed ? 'Disconnect' : undefined}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span
                                    className={`font-medium font-body whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden ${sidebarCollapsed
                                        ? 'opacity-0 -translate-x-2 w-0 ml-0'
                                        : 'opacity-100 translate-x-0 w-auto ml-3'
                                        }`}
                                    style={{ transitionProperty: 'opacity, transform, width, margin-left' }}
                                >
                                    Disconnect
                                </span>
                            </button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className={`flex-1 p-6 overflow-auto transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'ml-16' : 'ml-64'
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

            {/* Search Modal */}
            <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                searchHistory={searchHistory}
                onUpdateHistory={handleUpdateSearchHistory}
            />
        </>
    );
} 