// LinkedIn Smart Liker - Background Script (Updated)
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // Handle installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.setDefaultSettings();
        console.log('LinkedIn Smart Liker installed successfully');
      } else if (details.reason === 'update') {
        console.log('LinkedIn Smart Liker updated');
      }
    });

    // Handle messages from content script and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle tab updates to inject content script if needed
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && 
          tab.url && 
          tab.url.includes('linkedin.com') && 
          !tab.url.includes('linkedin.com/help') &&
          !tab.url.includes('linkedin.com/legal')) {
        this.checkAndInjectContentScript(tabId);
      }
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.cleanupOldData();
    });

    // Initialize cleanup
    this.cleanupOldData();
  }

  setDefaultSettings() {
    const defaultSettings = {
      autoLikeEnabled: false,
      speedSetting: 'normal',
      likeProbability: 70,
      smartFiltering: true,
      dailyLikes: 0,
      dailyPostsViewed: 0,
      lastResetDate: new Date().toDateString(),
      sessionStartTime: null
    };

    chrome.storage.sync.set(defaultSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Error setting default settings:', chrome.runtime.lastError);
      } else {
        console.log('Default settings initialized');
      }
    });
  }

  handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getStatus':
          this.getExtensionStatus(sendResponse);
          break;
          
        case 'updateStats':
          this.updateStats(message, sendResponse);
          break;
          
        case 'getSettings':
          this.getSettings(sendResponse);
          break;

        case 'ping':
          sendResponse({ status: 'alive', service: 'background' });
          break;

        case 'logActivity':
          console.log('Activity:', message.data);
          sendResponse({ success: true });
          break;
          
        default:
          console.log('Unknown action:', message.action);
          sendResponse({ error: 'Unknown action', action: message.action });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  getExtensionStatus(sendResponse) {
    chrome.storage.sync.get([
      'autoLikeEnabled',
      'dailyLikes',
      'dailyPostsViewed',
      'sessionStartTime'
    ], (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({ 
        status: !!result.autoLikeEnabled,
        enabled: !!result.autoLikeEnabled,
        stats: {
          dailyLikes: result.dailyLikes || 0,
          dailyPostsViewed: result.dailyPostsViewed || 0
        },
        sessionActive: !!result.sessionStartTime
      });
    });
  }

  updateStats(message, sendResponse) {
    const updates = {};
    
    if (typeof message.likes === 'number') {
      updates.dailyLikes = message.likes;
    }
    
    if (typeof message.postsViewed === 'number') {
      updates.dailyPostsViewed = message.postsViewed;
    }

    // Update last activity timestamp
    updates.lastActivity = Date.now();

    chrome.storage.sync.set(updates, () => {
      if (chrome.runtime.lastError) {
        console.error('Error updating stats:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
        console.log('Stats updated:', updates);
      }
    });
  }

  getSettings(sendResponse) {
    chrome.storage.sync.get([
      'autoLikeEnabled',
      'speedSetting',
      'likeProbability',
      'smartFiltering',
      'dailyLikes',
      'dailyPostsViewed',
      'lastResetDate',
      'sessionStartTime'
    ], (result) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      sendResponse({
        settings: {
          autoLikeEnabled: !!result.autoLikeEnabled,
          speedSetting: result.speedSetting || 'normal',
          likeProbability: result.likeProbability || 70,
          smartFiltering: result.smartFiltering !== false
        },
        stats: {
          dailyLikes: result.dailyLikes || 0,
          dailyPostsViewed: result.dailyPostsViewed || 0,
          lastResetDate: result.lastResetDate,
          sessionStartTime: result.sessionStartTime
        }
      });
    });
  }

  async checkAndInjectContentScript(tabId) {
    try {
      // First check if the tab is still valid
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab || !tab.url || !tab.url.includes('linkedin.com')) {
        return;
      }

      // Check if content script is already injected
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' })
        .catch(() => null);
      
      if (!response || response.status !== 'alive') {
        // Inject content script if not already present
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        
        console.log('Content script injected into tab:', tabId);
        
        // Give it a moment to initialize then send settings update
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'settingsUpdated' })
            .catch(() => {
              console.log('Could not notify content script of settings');
            });
        }, 1000);
      } else {
        console.log('Content script already active in tab:', tabId);
      }
    } catch (error) {
      console.error('Error checking/injecting content script:', error);
    }
  }

  // Clean up old data periodically
  cleanupOldData() {
    chrome.storage.sync.get(['lastResetDate', 'autoLikeEnabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error during cleanup:', chrome.runtime.lastError);
        return;
      }

      const today = new Date().toDateString();
      
      if (result.lastResetDate !== today) {
        // Reset daily stats for new day but preserve settings
        const resetData = {
          dailyLikes: 0,
          dailyPostsViewed: 0,
          lastResetDate: today,
          sessionStartTime: null // Reset session on new day
        };

        chrome.storage.sync.set(resetData, () => {
          if (chrome.runtime.lastError) {
            console.error('Error resetting daily stats:', chrome.runtime.lastError);
          } else {
            console.log('Daily stats reset for new day:', today);
          }
        });
      }
    });
  }

  // Monitor extension health
  monitorHealth() {
    chrome.tabs.query({ url: "*://www.linkedin.com/*" }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }

      console.log(`Found ${tabs.length} LinkedIn tabs`);
      
      // Check each LinkedIn tab
      tabs.forEach(async (tab) => {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
          if (!response || response.status !== 'alive') {
            console.log(`Content script not responding in tab ${tab.id}, re-injecting...`);
            this.checkAndInjectContentScript(tab.id);
          }
        } catch (error) {
          console.log(`Content script not found in tab ${tab.id}`);
          this.checkAndInjectContentScript(tab.id);
        }
      });
    });
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Clean up old data every hour
setInterval(() => {
  backgroundService.cleanupOldData();
}, 60 * 60 * 1000);

// Health monitoring every 5 minutes
setInterval(() => {
  backgroundService.monitorHealth();
}, 5 * 60 * 1000);

// Handle extension suspend/resume
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending...');
});

if (chrome.runtime.onSuspendCanceled) {
  chrome.runtime.onSuspendCanceled.addListener(() => {
    console.log('Extension suspend canceled');
  });
}