#!/usr/bin/env node
'use strict';

// release-notes — turn the commits since the last release into store copy.
//
//   release-notes                       what shipped since the last release
//   release-notes --platform play       Play Store brief (500 char cap)
//   release-notes --platform ios        App Store brief (4000 char cap)
//   release-notes --generate            write the notes with the local claude CLI
//   release-notes --from <ref>          start from a ref instead of the last bump
//   release-notes --to <ref>            end somewhere other than HEAD
//   release-notes --commits             just the commit range, no brief
//   release-notes --check <file>        count a written note against the cap
//   release-notes --json                machine-readable range + classification
//
// With no --from, the range starts at the commit that set the previous version
// (a release tag wins if the repo has one). See lib/version.js.
//
// Exit codes: 0 clean, 1 nothing to report or a note over the cap, 2 bad usage.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const git = require('../lib/git');
const version = require('../lib/version');
const notes = require('../lib/notes');
const { STORES } = notes;

const colors = process.stdout.isTTY && !process.env.NO_COLOR
  ? {
    cyan: (s) => `[36m${s}[0m`,
    dim: (s) => `[2m${s}[0m`,
    red: (s) => `[31m${s}[0m`,
    green: (s) => `[32m${s}[0m`,
    yellow: (s) => `[33m${s}[0m`,
  }
  : new Proxy({}, { get: () => (s) => s });
const { cyan, dim, red, green, yellow } = colors;

function parseArgs(argv) {
  const args = {
    platform: null, from: null, to: 'HEAD', generate: false,
    commitsOnly: false, check: null, json: false, out: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--platform') args.platform = argv[++i];
    else if (a === '--play' || a === '--android') args.platform = 'play';
    else if (a === '--ios' || a === '--appstore') args.platform = 'ios';
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--to') args.to = argv[++i];
    else if (a === '--generate' || a === '-g') args.generate = true;
    else if (a === '--commits') args.commitsOnly = true;
    else if (a === '--check') args.check = argv[++i];
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else { console.error(`Unknown option: ${a}`); process.exit(2); }
  }
  if (args.platform && !STORES[args.platform]) {
    console.error(`--platform must be play or ios (got ${args.platform})`);
    process.exit(2);
  }
  return args;
}

function help() {
  process.stdout.write(fs.readFileSync(__filename, 'utf8')
    .split('\n')
    .slice(3, 19)
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n') + '\n');
}

function repoRoot() {
  const out = git.tryGit(process.cwd(), ['rev-parse', '--show-toplevel']);
  if (!out) {
    console.error(red('Not a git repository — release-notes reads history to find the range.'));
    process.exit(2);
  }
  return out.trim();
}

// The version manifest that defines the range depends on the store being asked
// about; with no --platform we key off Android, which is where this app's
// releases are cut first.
function buildContext(root, args) {
  const platform = args.platform === 'ios' ? 'ios' : 'android';
  const toSha = git.resolve(root, args.to);
  if (!toSha) {
    console.error(red(`--to ${args.to} is not a commit this repo knows about.`));
    process.exit(2);
  }

  const baseline = version.findBaseline(root, { to: args.to, platform, from: args.from });
  if (!baseline) {
    console.error(
      `${red('Could not find a previous release to compare against.')}\n` +
      `No release tag, and no earlier version in ${platform === 'ios' ? 'the Xcode project' : 'android/app/build.gradle'}.\n` +
      `Pass one explicitly: release-notes --from <ref>`
    );
    process.exit(2);
  }

  const commits = git.commits(root, baseline.sha, args.to);
  const current = version.currentVersion(root, args.to, platform);

  // Only meaningful when we inferred the baseline; an explicit --from is the
  // caller already having answered the question.
  const manifest = version.manifestFor(root, platform);
  const currentBump = args.from || !manifest
    ? null
    : version.currentBumpCommit(root, args.to, manifest);

  return {
    currentBump: currentBump && currentBump !== baseline.sha ? currentBump.slice(0, 7) : null,
    root,
    appName: appName(root),
    platform,
    range: `${baseline.ref}..${args.to}`,
    baseline,
    commits,
    version: version.label(current),
    previousVersion: baseline.version ? version.label(baseline.version) : null,
    dateFrom: git.shortDate(root, baseline.sha),
    dateTo: git.shortDate(root, args.to),
  };
}

function appName(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    // package.json names are slugs; the app's display name is the useful one.
    const appJson = path.join(root, 'app.json');
    if (fs.existsSync(appJson)) {
      const app = JSON.parse(fs.readFileSync(appJson, 'utf8'));
      if (app.displayName) return app.displayName;
    }
    return pkg.name || path.basename(root);
  } catch (err) {
    return path.basename(root);
  }
}

// Git records the version bump but not the upload, so the range rests on an
// assumption worth stating out loud rather than burying.
function shippedHint(ctx) {
  if (!ctx.currentBump) return '';
  return `${yellow('Assuming')} ${ctx.version} has not been uploaded yet. If it has, the range is too\n` +
    `wide — start where it was set instead: ${cyan(`--from ${ctx.currentBump}`)}\n\n`;
}

function printSummary(ctx) {
  const { user, internal } = notes.classify(ctx.commits);
  const how = {
    explicit: 'from --from',
    tag: 'from release tag',
    'version-bump': 'from the previous version bump',
  }[ctx.baseline.source];

  process.stdout.write(
    `${cyan('release-notes')}  ${ctx.appName}  ${dim(`${ctx.version} · ${ctx.platform}`)}\n` +
    `${dim(`${ctx.range}  ${how}  ${ctx.dateFrom} → ${ctx.dateTo}`)}\n\n` +
    `${ctx.commits.length} commits — ${green(`${user.length} user-facing`)}, ${dim(`${internal.length} internal`)}\n\n`
  );
  process.stdout.write(shippedHint(ctx));
  for (const c of user) process.stdout.write(`  ${dim(c.short)}  ${c.subject}\n`);
  if (internal.length) {
    process.stdout.write(`\n${dim('internal:')}\n`);
    for (const c of internal) process.stdout.write(`  ${dim(`${c.short}  ${c.subject}`)}\n`);
  }
}

// --generate shells out to the Claude Code CLI the developer already has
// installed, so this needs no API key of its own.
function claude(prompt) {
  const bin = process.env.CLAUDE_BIN || 'claude';
  // The brief goes in on stdin, not argv: it runs to tens of kilobytes on a
  // busy release and Windows caps a command line at 8191 characters.
  const opts = { input: prompt, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 };
  let res = spawnSync(bin, ['-p'], opts);
  // A .cmd/.ps1 shim on PATH is not directly executable; retry through the shell.
  if (res.error && res.error.code === 'ENOENT' && process.platform === 'win32') {
    res = spawnSync(bin, ['-p'], { ...opts, shell: true });
  }

  if (res.error && res.error.code === 'ENOENT') {
    console.error(
      `${red(`--generate needs the '${bin}' CLI on PATH.`)}\n` +
      `Install Claude Code, or drop --generate and paste the brief into any model.\n` +
      `Set CLAUDE_BIN to point at a different binary.`
    );
    process.exit(2);
  }
  if (res.status !== 0) {
    console.error(`${red(`${bin} exited ${res.status}`)}\n${res.stderr || ''}`);
    process.exit(2);
  }

  // Models like to wrap output in a fence even when told not to.
  let text = (res.stdout || '').trim();
  const fence = text.match(/^```[a-z]*\n([\s\S]*?)\n```$/);
  if (fence) text = fence[1].trim();
  return text;
}

// Character budgets are the one thing a model is reliably bad at hitting first
// try, and the one thing the store enforces absolutely. Rather than hand back
// something that cannot be pasted, show it the overage and let it cut.
const TRIM_ATTEMPTS = 2;

function generate(prompt, store) {
  let text = claude(prompt);
  let check = notes.checkLength(text, store);

  for (let i = 0; i < TRIM_ATTEMPTS && !check.ok; i += 1) {
    process.stderr.write(
      `${dim(`${check.length}/${check.limit} characters — asking for a trim (${i + 1}/${TRIM_ATTEMPTS})…`)}\n`
    );
    text = claude([
      prompt,
      '',
      'You already produced this draft:',
      '',
      text,
      '',
      `That draft is ${check.length} characters. The hard cap is ${check.limit}, so it`,
      `must lose at least ${check.over} characters.`,
      'Rewrite it to fit. Keep the structure and the most important changes; cut the',
      'least important details, then tighten the wording. Do not drop a whole section',
      'if trimming sentences is enough. Output only the rewritten note.',
    ].join('\n'));
    check = notes.checkLength(text, store);
  }

  return { text, check };
}

function reportLength(check, store, label) {
  const line = `${label}: ${check.length}/${check.limit} characters`;
  if (check.ok) {
    process.stderr.write(`${green('OK')}  ${line}\n`);
    return 0;
  }
  process.stderr.write(`${red('OVER')}  ${line} — ${check.over} too many for ${store.name}\n`);
  return 1;
}

function cmdCheck(args) {
  const file = args.check;
  const text = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
  const stores = args.platform ? [STORES[args.platform]] : Object.values(STORES);
  let code = 0;
  for (const store of stores) {
    code = reportLength(notes.checkLength(text, store), store, store.name) || code;
  }
  return code;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return 0;
  }
  if (args.check) return cmdCheck(args);

  const root = repoRoot();
  const ctx = buildContext(root, args);

  if (args.json) {
    const { user, internal } = notes.classify(ctx.commits);
    process.stdout.write(`${JSON.stringify({
      app: ctx.appName,
      platform: ctx.platform,
      version: ctx.version,
      previousVersion: ctx.previousVersion,
      range: ctx.range,
      baseline: ctx.baseline,
      dateFrom: ctx.dateFrom,
      dateTo: ctx.dateTo,
      userFacing: user,
      internal,
    }, null, 2)}\n`);
    return 0;
  }

  if (!ctx.commits.length) {
    process.stderr.write(`${yellow('Nothing to release')} — no commits in ${ctx.range}.\n`);
    return 1;
  }

  if (args.commitsOnly || (!args.platform && !args.generate)) {
    printSummary(ctx);
    if (!args.platform) {
      process.stderr.write(
        `\n${dim('Add --platform play or --platform ios for a store brief, and --generate to write it.')}\n`
      );
    }
    return 0;
  }

  const store = STORES[args.platform || 'play'];
  const prompt = notes.buildPrompt(ctx, store);

  if (!args.generate) {
    process.stdout.write(`${prompt}\n`);
    process.stderr.write(`\n${dim(`Brief for ${store.name} (${store.limit} char cap). Paste it into a model, or re-run with --generate.`)}\n`);
    return 0;
  }

  process.stderr.write(shippedHint(ctx));
  process.stderr.write(`${dim(`Writing ${store.name} notes for ${ctx.version} from ${ctx.commits.length} commits…`)}\n`);
  const { text, check } = generate(prompt, store);

  if (args.out) {
    fs.writeFileSync(args.out, `${text}\n`, 'utf8');
    process.stderr.write(`${dim(`Wrote ${args.out}`)}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }

  process.stderr.write(`\n${dim(store.console)}\n`);
  return reportLength(check, store, store.name);
}

process.exit(main());
