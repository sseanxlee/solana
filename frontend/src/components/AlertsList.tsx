'use client';

import { useState } from 'react';
import { TokenAlert } from '../services/api';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

interface AlertsListProps {
    alerts: TokenAlert[];
    isLoading: boolean;
    onAlertUpdated: (alert: TokenAlert) => void;
    onAlertDeleted: (alertId: string) => void;
}

export default function AlertsList({
    alerts,
    isLoading,
    onAlertUpdated,
    onAlertDeleted
}: AlertsListProps) {
    const [deletingAlerts, setDeletingAlerts] = useState<Set<string>>(new Set());
    const [testingAlerts, setTestingAlerts] = useState<Set<string>>(new Set());

    const handleToggleAlert = async (alertId: string, currentlyActive: boolean) => {
        try {
            const response = await apiService.updateAlert(alertId, {
                isActive: !currentlyActive
            });

            if (response.success && response.data) {
                onAlertUpdated(response.data);
                toast.success(
                    `Alert ${!currentlyActive ? 'activated' : 'deactivated'} successfully`
                );
            }
        } catch (error: any) {
            console.error('Error toggling alert:', error);
            toast.error(error.error || 'Failed to update alert');
        }
    };

    const handleDeleteAlert = async (alertId: string) => {
        if (!confirm('Are you sure you want to delete this alert?')) {
            return;
        }

        try {
            setDeletingAlerts(prev => new Set(prev).add(alertId));

            const response = await apiService.deleteAlert(alertId);

            if (response.success) {
                onAlertDeleted(alertId);
                toast.success('Alert deleted successfully');
            }
        } catch (error: any) {
            console.error('Error deleting alert:', error);
            toast.error(error.error || 'Failed to delete alert');
        } finally {
            setDeletingAlerts(prev => {
                const newSet = new Set(prev);
                newSet.delete(alertId);
                return newSet;
            });
        }
    };

    const handleTestAlert = async (alertId: string) => {
        try {
            setTestingAlerts(prev => new Set(prev).add(alertId));

            const response = await apiService.testAlert(alertId);

            if (response.success) {
                toast.success(response.message || 'Test notification sent!');
            }
        } catch (error: any) {
            console.error('Error testing alert:', error);
            toast.error(error.error || 'Failed to send test notification');
        } finally {
            setTestingAlerts(prev => {
                const newSet = new Set(prev);
                newSet.delete(alertId);
                return newSet;
            });
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (alert: TokenAlert) => {
        if (alert.is_triggered) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Triggered
                </span>
            );
        }

        if (alert.is_active) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Active
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Inactive
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading alerts...</p>
                </div>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-12a3 3 0 013-3h4a3 3 0 013 3v12z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts yet</h3>
                <p className="text-gray-500 mb-4">
                    Create your first alert to start monitoring token prices and market caps.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {alerts.map((alert) => (
                <div key={alert.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                                <h3 className="text-lg font-medium text-gray-900">
                                    {alert.token_name || 'Unknown Token'}
                                    {alert.token_symbol && (
                                        <span className="text-gray-500"> ({alert.token_symbol})</span>
                                    )}
                                </h3>
                                {getStatusBadge(alert)}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                                <div>
                                    <span className="font-medium">Address:</span>
                                    <br />
                                    <span className="font-mono text-xs">
                                        {alert.token_address.slice(0, 8)}...{alert.token_address.slice(-8)}
                                    </span>
                                </div>

                                <div>
                                    <span className="font-medium">Alert:</span>
                                    <br />
                                    {alert.threshold_type} {alert.condition} ${alert.threshold_value.toLocaleString()}
                                </div>

                                <div>
                                    <span className="font-medium">Notification:</span>
                                    <br />
                                    {alert.notification_type}
                                </div>

                                <div>
                                    <span className="font-medium">Created:</span>
                                    <br />
                                    {formatDate(alert.created_at)}
                                </div>
                            </div>

                            {alert.is_triggered && alert.triggered_at && (
                                <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                                    <span className="font-medium">Triggered:</span> {formatDate(alert.triggered_at)}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                            {/* Test Button */}
                            {alert.is_active && !alert.is_triggered && (
                                <button
                                    onClick={() => handleTestAlert(alert.id)}
                                    disabled={testingAlerts.has(alert.id)}
                                    className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md transition-colors"
                                    title="Test notification"
                                >
                                    {testingAlerts.has(alert.id) ? 'Testing...' : 'Test'}
                                </button>
                            )}

                            {/* Toggle Button */}
                            {!alert.is_triggered && (
                                <button
                                    onClick={() => handleToggleAlert(alert.id, alert.is_active)}
                                    className={`text-sm px-3 py-1 rounded-md transition-colors ${alert.is_active
                                            ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                                            : 'bg-green-100 hover:bg-green-200 text-green-700'
                                        }`}
                                >
                                    {alert.is_active ? 'Pause' : 'Activate'}
                                </button>
                            )}

                            {/* Delete Button */}
                            <button
                                onClick={() => handleDeleteAlert(alert.id)}
                                disabled={deletingAlerts.has(alert.id)}
                                className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md transition-colors"
                            >
                                {deletingAlerts.has(alert.id) ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
} 