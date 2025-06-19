'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PhantomProvider {
    isPhantom?: boolean;
    connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
    disconnect: () => Promise<void>;
    signMessage: (message: Uint8Array) => Promise<Uint8Array>;
    on: (event: string, callback: (args: any) => void) => void;
    off: (event: string, callback: (args: any) => void) => void;
    isConnected: boolean;
    publicKey: { toString(): string } | null;
}

interface WalletContextType {
    phantom: PhantomProvider | null;
    connected: boolean;
    connecting: boolean;
    publicKey: string | null;
    signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletContextProviderProps {
    children: ReactNode;
}

export const WalletContextProvider: React.FC<WalletContextProviderProps> = ({ children }) => {
    const [phantom, setPhantom] = useState<PhantomProvider | null>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [publicKey, setPublicKey] = useState<string | null>(null);

    // Check for Phantom provider (following Phantom docs)
    const getProvider = (): PhantomProvider | null => {
        if (typeof window !== 'undefined') {
            if ('phantom' in window) {
                const provider = (window as any).phantom?.solana;
                if (provider?.isPhantom) {
                    return provider;
                }
            }
        }
        return null;
    };

    useEffect(() => {
        const provider = getProvider();
        if (provider) {
            setPhantom(provider);

            // Check if already connected
            if (provider.isConnected && provider.publicKey) {
                setConnected(true);
                setPublicKey(provider.publicKey.toString());
            }
            // Note: Not attempting auto-connect to avoid unwanted popups
            // Users will manually connect wallet when needed

            // Set up event listeners
            const handleConnect = (publicKey: { toString(): string }) => {
                console.log('Phantom wallet connected:', publicKey.toString());
                setConnected(true);
                setPublicKey(publicKey.toString());
                setConnecting(false);
            };

            const handleDisconnect = () => {
                console.log('Phantom wallet disconnected');
                setConnected(false);
                setPublicKey(null);
                setConnecting(false);
            };

            provider.on('connect', handleConnect);
            provider.on('disconnect', handleDisconnect);

            return () => {
                provider.off('connect', handleConnect);
                provider.off('disconnect', handleDisconnect);
            };
        }
    }, []);

    const connect = async (): Promise<void> => {
        if (!phantom) {
            // Check if Phantom is available at all
            const provider = getProvider();
            if (!provider) {
                // Redirect to Phantom download
                window.open('https://phantom.app/', '_blank');
                throw new Error('Phantom wallet not found. Please install Phantom wallet.');
            }
            setPhantom(provider);
        }

        try {
            setConnecting(true);
            const currentProvider = phantom || getProvider();
            if (!currentProvider) {
                throw new Error('Phantom wallet not available');
            }

            const response = await currentProvider.connect();
            console.log('Connected to Phantom:', response.publicKey.toString());
            setConnected(true);
            setPublicKey(response.publicKey.toString());
        } catch (error: any) {
            console.error('Failed to connect to Phantom:', error);
            if (error.code === 4001) {
                throw new Error('User rejected the connection request.');
            } else {
                throw new Error(error.message || 'Failed to connect to Phantom wallet');
            }
        } finally {
            setConnecting(false);
        }
    };

    const disconnect = async (): Promise<void> => {
        if (!phantom) return;

        try {
            await phantom.disconnect();
            setConnected(false);
            setPublicKey(null);
        } catch (error: any) {
            console.error('Failed to disconnect from Phantom:', error);
            throw new Error(error.message || 'Failed to disconnect from Phantom wallet');
        }
    };

    const value: WalletContextType = {
        phantom,
        connected,
        connecting,
        publicKey,
        signMessage: phantom?.signMessage,
        connect,
        disconnect,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletContextProvider');
    }
    return context;
}; 