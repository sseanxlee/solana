'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AlertsList from '../../components/AlertsList';
import CreateAlertForm from '../../components/CreateAlertForm';
import { apiService, TokenAlert } from '../../services/api';
import toast from 'react-hot-toast';

export default function AlertsPage() {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();
    const [alerts, setAlerts] = useState<TokenAlert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showApiLimitWarning, setShowApiLimitWarning] = useState(true);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, isLoading, router]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchAlerts();
        }
    }, [isAuthenticated]);

    const fetchAlerts = async () => {
        try {
            setAlertsLoading(true);
            const response = await apiService.getAlerts();

            if (response.success && response.data) {
                setAlerts(response.data);
            } else {
                console.error('Failed to fetch alerts:', response.error);
                toast.error('Failed to fetch alerts');
            }
        } catch (error) {
            console.error('Error fetching alerts:', error);
            toast.error('Error fetching alerts');
        } finally {
            setAlertsLoading(false);
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

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6" style={{ fontFamily: "'Funnel Sans', sans-serif" }}>
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                            Alerts
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Manage your token price and market cap alerts
                        </p>
                        {user?.telegramChatId && (
                            <div className="flex items-center space-x-2 mt-3">
                                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                <p className="text-cyan-400 text-sm font-medium">
                                    Telegram Bot Connected - Alerts sync automatically
                                </p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 rounded-lg text-sm font-medium transition-all duration-200"
                        style={{ fontFamily: "'Exo 2', sans-serif" }}
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Alert
                    </button>
                </div>

                {/* API Limitation Warning Modal */}
                {showApiLimitWarning && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl max-w-md w-full shadow-2xl">
                            <div className="p-6">
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                                        <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                                        API Limitation Notice
                                    </h2>
                                </div>

                                <div className="mb-6">
                                    <p className="text-slate-300 mb-3">
                                        Due to current API limitations, you can only create alerts for <strong>one token address</strong> at a time.
                                    </p>
                                    <p className="text-slate-400 text-sm">
                                        We're working on upgrading to an enterprise plan to support multiple tokens simultaneously.
                                    </p>
                                </div>

                                <div className="flex justify-end space-x-3">
                                    <button
                                        onClick={() => setShowApiLimitWarning(false)}
                                        className="px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 rounded-lg text-sm font-medium transition-all duration-200"
                                        style={{ fontFamily: "'Exo 2', sans-serif" }}
                                    >
                                        I Understand
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create Alert Form Modal */}
                {showCreateForm && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-slate-900 border border-slate-700/50 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                                        Create New Alert
                                    </h2>
                                    <button
                                        onClick={() => setShowCreateForm(false)}
                                        className="text-slate-400 hover:text-white transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <CreateAlertForm
                                    onAlertCreated={handleAlertCreated}
                                    onCancel={() => setShowCreateForm(false)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Alerts List */}
                <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-6">
                    <AlertsList
                        alerts={alerts}
                        isLoading={alertsLoading}
                        onAlertUpdated={handleAlertUpdated}
                        onAlertDeleted={handleAlertDeleted}
                    />
                </div>

                {/* Refresh Button */}
                <div className="flex justify-center">
                    <button
                        onClick={fetchAlerts}
                        disabled={alertsLoading}
                        className="flex items-center px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-slate-600/50 hover:border-slate-500/50 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ fontFamily: "'Exo 2', sans-serif" }}
                    >
                        {alertsLoading ? (
                            <>
                                <div className="animate-spin rounded-full w-4 h-4 border-b-2 border-slate-300 mr-2"></div>
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh Alerts
                            </>
                        )}
                    </button>
                </div>
            </div>
        </DashboardLayout>
    );
} 