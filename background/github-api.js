/**
 * RAG_LeetSync - GitHub REST API v3 Integration Client
 * Handles authentication verification, repository management, and commit publishing.
 */

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Safely encodes a UTF-8 string into standard Base64 for the GitHub Contents API
 */
export function utf8ToBase64(str) {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch (e) {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

/**
 * Safely decodes a Base64 string from GitHub Contents API into UTF-8
 */
export function base64ToUtf8(base64Str) {
  const cleanStr = base64Str.replace(/\s/g, '');
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(cleanStr), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/**
 * Standard fetch wrapper for GitHub API requests with authorization and error handling
 */
async function githubRequest(endpoint, token, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Authorization': `Bearer ${token.trim()}`,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const scopesHeader = response.headers.get('x-oauth-scopes') || '';
  const scopes = scopesHeader.split(',').map((s) => s.trim()).filter(Boolean);

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.message || response.statusText || `GitHub API error (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    error.scopes = scopes;
    throw error;
  }

  return {
    status: response.status,
    data,
    scopes,
    headers: response.headers
  };
}

/**
 * Validates a GitHub Personal Access Token (PAT) and retrieves user profile details
 */
export async function validateGitHubToken(token) {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      valid: false,
      error: 'Token cannot be empty.'
    };
  }

  try {
    const result = await githubRequest('/user', token);
    const user = result.data;
    const scopes = result.scopes;

    // Verify token has 'repo' or fine-grained repo scope
    const hasRepoScope = scopes.some((scope) => scope === 'repo' || scope === 'public_repo');
    
    // Note: Fine-grained tokens return empty x-oauth-scopes header, but are still valid
    const isFineGrained = scopes.length === 0;

    return {
      valid: true,
      user: {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
        htmlUrl: user.html_url,
        publicRepos: user.public_repos,
        totalPrivateRepos: user.total_private_repos || 0
      },
      scopes,
      hasRepoScope: hasRepoScope || isFineGrained,
      isFineGrained
    };
  } catch (error) {
    let friendlyMessage = error.message;
    if (error.status === 401) {
      friendlyMessage = 'Invalid token or credentials expired. Please check your Personal Access Token.';
    } else if (error.status === 403) {
      friendlyMessage = 'GitHub API rate limit exceeded or token lacks authorization.';
    }
    return {
      valid: false,
      error: friendlyMessage,
      status: error.status
    };
  }
}

/**
 * Fetches repositories accessible to the authenticated user
 */
export async function fetchUserRepositories(token) {
  try {
    const result = await githubRequest('/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator', token);
    const repos = result.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      defaultBranch: repo.default_branch || 'main',
      htmlUrl: repo.html_url,
      description: repo.description || '',
      canPush: repo.permissions ? repo.permissions.push : true
    }));

    return {
      success: true,
      repos
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      repos: []
    };
  }
}

/**
 * Checks if a specific repository exists and validates write access
 */
export async function verifyRepository(token, owner, repoName) {
  try {
    const result = await githubRequest(`/repos/${owner}/${repoName}`, token);
    const repo = result.data;
    const canPush = repo.permissions ? repo.permissions.push : true;

    return {
      exists: true,
      canPush,
      defaultBranch: repo.default_branch || 'main',
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      isPrivate: repo.private
    };
  } catch (error) {
    if (error.status === 404) {
      return {
        exists: false,
        canPush: false,
        error: `Repository '${owner}/${repoName}' was not found.`
      };
    }
    return {
      exists: false,
      canPush: false,
      error: error.message
    };
  }
}

/**
 * Creates a new GitHub repository for the user if it does not exist
 */
export async function createGitHubRepository(token, repoName, isPrivate = false, description = 'Synced LeetCode solutions via Code_Raginii') {
  try {
    const payload = {
      name: repoName || 'Code_Raginii_Extension',
      description,
      private: isPrivate,
      auto_init: true
    };

    const result = await githubRequest('/user/repos', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const repo = result.data;
    return {
      success: true,
      repo: {
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch || 'main',
        htmlUrl: repo.html_url,
        private: repo.private
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Retrieves existing file metadata and SHA (if present)
 */
export async function getFileMetadata(token, owner, repo, filePath, branch = 'main') {
  try {
    const cleanPath = filePath.replace(/^\/+/, '');
    const result = await githubRequest(`/repos/${owner}/${repo}/contents/${cleanPath}?ref=${branch}`, token);
    return {
      exists: true,
      sha: result.data.sha,
      size: result.data.size,
      downloadUrl: result.data.download_url
    };
  } catch (error) {
    if (error.status === 404) {
      return { exists: false, sha: null };
    }
    throw error;
  }
}

/**
 * Creates or updates a file in the user's GitHub repository via GitHub REST API
 */
export async function commitFileToGitHub(token, owner, repo, filePath, content, commitMessage, branch = 'main') {
  try {
    const cleanPath = filePath.replace(/^\/+/, '');
    
    // Check if the file already exists to supply sha for updates
    const existing = await getFileMetadata(token, owner, repo, cleanPath, branch);

    const payload = {
      message: commitMessage,
      content: utf8ToBase64(content),
      branch: branch
    };

    if (existing.exists && existing.sha) {
      payload.sha = existing.sha;
    }

    const result = await githubRequest(`/repos/${owner}/${repo}/contents/${cleanPath}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return {
      success: true,
      commitSha: result.data.commit.sha,
      commitUrl: result.data.commit.html_url,
      contentUrl: result.data.content.html_url,
      updated: existing.exists
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Performs a verified test commit to validate write permissions
 */
export async function runTestCommit(token, owner, repo, branch = 'main') {
  const testPath = 'CODE_RAGINII_TEST.md';
  const timestamp = new Date().toISOString();
  const testContent = `# 🚀 Code_Raginii Integration Verification

> Verified on **${timestamp}**

This file confirms that **Code_Raginii** has verified write and commit access to this repository.

### Synchronizer Status
- **Repository**: \`${owner}/${repo}\`
- **Target Branch**: \`${branch}\`
- **Status**: Ready to sync accepted LeetCode submissions

---
*Generated automatically by Code_Raginii.*
`;

  const commitMsg = `chore: verify Code_Raginii repository access [${new Date().toLocaleDateString()}]`;
  return await commitFileToGitHub(token, owner, repo, testPath, testContent, commitMsg, branch);
}

/**
 * Commits multiple files atomically to a GitHub repository using the Git Data API,
 * with automatic fallback to Contents API if branch reference is not yet initialized.
 * 
 * @param {string} token - GitHub PAT
 * @param {string} owner - Repository owner/organization
 * @param {string} repo - Repository name
 * @param {Array<{path: string, content: string}>} files - Array of files to commit
 * @param {string} commitMessage - Commit message
 * @param {string} branch - Target branch (default: 'main')
 */
export async function commitMultipleFilesToGitHub(token, owner, repo, files, commitMessage, branch = 'main') {
  if (!files || files.length === 0) {
    return { success: false, error: 'No files provided for commit.' };
  }

  // Attempt atomic commit via Git Database API
  try {
    // 1. Get current branch reference
    const refRes = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
    const latestCommitSha = refRes.data.object.sha;

    // 2. Get commit to retrieve base tree SHA
    const commitRes = await githubRequest(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, token);
    const baseTreeSha = commitRes.data.tree.sha;

    // 3. Post tree items
    const treeItems = files.map((file) => ({
      path: file.path.replace(/^\/+/, ''),
      mode: '100644', // standard file
      type: 'blob',
      content: file.content
    }));

    const treeRes = await githubRequest(`/repos/${owner}/${repo}/git/trees`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });
    const newTreeSha = treeRes.data.sha;

    // 4. Create new commit pointing to parent commit
    const newCommitRes = await githubRequest(`/repos/${owner}/${repo}/git/commits`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeSha,
        parents: [latestCommitSha]
      })
    });
    const newCommitSha = newCommitRes.data.sha;

    // 5. Update branch reference
    await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    });

    return {
      success: true,
      commitSha: newCommitSha,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`,
      filesCount: files.length,
      mode: 'atomic'
    };
  } catch (error) {
    console.warn('[RAG_LeetSync] Atomic Git tree commit failed or empty repo, falling back to sequential Contents API:', error.message);

    // Fallback: Sequential commits via Contents API
    try {
      const results = [];
      for (const file of files) {
        const fileRes = await commitFileToGitHub(
          token,
          owner,
          repo,
          file.path,
          file.content,
          commitMessage,
          branch
        );
        if (!fileRes.success) {
          throw new Error(`Failed to commit file ${file.path}: ${fileRes.error}`);
        }
        results.push(fileRes);
      }

      const lastResult = results[results.length - 1];
      return {
        success: true,
        commitSha: lastResult.commitSha,
        commitUrl: lastResult.commitUrl,
        filesCount: files.length,
        mode: 'sequential'
      };
    } catch (fallbackError) {
      return {
        success: false,
        error: fallbackError.message
      };
    }
  }
}
