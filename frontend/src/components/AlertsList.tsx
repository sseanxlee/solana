'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TokenAlert } from '../services/api';
import { apiService } from '../services/api';
import TokenLogo from './TokenLogo';
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
    const router = useRouter();
    const [deletingAlerts, setDeletingAlerts] = useState<Set<string>>(new Set());
    const [testingAlerts, setTestingAlerts] = useState<Set<string>>(new Set());
    const [monitoringStatus, setMonitoringStatus] = useState<any>(null);

    useEffect(() => {
        fetchMonitoringStatus();
    }, []);

    const fetchMonitoringStatus = async () => {
        try {
            const response = await apiService.getMonitoringStatus();
            if (response.success && response.data) {
                setMonitoringStatus(response.data);
            }
        } catch (error) {
            console.error('Error fetching monitoring status:', error);
        }
    };

    const handleAlertClick = (alert: TokenAlert) => {
        // Navigate to search page with the token address
        router.push(`/search?token=${alert.token_address}`);
    };

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
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (alert: TokenAlert) => {
        if (alert.cleared_at) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-300 border border-slate-500/30">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1.5"></div>
                    Cleared
                </span>
            );
        }

        if (alert.is_triggered) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
                    Triggered
                </span>
            );
        }

        if (alert.is_active) {
            return (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full mr-1.5"></div>
                    Active
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400 border border-slate-600/50">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5"></div>
                Inactive
            </span>
        );
    };

    const formatThresholdValue = (value: number, type: string) => {
        if (type === 'market_cap') {
            if (value >= 1000000000) {
                return `$${(value / 1000000000).toFixed(2)}B`;
            } else if (value >= 1000000) {
                return `$${(value / 1000000).toFixed(2)}M`;
            } else if (value >= 1000) {
                return `$${(value / 1000).toFixed(1)}K`;
            }
            return `$${value.toFixed(2)}`;
        }
        return `$${value.toLocaleString()}`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading alerts...</p>
                </div>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-slate-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-5 5-5-5h5v-12a3 3 0 013-3h4a3 3 0 013 3v12z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2" style={{ fontFamily: "'Exo 2', sans-serif" }}>No alerts yet</h3>
                <p className="text-slate-400 mb-4">
                    Create your first alert to start monitoring token prices and market caps.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Monitoring Status Header */}
            {monitoringStatus && (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${monitoringStatus.system.botRunning ? 'bg-green-400' : 'bg-red-400'}`}></div>
                            <div>
                                <h4 className="text-sm font-medium text-white">System Status</h4>
                                <p className="text-xs text-slate-400">
                                    {monitoringStatus.system.botRunning ? 'Monitoring Active' : 'Monitoring Inactive'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-white font-medium">
                                {monitoringStatus.user.activeAlerts} Active Alerts
                            </div>
                            <div className="text-xs text-slate-400">
                                {monitoringStatus.user.tokens.length} Tokens Tracked
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {alerts.map((alert) => (
                <div
                    key={alert.id}
                    className="bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-all duration-200 hover:bg-slate-800/60 cursor-pointer"
                    onClick={() => handleAlertClick(alert)}
                >
                    <div className="flex items-center justify-between">
                        {/* Left side - Token info and alert details */}
                        <div className="flex items-center space-x-4 flex-1">
                            {/* Token Logo */}
                            <TokenLogo tokenAddress={alert.token_address} tokenSymbol={alert.token_symbol} />

                            {/* Token & Alert Info */}
                            <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-1">
                                    <h3 className="text-base font-semibold text-white" style={{ fontFamily: "'Exo 2', sans-serif" }}>
                                        {alert.token_name || 'Unknown Token'}
                                        {alert.token_symbol && (
                                            <span className="text-slate-400 font-normal ml-1">(${alert.token_symbol.toUpperCase()})</span>
                                        )}
                                    </h3>
                                    {getStatusBadge(alert)}
                                </div>

                                <div className="flex items-center space-x-6 text-sm">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-slate-500">Alert:</span>
                                        <span className="text-white font-medium">
                                            {alert.threshold_type.replace('_', ' ')} {alert.condition} {formatThresholdValue(alert.threshold_value, alert.threshold_type)}
                                        </span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <span className="text-slate-500">Via:</span>
                                        <span className="text-cyan-400 capitalize">{alert.notification_type}</span>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <span className="text-slate-500">Created:</span>
                                        <span className="text-slate-300">{formatDate(alert.created_at)}</span>
                                    </div>
                                </div>

                                {alert.is_triggered && alert.triggered_at && (
                                    <div className="mt-2 flex items-center space-x-2 text-sm">
                                        <span className="text-green-400">✓ Triggered:</span>
                                        <span className="text-green-300">{formatDate(alert.triggered_at)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right side - Action buttons */}
                        <div className="flex items-center space-x-2 ml-6">
                            {/* Test Button */}
                            {alert.is_active && !alert.is_triggered && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTestAlert(alert.id);
                                    }}
                                    disabled={testingAlerts.has(alert.id)}
                                    className="text-xs bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 px-3 py-1.5 rounded-md transition-colors border border-slate-600/50 hover:border-slate-500/50"
                                    title="Test notification"
                                >
                                    {testingAlerts.has(alert.id) ? 'Testing...' : 'Test'}
                                </button>
                            )}

                            {/* Toggle Button */}
                            {!alert.is_triggered && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleAlert(alert.id, alert.is_active);
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded-md transition-colors border ${alert.is_active
                                        ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/40'
                                        : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/40'
                                        }`}
                                >
                                    {alert.is_active ? 'Pause' : 'Activate'}
                                </button>
                            )}

                            {/* Delete Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAlert(alert.id);
                                }}
                                disabled={deletingAlerts.has(alert.id)}
                                className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-md transition-colors border border-red-500/40"
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