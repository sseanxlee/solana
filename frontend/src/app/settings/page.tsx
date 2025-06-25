'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import DashboardLayout from '../../components/DashboardLayout';
import toast from 'react-hot-toast';

export default function SettingsPage() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [email, setEmail] = useState(user?.email || '');

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, isLoading, router]);

    useEffect(() => {
        if (user) {
            setEmail(user.email || '');
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setIsUpdating(true);
            const response = await apiService.updateProfile({ email });

            if (response.success) {
                toast.success('Profile updated successfully!');
            } else {
                toast.error(response.error || 'Failed to update profile');
            }
        } catch (error: any) {
            console.error('Profile update error:', error);
            toast.error(error.error || 'Failed to update profile');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleCopyWalletAddress = () => {
        if (user?.walletAddress) {
            navigator.clipboard.writeText(user.walletAddress);
            toast.success('Wallet address copied to clipboard!');
        }
    };



    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-100 font-heading">Settings</h1>
                    <p className="text-gray-400 mt-1">
                        Configure your account and notification preferences
                    </p>
                </div>

                {/* Account Information */}
                <div className="card-elevated">
                    <h2 className="text-xl font-semibold text-gray-100 mb-4">Account Information</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Wallet Address
                            </label>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={user?.walletAddress || ''}
                                    disabled
                                    className="input-field bg-gray-800 text-gray-400 cursor-not-allowed flex-1"
                                />
                                <button
                                    onClick={handleCopyWalletAddress}
                                    className="btn-secondary"
                                    title="Copy wallet address"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateProfile}>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Email Address (Optional)
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email for notifications"
                                    className="input-field"
                                />
                                <p className="text-gray-500 text-sm mt-1">
                                    Used for email alerts and notifications
                                </p>
                            </div>

                            <div className="mt-4">
                                <button
                                    type="submit"
                                    disabled={isUpdating}
                                    className="btn-primary disabled:opacity-50"
                                >
                                    {isUpdating ? (
                                        <>
                                            <div className="spinner w-4 h-4 mr-2"></div>
                                            Updating...
                                        </>
                                    ) : (
                                        'Update Profile'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Telegram Integration */}
                <div className="card-elevated">
                    <h2 className="text-xl font-semibold text-gray-100 mb-4">Telegram Integration</h2>

                    {user?.telegramChatId ? (
                        <div className="space-y-4">
                            <div className="flex items-center space-x-3 p-4 bg-green-950/30 border border-green-800/30 rounded-lg">
                                <div className="flex-shrink-0">
                                    <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-green-400 font-medium">✅ Telegram Connected</h3>
                                    <p className="text-gray-400 text-sm">
                                        Your Telegram account is linked and alerts will sync automatically
                                    </p>
                                </div>
                            </div>

                            <div className="flex space-x-3">
                                <a
                                    href="https://t.me/stridesol_bot"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-secondary flex items-center"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                                    </svg>
                                    Open Telegram Bot
                                </a>

                                <button
                                    onClick={() => {
                                        const message = 'To unlink your Telegram account, send /unlink in the Telegram bot';
                                        toast(message, { duration: 5000, icon: 'ℹ️' });
                                    }}
                                    className="btn-secondary text-red-400 border-red-500/30 hover:bg-red-950/30"
                                >
                                    Unlink Instructions
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                                <h3 className="text-gray-200 font-medium mb-2">Connect Your Telegram</h3>
                                <p className="text-gray-400 text-sm mb-4">
                                    Link your Telegram account to create and manage alerts directly through our bot.
                                    Your alerts will sync between the web app and Telegram!
                                </p>

                                <div className="space-y-3">
                                    <div className="text-sm text-gray-300">
                                        <p className="mb-2 font-medium">How to connect:</p>
                                        <ol className="list-decimal list-inside space-y-1 text-gray-400">
                                            <li>Go to the Integrations page</li>
                                            <li>Click "Connect" next to Telegram Bot</li>
                                            <li>Your account will be automatically linked!</li>
                                        </ol>
                                    </div>

                                    <a
                                        href="/integrations"
                                        className="btn-primary flex items-center justify-center"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Go to Integrations
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Notification Preferences */}
                <div className="card-elevated">
                    <h2 className="text-xl font-semibold text-gray-100 mb-4">Notification Preferences</h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <div>
                                <h3 className="text-gray-200 font-medium">Email Notifications</h3>
                                <p className="text-gray-400 text-sm">Receive alert notifications via email</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${user?.email
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                                }`}>
                                {user?.email ? 'Available' : 'Not configured'}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <div>
                                <h3 className="text-gray-200 font-medium">Telegram Notifications</h3>
                                <p className="text-gray-400 text-sm">Receive alert notifications via Telegram bot</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${user?.telegramChatId
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                                }`}>
                                {user?.telegramChatId ? 'Connected' : 'Not connected'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
} 