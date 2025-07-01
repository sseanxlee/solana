'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { presetSettingsService, PresetSettings } from '../../services/presetSettings';
import DashboardLayout from '../../components/DashboardLayout';

import toast from 'react-hot-toast';

export default function SettingsPage() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();
    const [isUpdating, setIsUpdating] = useState(false);
    const [email, setEmail] = useState(user?.email || '');

    // Preset settings state
    const [presets, setPresets] = useState<PresetSettings>(presetSettingsService.getPresets());
    const [newMarketCapPreset, setNewMarketCapPreset] = useState('');
    const [newPercentagePreset, setNewPercentagePreset] = useState('');

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

    // Preset management functions
    const addMarketCapPreset = () => {
        if (!newMarketCapPreset.trim()) return;

        const updatedPresets = {
            ...presets,
            marketCapPresets: [...presets.marketCapPresets, newMarketCapPreset.trim()]
        };

        setPresets(updatedPresets);
        presetSettingsService.updatePresets(updatedPresets);
        setNewMarketCapPreset('');
        toast.success('Market cap preset added!');
    };

    const removeMarketCapPreset = (index: number) => {
        const updatedPresets = {
            ...presets,
            marketCapPresets: presets.marketCapPresets.filter((_, i) => i !== index)
        };

        setPresets(updatedPresets);
        presetSettingsService.updatePresets(updatedPresets);
        toast.success('Market cap preset removed!');
    };

    const addPercentagePreset = () => {
        const value = parseFloat(newPercentagePreset);
        if (isNaN(value) || value <= 0) {
            toast.error('Please enter a valid positive number');
            return;
        }

        const updatedPresets = {
            ...presets,
            percentagePresets: [...presets.percentagePresets, value].sort((a, b) => a - b)
        };

        setPresets(updatedPresets);
        presetSettingsService.updatePresets(updatedPresets);
        setNewPercentagePreset('');
        toast.success('Percentage preset added!');
    };

    const removePercentagePreset = (index: number) => {
        const updatedPresets = {
            ...presets,
            percentagePresets: presets.percentagePresets.filter((_, i) => i !== index)
        };

        setPresets(updatedPresets);
        presetSettingsService.updatePresets(updatedPresets);
        toast.success('Percentage preset removed!');
    };

    const resetPresetsToDefault = () => {
        const defaultPresets = presetSettingsService.resetToDefaults();
        setPresets(defaultPresets);
        toast.success('Presets reset to defaults!');
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

                        <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <div>
                                <h3 className="text-gray-200 font-medium">Discord Notifications</h3>
                                <p className="text-gray-400 text-sm">Receive alert notifications via Discord bot</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${user?.discordUserId
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                                }`}>
                                {user?.discordUserId ? 'Connected' : 'Not connected'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alert Presets */}
                <div className="card-elevated">
                    <h2 className="text-xl font-semibold text-gray-100 mb-4">Alert Presets</h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <div>
                                <h3 className="text-gray-200 font-medium">Market Cap Presets</h3>
                                <p className="text-gray-400 text-sm">Customize market cap presets for alerts</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${presets.marketCapPresets.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {presets.marketCapPresets.length > 0 ? 'Configured' : 'Not configured'}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                            <div>
                                <h3 className="text-gray-200 font-medium">Percentage Presets</h3>
                                <p className="text-gray-400 text-sm">Customize percentage presets for alerts</p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${presets.percentagePresets.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {presets.percentagePresets.length > 0 ? 'Configured' : 'Not configured'}
                            </div>
                        </div>
                    </div>

                    {/* Market Cap Presets Management */}
                    <div className="mt-6 space-y-4">
                        <div>
                            <h3 className="text-lg font-medium text-gray-200 mb-3">Market Cap Presets</h3>
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {presets.marketCapPresets.map((preset, index) => (
                                        <div key={index} className="flex items-center bg-slate-700 rounded-lg px-3 py-2">
                                            <span className="text-white text-sm">{preset}</span>
                                            <button
                                                onClick={() => removeMarketCapPreset(index)}
                                                className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                                                title="Remove preset"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        value={newMarketCapPreset}
                                        onChange={(e) => setNewMarketCapPreset(e.target.value)}
                                        placeholder="e.g., 50M, 2.5B"
                                        className="input-field flex-1"
                                        onKeyPress={(e) => e.key === 'Enter' && addMarketCapPreset()}
                                    />
                                    <button
                                        onClick={addMarketCapPreset}
                                        disabled={!newMarketCapPreset.trim()}
                                        className="btn-primary disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-gray-200 mb-3">Percentage Presets</h3>
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {presets.percentagePresets.map((preset, index) => (
                                        <div key={index} className="flex items-center bg-slate-700 rounded-lg px-3 py-2">
                                            <span className="text-white text-sm">{preset}%</span>
                                            <button
                                                onClick={() => removePercentagePreset(index)}
                                                className="ml-2 text-red-400 hover:text-red-300 transition-colors"
                                                title="Remove preset"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        value={newPercentagePreset}
                                        onChange={(e) => setNewPercentagePreset(e.target.value)}
                                        placeholder="e.g., 75, 150"
                                        className="input-field flex-1"
                                        min="0"
                                        step="0.1"
                                        onKeyPress={(e) => e.key === 'Enter' && addPercentagePreset()}
                                    />
                                    <button
                                        onClick={addPercentagePreset}
                                        disabled={!newPercentagePreset.trim()}
                                        className="btn-primary disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            onClick={resetPresetsToDefault}
                            className="btn-secondary text-red-400 border-red-500/30 hover:bg-red-950/30"
                        >
                            Reset Presets to Default
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
} 