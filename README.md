# Code_Raginii 🚀

> **Automatically sync accepted LeetCode solutions to GitHub.**  
> **LeetCode &rarr; GitHub**

---

## 📖 Overview

**Code_Raginii** is a lightweight, reliable Google Chrome extension built on **Chrome Extension Manifest V3**. Every time you submit an **Accepted** solution on LeetCode, Code_Raginii automatically commits your solution code and documentation directly to your selected GitHub repository and maintains a sorted table of all unique solved problems in your repository's root `README.md`.

---

## 👥 How Anyone Can Clone and Use This Extension

Follow these simple steps to set up and use **Code_Raginii** on your own computer:

### Step 1: Clone the Repository

Clone this repository to your computer using Git:

```bash
git clone https://github.com/Ragini-telange/Code_Raginii_Extension.git
```

*(Alternatively, click the green **Code** button on GitHub and choose **Download ZIP**, then extract it to a folder).*

---

### Step 2: Load the Extension into Google Chrome

1. Open **Google Chrome**.
2. Navigate to the Extensions management page:
   - Type `chrome://extensions/` into the URL bar and press **Enter**.
   - Or click the **three dots menu (⋮)** in the top right &rarr; **Extensions** &rarr; **Manage Extensions**.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left toolbar, click **Load unpacked**.
5. Select the folder you just cloned:
   ```text
   Code_Raginii_Extension
   ```
6. The **Code_Raginii** extension card will appear with version `1.0.0` and its custom icon.

---

### Step 3: Connect Your GitHub Account

1. Click the **Extensions puzzle icon (🧩)** in Chrome's toolbar and pin **Code_Raginii**.
2. Click the **Code_Raginii** icon to open the popup interface.
3. Generate a GitHub Personal Access Token:
   - Go to [GitHub Token Settings (classic)](https://github.com/settings/tokens/new?scopes=repo&description=Code_Raginii_Extension).
   - Check the **`repo`** permission scope (full control of private repositories).
   - Click **Generate token** at the bottom and copy your new token (`ghp_...`).
   *(Fine-grained personal access tokens with Repository Contents Read & Write permission are also supported).*
4. Paste your token into the popup and click **Connect GitHub**.
5. Select your target repository:
   - The default target repository name is **`Code_Raginii_Extension`**.
   - If the repository does not exist on your account, click **Create on GitHub** in the popup to initialize it automatically.
   - Or click **Change Repository** to select any existing repository where you have write access.

---

### Step 4: Solve & Auto-Sync on LeetCode

1. Open any problem on [LeetCode](https://leetcode.com/problems/).
2. Solve the problem in any supported language:
   - **Python / Python3** (`.py`)
   - **C++** (`.cpp`)
   - **Java** (`.java`)
   - **JavaScript** (`.js`)
   - **TypeScript** (`.ts`)
   - **C** (`.c`)
   - **SQL** (`.sql`)
3. Click **Submit**.
4. When LeetCode returns **Accepted**:
   - Code_Raginii instantly detects the acceptance.
   - An in-page notification appears confirming: *"Accepted! Syncing to GitHub..."*
   - Code_Raginii commits your formatted solution file, problem markdown, and updates the repository's root summary table.
   - The notification updates with a direct clickable link to your new GitHub commit!

---

## 📁 Repository Structure

When solutions are synced, they are organized in your GitHub repository like this:

```text
Code_Raginii_Extension/
├── README.md                          # Auto-maintained table of all unique solved problems
└── leetcode-solutions/
    ├── Easy/
    │   └── 0001-two-sum/
    │       ├── solution.py            # Formatted source code with problem header
    │       └── README.md              # Problem statement, complexity & LeetCode link
    ├── Medium/
    │   └── 0015-3sum/
    │       ├── solution.cpp
    │       └── README.md
    └── Hard/
```

### Auto-Maintained Root `README.md` Preview

Every accepted submission automatically updates your repository's root table:

| # | Problem Name | Difficulty | Language | Solution |
|:---|:---|:---:|:---:|:---:|
| 1 | [Two Sum](https://leetcode.com/problems/two-sum/) | `Easy` | `Python3` | [Solution](./leetcode-solutions/Easy/0001-two-sum/solution.py) |
| 15 | [3Sum](https://leetcode.com/problems/3sum/) | `Medium` | `C++` | [Solution](./leetcode-solutions/Medium/0015-3sum/solution.cpp) |

- **Unique Counting**: Problem count is based on unique problems solved, not number of submissions.
- **In-Place Updates**: If you re-solve an existing problem with an improved solution or in another language, the existing row is updated without creating duplicate entries.

---

## 🔒 Duplicate Prevention & Reliability

- **No Repeated Commits**: Refreshing the page, reopening a problem, or multiple network events will **never** create duplicate commits.
- **Only Accepted Solutions**: Unsuccessful submissions (`Wrong Answer`, `Runtime Error`, `Time Limit Exceeded`, etc.) are strictly ignored.
- **Atomic Commits**: Solution code, problem documentation, and root table updates are committed together in a single atomic Git tree operation.
- **Privacy & Security**: Tokens are stored strictly in your browser's sandboxed `chrome.storage.local`. They are never sent to external servers or exposed to websites.

---

## 🛠️ Settings & Controls

Inside the extension popup:
- **Auto-Sync Toggle**: Turn automatic syncing ON or OFF with one click.
- **Target Branch**: Default is `main` (can be changed in Settings).
- **Prevent Duplicates**: Enabled by default to ensure clean Git commit logs.
- **Test Write Permission**: One-click test commit (`CODE_RAGINII_TEST.md`) to verify GitHub push permissions.
- **Change Repository / Disconnect**: Switch destination repositories or disconnect your account at any time.

---

## 📄 License

MIT License. Open source and free to use for personal LeetCode tracking.
