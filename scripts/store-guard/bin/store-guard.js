#!/usr/bin/env node
'use strict';

// store-guard — check an app against App Store and Play Store requirements
// before a build goes out.
//
//   store-guard check                 both stores, fail the build on violations
//   store-guard check --platform ios  only App Store rules
//   store-guard check --warn          report everything, always exit 0
//   store-guard attest                answer the manual gates that are actually due
//   store-guard attest --platform ios only the App Store gates
//   store-guard attest --all          also re-answer gates still carried forward
//   store-guard attestations          what is carried forward, and until when
//   store-guard rules                 print the reference catalog
//   store-guard init                  write a starter store-guard.config.json
//
// Exit codes: 0 clean, 1 violations or unattested manual gates, 2 bad usage.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const configLib = require('../lib/config');
const engine = require('../lib/engine');
const attest = require('../lib/attest');
const validity = require('../lib/validity');
const { colors } = require('../lib/report');
const { cyan, dim, red, yellow, green } = colors;

function parseArgs(argv) {
  const args = {
    command: 'check', platform: 'all', warn: false, json: false,
    verbose: false, manual: true, id: null, yes: true, note: null, all: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--platform') { args.platform = argv[++i]; }
    else if (a === '--all') { args.all = true; }
    else if (a === '--ios') { args.platform = 'ios'; }
    else if (a === '--android') { args.platform = 'android'; }
    else if (a === '--warn') { args.warn = true; }
    else if (a === '--json') { args.json = true; }
    else if (a === '--verbose' || a === '-v') { args.verbose = true; }
    else if (a === '--no-manual') { args.manual = false; }
    else if (a === '--id') { args.id = argv[++i]; }
    else if (a === '--yes') { args.yes = true; }
    else if (a === '--no') { args.yes = false; }
    else if (a === '--note') { args.note = argv[++i]; }
    else if (a === '-h' || a === '--help') { args.command = 'help'; }
    else if (!a.startsWith('-')) { rest.push(a); }
    else { console.error(`Unknown option: ${a}`); process.exit(2); }
  }
  if (rest.length) args.command = rest[0];
  if (!['ios', 'android', 'all'].includes(args.platform)) {
    console.error(`--platform must be ios, android or all`);
    process.exit(2);
  }
  return args;
}

function help() {
  process.stdout.write(fs.readFileSync(__filename, 'utf8')
    .split('\n')
    .slice(2, 18)
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n') + '\n');
}

function cmdRules() {
  const catalog = engine.loadCatalog();
  process.stdout.write(
    `${cyan('store-guard reference catalog')} v${catalog.catalogVersion}  ` +
    `${dim(`(guidelines last reviewed ${catalog.reviewed})`)}\n`
  );
  const label = { apple: 'APP STORE', play: 'GOOGLE PLAY', both: 'BOTH STORES' };
  for (const store of ['apple', 'play', 'both']) {
    const rules = catalog.rules.filter((r) => r.store === store);
    process.stdout.write(`\n${cyan(label[store])}  ${dim(`${rules.length} rules`)}\n`);
    for (const r of rules) {
      const mode = r.mode === 'auto' ? green('auto') : yellow('manual');
      const sev = r.severity === 'fail' ? red('fail') : yellow('warn');
      process.stdout.write(`  ${mode} ${sev}  ${r.title}  ${dim(`[${r.ref}]`)}\n`);
      process.stdout.write(`         ${dim(r.requires)}\n`);
      // For a manual gate, when it comes back is as much a part of the rule as
      // what it asks — it is the difference between a check and a ritual.
      if (r.mode === 'manual') {
        process.stdout.write(`         ${dim(`↻ ${validity.describePolicy(r)}`)}\n`);
      }
    }
  }
  process.stdout.write(`\n${dim('Sources:')}\n`);
  for (const s of catalog.sources) process.stdout.write(`  ${dim(`${s.title} — ${s.url}`)}\n`);
}

function cmdInit(root) {
  const target = path.join(root, 'store-guard.config.json');
  if (fs.existsSync(target)) {
    console.error(`${target} already exists — not overwriting.`);
    process.exit(2);
  }
  const example = path.join(__dirname, '..', 'store-guard.config.example.json');
  fs.copyFileSync(example, target);
  process.stdout.write(`Wrote ${target}\nEdit the profile flags, then run: npx store-guard check\n`);
}

// Everything an attestation needs to be carried forward later: the answer, and
// the fingerprint of what the answer was believed to depend on.
function recordAttestation(root, ctx, rule, { confirmed, note }) {
  return attest.record(root, ctx.version, rule.id, {
    confirmed,
    note,
    signals: validity.fingerprint(ctx, validity.policyOf(rule).signals),
  });
}

async function cmdAttest(root, args) {
  const cfg = configLib.load(root);
  const { report, ctx } = engine.run(cfg, { platform: args.platform });

  // Normally only the gates that are actually due. `--all` re-opens the ones
  // still carried forward, for when you know something changed that no
  // fingerprint covers (a listing edited by hand, a support URL retired).
  const outstanding = args.all
    ? report.results.filter((r) => r.rule.mode === 'manual' && r.status !== 'skip')
    : report.results.filter((r) => r.status === 'manual');

  // Scriptable form: attest one rule by id. Exists so a release runbook can
  // record a decision without a human at a prompt — but note that attesting
  // something nobody looked at is exactly the failure this tool is meant to
  // prevent, so keep it for automation that genuinely did the check.
  if (args.id) {
    const rule = engine.loadCatalog().rules.find((r) => r.id === args.id);
    if (!rule) {
      console.error(`No such rule: ${args.id}`);
      return 2;
    }
    if (rule.mode !== 'manual') {
      console.error(`${args.id} is an automatic check — it cannot be attested.`);
      return 2;
    }
    const rec = recordAttestation(root, ctx, rule, { confirmed: args.yes, note: args.note });
    process.stdout.write(
      `${rec.confirmed ? green('confirmed') : red('NOT confirmed')} ${rule.id} for ${ctx.version}\n`
    );
    return 0;
  }

  if (!outstanding.length) {
    process.stdout.write(
      `${green('Nothing due')} — every manual gate for ${ctx.version} is attested or still valid.\n` +
      `${dim('`store-guard attestations` shows what is carried forward and why; `attest --all` re-opens them.')}\n`
    );
    return 0;
  }

  // Attestation is a person confirming they looked at a store console. Doing it
  // from a pipe would mean rubber-stamping, so require a real terminal and point
  // at the scriptable form otherwise.
  if (!process.stdin.isTTY) {
    console.error(
      `${red('attest needs an interactive terminal.')}\n` +
      `${outstanding.length} gate(s) outstanding for ${ctx.version}.\n` +
      `For automation use: store-guard attest --id <rule-id> --yes --note "..."\n` +
      `Outstanding ids:\n${outstanding.map((r) => `  ${r.rule.id}`).join('\n')}`
    );
    return 2;
  }

  process.stdout.write(
    `${cyan(`${outstanding.length} manual gate(s) due for version ${ctx.version}`)}\n` +
    `${dim('These cannot be read from the repo. Check each one in the store console.')}\n` +
    `${dim('Each says why it is being asked. Answers carry forward to later releases until')}\n` +
    `${dim('what they depend on changes, so anything asked here is genuinely unanswered.')}\n`
  );

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let aborted = false;
  rl.on('close', () => { aborted = true; });
  // Resolves null on EOF rather than hanging, so a closed stdin ends the loop
  // instead of spinning on an answer that will never arrive.
  const ask = (q) => new Promise((res) => {
    if (aborted) return res(null);
    rl.question(q, (a) => res(a));
  });

  for (const r of outstanding) {
    if (aborted) break;
    const rule = r.rule;
    const why = validity.evaluate(rule, ctx, attest.load(root));
    process.stdout.write(`\n${cyan(rule.title)} ${dim(`[${rule.ref}]`)}\n`);
    // Why this one is back is the part that keeps the answer honest. A question
    // that arrives with "Android permissions changed since 1.0.14" gets read; the
    // same question arriving unchanged every release gets a reflex "y".
    process.stdout.write(`  ${yellow(`asked because: ${why.message}`)}\n`);
    process.stdout.write(`  ${rule.prompt}\n`);
    process.stdout.write(`  ${dim(rule.url)}\n`);
    process.stdout.write(`  ${dim(`↻ ${validity.describePolicy(rule)}`)}\n`);

    let answer = null;
    for (let tries = 0; tries < 5; tries += 1) {
      const raw = await ask('  confirmed? [y]es / [n]o / [s]kip: ');
      if (raw === null) { aborted = true; break; }
      const ch = raw.trim().toLowerCase().charAt(0);
      if (['y', 'n', 's'].includes(ch)) { answer = ch; break; }
    }
    if (aborted || answer === null || answer === 's') continue;

    const note = (await ask('  note (optional): ')) || '';
    recordAttestation(root, ctx, rule, { confirmed: answer === 'y', note: note.trim() });
  }

  rl.close();
  const done = Object.keys((attest.load(root)[ctx.version] || {})).length;
  process.stdout.write(`\n${done} attestation(s) recorded for ${ctx.version} in ${path.relative(root, attest.file(root))}\n`);
  return 0;
}

// What is currently holding each manual gate up, and when it comes back. The
// answer to "why did it not ask me about screenshots this time" has to be
// inspectable, or carrying answers forward is just a quieter rubber stamp.
function cmdAttestations(root, args) {
  const cfg = configLib.load(root);
  const { report, ctx } = engine.run(cfg, { platform: args.platform });
  const rows = report.results.filter((r) => r.rule.mode === 'manual');
  const all = attest.load(root);

  process.stdout.write(
    `${cyan('store-guard attestations')}  ${cfg.app.name || path.basename(root)}  ` +
    `${dim(`version ${ctx.version} · ${args.platform}`)}\n`
  );

  const label = { apple: 'APP STORE', play: 'GOOGLE PLAY', both: 'BOTH STORES' };
  for (const store of ['apple', 'play', 'both']) {
    const forStore = rows.filter((r) => r.rule.store === store);
    if (!forStore.length) continue;
    process.stdout.write(`\n${cyan(label[store])}\n`);
    for (const r of forStore) {
      if (r.status === 'skip') {
        process.stdout.write(`  ${dim('–')} ${dim(`${r.rule.title} — ${r.message}`)}\n`);
        continue;
      }
      // Ask validity directly rather than unpicking the rendered message — this
      // view exists to show the reasoning, so it should read it at the source.
      const v = validity.evaluate(r.rule, ctx, all);
      const mark = v.state === 'valid' ? green('✓') : v.state === 'ask' ? yellow('?') : red('✗');
      process.stdout.write(`  ${mark} ${r.rule.title}\n`);
      process.stdout.write(`      ${dim(v.message)}\n`);
      process.stdout.write(`      ${dim(`↻ ${validity.describePolicy(r.rule)}`)}\n`);
    }
  }

  const due = rows.filter((r) => r.status === 'manual').length;
  process.stdout.write(`\n${cyan('─'.repeat(60))}\n`);
  process.stdout.write(
    due
      ? `${yellow(`${due} gate(s) due`)} — run \`store-guard attest\`.\n`
      : `${green('Nothing due.')} Run \`store-guard attest --all\` to re-answer a carried-forward gate anyway.\n`
  );
  return 0;
}

function cmdCheck(root, args) {
  let cfg;
  try {
    cfg = configLib.load(root);
  } catch (err) {
    console.error(`${red(err.message)}`);
    process.exit(2);
  }

  const { report, ctx } = engine.run(cfg, { platform: args.platform, includeManual: args.manual });

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ version: ctx.version, platform: args.platform, ...report.toJSON() }, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${cyan('store-guard')}  ${cfg.app.name || path.basename(root)}  ` +
      `${dim(`version ${ctx.version} · ${args.platform} · manifest: ${ctx.manifestSource}`)}\n`
    );
    report.render({ verbose: args.verbose });
  }

  if (args.warn) return 0;
  return report.failed ? 1 : 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();

  if (args.command === 'help') return help(), 0;
  if (args.command === 'rules') return cmdRules(), 0;
  if (args.command === 'init') return cmdInit(root), 0;
  if (args.command === 'attest') return cmdAttest(root, args);
  if (args.command === 'attestations') return cmdAttestations(root, args);
  if (args.command === 'check') return cmdCheck(root, args);

  console.error(`Unknown command: ${args.command}`);
  return 2;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err.stack || err.message);
  process.exit(2);
});
