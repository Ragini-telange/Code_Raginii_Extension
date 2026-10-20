/**
 * Code_Raginii - Solution Formatting & Templating Engine
 * Formats LeetCode solutions, problem documentation, and root README for GitHub repository storage.
 */

export const LANGUAGE_CONFIGS = {
  python: { ext: 'py', name: 'Python', commentPrefix: '# ' },
  python3: { ext: 'py', name: 'Python3', commentPrefix: '# ' },
  cpp: { ext: 'cpp', name: 'C++', commentPrefix: '// ' },
  'c++': { ext: 'cpp', name: 'C++', commentPrefix: '// ' },
  java: { ext: 'java', name: 'Java', commentPrefix: '// ' },
  javascript: { ext: 'js', name: 'JavaScript', commentPrefix: '// ' },
  typescript: { ext: 'ts', name: 'TypeScript', commentPrefix: '// ' },
  golang: { ext: 'go', name: 'Go', commentPrefix: '// ' },
  go: { ext: 'go', name: 'Go', commentPrefix: '// ' },
  rust: { ext: 'rs', name: 'Rust', commentPrefix: '// ' },
  c: { ext: 'c', name: 'C', commentPrefix: '// ' },
  csharp: { ext: 'cs', name: 'C#', commentPrefix: '// ' },
  'c#': { ext: 'cs', name: 'C#', commentPrefix: '// ' },
  kotlin: { ext: 'kt', name: 'Kotlin', commentPrefix: '// ' },
  swift: { ext: 'swift', name: 'Swift', commentPrefix: '// ' },
  ruby: { ext: 'rb', name: 'Ruby', commentPrefix: '# ' },
  sql: { ext: 'sql', name: 'SQL', commentPrefix: '-- ' },
  bash: { ext: 'sh', name: 'Bash', commentPrefix: '# ' }
};

/**
 * Gets language metadata with safe fallback
 */
export function getLanguageConfig(langKey = 'python3') {
  const normalized = (langKey || 'python3').toLowerCase().trim();
  return LANGUAGE_CONFIGS[normalized] || { ext: 'txt', name: langKey, commentPrefix: '// ' };
}

/**
 * Normalizes title into standard URL slug
 */
export function slugify(text = '') {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Computes deterministic hash of solution code for duplicate prevention
 */
export function computeCodeHash(code = '') {
  const normalized = (code || '').trim().replace(/\r\n/g, '\n');
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return (hash >>> 0).toString(16);
}

/**
 * Resolves directory path for a problem based on repository standards:
 * leetcode-solutions/{Difficulty}/{id4}{titleSlug}
 */
export function resolveProblemDirectory(pattern, problem) {
  const rawDiff = (problem.difficulty || 'Easy').toLowerCase();
  const difficulty = rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1);
  const id = problem.id || problem.questionId || '';
  const idFormatted = id ? String(id).padStart(4, '0') + '-' : '';
  const titleSlug = problem.titleSlug || slugify(problem.title || 'untitled');

  if (pattern && pattern.trim()) {
    let dir = pattern.trim()
      .replace(/\{difficulty\}/g, rawDiff)
      .replace(/\{Difficulty\}/g, difficulty)
      .replace(/\{titleSlug\}/g, titleSlug)
      .replace(/\{id\}/g, id || '0')
      .replace(/\{id4\}/g, id ? String(id).padStart(4, '0') : '0000');
    return dir.replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  return `leetcode-solutions/${difficulty}/${idFormatted}${titleSlug}`;
}

/**
 * Resolves commit message based on template pattern
 */
export function resolveCommitMessage(pattern, problem) {
  const defaultPattern = 'Solved {title} [{difficulty}] - Code_Raginii';
  const difficulty = (problem.difficulty || 'Easy').charAt(0).toUpperCase() + (problem.difficulty || 'Easy').slice(1).toLowerCase();
  const title = problem.title || 'Problem';
  const id = problem.id || problem.questionId || '';

  let message = (pattern || defaultPattern).trim();
  message = message
    .replace(/\{title\}/g, id ? `${id}. ${title}` : title)
    .replace(/\{difficulty\}/g, difficulty)
    .replace(/\{id\}/g, id);

  return message;
}

/**
 * Formats the source code with clean header comments
 */
export function formatSolutionCode(code, problem) {
  const langConfig = getLanguageConfig(problem.language);
  const prefix = langConfig.commentPrefix;
  const title = problem.title || 'Solution';
  const id = problem.id || problem.questionId || '';
  const difficulty = problem.difficulty || 'Easy';
  const titleSlug = problem.titleSlug || slugify(title);
  const url = problem.url || `https://leetcode.com/problems/${titleSlug}/`;

  const header = [
    `${prefix}==========================================================================`,
    `${prefix}Problem: ${id ? `${id}. ` : ''}${title} (${difficulty})`,
    `${prefix}LeetCode: ${url}`,
    `${prefix}Language: ${langConfig.name}`,
    problem.runtime ? `${prefix}Runtime: ${problem.runtime}${problem.runtimePercentile ? ` (beats ${problem.runtimePercentile}%)` : ''}` : null,
    problem.memory ? `${prefix}Memory: ${problem.memory}${problem.memoryPercentile ? ` (beats ${problem.memoryPercentile}%)` : ''}` : null,
    `${prefix}Synced by Code_Raginii`,
    `${prefix}==========================================================================`,
    ''
  ].filter(Boolean).join('\n');

  return `${header}\n${(code || '').trim()}\n`;
}

/**
 * Generates clean markdown problem documentation
 */
export function generateProblemReadme(problem) {
  const title = problem.title || 'Untitled Problem';
  const id = problem.id || problem.questionId || '';
  const difficulty = (problem.difficulty || 'Easy').charAt(0).toUpperCase() + (problem.difficulty || 'Easy').slice(1).toLowerCase();
  const titleSlug = problem.titleSlug || slugify(title);
  const url = problem.url || `https://leetcode.com/problems/${titleSlug}/`;
  const langConfig = getLanguageConfig(problem.language);

  const runtimeInfo = problem.runtime ? `- **Runtime**: ${problem.runtime}${problem.runtimePercentile ? ` (beats ${problem.runtimePercentile}%)` : ''}` : null;
  const memoryInfo = problem.memory ? `- **Memory**: ${problem.memory}${problem.memoryPercentile ? ` (beats ${problem.memoryPercentile}%)` : ''}` : null;

  return `# ${id ? `${id}. ` : ''}${title}

- **Difficulty**: \`${difficulty}\`
- **Language**: \`${langConfig.name}\`
- **LeetCode URL**: [${title}](${url})
${runtimeInfo || ''}
${memoryInfo || ''}

## Solution File
- [${langConfig.name} Solution](./solution.${langConfig.ext})

---
*Synced automatically with [Code_Raginii](https://github.com/)*
`;
}

/**
 * Maintains repository root README.md with summary table of all unique solved problems.
 */
export function buildRootReadme(syncedRegistry) {
  const problems = Object.values(syncedRegistry || {}).sort((a, b) => {
    const numA = parseInt(a.id, 10) || 99999;
    const numB = parseInt(b.id, 10) || 99999;
    return numA - numB;
  });

  const total = problems.length;
  const easyCount = problems.filter(p => (p.difficulty || '').toLowerCase() === 'easy').length;
  const medCount = problems.filter(p => (p.difficulty || '').toLowerCase() === 'medium').length;
  const hardCount = problems.filter(p => (p.difficulty || '').toLowerCase() === 'hard').length;

  let tableRows = '';
  if (problems.length === 0) {
    tableRows = '| - | *No problems synced yet* | - | - | - |\n';
  } else {
    tableRows = problems.map(p => {
      const num = p.id ? String(p.id) : '-';
      const titleLink = p.url ? `[${p.title}](${p.url})` : p.title;
      const diff = `\`${p.difficulty || 'Easy'}\``;
      const lang = `\`${p.language || 'Code'}\``;
      const solLink = p.solutionPath ? `[Solution](./${p.solutionPath})` : (p.dirPath ? `[Solution](./${p.dirPath}/)` : '-');
      return `| ${num} | ${titleLink} | ${diff} | ${lang} | ${solLink} |`;
    }).join('\n') + '\n';
  }

  return `# Code_Raginii — LeetCode Solutions 💻

Automatically syncing accepted LeetCode solutions to GitHub with **Code_Raginii**.

## 📊 Progress Summary
- **Total Unique Problems**: **${total}** (🟢 Easy: ${easyCount} | 🟡 Medium: ${medCount} | 🔴 Hard: ${hardCount})

## 📝 Synced Solutions
| # | Problem Name | Difficulty | Language | Solution |
|:---|:---|:---:|:---:|:---:|
${tableRows}
---
*Automated using [Code_Raginii](https://github.com/)*
`;
}

/**
 * Builds the complete file bundle for a problem ready for GitHub commit
 */
export function buildProblemSyncBundle(problem, directoryPattern, commitMessagePattern) {
  const dirPath = resolveProblemDirectory(directoryPattern, problem);
  const langConfig = getLanguageConfig(problem.language);
  const commitMessage = resolveCommitMessage(commitMessagePattern, problem);

  const solutionFileName = `solution.${langConfig.ext}`;
  const solutionFilePath = `${dirPath}/${solutionFileName}`;
  const readmeFilePath = `${dirPath}/README.md`;

  const formattedCode = formatSolutionCode(problem.code, problem);
  const readmeContent = generateProblemReadme(problem);

  return {
    dirPath,
    commitMessage,
    solutionFileName,
    solutionFilePath,
    files: [
      {
        path: solutionFilePath,
        content: formattedCode,
        description: `Solution code (${langConfig.name})`
      },
      {
        path: readmeFilePath,
        content: readmeContent,
        description: 'Problem documentation'
      }
    ]
  };
}
