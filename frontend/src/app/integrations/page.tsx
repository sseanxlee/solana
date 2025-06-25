'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
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
    const { isAuthenticated, user, isLoading: authLoading } = useAuth();
    const router = useRouter();

    // Mock data for integrations - replace with real API calls later
    const [integrations, setIntegrations] = useState<IntegrationStatus[]>([
        {
            id: 'telegram',
            name: 'Telegram Bot',
            description: 'Chat with @stridesol_bot to create price & market cap alerts with simple commands',
            isConnected: !!user?.telegramChatId,
            icon: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
            ),
            connectedAccount: user?.telegramChatId ? `Chat ID: ${user.telegramChatId}` : undefined,
            lastUsed: user?.telegramChatId ? 'Connected' : undefined
        },
        {
            id: 'email',
            name: 'Email Notifications',
            description: 'Receive detailed alert reports and summaries via email',
            isConnected: !!user?.email,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            ),
            connectedAccount: user?.email || undefined,
            lastUsed: user?.email ? 'Available' : undefined
        }
    ]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }
    }, [isAuthenticated, authLoading, router]);

    // Update integrations when user data changes
    useEffect(() => {
        setIntegrations(prev =>
            prev.map(integration => {
                if (integration.id === 'telegram') {
                    return {
                        ...integration,
                        isConnected: !!user?.telegramChatId,
                        connectedAccount: user?.telegramChatId ? `Chat ID: ${user.telegramChatId}` : undefined,
                        lastUsed: user?.telegramChatId ? 'Connected' : undefined
                    };
                }
                if (integration.id === 'email') {
                    return {
                        ...integration,
                        isConnected: !!user?.email,
                        connectedAccount: user?.email || undefined,
                        lastUsed: user?.email ? 'Available' : undefined
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

            const botUrl = `https://t.me/stridesol_bot?start=${encodeURIComponent(walletAddress)}`;
            window.open(botUrl, '_blank');

            toast(
                <div>
                    <p className="font-medium">Opening Telegram Bot...</p>
                    <p className="text-sm">Your account will be automatically linked when you start the bot.</p>
                </div>,
                { duration: 4000, icon: '🤖' }
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
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-white mb-2" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                        Integrations
                    </h1>
                    <p className="text-slate-400 text-sm">Connect notification services for real-time alerts</p>
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
