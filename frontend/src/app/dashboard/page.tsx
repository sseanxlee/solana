'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiService, TokenAlert } from '../../services/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';
import CreateAlertForm from '../../components/CreateAlertForm';
import AlertsList from '../../components/AlertsList';

export default function Dashboard() {
    const { connected, publicKey } = useWallet();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [alerts, setAlerts] = useState<TokenAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [prefilledTokenAddress, setPrefilledTokenAddress] = useState<string>('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/');
            return;
        }

        if (isAuthenticated) {
            loadAlerts();

            // Check for create_alert query parameter
            const createAlert = searchParams.get('create_alert');
            if (createAlert) {
                setPrefilledTokenAddress(createAlert);
                setShowCreateForm(true);
                // Clear the query parameter
                router.replace('/dashboard');
            }
        }
    }, [isAuthenticated, authLoading, router, searchParams]);

    const loadAlerts = async () => {
        try {
            setIsLoading(true);
            const response = await apiService.getAlerts();
            if (response.success && response.data) {
                setAlerts(response.data);
            }
        } catch (error: any) {
            console.error('Error loading alerts:', error);
            toast.error(error.error || 'Failed to load alerts');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAlertCreated = (newAlert: TokenAlert) => {
        setAlerts(prev => [newAlert, ...prev]);
        setShowCreateForm(false);
        toast.success('Alert created successfully!');
    };

    const handleAlertUpdated = (updatedAlert: TokenAlert) => {
        setAlerts(prev =>
            prev.map(alert =>
                alert.id === updatedAlert.id ? updatedAlert : alert
            )
        );
    };

    const handleAlertDeleted = (alertId: string) => {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    };

    if (authLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-gray-400">
                        {authLoading ? 'Authenticating...' : 'Redirecting to login...'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-100">Dashboard</h1>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="btn-primary flex items-center space-x-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Create Alert</span>
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-800/50 rounded-lg flex items-center justify-center border border-primary-700/50">
                                <span className="text-primary-300 text-sm font-semibold">
                                    {alerts.filter(a => a.is_active).length}
                                </span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Active Alerts</p>
                                <p className="text-lg font-semibold text-gray-200">
                                    {alerts.filter(a => a.is_active).length} / {alerts.length}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-accent-800/50 rounded-lg flex items-center justify-center border border-accent-700/50">
                                <span className="text-accent-300 text-sm font-semibold">
                                    {alerts.filter(a => a.is_triggered).length}
                                </span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Triggered</p>
                                <p className="text-lg font-semibold text-gray-200">
                                    {alerts.filter(a => a.is_triggered).length}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="flex items-center">
                            <div className="w-10 h-10 bg-primary-800/50 rounded-lg flex items-center justify-center border border-primary-700/50">
                                <span className="text-primary-300 text-sm font-semibold">
                                    {new Set(alerts.map(a => a.token_address)).size}
                                </span>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-400">Unique Tokens</p>
                                <p className="text-lg font-semibold text-gray-200">
                                    {new Set(alerts.map(a => a.token_address)).size}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerts List */}
                <div className="card-elevated">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-gray-100">Your Alerts</h2>
                        {alerts.length > 0 && (
                            <button
                                onClick={loadAlerts}
                                className="btn-secondary text-sm flex items-center space-x-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="spinner w-3 h-3"></div>
                                        <span>Refreshing...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Refresh</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <AlertsList
                        alerts={alerts}
                        isLoading={isLoading}
                        onAlertUpdated={handleAlertUpdated}
                        onAlertDeleted={handleAlertDeleted}
                    />
                </div>
            </div>

            {/* Create Alert Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-100">Create New Alert</h2>
                                <button
                                    onClick={() => setShowCreateForm(false)}
                                    className="text-gray-400 hover:text-gray-200 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <CreateAlertForm
                                onAlertCreated={handleAlertCreated}
                                onCancel={() => setShowCreateForm(false)}
                                prefilledTokenAddress={prefilledTokenAddress}
                            />
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
} 