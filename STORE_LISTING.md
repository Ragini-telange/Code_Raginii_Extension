# Chrome Web Store Listing & Store Compliance Documentation 🚀

This document provides all verified copy, single-purpose justifications, permission disclosures, and privacy policies required to publish **RAG_LeetSync** to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## 1. Store Metadata & Summary

| Field | Value | Constraints |
| :--- | :--- | :--- |
| **Extension Name** | `RAG_LeetSync` | Max 45 characters (used: 12) |
| **Version** | `1.5.0` | SemVer format |
| **Summary / Short Description** | `Automatically sync your accepted LeetCode solutions to GitHub with RAG-ready markdown and machine-readable metadata.` | Max 132 characters (used: 127) |
| **Category** | `Developer Tools` (Secondary: `Productivity`) | Web Store Taxonomy |
| **Language** | `English (United States)` | Default |

---

## 2. Detailed Store Description (Long Description)

```markdown
🚀 Supercharge your technical interview preparation with RAG_LeetSync!

RAG_LeetSync seamlessly connects your LeetCode problem-solving workflow directly to your personal GitHub repository, structuring every accepted solution into clean code, rich markdown documentation, and machine-readable metadata ready for Retrieval-Augmented Generation (RAG) and LLM-assisted study.

⚡ Key Features:

1. Zero-Friction Automatic Ingestion:
   - Solve problems naturally on LeetCode.com.
   - Upon clicking "Submit", RAG_LeetSync captures the "Accepted" verdict, execution runtime, memory percentiles, and problem tags.
   - Extracts your clean solution directly from the Monaco editor without brittle DOM line scraping.

2. RAG & LLM Optimized Repository Architecture:
   Each accepted solution commits a structured 3-part bundle:
   - `solution.<ext>`: Syntax-clean source code in Python, C++, Java, TypeScript, Go, Rust, and 10+ languages.
   - `README.md`: Problem overview, difficulty badge, approach intuition, and formal Big-O Time & Space complexity analysis.
   - `metadata.json`: Machine-readable metadata schema with difficulty, topics, runtime, memory, and semantic chunking tags designed specifically for ingestion into vector databases (Pinecone, ChromaDB, Qdrant, LangChain).

3. Cryptographic Duplicate Prevention:
   - Submitting the same accepted code multiple times? RAG_LeetSync computes a deterministic code hash to prevent duplicate commits, keeping your Git history pristine and saving GitHub API quota.

4. Offline Resilience & Queueing:
   - Never lose a submission due to intermittent network drops or API rate-limits. Failed requests are safely enqueued in an offline retry queue with one-click re-syncing.

5. In-Page Feedback Toast:
   - Sleek, unobtrusive floating status toast on LeetCode with instant commit links.

6. Interactive Dashboard & History Explorer:
   - Filter your solved problems instantly by keyword, slug, or difficulty (Easy, Medium, Hard).
   - Export your entire problem history to JSON with a single click.

🔒 Privacy & Security First:
- Zero tracking or telemetry.
- Your GitHub Personal Access Token (PAT) is stored strictly in your browser's local extension storage (`chrome.storage.local`). It is NEVER transmitted to external third-party servers.
- Open Source and completely transparent.
```

---

## 3. Chrome Web Store Permission Justifications (Review Compliance)

Google requires clear justifications for every permission declared in `manifest.json`:

| Permission | Justification for Review Team |
| :--- | :--- |
| `storage` | Required to securely persist user configuration (target GitHub repository, branch name, auto-sync toggle, directory patterns) and local sync history registry (`chrome.storage.local`). Credentials never leave the local client. |
| `notifications` | Required to provide desktop notifications to the developer when a LeetCode submission has been pushed to GitHub or if an offline retry has succeeded. |
| `activeTab` | Required when the user clicks "Detect from Tab" in the extension popup to read the current problem title, slug, and difficulty from the active LeetCode tab. |
| `tabs` | Required to query and identify if an open browser tab is currently on a LeetCode problem page (`leetcode.com/problems/*`) to enable seamless solution synchronization. |
| `host_permissions` (`https://leetcode.com/*`) | Required for content scripts (`content/leetcode.js` & `content/main-world.js`) to detect submission check responses and extract user code from the in-browser Monaco editor. |
| `host_permissions` (`https://api.github.com/*`) | Required for the background service worker to authenticate user tokens, list repositories, and push commits to the user's chosen GitHub repository. |

---

## 4. Single-Purpose Policy Statement

> *"The single purpose of RAG_LeetSync is to synchronize accepted LeetCode programming problem solutions, metadata, and markdown documentation directly into a user-specified GitHub repository for version control and AI-assisted interview study."*

---

## 5. Privacy Policy & Data Handling Declaration

- **Data Collection**: RAG_LeetSync collects **zero** personal data, analytics, or behavioral telemetry.
- **Third-Party Transmission**: The extension communicates exclusively with `api.github.com` (to push commits using the user's explicit token) and `leetcode.com` (to detect the user's own submissions). No intermediary proxy or tracking server is used.
- **Credential Storage**: Personal Access Tokens (PAT) and configuration are stored exclusively within Chrome's sandboxed `chrome.storage.local` environment.
- **Open Source**: Full source code is open and verifiable by any developer.

---

## 6. Web Store Promotional Assets Checklist

When publishing on the Chrome Web Store Developer Console, prepare the following graphic assets:

- [x] **Extension Icon (128x128 PNG)**: Located at `icons/icon128.png`.
- [ ] **Small Promo Tile (440x280 PNG/JPEG)**: Obsidian background with cyber teal glowing logo and subtitle *"LeetCode to GitHub RAG Sync"*.
- [ ] **Large Promo Tile (920x680 PNG/JPEG)**: Optional, for featured placement on the Chrome Web Store.
- [ ] **Screenshots (1280x800 or 640x400 PNG/JPEG)**:
  1. *Screenshot 1*: In-page LeetCode experience showing accepted submission and floating toast notification with GitHub commit link.
  2. *Screenshot 2*: Popup Dashboard displaying synced problems, stats, difficulty pills, and search filtering.
  3. *Screenshot 3*: GitHub Authentication tab with token verification and repository selector.
  4. *Screenshot 4*: Target GitHub repository showcasing the structured `README.md`, `solution.<ext>`, and `metadata.json`.
