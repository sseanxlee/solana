// Content script for handling extension linking on localhost
console.log('Stride Extension linking content script loaded');

// Listen for custom events from the page (CSP-friendly approach)
document.addEventListener('strideExtensionConnect', function (event) {
    console.log('🔗 Received extension connection event:', event.detail);

    const { token, userData, connectionId } = event.detail;

    console.log('📤 Sending connection data to background script:', {
        hasToken: !!token,
        hasUserData: !!userData,
        connectionId: connectionId
    });

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
        console.error('❌ Extension context invalidated - please reload the page');
        return;
    }

    // Send message to background script
    chrome.runtime.sendMessage({
        action: 'connectionComplete',
        token: token,
        userData: userData,
        connectionId: connectionId
    }, function (response) {
        if (chrome.runtime.lastError) {
            console.error('❌ Runtime error:', chrome.runtime.lastError);
            return;
        }

        console.log('📨 Background script response:', response);

        // Dispatch a confirmation event back to the page
        const confirmationEvent = new CustomEvent('strideExtensionConnectConfirmed', {
            detail: {
                success: response?.success || false,
                message: response?.message || 'Unknown error'
            }
        });
        console.log('📢 Dispatching confirmation event to page:', confirmationEvent.detail);
        document.dispatchEvent(confirmationEvent);
    });
});

// Let the page know the extension is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 DOM loaded, dispatching extension ready event');
    const readyEvent = new CustomEvent('strideExtensionReady', {
        detail: { extensionId: chrome.runtime?.id }
    });
    document.dispatchEvent(readyEvent);
});

// Also dispatch immediately in case DOMContentLoaded already fired
setTimeout(() => {
    console.log('⏰ Timeout: Dispatching extension ready event');
    const readyEvent = new CustomEvent('strideExtensionReady', {
        detail: { extensionId: chrome.runtime?.id }
    });
    document.dispatchEvent(readyEvent);
}, 100); 