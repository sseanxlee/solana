interface PresetSettings {
    marketCapPresets: string[];
    percentagePresets: number[];
}

const DEFAULT_PRESETS: PresetSettings = {
    marketCapPresets: ['10K', '100K', '1M', '10M', '100M', '1B'],
    percentagePresets: [10, 25, 50, 100, 200, 500]
};

const STORAGE_KEY = 'alert_preset_settings';

class PresetSettingsService {
    getPresets(): PresetSettings {
        if (typeof window === 'undefined') {
            return DEFAULT_PRESETS;
        }

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Validate the stored data
                if (this.isValidPresets(parsed)) {
                    return parsed;
                }
            }
        } catch (error) {
            console.error('Error loading preset settings:', error);
        }

        return DEFAULT_PRESETS;
    }

    updatePresets(presets: PresetSettings): void {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            if (this.isValidPresets(presets)) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
            }
        } catch (error) {
            console.error('Error saving preset settings:', error);
        }
    }

    resetToDefaults(): PresetSettings {
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (error) {
                console.error('Error resetting preset settings:', error);
            }
        }
        return DEFAULT_PRESETS;
    }

    private isValidPresets(presets: any): presets is PresetSettings {
        return (
            presets &&
            Array.isArray(presets.marketCapPresets) &&
            Array.isArray(presets.percentagePresets) &&
            presets.marketCapPresets.every((p: any) => typeof p === 'string') &&
            presets.percentagePresets.every((p: any) => typeof p === 'number')
        );
    }
}

export const presetSettingsService = new PresetSettingsService();
export type { PresetSettings }; 