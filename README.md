# Code_Raginii 🚀

> **Automatically sync your accepted LeetCode solutions directly to your GitHub repository.**
> **LeetCode &rarr; GitHub**

---

## 📖 Overview

**Code_Raginii** is a lightweight, reliable Google Chrome extension built on **Chrome Extension Manifest V3**. It detects when you successfully solve and submit a problem on LeetCode with an **Accepted** verdict, and automatically commits your source code and documentation to your selected GitHub repository (**`Code_Raginii_Extension`**).

### Key Features

- **⚡ Automatic Detection**: Detects accepted submissions on LeetCode in real-time.
- **🔒 Duplicate Prevention**: Employs deterministic submission ID and code hashing so reopening or refreshing problems never creates duplicate commits.
- **📁 Organized Hierarchy**:
  ```text
  Code_Raginii_Extension/
  ├── README.md                          # Auto-maintained table of all unique solved problems
  └── leetcode-solutions/
      ├── Easy/
      │   └── 0001-two-sum/
      │       ├── solution.py
      │       └── README.md
      ├── Medium/
      └── Hard/
  ```
- **📊 Maintained Progress Table**: Automatically updates the repository's root `README.md` with total unique problem counts and direct links to each solution file.
- **🛡️ Secure Token Isolation**: GitHub Personal Access Tokens (PAT) remain strictly local inside `chrome.storage.local` and are never committed or leaked.

---

## 🛠️ Technology Stack

- **Extension Framework**: Chrome Extension Manifest V3
- **Languages**: HTML5, CSS3, JavaScript (ES6 Modules)
- **Storage**: Chrome Storage API (`chrome.storage.local`)
- **APIs**: GitHub REST API v3
- **Platforms**: LeetCode (`https://leetcode.com/problems/*`)

---

## 🚀 How to Load and Test Locally in Google Chrome

1. **Open Chrome Extensions**:
   - In Google Chrome, go to `chrome://extensions/`
   - Turn ON **Developer mode** using the toggle switch in the top-right corner.
2. **Load the Extension**:
   - Click **Load unpacked** in the top-left corner.
   - Select the project folder: `c:\Users\Ragini Telange\Downloads\rag_leetsync`
3. **Verify the Extension**:
   - Confirm **Code_Raginii** appears with version `1.0.0` and the custom icon.
   - Click the extension icon in the Chrome toolbar to open the popup.

---

## 🔑 GitHub Setup & Connection

1. Click **Connect GitHub** in the extension popup.
2. Generate a Personal Access Token on GitHub:
   - Go to [GitHub Token Settings](https://github.com/settings/tokens/new?scopes=repo&description=Code_Raginii_Extension).
   - Select the `repo` scope (full control of private repositories).
   - Generate and copy your token (`ghp_...`).
3. Paste the token into the popup and click **Connect GitHub**.
4. Set the target repository to **`Code_Raginii_Extension`** (you can click **Create on GitHub** if the repository does not exist yet).

---

## 🔗 Connecting to your new GitHub Repository: `Code_Raginii_Extension`

To update your local Git remote to your new GitHub repository:

```bash
# 1. Check current remotes
git remote -v

# 2. Update origin remote to your new repository URL:
git remote set-url origin https://github.com/Ragini-telange/Code_Raginii_Extension.git

# 3. Verify the new remote URL:
git remote -v

# 4. Stage and commit all refactored files:
git add .
git commit -m "refactor: transform into Code_Raginii Chrome extension"

# 5. Push to your new repository:
git push -u origin main
```

---

## 🧪 Testing Checklist

- [x] Extension loads cleanly in `chrome://extensions` with custom icon and Manifest V3.
- [x] All JavaScript files pass syntax checks (`node -c`).
- [x] Popup displays GitHub connection status, auto-sync toggle, latest result, and settings.
- [x] Duplicate prevention logic prevents repeated commits for identical submissions.
- [x] Multi-file atomic commits update both the solution file and root repository `README.md`.
