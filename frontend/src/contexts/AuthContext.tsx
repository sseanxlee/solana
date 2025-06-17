'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface User {
    id: string;
    walletAddress: string;
    email?: string;
    telegramChatId?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    signIn: () => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [signInAttempts, setSignInAttempts] = useState(0);
    const { publicKey, signMessage, connected } = useWallet();

    const isAuthenticated = !!user && !!token;
    const MAX_SIGN_IN_ATTEMPTS = 3;

    useEffect(() => {
        console.log('AuthProvider: Checking for stored auth data...');
        // Check for stored token on mount
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        if (storedToken && storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                console.log('AuthProvider: Found stored auth data for wallet:', userData.walletAddress);
                setToken(storedToken);
                setUser(userData);
                apiService.setAuthToken(storedToken);

                // Reset sign-in attempts when restoring stored auth
                setSignInAttempts(0);
            } catch (error) {
                console.error('AuthProvider: Error parsing stored user data:', error);
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            }
        } else {
            console.log('AuthProvider: No stored auth data found');
        }

        setIsLoading(false);
    }, []);

    useEffect(() => {
        console.log('AuthProvider: Wallet state changed - connected:', connected, 'isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

        // Auto sign out if wallet disconnected (but only if we've been authenticated with a connected wallet before)
        // Don't sign out immediately on page load when restoring from localStorage
        if (!connected && isAuthenticated && !isLoading) {
            // Give some time for wallet to auto-connect before signing out
            const timeoutId = setTimeout(() => {
                if (!connected && isAuthenticated) {
                    console.log('AuthProvider: Wallet failed to reconnect, signing out');
                    signOut();
                    setSignInAttempts(0);
                }
            }, 3000); // Wait 3 seconds for wallet to reconnect

            return () => clearTimeout(timeoutId);
        }

        // Auto sign in when wallet connects (if not already authenticated and no stored auth data)
        if (connected && !isAuthenticated && !isLoading && publicKey && signInAttempts < MAX_SIGN_IN_ATTEMPTS) {
            // Check if we have stored auth data for this wallet
            const storedToken = localStorage.getItem('auth_token');
            const storedUser = localStorage.getItem('auth_user');

            // If we have stored data, check if it's for the same wallet
            if (storedToken && storedUser) {
                try {
                    const userData = JSON.parse(storedUser);
                    if (userData.walletAddress === publicKey.toBase58()) {
                        console.log('AuthProvider: Found matching stored auth data, not auto-signing');
                        return; // Don't auto-sign if we have stored data for this wallet
                    }
                } catch (error) {
                    console.error('AuthProvider: Error parsing stored user data:', error);
                }
            }

            console.log('AuthProvider: Auto-signing in with wallet:', publicKey.toBase58(), 'Attempt:', signInAttempts + 1);

            // Add a small delay to ensure wallet is fully ready
            const timeoutId = setTimeout(() => {
                setSignInAttempts(prev => prev + 1);
                signIn().catch(error => {
                    console.error('AuthProvider: Auto sign-in failed:', error);
                    if (signInAttempts >= MAX_SIGN_IN_ATTEMPTS - 1) {
                        toast.error('Failed to sign in after multiple attempts. Please try manually.');
                    } else {
                        toast.error('Failed to sign in automatically. Retrying...');
                    }
                });
            }, 1000); // 1 second delay

            return () => clearTimeout(timeoutId);
        }
    }, [connected, isAuthenticated, isLoading, publicKey, signInAttempts]);

    const signIn = async () => {
        if (!publicKey || !signMessage) {
            const error = 'Wallet not connected or does not support message signing';
            console.error('AuthProvider: signIn failed -', error);
            throw new Error(error);
        }

        try {
            console.log('AuthProvider: Starting sign-in process...');
            setIsLoading(true);

            const walletAddress = publicKey.toBase58();
            console.log('AuthProvider: Wallet address:', walletAddress);

            // Get nonce from server
            console.log('AuthProvider: Requesting nonce from server...');
            const nonceResponse = await apiService.getNonce(walletAddress);
            console.log('AuthProvider: Nonce response:', nonceResponse);

            if (!nonceResponse.success || !nonceResponse.data) {
                const error = nonceResponse.error || 'Failed to get authentication nonce';
                console.error('AuthProvider: Nonce request failed:', error);
                throw new Error(error);
            }

            const { message, nonce } = nonceResponse.data;
            console.log('AuthProvider: Got nonce:', nonce);

            // Sign the message
            console.log('AuthProvider: Requesting message signature from wallet...');
            const messageBytes = new TextEncoder().encode(message);
            const signature = await signMessage(messageBytes);
            console.log('AuthProvider: Message signed successfully');

            // Convert signature to comma-separated string
            const signatureString = Array.from(signature).join(',');

            // Send signed message to server
            console.log('AuthProvider: Sending authentication request to server...');
            const authResponse = await apiService.signIn({
                walletAddress,
                signature: signatureString,
                message
            });
            console.log('AuthProvider: Auth response:', authResponse);

            if (!authResponse.success || !authResponse.data) {
                const error = authResponse.error || 'Authentication failed';
                console.error('AuthProvider: Authentication failed:', error);
                throw new Error(error);
            }

            const { token: authToken, user: userData } = authResponse.data;
            console.log('AuthProvider: Authentication successful for user:', userData.walletAddress);

            // Store auth data
            setToken(authToken);
            setUser(userData);
            apiService.setAuthToken(authToken);

            localStorage.setItem('auth_token', authToken);
            localStorage.setItem('auth_user', JSON.stringify(userData));

            console.log('AuthProvider: Sign-in completed successfully');
            toast.success('Successfully signed in!');

            // Reset sign-in attempts on successful authentication
            setSignInAttempts(0);

        } catch (error: any) {
            console.error('AuthProvider: Sign in error:', error);
            toast.error(error.message || 'Failed to sign in');
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = () => {
        console.log('AuthProvider: Signing out...');
        setUser(null);
        setToken(null);
        apiService.setAuthToken(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        toast.success('Signed out successfully');
    };

    const value: AuthContextType = {
        user,
        token,
        isAuthenticated,
        isLoading,
        signIn,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 