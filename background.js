// background.js - Service worker for DSA Coach AI extension

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('DSA Coach AI extension installed');
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openCoach') {
        // Open the extension popup
        chrome.action.openPopup();
        sendResponse({success: true});
    }
    
    // Keep the message channel open for async responses
    return true;
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('leetcode.com/problems/')) {
        // Ensure content script is injected
        chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ['content.js']
        }).catch(() => {
            // Script might already be injected, ignore the error
        });
    }
});

// Clean up storage periodically (optional)
chrome.alarms.create('cleanupStorage', {
    delayInMinutes: 60,
    periodInMinutes: 60
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupStorage') {
        // Clean up old conversation history (older than 7 days)
        chrome.storage.local.get(null, (items) => {
            const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
            
            Object.keys(items).forEach(key => {
                if (key.includes('conversationHistory')) {
                    const data = items[key];
                    if (data.timestamp && data.timestamp < cutoffTime) {
                        chrome.storage.local.remove(key);
                    }
                }
            });
        });
    }
});