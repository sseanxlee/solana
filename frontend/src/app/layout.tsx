import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { WalletContextProvider } from '../contexts/WalletContext';
import { AuthProvider } from '../contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
    title: 'Stride - Professional Solana Token Analytics',
    description: 'Advanced real-time analytics and alerts for Solana tokens',
    keywords: ['Solana', 'Token', 'Analytics', 'Trading', 'DeFi', 'Professional'],
    authors: [{ name: 'Stride' }],
    icons: {
        icon: '/favicon.ico',
        shortcut: '/favicon.ico',
        apple: '/favicon.ico',
    },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="icon" href="/logo.svg" type="image/svg+xml" />
                <link rel="apple-touch-icon" href="/favicon.ico" />
            </head>
            <body className={GeistSans.className}>
                <WalletContextProvider>
                    <AuthProvider>
                        <div className="min-h-screen bg-gray-950">
                            {children}
                        </div>
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                duration: 4000,
                                style: {
                                    background: '#1f2937',
                                    color: '#f9fafb',
                                    border: '1px solid #374151',
                                },
                                success: {
                                    duration: 3000,
                                    iconTheme: {
                                        primary: '#059669',
                                        secondary: '#f9fafb',
                                    },
                                },
                                error: {
                                    duration: 5000,
                                    iconTheme: {
                                        primary: '#dc2626',
                                        secondary: '#f9fafb',
                                    },
                                },
                            }}
                        />
                    </AuthProvider>
                </WalletContextProvider>
            </body>
        </html>
    );
} 