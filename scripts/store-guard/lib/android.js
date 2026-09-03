'use strict';

// Readers for the Android side: the source manifest and the Gradle files.
//
// Deliberately regex-based rather than a real Gradle/XML parser. The values we
// need are simple assignments and attributes, and depending on a parser would
// mean this tool could not be dropped into a repo with `npm install` skipped.
//
// The limitation to know: this reads the SOURCE manifest, not the merged one.
// Autolinked libraries inject permissions at merge time that never appear here.
// `mergedManifest()` reads the real merged output when a build has produced it.

const fs = require('fs');
const path = require('path');

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

// Gradle values are spread across android/build.gradle (ext block) and
// android/app/build.gradle, and the app file usually just references the ext.
function gradleValue(root, key) {
  const files = [
    path.join(root, 'android', 'app', 'build.gradle'),
    path.join(root, 'android', 'build.gradle'),
  ];
  for (const file of files) {
    const text = readIfExists(file);
    if (!text) continue;
    // Matches `targetSdkVersion = 36`, `targetSdkVersion 36`, `versionCode 10`.
    const re = new RegExp(`^\\s*${key}\\s*=?\\s*([0-9]+|"[^"]*"|'[^']*')\\s*$`, 'm');
    const m = text.match(re);
    if (m) {
      const raw = m[1].replace(/^["']|["']$/g, '');
      return { value: /^[0-9]+$/.test(raw) ? Number(raw) : raw, file };
    }
  }
  return { value: null, file: null };
}

// Expo projects never write the SDK levels into the repo — the expo-root-project
// Gradle plugin supplies them, and the only on-disk copy is a default baked into
// node_modules. So resolving a version means trying three sources in order of
// authority: what the app declares, what the built manifest actually contains,
// and finally what Expo would default to.
function resolveSdkVersion(root, key) {
  const direct = gradleValue(root, key);
  if (direct.value !== null) return { value: Number(direct.value), source: path.relative(root, direct.file) };

  // The merged manifest is authoritative — it is what shipped.
  const merged = mergedManifestPath(root);
  const mergedXml = merged && readIfExists(merged);
  if (mergedXml) {
    const attr = key.replace('Version', ''); // targetSdkVersion -> targetSdk
    const m = mergedXml.match(new RegExp(`android:${attr}Version\\s*=\\s*"(\\d+)"`));
    if (m) return { value: Number(m[1]), source: `${path.relative(root, merged)} (merged manifest)` };
  }

  // Expo's compiled-in default.
  const expoConfig = path.join(
    root, 'node_modules', 'expo-modules-core', 'expo-module-gradle-plugin',
    'src', 'main', 'kotlin', 'expo', 'modules', 'plugin', 'ProjectConfiguration.kt'
  );
  const kt = readIfExists(expoConfig);
  if (kt) {
    const m = kt.match(new RegExp(`warnIfNotDefined\\("${key}",\\s*(\\d+)\\)`));
    if (m) return { value: Number(m[1]), source: 'Expo SDK default (node_modules)' };
  }

  return { value: null, source: null };
}

function manifestPath(root) {
  return path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
}

// The merged manifest only exists after a build. When it does, it is the truth —
// it contains everything autolinked libraries contributed.
function mergedManifestPath(root) {
  const candidates = [
    path.join(root, 'android', 'app', 'build', 'intermediates', 'merged_manifests', 'release', 'AndroidManifest.xml'),
    path.join(root, 'android', 'app', 'build', 'intermediates', 'merged_manifests', 'release', 'processReleaseManifest', 'AndroidManifest.xml'),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;

  // Gradle moves this path between AGP versions; fall back to a shallow search.
  const base = path.join(root, 'android', 'app', 'build', 'intermediates', 'merged_manifests');
  if (!fs.existsSync(base)) return null;
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.name === 'AndroidManifest.xml' && /release/i.test(full)) return full;
    }
  }
  return null;
}

function permissions(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<uses-permission[^>]*android:name\s*=\s*"([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const tag = m[0];
    // `tools:node="remove"` is how the manifest merger is told to strip a
    // permission an autolinked library injected — it is Google's documented
    // remedy for AD_ID in apps without ads. The tag is a deletion instruction,
    // so counting it as a request reports the exact opposite of the truth.
    if (/tools:node\s*=\s*"remove"/.test(tag)) continue;
    const maxSdk = tag.match(/android:maxSdkVersion\s*=\s*"(\d+)"/);
    out.push({ name: m[1], maxSdkVersion: maxSdk ? Number(maxSdk[1]) : null });
  }
  return out;
}

function applicationAttr(xml, attr) {
  if (!xml) return null;
  const app = xml.match(/<application[^>]*>/);
  if (!app) return null;
  const m = app[0].match(new RegExp(`${attr}\\s*=\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

function services(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<service[^>]*>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const name = m[0].match(/android:name\s*=\s*"([^"]+)"/);
    const type = m[0].match(/android:foregroundServiceType\s*=\s*"([^"]+)"/);
    out.push({ name: name ? name[1] : '(unnamed)', foregroundServiceType: type ? type[1] : null });
  }
  return out;
}

// Placeholders a React Native app never sets itself.
//
// `com.facebook.react` injects manifestPlaceholders into the buildTypes it
// finalises, so a template manifest can reference ${usesCleartextTraffic}
// without the app's own build.gradle mentioning it anywhere. Reading only the
// app's gradle therefore reports "could not be resolved" for a value that is in
// fact set, and set safely.
//
// Derived from the plugin's own source rather than hardcoded, so it tracks
// whatever the installed React Native actually does instead of asserting what
// some version of it once did. Returns null if the plugin is absent or its
// shape has moved, which lands back on the honest "unresolved" warning.
function reactNativePlaceholder(root, key, buildType) {
  const app = readIfExists(path.join(root, 'android', 'app', 'build.gradle'));
  const applied =
    app && /(apply\s+plugin:\s*["']com\.facebook\.react["']|id\s*\(?\s*["']com\.facebook\.react["'])/.test(app);
  if (!applied) return null;

  const src = readIfExists(
    path.join(
      root, 'node_modules', '@react-native', 'gradle-plugin', 'react-native-gradle-plugin',
      'src', 'main', 'kotlin', 'com', 'facebook', 'react', 'utils', 'AgpConfiguratorUtils.kt'
    )
  );
  if (!src) return null;

  const block = src.match(new RegExp(`getByName\\("${buildType}"\\)\\s*\\.apply\\s*\\{[\\s\\S]*?\\n\\s*\\}`));
  if (!block) return null;

  const m = block[0].match(new RegExp(`manifestPlaceholders\\["${key}"\\]\\s*=\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

// Manifest placeholders like ${usesCleartextTraffic} are resolved in Gradle.
// The app's own build.gradle wins; a plugin-injected value is the fallback.
function manifestPlaceholder(root, key, buildType = 'release') {
  const text = readIfExists(path.join(root, 'android', 'app', 'build.gradle'));
  if (text) {
    // Look for the release buildType block and its placeholder assignment.
    const release = text.match(/release\s*\{[\s\S]*?\n\s{4,8}\}/);
    const scopes = [release ? release[0] : '', text];
    for (const scope of scopes) {
      const re = new RegExp(`${key}\\s*:\\s*(true|false|"[^"]*"|'[^']*')`);
      const m = scope.match(re);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return reactNativePlaceholder(root, key, buildType);
}

module.exports = {
  readIfExists,
  gradleValue,
  resolveSdkVersion,
  manifestPath,
  mergedManifestPath,
  permissions,
  applicationAttr,
  services,
  manifestPlaceholder,
};
