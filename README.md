# RAG_LeetSync 🚀

> **Sync your LeetCode problem solutions directly to GitHub with structured metadata, problem tags, and rich documentation optimized for Retrieval-Augmented Generation (RAG) and technical interview review.**

---

## 📖 Overview

**RAG_LeetSync** is a Google Chrome Extension built on **Chrome Extension Manifest V3**. It bridges your LeetCode problem-solving practice with version control in your GitHub repository (`rag_leetsync`), automatically organizing code, problem prompts, complexity metrics, and tags.

### 6-Phase Development Roadmap

- [x] **Phase 1: Project Scaffolding & Manifest V3 Foundation**
  - Manifest V3 architecture with background service worker
  - High-aesthetic popup dashboard and diagnostic utilities
  - Local storage initialization and clean modular file layout
- [x] **Phase 2: Secure GitHub Authentication & Repository Selection**
  - Personal Access Token (PAT) with direct one-click GitHub generator
  - Dynamic user repository fetch, picker, and one-click remote repo creation
  - End-to-end integration test commit verification via GitHub Contents REST API
  - Secure credential isolation in `chrome.storage.local` with masked display
- [x] **Phase 3: Manual Solution Upload & File Templating** *(Completed)*
  - Multi-file atomic GitHub commit engine via Git Data API (trees & commits) with sequential fallback
  - RAG metadata schema generator: formatted `solution.<ext>`, rich `README.md` with badges & intuition, and machine-readable `metadata.json`
  - In-popup manual ingestion form with active tab auto-detection & sample solution loader
  - Live RAG bundle preview drawer & recent ingestions dashboard tracker
- [x] **Phase 4: Automated LeetCode Submission Ingestion** *(Completed)*
  - Main-world network interceptor (`content/main-world.js`) hooking into fetch/XHR submission checks
  - Direct Monaco editor model extraction (`window.monaco.editor.getModels()`) with DOM line scraping fallback
  - Automatic detection of "Accepted" state, runtime percentiles, and memory percentiles
  - Floating in-page sync notification widget (`content/content.css`) on `leetcode.com` with direct commit links
  - Native Chrome desktop notification integration upon successful push
- [ ] **Phase 5: Sync History, Duplicate Prevention & Resilience** *(Next)*
  - Upload history dashboard, retry queues, and notification toasts
- [ ] **Phase 6: Release Packaging & Web Store Preparation**
  - Automated linting, test verification, and packaged ZIP bundle

---

## 🛠️ Technology Stack

- **Core**: Vanilla HTML5, CSS3, JavaScript (ES6+ Modules)
- **Extension Spec**: Chrome Extension Manifest V3
- **Storage**: Chrome Storage API (`chrome.storage.local`)
- **APIs**: GitHub REST API v3, LeetCode DOM / Network observation

---

## 📁 Project Structure

```text
rag_leetsync/
├── manifest.json              # Chrome Manifest V3 configuration (v1.3)
├── background/
│   ├── background.js          # Service worker handling lifecycle & messages
│   ├── github-api.js          # Modular GitHub REST API client (Auth, Repos, Commits)
│   └── rag-templates.js       # RAG metadata, schema generator & code formatting
├── content/
│   ├── main-world.js          # In-page Monaco & network submission interceptor
│   ├── leetcode.js            # Content script observer & sync coordinator
│   └── content.css            # Floating in-page sync toast styling
├── popup/
│   ├── popup.html             # Multi-tab dashboard, sync form, auth & settings UI
│   ├── popup.css              # Obsidian & Cyber Teal theme with animations
│   └── popup.js               # Reactive popup controller & sync manager
├── icons/                     # Extension icons (16px, 32px, 48px, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── .gitignore                 # Security ignore rules (protects tokens & env)
└── README.md                  # Project documentation & roadmap
```

---

## 🚀 How to Load and Test the Extension in Chrome

Follow these steps to load `RAG_LeetSync` locally in Google Chrome:

1. **Open Chrome Extensions Manager**:
   - In Google Chrome, navigate to `chrome://extensions/`
   - Alternatively, open the **three-dots menu** $\rightarrow$ **Extensions** $\rightarrow$ **Manage Extensions**.

2. **Enable Developer Mode**:
   - In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

3. **Load Unpacked Extension**:
   - Click the **Load unpacked** button in the top-left toolbar.
   - Select the project folder:
     ```text
     c:\Users\Ragini Telange\Downloads\rag_leetsync
     ```

4. **Verify Extension Loading**:
   - The card **RAG_LeetSync** with version `1.1.0` will appear.
   - Confirm that there are **no errors** or red warning banners on the card.
   - Ensure the service worker status indicates `Service worker (Active)`.

5. **Test Phase 2 GitHub Authentication & Sync**:
   - Click the extension icon to open the popup.
   - Switch to the **GitHub Auth** tab:
     - Click **Create Token** to open GitHub's token generator (pre-configured with `repo` scope).
     - Paste your Personal Access Token (PAT) and click **Verify & Connect GitHub**.
     - Once connected, your avatar, username, and repository list will populate automatically.
     - Choose an existing repository or click **Create New Repo** to initialize `rag_leetsync` on GitHub.
   - Return to the **Dashboard** tab:
     - Click **Test GitHub Commit** to run a live end-to-end commit test (`RAG_SYNC_TEST.md`) verified via the GitHub API.

6. **Test Phase 3 Solution Ingestion & RAG Generation**:
   - Switch to the **Sync Solution** tab:
     - Click **Load Sample Code** to pre-fill the form with a complete Two Sum solution, or click **Detect from Tab** while on a LeetCode problem page.
     - Click **Preview RAG** to inspect the live generated directory path (`problems/easy/two-sum/`), `README.md` documentation, and `metadata.json` schema.
     - Click **Sync to GitHub** to trigger an atomic multi-file commit via the GitHub Git Data API.
     - Switch back to the **Dashboard** to see your problem logged in the **Recent Ingestions** list with a direct clickable link to the GitHub commit!
   - Switch to **Settings** to customize problem directory patterns and commit message templates.

7. **Test Phase 4 Automated LeetCode Submission Ingestion**:
   - Open any problem on [LeetCode](https://leetcode.com/problems/two-sum/) in Google Chrome.
   - Click **Submit** on an accepted solution.
   - The in-page **RAG_LeetSync Notification Toast** will pop up in the lower-right corner:
     - Real-time status: *"Accepted! Syncing to GitHub..."*
     - Automatic extraction of Monaco editor code, execution runtime, memory percentiles, and problem tags.
     - Confirmation with direct commit link: *"Synced [title] (commit SHA)!"*
   - A native desktop notification will also confirm the push.

---

## 🔒 Security & Best Practices

- **Zero Secret Commits**: Authentication credentials or tokens are never committed to Git.
- **Chrome Storage API**: Tokens are stored strictly within the user's isolated local Chrome extension storage (`chrome.storage.local`).
- **Least-Privilege Scopes**: Permissions are restricted strictly to `storage`, `notifications`, `activeTab`, `tabs`, and required domain hosts (`api.github.com`, `leetcode.com`).

---

## 📝 Git Initialization & First Commit

To initialize Git in this directory and push Phase 1 to your remote repository, run:

```bash
git init
git add .
git commit -m "feat(phase-1): initialize RAG_LeetSync Chrome extension foundation"
git branch -M main
git remote add origin https://github.com/USERNAME/rag_leetsync.git
git push -u origin main
```
*(Replace `USERNAME` with your actual GitHub username).*
