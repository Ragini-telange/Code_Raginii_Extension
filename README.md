# RAG_LeetSync 🚀

> **Sync your LeetCode problem solutions directly to GitHub with structured metadata, problem tags, and rich documentation optimized for Retrieval-Augmented Generation (RAG) and technical interview review.**

---

## 📖 Overview

**RAG_LeetSync** is a Google Chrome Extension built on **Chrome Extension Manifest V3**. It bridges your LeetCode problem-solving practice with version control in your GitHub repository (`rag_leetsync`), automatically organizing code, problem prompts, complexity metrics, and tags.

### 6-Phase Development Roadmap

- [x] **Phase 1: Project Scaffolding & Manifest V3 Foundation** *(Current)*
  - Manifest V3 architecture with background service worker
  - High-aesthetic popup dashboard and diagnostic utilities
  - Local storage initialization and clean modular file layout
- [ ] **Phase 2: Secure GitHub Authentication & Repository Selection**
  - Personal Access Token (PAT) / Device Flow via Chrome Storage API
  - Repository picker and validation
- [ ] **Phase 3: Manual Solution Upload & File Templating**
  - Commit creation/update via GitHub REST API
  - RAG metadata schema (difficulty, tags, runtime, memory, prompt)
- [ ] **Phase 4: Automated LeetCode Submission Ingestion**
  - Detection of "Accepted" submissions
  - User source code extraction with manual fallback
- [ ] **Phase 5: Sync History, Duplicate Prevention & Resilience**
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
├── manifest.json              # Chrome Manifest V3 configuration
├── background/
│   └── background.js          # Service worker handling lifecycle & messages
├── popup/
│   ├── popup.html             # Extension popup interface
│   ├── popup.css              # Dark theme styling & responsive layout
│   └── popup.js               # Popup logic & diagnostics
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
   - The card **RAG_LeetSync** with version `1.0.0` will appear.
   - Confirm that there are **no errors** or red warning banners on the card.
   - Ensure the service worker status indicates `Service worker (Active)`.

5. **Test the Popup**:
   - Click the puzzle icon (Extensions) in your Chrome toolbar and pin **RAG_LeetSync**.
   - Click the extension icon to open the popup.
   - Click **Ping Background Worker** to test runtime messaging. You should receive a confirmation with the version and timestamp.
   - Click **Check LeetCode Tab** while browsing LeetCode to verify tab detection.

---

## 🔒 Security & Best Practices

- **Zero Secret Commits**: Authentication credentials or tokens are never committed to Git.
- **Chrome Storage API**: Tokens are stored strictly within the user's isolated local Chrome extension storage.
- **Least-Privilege Scopes**: Permissions are restricted strictly to `storage`, `notifications`, `activeTab`, and required domain hosts.

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
