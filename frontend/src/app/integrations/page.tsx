'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import { DiscordLinking } from '../../components/DiscordLinking';
import toast from 'react-hot-toast';

interface IntegrationStatus {
    id: string;
    name: string;
    description: string;
    isConnected: boolean;
    icon: React.ReactNode;
    connectedAccount?: string;
    lastUsed?: string;
}

function IntegrationsContent() {
    const { isAuthenticated, isLoading: authLoading, user, refreshUser } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [integrations, setIntegrations] = useState<IntegrationStatus[]>([
        {
            id: 'telegram',
            name: 'Telegram Bot',
            description: 'Chat with @stridesol_bot to create price & market cap alerts with simple commands',
            isConnected: false,
            icon: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
            )
        },
        {
            id: 'discord',
            name: 'Discord Bot',
            description: 'Invite our bot to your Discord server to use slash commands and get notifications.',
            isConnected: false,
            icon: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
            )
        },
        {
            id: 'email',
            name: 'Email Notifications',
            description: 'Receive alert notifications via email',
            isConnected: false,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            )
        }
    ]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }
    }, [isAuthenticated, authLoading, router]);

    // Handle linking success messages
    useEffect(() => {
        const linked = searchParams.get('linked');
        if (linked === 'discord') {
            toast.success('Discord account linked successfully! 🎉', {
                duration: 5000,
                icon: '🔗'
            });
            // Clean URL
            router.replace('/integrations');
        }
    }, [searchParams, router]);

    // Update integrations when user data changes (for initial load if user already has connections)
    useEffect(() => {
        setIntegrations(prev =>
            prev.map(integration => {
                if (integration.id === 'telegram' && user?.telegramChatId) {
                    return {
                        ...integration,
                        isConnected: true,
                        connectedAccount: `Chat ID: ${user.telegramChatId}`,
                        lastUsed: 'Connected'
                    };
                }
                if (integration.id === 'discord' && user?.discordUserId) {
                    return {
                        ...integration,
                        isConnected: true,
                        connectedAccount: `Discord Account Connected`,
                        lastUsed: 'Active'
                    };
                }
                if (integration.id === 'email' && user?.email) {
                    return {
                        ...integration,
                        isConnected: true,
                        connectedAccount: user.email,
                        lastUsed: 'Available'
                    };
                }
                return integration;
            })
        );
    }, [user]);

    const handleConnect = (integrationId: string) => {
        if (integrationId === 'telegram') {
            // Generate bot URL with wallet address parameter for auto-linking
            const walletAddress = user?.walletAddress;
            if (!walletAddress) {
                toast.error('Please sign in with your wallet first');
                return;
            }

            // Immediately update the integration status to show as connected
            setIntegrations(prev =>
                prev.map(integration => {
                    if (integration.id === 'telegram') {
                        return {
                            ...integration,
                            isConnected: true,
                            connectedAccount: 'Connecting...',
                            lastUsed: 'Just connected'
                        };
                    }
                    return integration;
                })
            );

            const botUrl = `https://t.me/stridesol_bot?start=${encodeURIComponent(walletAddress)}`;
            window.open(botUrl, '_blank');

            toast(
                <div>
                    <p className="font-medium">Opening Telegram Bot...</p>
                    <p className="text-sm">Your account will be automatically linked when you start the bot.</p>
                </div>,
                { duration: 4000, icon: '🤖' }
            );

            // After a short delay, update with proper connection info
            setTimeout(() => {
                setIntegrations(prev =>
                    prev.map(integration => {
                        if (integration.id === 'telegram') {
                            return {
                                ...integration,
                                isConnected: true,
                                connectedAccount: `Connected via ${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`,
                                lastUsed: 'Connected'
                            };
                        }
                        return integration;
                    })
                );
            }, 2000);

        } else if (integrationId === 'discord') {
            // Show Discord linking component inline or navigate to a specific section
            toast(
                <div>
                    <p className="font-medium">Discord Integration</p>
                    <p className="text-sm">Scroll down to link your Discord account below!</p>
                </div>,
                { duration: 3000, icon: '🔗' }
            );
        } else if (integrationId === 'email') {
            toast('Email integration is managed in Settings', { icon: 'ℹ️' });
        } else {
            // Placeholder for other integrations
            toast.success(`${integrationId} integration coming soon!`);
        }
    };

    const handleDisconnect = (integrationId: string) => {
        if (integrationId === 'telegram') {
            toast('To disconnect Telegram, use the Settings page or send /unlink in the bot', {
                icon: 'ℹ️',
                duration: 5000
            });
        } else if (integrationId === 'discord') {
            toast('To manage Discord connection, use the Discord linking section below', {
                icon: 'ℹ️',
                duration: 5000
            });
        } else {
            // Placeholder for other disconnections
            toast.success(`Disconnected from ${integrationId}`);
        }
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
            <div className="space-y-6" style={{ fontFamily: "'Funnel Sans', sans-serif" }}>
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-white mb-2" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                            Integrations
                        </h1>
                        <p className="text-slate-400 text-sm">Connect notification services for real-time alerts</p>
                    </div>
                    <button
                        onClick={async () => {
                            toast.loading('Refreshing connection status...', { id: 'refresh' });
                            await refreshUser();
                            toast.success('Connection status updated!', { id: 'refresh' });
                        }}
                        className="px-3 py-2 text-sm bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50 rounded-md transition-all duration-200"
                        style={{ fontFamily: "'Exo 2', sans-serif" }}
                    >
                        🔄 Refresh Status
                    </button>
                </div>

                {/* Integration Cards */}
                <div className="max-w-2xl mx-auto space-y-4">
                    {integrations.map((integration) => (
                        <div key={integration.id} className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-5 hover:border-slate-600/50 transition-all duration-200 hover:bg-slate-800/60">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4 flex-1">
                                    <div className={`p-3 rounded-lg ${integration.isConnected
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'bg-slate-700/50 text-slate-400'
                                        }`}>
                                        {integration.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="text-base font-medium text-white" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                                                {integration.name}
                                            </h3>
                                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${integration.isConnected
                                                ? 'bg-cyan-500/20 text-cyan-400'
                                                : 'bg-slate-700/50 text-slate-400'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${integration.isConnected ? 'bg-cyan-400' : 'bg-slate-400'
                                                    }`}></div>
                                                {integration.isConnected ? 'Active' : 'Inactive'}
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1">{integration.description}</p>
                                        {integration.isConnected && integration.connectedAccount && (
                                            <p className="text-xs text-slate-500 mt-1">
                                                {integration.connectedAccount}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-2 ml-4">
                                    {integration.isConnected ? (
                                        <>
                                            <button
                                                onClick={() => handleConnect(integration.id)}
                                                className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50 rounded-md text-xs font-medium transition-all duration-200"
                                                style={{ fontFamily: "'Exo 2', sans-serif" }}
                                            >
                                                Open
                                            </button>
                                            <button
                                                onClick={() => handleDisconnect(integration.id)}
                                                className="px-3 py-1.5 text-slate-400 hover:text-red-400 text-xs font-medium transition-colors duration-200"
                                                style={{ fontFamily: "'Exo 2', sans-serif" }}
                                            >
                                                Disconnect
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect(integration.id)}
                                            className="px-4 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 rounded-md text-sm font-medium transition-all duration-200"
                                            style={{ fontFamily: "'Exo 2', sans-serif" }}
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Discord Integration Section */}
                <div className="max-w-2xl mx-auto">
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                            Discord Integration
                        </h2>
                        <p className="text-slate-400 text-sm">
                            Link your Discord account to sync alerts between the web app and Discord bot
                        </p>
                    </div>
                    <DiscordLinking />
                </div>
            </div>
        </DashboardLayout>
    );
}

// Loading fallback component
function IntegrationsFallback() {
    return (
        <DashboardLayout>
            <div className="space-y-6" style={{ fontFamily: "'Funnel Sans', sans-serif" }}>
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-white mb-2" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                        Integrations
                    </h1>
                    <p className="text-slate-400 text-sm">Loading...</p>
                </div>
                <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                        <p className="text-slate-400 text-sm">Loading integrations...</p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default function IntegrationsPage() {
    return (
        <Suspense fallback={<IntegrationsFallback />}>
            <IntegrationsContent />
        </Suspense>
    );
}
