'use client';

import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleSignOut = () => {
        signOut();
        toast.success('Signed out successfully');
        router.push('/');
    };

    return (
        <div className="min-h-screen bg-gray-950 grid-pattern">
            {/* Navigation */}
            <nav className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Link href="/dashboard" className="flex items-center">
                                <div className="flex items-center space-x-3">
                                    <img src="/logo.svg" alt="Stride Logo" className="w-8 h-8 text-primary-600" />
                                    <span className="text-xl font-bold text-gray-100">
                                        Stride
                                    </span>
                                </div>
                            </Link>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* Navigation Links */}
                            <Link
                                href="/dashboard"
                                className="text-gray-300 hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                                Dashboard
                            </Link>

                            <Link
                                href="/search"
                                className="text-gray-300 hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                            >
                                Search
                            </Link>

                            {/* User Info */}
                            <div className="flex items-center space-x-3">
                                <div className="text-sm text-gray-400 bg-gray-800/50 px-3 py-1 rounded-lg border border-gray-700">
                                    {user?.walletAddress?.slice(0, 4)}...{user?.walletAddress?.slice(-4)}
                                </div>

                                <WalletMultiButton className="!bg-primary-600 !text-white hover:!bg-primary-500 !border !border-primary-500/20" />

                                <button
                                    onClick={handleSignOut}
                                    className="text-gray-400 hover:text-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
} 