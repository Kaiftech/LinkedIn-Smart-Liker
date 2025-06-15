# LinkedIn Smart Liker

**LinkedIn Smart Liker** is a Chrome Extension that intelligently and automatically likes posts on LinkedIn based on configurable behavior such as speed, randomness, smart author filtering, and session-based statistics.


## 🚀 Features

* ✅ **Auto-like LinkedIn posts** with configurable intervals and probabilities.
* 🧠 **Smart filtering** to avoid liking the same author's posts repeatedly.
* 🔄 **Real-time statistics**: Tracks daily likes, posts viewed, and session time.
* ⚙️ **Customizable speed & probability** for engagement.
* 🛠️ Automatically resets stats daily.
* 🔌 Lightweight and non-intrusive—built with performance and reliability in mind.

---

## 🧩 Extension Overview

| File            | Purpose                                                  |
| --------------- | -------------------------------------------------------- |
| `manifest.json` | Declares extension metadata and permissions              |
| `background.js` | Manages startup, messaging, and content script injection |
| `content.js`    | Core logic for scanning and liking posts on LinkedIn     |
| `popup.html`    | UI for extension control panel                           |
| `popup.js`      | Handles UI logic, syncs with storage, and updates stats  |
| `icons/`        | Extension icons for browser toolbar and store listing    |

---

## ⚙️ How It Works

### 🛠 Initialization

* When installed, `background.js` sets default settings.
* On visiting LinkedIn, `content.js` is injected automatically.
* The content script observes the page for visible posts.

### ❤️ Liking Mechanism

* Posts are identified using DOM selectors.
* Each visible post is evaluated based on:

  * **Random chance** (probability slider)
  * **Smart filtering** (recently liked authors are skipped)
* The post is then clicked with a human-like delay and mouse event simulation.

### 📊 Statistics

* Daily likes and posts viewed are tracked and reset at midnight.
* A session timer displays how long the extension has been running.

---

## 🖥 UI (Popup)

The popup UI (`popup.html`) allows users to:

* Toggle the auto-liker on/off
* Set engagement speed (Conservative, Normal, Active)
* Adjust like probability (10% to 99%)
* Enable/disable smart filtering
* View real-time stats: likes given, posts viewed, and session time
* Reset stats manually

---

## 📦 Installation (Development Mode)

1. Clone or download this repo.
2. Open **Chrome** and go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the root folder containing this project

---

## 🔐 Permissions

| Permission             | Reason                                |
| ---------------------- | ------------------------------------- |
| `storage`              | To save settings and daily stats      |
| `scripting`            | To inject content scripts dynamically |
| `activeTab`            | To communicate with LinkedIn tabs     |
| `*://*.linkedin.com/*` | To operate only on LinkedIn content   |

---

## 🔄 Extension Lifecycle

* Auto injects `content.js` only on valid LinkedIn pages.
* Cleans up and reinitializes when navigating between pages.
* Monitors health and re-injects if needed (via background polling).
* Stats are reset daily and synced via `chrome.storage.sync`.

---

## 🧠 Smart Filtering Explained

* Keeps track of authors liked in the last 30 minutes.
* Skips posts from recently liked authors to avoid spammy behavior.
* Ensures a diverse, human-like liking pattern.

---

## 📅 Reset Behavior

* Stats reset every 24 hours using date comparison (`lastResetDate`).
* Reset button also available in popup to manually clear stats.

---

## 💡 Ideas for Future Enhancements

* Add keyword/topic filters for post content
* Option to skip sponsored posts
* Export daily engagement logs
* Notifications or toast popups for actions taken
* Dark mode for popup UI

---

## 🧪 Developer Notes

* Fully CSP-compliant: all JS is contained in external scripts.
* Popup UI uses **Tailwind CSS** via CDN.
* Chrome Manifest V3 compatible.

---

## 🧾 License

This project is released under the [MIT License](LICENSE).

---

## 📬 Author

**Kaif Munshi**
🔗 [LinkedIn](https://www.linkedin.com/in/kaif-munshi)
💻 [GitHub](https://github.com/Kaiftech)


