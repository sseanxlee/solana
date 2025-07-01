'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';

export default function LinkDiscordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAuthenticated, user, signIn, refreshUser } = useAuth();
    const [tokenInfo, setTokenInfo] = useState<any>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [linkingAttempted, setLinkingAttempted] = useState(false);
    const [linkingFailed, setLinkingFailed] = useState(false);

    const token = searchParams.get('token');

    useEffect(() => {
        if (!token) {
            router.push('/integrations');
            return;
        }

        // Get token info
        fetchTokenInfo();
    }, [token]);

    useEffect(() => {
        if (isAuthenticated && tokenInfo && !tokenInfo.isUsed && !isLinking && !linkingAttempted) {
            handleLinking();
        }
    }, [isAuthenticated, tokenInfo, isLinking, linkingAttempted]);

    const fetchTokenInfo = async () => {
        try {
            const response = await apiService.getDiscordTokenInfo(token!);
            if (response.success) {
                setTokenInfo(response.data);
            } else {
                toast.error('Invalid linking token');
                router.push('/integrations');
            }
        } catch (error) {
            toast.error('Failed to validate token');
            router.push('/integrations');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLinking = async () => {
        if (isLinking || linkingAttempted) return;

        setIsLinking(true);
        setLinkingAttempted(true);
        setLinkingFailed(false);
        try {
            const response = await apiService.linkDiscordWithToken(token!);

            if (response.success) {
                toast.success(`Discord account @${tokenInfo.discordUsername} linked successfully!`);
                // Refresh user data to include Discord information
                await refreshUser();
                router.push('/integrations?linked=discord');
            } else {
                toast.error(response.error || 'Failed to link account');
                setLinkingFailed(true);
            }
        } catch (error) {
            toast.error('Failed to link Discord account');
            setLinkingFailed(true);
        } finally {
            setIsLinking(false);
        }
    };

    const handleRetry = () => {
        setLinkingAttempted(false);
        setLinkingFailed(false);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="max-w-md mx-auto p-6 bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-center mb-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                    <p className="text-white text-center">Validating linking token...</p>
                </div>
            </div>
        );
    }

    if (tokenInfo?.isExpired) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="max-w-md mx-auto p-6 bg-red-900/20 border border-red-500 rounded-lg">
                    <div className="text-center">
                        <div className="text-4xl mb-4">⏰</div>
                        <h1 className="text-xl font-bold text-red-400 mb-4">Link Expired</h1>
                        <p className="text-red-300 mb-6">
                            This Discord linking token has expired. Please generate a new one using the <code className="bg-red-800/30 px-2 py-1 rounded">/link</code> command in Discord.
                        </p>
                        <button
                            onClick={() => router.push('/integrations')}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        >
                            Go to Integrations
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (tokenInfo?.isUsed) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="max-w-md mx-auto p-6 bg-green-900/20 border border-green-500 rounded-lg">
                    <div className="text-center">
                        <div className="text-4xl mb-4">✅</div>
                        <h1 className="text-xl font-bold text-green-400 mb-4">Already Linked</h1>
                        <p className="text-green-300 mb-6">
                            This Discord account has already been linked to a wallet.
                        </p>
                        <button
                            onClick={() => router.push('/integrations')}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                        >
                            Go to Integrations
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="max-w-md mx-auto p-6 bg-slate-800 border border-blue-500 rounded-lg">
                    <div className="text-center">
                        <div className="text-4xl mb-4">🔗</div>
                        <h1 className="text-xl font-bold text-blue-400 mb-4">Connect Your Wallet</h1>
                        <p className="text-blue-300 mb-4">
                            To link Discord account <strong>@{tokenInfo?.discordUsername}</strong>, please connect your wallet first.
                        </p>
                        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-200">
                                🛡️ <strong>Secure Process:</strong> Your wallet signature proves ownership and creates a secure link between your Discord and wallet accounts.
                            </p>
                        </div>
                        <button
                            onClick={signIn}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            Connect Wallet
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="max-w-md mx-auto p-6 bg-slate-800 border border-green-500 rounded-lg">
                <div className="text-center">
                    <div className="text-4xl mb-4">
                        {isLinking ? (
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
                        ) : (
                            '🔗'
                        )}
                    </div>
                    <h1 className="text-xl font-bold text-green-400 mb-4">
                        {isLinking ? 'Linking Account...' : 'Linking Account'}
                    </h1>
                    <p className="text-green-300 mb-6">
                        {isLinking ? (
                            <>Linking Discord <strong>@{tokenInfo?.discordUsername}</strong> to your wallet...</>
                        ) : (
                            <>Ready to link Discord <strong>@{tokenInfo?.discordUsername}</strong> to your wallet.</>
                        )}
                    </p>

                    {!isLinking && !linkingFailed && (
                        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
                            <p className="text-sm text-green-200">
                                ✨ <strong>After linking:</strong> Your alerts will sync across Discord, Telegram, and web app!
                            </p>
                        </div>
                    )}

                    {isLinking && (
                        <div className="bg-slate-700 rounded-lg p-4">
                            <p className="text-sm text-slate-300">Please wait while we securely link your accounts...</p>
                        </div>
                    )}

                    {linkingFailed && !isLinking && (
                        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
                            <p className="text-sm text-red-200 mb-4">
                                ❌ <strong>Linking failed.</strong> This might be because the Discord account was already linked to another wallet.
                            </p>
                            <button
                                onClick={handleRetry}
                                className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors text-sm"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 