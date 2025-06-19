import React, { useEffect, useRef, useState } from 'react';
import { useChart } from '../contexts/ChartContext';

const PRICE_CHART_ID = 'price-chart-widget-container';

// Extend Window interface to include Moralis widget function
declare global {
    interface Window {
        createMyWidget: (containerId: string, config: any) => void;
    }
}

interface PriceChartWidgetProps {
    tokenAddress: string;
    height?: string;
}

export const PriceChartWidget: React.FC<PriceChartWidgetProps> = ({ tokenAddress, height = '1200px' }) => {
    const containerRef = useRef(null);
    const [isClient, setIsClient] = useState(false);
    const { settings, isLoaded, updateShowHoldersChart } = useChart();

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        // Only create widget when we're on client AND settings are loaded
        if (typeof window === 'undefined' || !tokenAddress || !isClient || !isLoaded) return;

        const loadWidget = () => {
            if (typeof window.createMyWidget === 'function') {
                // Clear any existing widget first
                const container = document.getElementById(PRICE_CHART_ID);
                if (container) {
                    container.innerHTML = '';
                }

                window.createMyWidget(PRICE_CHART_ID, {
                    autoSize: true,
                    chainId: 'solana',
                    tokenAddress: tokenAddress,
                    showHoldersChart: settings.showHoldersChart,
                    defaultInterval: '1D',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Etc/UTC',
                    theme: 'moralis',
                    locale: 'en',
                    backgroundColor: '#071321',
                    gridColor: '#0d2035',
                    textColor: '#68738D',
                    candleUpColor: '#4CE666',
                    candleDownColor: '#E64C4C',
                    hideLeftToolbar: false,
                    hideTopToolbar: false,
                    hideBottomToolbar: false
                });
            } else {
                console.error('createMyWidget function is not defined.');
            }
        };

        if (!document.getElementById('moralis-chart-widget')) {
            const script = document.createElement('script');
            script.id = 'moralis-chart-widget';
            script.src = 'https://moralis.com/static/embed/chart.js';
            script.type = 'text/javascript';
            script.async = true;
            script.onload = loadWidget;
            script.onerror = () => {
                console.error('Failed to load the chart widget script.');
            };
            document.body.appendChild(script);
        } else {
            loadWidget();
        }
    }, [tokenAddress, settings.showHoldersChart, isClient, isLoaded]); // Re-run when tokenAddress, global showHoldersChart, or loading states change

    return (
        <div className="bg-slate-900 h-full flex flex-col relative" style={{ minHeight: height }}>
            <div style={{ width: "100%", height: height, flex: 1, position: 'relative' }}>
                {/* Show loading state while settings are loading */}
                {(!isLoaded || !isClient) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                )}
                <div
                    id={PRICE_CHART_ID}
                    ref={containerRef}
                    style={{ width: "100%", height: "100%" }}
                />
                {/* Toggle Holders Chart Button - Bottom Center */}
                {isClient && isLoaded && (
                    <div className="absolute left-0 right-0 bottom-1 flex justify-center pointer-events-none">
                        <button
                            className="z-10 bg-slate-800 text-slate-200 px-3 py-1 rounded hover:bg-slate-700 text-xs border border-slate-700 pointer-events-auto"
                            onClick={() => updateShowHoldersChart(!settings.showHoldersChart)}
                        >
                            {settings.showHoldersChart ? 'Hide Holders Chart' : 'Show Holders Chart'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}; 