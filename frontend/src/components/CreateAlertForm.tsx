'use client';

import { useState, useEffect } from 'react';
import { apiService, TokenAlert, CreateAlertRequest } from '../services/api';
import { presetSettingsService } from '../services/presetSettings';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface CreateAlertFormProps {
    onAlertCreated: (alert: TokenAlert) => void;
    onCancel: () => void;
    prefilledTokenAddress?: string;
    isCompact?: boolean;
}

export default function CreateAlertForm({ onAlertCreated, onCancel, prefilledTokenAddress, isCompact = false }: CreateAlertFormProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<CreateAlertRequest>({
        tokenAddress: prefilledTokenAddress || '',
        thresholdType: 'price',
        thresholdValue: 0,
        condition: 'above',
        notificationType: 'telegram' // Default to telegram instead of email
    });

    const [tokenInfo, setTokenInfo] = useState<{
        name?: string;
        symbol?: string;
        price?: number;
        isValid?: boolean;
    } | null>(null);

    // Auto-validate prefilled token address (without showing toast)
    useEffect(() => {
        if (prefilledTokenAddress && prefilledTokenAddress.length === 44) {
            validateTokenAddress(true); // Pass true to skip toast
        }
    }, [prefilledTokenAddress]);

    const handleInputChange = (field: keyof CreateAlertRequest, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Reset token info when address changes
        if (field === 'tokenAddress') {
            setTokenInfo(null);
        }
    };

    const validateTokenAddress = async (skipToast = false) => {
        if (!formData.tokenAddress || formData.tokenAddress.length !== 44) {
            if (!skipToast) {
                toast.error('Please enter a valid Solana token address (44 characters)');
            }
            return;
        }

        try {
            setIsLoading(true);
            const response = await apiService.getTokenData(formData.tokenAddress);

            if (response.success && response.data) {
                setTokenInfo({
                    name: response.data.name,
                    symbol: response.data.symbol,
                    price: response.data.price,
                    isValid: true
                });
                if (!skipToast) {
                    toast.success(`Found token: ${response.data.name} (${response.data.symbol})`);
                }
            }
        } catch (error: any) {
            console.error('Token validation error:', error);
            setTokenInfo({ isValid: false });
            if (!skipToast) {
                toast.error(error.error || 'Invalid token address or token not found');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!formData.tokenAddress) {
            toast.error('Token address is required');
            return;
        }

        if (!formData.thresholdValue || formData.thresholdValue <= 0) {
            toast.error('Threshold value must be greater than 0');
            return;
        }

        // Check notification method is configured
        if (formData.notificationType === 'telegram' && !user?.telegramChatId) {
            toast.error('Please configure your Telegram in profile settings first');
            return;
        }

        if (formData.notificationType === 'discord' && !user?.discordUserId) {
            toast.error('Please link your Discord account first');
            return;
        }

        // Remove email requirement for now - allow email alerts even without email configured
        // if (formData.notificationType === 'email' && !user?.email) {
        //     toast.error('Please configure your email in profile settings first');
        //     return;
        // }

        try {
            setIsLoading(true);
            const response = await apiService.createAlert(formData);

            if (response.success && response.data) {
                onAlertCreated(response.data);
            }
        } catch (error: any) {
            console.error('Create alert error:', error);
            toast.error(error.error || 'Failed to create alert');
        } finally {
            setIsLoading(false);
        }
    };

    if (isCompact) {
        const [alertType, setAlertType] = useState<'market_cap' | 'market_cap_increase' | 'market_cap_decrease'>('market_cap');
        const [customValue, setCustomValue] = useState('');
        const [showCustomInput, setShowCustomInput] = useState(false);

        // Get custom presets from settings
        const userPresets = presetSettingsService.getPresets();
        const marketCapPresets = userPresets.marketCapPresets;
        const percentagePresets = userPresets.percentagePresets;

        const parseMarketCapValue = (value: string): number => {
            const cleanValue = value.toUpperCase().replace(/[^0-9.KMB]/g, '');
            const numMatch = cleanValue.match(/^(\d+\.?\d*)/);
            if (!numMatch) return 0;

            const num = parseFloat(numMatch[1]);
            if (cleanValue.includes('B')) return num * 1000000000;
            if (cleanValue.includes('M')) return num * 1000000;
            if (cleanValue.includes('K')) return num * 1000;
            return num;
        };

        const handlePresetClick = (preset: string | number) => {
            if (alertType === 'market_cap') {
                const value = parseMarketCapValue(preset as string);
                setFormData(prev => ({ ...prev, thresholdValue: value }));
            } else {
                // For percentage alerts, we need to calculate the target market cap
                // based on current market cap and percentage change
                setFormData(prev => ({ ...prev, thresholdValue: preset as number }));
            }
            setShowCustomInput(false);
        };

        const handleCustomSubmit = () => {
            if (alertType === 'market_cap') {
                const value = parseMarketCapValue(customValue);
                setFormData(prev => ({ ...prev, thresholdValue: value }));
            } else {
                const percentage = parseFloat(customValue.replace('%', ''));
                if (!isNaN(percentage)) {
                    setFormData(prev => ({ ...prev, thresholdValue: percentage }));
                }
            }
            setCustomValue('');
            setShowCustomInput(false);
        };

        const handleAlertTypeChange = (type: 'market_cap' | 'market_cap_increase' | 'market_cap_decrease') => {
            setAlertType(type);
            setFormData(prev => ({
                ...prev,
                thresholdType: type === 'market_cap' ? 'market_cap' : 'market_cap',
                condition: type === 'market_cap' ? 'above' : type === 'market_cap_increase' ? 'above' : 'below',
                thresholdValue: 0
            }));
            setShowCustomInput(false);
        };

        const handleCompactSubmit = async (e: React.FormEvent) => {
            e.preventDefault();

            if (!formData.tokenAddress || !formData.thresholdValue || formData.thresholdValue <= 0) {
                toast.error('Please select a valid threshold value');
                return;
            }

            // Determine notification method based on user preferences
            let notificationMethod: 'telegram' | 'discord' | 'email' = 'telegram';
            if (user?.discordUserId) {
                notificationMethod = 'discord';
            } else if (user?.telegramChatId) {
                notificationMethod = 'telegram';
            }

            const alertData = {
                ...formData,
                notificationType: notificationMethod
            };

            try {
                setIsLoading(true);
                const response = await apiService.createAlert(alertData);

                if (response.success && response.data) {
                    onAlertCreated(response.data);
                }
            } catch (error: any) {
                console.error('Create alert error:', error);
                toast.error(error.error || 'Failed to create alert');
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <form onSubmit={handleCompactSubmit} className="space-y-3">
                {/* Alert Type Selection */}
                <div>
                    <label className="block text-slate-400 text-xs mb-2">Alert Type</label>
                    <div className="grid grid-cols-1 gap-2">
                        <button
                            type="button"
                            onClick={() => handleAlertTypeChange('market_cap')}
                            className={`p-2 rounded text-sm transition-colors text-left ${alertType === 'market_cap'
                                ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-300'
                                : 'bg-slate-600 border border-slate-500 text-slate-300 hover:bg-slate-500'
                                }`}
                        >
                            Market Cap Target
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAlertTypeChange('market_cap_increase')}
                            className={`p-2 rounded text-sm transition-colors text-left ${alertType === 'market_cap_increase'
                                ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-300'
                                : 'bg-slate-600 border border-slate-500 text-slate-300 hover:bg-slate-500'
                                }`}
                        >
                            Market Cap Increase %
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAlertTypeChange('market_cap_decrease')}
                            className={`p-2 rounded text-sm transition-colors text-left ${alertType === 'market_cap_decrease'
                                ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-300'
                                : 'bg-slate-600 border border-slate-500 text-slate-300 hover:bg-slate-500'
                                }`}
                        >
                            Market Cap Decrease %
                        </button>
                    </div>
                </div>

                {/* Presets */}
                <div>
                    <label className="block text-slate-400 text-xs mb-2">
                        {alertType === 'market_cap' ? 'Quick Presets' : 'Percentage Presets'}
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                        {(alertType === 'market_cap' ? marketCapPresets : percentagePresets).map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => handlePresetClick(preset)}
                                className={`p-2 text-xs rounded transition-colors ${(alertType === 'market_cap' && formData.thresholdValue === parseMarketCapValue(preset as string)) ||
                                    (alertType !== 'market_cap' && formData.thresholdValue === preset)
                                    ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-300'
                                    : 'bg-slate-600 border border-slate-500 text-white hover:bg-slate-500'
                                    }`}
                            >
                                {alertType === 'market_cap' ? preset : `${preset}%`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Input Toggle */}
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        {showCustomInput ? '- Hide Custom Input' : '+ Custom Value'}
                    </button>
                    <a
                        href="/settings"
                        className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                        title="Customize presets in settings"
                    >
                        Edit Presets
                    </a>
                </div>

                {/* Custom Input */}
                {showCustomInput && (
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            placeholder={alertType === 'market_cap' ? 'e.g., 50M, 2.5B' : 'e.g., 75, 150'}
                            className="bg-slate-600 border border-slate-500 text-white text-sm rounded px-3 py-2 flex-1 focus:outline-none focus:border-cyan-400"
                        />
                        <button
                            type="button"
                            onClick={handleCustomSubmit}
                            className="bg-cyan-500 hover:bg-cyan-400 text-white text-xs px-3 py-2 rounded transition-colors"
                        >
                            Set
                        </button>
                    </div>
                )}

                {/* Current Selection Display */}
                {formData.thresholdValue > 0 && (
                    <div className="bg-slate-700/50 rounded p-2">
                        <div className="text-xs text-slate-400 mb-1">Selected Alert:</div>
                        <div className="text-sm text-white">
                            {alertType === 'market_cap' && `Market Cap reaches $${formData.thresholdValue.toLocaleString()}`}
                            {alertType === 'market_cap_increase' && `Market Cap increases by ${formData.thresholdValue}%`}
                            {alertType === 'market_cap_decrease' && `Market Cap decreases by ${formData.thresholdValue}%`}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-sm py-2 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading || formData.thresholdValue <= 0}
                        className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-white text-sm py-2 rounded transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Creating...' : 'Create Alert'}
                    </button>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token Address */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token Address
                </label>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={formData.tokenAddress}
                        onChange={(e) => handleInputChange('tokenAddress', e.target.value)}
                        placeholder="Enter Solana token address (44 characters)"
                        className="input-field flex-1"
                        maxLength={44}
                    />
                    <button
                        type="button"
                        onClick={() => validateTokenAddress()}
                        disabled={isLoading || !formData.tokenAddress}
                        className="btn-secondary whitespace-nowrap"
                    >
                        {isLoading ? 'Checking...' : 'Validate'}
                    </button>
                </div>

                {tokenInfo && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        {tokenInfo.isValid ? (
                            <div className="text-sm">
                                <div className="font-medium text-green-600">✓ Valid Token</div>
                                <div className="text-gray-600">
                                    {tokenInfo.name} ({tokenInfo.symbol})
                                    {tokenInfo.price && (
                                        <span className="ml-2">
                                            Current Price: ${tokenInfo.price.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-red-600">
                                ✗ Invalid or unknown token address
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Threshold Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alert Type
                </label>
                <select
                    value={formData.thresholdType}
                    onChange={(e) => handleInputChange('thresholdType', e.target.value as 'price' | 'market_cap')}
                    className="input-field"
                >
                    <option value="price">Price Alert</option>
                    <option value="market_cap">Market Cap Alert</option>
                </select>
            </div>

            {/* Condition */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Condition
                </label>
                <select
                    value={formData.condition}
                    onChange={(e) => handleInputChange('condition', e.target.value as 'above' | 'below')}
                    className="input-field"
                >
                    <option value="above">Above Threshold</option>
                    <option value="below">Below Threshold</option>
                </select>
            </div>

            {/* Threshold Value */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Threshold Value (USD)
                </label>
                <input
                    type="number"
                    value={formData.thresholdValue}
                    onChange={(e) => handleInputChange('thresholdValue', parseFloat(e.target.value) || 0)}
                    placeholder="Enter threshold value"
                    className="input-field"
                    min="0"
                    step="0.00000001"
                />
            </div>

            {/* Notification Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notification Method
                </label>
                <select
                    value={formData.notificationType}
                    onChange={(e) => handleInputChange('notificationType', e.target.value as 'email' | 'telegram' | 'discord' | 'extension')}
                    className="input-field"
                >
                    <option value="telegram">Telegram</option>
                    <option value="discord">Discord</option>
                    <option value="extension">Browser Extension</option>
                    <option value="email">Email (Coming Soon)</option>
                </select>

                {formData.notificationType === 'telegram' && !user?.telegramChatId && (
                    <p className="text-sm text-amber-600 mt-1">
                        Please configure your Telegram in profile settings first
                    </p>
                )}

                {formData.notificationType === 'discord' && !user?.discordUserId && (
                    <p className="text-sm text-amber-600 mt-1">
                        Please link your Discord account first
                    </p>
                )}

                {formData.notificationType === 'extension' && (
                    <p className="text-sm text-blue-600 mt-1">
                        Extension alerts are typically created directly from the Chrome extension overlay.
                    </p>
                )}

                {formData.notificationType === 'email' && (
                    <p className="text-sm text-blue-600 mt-1">
                        Email notifications are coming soon. Use Telegram or Discord for now.
                    </p>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 btn-outline"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 btn-primary"
                >
                    {isLoading ? 'Creating...' : 'Create Alert'}
                </button>
            </div>
        </form>
    );
} 