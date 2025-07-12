'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import toast from 'react-hot-toast';



export default function LinkExtensionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAuthenticated, user, signIn, refreshUser } = useAuth();
    const [tokenInfo, setTokenInfo] = useState<any>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [linkingAttempted, setLinkingAttempted] = useState(false);
    const [linkingFailed, setLinkingFailed] = useState(false);
    const [extensionDetected, setExtensionDetected] = useState(false);

    const connectionId = searchParams.get('connectionId');

    useEffect(() => {
        if (!connectionId) {
            router.push('/integrations');
            return;
        }

        // Generate token for this connection and get token info
        generateAndFetchToken();
    }, [connectionId]);

    useEffect(() => {
        if (isAuthenticated && tokenInfo && !tokenInfo.isUsed && !isLinking && !linkingAttempted) {
            handleLinking();
        }
    }, [isAuthenticated, tokenInfo, isLinking, linkingAttempted]);

    // Listen for extension ready event
    useEffect(() => {
        const handleExtensionReady = (event: CustomEvent) => {
            console.log('Extension is ready:', event.detail);
            setExtensionDetected(true);
        };

        document.addEventListener('strideExtensionReady', handleExtensionReady as EventListener);

        return () => {
            document.removeEventListener('strideExtensionReady', handleExtensionReady as EventListener);
        };
    }, []);

    const generateAndFetchToken = async () => {
        try {
            // First generate a token for this connection
            const generateResponse = await fetch('http://localhost:3001/api/auth/extension/generate-link-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connectionId: connectionId,
                    extensionId: 'stride-extension'
                })
            });

            const generateData = await generateResponse.json();

            if (!generateData.success) {
                toast.error('Failed to generate linking token');
                router.push('/integrations');
                return;
            }

            const token = generateData.data.token;

            // Now fetch token info
            const response = await fetch(`http://localhost:3001/api/auth/extension/token-info/${token}`);
            const data = await response.json();

            if (data.success) {
                setTokenInfo({ ...data.data, token });
            } else {
                toast.error('Invalid linking token');
                router.push('/integrations');
            }
        } catch (error) {
            console.error('Error with extension linking:', error);
            toast.error('Failed to initialize extension linking');
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
            const response = await apiService.linkExtensionWithToken(tokenInfo.token);

            if (response.success) {
                toast.success('Chrome extension linked successfully!');

                // Notify the extension about successful linking
                if (typeof window !== 'undefined' && response.data) {
                    try {
                        console.log('🧩 Notifying extension of successful connection:', {
                            hasToken: !!response.data.extensionToken,
                            hasUserData: !!response.data.userData,
                            connectionId: response.data.connectionId
                        });

                        // Use custom event approach (CSP-friendly)
                        const extensionEvent = new CustomEvent('strideExtensionConnect', {
                            detail: {
                                token: response.data.extensionToken,
                                userData: response.data.userData,
                                connectionId: response.data.connectionId
                            }
                        });
                        document.dispatchEvent(extensionEvent);
                        console.log('✅ Extension connection event dispatched');

                        // Listen for confirmation from extension
                        const handleConfirmation = (event: CustomEvent) => {
                            console.log('📨 Received extension confirmation:', event.detail);
                            if (event.detail.success) {
                                console.log('🎉 Extension confirmed successful connection');
                            } else {
                                console.warn('⚠️ Extension reported connection failure:', event.detail.message);
                            }
                        };

                        document.addEventListener('strideExtensionConnectConfirmed', handleConfirmation as EventListener, { once: true });

                        // Remove listener after 10 seconds if no response
                        setTimeout(() => {
                            document.removeEventListener('strideExtensionConnectConfirmed', handleConfirmation as EventListener);
                        }, 10000);

                    } catch (extensionError) {
                        console.log('⚠️ Extension not available for event communication:', extensionError);
                    }
                }

                // Refresh user data to include extension information
                await refreshUser();
                router.push('/integrations?linked=extension');
            } else {
                toast.error(response.error || 'Failed to link extension');
                setLinkingFailed(true);
            }
        } catch (error) {
            console.error('Extension linking error:', error);
            toast.error('Failed to link Chrome extension');
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
                    <p className="text-white text-center">Initializing extension linking...</p>
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
                            This Chrome extension has already been linked to a wallet.
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
                        <div className="text-4xl mb-4">🧩</div>
                        <h1 className="text-xl font-bold text-blue-400 mb-4">Connect Your Wallet</h1>
                        <p className="text-blue-300 mb-4">
                            To link your <strong>Stride Chrome Extension</strong>, please connect your wallet first.
                        </p>
                        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
                            <p className="text-sm text-blue-200">
                                🛡️ <strong>Secure Process:</strong> Your wallet signature proves ownership and creates a secure link between your extension and wallet accounts.
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
                            '🧩'
                        )}
                    </div>
                    <h1 className="text-xl font-bold text-green-400 mb-4">
                        {isLinking ? 'Linking Extension...' : 'Link Chrome Extension'}
                    </h1>
                    <p className="text-green-300 mb-6">
                        {isLinking ? (
                            <>Linking your <strong>Stride Chrome Extension</strong> to your wallet...</>
                        ) : (
                            <>Ready to link your <strong>Stride Chrome Extension</strong> to your wallet.</>
                        )}
                    </p>

                    {!isLinking && !linkingFailed && (
                        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
                            <p className="text-sm text-green-200 mb-2">
                                ✨ <strong>After linking:</strong>
                            </p>
                            <ul className="text-sm text-green-200 text-left space-y-1">
                                <li>• Set alerts directly from token pages</li>
                                <li>• Sync alerts across all platforms</li>
                                <li>• Persistent overlay preferences</li>
                                <li>• Access to your dashboard</li>
                            </ul>
                            {extensionDetected && (
                                <div className="mt-3 p-2 bg-green-800/20 border border-green-600 rounded text-xs text-green-300">
                                    ✅ Chrome extension detected and ready
                                </div>
                            )}
                        </div>
                    )}

                    {isLinking && (
                        <div className="bg-slate-700 rounded-lg p-4">
                            <p className="text-sm text-slate-300">Please wait while we securely link your extension...</p>
                        </div>
                    )}

                    {linkingFailed && !isLinking && (
                        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
                            <p className="text-sm text-red-200 mb-4">
                                ❌ <strong>Linking failed.</strong> Please try again or check your connection.
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