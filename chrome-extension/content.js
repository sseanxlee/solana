// Content script for Stride overlay functionality
let strideOverlay = null;
let currentContractAddress = null;
let overlayExplicitlyClosed = false; // Track if user explicitly closed overlay
let overlayState = { visible: false, created: false }; // Track overlay state

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Content script received message:', request);
    console.log('📨 Message sender:', sender);

    if (request.action === 'showOverlay') {
        console.log('🎯 Processing showOverlay action');
        console.log('🔗 Contract address from message:', request.contractAddress);

        // Pass the contract address to the overlay creation
        currentContractAddress = request.contractAddress;
        overlayExplicitlyClosed = false; // Reset explicit close flag when manually opened

        if (!overlayState.created) {
            console.log('🆕 Creating new overlay');
            createOverlay(currentContractAddress);
        } else {
            console.log('👁️ Showing existing overlay');
            // If overlay exists but is hidden, just show it
            showOverlay();
            updateOverlayContent(currentContractAddress);
        }

        // Set up URL change monitoring
        console.log('👀 Setting up URL change monitoring');
        setupUrlChangeMonitoring();

        console.log('✅ Sending success response');
        sendResponse({ success: true });

    } else if (request.action === 'hideOverlay') {
        console.log('🙈 Processing hideOverlay action');
        hideOverlay();
        sendResponse({ success: true });

    } else if (request.action === 'checkOverlayState') {
        console.log('🔍 Processing checkOverlayState action');
        // Return current overlay state for popup to decide if it should auto-show
        const shouldAutoShow = overlayState.created && !overlayExplicitlyClosed && isValidUrl(window.location.href);
        console.log('📊 Overlay state check result:', { shouldAutoShow, created: overlayState.created, explicitlyClosed: overlayExplicitlyClosed, validUrl: isValidUrl(window.location.href) });
        sendResponse({
            shouldAutoShow: shouldAutoShow
        });
    } else {
        console.log('❓ Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep message channel open for async response
});

// Check if current URL supports the overlay (make it more flexible like popup)
function isValidUrl(url) {
    return extractContractFromUrl(url) !== null;
}

// Extract contract address from URL (restricted to axiom.trade/meme only)
function extractContractFromUrl(url) {
    console.log('🔍 Checking URL for axiom.trade/meme pattern:', url);

    // Only match axiom.trade/meme/[string longer than 5 chars]
    const axiomPattern = /axiom\.trade\/meme\/([a-zA-Z0-9]{5,})/;
    const match = url.match(axiomPattern);

    if (match && match[1] && match[1].length >= 5) {
        console.log('✅ Found valid axiom.trade/meme contract address:', match[1]);
        return match[1];
    }

    console.log('❌ URL does not match axiom.trade/meme pattern');
    return null;
}

// Monitor for URL changes to update contract address
function setupUrlChangeMonitoring() {
    // Function to check and update contract address in the URL
    function checkForContractAddressChange(url) {
        const contractAddress = extractContractFromUrl(url);

        if (contractAddress && overlayState.created && !overlayExplicitlyClosed) {
            if (contractAddress !== currentContractAddress) {
                // URL changed to a different contract address
                currentContractAddress = contractAddress;
                updateOverlayContent(currentContractAddress);
            }
            // Show overlay if it was auto-hidden and now we're on a valid page
            if (!overlayState.visible) {
                showOverlay();
            }
        } else if (!contractAddress && overlayState.created && !overlayExplicitlyClosed) {
            // No valid contract address in URL, hide the overlay but don't destroy it
            hideOverlay(false); // false = don't destroy, just hide
        }
    }

    // Track URL changes using multiple methods for comprehensive detection
    let lastUrl = window.location.href;

    // Method 1: Frequent polling for immediate detection (more frequent than before)
    const intervalId = setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            console.log('🔄 URL change detected via polling:', { from: lastUrl, to: currentUrl });
            lastUrl = currentUrl;
            checkForContractAddressChange(currentUrl);
        }
    }, 250); // Reduced from 500ms to 250ms for faster detection

    // Store interval ID so we can clear it when the overlay is closed
    window.strideIntervalId = intervalId;

    // Method 2: MutationObserver for DOM changes that might indicate navigation
    const urlObserver = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            console.log('🔄 URL change detected via MutationObserver:', { from: lastUrl, to: currentUrl });
            lastUrl = currentUrl;
            checkForContractAddressChange(currentUrl);
        }
    });

    // Start observing the document for URL changes
    urlObserver.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['href', 'data-route']
    });

    // Store observer so we can disconnect it when overlay is closed
    window.strideUrlObserver = urlObserver;

    // Method 3: Listen for popstate events (browser back/forward)
    const popstateListener = function () {
        console.log('🔄 URL change detected via popstate event');
        checkForContractAddressChange(window.location.href);
    };

    window.addEventListener('popstate', popstateListener);

    // Method 4: Listen for pushState and replaceState (common in SPAs)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
        originalPushState.apply(history, args);
        console.log('🔄 URL change detected via pushState');
        setTimeout(() => checkForContractAddressChange(window.location.href), 10);
    };

    history.replaceState = function (...args) {
        originalReplaceState.apply(history, args);
        console.log('🔄 URL change detected via replaceState');
        setTimeout(() => checkForContractAddressChange(window.location.href), 10);
    };

    // Method 5: Listen for hashchange events
    const hashchangeListener = function () {
        console.log('🔄 URL change detected via hashchange event');
        checkForContractAddressChange(window.location.href);
    };

    window.addEventListener('hashchange', hashchangeListener);

    // Store references to all listeners for cleanup
    window.stridePopstateListener = popstateListener;
    window.strideHashchangeListener = hashchangeListener;
    window.strideOriginalPushState = originalPushState;
    window.strideOriginalReplaceState = originalReplaceState;
}

// Function to save overlay position and size
function saveOverlayState() {
    if (strideOverlay) {
        const content = document.getElementById('strideContent');
        if (content) {
            // Get position from transform or default to empty
            const transform = content.style.transform || '';
            const position = {
                transform: transform,
                xOffset: window.xOffset || 0,
                yOffset: window.yOffset || 0,
                width: content.style.width || '280px',
                height: content.style.height || '240px'
            };

            // Save to chrome storage
            chrome.storage.local.set({
                'strideOverlayPosition': position,
                'strideOverlayCreated': overlayState.created,
                'strideOverlayExplicitlyClosed': overlayExplicitlyClosed
            });
        }
    }
}

// Function to update CSS scale factors for responsive sizing
function updateScaleFactors(content, width, height) {
    const baseWidth = 280;  // Base width
    const baseHeight = 240; // Base height

    const widthScale = width / baseWidth;
    const heightScale = height / baseHeight;
    const overallScale = Math.min(widthScale, heightScale); // Use smaller scale for proportional scaling

    // Set CSS custom properties for scaling
    content.style.setProperty('--scale-factor', overallScale);
    content.style.setProperty('--width-scale', widthScale);
    content.style.setProperty('--height-scale', heightScale);
}

// Update overlay content with new contract address
function updateOverlayContent(contractAddress) {
    if (strideOverlay) {
        console.log('🔄 Updating overlay content for new contract address:', contractAddress);

        // Update the displayed address
        const addressElement = strideOverlay.querySelector('.stride-title-section .token-address');
        if (addressElement) {
            addressElement.textContent = contractAddress.length > 10 ? contractAddress.slice(0, 6) + '...' + contractAddress.slice(-4) : contractAddress;
        }

        // Clear cached data for the new token
        if (window.strideAlertPanelCache) {
            console.log('🗑️ Clearing cached data for new token');
            window.strideAlertPanelCache.marketCapCache = null;
            window.strideAlertPanelCache.realTokenAddressCache = null;
            window.strideAlertPanelCache.cacheTimestamp = null;
        }

        // Clear selection display to prevent showing old token data
        const selectionDisplay = document.getElementById('selectionDisplay');
        if (selectionDisplay) {
            selectionDisplay.classList.add('hidden');
            selectionDisplay.style.background = '#1e293b';
            selectionDisplay.style.borderColor = '#475569';
        }

        // Reset any active selection state
        const createAlertBtn = document.getElementById('createAlertBtn');
        if (createAlertBtn) {
            createAlertBtn.classList.add('disabled');
        }

        console.log('✅ Overlay content updated for new contract address');
    }
}

// Show overlay (without recreating)
function showOverlay() {
    console.log('👁️ Showing overlay - current state:', { created: overlayState.created, visible: overlayState.visible, explicitlyClosed: overlayExplicitlyClosed });

    if (strideOverlay) {
        console.log('📱 Making overlay visible');
        strideOverlay.style.display = 'block';
        overlayState.visible = true;

        // Add fade-in animation
        const content = document.getElementById('strideContent');
        if (content) {
            content.style.animation = 'none'; // Reset any existing animation
            setTimeout(() => {
                content.style.animation = 'strideFadeIn 0.5s ease-out';
            }, 10); // Small delay to ensure the reset takes effect
        }

        // Save updated state
        saveOverlayState();
        console.log('✅ Overlay is now visible');
    } else {
        console.log('❌ No overlay to show - strideOverlay is null');
    }
}

function createOverlay(contractAddress) {
    console.log('🎨 Creating overlay with contract address:', contractAddress);

    // Remove existing overlay if present
    if (strideOverlay) {
        console.log('🗑️ Removing existing overlay');
        destroyOverlay();
    }

    // Ensure fonts are loaded
    if (!document.getElementById('stride-fonts')) {
        console.log('🔤 Loading fonts');
        const fontLink = document.createElement('link');
        fontLink.id = 'stride-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&family=Funnel+Sans:wght@300;400;500;600;700&display=swap';
        document.head.appendChild(fontLink);
    }

    console.log('🏗️ Building overlay HTML structure');
    // Create draggable overlay container
    strideOverlay = document.createElement('div');
    strideOverlay.id = 'stride-overlay';
    strideOverlay.style.zIndex = '2147483647'; // Ensure highest z-index
    strideOverlay.innerHTML = `
        <div class="stride-overlay-content" id="strideContent">
            <div class="stride-header" id="strideHeader">
                <div class="stride-title-section">
                    <h2>Set Alert</h2>
                    <span class="token-address">${contractAddress.length > 10 ? contractAddress.slice(0, 6) + '...' + contractAddress.slice(-4) : contractAddress}</span>
                </div>
                <button class="stride-close-btn" id="strideCloseBtn">×</button>
            </div>
            <div class="stride-body" id="strideBody">
                <div class="stride-alert-panel" id="strideAlertPanel">
                    <div class="alert-type-section">
                        <div class="alert-type-tabs">
                            <button class="alert-tab active" data-type="market_cap">Target</button>
                            <button class="alert-tab" data-type="increase">+%</button>
                            <button class="alert-tab" data-type="decrease">-%</button>
                        </div>
                    </div>
                    <div class="presets-section" id="presetsSection">
                        <div class="preset-buttons" id="presetButtons">
                            <!-- Preset buttons will be dynamically generated -->
                        </div>
                        <div class="custom-section">
                            <div class="custom-toggle">
                                <button class="custom-toggle-btn" id="customToggle">+ Custom Value</button>
                            </div>
                            <div class="custom-input hidden" id="customInput">
                                <input type="text" placeholder="e.g., 50M, 2.5B" id="customValueInput">
                                <button class="set-btn" id="setCustomBtn">Set</button>
                            </div>
                        </div>
                        <div class="selection-display hidden" id="selectionDisplay">
                            <div class="selection-text" id="selectionText"></div>
                        </div>
                        <div class="action-buttons">
                            <button class="create-alert-btn disabled" id="createAlertBtn">Create Alert</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="stride-resize-handle stride-resize-se" id="strideResizeSE"></div>
            <div class="stride-resize-handle stride-resize-s" id="strideResizeS"></div>
            <div class="stride-resize-handle stride-resize-e" id="strideResizeE"></div>
        </div>
    `;

    console.log('📄 Adding overlay to document body');
    // Add overlay to page - initially hidden to prevent flash at wrong position
    strideOverlay.style.display = 'none'; // Hide initially
    document.body.appendChild(strideOverlay);
    overlayState.created = true;
    overlayState.visible = false; // Set to false initially since we're hiding it

    console.log('✅ Overlay state updated:', overlayState);

    // Get the content element
    const content = document.getElementById('strideContent');
    console.log('🎯 Content element found:', !!content);

    // Restore position and size if available
    console.log('💾 Checking for saved position...');
    chrome.storage.local.get(['strideOverlayPosition'], function (result) {
        console.log('📊 Saved position data:', result.strideOverlayPosition);

        if (result.strideOverlayPosition) {
            console.log('🔄 Restoring saved position and size');
            // Restore position and size
            content.style.transform = result.strideOverlayPosition.transform;
            content.style.width = result.strideOverlayPosition.width;
            content.style.height = result.strideOverlayPosition.height;
            window.xOffset = result.strideOverlayPosition.xOffset;
            window.yOffset = result.strideOverlayPosition.yOffset;

            // Update scale factors for restored size
            const width = parseInt(result.strideOverlayPosition.width) || 280;
            const height = parseInt(result.strideOverlayPosition.height) || 240;
            updateScaleFactors(content, width, height);
        } else {
            console.log('🎯 Setting initial top-right position');
            // Set initial position in the top right of the screen
            const overlayWidth = 280; // Default width (reduced from 300)
            const overlayHeight = 240; // Default height (increased from 200 to accommodate UI elements)
            const padding = 20; // Distance from edge
            const initialX = window.innerWidth - overlayWidth - padding;
            const initialY = padding;

            console.log('📐 Calculated top-right position:', { initialX, initialY, windowWidth: window.innerWidth, windowHeight: window.innerHeight });

            content.style.transform = `translate(${initialX}px, ${initialY}px)`;
            content.style.top = '0';
            content.style.left = '0';
            window.xOffset = initialX;
            window.yOffset = initialY;

            // Initialize scale factors for default size
            updateScaleFactors(content, overlayWidth, overlayHeight);
        }

        console.log('🎨 Final overlay positioning complete');

        // Now show the overlay with proper positioning
        strideOverlay.style.display = 'block';
        overlayState.visible = true;
        console.log('👁️ Overlay now visible at correct position');
    });

    console.log('🖱️ Making overlay draggable and resizable');
    // Make the overlay draggable and resizable
    makeDraggable();
    makeResizable();

    console.log('🔗 Adding event listeners');
    // Add event listeners
    document.getElementById('strideCloseBtn').addEventListener('click', () => {
        console.log('❌ Close button clicked - hiding overlay');
        overlayExplicitlyClosed = true; // Mark as explicitly closed
        hideOverlay(false); // Hide but don't destroy - preserve position
        saveOverlayState(); // Save the explicitly closed state
    });

    // Escape key to close
    document.addEventListener('keydown', handleEscapeKey);

    // Initialize alert panel functionality
    initializeAlertPanel();

    // Pre-fetch market cap data immediately to avoid delays later
    console.log('🔄 Pre-fetching market cap data...');
    getCurrentTokenMarketCap().then(marketCap => {
        if (marketCap) {
            console.log('✅ Market cap pre-fetched successfully:', marketCap);
        } else {
            console.log('⚠️ Market cap pre-fetch failed, will retry when creating alert');
        }
    }).catch(error => {
        console.log('⚠️ Market cap pre-fetch error:', error.message);
    });

    console.log('🎉 Overlay creation complete!');
}

// Initialize alert panel functionality
function initializeAlertPanel() {
    console.log('🎛️ Initializing alert panel functionality');

    let currentAlertType = 'market_cap';
    let selectedValue = 0;
    let selectedPreset = null;

    // Cache for market cap and real token address to avoid repeated API calls
    // Expose cache to global scope so it can be cleared when contract address changes
    window.strideAlertPanelCache = {
        marketCapCache: null,
        realTokenAddressCache: null,
        cacheTimestamp: null
    };
    const CACHE_DURATION = 30000; // 30 seconds cache

    // Default preset values for different types
    const defaultPresets = {
        market_cap: ['10K', '100K', '1M', '10M', '100M'],
        increase: [10, 25, 50, 100, 200],
        decrease: [10, 25, 50, 100, 200]
    };

    // Current presets (will be loaded from storage or defaults)
    let presets = {
        market_cap: [...defaultPresets.market_cap, 'EDIT_PRESETS'],
        increase: [...defaultPresets.increase, 'EDIT_PRESETS'],
        decrease: [...defaultPresets.decrease, 'EDIT_PRESETS']
    };

    // Load custom presets from storage
    async function loadCustomPresets() {
        try {
            const result = await chrome.storage.local.get(['customPresets']);
            if (result.customPresets) {
                console.log('📦 Loading custom presets:', result.customPresets);
                // Update presets with custom values, keeping 'EDIT_PRESETS' at the end
                Object.keys(result.customPresets).forEach(type => {
                    if (result.customPresets[type] && Array.isArray(result.customPresets[type])) {
                        presets[type] = [...result.customPresets[type], 'EDIT_PRESETS'];
                    }
                });
                updatePresetButtons();
            }
        } catch (error) {
            console.error('Error loading custom presets:', error);
        }
    }

    // Save custom presets to storage
    async function saveCustomPresets() {
        try {
            const customPresets = {
                market_cap: presets.market_cap.filter(p => p !== 'EDIT_PRESETS'),
                increase: presets.increase.filter(p => p !== 'EDIT_PRESETS'),
                decrease: presets.decrease.filter(p => p !== 'EDIT_PRESETS')
            };
            await chrome.storage.local.set({ customPresets });
            console.log('💾 Saved custom presets:', customPresets);
        } catch (error) {
            console.error('Error saving custom presets:', error);
        }
    }

    // Show preset editing modal
    function showPresetEditModal() {
        console.log('📝 Opening preset edit modal');

        // Create modal HTML
        const modalHTML = `
            <div class="preset-edit-modal" id="presetEditModal">
                <div class="preset-edit-content">
                    <div class="preset-edit-header">
                        <div class="preset-edit-title">Edit Alert Presets</div>
                        <button class="preset-edit-close" id="presetEditClose">×</button>
                    </div>
                    
                    <div class="preset-type-section">
                        <div class="preset-type-label">Market Cap Values</div>
                        <div class="preset-inputs" id="marketCapInputs">
                            ${presets.market_cap.filter(p => p !== 'EDIT_PRESETS').map((preset, index) =>
            `<input type="text" class="preset-input" data-type="market_cap" data-index="${index}" value="${preset}" placeholder="e.g., 10K">`
        ).join('')}
                        </div>
                    </div>

                    <div class="preset-type-section">
                        <div class="preset-type-label">Increase Percentages</div>
                        <div class="preset-inputs" id="increaseInputs">
                            ${presets.increase.filter(p => p !== 'EDIT_PRESETS').map((preset, index) =>
            `<input type="text" class="preset-input" data-type="increase" data-index="${index}" value="${preset}" placeholder="e.g., 50">`
        ).join('')}
                        </div>
                    </div>

                    <div class="preset-type-section">
                        <div class="preset-type-label">Decrease Percentages</div>
                        <div class="preset-inputs" id="decreaseInputs">
                            ${presets.decrease.filter(p => p !== 'EDIT_PRESETS').map((preset, index) =>
            `<input type="text" class="preset-input" data-type="decrease" data-index="${index}" value="${preset}" placeholder="e.g., 25">`
        ).join('')}
                        </div>
                    </div>

                    <div class="preset-edit-actions">
                        <button class="preset-save-btn" id="presetSaveBtn">Save Presets</button>
                        <button class="preset-reset-btn" id="presetResetBtn">Reset to Defaults</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        const modal = document.createElement('div');
        modal.innerHTML = modalHTML;
        document.body.appendChild(modal.firstElementChild);

        // Add event listeners
        setupPresetModalEvents();
    }

    // Setup preset modal event listeners
    function setupPresetModalEvents() {
        const modal = document.getElementById('presetEditModal');
        const closeBtn = document.getElementById('presetEditClose');
        const saveBtn = document.getElementById('presetSaveBtn');
        const resetBtn = document.getElementById('presetResetBtn');

        // Close modal
        closeBtn.addEventListener('click', hidePresetEditModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hidePresetEditModal();
        });

        // Save presets
        saveBtn.addEventListener('click', async () => {
            const inputs = modal.querySelectorAll('.preset-input');
            const newPresets = {
                market_cap: [],
                increase: [],
                decrease: []
            };

            inputs.forEach(input => {
                const type = input.getAttribute('data-type');
                const value = input.value.trim();
                if (value) {
                    if (type === 'market_cap') {
                        newPresets[type].push(value);
                    } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) && numValue > 0) {
                            newPresets[type].push(numValue);
                        }
                    }
                }
            });

            // Update presets with EDIT_PRESETS at the end
            Object.keys(newPresets).forEach(type => {
                presets[type] = [...newPresets[type], 'EDIT_PRESETS'];
            });

            await saveCustomPresets();
            updatePresetButtons();
            hidePresetEditModal();

            console.log('✅ Presets saved successfully');
        });

        // Reset to defaults
        resetBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset all presets to defaults?')) {
                // Reset to default presets
                presets = {
                    market_cap: [...defaultPresets.market_cap, 'EDIT_PRESETS'],
                    increase: [...defaultPresets.increase, 'EDIT_PRESETS'],
                    decrease: [...defaultPresets.decrease, 'EDIT_PRESETS']
                };

                // Clear custom presets from storage
                await chrome.storage.local.remove(['customPresets']);
                updatePresetButtons();
                hidePresetEditModal();

                console.log('🔄 Presets reset to defaults');
            }
        });
    }

    // Hide preset editing modal
    function hidePresetEditModal() {
        const modal = document.getElementById('presetEditModal');
        if (modal) {
            modal.remove();
        }
    }

    // Parse market cap value (e.g., "10K" -> 10000)
    function parseMarketCapValue(value) {
        const cleanValue = value.toUpperCase().replace(/[^0-9.KMB]/g, '');
        const numMatch = cleanValue.match(/^(\d+\.?\d*)/);
        if (!numMatch) return 0;

        const num = parseFloat(numMatch[1]);
        if (cleanValue.includes('B')) return num * 1000000000;
        if (cleanValue.includes('M')) return num * 1000000;
        if (cleanValue.includes('K')) return num * 1000;
        return num;
    }

    // Format value for display
    function formatValue(value, type) {
        if (type === 'market_cap') {
            if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
            if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
            if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
            return `$${value.toFixed(2)}`;
        } else {
            return `${value}%`;
        }
    }

    // Update preset buttons based on alert type
    function updatePresetButtons() {
        const presetButtons = document.getElementById('presetButtons');
        const currentPresets = presets[currentAlertType];

        presetButtons.innerHTML = '';
        currentPresets.forEach(preset => {
            const button = document.createElement('button');

            // Handle special Edit Presets button
            if (preset === 'EDIT_PRESETS') {
                button.className = 'edit-presets-btn';
                button.textContent = 'Edit Presets';

                button.addEventListener('click', () => {
                    console.log('📝 Edit Presets clicked');
                    showPresetEditModal();
                });
            } else {
                button.className = 'preset-btn';
                button.setAttribute('data-value', preset);
                button.textContent = currentAlertType === 'market_cap' ? preset : `${preset}%`;

                button.addEventListener('click', () => {
                    // Remove previous selection
                    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');

                    selectedPreset = preset;
                    selectedValue = currentAlertType === 'market_cap' ? parseMarketCapValue(preset) : preset;
                    updateSelectionDisplay(); // Note: async but we don't await to avoid blocking UI
                    updateCreateButton();
                });
            }

            presetButtons.appendChild(button);
        });
    }

    // Update selection display
    async function updateSelectionDisplay() {
        const selectionDisplay = document.getElementById('selectionDisplay');
        const selectionText = document.getElementById('selectionText');

        if (selectedValue > 0) {
            selectionDisplay.classList.remove('hidden');
            let text = '';

            if (currentAlertType === 'market_cap') {
                text = `Alert when market cap reaches ${formatValue(selectedValue, 'market_cap')}`;
            } else if (currentAlertType === 'increase') {
                text = `Alert when market cap increases by ${selectedValue}%`;

                // Try to show calculated target if possible
                try {
                    const currentMarketCap = await getCurrentTokenMarketCap();
                    if (currentMarketCap) {
                        const targetMarketCap = currentMarketCap * (1 + selectedValue / 100);
                        text += `<br><small style="color: #94a3b8;">Target: ${formatValue(targetMarketCap, 'market_cap')}</small>`;
                    }
                } catch (error) {
                    // Silently fail - just don't show the calculated target
                }
            } else if (currentAlertType === 'decrease') {
                text = `Alert when market cap decreases by ${selectedValue}%`;

                // Try to show calculated target if possible
                try {
                    const currentMarketCap = await getCurrentTokenMarketCap();
                    if (currentMarketCap) {
                        const targetMarketCap = currentMarketCap * (1 - selectedValue / 100);
                        text += `<br><small style="color: #94a3b8;">Target: ${formatValue(targetMarketCap, 'market_cap')}</small>`;
                    }
                } catch (error) {
                    // Silently fail - just don't show the calculated target
                }
            }

            selectionText.innerHTML = text;
        } else {
            selectionDisplay.classList.add('hidden');
        }
    }

    // Update create button state
    function updateCreateButton() {
        const createBtn = document.getElementById('createAlertBtn');
        if (selectedValue > 0) {
            createBtn.classList.remove('disabled');
        } else {
            createBtn.classList.add('disabled');
        }
    }

    // Alert type tab switching
    document.querySelectorAll('.alert-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            document.querySelectorAll('.alert-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const newType = tab.getAttribute('data-type');
            if (newType === 'market_cap') {
                currentAlertType = 'market_cap';
            } else if (newType === 'increase') {
                currentAlertType = 'increase';
            } else if (newType === 'decrease') {
                currentAlertType = 'decrease';
            }

            // Reset selection
            selectedValue = 0;
            selectedPreset = null;
            updatePresetButtons();
            updateSelectionDisplay(); // Note: async but we don't await to avoid blocking UI
            updateCreateButton();

            // Hide custom input
            document.getElementById('customInput').classList.add('hidden');
            document.getElementById('customToggle').textContent = '+ Custom Value';
        });
    });

    // Custom value toggle
    document.getElementById('customToggle').addEventListener('click', () => {
        const customInput = document.getElementById('customInput');
        const toggleBtn = document.getElementById('customToggle');

        if (customInput.classList.contains('hidden')) {
            customInput.classList.remove('hidden');
            toggleBtn.textContent = '- Hide Custom Input';
        } else {
            customInput.classList.add('hidden');
            toggleBtn.textContent = '+ Custom Value';
        }
    });

    // Set custom value
    document.getElementById('setCustomBtn').addEventListener('click', () => {
        const input = document.getElementById('customValueInput');
        const value = input.value.trim();

        if (value) {
            // Remove previous preset selection
            document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('selected'));

            if (currentAlertType === 'market_cap') {
                selectedValue = parseMarketCapValue(value);
            } else {
                const percentage = parseFloat(value.replace('%', ''));
                if (!isNaN(percentage) && percentage > 0) {
                    selectedValue = percentage;
                }
            }

            if (selectedValue > 0) {
                selectedPreset = null; // Custom value
                updateSelectionDisplay(); // Note: async but we don't await to avoid blocking UI
                updateCreateButton();

                // Hide custom input
                document.getElementById('customInput').classList.add('hidden');
                document.getElementById('customToggle').textContent = '+ Custom Value';
                input.value = '';
            }
        }
    });

    // Create alert button - now functional!
    document.getElementById('createAlertBtn').addEventListener('click', async () => {
        if (selectedValue > 0) {
            console.log('🚨 Create Alert clicked:', {
                type: currentAlertType,
                value: selectedValue,
                tokenAddress: currentContractAddress
            });

            await createAlert();
        }
    });

    // Initialize with market cap presets
    updatePresetButtons();
    updateCreateButton();

    // Load custom presets from storage
    loadCustomPresets();

    console.log('✅ Alert panel functionality initialized');

    // Alert creation function
    async function createAlert() {
        try {
            // Show loading state
            const createBtn = document.getElementById('createAlertBtn');
            const originalText = createBtn.textContent;
            createBtn.textContent = 'Creating...';
            createBtn.classList.add('disabled');

            // Get auth token from storage
            const storage = await chrome.storage.local.get(['authToken']);
            const authToken = storage.authToken;

            console.log('🔐 Auth token check:', {
                hasToken: !!authToken,
                tokenType: typeof authToken,
                tokenLength: authToken ? authToken.length : 0
            });

            if (!authToken || authToken === 'undefined' || authToken === 'null' || typeof authToken !== 'string' || authToken.trim() === '') {
                throw new Error('Please connect your wallet first by clicking the extension icon and selecting "Connect to Stride"');
            }

            // Convert extension alert data to API format
            const alertData = await buildAlertRequestData();

            console.log('🔄 Sending alert creation request:', alertData);

            // Make API request to create alert
            const response = await fetch('http://localhost:3001/api/alerts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(alertData)
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Alert created successfully:', result.data);
                await showAlertSuccess(result.data);
            } else {
                console.error('❌ Alert creation failed:', result.error);
                showAlertError(result.error || 'Failed to create alert');
            }

        } catch (error) {
            console.error('💥 Error creating alert:', error);
            showAlertError(error.message || 'Failed to create alert');
        } finally {
            // Reset button state
            const createBtn = document.getElementById('createAlertBtn');
            createBtn.textContent = 'Create Alert';
            createBtn.classList.remove('disabled');
        }
    }

    // Convert extension UI state to API request format
    async function buildAlertRequestData() {
        let thresholdType, thresholdValue, condition, notificationType;

        // Get user's notification preferences from storage
        const storage = await chrome.storage.local.get(['strideUserData']);
        const userData = storage.strideUserData;

        // Determine notification type based on user's linked accounts
        if (userData?.discord_user_id) {
            notificationType = 'discord';
        } else {
            notificationType = 'telegram'; // Default fallback
        }

        // Get the real token address from the pair address (using cache if available)
        console.log('🔗 Getting real token address for alert creation...');
        const realTokenAddress = await getCachedRealTokenAddress();
        if (!realTokenAddress) {
            throw new Error('Unable to get real token address from pair');
        }
        console.log('✅ Using real token address for alert:', realTokenAddress);

        if (currentAlertType === 'market_cap') {
            thresholdType = 'market_cap';
            thresholdValue = selectedValue;

            // Get current market cap to determine condition dynamically
            const currentMarketCap = await getCurrentTokenMarketCap();
            if (!currentMarketCap) {
                throw new Error('Unable to get current market cap for condition determination');
            }

            // Set condition based on target vs current (same logic as Telegram/Discord bots)
            condition = selectedValue > currentMarketCap ? 'above' : 'below';

            console.log('💡 Market cap alert condition logic:');
            console.log(`Current market cap: $${currentMarketCap.toLocaleString()}`);
            console.log(`Target market cap: $${selectedValue.toLocaleString()}`);
            console.log(`Condition: ${condition} (target ${condition} current)`);

        } else if (currentAlertType === 'increase' || currentAlertType === 'decrease') {
            // For percentage alerts, we need to calculate target market cap
            // First get current market cap
            const currentMarketCap = await getCurrentTokenMarketCap();
            if (!currentMarketCap) {
                throw new Error('Unable to get current market cap for percentage calculation');
            }

            thresholdType = 'market_cap';

            if (currentAlertType === 'increase') {
                // Calculate target market cap: current + (current * percentage / 100)
                thresholdValue = currentMarketCap * (1 + selectedValue / 100);
                condition = 'above';
            } else { // decrease
                // Calculate target market cap: current - (current * percentage / 100)
                thresholdValue = currentMarketCap * (1 - selectedValue / 100);
                condition = 'below';
            }
        }

        // Debug logging for threshold value
        console.log('🔍 DEBUG - Alert request data before sending:');
        console.log('selectedValue:', selectedValue, typeof selectedValue);
        console.log('thresholdValue:', thresholdValue, typeof thresholdValue);
        console.log('thresholdType:', thresholdType);
        console.log('condition:', condition);

        const alertData = {
            tokenAddress: realTokenAddress, // Use real token address, not pair address
            thresholdType: thresholdType,
            thresholdValue: thresholdValue,
            condition: condition,
            notificationType: notificationType
        };

        console.log('🔍 DEBUG - Final alert data object:', alertData);

        return alertData;
    }

    // Get real token address from pair address and fetch market cap (with caching)
    async function getCurrentTokenMarketCap() {
        try {
            // Check cache first
            const now = Date.now();
            if (window.strideAlertPanelCache.marketCapCache && window.strideAlertPanelCache.cacheTimestamp && (now - window.strideAlertPanelCache.cacheTimestamp < CACHE_DURATION)) {
                console.log('💾 Using cached market cap:', window.strideAlertPanelCache.marketCapCache);
                return window.strideAlertPanelCache.marketCapCache;
            }

            console.log('🔍 Step 1: Getting real token address from pair:', currentContractAddress);

            // First, get the real token address from the pair address using Moralis API
            const realTokenAddress = await getCachedRealTokenAddress();

            if (!realTokenAddress) {
                throw new Error('Unable to get real token address from pair');
            }

            console.log('🔍 Step 2: Fetching market cap for real token address:', realTokenAddress);

            // Now fetch market cap using the same method as Discord/Telegram bots (Birdeye API)
            const marketData = await fetchTokenMarketDataFromBirdeye(realTokenAddress);

            if (marketData?.market_cap) {
                console.log('✅ Current market cap:', marketData.market_cap);
                // Update cache
                window.strideAlertPanelCache.marketCapCache = marketData.market_cap;
                window.strideAlertPanelCache.cacheTimestamp = now;
                return marketData.market_cap;
            } else {
                throw new Error('No market cap data available from Birdeye');
            }
        } catch (error) {
            console.error('❌ Error fetching current market cap:', error);
            return null;
        }
    }

    // Get cached real token address or fetch if needed
    async function getCachedRealTokenAddress() {
        try {
            // Check cache first
            const now = Date.now();
            if (window.strideAlertPanelCache.realTokenAddressCache && window.strideAlertPanelCache.cacheTimestamp && (now - window.strideAlertPanelCache.cacheTimestamp < CACHE_DURATION)) {
                console.log('💾 Using cached real token address:', window.strideAlertPanelCache.realTokenAddressCache);
                return window.strideAlertPanelCache.realTokenAddressCache;
            }

            const realTokenAddress = await getRealTokenAddressFromPair(currentContractAddress);
            if (realTokenAddress) {
                window.strideAlertPanelCache.realTokenAddressCache = realTokenAddress;
                window.strideAlertPanelCache.cacheTimestamp = now;
            }
            return realTokenAddress;
        } catch (error) {
            console.error('❌ Error getting cached real token address:', error);
            return null;
        }
    }

    // Get real token address from pair address using Moralis API
    async function getRealTokenAddressFromPair(pairAddress) {
        try {
            console.log('🔗 Fetching real token address from pair:', pairAddress);

            const response = await fetch(`https://solana-gateway.moralis.io/token/mainnet/pairs/${pairAddress}/stats`, {
                headers: {
                    'accept': 'application/json',
                    'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjEzZTBhZmU0LTFjZjktNGI2MC1iMTQ5LTkxYjhmMjc0ZjQwYyIsIm9yZ0lkIjoiNDU0MTk2IiwidXNlcklkIjoiNDY3MzA4IiwidHlwZUlkIjoiN2JmMGFkMmEtNTkyMS00ZGNiLWIzNzYtZGVlODBmMDQyOTRjIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTAwNTUyMDcsImV4cCI6NDkwNTgxNTIwN30.lHFaJeZjoWCbGtOt7qLY9IHaGYlUIFw8k44UhymkElk'
                }
            });

            if (!response.ok) {
                throw new Error(`Moralis API error: HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.tokenAddress) {
                console.log('✅ Real token address found:', data.tokenAddress);
                return data.tokenAddress;
            } else {
                throw new Error('No tokenAddress in Moralis response');
            }
        } catch (error) {
            console.error('❌ Error fetching real token address:', error);
            return null;
        }
    }

    // Fetch market data using Birdeye API (same as Discord/Telegram bots)
    async function fetchTokenMarketDataFromBirdeye(tokenAddress) {
        try {
            console.log('📊 Fetching market data from Birdeye for:', tokenAddress);

            const response = await fetch(`https://public-api.birdeye.so/defi/v3/token/market-data?address=${tokenAddress}`, {
                method: 'GET',
                headers: {
                    'X-API-KEY': '5e51a538dc184b669b532714a315ea2e',
                    'accept': 'application/json',
                    'x-chain': 'solana'
                }
            });

            if (!response.ok) {
                throw new Error(`Birdeye API error: HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.data) {
                console.log('✅ Birdeye market data:', result.data);
                return result.data;
            } else {
                throw new Error('Birdeye API returned unsuccessful response or no data');
            }
        } catch (error) {
            console.error('❌ Error fetching from Birdeye:', error);
            return null;
        }
    }

    // Show success message
    async function showAlertSuccess(alertData) {
        const selectionDisplay = document.getElementById('selectionDisplay');
        const selectionText = document.getElementById('selectionText');

        // Determine notification method
        const storage = await chrome.storage.local.get(['strideUserData']);
        const userData = storage.strideUserData;
        const notificationMethod = userData?.discord_user_id ? 'Discord' : 'Telegram';

        selectionDisplay.classList.remove('hidden');
        selectionDisplay.style.background = '#0f5132';
        selectionDisplay.style.borderColor = '#198754';
        selectionText.innerHTML = `✅ Alert created successfully!<br>You'll be notified via ${notificationMethod} when triggered.`;

        // Reset UI after 3 seconds
        setTimeout(() => {
            selectionDisplay.style.background = '#1e293b';
            selectionDisplay.style.borderColor = '#475569';
            updateSelectionDisplay(); // Note: async but we don't await in setTimeout
        }, 3000);
    }

    // Show error message
    function showAlertError(errorMessage) {
        const selectionDisplay = document.getElementById('selectionDisplay');
        const selectionText = document.getElementById('selectionText');

        selectionDisplay.classList.remove('hidden');
        selectionDisplay.style.background = '#5c1518';
        selectionDisplay.style.borderColor = '#dc3545';

        // Check if it's an authentication error for special handling
        if (errorMessage.includes('connect your wallet') || errorMessage.includes('Connect to Stride')) {
            selectionText.innerHTML = `🔐 ${errorMessage}<br><small style="color: #f8d7da; margin-top: 4px; display: block;">Click the Stride extension icon in your browser toolbar to get started.</small>`;
        } else {
            selectionText.innerHTML = `❌ Error: ${errorMessage}`;
        }

        // Reset UI after longer time for auth errors
        const resetTime = errorMessage.includes('connect your wallet') ? 8000 : 5000;
        setTimeout(() => {
            selectionDisplay.style.background = '#1e293b';
            selectionDisplay.style.borderColor = '#475569';
            updateSelectionDisplay(); // Note: async but we don't await in setTimeout
        }, resetTime);
    }
}

function makeResizable() {
    const content = document.getElementById('strideContent');
    const resizeHandleSE = document.getElementById('strideResizeSE');
    const resizeHandleS = document.getElementById('strideResizeS');
    const resizeHandleE = document.getElementById('strideResizeE');

    let isResizing = false;
    let currentHandle = null;

    function startResize(e, handle) {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        currentHandle = handle;

        const rect = content.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = parseInt(content.style.width) || rect.width;
        const startHeight = parseInt(content.style.height) || rect.height;

        // Create a shield to prevent interference from other elements
        const resizeShield = document.createElement('div');
        resizeShield.id = 'stride-resize-shield';
        resizeShield.style.position = 'fixed';
        resizeShield.style.top = '0';
        resizeShield.style.left = '0';
        resizeShield.style.width = '100vw';
        resizeShield.style.height = '100vh';
        resizeShield.style.zIndex = '2147483646';
        resizeShield.style.backgroundColor = 'transparent';
        resizeShield.style.cursor = handle.includes('e') && handle.includes('s') ? 'se-resize' :
            handle.includes('s') ? 's-resize' : 'e-resize';
        document.body.appendChild(resizeShield);

        function doResize(e) {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            // Calculate new dimensions based on handle direction
            if (handle.includes('e')) {
                newWidth = Math.max(260, startWidth + deltaX); // Reduced minimum width from 280 to 260
            }
            if (handle.includes('s')) {
                newHeight = Math.max(240, startHeight + deltaY); // Increased minimum height from 200 to 240 to ensure UI elements remain visible
            }

            // Apply the new dimensions directly
            content.style.width = newWidth + 'px';
            content.style.height = newHeight + 'px';

            // Update CSS variables for dynamic scaling
            updateScaleFactors(content, newWidth, newHeight);
        }

        function stopResize() {
            isResizing = false;
            currentHandle = null;

            // Remove the shield
            const shield = document.getElementById('stride-resize-shield');
            if (shield) {
                shield.remove();
            }

            document.removeEventListener('mousemove', doResize);
            document.removeEventListener('mouseup', stopResize);
            saveOverlayState();
        }

        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }

    resizeHandleSE.addEventListener('mousedown', (e) => startResize(e, 'se'));
    resizeHandleS.addEventListener('mousedown', (e) => startResize(e, 's'));
    resizeHandleE.addEventListener('mousedown', (e) => startResize(e, 'e'));
}

function makeDraggable() {
    const header = document.getElementById('strideHeader');
    const body = document.getElementById('strideBody');
    const content = document.getElementById('strideContent');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // Initialize xOffset and yOffset from stored values
    window.xOffset = window.xOffset || 0;
    window.yOffset = window.yOffset || 0;
    xOffset = window.xOffset;
    yOffset = window.yOffset;

    // Make both header and body draggable
    header.addEventListener('mousedown', dragStart, { capture: true });
    body.addEventListener('mousedown', dragStart, { capture: true });

    function dragStart(e) {
        // Don't start drag on close button or resize handles
        if (e.target.id === 'strideCloseBtn' ||
            e.target.classList.contains('stride-resize-handle') ||
            e.target.id.includes('strideResize')) {
            return;
        }

        // For body dragging, only start if not selecting text
        if (e.target.closest('.stride-body') && e.detail > 1) {
            return; // Allow text selection on double click
        }

        e.stopPropagation();
        e.preventDefault();

        // Extract current position from transform style to avoid glitch
        const transform = content.style.transform;
        if (transform && transform.includes('translate')) {
            const matches = transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
            if (matches) {
                xOffset = parseFloat(matches[1]);
                yOffset = parseFloat(matches[2]);
                // Update global values
                window.xOffset = xOffset;
                window.yOffset = yOffset;
            }
        }

        // Calculate initial position
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;

        // Change cursor during drag
        header.style.cursor = 'grabbing';
        body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', drag, { capture: true });
        document.addEventListener('mouseup', dragEnd, { capture: true });

        // Create a shield layer to capture events over iframes/other elements
        if (!document.getElementById('stride-drag-shield')) {
            const shield = document.createElement('div');
            shield.id = 'stride-drag-shield';
            shield.style.position = 'fixed';
            shield.style.top = '0';
            shield.style.left = '0';
            shield.style.width = '100vw';
            shield.style.height = '100vh';
            shield.style.zIndex = '2147483646'; // Just below the overlay
            shield.style.backgroundColor = 'transparent';
            shield.style.cursor = 'grabbing';
            shield.style.pointerEvents = 'all';
            document.body.appendChild(shield);
        }
    }

    function drag(e) {
        if (isDragging) {
            e.stopPropagation();
            e.preventDefault();

            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            // Store offsets globally so they can be saved later
            window.xOffset = xOffset;
            window.yOffset = yOffset;

            content.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }

    function dragEnd(e) {
        if (isDragging) {
            e.stopPropagation();
            e.preventDefault();

            initialX = currentX;
            initialY = currentY;
            isDragging = false;

            // Restore cursor and remove listeners
            header.style.cursor = 'grab';
            body.style.cursor = 'grab';
            document.body.style.userSelect = '';

            document.removeEventListener('mousemove', drag, { capture: true });
            document.removeEventListener('mouseup', dragEnd, { capture: true });

            // Remove shield layer
            const shield = document.getElementById('stride-drag-shield');
            if (shield) {
                shield.remove();
            }

            // Save position after drag ends
            saveOverlayState();
        }
    }

    // Handle edge case where mouseup happens outside window
    window.addEventListener('blur', () => {
        if (isDragging) {
            const fakeEvent = new MouseEvent('mouseup');
            dragEnd(fakeEvent);
        }
    });
}

function hideOverlay(shouldDestroy = false) {
    console.log('🙈 Hiding overlay - shouldDestroy:', shouldDestroy, 'current state:', { created: overlayState.created, visible: overlayState.visible });

    if (strideOverlay) {
        if (shouldDestroy) {
            console.log('💣 Destroying overlay completely');
            destroyOverlay();
        } else {
            console.log('📱 Just hiding overlay (preserving for later)');
            // Just hide visually, don't destroy
            strideOverlay.style.display = 'none';
            overlayState.visible = false;
            saveOverlayState();
            console.log('✅ Overlay hidden but preserved');
        }
    } else {
        console.log('❌ No overlay to hide - strideOverlay is null');
    }
}

function destroyOverlay() {
    console.log('🗑️ Destroying overlay completely');

    if (strideOverlay) {
        // Save position before destroying
        saveOverlayState();

        strideOverlay.remove();
        strideOverlay = null;
        overlayState.created = false;
        overlayState.visible = false;
        document.removeEventListener('keydown', handleEscapeKey);

        // Clean up any shield layers that might exist
        const dragShield = document.getElementById('stride-drag-shield');
        if (dragShield) dragShield.remove();

        document.body.style.userSelect = '';

        // Clean up URL monitoring
        if (window.strideIntervalId) {
            clearInterval(window.strideIntervalId);
            window.strideIntervalId = null;
        }

        if (window.strideUrlObserver) {
            window.strideUrlObserver.disconnect();
            window.strideUrlObserver = null;
        }

        if (window.stridePopstateListener) {
            window.removeEventListener('popstate', window.stridePopstateListener);
            window.stridePopstateListener = null;
        }

        if (window.strideHashchangeListener) {
            window.removeEventListener('hashchange', window.strideHashchangeListener);
            window.strideHashchangeListener = null;
        }

        // Restore original history methods
        if (window.strideOriginalPushState) {
            history.pushState = window.strideOriginalPushState;
            window.strideOriginalPushState = null;
        }

        if (window.strideOriginalReplaceState) {
            history.replaceState = window.strideOriginalReplaceState;
            window.strideOriginalReplaceState = null;
        }

        // Clean up cache
        if (window.strideAlertPanelCache) {
            window.strideAlertPanelCache = null;
        }

        // Reset global state
        currentContractAddress = null;
        overlayExplicitlyClosed = false;

        console.log('✅ Overlay destroyed and all resources cleaned up');
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        console.log('⌨️ Escape key pressed - hiding overlay');
        overlayExplicitlyClosed = true; // Mark as explicitly closed
        hideOverlay(false); // Hide but don't destroy - preserve position
        saveOverlayState(); // Save the explicitly closed state
    }
}

// Load saved state on page load
chrome.storage.local.get(['strideOverlayCreated', 'strideOverlayExplicitlyClosed'], function (result) {
    if (result.strideOverlayCreated && !result.strideOverlayExplicitlyClosed && isValidUrl(window.location.href)) {
        overlayState.created = result.strideOverlayCreated;
        overlayExplicitlyClosed = result.strideOverlayExplicitlyClosed || false;

        // Extract contract address from current URL using flexible pattern
        const contractAddress = extractContractFromUrl(window.location.href);
        if (contractAddress) {
            currentContractAddress = contractAddress;
            createOverlay(currentContractAddress);
            setupUrlChangeMonitoring();
        }
    }
}); 