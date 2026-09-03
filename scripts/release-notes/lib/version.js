'use strict';

// Where the release boundary comes from.
//
// This repo does not tag releases, so "the last release" has to be inferred.
// The version number itself is the most reliable marker available: a release is
// cut by bumping `versionCode`/`versionName` in android/app/build.gradle (Play)
// or `CURRENT_PROJECT_VERSION`/`MARKETING_VERSION` in the Xcode project (App
// Store). Finding the commit that set the *previous* version gives the exact
// range of work that a release ships.
//
// Tags win if they exist, so adopting `git tag v1.0.15` later needs no change here.

const path = require('path');
const git = require('./git');

const ANDROID_GRADLE = 'android/app/build.gradle';

function androidVersion(text) {
  if (!text) return null;
  const code = text.match(/^\s*versionCode\s+(\d+)/m);
  const name = text.match(/^\s*versionName\s+["']([^"']+)["']/m);
  if (!code && !name) return null;
  return {
    code: code ? code[1] : null,
    name: name ? name[1] : null,
  };
}

function iosVersion(text) {
  if (!text) return null;
  const build = text.match(/CURRENT_PROJECT_VERSION\s*=\s*([^;\s]+)\s*;/);
  const market = text.match(/MARKETING_VERSION\s*=\s*([^;\s]+)\s*;/);
  if (!build && !market) return null;
  return {
    code: build ? build[1] : null,
    name: market ? market[1] : null,
  };
}

// The Xcode project path is discovered rather than hardcoded so a rename of the
// .xcodeproj does not silently break version detection.
function iosProjectPath(root) {
  const fs = require('fs');
  const iosDir = path.join(root, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  const proj = fs.readdirSync(iosDir).find((d) => d.endsWith('.xcodeproj'));
  return proj ? `ios/${proj}/project.pbxproj` : null;
}

function manifestFor(root, platform) {
  if (platform === 'ios') {
    const p = iosProjectPath(root);
    return p ? { file: p, parse: iosVersion, store: 'App Store' } : null;
  }
  return { file: ANDROID_GRADLE, parse: androidVersion, store: 'Google Play' };
}

function versionAt(root, ref, manifest) {
  return manifest.parse(git.fileAt(root, ref, manifest.file));
}

function label(v) {
  if (!v) return 'unknown';
  if (v.name && v.code) return `${v.name} (${v.code})`;
  return v.name || v.code || 'unknown';
}

// Only the build code marks a release. Both stores force it to change on every
// upload — Play rejects a reused `versionCode`, App Store Connect rejects a
// reused `CURRENT_PROJECT_VERSION` with ITMS-90062 — whereas the user-facing
// name moves for other reasons entirely. Comparing the name too would read a
// marketing-only bump as a release and cut the range short, hiding work that
// has never actually shipped. Fall back to the name only if there is no code.
function sameVersion(a, b) {
  if (!a || !b) return false;
  if (a.code && b.code) return a.code === b.code;
  return a.name === b.name;
}

// The commit that *set* the version before the current one.
//
// Walking the commits that touched the manifest (newest first) we skip
// everything still carrying the current version, then keep walking through the
// previous version until it changes again. The last commit still carrying the
// previous version is the one that introduced it, and that is where the new
// work starts.
//
// Returning the *first* commit carrying a different version — the obvious
// reading, and what this did originally — is wrong whenever anything landed
// after the previous release was cut, which is the normal case. Those commits
// still carry the old version because the manifest is only bumped at release
// time, so any of them that happened to touch the manifest for an unrelated
// reason would be mistaken for the release tip. Gold Khata Book 1.0.16 hit exactly
// that: an Expo change edited project.pbxproj while the version still read
// 1.0.15 (10), so the range began there and the notes covered 2 commits
// instead of the ten releasable ones since build 10 went up.
function previousBumpCommit(root, to, manifest) {
  const current = versionAt(root, to, manifest);
  if (!current) return null;

  let previous = null;
  let introduced = null;

  for (const sha of git.touching(root, manifest.file, to)) {
    const v = versionAt(root, sha, manifest);
    if (!v) continue;

    if (!previous) {
      // Still inside the release being written up.
      if (sameVersion(v, current)) continue;
      previous = v;
      introduced = sha;
      continue;
    }

    // Reached the release before the previous one — stop, keeping the oldest
    // commit that still carried the previous version.
    if (!sameVersion(v, previous)) break;
    introduced = sha;
  }

  return previous ? { sha: introduced, version: previous } : null;
}

// The commit that first set the version the repo currently carries.
//
// Which end of that bump the range should start at depends on something git
// cannot see: whether the current version has already been uploaded. The normal
// release order is bump, then write the notes, so the default assumes it has
// not — but when a platform is sitting mid-cycle on an already-shipped build
// (as iOS does between releases), this commit is the right `--from`. The caller
// surfaces it rather than guessing.
function currentBumpCommit(root, to, manifest) {
  const current = versionAt(root, to, manifest);
  if (!current) return null;

  let introduced = null;
  for (const sha of git.touching(root, manifest.file, to)) {
    const v = versionAt(root, sha, manifest);
    if (!v || !sameVersion(v, current)) break;
    introduced = sha;
  }
  return introduced;
}

// Resolve the `from` end of the range, in order of trustworthiness:
// explicit ref > release tag > version-bump commit.
function findBaseline(root, { to, platform, from }) {
  if (from) {
    const sha = git.resolve(root, from);
    if (!sha) throw new Error(`--from ${from} is not a commit this repo knows about.`);
    return { sha, ref: from, source: 'explicit' };
  }

  const tags = git.releaseTags(root, to);
  // Skip a tag sitting on the commit we are summarising to — it would give an
  // empty range on a re-run after tagging.
  const toSha = git.resolve(root, to);
  const tag = tags.find((t) => git.resolve(root, t) !== toSha);
  if (tag) {
    return { sha: git.resolve(root, tag), ref: tag, source: 'tag' };
  }

  const manifest = manifestFor(root, platform);
  if (manifest) {
    const bump = previousBumpCommit(root, to, manifest);
    if (bump) {
      return {
        sha: bump.sha,
        ref: bump.sha.slice(0, 7),
        source: 'version-bump',
        version: bump.version,
      };
    }
  }

  return null;
}

function currentVersion(root, to, platform) {
  const manifest = manifestFor(root, platform);
  return manifest ? versionAt(root, to, manifest) : null;
}

module.exports = {
  androidVersion, iosVersion, manifestFor, versionAt,
  previousBumpCommit, currentBumpCommit, findBaseline, currentVersion, label,
};
