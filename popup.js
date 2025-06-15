// LinkedIn Smart Liker - Popup Script (CSP Compliant)
(function() {
  'use strict';
  
  console.log('Popup script loading...');
  
  // Check if chrome APIs are available
  if (!chrome || !chrome.storage || !chrome.tabs) {
    console.error('Chrome APIs not available');
    return;
  }

  // DOM elements
  let elements = {};
  let isEnabled = false;
  let sessionStartTime = null;
  let sessionInterval = null;

  // Initialize when DOM is ready
  function init() {
    console.log('Initializing popup...');
    
    // Get DOM elements
    elements = {
      toggleSwitch: document.getElementById('toggleSwitch'),
      toggleKnob: document.getElementById('toggleKnob'),
      statusCard: document.getElementById('statusCard'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      statusDescription: document.getElementById('statusDescription'),
      speedSetting: document.getElementById('speedSetting'),
      likeProbability: document.getElementById('likeProbability'),
      probabilityValue: document.getElementById('probabilityValue'),
      smartFilterToggle: document.getElementById('smartFilterToggle'),
      likesCount: document.getElementById('likesCount'),
      postsViewed: document.getElementById('postsViewed'),
      sessionTime: document.getElementById('sessionTime'),
      resetStats: document.getElementById('resetStats')
    };

    // Check if all elements exist
    for (const [key, element] of Object.entries(elements)) {
      if (!element) {
        console.error(`Element not found: ${key}`);
        return;
      }
    }

    // Load settings and stats
    loadSettings();
    loadStats();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Popup initialized successfully');
  }

  function setupEventListeners() {
    // Toggle switch
    elements.toggleSwitch.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Toggle clicked, current state:', isEnabled);
      
      isEnabled = !isEnabled;
      console.log('New state:', isEnabled);
      
      // Save state
      chrome.storage.sync.set({
        autoLikeEnabled: isEnabled,
        sessionStartTime: isEnabled ? Date.now() : null
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('Error saving state:', chrome.runtime.lastError);
          return;
        }
        console.log('State saved successfully');
      });
      
      // Update UI
      updateUI();
      
      // Manage session timer
      if (isEnabled) {
        startSessionTimer();
      } else {
        stopSessionTimer();
      }
      
      // Notify content script
      notifyContentScript();
    });

    // Speed setting
    elements.speedSetting.addEventListener('change', function() {
      console.log('Speed setting changed:', this.value);
      saveSettings();
      notifyContentScript();
    });

    // Like probability
    elements.likeProbability.addEventListener('input', function() {
      elements.probabilityValue.textContent = this.value + '%';
      console.log('Probability changed:', this.value);
      saveSettings();
      notifyContentScript();
    });

    // Smart filter toggle
    elements.smartFilterToggle.addEventListener('click', function() {
      const isActive = this.classList.contains('active');
      this.classList.toggle('active', !isActive);
      console.log('Smart filter toggled:', !isActive);
      saveSettings();
      notifyContentScript();
    });

    // Reset stats
    elements.resetStats.addEventListener('click', function() {
      if (confirm('Reset all statistics? This cannot be undone.')) {
        chrome.storage.sync.set({
          dailyLikes: 0,
          dailyPostsViewed: 0,
          lastResetDate: new Date().toDateString()
        }, function() {
          if (chrome.runtime.lastError) {
            console.error('Error resetting stats:', chrome.runtime.lastError);
            return;
          }
          elements.likesCount.textContent = '0';
          elements.postsViewed.textContent = '0';
          console.log('Stats reset');
        });
      }
    });
  }

  function loadSettings() {
    console.log('Loading settings...');
    
    chrome.storage.sync.get([
      'autoLikeEnabled',
      'speedSetting',
      'likeProbability',
      'smartFiltering',
      'sessionStartTime'
    ], function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error loading settings:', chrome.runtime.lastError);
        return;
      }
      
      console.log('Settings loaded:', result);
      
      isEnabled = !!result.autoLikeEnabled;
      elements.speedSetting.value = result.speedSetting || 'normal';
      elements.likeProbability.value = result.likeProbability || 80;
      elements.probabilityValue.textContent = (result.likeProbability || 80) + '%';
      
      const smartFilter = result.smartFiltering !== false;
      elements.smartFilterToggle.classList.toggle('active', smartFilter);
      
      sessionStartTime = result.sessionStartTime;
      
      if (isEnabled && sessionStartTime) {
        startSessionTimer();
      }
      
      updateUI();
    });
  }

  function loadStats() {
    console.log('Loading stats...');
    
    chrome.storage.sync.get([
      'dailyLikes',
      'dailyPostsViewed',
      'lastResetDate'
    ], function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error loading stats:', chrome.runtime.lastError);
        return;
      }
      
      console.log('Stats loaded:', result);
      
      const today = new Date().toDateString();
      
      if (result.lastResetDate !== today) {
        // Reset daily stats
        chrome.storage.sync.set({
          dailyLikes: 0,
          dailyPostsViewed: 0,
          lastResetDate: today
        });
        elements.likesCount.textContent = '0';
        elements.postsViewed.textContent = '0';
      } else {
        elements.likesCount.textContent = result.dailyLikes || 0;
        elements.postsViewed.textContent = result.dailyPostsViewed || 0;
      }
    });
  }

  function saveSettings() {
    const settings = {
      speedSetting: elements.speedSetting.value,
      likeProbability: parseInt(elements.likeProbability.value),
      smartFiltering: elements.smartFilterToggle.classList.contains('active')
    };
    
    console.log('Saving settings:', settings);
    
    chrome.storage.sync.set(settings, function() {
      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
      } else {
        console.log('Settings saved successfully');
      }
    });
  }

  function updateUI() {
    console.log('Updating UI, enabled:', isEnabled);
    
    // Update status
    elements.statusCard.classList.toggle('active', isEnabled);
    elements.statusDot.classList.toggle('active', isEnabled);
    elements.toggleSwitch.classList.toggle('active', isEnabled);
    elements.toggleKnob.classList.toggle('active', isEnabled);
    
    elements.statusText.textContent = isEnabled ? 'Active' : 'Inactive';
    elements.statusDescription.textContent = isEnabled 
      ? 'Extension is running and monitoring LinkedIn' 
      : 'Extension is currently disabled';
  }

  function startSessionTimer() {
    if (!sessionStartTime) {
      sessionStartTime = Date.now();
    }
    
    if (sessionInterval) {
      clearInterval(sessionInterval);
    }
    
    sessionInterval = setInterval(updateSessionTime, 1000);
    updateSessionTime();
    console.log('Session timer started');
  }

  function stopSessionTimer() {
    if (sessionInterval) {
      clearInterval(sessionInterval);
      sessionInterval = null;
    }
    sessionStartTime = null;
    elements.sessionTime.textContent = '00:00';
    console.log('Session timer stopped');
  }

  function updateSessionTime() {
    if (!sessionStartTime) return;
    
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    elements.sessionTime.textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function notifyContentScript() {
    console.log('Notifying content script...');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'settingsUpdated'
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.log('Content script not available:', chrome.runtime.lastError.message);
          } else {
            console.log('Content script notified:', response);
          }
        });
      } else {
        console.log('Not a LinkedIn tab');
      }
    });
  }

  // Listen for messages from content script
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      console.log('Popup received message:', message);
      
      if (message.action === 'updateStats') {
        elements.likesCount.textContent = message.likes;
        elements.postsViewed.textContent = message.postsViewed;
      }
      
      sendResponse({ received: true });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', function() {
    if (sessionInterval) {
      clearInterval(sessionInterval);
    }
  });
})();