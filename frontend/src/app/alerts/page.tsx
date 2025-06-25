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
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-100 font-heading">Alerts</h1>
                        <p className="text-gray-400 mt-1">
                            Manage your token price and market cap alerts
                        </p>
                        {user?.telegramChatId && (
                            <p className="text-cyan-400 text-sm mt-2">
                                🤖 Telegram Bot Connected - Alerts sync automatically
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => setShowCreateForm(true)}
                        className="btn-primary"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create Alert
                    </button>
                </div>

                {/* Create Alert Form Modal */}
                {showCreateForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-gray-100">Create New Alert</h2>
                                    <button
                                        onClick={() => setShowCreateForm(false)}
                                        className="text-gray-400 hover:text-gray-200"
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
                <div className="card-elevated">
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
                        className="btn-secondary disabled:opacity-50"
                    >
                        {alertsLoading ? (
                            <>
                                <div className="spinner w-4 h-4 mr-2"></div>
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