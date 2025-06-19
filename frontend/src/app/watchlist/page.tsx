'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';

export default function WatchlistPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }
    }, [isAuthenticated, authLoading, router]);

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
                    <h1 className="text-3xl font-bold text-white mb-2">Watchlist</h1>
                    <p className="text-slate-400">Your tracked Solana tokens and favorites</p>
                </div>

                {/* Empty watchlist state */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-8">
                    <div className="text-center">
                        <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <h3 className="text-lg font-semibold text-slate-200 mb-2">No Tokens in Watchlist</h3>
                        <p className="text-slate-400 mb-4">
                            Search for tokens and add them to your watchlist to track their performance.
                        </p>
                        <p className="text-slate-500 text-sm">
                            Use the search function to find tokens and start building your watchlist.
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
} 