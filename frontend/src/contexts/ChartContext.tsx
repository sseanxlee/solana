'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ChartSettings {
    showHoldersChart: boolean;
}

interface ChartContextType {
    settings: ChartSettings;
    updateShowHoldersChart: (show: boolean) => void;
}

const defaultSettings: ChartSettings = {
    showHoldersChart: true,
};

const ChartContext = createContext<ChartContextType | undefined>(undefined);

interface ChartProviderProps {
    children: ReactNode;
}

export const ChartProvider: React.FC<ChartProviderProps> = ({ children }) => {
    const [settings, setSettings] = useState<ChartSettings>(defaultSettings);

    // Load settings from localStorage on mount
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('chart_settings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                setSettings({ ...defaultSettings, ...parsedSettings });
            }
        } catch (error) {
            console.error('Error loading chart settings:', error);
        }
    }, []);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('chart_settings', JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving chart settings:', error);
        }
    }, [settings]);

    const updateShowHoldersChart = (show: boolean) => {
        setSettings(prev => ({
            ...prev,
            showHoldersChart: show
        }));
    };

    return (
        <ChartContext.Provider value={{
            settings,
            updateShowHoldersChart
        }}>
            {children}
        </ChartContext.Provider>
    );
};

export const useChart = () => {
    const context = useContext(ChartContext);
    if (context === undefined) {
        throw new Error('useChart must be used within a ChartProvider');
    }
    return context;
}; 