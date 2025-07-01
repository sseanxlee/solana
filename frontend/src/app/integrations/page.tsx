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
            <div className="space-y-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                            Integrations
                        </h1>
                        <p className="text-slate-400 text-sm">Connect your notification channels</p>
                    </div>
                    <button
                        onClick={async () => {
                            toast.loading('Refreshing...', { id: 'refresh' });
                            await refreshUser();
                            toast.success('Updated!', { id: 'refresh' });
                        }}
                        className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 hover:border-slate-500 rounded-lg transition-all duration-200 font-medium"
                    >
                        ↻ Refresh
                    </button>
                </div>

                {/* Integration Cards */}
                <div className="grid gap-4 max-w-4xl">
                    {integrations.map((integration) => (
                        <div key={integration.id} className="group bg-white/[0.02] border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/50 hover:bg-white/[0.04] transition-all duration-200">
                            <div className="flex items-center gap-4">
                                {/* Icon & Status */}
                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${integration.isConnected
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-slate-700/50 text-slate-400'
                                        }`}>
                                        {integration.icon}
                                    </div>
                                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${integration.isConnected ? 'bg-emerald-500' : 'bg-slate-500'
                                        }`}></div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-semibold text-white text-sm">{integration.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${integration.isConnected
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'bg-slate-700/50 text-slate-400'
                                            }`}>
                                            {integration.isConnected ? 'Connected' : 'Not connected'}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-xs leading-relaxed mb-1">{integration.description}</p>
                                    {integration.isConnected && integration.connectedAccount && (
                                        <p className="text-slate-500 text-xs">
                                            ✓ {integration.connectedAccount}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {integration.isConnected ? (
                                        <>
                                            <button
                                                onClick={() => handleConnect(integration.id)}
                                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all duration-200"
                                            >
                                                Open
                                            </button>
                                            <button
                                                onClick={() => handleDisconnect(integration.id)}
                                                className="px-3 py-1.5 text-slate-400 hover:text-red-400 text-xs font-medium transition-colors duration-200"
                                            >
                                                Manage
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect(integration.id)}
                                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-all duration-200"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Advanced Discord Integration */}
                {user && !user.discordUserId && (
                    <div className="max-w-4xl">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mt-0.5">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-blue-300 text-sm mb-1">Complete Discord Setup</h3>
                                    <p className="text-blue-200/80 text-xs mb-3">For full Discord integration with synced alerts and bot commands</p>
                                    <DiscordLinking />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

// Loading fallback component
function IntegrationsFallback() {
    return (
        <DashboardLayout>
            <div className="space-y-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Integrations</h1>
                        <p className="text-slate-400 text-sm">Loading your notification channels...</p>
                    </div>
                    <div className="w-16 h-6 bg-slate-700/50 rounded-lg animate-pulse"></div>
                </div>

                <div className="grid gap-4 max-w-4xl">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white/[0.02] border border-slate-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-700/50 rounded-xl animate-pulse"></div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="h-4 bg-slate-700/50 rounded w-24 animate-pulse"></div>
                                        <div className="h-5 bg-slate-700/50 rounded-full w-20 animate-pulse"></div>
                                    </div>
                                    <div className="h-3 bg-slate-700/50 rounded w-64 animate-pulse"></div>
                                </div>
                                <div className="w-16 h-6 bg-slate-700/50 rounded-lg animate-pulse"></div>
                            </div>
                        </div>
                    ))}
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
