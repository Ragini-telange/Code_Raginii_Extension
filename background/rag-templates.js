/**
 * RAG_LeetSync - RAG Metadata & Solution Templating Engine (Phase 3)
 * Formats LeetCode solutions, structured markdown documentation,
 * and semantic metadata optimized for LLM RAG pipelines.
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
 * Gets language metadata with fallback
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
 * Resolves directory path for a problem based on user pattern settings
 */
export function resolveProblemDirectory(pattern, problem) {
  const difficulty = (problem.difficulty || 'Easy').toLowerCase();
  const Difficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const id = problem.id || problem.questionId || '0';
  const id4 = String(id).padStart(4, '0');
  const titleSlug = problem.titleSlug || slugify(problem.title || 'untitled');
  const language = (problem.language || 'python3').toLowerCase();

  const defaultPattern = 'problems/{difficulty}/{titleSlug}';
  let dir = (pattern || defaultPattern).trim();

  dir = dir
    .replace(/\{difficulty\}/g, difficulty)
    .replace(/\{Difficulty\}/g, Difficulty)
    .replace(/\{titleSlug\}/g, titleSlug)
    .replace(/\{id\}/g, id)
    .replace(/\{id4\}/g, id4)
    .replace(/\{language\}/g, language);

  // Clean extra slashes and leading/trailing slashes
  dir = dir.replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  return dir;
}

/**
 * Resolves commit message based on template pattern
 */
export function resolveCommitMessage(pattern, problem) {
  const defaultPattern = 'Solved {title} [{difficulty}] - RAG_LeetSync';
  const difficulty = (problem.difficulty || 'Easy').charAt(0).toUpperCase() + (problem.difficulty || 'Easy').slice(1).toLowerCase();
  const title = problem.title || 'Problem';
  const id = problem.id || problem.questionId || '';

  let message = (pattern || defaultPattern).trim();
  message = message
    .replace(/\{title\}/g, title)
    .replace(/\{difficulty\}/g, difficulty)
    .replace(/\{id\}/g, id);

  return message;
}

/**
 * Generates rich markdown README with RAG semantic documentation
 */
export function generateReadmeContent(problem) {
  const title = problem.title || 'Untitled Problem';
  const id = problem.id || problem.questionId || '';
  const difficulty = (problem.difficulty || 'Easy').charAt(0).toUpperCase() + (problem.difficulty || 'Easy').slice(1).toLowerCase();
  const titleSlug = problem.titleSlug || slugify(title);
  const url = problem.url || `https://leetcode.com/problems/${titleSlug}/`;
  const language = problem.language || 'Python3';
  const langConfig = getLanguageConfig(language);
  const tags = Array.isArray(problem.tags) ? problem.tags : (problem.tags ? problem.tags.split(',').map(t => t.trim()) : []);

  // Difficulty badge styling
  let difficultyBadgeColor = '2ea44f'; // Green for Easy
  if (difficulty === 'Medium') difficultyBadgeColor = 'dba642'; // Yellow/Amber
  if (difficulty === 'Hard') difficultyBadgeColor = 'cb2431'; // Red

  const tagsFormatted = tags.map(t => `\`${t}\``).join(' ') || 'None';
  const runtimeInfo = problem.runtime ? `**Runtime**: ${problem.runtime}${problem.runtimePercentile ? ` (beats ${problem.runtimePercentile}%)` : ''}` : null;
  const memoryInfo = problem.memory ? `**Memory**: ${problem.memory}${problem.memoryPercentile ? ` (beats ${problem.memoryPercentile}%)` : ''}` : null;

  return `# ${id ? `${id}. ` : ''}${title}

[![Difficulty](https://img.shields.io/badge/Difficulty-${difficulty}-${difficultyBadgeColor}.svg)](${url})
[![LeetCode Problem](${url})](https://img.shields.io/badge/LeetCode-Problem_Page-FFA116?logo=leetcode)
[![RAG Indexable](https://img.shields.io/badge/RAG-Vector_Ready-38BDF8.svg)](#rag-metadata)

## 📌 Problem Overview
- **LeetCode Link**: [${title} [${difficulty}]](${url})
- **Language**: \`${langConfig.name}\`
- **Topics**: ${tagsFormatted}
${runtimeInfo ? `- ${runtimeInfo}` : ''}
${memoryInfo ? `- ${memoryInfo}` : ''}

---

## 📝 Problem Statement
${problem.description ? problem.description.trim() : '> Problem description not provided. View original prompt on LeetCode.'}

---

## 💡 Solution Strategy & Intuition
${problem.notes ? problem.notes.trim() : `
1. **Approach**: ${problem.approach || 'Standard algorithm using optimal data structures.'}
2. **Key Insight**: ${problem.insight || 'Maintained state and avoided redundant computations.'}
`}

---

## ⏱️ Complexity Analysis
- **Time Complexity**: ${problem.timeComplexity || 'O(N)'}
- **Space Complexity**: ${problem.spaceComplexity || 'O(1)'}

---

## 🤖 RAG Metadata
<!-- RAG_METADATA_START -->
\`\`\`json
${JSON.stringify(generateMetadataObject(problem), null, 2)}
\`\`\`
<!-- RAG_METADATA_END -->

*Synced automatically by [RAG_LeetSync](https://github.com/)*
`;
}

/**
 * Generates structured JSON metadata object for RAG indexing
 */
export function generateMetadataObject(problem) {
  const tags = Array.isArray(problem.tags) ? problem.tags : (problem.tags ? problem.tags.split(',').map(t => t.trim()) : []);
  const titleSlug = problem.titleSlug || slugify(problem.title || '');

  return {
    id: problem.id || problem.questionId || null,
    title: problem.title || '',
    titleSlug: titleSlug,
    difficulty: problem.difficulty || 'Easy',
    url: problem.url || `https://leetcode.com/problems/${titleSlug}/`,
    language: problem.language || 'python3',
    tags: tags,
    timeComplexity: problem.timeComplexity || 'O(N)',
    spaceComplexity: problem.spaceComplexity || 'O(1)',
    runtime: problem.runtime || null,
    runtimePercentile: problem.runtimePercentile || null,
    memory: problem.memory || null,
    memoryPercentile: problem.memoryPercentile || null,
    syncedAt: new Date().toISOString(),
    tool: 'RAG_LeetSync'
  };
}

/**
 * Formats the source code with top header comment
 */
export function formatSolutionCode(code, problem) {
  const langConfig = getLanguageConfig(problem.language);
  const prefix = langConfig.commentPrefix;
  const title = problem.title || 'Solution';
  const difficulty = problem.difficulty || 'Easy';
  const url = problem.url || `https://leetcode.com/problems/${problem.titleSlug || slugify(title)}/`;

  const header = [
    `${prefix}--------------------------------------------------------------------------`,
    `${prefix}Problem: ${title} (${difficulty})`,
    `${prefix}URL: ${url}`,
    `${prefix}Language: ${langConfig.name}`,
    problem.timeComplexity ? `${prefix}Time: ${problem.timeComplexity} | Space: ${problem.spaceComplexity || 'O(1)'}` : null,
    `${prefix}Synced with RAG_LeetSync`,
    `${prefix}--------------------------------------------------------------------------`,
    ''
  ].filter(Boolean).join('\n');

  return `${header}\n${(code || '').trim()}\n`;
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
  const metadataFilePath = `${dirPath}/metadata.json`;

  const formattedCode = formatSolutionCode(problem.code, problem);
  const readmeContent = generateReadmeContent(problem);
  const metadataContent = JSON.stringify(generateMetadataObject(problem), null, 2);

  return {
    dirPath,
    commitMessage,
    files: [
      {
        path: solutionFilePath,
        content: formattedCode,
        description: `Solution code (${langConfig.name})`
      },
      {
        path: readmeFilePath,
        content: readmeContent,
        description: 'RAG Markdown Documentation & Approach'
      },
      {
        path: metadataFilePath,
        content: metadataContent,
        description: 'Structured RAG Metadata JSON'
      }
    ]
  };
}
