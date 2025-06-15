// LinkedIn Smart Liker - Content Script (Faster Version with 3-8 second intervals)
class LinkedInSmartLiker {
  constructor() {
    this.isEnabled = false;
    this.settings = {
      speedSetting: 'normal',
      likeProbability: 70,
      smartFiltering: true,
      autoLikeEnabled: false
    };
    
    this.stats = {
      dailyLikes: 0,
      dailyPostsViewed: 0,
      lastResetDate: new Date().toDateString()
    };
    
    this.processedPosts = new Set();
    this.recentlyLikedAuthors = new Map();
    this.lastActionTime = 0;
    this.isProcessing = false;
    this.observer = null;
    this.processingInterval = null;
    this.isContextValid = true;

    this.init();
  }

  async init() {
    console.log('LinkedIn Smart Liker initialized');
    
    // Check if extension context is valid
    if (!this.checkExtensionContext()) {
      console.log('Extension context invalid, stopping initialization');
      return;
    }

    try {
      await this.loadSettings();
      await this.loadStats();
      
      // Start monitoring regardless of enabled state
      this.setupObservers();
      
      if (this.isEnabled) {
        this.startLiking();
      }

      // Listen for messages with error handling
      this.setupMessageListener();
      
    } catch (error) {
      console.error('Error during initialization:', error);
      this.handleExtensionError(error);
    }
  }

  checkExtensionContext() {
    try {
      // Test if chrome.runtime is available
      if (chrome && chrome.runtime && chrome.runtime.id) {
        this.isContextValid = true;
        return true;
      }
    } catch (error) {
      console.log('Extension context invalidated');
    }
    
    this.isContextValid = false;
    this.cleanup();
    return false;
  }

  setupMessageListener() {
    if (!this.checkExtensionContext()) return;

    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!this.isContextValid) {
          sendResponse({ error: 'Extension context invalid' });
          return false;
        }
        
        this.handleMessage(message, sender, sendResponse);
        return true;
      });
    } catch (error) {
      console.error('Error setting up message listener:', error);
      this.handleExtensionError(error);
    }
  }

  handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'settingsUpdated':
          this.loadSettings().then(() => {
            if (this.isEnabled) {
              this.startLiking();
            } else {
              this.stopLiking();
            }
            sendResponse({ success: true });
          }).catch(error => {
            console.error('Error handling settings update:', error);
            sendResponse({ error: error.message });
          });
          break;
        case 'ping':
          sendResponse({ status: 'alive', contextValid: this.isContextValid });
          break;
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async loadSettings() {
    if (!this.checkExtensionContext()) return;

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get([
          'autoLikeEnabled',
          'speedSetting',
          'likeProbability',
          'smartFiltering'
        ], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          this.isEnabled = !!result.autoLikeEnabled;
          this.settings = {
            speedSetting: result.speedSetting || 'normal',
            likeProbability: result.likeProbability || 70,
            smartFiltering: result.smartFiltering !== false,
            autoLikeEnabled: !!result.autoLikeEnabled
          };
          console.log('Settings loaded:', this.settings);
          resolve();
        });
      } catch (error) {
        this.handleExtensionError(error);
        reject(error);
      }
    });
  }

  async loadStats() {
    if (!this.checkExtensionContext()) return;

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get([
          'dailyLikes',
          'dailyPostsViewed',
          'lastResetDate'
        ], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          const today = new Date().toDateString();
          
          if (result.lastResetDate !== today) {
            this.stats = {
              dailyLikes: 0,
              dailyPostsViewed: 0,
              lastResetDate: today
            };
            this.saveStats();
          } else {
            this.stats = {
              dailyLikes: result.dailyLikes || 0,
              dailyPostsViewed: result.dailyPostsViewed || 0,
              lastResetDate: result.lastResetDate || today
            };
          }
          resolve();
        });
      } catch (error) {
        this.handleExtensionError(error);
        reject(error);
      }
    });
  }

  saveStats() {
    if (!this.checkExtensionContext()) return;

    try {
      chrome.storage.sync.set(this.stats, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving stats:', chrome.runtime.lastError);
          return;
        }
      });

      // Try to notify popup, but don't fail if it's not available
      chrome.runtime.sendMessage({
        action: 'updateStats',
        likes: this.stats.dailyLikes,
        postsViewed: this.stats.dailyPostsViewed
      }).catch(() => {
        // Popup might not be open, ignore error
      });
    } catch (error) {
      this.handleExtensionError(error);
    }
  }

  setupObservers() {
    if (!this.isContextValid) return;

    try {
      // Mutation observer for new content
      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new MutationObserver((mutations) => {
        if (this.isEnabled && !this.isProcessing && this.isContextValid) {
          this.debounceProcessPosts();
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Scroll observer - reduced timeout for faster response
      let scrollTimeout;
      window.addEventListener('scroll', () => {
        if (!this.isEnabled || !this.isContextValid) return;
        
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.debounceProcessPosts();
        }, 500); // Reduced from 1000ms to 500ms
      });

      console.log('Observers set up');
    } catch (error) {
      console.error('Error setting up observers:', error);
    }
  }

  debounceProcessPosts() {
    if (!this.isContextValid) return;

    clearTimeout(this.processingTimeout);
    this.processingTimeout = setTimeout(() => {
      if (this.isEnabled && !this.isProcessing && this.isContextValid) {
        this.processVisiblePosts();
      }
    }, 1000); // Reduced from 2000ms to 1000ms
  }

  startLiking() {
    if (!this.isEnabled || !this.isContextValid) return;
    
    console.log('Smart Liker activated');
    
    // Start periodic processing - much faster interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      if (this.isEnabled && !this.isProcessing && this.isContextValid) {
        this.processVisiblePosts();
      }
    }, 4000); // Reduced from 10000ms to 4000ms for faster checking

    // Initial processing - faster startup
    setTimeout(() => {
      if (this.isContextValid) {
        this.processVisiblePosts();
      }
    }, 1000); // Reduced from 3000ms to 1000ms
  }

  stopLiking() {
    console.log('Smart Liker deactivated');
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  async processVisiblePosts() {
    if (this.isProcessing || !this.isEnabled || !this.isContextValid) return;
    
    this.isProcessing = true;
    console.log('Processing visible posts...');

    try {
      // Double-check context before proceeding
      if (!this.checkExtensionContext()) {
        this.isProcessing = false;
        return;
      }

      const posts = this.getVisiblePosts();
      console.log(`Found ${posts.length} posts to evaluate`);

      for (const post of posts) {
        if (!this.isEnabled || !this.isContextValid) break;
        
        const postId = this.getPostId(post);
        if (this.processedPosts.has(postId)) continue;

        this.processedPosts.add(postId);
        this.stats.dailyPostsViewed++;

        await this.evaluateAndLikePost(post);
        
        // Faster random delay between posts (3-8 seconds)
        const delay = this.getFasterRandomDelay();
        await this.sleep(delay);
      }

      if (this.isContextValid) {
        this.saveStats();
      }
    } catch (error) {
      console.error('Error processing posts:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        this.handleExtensionError(error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  getVisiblePosts() {
    try {
      // Updated selectors for current LinkedIn
      const posts = Array.from(document.querySelectorAll('[data-id^="urn:li:activity:"]')).filter(post => {
        const rect = post.getBoundingClientRect();
        return rect.top >= 0 && rect.top <= window.innerHeight && rect.height > 100;
      });

      // Fallback selectors
      if (posts.length === 0) {
        const fallbackPosts = Array.from(document.querySelectorAll('.feed-shared-update-v2, .occludable-update, .feed-shared-update-v2__content')).filter(post => {
          const rect = post.getBoundingClientRect();
          return rect.top >= 0 && rect.top <= window.innerHeight && rect.height > 100;
        });
        return fallbackPosts;
      }

      return posts;
    } catch (error) {
      console.error('Error getting visible posts:', error);
      return [];
    }
  }

  getPostId(postElement) {
    try {
      const dataId = postElement.getAttribute('data-id');
      if (dataId) return dataId;

      // Fallback
      const rect = postElement.getBoundingClientRect();
      const textContent = postElement.textContent.substring(0, 50).replace(/\s+/g, '');
      return `${Math.floor(rect.top)}-${textContent}`;
    } catch (error) {
      console.error('Error getting post ID:', error);
      return `fallback-${Date.now()}-${Math.random()}`;
    }
  }

  async evaluateAndLikePost(postElement) {
    if (!this.isContextValid) return;

    try {
      const likeButton = this.findLikeButton(postElement);
      if (!likeButton) {
        console.log('No like button found');
        return;
      }

      if (this.isAlreadyLiked(likeButton)) {
        console.log('Post already liked');
        return;
      }

      // Smart filtering
      if (this.settings.smartFiltering) {
        const author = this.getPostAuthor(postElement);
        if (author && this.hasRecentlyLikedAuthor(author)) {
          console.log(`Skipping - recently liked ${author}`);
          return;
        }
      }

      // Probability check
      const shouldLike = Math.random() * 100 < this.settings.likeProbability;
      if (!shouldLike) {
        console.log('Skipping due to probability');
        return;
      }

      // Like the post with minimal delay before clicking
      await this.sleep(this.getHumanClickDelay()); // Small human-like delay before click
      await this.humanLikeClick(likeButton);

      this.stats.dailyLikes++;
      
      if (this.settings.smartFiltering) {
        const author = this.getPostAuthor(postElement);
        if (author) {
          this.markAuthorAsRecentlyLiked(author);
        }
      }

      console.log(`✓ Liked post! Total: ${this.stats.dailyLikes}`);

    } catch (error) {
      console.error('Error evaluating post:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        this.handleExtensionError(error);
      }
    }
  }

  findLikeButton(postElement) {
    try {
      // Current LinkedIn like button selectors
      const selectors = [
        'button[aria-label*="React Like"]',
        'button[aria-label*="Like"]',
        'button[data-control-name="like_toggle"]',
        '.social-actions-button[aria-label*="Like"]',
        'button.react-button__trigger',
        'button[data-test-id="reactions-menu-trigger"]'
      ];

      for (const selector of selectors) {
        const button = postElement.querySelector(selector);
        if (button) {
          const label = button.getAttribute('aria-label') || '';
          if (label.toLowerCase().includes('like') && !label.toLowerCase().includes('unlike')) {
            return button;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding like button:', error);
      return null;
    }
  }

  isAlreadyLiked(likeButton) {
    try {
      const ariaPressed = likeButton.getAttribute('aria-pressed');
      const ariaLabel = likeButton.getAttribute('aria-label') || '';
      
      return (
        ariaPressed === 'true' ||
        ariaLabel.toLowerCase().includes('unlike') ||
        likeButton.classList.contains('active') ||
        likeButton.classList.contains('artdeco-button--selected') ||
        likeButton.querySelector('.liked')
      );
    } catch (error) {
      console.error('Error checking if already liked:', error);
      return false;
    }
  }

  getPostAuthor(postElement) {
    try {
      const selectors = [
        '.update-components-actor__name',
        '.feed-shared-actor__name',
        '[data-control-name="actor"] span[aria-hidden="true"]',
        '.feed-shared-actor__name .visually-hidden'
      ];

      for (const selector of selectors) {
        const element = postElement.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting post author:', error);
      return null;
    }
  }

  hasRecentlyLikedAuthor(author) {
    const now = Date.now();
    const lastLiked = this.recentlyLikedAuthors.get(author);
    return lastLiked && (now - lastLiked) < 30 * 60 * 1000; // 30 minutes
  }

  markAuthorAsRecentlyLiked(author) {
    this.recentlyLikedAuthors.set(author, Date.now());
    
    // Cleanup old entries
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    for (const [key, timestamp] of this.recentlyLikedAuthors) {
      if (timestamp < thirtyMinutesAgo) {
        this.recentlyLikedAuthors.delete(key);
      }
    }
  }

  async humanLikeClick(element) {
    if (!this.isContextValid) return;

    try {
      // Scroll element into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(200); // Reduced from 500ms to 200ms

      // Simulate human click
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const mouseEvents = ['mousedown', 'mouseup', 'click'];
      
      for (const eventType of mouseEvents) {
        const event = new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          clientX: centerX + (Math.random() - 0.5) * 4,
          clientY: centerY + (Math.random() - 0.5) * 4,
          button: 0
        });
        
        element.dispatchEvent(event);
        await this.sleep(5 + Math.random() * 10); // Reduced timing
      }

      // Minimal additional delay
      await this.sleep(20 + Math.random() * 30); // Reduced from 50 + Math.random() * 50
    } catch (error) {
      console.error('Error simulating click:', error);
    }
  }

  // NEW METHOD: Fast random delay for main timing (3-8 seconds)
  getFasterRandomDelay() {
    // Random delay between 3000ms (3s) and 8000ms (8s)
    return Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
  }

  // NEW METHOD: Small human-like delay before clicking
  getHumanClickDelay() {
    // Very small delay (100-500ms) to simulate human processing time
    return Math.floor(Math.random() * (500 - 100 + 1)) + 100;
  }

  getRandomDelay(min, max) {
    if (min && max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Updated delays for faster operation
    const delays = {
      conservative: { min: 2000, max: 4000 }, // Reduced from 3000-6000
      normal: { min: 1000, max: 2000 },       // Reduced from 1500-3000
      active: { min: 300, max: 800 }          // Reduced from 500-1500
    };

    const setting = delays[this.settings.speedSetting] || delays.normal;
    return Math.floor(Math.random() * (setting.max - setting.min + 1)) + setting.min;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  handleExtensionError(error) {
    console.error('Extension error detected:', error);
    this.isContextValid = false;
    this.cleanup();
  }

  cleanup() {
    console.log('Cleaning up extension...');
    this.isProcessing = false;
    this.isEnabled = false;
    this.isContextValid = false;
    
    if (this.observer) {
      try {
        this.observer.disconnect();
      } catch (e) {
        console.log('Observer already disconnected');
      }
    }
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }
}

// Initialize with error handling
let smartLiker;

function init() {
  try {
    if (window.location.hostname.includes('linkedin.com')) {
      if (smartLiker) {
        smartLiker.cleanup();
      }
      smartLiker = new LinkedInSmartLiker();
    }
  } catch (error) {
    console.error('Error initializing Smart Liker:', error);
  }
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000); // Give page time to load
}

// Handle page navigation with error handling
let currentUrl = location.href;
const urlObserver = new MutationObserver(() => {
  try {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      setTimeout(init, 2000);
    }
  } catch (error) {
    console.error('Error handling navigation:', error);
  }
});

try {
  urlObserver.observe(document, { subtree: true, childList: true });
} catch (error) {
  console.error('Error setting up URL observer:', error);
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  try {
    if (smartLiker) smartLiker.cleanup();
    if (urlObserver) urlObserver.disconnect();
  } catch (error) {
    console.log('Error during cleanup:', error);
  }
});

// Periodic context check
setInterval(() => {
  if (smartLiker && !smartLiker.checkExtensionContext()) {
    console.log('Extension context lost, reinitializing...');
    setTimeout(init, 200);
  }
}, 3000); // Check every 3 seconds