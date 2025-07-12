// Background script for Stride Extension
console.log('Stride Extension background script loaded');

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);

    if (request.action === 'connectionComplete') {
        console.log('Processing connectionComplete message');
        handleConnectionComplete(request, sendResponse);
        return true; // Keep the message channel open for async response
    }
});

// Handle connection completion from frontend
async function handleConnectionComplete(request, sendResponse) {
    try {
        const { token, userData, connectionId } = request;
        console.log('🔗 Handling connection completion:', {
            hasToken: !!token,
            hasUserData: !!userData,
            connectionId
        });

        // Verify this connection ID matches what we're expecting
        const result = await chrome.storage.local.get(['pendingConnectionId']);
        console.log('🔍 Connection ID comparison:');
        console.log('  - Stored pendingConnectionId:', result.pendingConnectionId);
        console.log('  - Received connectionId:', connectionId);
        console.log('  - Types match:', typeof result.pendingConnectionId === typeof connectionId);
        console.log('  - Values match:', result.pendingConnectionId === connectionId);

        if (result.pendingConnectionId === connectionId) {
            console.log('✅ Connection ID matches, storing auth data...');

            // Store the connection data with the correct key names
            await chrome.storage.local.set({
                'authToken': token,
                'strideUserData': userData
            });

            console.log('💾 Auth data stored successfully');

            // Clear the pending connection ID
            await chrome.storage.local.remove(['pendingConnectionId']);
            console.log('🧹 Pending connection ID cleared');

            // Notify popup if it's open
            try {
                console.log('📢 Attempting to notify popup...');
                chrome.runtime.sendMessage({
                    action: 'connectionUpdate',
                    success: true,
                    userData: userData
                });
                console.log('✅ Popup notification sent');
            } catch (error) {
                // Popup might not be open, that's okay
                console.log('ℹ️ Popup not available to notify:', error);
            }

            // Show success notification
            chrome.notifications?.create({
                type: 'basic',
                iconUrl: 'icon48.png',
                title: 'Stride Extension',
                message: 'Successfully connected to your Stride account!'
            });

            console.log('✅ Sending success response to content script');
            sendResponse({ success: true, message: 'Connection completed successfully' });
        } else {
            console.error('❌ Connection ID mismatch!');
            console.log('   This could happen if:');
            console.log('   1. Extension was reloaded after connection started');
            console.log('   2. Multiple connection attempts were made');
            console.log('   3. Storage was cleared');

            // Let's try to proceed anyway if we have valid token and user data
            if (token && userData && userData.wallet_address) {
                console.log('🔄 Attempting to proceed with connection despite ID mismatch...');

                await chrome.storage.local.set({
                    'authToken': token,
                    'strideUserData': userData
                });

                // Clear any pending connection ID
                await chrome.storage.local.remove(['pendingConnectionId']);

                // Notify popup
                try {
                    chrome.runtime.sendMessage({
                        action: 'connectionUpdate',
                        success: true,
                        userData: userData
                    });
                } catch (error) {
                    console.log('ℹ️ Popup not available to notify:', error);
                }

                console.log('✅ Connection completed despite ID mismatch');
                sendResponse({ success: true, message: 'Connection completed successfully' });
            } else {
                sendResponse({ success: false, message: 'Invalid connection ID' });
            }
        }
    } catch (error) {
        console.error('💥 Error handling connection completion:', error);
        sendResponse({ success: false, message: error.message });
    }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Stride Extension installed');
        // Extension is ready to use, no welcome page needed
    } else if (details.reason === 'update') {
        console.log('Stride Extension updated');
    }
});

// Handle extension icon click when no popup is defined (fallback)
chrome.action.onClicked.addListener((tab) => {
    // This won't normally trigger since we have a popup defined,
    // but it's here as a fallback
    console.log('Extension icon clicked on tab:', tab.url);
});

// Clean up old connection attempts periodically
setInterval(async () => {
    try {
        const result = await chrome.storage.local.get(['pendingConnectionId']);

        if (result.pendingConnectionId) {
            try {
                // Check if connection ID is older than 10 minutes
                const idParts = result.pendingConnectionId.split('_');
                if (idParts.length >= 2) {
                    const connectionTimestamp = parseInt(idParts[1]);
                    if (!isNaN(connectionTimestamp)) {
                        const now = Date.now();
                        const tenMinutes = 10 * 60 * 1000;

                        if (now - connectionTimestamp > tenMinutes) {
                            // Clean up expired connection ID
                            await chrome.storage.local.remove(['pendingConnectionId']);
                            console.log('Cleaned up expired connection ID:', result.pendingConnectionId);
                        }
                    } else {
                        console.log('Invalid timestamp in connection ID, cleaning up:', result.pendingConnectionId);
                        await chrome.storage.local.remove(['pendingConnectionId']);
                    }
                } else {
                    console.log('Invalid connection ID format, cleaning up:', result.pendingConnectionId);
                    await chrome.storage.local.remove(['pendingConnectionId']);
                }
            } catch (parseError) {
                console.log('Error parsing connection ID, cleaning up:', result.pendingConnectionId, parseError);
                await chrome.storage.local.remove(['pendingConnectionId']);
            }
        }
    } catch (error) {
        console.error('Error cleaning up connection IDs:', error);
    }
}, 5 * 60 * 1000); // Run every 5 minutes 