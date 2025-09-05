# DSA Coach AI Extension - Popup Troubleshooting Guide

## Issue: Popup Not Displaying When Extension Icon is Clicked

### Quick Fixes to Try First:

1. **Reload the Extension**
   - Go to `chrome://extensions/`
   - Find "DSA Coach AI" extension
   - Click the refresh/reload button
   - Try clicking the extension icon again

2. **Check Extension Status**
   - Ensure the extension is enabled (toggle should be ON)
   - Make sure there are no error messages in the extension card

3. **Clear Browser Cache**
   - Clear browser cache and cookies
   - Restart the browser
   - Try the extension again

### Common Causes and Solutions:

#### 1. Extension Context Invalidated Error
**Problem**: "Extension context invalidated" error when clicking extension icon
**Solution**: 
- This error occurs when the extension is reloaded while content scripts are running
- **Immediate fix**: Go to `chrome://extensions/` and click the refresh button on your extension
- **Prevention**: The extension now has better error handling for this scenario

#### 2. Missing Permissions
**Problem**: Extension doesn't have required permissions
**Solution**: 
- Check `manifest.json` has all required permissions:
  ```json
  "permissions": ["activeTab", "scripting", "storage", "tabs"]
  ```

#### 3. CORS and Backend Connection Errors
**Problem**: "Access to fetch at 'http://localhost:3000/api/health' has been blocked by CORS policy"
**Solution**: 
- This error occurs because content scripts cannot make cross-origin requests
- The extension now handles backend connections only through the popup
- If you need the backend, ensure it's running and accessible from the popup context

#### 4. Duplicate Content Script Injection
**Problem**: "Identifier 'LeetCodeExtractor' has already been declared"
**Solution**: 
- The extension now prevents duplicate content script injection
- If you see this error, refresh the page and try again
- The extension will automatically detect and clean up duplicate instances

#### 2. JavaScript Errors
**Problem**: Popup fails to initialize due to JavaScript errors
**Solution**:
- Open browser console (F12 → Console tab)
- Click the extension icon
- Look for error messages starting with "DSA Coach:"
- Check if all required DOM elements exist

#### 3. Content Security Policy Issues
**Problem**: Browser blocks popup due to CSP violations
**Solution**:
- Check if popup.html has proper meta tags
- Ensure all scripts are properly loaded

#### 4. Extension Context Issues
**Problem**: Extension runs in wrong context
**Solution**:
- Verify `manifest.json` has correct `action` configuration
- Check that `default_popup` points to correct file

### Debugging Steps:

1. **Open the Test Page**
   - Open `test-popup.html` in your browser
   - This will help identify if Chrome APIs are available

2. **Check Console Logs**
   - Open browser console
   - Click extension icon
   - Look for initialization messages:
     ```
     DSA Coach: DOM loaded, initializing popup...
     DSA Coach: Popup initializing...
     DSA Coach: Setting up popup...
     DSA Coach: Event listeners set up successfully
     DSA Coach: Popup initialized successfully
     ```

3. **Verify File Structure**
   - Ensure all files exist in the correct locations:
     ```
     manifest.json
     popup.html
     popup.js
     popup.css
     background.js
     content.js
     icons/icon16.png
     icons/icon48.png
     icons/icon128.png
     ```

4. **Test on Different Pages**
   - Try the extension on different websites
   - Some pages may have restrictions that prevent popup display

### Advanced Troubleshooting:

#### Check Extension Background:
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "Service Worker" link
4. Check for any error messages

#### Verify Manifest Syntax:
1. Use a JSON validator to check `manifest.json`
2. Ensure all required fields are present
3. Check for syntax errors

#### Test in Incognito Mode:
1. Open incognito/private browsing window
2. Enable the extension for incognito mode
3. Test if popup works there

### If Nothing Works:

1. **Reinstall the Extension**
   - Remove the extension completely
   - Clear browser cache
   - Reinstall from source

2. **Check Browser Compatibility**
   - Ensure you're using Chrome/Edge version 88+
   - Manifest V3 requires recent browser versions

3. **File Permissions**
   - Ensure all extension files are readable
   - Check file ownership and permissions

### Getting Help:

If you're still experiencing issues:

1. Check the browser console for specific error messages
2. Look for "DSA Coach:" prefixed messages in the console
3. Try the test page (`test-popup.html`) to isolate the problem
4. Check if the issue occurs on specific websites or all websites

### Expected Behavior:

When working correctly, the extension should:
1. Display an icon in the browser toolbar
2. Show a popup when clicked
3. Load the DSA Coach AI interface
4. Display "Loading problem..." initially
5. Show problem information if on a LeetCode page
6. Allow switching between Discussion and Code Analysis modes

If any of these steps fail, the console logs should provide specific error information to help diagnose the issue.

### Specific Error: "Extension context invalidated"

**What it means**: This error occurs when the extension's service worker or content scripts lose their connection to the extension runtime, usually due to:
- Extension being reloaded/updated while running
- Browser restart
- Extension being disabled and re-enabled

**How to fix**:
1. Go to `chrome://extensions/`
2. Find "DSA Coach AI" extension
3. Click the refresh/reload button (🔄)
4. Refresh any LeetCode pages you have open
5. Try clicking the extension icon again

**Prevention**: The extension now includes better error handling and will show a helpful error message when this occurs, with instructions on how to fix it.

### Common Console Errors and Solutions:

#### 1. CORS Policy Errors
```
Access to fetch at 'http://localhost:3000/api/health' from origin 'https://leetcode.com' has been blocked by CORS policy
```
**Cause**: Content scripts cannot make cross-origin requests to localhost
**Solution**: Backend connections are now handled by the popup, not content scripts
**Status**: ✅ Fixed in latest version

#### 2. Duplicate Class Declaration
```
Identifier 'LeetCodeExtractor' has already been declared
```
**Cause**: Content script being injected multiple times
**Solution**: Added duplicate injection prevention
**Status**: ✅ Fixed in latest version

#### 3. Backend Connection Failures
```
DSA Coach: Backend not available, using mock responses
```
**Cause**: Backend server not running or not accessible
**Solution**: This is now handled gracefully with fallback to mock responses
**Status**: ✅ Working as intended 