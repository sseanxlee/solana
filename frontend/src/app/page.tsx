'use client';

import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';

// BeginButton component that handles authentication flow
function BeginButton() {
    const { connected, connect: connectWallet } = useWallet();
    const { isAuthenticated, signIn } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const hasAttemptedAutoSignIn = useRef(false);

    const handleBeginClick = async () => {
        try {
            setIsLoading(true);

            // Step 1: Connect wallet if not connected
            if (!connected) {
                await connectWallet();
                toast.success('Wallet connected! Now click "Sign In" to authenticate.');
                return;
            }

            // Step 2: Authenticate if connected but not authenticated
            if (!isAuthenticated) {
                await signIn();
                // Navigation will be handled by the useEffect in Home component
                return;
            }

            // Step 3: Navigate to dashboard if already authenticated and connected
            router.push('/dashboard');
        } catch (error: any) {
            toast.error(error.message || error.error || 'Failed to continue');
        } finally {
            setIsLoading(false);
        }
    };

    // Disabled auto-progression to prevent infinite loops
    // Users will manually click through the steps
    // useEffect(() => {
    //     if (connected && !isAuthenticated && !isLoading && !hasAttemptedAutoSignIn.current) {
    //         hasAttemptedAutoSignIn.current = true;
    //         signIn().catch((error) => {
    //             console.error('Auto sign-in error:', error);
    //         });
    //     }
    // }, [connected, isAuthenticated, isLoading, signIn]);

    // Reset the auto sign-in flag when wallet disconnects
    useEffect(() => {
        if (!connected) {
            hasAttemptedAutoSignIn.current = false;
        }
    }, [connected]);

    const getButtonText = () => {
        if (isLoading) return 'Connecting...';
        if (isAuthenticated && !connected) return 'Connect Wallet'; // Authenticated but wallet not connected
        if (!connected) return 'Connect Wallet';
        if (!isAuthenticated) return 'Sign In';
        return 'Go to Dashboard'; // Already connected and authenticated
    };

    return (
        <button
            onClick={handleBeginClick}
            disabled={isLoading}
            className="bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform disabled:transform-none disabled:shadow-lg"
        >
            {getButtonText()}
        </button>
    );
}

export default function Home() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Redirect to dashboard if user is authenticated (regardless of wallet connection)
        // Dashboard can be accessed with just authentication; wallet connection is optional
        if (!isLoading && isAuthenticated) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, isLoading, router]);

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <div className="h-screen w-screen overflow-hidden relative">
                {/* Background Image */}
                <div
                    className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat bg-blue-900"
                    style={{ backgroundImage: 'url(/ggs.png)' }}
                ></div>

                {/* Overlay for better text readability */}
                <div className="absolute inset-0 z-10 bg-black/20"></div>

                {/* Loading Content */}
                <main className="relative z-20 h-full flex items-center justify-center">
                    <div className="text-center px-6">
                        <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black text-gray-300 tracking-tight leading-none mb-8">
                            STRIDE
                        </h1>
                        <div className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
                            <div className="w-4 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-4 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <p className="text-white/70 mt-4">Checking authentication...</p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen overflow-hidden relative">
            {/* Background Image */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat bg-blue-900"
                style={{ backgroundImage: 'url(/ggs.png)' }}
            ></div>

            {/* Overlay for better text readability */}
            <div className="absolute inset-0 z-10 bg-black/20"></div>

            {/* Header */}
            <header className="relative z-20 p-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <img src="/logo.png" alt="Stride Logo" className="w-8 h-8 invert" />
                        <span className="text-xl font-bold text-white">Stride</span>
                    </div>
                </div>
            </header>

            {/* Main Content - Centered */}
            <main className="relative z-20 h-full flex items-center justify-center pt-0 -mt-16">
                <div className="text-center px-6 max-w-4xl mx-auto">
                    {/* Main Headline */}
                    <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black text-gray-300 tracking-tight leading-none mb-8">
                        STRIDE
                    </h1>

                    {/* Subtitle */}
                    <p className="text-xl sm:text-2xl text-white/90 font-medium mb-4 max-w-2xl mx-auto">
                        Advanced real-time alerts for Solana tokens
                    </p>

                    <p className="text-lg text-white mb-8 underline decoration-primary-400 decoration-2 underline-offset-4">
                        Never miss a win
                    </p>

                    {/* Begin Button */}
                    <BeginButton />
                </div>
            </main>

            {/* Footer */}
            <footer className="absolute bottom-0 left-0 right-0 z-20 p-6">
                <div className="text-center">
                    <p className="text-white/60 text-sm">
                        © 2024 Stride. Your advantage in Solana trading.
                    </p>
                </div>
            </footer>
        </div>
    );
} 