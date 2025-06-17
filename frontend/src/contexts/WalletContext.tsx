'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
// Import wallet adapter CSS
require('@solana/wallet-adapter-react-ui/styles.css');

const WalletContext = createContext({});

interface WalletContextProviderProps {
    children: ReactNode;
}

export const WalletContextProvider: React.FC<WalletContextProviderProps> = ({ children }) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
    const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta') as WalletAdapterNetwork;

    // You can also provide a custom RPC endpoint
    const endpoint = React.useMemo(() => {
        switch (network) {
            case 'mainnet-beta':
                return 'https://api.mainnet-beta.solana.com';
            case 'testnet':
                return 'https://api.testnet.solana.com';
            case 'devnet':
                return 'https://api.devnet.solana.com';
            default:
                return 'https://api.mainnet-beta.solana.com';
        }
    }, [network]);

    const wallets = React.useMemo(
        () => [
            new PhantomWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider
                wallets={wallets}
                autoConnect={true}
                localStorageKey="walletAdapter"
            >
                <WalletModalProvider>
                    <WalletContext.Provider value={{}}>
                        {children}
                    </WalletContext.Provider>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export const useWalletContext = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWalletContext must be used within a WalletContextProvider');
    }
    return context;
}; 