'use client';

import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletButton from '../components/WalletButton';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function Home() {
    const { isAuthenticated, user } = useAuth();
    const { connected } = useWallet();
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, router]);

    return (
        <div className="min-h-screen bg-gray-950 grid-pattern">
            {/* Header */}
            <header className="relative bg-gray-900/50 backdrop-blur-sm border-b border-gray-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div className="flex items-center">
                            <div className="flex items-center space-x-3">
                                <img src="/logo.svg" alt="Stride Logo" className="w-8 h-8 text-primary-600" />
                                <h1 className="text-2xl font-bold text-gray-100">
                                    Stride
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <WalletButton />
                            {connected && !isAuthenticated && (
                                <div className="flex items-center space-x-2 text-sm text-gray-400">
                                    <div className="spinner"></div>
                                    <span>Authenticating...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center">
                    <h1 className="text-5xl tracking-tight font-bold text-gray-100 sm:text-6xl md:text-7xl">
                        <span className="block">Professional</span>
                        <span className="block text-gradient">Token Analytics</span>
                    </h1>
                    <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-400 sm:text-xl md:mt-8">
                        Advanced real-time analytics and intelligent alerts for Solana tokens.
                        Built for traders who demand precision and reliability.
                    </p>

                    {!connected && (
                        <div className="mt-8 max-w-md mx-auto sm:flex sm:justify-center md:mt-12">
                            <div className="rounded-lg">
                                <WalletButton className="w-full flex items-center justify-center px-8 py-4 border border-primary-500/20 text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-500 transition-all duration-200 md:py-4 md:text-lg md:px-12" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Features Grid */}
                <div className="mt-24">
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Feature 1 */}
                        <div className="card text-center fade-in">
                            <div className="w-12 h-12 mx-auto bg-primary-800/50 rounded-lg flex items-center justify-center border border-primary-700/50">
                                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7H4l5-5v5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7h5l-5-5v5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17H4l5 5v-5z" />
                                </svg>
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Real-time Alerts
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Instant notifications via email or Telegram when your price targets are reached.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="card text-center fade-in" style={{ animationDelay: '0.1s' }}>
                            <div className="w-12 h-12 mx-auto bg-accent-800/50 rounded-lg flex items-center justify-center border border-accent-700/50">
                                <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Complete Token Coverage
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Track any Solana token including new launches and established assets.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="card text-center fade-in" style={{ animationDelay: '0.2s' }}>
                            <div className="w-12 h-12 mx-auto bg-primary-800/50 rounded-lg flex items-center justify-center border border-primary-700/50">
                                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Secure Authentication
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Wallet-based authentication with industry-standard security protocols.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="card text-center fade-in" style={{ animationDelay: '0.3s' }}>
                            <div className="w-12 h-12 mx-auto bg-accent-800/50 rounded-lg flex items-center justify-center border border-accent-700/50">
                                <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Advanced Analytics
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Comprehensive price and market cap monitoring with detailed insights.
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="card text-center fade-in" style={{ animationDelay: '0.4s' }}>
                            <div className="w-12 h-12 mx-auto bg-primary-800/50 rounded-lg flex items-center justify-center border border-primary-700/50">
                                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                High Performance
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Sub-second alert delivery with enterprise-grade infrastructure.
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="card text-center fade-in" style={{ animationDelay: '0.5s' }}>
                            <div className="w-12 h-12 mx-auto bg-accent-800/50 rounded-lg flex items-center justify-center border border-accent-700/50">
                                <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Professional Grade
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Built for professional traders with institutional-quality reliability.
                            </p>
                        </div>
                    </div>
                </div>

                {/* How it works */}
                <div className="mt-32">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-gray-100">How it works</h2>
                        <p className="mt-4 text-lg text-gray-400">
                            Three simple steps to professional-grade token monitoring
                        </p>
                    </div>

                    <div className="mt-16 grid grid-cols-1 gap-12 sm:grid-cols-3">
                        <div className="text-center fade-in">
                            <div className="w-16 h-16 mx-auto bg-primary-600 rounded-full flex items-center justify-center text-white text-xl font-bold border border-primary-500/30">
                                1
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Connect Wallet
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Secure authentication through your Phantom or compatible Solana wallet.
                            </p>
                        </div>

                        <div className="text-center fade-in" style={{ animationDelay: '0.2s' }}>
                            <div className="w-16 h-16 mx-auto bg-primary-600 rounded-full flex items-center justify-center text-white text-xl font-bold border border-primary-500/30">
                                2
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Configure Alerts
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Set precise price and market cap thresholds with custom notification preferences.
                            </p>
                        </div>

                        <div className="text-center fade-in" style={{ animationDelay: '0.4s' }}>
                            <div className="w-16 h-16 mx-auto bg-primary-600 rounded-full flex items-center justify-center text-white text-xl font-bold border border-primary-500/30">
                                3
                            </div>
                            <h3 className="mt-6 text-lg font-semibold text-gray-200">
                                Monitor & Trade
                            </h3>
                            <p className="mt-3 text-base text-gray-400">
                                Receive instant notifications and make informed trading decisions.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-24 border-t border-gray-800/50 bg-gray-900/30 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">
                            © 2024 Stride. Professional Solana token analytics platform.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
} 