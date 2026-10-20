/**
 * Code_Raginii - Release Packaging & Validation Script
 * Zero external dependencies. Uses Node.js built-ins and PowerShell / tar.exe.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');

console.log('====================================================');
console.log('🚀 Code_Raginii Release Packaging & Validation Suite');
console.log('====================================================\n');

// 1. Validate manifest.json
console.log('📦 Step 1: Validating manifest.json...');
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ Error: manifest.json not found at', MANIFEST_PATH);
  process.exit(1);
}

let manifest;
try {
  const rawManifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  manifest = JSON.parse(rawManifest);
} catch (err) {
  console.error('❌ Error: Failed to parse manifest.json as valid JSON:', err.message);
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  console.error('❌ Error: manifest_version must be 3, found:', manifest.manifest_version);
  process.exit(1);
}

console.log(`   ✓ Extension Name: ${manifest.name}`);
console.log(`   ✓ Version:        ${manifest.version}`);
console.log(`   ✓ Manifest Spec:  V${manifest.manifest_version}`);

// 2. Verify all referenced files in manifest exist
console.log('\n🔍 Step 2: Verifying referenced assets and scripts...');

const filesToVerify = [
  MANIFEST_PATH,
  path.join(ROOT_DIR, manifest.background?.service_worker || 'background/background.js'),
  path.join(ROOT_DIR, 'background/github-api.js'),
  path.join(ROOT_DIR, 'background/rag-templates.js'),
  path.join(ROOT_DIR, manifest.action?.default_popup || 'popup/popup.html'),
  path.join(ROOT_DIR, 'popup/popup.css'),
  path.join(ROOT_DIR, 'popup/popup.js'),
  path.join(ROOT_DIR, 'content/leetcode.js'),
  path.join(ROOT_DIR, 'content/content.css'),
  path.join(ROOT_DIR, 'content/main-world.js')
];

// Add icons
if (manifest.icons) {
  Object.values(manifest.icons).forEach(iconRel => {
    filesToVerify.push(path.join(ROOT_DIR, iconRel));
  });
}

let missingCount = 0;
filesToVerify.forEach(fp => {
  const rel = path.relative(ROOT_DIR, fp);
  if (fs.existsSync(fp)) {
    const stats = fs.statSync(fp);
    console.log(`   ✓ ${rel.padEnd(32)} (${stats.size.toLocaleString()} bytes)`);
  } else {
    console.error(`   ❌ MISSING: ${rel}`);
    missingCount++;
  }
});

if (missingCount > 0) {
  console.error(`\n❌ Validation failed: ${missingCount} required files are missing.`);
  process.exit(1);
}

// 3. Syntax check JS files
console.log('\n🧪 Step 3: Running JS syntax checks (node -c)...');
const jsFiles = [
  'background/background.js',
  'background/github-api.js',
  'background/rag-templates.js',
  'content/leetcode.js',
  'content/main-world.js',
  'popup/popup.js'
];

for (const jsFile of jsFiles) {
  const fullPath = path.join(ROOT_DIR, jsFile);
  try {
    execSync(`node -c "${fullPath}"`);
    console.log(`   ✓ Syntax OK: ${jsFile}`);
  } catch (err) {
    console.error(`   ❌ Syntax error in ${jsFile}:`, err.message);
    process.exit(1);
  }
}

// 4. Create clean distribution package
console.log('\n📦 Step 4: Packaging production ZIP bundle...');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

const version = manifest.version || '1.0.0';
const zipFileName = `code_raginii_v${version}.zip`;
const zipFilePath = path.join(DIST_DIR, zipFileName);

// Remove prior zip if exists
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

// Create a staging directory to guarantee no unwanted files (like .git, node_modules, dist) are included
const STAGING_DIR = path.join(DIST_DIR, `staging_v${version}`);
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// Copy essential folders and files into staging
const itemsToInclude = [
  'manifest.json',
  'README.md',
  'background',
  'content',
  'popup',
  'icons'
];

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

for (const item of itemsToInclude) {
  const srcPath = path.join(ROOT_DIR, item);
  const destPath = path.join(STAGING_DIR, item);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`   + Staged: ${item}`);
  }
}

// Compress staging directory into ZIP using PowerShell Compress-Archive
console.log(`\n🗜️  Compressing into ${zipFileName}...`);
try {
  // Compress contents of staging directory so the root of the zip contains manifest.json directly
  const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${STAGING_DIR}\\*' -DestinationPath '${zipFilePath}' -Force"`;
  execSync(psCmd, { stdio: 'inherit' });
} catch (zipErr) {
  console.warn('PowerShell Compress-Archive failed, attempting fallback to tar.exe...');
  try {
    execSync(`tar -a -c -f "${zipFilePath}" -C "${STAGING_DIR}" .`, { stdio: 'inherit' });
  } catch (tarErr) {
    console.error('❌ Failed to create zip package:', tarErr.message);
    process.exit(1);
  }
}

// Clean up staging directory
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

// 5. Compute SHA256 Checksum
if (fs.existsSync(zipFilePath)) {
  const zipBuffer = fs.readFileSync(zipFilePath);
  const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
  const sizeKb = (zipBuffer.length / 1024).toFixed(2);

  const checksumFile = path.join(DIST_DIR, `code_raginii_v${version}.sha256`);
  fs.writeFileSync(checksumFile, `${hash}  ${zipFileName}\n`, 'utf8');

  console.log('\n🎉 Step 5: Packaging Complete!');
  console.log('----------------------------------------------------');
  console.log(`📁 Artifact:   dist/${zipFileName}`);
  console.log(`⚖️  Size:       ${sizeKb} KB (${zipBuffer.length.toLocaleString()} bytes)`);
  console.log(`🔒 SHA-256:    ${hash}`);
  console.log(`📄 Checksum:   dist/${path.basename(checksumFile)}`);
  console.log('----------------------------------------------------');
  console.log('\nReady for Chrome Web Store Developer Dashboard upload or GitHub Releases distribution!');
} else {
  console.error('❌ Error: Target zip file was not created.');
  process.exit(1);
}
