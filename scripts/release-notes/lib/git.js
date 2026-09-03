'use strict';

// Thin git wrapper. Everything here is read-only — this tool never writes to the
// repo, so it is safe to run against a dirty working tree mid-release.

const { execFileSync } = require('child_process');

// ASCII record/unit separators. Commit messages cannot contain these, so a
// subject or body with newlines, pipes or quotes in it still parses correctly.
const REC = '';
const FLD = '';

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function tryGit(root, args) {
  try {
    return git(root, args);
  } catch (err) {
    return null;
  }
}

function isRepo(root) {
  return tryGit(root, ['rev-parse', '--is-inside-work-tree']) !== null;
}

function resolve(root, ref) {
  const out = tryGit(root, ['rev-parse', '--verify', `${ref}^{commit}`]);
  return out ? out.trim() : null;
}

function shortDate(root, ref) {
  const out = tryGit(root, ['log', '-1', '--format=%ad', '--date=short', ref]);
  return out ? out.trim() : null;
}

function subject(root, ref) {
  const out = tryGit(root, ['log', '-1', '--format=%s', ref]);
  return out ? out.trim() : null;
}

// Commits in `from..to`, newest first, merges dropped — a merge's subject just
// restates work already described by the commits it brings in.
function commits(root, from, to) {
  const range = from ? `${from}..${to}` : to;
  const format = ['%H', '%h', '%an', '%ad', '%s', '%b'].join(FLD) + REC;
  const out = git(root, ['log', '--no-merges', '--date=short', `--format=${format}`, range]);

  return out
    .split(REC)
    .filter((r) => r.trim())
    .map((rec) => {
      const [hash, short, author, date, subj, body] = rec.replace(/^\s+/, '').split(FLD);
      return {
        hash,
        short,
        author,
        date,
        subject: (subj || '').trim(),
        body: (body || '').trim(),
      };
    });
}

// Commits that touched a path, newest first.
function touching(root, file, to) {
  const out = tryGit(root, ['log', '--format=%H', to, '--', file]);
  return out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

// File contents as of a commit, or null if the file did not exist yet.
function fileAt(root, ref, file) {
  return tryGit(root, ['show', `${ref}:${file}`]);
}

// Release-shaped tags reachable from `to`, newest first. Matches v1.2.3, 1.2.3,
// android-v1.2.3 and the like; ignores anything else a repo may have tagged.
function releaseTags(root, to) {
  const out = tryGit(root, ['tag', '--sort=-creatordate', '--merged', to]);
  if (!out) return [];
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((t) => /\d+\.\d+/.test(t));
}

function filesChanged(root, from, to) {
  const range = from ? `${from}..${to}` : to;
  const out = tryGit(root, ['diff', '--name-only', range]);
  return out ? out.split('\n').map((l) => l.trim()).filter(Boolean) : [];
}

module.exports = {
  git, tryGit, isRepo, resolve, shortDate, subject,
  commits, touching, fileAt, releaseTags, filesChanged,
};
