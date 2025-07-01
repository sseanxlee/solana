// Content script for Stride overlay functionality
let strideOverlay = null;
let currentContractAddress = null;
let overlayExplicitlyClosed = false; // Track if user explicitly closed overlay
let overlayState = { visible: false, created: false }; // Track overlay state

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showOverlay') {
        // Pass the contract address to the overlay creation
        currentContractAddress = request.contractAddress;
        overlayExplicitlyClosed = false; // Reset explicit close flag

        if (!overlayState.created) {
            createOverlay(currentContractAddress);
        } else {
            // If overlay exists but is hidden, just show it
            showOverlay();
            updateOverlayContent(currentContractAddress);
        }

        // Set up URL change monitoring
        setupUrlChangeMonitoring();

        sendResponse({ success: true });
    } else if (request.action === 'hideOverlay') {
        hideOverlay();
        sendResponse({ success: true });
    } else if (request.action === 'checkOverlayState') {
        // Return current overlay state for popup to decide if it should auto-show
        sendResponse({
            shouldAutoShow: overlayState.created && !overlayExplicitlyClosed && isValidUrl(window.location.href)
        });
    }
});

// Check if current URL supports the overlay
function isValidUrl(url) {
    const solanaAddressPattern = /\/meme\/([a-zA-Z0-9]{43,44})/;
    return url.startsWith('https://axiom.trade/') && solanaAddressPattern.test(url);
}

// Monitor for URL changes to update contract address
function setupUrlChangeMonitoring() {
    // Function to check and update contract address in the URL
    function checkForContractAddressChange(url) {
        const solanaAddressPattern = /\/meme\/([a-zA-Z0-9]{43,44})/;
        const match = url.match(solanaAddressPattern);

        if (match && overlayState.created && !overlayExplicitlyClosed) {
            if (match[1] !== currentContractAddress) {
                // URL changed to a different contract address
                currentContractAddress = match[1];
                updateOverlayContent(currentContractAddress);
            }
            // Show overlay if it was auto-hidden and now we're on a valid page
            if (!overlayState.visible) {
                showOverlay();
            }
        } else if (!match && overlayState.created && !overlayExplicitlyClosed) {
            // No valid contract address in URL, hide the overlay but don't destroy it
            hideOverlay(false); // false = don't destroy, just hide
        }
    }

    // Track URL changes using interval for SPA navigation
    let lastUrl = window.location.href;
    const intervalId = setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            checkForContractAddressChange(currentUrl);
        }
    }, 500);

    // Store interval ID so we can clear it when the overlay is closed
    window.strideIntervalId = intervalId;

    // Create a MutationObserver as backup detection method
    const urlObserver = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            checkForContractAddressChange(currentUrl);
        }
    });

    // Start observing the document for URL changes
    urlObserver.observe(document, {
        subtree: true,
        childList: true
    });

    // Store observer so we can disconnect it when overlay is closed
    window.strideUrlObserver = urlObserver;

    // Also listen for popstate events (browser back/forward)
    const popstateListener = function () {
        checkForContractAddressChange(window.location.href);
    };

    window.addEventListener('popstate', popstateListener);

    // Store reference to the listener for cleanup
    window.stridePopstateListener = popstateListener;
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
                width: content.style.width || '300px',
                height: content.style.height || '120px'
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

// Update overlay content with new contract address
function updateOverlayContent(contractAddress) {
    if (strideOverlay) {
        const addressElement = strideOverlay.querySelector('.token-address');
        if (addressElement) {
            addressElement.textContent = contractAddress;
        }
    }
}

// Show overlay (without recreating)
function showOverlay() {
    if (strideOverlay) {
        strideOverlay.style.display = 'block';
        overlayState.visible = true;
    }
}

function createOverlay(contractAddress) {
    // Remove existing overlay if present
    if (strideOverlay) {
        destroyOverlay();
    }

    // Ensure fonts are loaded
    if (!document.getElementById('stride-fonts')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'stride-fonts';
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&family=Funnel+Sans:wght@300;400;500;600;700&display=swap';
        document.head.appendChild(fontLink);
    }

    // Create draggable overlay container
    strideOverlay = document.createElement('div');
    strideOverlay.id = 'stride-overlay';
    strideOverlay.style.zIndex = '2147483647'; // Ensure highest z-index
    strideOverlay.innerHTML = `
        <div class="stride-overlay-content" id="strideContent">
            <div class="stride-header" id="strideHeader">
                <h2>Set Alert</h2>
                <button class="stride-close-btn" id="strideCloseBtn">×</button>
            </div>
            <div class="stride-body">
                <p class="token-address">${contractAddress}</p>
            </div>
            <div class="stride-resize-handle stride-resize-se" id="strideResizeSE"></div>
            <div class="stride-resize-handle stride-resize-s" id="strideResizeS"></div>
            <div class="stride-resize-handle stride-resize-e" id="strideResizeE"></div>
        </div>
    `;

    // Add overlay to page
    document.body.appendChild(strideOverlay);
    overlayState.created = true;
    overlayState.visible = true;

    // Get the content element
    const content = document.getElementById('strideContent');

    // Restore position and size if available
    chrome.storage.local.get(['strideOverlayPosition'], function (result) {
        if (result.strideOverlayPosition) {
            // Restore position and size
            content.style.transform = result.strideOverlayPosition.transform;
            content.style.width = result.strideOverlayPosition.width;
            content.style.height = result.strideOverlayPosition.height;
            window.xOffset = result.strideOverlayPosition.xOffset;
            window.yOffset = result.strideOverlayPosition.yOffset;
        } else {
            // Set initial position using transform to avoid CSS positioning issues
            const initialX = window.innerWidth - 320; // 300px width + 20px margin
            const initialY = window.innerHeight * 0.3; // 30% from top
            content.style.transform = `translate(${initialX}px, ${initialY}px)`;
            content.style.top = '0';
            content.style.left = '0';
            window.xOffset = initialX;
            window.yOffset = initialY;
        }
    });

    // Make the overlay draggable and resizable
    makeDraggable();
    makeResizable();

    // Add event listeners
    document.getElementById('strideCloseBtn').addEventListener('click', () => {
        overlayExplicitlyClosed = true; // Mark as explicitly closed
        destroyOverlay();
    });

    // Escape key to close
    document.addEventListener('keydown', handleEscapeKey);
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
                newWidth = Math.max(200, startWidth + deltaX);
            }
            if (handle.includes('s')) {
                newHeight = Math.max(100, startHeight + deltaY);
            }

            // Apply the new dimensions directly
            content.style.width = newWidth + 'px';
            content.style.height = newHeight + 'px';
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

    header.addEventListener('mousedown', dragStart, { capture: true });

    function dragStart(e) {
        if (e.target.id === 'strideCloseBtn') {
            return; // Don't start drag on close button
        }

        e.stopPropagation();
        e.preventDefault();

        // Calculate initial position
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;

        // Change cursor during drag
        header.style.cursor = 'grabbing';
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
    if (strideOverlay) {
        if (shouldDestroy) {
            destroyOverlay();
        } else {
            // Just hide visually, don't destroy
            strideOverlay.style.display = 'none';
            overlayState.visible = false;
            saveOverlayState();
        }
    }
}

function destroyOverlay() {
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
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        overlayExplicitlyClosed = true; // Mark as explicitly closed
        destroyOverlay();
    }
}

// Load saved state on page load
chrome.storage.local.get(['strideOverlayCreated', 'strideOverlayExplicitlyClosed'], function (result) {
    if (result.strideOverlayCreated && !result.strideOverlayExplicitlyClosed && isValidUrl(window.location.href)) {
        overlayState.created = result.strideOverlayCreated;
        overlayExplicitlyClosed = result.strideOverlayExplicitlyClosed || false;

        // Extract contract address from current URL and auto-show overlay
        const solanaAddressPattern = /\/meme\/([a-zA-Z0-9]{43,44})/;
        const match = window.location.href.match(solanaAddressPattern);
        if (match) {
            currentContractAddress = match[1];
            createOverlay(currentContractAddress);
            setupUrlChangeMonitoring();
        }
    }
}); 