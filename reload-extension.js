// reload-extension.js - Helper script to reload the extension
// Run this in the browser console when you need to reload the extension

function reloadExtension() {
    try {
        // Check if we're in an extension context
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            console.log('Not in extension context');
            return;
        }

        // Reload the extension
        chrome.runtime.reload();
        console.log('Extension reload initiated');
        
    } catch (error) {
        console.error('Error reloading extension:', error);
    }
}

function checkExtensionStatus() {
    try {
        if (typeof chrome === 'undefined') {
            console.log('❌ Chrome API not available');
            return;
        }
        
        if (!chrome.runtime) {
            console.log('❌ Chrome runtime not available');
            return;
        }
        
        if (!chrome.runtime.id) {
            console.log('❌ Extension ID not available');
            return;
        }
        
        console.log('✅ Extension context is valid');
        console.log('Extension ID:', chrome.runtime.id);
        
        // Test basic functionality
        if (chrome.tabs) {
            console.log('✅ Tabs API available');
        } else {
            console.log('❌ Tabs API not available');
        }
        
        if (chrome.storage) {
            console.log('✅ Storage API available');
        } else {
            console.log('❌ Storage API not available');
        }
        
        if (chrome.scripting) {
            console.log('✅ Scripting API available');
        } else {
            console.log('❌ Scripting API not available');
        }
        
    } catch (error) {
        console.error('Error checking extension status:', error);
    }
}

// Auto-run status check
checkExtensionStatus();

// Export functions for manual use
window.reloadExtension = reloadExtension;
window.checkExtensionStatus = checkExtensionStatus;

console.log('Extension helper loaded. Use reloadExtension() or checkExtensionStatus() in console.'); 