'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface WalletButtonProps {
    className?: string;
}

export default function WalletButton({ className }: WalletButtonProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button className={className || "btn-primary"} disabled>
                Connect Wallet
            </button>
        );
    }

    return <WalletMultiButton className={className} />;
} 