'use client';

import { useWallet } from '../contexts/WalletContext';
import { useState } from 'react';

interface WalletButtonProps {
    className?: string;
}

export default function WalletButton({ className }: WalletButtonProps) {
    const { connected, connecting, publicKey, connect, disconnect } = useWallet();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        if (connected) {
            try {
                setIsLoading(true);
                await disconnect();
            } catch (error: any) {
                console.error('Disconnect error:', error);
            } finally {
                setIsLoading(false);
            }
        } else {
            try {
                setIsLoading(true);
                await connect();
            } catch (error: any) {
                console.error('Connect error:', error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const formatAddress = (address: string) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    const isButtonLoading = isLoading || connecting;

    return (
        <button
            onClick={handleClick}
            disabled={isButtonLoading}
            className={className || "bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-all duration-300 px-6 py-2 rounded-lg font-medium"}
        >
            {isButtonLoading ? (
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                </div>
            ) : connected && publicKey ? (
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>{formatAddress(publicKey)}</span>
                </div>
            ) : (
                'Connect Wallet'
            )}
        </button>
    );
} 