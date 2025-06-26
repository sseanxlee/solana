import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { WalletContextProvider } from '../contexts/WalletContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ChartProvider } from '../contexts/ChartContext';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
    title: 'Stride - Professional Solana Token Analytics',
    description: 'Advanced real-time analytics and alerts for Solana tokens',
    keywords: ['Solana', 'Token', 'Analytics', 'Trading', 'DeFi', 'Professional'],
    authors: [{ name: 'Stride' }],
    icons: {
        icon: '/logo.png',
        shortcut: '/logo.png',
        apple: '/logo.png',
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
                <link rel="icon" href="/logo.png" sizes="any" />
                <link rel="icon" href="/logo.png" type="image/png" />
                <link rel="apple-touch-icon" href="/logo.png" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700&family=Funnel+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body>
                <WalletContextProvider>
                    <AuthProvider>
                        <ChartProvider>
                            <div className="min-h-screen bg-gray-950">
                                {children}
                            </div>
                            <Toaster
                                position="top-center"
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
                        </ChartProvider>
                    </AuthProvider>
                </WalletContextProvider>
            </body>
        </html>
    );
} 