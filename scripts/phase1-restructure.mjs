/**
 * Phase 1 Restructure — Move role folders into src/features/
 *
 * What this script does:
 *   1. Creates src/features/ if it doesn't exist
 *   2. Moves src/{admin,auth,customer,guest,superadmin} -> src/features/{...}
 *   3. Updates tsconfig.app.json path alias targets to reflect the new paths
 *   4. Does NOT touch import statements — aliases (@admin/*, etc.) stay the same
 *
 * Usage:
 *   node scripts/phase1-restructure.mjs          # dry run (no changes)
 *   node scripts/phase1-restructure.mjs --apply  # apply changes
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const FEATURES = path.join(SRC, 'features');
const TSCONFIG = path.join(ROOT, 'tsconfig.app.json');

const DRY_RUN = !process.argv.includes('--apply');

// Folders to move: src/<name> -> src/features/<name>
// 'chat' is already inside src/features/, so it's excluded.
const FOLDERS_TO_MOVE = ['admin', 'auth', 'customer', 'guest', 'superadmin'];

// Path alias updates in tsconfig.app.json
// Key: alias prefix, Value: [old target, new target]
const ALIAS_UPDATES = {
  '@admin/*':      ['src/admin/*',      'src/features/admin/*'],
  '@auth/*':       ['src/auth/*',       'src/features/auth/*'],
  '@customer/*':   ['src/customer/*',   'src/features/customer/*'],
  '@guest/*':      ['src/guest/*',      'src/features/guest/*'],
  '@superadmin/*': ['src/superadmin/*', 'src/features/superadmin/*'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(msg);
}

function logDry(action, detail) {
  console.log(`  [DRY RUN] ${action}: ${detail}`);
}

function logApply(action, detail) {
  console.log(`  [APPLY]   ${action}: ${detail}`);
}

function checkGitClean() {
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
    if (status) {
      console.warn('\nWARNING: You have uncommitted changes. Commit or stash them before running --apply.\n');
      console.warn(status);
      console.warn('');
    } else {
      log('Git working tree: clean');
    }
  } catch {
    log('(git check skipped — not a git repo or git not available)');
  }
}

// ─── Step 1: Validate sources exist ───────────────────────────────────────────

function validateSources() {
  log('\n[Step 1] Checking source folders...');
  let allOk = true;
  for (const folder of FOLDERS_TO_MOVE) {
    const src = path.join(SRC, folder);
    const exists = fs.existsSync(src);
    log(`  ${exists ? '✓' : '✗'} src/${folder} ${exists ? 'exists' : 'NOT FOUND — skipping'}`);
    if (!exists) allOk = false;
  }
  return allOk;
}

// ─── Step 2: Move folders ─────────────────────────────────────────────────────

function moveFolders() {
  log('\n[Step 2] Moving folders to src/features/...');

  // Create src/features/ if needed (keep existing chat/ untouched)
  if (!fs.existsSync(FEATURES)) {
    if (DRY_RUN) {
      logDry('mkdir', 'src/features/');
    } else {
      fs.mkdirSync(FEATURES, { recursive: true });
      logApply('mkdir', 'src/features/');
    }
  } else {
    log('  src/features/ already exists');
  }

  for (const folder of FOLDERS_TO_MOVE) {
    const srcPath = path.join(SRC, folder);
    const destPath = path.join(FEATURES, folder);

    if (!fs.existsSync(srcPath)) {
      log(`  Skipping src/${folder} (not found)`);
      continue;
    }

    if (fs.existsSync(destPath)) {
      log(`  Skipping src/${folder} — src/features/${folder} already exists`);
      continue;
    }

    if (DRY_RUN) {
      logDry('move', `src/${folder} -> src/features/${folder}`);
    } else {
      fs.renameSync(srcPath, destPath);
      logApply('move', `src/${folder} -> src/features/${folder}`);
    }
  }
}

// ─── Step 3: Update tsconfig.app.json ────────────────────────────────────────
// tsconfig.app.json contains // comments so we can't use JSON.parse.
// Instead we do targeted string replacements on the raw file content.

function updateTsconfig() {
  log('\n[Step 3] Updating tsconfig.app.json path aliases...');

  let raw = fs.readFileSync(TSCONFIG, 'utf8');
  let changed = false;

  for (const [alias, [oldTarget, newTarget]] of Object.entries(ALIAS_UPDATES)) {
    if (!raw.includes(`"${oldTarget}"`)) {
      if (raw.includes(`"${newTarget}"`)) {
        log(`  ${alias} already points to ${newTarget}`);
      } else {
        log(`  WARNING: ${alias} — could not find "${oldTarget}" in tsconfig, skipping`);
      }
      continue;
    }

    if (DRY_RUN) {
      logDry('update tsconfig', `${alias}: "${oldTarget}" -> "${newTarget}"`);
    } else {
      raw = raw.replace(`"${oldTarget}"`, `"${newTarget}"`);
      logApply('update tsconfig', `${alias}: "${oldTarget}" -> "${newTarget}"`);
    }
    changed = true;
  }

  if (!DRY_RUN && changed) {
    fs.writeFileSync(TSCONFIG, raw, 'utf8');
    logApply('write', 'tsconfig.app.json');
  }
}

// ─── Step 4: Verify no broken relative cross-imports ─────────────────────────

function verifyRelativeImports() {
  log('\n[Step 4] Scanning for relative cross-imports that may need manual fixes...');

  const patterns = FOLDERS_TO_MOVE.map(f => `src/${f}`);
  const scanDirs = [SRC];
  const extensions = ['.ts', '.tsx'];
  const issues = [];

  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        scanDir(fullPath);
      } else if (extensions.includes(path.extname(entry.name))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Look for relative imports that cross into a DIFFERENT role folder
          const match = line.match(/from ['"](\.\.[/\\][^'"]+)['"]/);
          if (!match) continue;

          const importPath = match[1];
          const resolved = path.normalize(path.resolve(path.dirname(fullPath), importPath));
          const relToSrc = path.relative(SRC, resolved);

          // Which role folder does the import resolve into?
          const targetFolder = FOLDERS_TO_MOVE.find(f => relToSrc.startsWith(f + path.sep) || relToSrc === f);
          if (!targetFolder) continue;

          // Which role folder does the importing file live in?
          const relFileSrc = path.relative(SRC, fullPath);
          const sourceFolder = FOLDERS_TO_MOVE.find(f => relFileSrc.startsWith(f + path.sep));

          // Only flag if they're different (true cross-folder import)
          if (targetFolder !== sourceFolder) {
            issues.push({
              file: path.relative(ROOT, fullPath),
              line: i + 1,
              import: importPath,
              into: targetFolder,
            });
          }
        }
      }
    }
  }

  scanDir(SRC);

  if (issues.length === 0) {
    log('  No relative cross-imports found. Safe to proceed.');
  } else {
    log(`  Found ${issues.length} relative imports that cross role-folder boundaries:`);
    for (const issue of issues) {
      log(`    ${issue.file}:${issue.line}  ->  ${issue.import}  (into: ${issue.into}/)`);
    }
    log('\n  These will need manual fixes after moving. Consider switching them to aliases.');
  }

  return issues.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

log('='.repeat(60));
log(`Phase 1 Restructure — ${DRY_RUN ? 'DRY RUN (pass --apply to execute)' : 'APPLYING CHANGES'}`);
log('='.repeat(60));

if (!DRY_RUN) checkGitClean();

validateSources();
const crossImportCount = verifyRelativeImports();

if (!DRY_RUN && crossImportCount > 0) {
  log('\nAborting: fix relative cross-imports first (or run dry run to review).');
  process.exit(1);
}

moveFolders();
updateTsconfig();

log('\n' + '='.repeat(60));
if (DRY_RUN) {
  log('Dry run complete. Run with --apply to execute.');
} else {
  log('Done. Next steps:');
  log('  1. Run: npx tsc --noEmit   (check for type errors)');
  log('  2. Run: npx vite build     (verify build passes)');
  log('  3. Commit the result.');
}
log('='.repeat(60));
