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
            name: 'Telegram',
            description: 'Receive instant alerts and notifications via Telegram bot',
            isConnected: false,
            icon: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
            ),
            connectedAccount: undefined,
            lastUsed: undefined
        },
        {
            id: 'discord',
            name: 'Discord',
            description: 'Get notifications and alerts in your Discord server or DMs',
            isConnected: false,
            icon: (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                </svg>
            ),
            connectedAccount: undefined,
            lastUsed: undefined
        },
        {
            id: 'email',
            name: 'Email',
            description: 'Receive detailed alert reports and summaries via email',
            isConnected: !!user?.email,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            ),
            connectedAccount: user?.email || undefined,
            lastUsed: user?.email ? '2 hours ago' : undefined
        },
        {
            id: 'sms',
            name: 'SMS / Text Messages',
            description: 'Get urgent alerts sent directly to your mobile phone',
            isConnected: false,
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            ),
            connectedAccount: undefined,
            lastUsed: undefined
        }
    ]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }
    }, [isAuthenticated, authLoading, router]);

    const handleConnect = (integrationId: string) => {
        // Placeholder for connection logic
        toast.success(`${integrationId} integration coming soon!`);
    };

    const handleDisconnect = (integrationId: string) => {
        // Placeholder for disconnection logic
        toast.success(`Disconnected from ${integrationId}`);
        setIntegrations(prev =>
            prev.map(integration =>
                integration.id === integrationId
                    ? { ...integration, isConnected: false, connectedAccount: undefined, lastUsed: undefined }
                    : integration
            )
        );
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
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {integrations.map((integration) => (
                        <div key={integration.id} className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-all duration-200 hover:bg-slate-800/60">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-md ${integration.isConnected
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'bg-slate-700/50 text-slate-400'
                                        }`}>
                                        {integration.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-white" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                                            {integration.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">{integration.description}</p>
                                    </div>
                                </div>

                                <div className={`px-2 py-1 rounded-md text-xs font-medium ${integration.isConnected
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full inline-block mr-1.5 ${integration.isConnected ? 'bg-cyan-400' : 'bg-slate-400'
                                        }`}></div>
                                    {integration.isConnected ? 'Active' : 'Inactive'}
                                </div>
                            </div>

                            {/* Connection Details */}
                            {integration.isConnected && (
                                <div className="mb-3 p-2.5 bg-slate-800/40 border border-slate-700/30 rounded-md">
                                    <div className="flex items-center justify-between text-xs">
                                        {integration.connectedAccount && (
                                            <div>
                                                <span className="text-slate-500">Account: </span>
                                                <span className="text-white font-medium">{integration.connectedAccount}</span>
                                            </div>
                                        )}
                                        {integration.lastUsed && (
                                            <div className="text-slate-500">
                                                {integration.lastUsed}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex space-x-2">
                                {integration.isConnected ? (
                                    <>
                                        <button
                                            onClick={() => handleDisconnect(integration.id)}
                                            className="flex-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-md text-xs font-medium transition-all duration-200"
                                            style={{ fontFamily: "'Exo 2', sans-serif" }}
                                        >
                                            Disconnect
                                        </button>
                                        <button className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50 rounded-md text-xs font-medium transition-all duration-200">
                                            Test
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleConnect(integration.id)}
                                        className="flex-1 px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-400 border border-cyan-500/30 hover:border-cyan-400/50 rounded-md text-xs font-medium transition-all duration-200 backdrop-blur-sm"
                                        style={{ fontFamily: "'Exo 2', sans-serif" }}
                                    >
                                        Connect
                                    </button>
                                )}
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
