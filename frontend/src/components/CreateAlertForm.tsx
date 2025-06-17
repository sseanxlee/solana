'use client';

import { useState, useEffect } from 'react';
import { apiService, TokenAlert, CreateAlertRequest } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface CreateAlertFormProps {
    onAlertCreated: (alert: TokenAlert) => void;
    onCancel: () => void;
    prefilledTokenAddress?: string;
}

export default function CreateAlertForm({ onAlertCreated, onCancel, prefilledTokenAddress }: CreateAlertFormProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<CreateAlertRequest>({
        tokenAddress: prefilledTokenAddress || '',
        thresholdType: 'price',
        thresholdValue: 0,
        condition: 'above',
        notificationType: 'email'
    });

    const [tokenInfo, setTokenInfo] = useState<{
        name?: string;
        symbol?: string;
        price?: number;
        isValid?: boolean;
    } | null>(null);

    // Auto-validate prefilled token address
    useEffect(() => {
        if (prefilledTokenAddress && prefilledTokenAddress.length === 44) {
            validateTokenAddress();
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

    const validateTokenAddress = async () => {
        if (!formData.tokenAddress || formData.tokenAddress.length !== 44) {
            toast.error('Please enter a valid Solana token address (44 characters)');
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
                toast.success(`Found token: ${response.data.name} (${response.data.symbol})`);
            }
        } catch (error: any) {
            console.error('Token validation error:', error);
            setTokenInfo({ isValid: false });
            toast.error(error.error || 'Invalid token address or token not found');
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
        if (formData.notificationType === 'email' && !user?.email) {
            toast.error('Please configure your email in profile settings first');
            return;
        }

        if (formData.notificationType === 'telegram' && !user?.telegramChatId) {
            toast.error('Please configure your Telegram in profile settings first');
            return;
        }

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
                        onClick={validateTokenAddress}
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
                    onChange={(e) => handleInputChange('notificationType', e.target.value as 'email' | 'telegram')}
                    className="input-field"
                >
                    <option value="email">Email</option>
                    <option value="telegram">Telegram</option>
                </select>

                {formData.notificationType === 'email' && !user?.email && (
                    <p className="text-sm text-amber-600 mt-1">
                        ⚠️ Please configure your email in profile settings
                    </p>
                )}

                {formData.notificationType === 'telegram' && !user?.telegramChatId && (
                    <p className="text-sm text-amber-600 mt-1">
                        ⚠️ Please configure your Telegram in profile settings
                    </p>
                )}
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn-secondary"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={isLoading || !tokenInfo?.isValid}
                >
                    {isLoading ? 'Creating...' : 'Create Alert'}
                </button>
            </div>
        </form>
    );
} 