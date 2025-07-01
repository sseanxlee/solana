// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Get reference to the overlay button
    const overlayBtn = document.getElementById('overlayBtn');

    // Check if overlay should auto-show when popup opens
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]) {
            const currentTab = tabs[0];

            // Check if this is a supported page
            if (currentTab.url.startsWith('https://axiom.trade/')) {
                const solanaAddressPattern = /\/meme\/([a-zA-Z0-9]{43,44})/;
                const match = currentTab.url.match(solanaAddressPattern);

                if (match) {
                    // Ask content script if overlay should auto-show
                    chrome.tabs.sendMessage(currentTab.id, {
                        action: 'checkOverlayState'
                    }, function (response) {
                        if (response && response.shouldAutoShow) {
                            // Auto-show the overlay
                            const contractAddress = match[1];
                            showOverlay(currentTab.id, contractAddress);
                        }
                    });
                }
            }
        }
    });

    // Add click event listener to the overlay button
    overlayBtn.addEventListener('click', function () {
        // Send message to content script to show overlay
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                const currentTab = tabs[0];

                // Check if the current tab is a supported Axiom page
                if (!currentTab.url.startsWith('https://axiom.trade/')) {
                    alert('Stride overlay only works on Axiom Trade pages.');
                    return;
                }

                // Check for Solana contract address pattern
                const solanaAddressPattern = /\/meme\/([a-zA-Z0-9]{43,44})/;
                const match = currentTab.url.match(solanaAddressPattern);

                if (!match) {
                    alert('Navigate to a token page with a contract address first.');
                    return;
                }

                // Store the contract address for use in the overlay
                const contractAddress = match[1];
                showOverlay(currentTab.id, contractAddress);
            }
        });

        // Add button animation feedback
        overlayBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            overlayBtn.style.transform = 'scale(1)';
        }, 100);
    });

    // Add keyboard support (Enter key and Space bar)
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            overlayBtn.click();
        }
    });

    // Log that the Stride extension has loaded
    console.log('Stride Chrome Extension loaded successfully! 🚀');
});

function showOverlay(tabId, contractAddress) {
    // Send the message to content script with contract address
    chrome.tabs.sendMessage(tabId, {
        action: 'showOverlay',
        contractAddress: contractAddress
    }, function (response) {
        if (chrome.runtime.lastError) {
            console.log('Error sending message:', chrome.runtime.lastError.message);
            // Try to inject content script and CSS manually
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }, function () {
                if (chrome.runtime.lastError) {
                    alert('Stride overlay cannot be used on this page. Please try on a different website.');
                    return;
                }

                // Also inject CSS
                chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['overlay.css']
                }, function () {
                    // Try sending message again
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, {
                            action: 'showOverlay',
                            contractAddress: contractAddress
                        }, function (response) {
                            if (response && response.success) {
                                console.log('Overlay shown successfully');
                                window.close();
                            } else {
                                alert('Stride overlay failed to load. Please refresh the page and try again.');
                            }
                        });
                    }, 100);
                });
            });
        } else if (response && response.success) {
            console.log('Overlay shown successfully');
            // Close the popup after successfully showing overlay
            window.close();
        } else {
            alert('Stride overlay failed to respond. Please refresh the page and try again.');
        }
    });
}
