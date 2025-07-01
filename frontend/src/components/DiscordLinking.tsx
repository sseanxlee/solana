'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface DiscordLinkingProps {
    className?: string;
}

export const DiscordLinking: React.FC<DiscordLinkingProps> = ({ className = '' }) => {
    const { user } = useAuth();
    const [discordUserId, setDiscordUserId] = useState('');
    const [isLinked, setIsLinked] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showLinkingForm, setShowLinkingForm] = useState(false);
    const [linkingStep, setLinkingStep] = useState(1);

    useEffect(() => {
        if (user?.discordUserId) {
            setIsLinked(true);
            setDiscordUserId(user.discordUserId);
        }
    }, [user]);

    const handleLinkDiscord = async () => {
        if (!discordUserId.trim()) {
            toast.error('Please enter your Discord User ID');
            return;
        }

        // Basic validation for Discord User ID (should be numeric and 17-19 digits)
        if (!/^\d{17,19}$/.test(discordUserId.trim())) {
            toast.error('Invalid Discord User ID format. It should be 17-19 digits.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await apiService.linkDiscord(discordUserId.trim());

            if (response.success) {
                setIsLinked(true);
                setShowLinkingForm(false);
                toast.success('Discord account linked successfully! Your alerts will now sync across platforms.');
            } else {
                throw new Error(response.error || 'Failed to link Discord account');
            }
        } catch (error: any) {
            console.error('Discord linking error:', error);
            toast.error(error.message || 'Failed to link Discord account');
        } finally {
            setIsLoading(false);
        }
    };

    const copyDiscordBotLink = () => {
        const botLink = 'https://discord.com/oauth2/authorize?client_id=1387645055594135623&permissions=930397416448&integration_type=0&scope=bot';
        navigator.clipboard.writeText(botLink);
        toast.success('Discord bot link copied to clipboard!');
    };

    if (isLinked) {
        return (
            <div className={`bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 ${className}`}>
                <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                            Discord Account Linked
                        </h3>
                        <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                            Your Discord account (ID: {discordUserId}) is connected.
                            You can now create alerts on Discord and they'll sync with the web app!
                        </p>
                        <div className="mt-3 flex space-x-3">
                            <button
                                onClick={() => {
                                    window.open('https://discord.com/oauth2/authorize?client_id=1387645055594135623&permissions=930397416448&integration_type=0&scope=bot', '_blank');
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-200 dark:bg-green-800 dark:hover:bg-green-700 transition-colors"
                            >
                                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                </svg>
                                Invite Bot to Server
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
            <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Link Discord Account
                    </h3>
                    <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        Connect your Discord account to sync alerts across Discord bot and web app.
                    </p>
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                            <strong>How it works:</strong> Invite our bot to your Discord server to use slash commands like <code className="bg-blue-200 dark:bg-blue-700 px-1 rounded">/setalert</code>.
                            Link your account here to sync alerts between Discord, Telegram, and web app!
                        </p>
                    </div>

                    {!showLinkingForm ? (
                        <div className="mt-3">
                            <button
                                onClick={() => setShowLinkingForm(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                            >
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                </svg>
                                Link Discord Account
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-4">
                            {/* Step indicators */}
                            <div className="flex items-center space-x-2 text-xs text-blue-600 dark:text-blue-400">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${linkingStep >= 1 ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'}`}>
                                    {linkingStep > 1 ? '✓' : '1'}
                                </div>
                                <div className="h-px flex-1 bg-blue-200"></div>
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${linkingStep >= 2 ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'}`}>
                                    {linkingStep > 2 ? '✓' : '2'}
                                </div>
                                <div className="h-px flex-1 bg-blue-200"></div>
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${linkingStep >= 3 ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-600'}`}>
                                    3
                                </div>
                            </div>

                            {linkingStep === 1 && (
                                <div className="space-y-3">
                                    <h4 className="font-medium text-blue-800 dark:text-blue-200">Step 1: Invite Bot to Your Server</h4>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Invite our bot to your Discord server to access slash commands and full functionality.
                                    </p>
                                    <div className="p-3 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
                                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">✨ Full Bot Features</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">Use slash commands like <code className="bg-blue-200 dark:bg-blue-700 px-1 rounded">/setalert</code>, <code className="bg-blue-200 dark:bg-blue-700 px-1 rounded">/alerts</code>, and <code className="bg-blue-200 dark:bg-blue-700 px-1 rounded">/clear</code> in your server</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            window.open('https://discord.com/oauth2/authorize?client_id=1387645055594135623&permissions=930397416448&integration_type=0&scope=bot', '_blank');
                                            setLinkingStep(2);
                                        }}
                                        className="w-full inline-flex items-center justify-center px-4 py-3 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700 dark:hover:bg-blue-800 transition-colors"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                        </svg>
                                        Invite Bot to Your Server
                                    </button>
                                </div>
                            )}

                            {linkingStep === 2 && (
                                <div className="space-y-3">
                                    <h4 className="font-medium text-blue-800 dark:text-blue-200">Step 2: Get Your Discord User ID</h4>
                                    <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                                        <p>To get your Discord User ID:</p>
                                        <ol className="list-decimal list-inside space-y-1 ml-2">
                                            <li>Open Discord and go to Settings (gear icon)</li>
                                            <li>Go to "Advanced" in the left sidebar</li>
                                            <li>Enable "Developer Mode"</li>
                                            <li>Right-click on your username and select "Copy User ID"</li>
                                        </ol>
                                    </div>
                                    <button
                                        onClick={() => setLinkingStep(3)}
                                        className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700 dark:hover:bg-blue-800 transition-colors"
                                    >
                                        I have my User ID
                                    </button>
                                </div>
                            )}

                            {linkingStep === 3 && (
                                <div className="space-y-3">
                                    <h4 className="font-medium text-blue-800 dark:text-blue-200">Step 3: Link Your Account</h4>
                                    <div>
                                        <label htmlFor="discordUserId" className="block text-sm font-medium text-blue-700 dark:text-blue-300">
                                            Discord User ID
                                        </label>
                                        <input
                                            type="text"
                                            id="discordUserId"
                                            value={discordUserId}
                                            onChange={(e) => setDiscordUserId(e.target.value)}
                                            placeholder="e.g., 123456789012345678"
                                            className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-100"
                                        />
                                        <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                            Should be 17-19 digits long
                                        </p>
                                    </div>
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={handleLinkDiscord}
                                            disabled={isLoading || !discordUserId.trim()}
                                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                                        >
                                            {isLoading ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Linking...
                                                </>
                                            ) : (
                                                'Link Account'
                                            )}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowLinkingForm(false);
                                                setLinkingStep(1);
                                                setDiscordUserId('');
                                            }}
                                            className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700 dark:hover:bg-blue-800 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}; 