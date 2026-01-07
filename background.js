// Background service worker for Smart Chess Bot Chrome Extension

// Helper function to safely check if a URL belongs to a chess site
// Uses URL parsing to prevent URL spoofing attacks
function isChessSiteUrl(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    // Check for exact domain match or valid subdomains
    return hostname === 'chess.com' || 
           hostname === 'www.chess.com' || 
           hostname.endsWith('.chess.com') ||
           hostname === 'lichess.org' || 
           hostname === 'www.lichess.org' ||
           hostname.endsWith('.lichess.org');
  } catch (e) {
    return false;
  }
}

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Smart Chess Bot extension installed');
  } else if (details.reason === 'update') {
    console.log('Smart Chess Bot extension updated');
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getEngineUrl') {
    // Return the URL for engine files
    const url = chrome.runtime.getURL(request.file);
    sendResponse({ url: url });
    return true;
  }
  
  if (request.action === 'getBestMove') {
    // Forward best move request to node server
    fetch(request.url)
      .then(response => response.json())
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'openPopup') {
    // Open the extension popup programmatically (if needed)
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// Handle tab updates to detect chess sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (isChessSiteUrl(tab.url)) {
      console.log('Chess site detected:', tab.url);
    }
  }
});
