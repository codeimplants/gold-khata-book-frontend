'use strict';

// Source-tree scanning.
//
// Every content check needs the same thing: walk the app's own source, skipping
// vendored and generated trees, and find lines matching a pattern. Doing that
// once here keeps the checks themselves down to a pattern and a message.

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', 'ios', 'android', 'Pods', 'vendor',
  'dist', 'coverage', '.expo', '.next', '__snapshots__', 'patches',
]);

const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.json']);

function walk(dir, out = [], depth = 0) {
  if (depth > 12) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.env') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out, depth + 1);
    } else if (CODE_EXT.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

function sourceFiles(root, srcDirs) {
  const files = [];
  for (const rel of srcDirs) {
    const dir = path.join(root, rel);
    if (fs.existsSync(dir)) {
      if (fs.statSync(dir).isDirectory()) walk(dir, files);
      else files.push(dir);
    }
  }
  return files;
}

// A line that is only a comment describes code rather than being code. Matching
// them produced pure noise on the first real run — a comment explaining what an
// API_BASE_URL looks like was reported as a shipped dev endpoint.
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|#)/;

// Returns [{ file, line, text }]. `limit` keeps a noisy pattern from burying
// the rest of the report — the count is still reported accurately.
function grep(files, pattern, { limit = 8, root = '', includeComments = false } = {}) {
  const hits = [];
  let total = 0;
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch (e) {
      continue;
    }
    if (!pattern.test(text)) {
      pattern.lastIndex = 0;
      continue;
    }
    pattern.lastIndex = 0;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!includeComments && COMMENT_LINE.test(lines[i])) continue;
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        total += 1;
        if (hits.length < limit) {
          hits.push({
            file: root ? path.relative(root, file) : file,
            line: i + 1,
            text: lines[i].trim().slice(0, 140),
          });
        }
      }
    }
    pattern.lastIndex = 0;
  }
  return { hits, total };
}

function formatHits({ hits, total }) {
  if (!hits.length) return null;
  const lines = hits.map((h) => `${h.file}:${h.line}  ${h.text}`);
  if (total > hits.length) lines.push(`… and ${total - hits.length} more`);
  return lines.join('\n');
}

module.exports = { sourceFiles, grep, formatHits, walk };
