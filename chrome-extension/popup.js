// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async function () {
    console.log('Stride Extension popup loaded');

    // UI Elements
    const loadingContainer = document.getElementById('loadingContainer');
    const notConnectedContainer = document.getElementById('notConnectedContainer');
    const connectedContainer = document.getElementById('connectedContainer');
    const errorContainer = document.getElementById('errorContainer');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    const walletAddress = document.getElementById('walletAddress');
    const successMessage = document.getElementById('successMessage');
    const connectBtn = document.getElementById('connectBtn');
    const openPanelBtn = document.getElementById('openPanelBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const retryBtn = document.getElementById('retryBtn');
    const errorMessage = document.getElementById('errorMessage');

    // Show initial loading state
    showLoading();

    // Set up event listeners FIRST (before any early returns)
    console.log('🔗 Setting up event listeners...');

    // Event Listeners
    connectBtn?.addEventListener('click', handleConnect);

    if (openPanelBtn) {
        console.log('✅ Open Panel button found, attaching event listener');
        openPanelBtn.addEventListener('click', function (e) {
            console.log('🖱️ OPEN PANEL BUTTON CLICKED!');
            handleOpenPanel();
        });
    } else {
        console.log('❌ Open Panel button not found');
    }

    disconnectBtn?.addEventListener('click', handleDisconnect);
    retryBtn?.addEventListener('click', handleRetry);

    // Debug: Check if disconnect button exists and is clickable
    if (disconnectBtn) {
        console.log('✅ Disconnect button found and event listener attached');
        disconnectBtn.style.pointerEvents = 'auto'; // Ensure it's clickable
    } else {
        console.log('❌ Disconnect button not found');
    }

    // Debug: Check current UI state
    console.log('🔍 Current UI state:');
    console.log('- Loading container hidden:', loadingContainer.classList.contains('hidden'));
    console.log('- Not connected container hidden:', notConnectedContainer.classList.contains('hidden'));
    console.log('- Connected container hidden:', connectedContainer.classList.contains('hidden'));
    console.log('- Error container hidden:', errorContainer.classList.contains('hidden'));
    console.log('- Open Panel button exists:', !!openPanelBtn);
    console.log('- Open Panel button visible:', openPanelBtn && !openPanelBtn.closest('.hidden'));

    try {
        // First check if we already have a stored auth token (connection might have completed while popup was closed)
        const existingAuth = await chrome.storage.local.get(['authToken', 'strideUserData']);
        console.log('🔍 Checking for existing auth on popup load:', {
            hasToken: !!existingAuth.authToken,
            hasUserData: !!existingAuth.strideUserData
        });

        if (existingAuth.authToken) {
            console.log('🎯 Found existing auth token, showing connected state immediately');
            await showConnectedState();
            return; // Exit early since we're already connected
        }

        // Check if user is already connected via backend verification
        const isConnected = await checkConnectionStatus();

        if (isConnected) {
            await showConnectedState();
        } else {
            showNotConnectedState();
        }
    } catch (error) {
        console.error('Error checking connection:', error);
        showErrorState('Failed to check connection status');
    }

    // Add periodic connection status check
    setInterval(async () => {
        try {
            const isConnected = await checkConnectionStatus();
            const currentlyShowingConnected = !connectedContainer.classList.contains('hidden');

            if (isConnected && !currentlyShowingConnected) {
                console.log('🔄 Periodic check: Connection detected, updating UI');
                await showConnectedState();
            } else if (!isConnected && currentlyShowingConnected) {
                console.log('🔄 Periodic check: Connection lost, updating UI');
                showNotConnectedState();
            }
        } catch (error) {
            console.error('Error in periodic connection check:', error);
        }
    }, 3000); // Check every 3 seconds

    // Helper Functions
    function showLoading() {
        hideAllContainers();
        loadingContainer.classList.remove('hidden');
        updateConnectionStatus(false);
    }

    function showNotConnectedState() {
        hideAllContainers();
        notConnectedContainer.classList.remove('hidden');
        notConnectedContainer.classList.add('fade-in');
        updateConnectionStatus(false);
    }

    async function showConnectedState() {
        console.log('🎯 Showing connected state...');
        hideAllContainers();
        connectedContainer.classList.remove('hidden');
        connectedContainer.classList.add('fade-in');

        // Get user data to show wallet address in top-right indicator only
        try {
            console.log('📊 Fetching user data for connected state...');
            const userData = await getUserData();
            console.log('👤 Retrieved user data:', userData);

            const wallet = userData?.walletAddress || userData?.wallet_address;
            console.log('💳 Extracted wallet address:', wallet);

            // Update the top-right status indicator
            updateConnectionStatus(true, wallet);

            // Initialize alert panel functionality when connected
            initializePopupAlertPanel();

        } catch (error) {
            console.error('💥 Error getting user data for connected state:', error);
            updateConnectionStatus(true);
        }
    }

    function showErrorState(message) {
        hideAllContainers();
        errorContainer.classList.remove('hidden');
        errorContainer.classList.add('fade-in');
        errorMessage.textContent = message;
        updateConnectionStatus(false);
    }

    function hideAllContainers() {
        [loadingContainer, notConnectedContainer, connectedContainer, errorContainer].forEach(container => {
            container.classList.add('hidden');
            container.classList.remove('fade-in');
        });
    }

    function updateConnectionStatus(isConnected, wallet = null) {
        console.log('🔄 Updating connection status:', { isConnected, wallet: wallet ? 'present' : 'none' });

        // Update only the small top-right status indicator
        if (isConnected) {
            connectionStatus.classList.remove('disconnected');
            connectionText.textContent = 'Connected';

            if (wallet) {
                walletAddress.textContent = formatWalletAddress(wallet);
                walletAddress.classList.remove('hidden');
            } else {
                walletAddress.classList.add('hidden');
            }
        } else {
            connectionStatus.classList.add('disconnected');
            connectionText.textContent = 'Disconnected';
            walletAddress.classList.add('hidden');
        }
    }

    function formatWalletAddress(address, isMain = false) {
        if (!address || address.length < 8) return address;

        if (isMain) {
            // Show more characters for main display
            return `${address.slice(0, 6)}...${address.slice(-6)}`;
        } else {
            // Shorter format for small indicator
            return `${address.slice(0, 4)}...${address.slice(-4)}`;
        }
    }

    async function checkConnectionStatus() {
        try {
            console.log('Checking connection status...');
            const result = await chrome.storage.local.get(['authToken']);
            const token = result.authToken;

            console.log('Auth token from storage:', token ? 'Found' : 'Not found');

            if (!token) {
                console.log('No auth token found');
                return false;
            }

            // Verify token with backend
            console.log('Verifying token with backend...');
            const isValid = await verifyConnectionToken(token);
            console.log('Token verification result:', isValid);
            return isValid;
        } catch (error) {
            console.error('Error checking connection status:', error);
            return false;
        }
    }

    async function verifyConnectionToken(token) {
        try {
            console.log('Making request to verify token...');
            // Verify the token with the backend
            const response = await fetch('http://localhost:3001/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Backend response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Backend response data:', data);
                const isValid = data && data.data && data.data.id;
                console.log('Token is valid:', isValid);
                return isValid; // Check if we get valid user data
            }
            console.log('Token verification failed - response not ok');
            return false;
        } catch (error) {
            console.error('Error verifying token:', error);
            return false;
        }
    }

    async function getUserData() {
        try {
            const result = await chrome.storage.local.get(['authToken', 'strideUserData']);
            const token = result.authToken;

            console.log('🔍 Getting user data:', {
                hasToken: !!token,
                hasStoredUserData: !!result.strideUserData,
                storedUserData: result.strideUserData
            });

            // First try to use stored user data if available
            if (result.strideUserData && result.strideUserData.wallet_address) {
                console.log('✅ Using stored user data:', result.strideUserData);
                return {
                    ...result.strideUserData,
                    walletAddress: result.strideUserData.wallet_address // Convert to camelCase
                };
            }

            // If no stored data or no wallet address, fetch from backend
            if (!token) {
                console.log('❌ No auth token available');
                return null;
            }

            console.log('🌐 Fetching user data from backend...');
            const response = await fetch('http://localhost:3001/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📨 Backend user data response:', data);

                if (data.data) {
                    const userData = {
                        ...data.data,
                        walletAddress: data.data.wallet_address || data.data.walletAddress // Handle both formats
                    };
                    console.log('✅ Processed user data:', userData);
                    return userData;
                }
            } else {
                console.log('❌ Backend response not ok:', response.status);
            }
            return null;
        } catch (error) {
            console.error('💥 Error getting user data:', error);
            return null;
        }
    }

    async function handleConnect() {
        try {
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connecting...';

            // Generate connection ID
            const connectionId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Open linking page
            const linkingUrl = `http://localhost:3000/link-extension?connectionId=${connectionId}`;
            await openUrl(linkingUrl);

            // Store connection ID for verification
            await chrome.storage.local.set({ pendingConnectionId: connectionId });

            // Start polling for connection completion
            startConnectionPolling(connectionId);

        } catch (error) {
            console.error('Error during connection:', error);
            showErrorState('Failed to initiate connection');
        } finally {
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect to Stride';
        }
    }

    function startConnectionPolling(connectionId) {
        let pollCount = 0;
        const maxPolls = 150; // 5 minutes at 2-second intervals

        console.log('Starting connection polling for:', connectionId);

        const pollInterval = setInterval(async () => {
            pollCount++;
            console.log(`Polling attempt ${pollCount}/${maxPolls} for connection ${connectionId}`);

            try {
                const isConnected = await checkConnectionStatus();
                console.log('Poll result - isConnected:', isConnected);

                if (isConnected) {
                    console.log('Connection detected! Stopping polling.');
                    clearInterval(pollInterval);
                    await chrome.storage.local.remove(['pendingConnectionId']);
                    await showConnectedState();
                    return;
                }
            } catch (error) {
                console.error('Error during polling:', error);
            }

            if (pollCount >= maxPolls) {
                console.log('Polling timeout reached');
                clearInterval(pollInterval);
                showErrorState('Connection timeout - please try again');
            }
        }, 2000); // Poll every 2 seconds

        // Also check immediately
        setTimeout(async () => {
            try {
                const isConnected = await checkConnectionStatus();
                if (isConnected) {
                    clearInterval(pollInterval);
                    await chrome.storage.local.remove(['pendingConnectionId']);
                    await showConnectedState();
                }
            } catch (error) {
                console.error('Immediate check error:', error);
            }
        }, 1000);
    }

    async function handleDisconnect() {
        try {
            console.log('🔌 Disconnecting extension...');

            // Show loading state briefly
            disconnectBtn.disabled = true;
            disconnectBtn.textContent = 'Disconnecting...';

            // Clear ALL extension storage data
            await chrome.storage.local.clear();
            console.log('🧹 All extension storage cleared');

            // Update UI immediately
            updateConnectionStatus(false);
            showNotConnectedState();

            console.log('✅ Extension disconnected successfully');

        } catch (error) {
            console.error('💥 Error disconnecting:', error);
            showErrorState('Failed to disconnect extension');
        } finally {
            // Reset button state
            disconnectBtn.disabled = false;
            disconnectBtn.textContent = 'Disconnect Extension';
        }
    }

    async function handleRetry() {
        showLoading();
        try {
            const isConnected = await checkConnectionStatus();
            if (isConnected) {
                await showConnectedState();
            } else {
                showNotConnectedState();
            }
        } catch (error) {
            console.error('Error retrying:', error);
            showErrorState('Connection retry failed');
        }
    }

    async function openUrl(url) {
        try {
            await chrome.tabs.create({ url });
            window.close();
        } catch (error) {
            console.error('Error opening URL:', error);
        }
    }

    // Listen for connection completion from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'connectionUpdate') {
            if (message.success) {
                showConnectedState();
                showSuccessToast(); // Show success message when connection completes
            } else {
                showErrorState('Connection failed');
            }
        }
    });

    // Listen for storage changes (when background script updates the auth token)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.authToken) {
            if (changes.authToken.newValue && !changes.authToken.oldValue) {
                // Auth token was added, update UI to connected state
                console.log('🔄 Auth token added via storage change');
                showConnectedState();
                showSuccessToast(); // Show success message when token is stored
            } else if (!changes.authToken.newValue && changes.authToken.oldValue) {
                // Auth token was removed, update UI to disconnected state
                console.log('🔄 Auth token removed via storage change');
                showNotConnectedState();
            }
        }
    });

    async function handleOpenPanel() {
        try {
            console.log('🔳 Opening overlay panel...');

            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                console.log('❌ No active tab found');
                return;
            }

            console.log('📑 Current tab URL:', tab.url);
            console.log('📑 Current tab ID:', tab.id);

            // Try to extract contract address from URL first
            let contractAddress = extractContractFromUrl(tab.url);
            console.log('🔍 Contract address extraction result:', contractAddress);

            if (contractAddress) {
                console.log('💰 Contract address found:', contractAddress);
                console.log('📤 Sending message to content script...');

                // Send message to content script to show overlay
                chrome.tabs.sendMessage(tab.id, {
                    action: 'showOverlay',
                    contractAddress: contractAddress
                }, function (response) {
                    console.log('📨 Content script response:', response);
                    console.log('⚠️ Chrome runtime error:', chrome.runtime.lastError);

                    if (chrome.runtime.lastError) {
                        console.log('❌ Error sending message to content script:', chrome.runtime.lastError.message);
                        console.log('🔄 Trying to inject content script and show overlay...');

                        // Try to inject content script manually
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['content.js']
                        }, function () {
                            if (chrome.runtime.lastError) {
                                console.log('❌ Failed to inject content script, opening dashboard');
                                openUrl('http://localhost:3000/dashboard');
                                return;
                            }

                            console.log('✅ Content script injected successfully');

                            // Also inject CSS
                            chrome.scripting.insertCSS({
                                target: { tabId: tab.id },
                                files: ['overlay.css']
                            }, function () {
                                if (chrome.runtime.lastError) {
                                    console.log('⚠️ CSS injection error:', chrome.runtime.lastError.message);
                                } else {
                                    console.log('✅ CSS injected successfully');
                                }

                                // Try sending message again after injection
                                console.log('🔄 Retrying message send after injection...');
                                setTimeout(() => {
                                    chrome.tabs.sendMessage(tab.id, {
                                        action: 'showOverlay',
                                        contractAddress: contractAddress
                                    }, function (response) {
                                        console.log('📨 Retry response:', response);
                                        console.log('⚠️ Retry runtime error:', chrome.runtime.lastError);

                                        if (response && response.success) {
                                            console.log('✅ Overlay shown successfully after injection');
                                            window.close();
                                        } else {
                                            console.log('❌ Still failed after injection, opening dashboard');
                                            openUrl('http://localhost:3000/dashboard');
                                        }
                                    });
                                }, 100);
                            });
                        });
                    } else if (response && response.success) {
                        console.log('✅ Overlay shown successfully');
                        window.close(); // Close popup after showing overlay
                    } else {
                        console.log('❌ Failed to show overlay, response:', response);
                        // Fallback: open dashboard  
                        openUrl('http://localhost:3000/dashboard');
                    }
                });
            } else {
                console.log('❌ No contract address found in URL, opening dashboard');
                // No contract address found, open dashboard
                openUrl('http://localhost:3000/dashboard');
            }

        } catch (error) {
            console.error('💥 Error opening panel:', error);
            // Fallback: open dashboard
            openUrl('http://localhost:3000/dashboard');
        }
    }

    // Initialize popup alert panel functionality
    function initializePopupAlertPanel() {
        console.log('🎛️ Initializing popup alert panel functionality');

        let currentAlertType = 'market_cap';
        let selectedValue = 0;
        let selectedPreset = null;

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
                    console.log('📦 Loading custom presets (popup):', result.customPresets);
                    // Update presets with custom values, keeping 'EDIT_PRESETS' at the end
                    Object.keys(result.customPresets).forEach(type => {
                        if (result.customPresets[type] && Array.isArray(result.customPresets[type])) {
                            presets[type] = [...result.customPresets[type], 'EDIT_PRESETS'];
                        }
                    });
                    updatePresetButtons();
                }
            } catch (error) {
                console.error('Error loading custom presets (popup):', error);
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
                console.log('💾 Saved custom presets (popup):', customPresets);
            } catch (error) {
                console.error('Error saving custom presets (popup):', error);
            }
        }

        // Show preset editing modal
        function showPresetEditModal() {
            console.log('📝 Opening preset edit modal (popup)');

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

                console.log('✅ Presets saved successfully (popup)');
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

                    console.log('🔄 Presets reset to defaults (popup)');
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

        // Update preset buttons based on alert type
        function updatePresetButtons() {
            const presetButtons = document.getElementById('popupPresetButtons');
            if (!presetButtons) return;

            const currentPresets = presets[currentAlertType];

            presetButtons.innerHTML = '';
            currentPresets.forEach(preset => {
                const button = document.createElement('button');

                // Handle special Edit Presets button
                if (preset === 'EDIT_PRESETS') {
                    button.className = 'edit-presets-btn';
                    button.textContent = 'Edit Presets';

                    button.addEventListener('click', () => {
                        console.log('📝 Edit Presets clicked (popup)');
                        showPresetEditModal();
                    });
                } else {
                    button.className = 'preset-btn';
                    button.setAttribute('data-value', preset);
                    button.textContent = currentAlertType === 'market_cap' ? preset : `${preset}%`;

                    button.addEventListener('click', () => {
                        // Remove previous selection
                        document.querySelectorAll('.popup-alert-panel .preset-btn').forEach(btn => btn.classList.remove('selected'));
                        button.classList.add('selected');

                        selectedPreset = preset;
                        selectedValue = currentAlertType === 'market_cap' ? parseMarketCapValue(preset) : preset;
                        updateSelectionDisplay();
                        updateCreateButton();
                    });
                }

                presetButtons.appendChild(button);
            });
        }

        // Update selection display
        function updateSelectionDisplay() {
            const selectionDisplay = document.getElementById('popupSelectionDisplay');
            const selectionText = document.getElementById('popupSelectionText');

            if (!selectionDisplay || !selectionText) return;

            if (selectedValue > 0) {
                selectionDisplay.classList.remove('hidden');
                let text = '';

                if (currentAlertType === 'market_cap') {
                    text = `Alert when market cap reaches ${formatValue(selectedValue, 'market_cap')}`;
                } else if (currentAlertType === 'increase') {
                    text = `Alert when market cap increases by ${selectedValue}%`;
                } else if (currentAlertType === 'decrease') {
                    text = `Alert when market cap decreases by ${selectedValue}%`;
                }

                selectionText.textContent = text;
            } else {
                selectionDisplay.classList.add('hidden');
            }
        }

        // Update create button state
        function updateCreateButton() {
            const createBtn = document.getElementById('popupCreateAlertBtn');
            if (!createBtn) return;

            if (selectedValue > 0) {
                createBtn.classList.remove('disabled');
            } else {
                createBtn.classList.add('disabled');
            }
        }

        // Alert type tab switching
        document.querySelectorAll('.popup-alert-panel .alert-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                document.querySelectorAll('.popup-alert-panel .alert-tab').forEach(t => t.classList.remove('active'));
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
                updateSelectionDisplay();
                updateCreateButton();

                // Hide custom input
                const customInput = document.getElementById('popupCustomInput');
                const customToggle = document.getElementById('popupCustomToggle');
                if (customInput && customToggle) {
                    customInput.classList.add('hidden');
                    customToggle.textContent = '+ Custom Value';
                }
            });
        });

        // Custom value toggle
        const customToggle = document.getElementById('popupCustomToggle');
        if (customToggle) {
            customToggle.addEventListener('click', () => {
                const customInput = document.getElementById('popupCustomInput');

                if (customInput) {
                    if (customInput.classList.contains('hidden')) {
                        customInput.classList.remove('hidden');
                        customToggle.textContent = '- Hide Custom Input';
                    } else {
                        customInput.classList.add('hidden');
                        customToggle.textContent = '+ Custom Value';
                    }
                }
            });
        }

        // Set custom value
        const setCustomBtn = document.getElementById('popupSetCustomBtn');
        if (setCustomBtn) {
            setCustomBtn.addEventListener('click', () => {
                const input = document.getElementById('popupCustomValueInput');
                if (!input) return;

                const value = input.value.trim();

                if (value) {
                    // Remove previous preset selection
                    document.querySelectorAll('.popup-alert-panel .preset-btn').forEach(btn => btn.classList.remove('selected'));

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
                        updateSelectionDisplay();
                        updateCreateButton();

                        // Hide custom input
                        const customInput = document.getElementById('popupCustomInput');
                        const customToggle = document.getElementById('popupCustomToggle');
                        if (customInput && customToggle) {
                            customInput.classList.add('hidden');
                            customToggle.textContent = '+ Custom Value';
                            input.value = '';
                        }
                    }
                }
            });
        }

        // Create alert button (placeholder - not functional yet)
        const createAlertBtn = document.getElementById('popupCreateAlertBtn');
        if (createAlertBtn) {
            createAlertBtn.addEventListener('click', () => {
                if (selectedValue > 0) {
                    console.log('🚨 Popup Create Alert clicked (not functional yet):', {
                        type: currentAlertType,
                        value: selectedValue
                    });

                    // TODO: Implement actual alert creation
                    alert('Alert creation not implemented yet');
                }
            });
        }

        // Initialize with market cap presets
        updatePresetButtons();
        updateCreateButton();

        // Load custom presets from storage
        loadCustomPresets();

        console.log('✅ Popup alert panel functionality initialized');
    }

    function extractContractFromUrl(url) {
        console.log('🔍 Extracting contract from URL:', url);

        // More flexible patterns - any string above 5 chars
        const patterns = [
            /axiom\.trade\/meme\/([a-zA-Z0-9]{5,})/, // Axiom - any alphanumeric 5+ chars
            /pump\.fun\/([a-zA-Z0-9]{5,})/, // Pump.fun - any alphanumeric 5+ chars
            /dexscreener\.com\/solana\/([a-zA-Z0-9]{5,})/, // DexScreener - any alphanumeric 5+ chars
            /solscan\.io\/token\/([a-zA-Z0-9]{5,})/, // Solscan - any alphanumeric 5+ chars
            // More general patterns for paths with potential token addresses
            /token[\/=]([a-zA-Z0-9]{5,})/, // token= or token/ parameter
            /address[\/=]([a-zA-Z0-9]{5,})/, // address= or address/ parameter
            /contract[\/=]([a-zA-Z0-9]{5,})/, // contract= or contract/ parameter
            /mint[\/=]([a-zA-Z0-9]{5,})/, // mint= or mint/ parameter
            /ca[\/=]([a-zA-Z0-9]{5,})/, // ca= or ca/ parameter (contract address)
            /#([a-zA-Z0-9]{5,})/, // Hash fragment
            /\?([a-zA-Z0-9]{5,})/, // Query parameter value
            /\/([a-zA-Z0-9]{5,})(?:\/|$|\?|#)/ // Any path segment with 5+ chars
        ];

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = url.match(pattern);
            console.log(`🔎 Pattern ${i + 1}:`, pattern, 'Match:', match);

            if (match && match[1] && match[1].length >= 5) {
                console.log('✅ Found contract address:', match[1]);
                return match[1];
            }
        }

        // Final fallback - split URL by common delimiters and find any segment > 5 chars
        const urlParts = url.split(/[\/\?&#=]/);
        for (const part of urlParts) {
            if (part.length >= 5 && /^[a-zA-Z0-9]+$/.test(part)) {
                console.log('✅ Found contract address via fallback:', part);
                return part;
            }
        }

        console.log('❌ No contract address found in URL');
        return null;
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
});

// Add a function to force refresh connection status
window.refreshConnectionStatus = async function () {
    try {
        console.log('🔄 Manually refreshing connection status...');
        const isConnected = await checkConnectionStatus();
        if (isConnected) {
            await showConnectedState();
        } else {
            showNotConnectedState();
        }
    } catch (error) {
        console.error('Error refreshing connection status:', error);
        showErrorState('Failed to check connection status');
    }
};

// Debug function to inspect storage
window.debugExtensionStorage = async function () {
    try {
        const storage = await chrome.storage.local.get(null);
        console.log('🔍 Complete extension storage:', storage);
        return storage;
    } catch (error) {
        console.error('Error getting storage:', error);
    }
};

// Debug function to test user data fetching
window.debugUserData = async function () {
    try {
        const userData = await getUserData();
        console.log('🧪 Debug user data result:', userData);
        return userData;
    } catch (error) {
        console.error('Error in debug user data:', error);
    }
};

function showSuccessToast() {
    successMessage.classList.remove('hidden');
    console.log('✅ Showing success toast');

    // Hide the toast after 3 seconds
    setTimeout(() => {
        successMessage.classList.add('hidden');
        console.log('⏰ Success toast hidden');
    }, 3000);
}
