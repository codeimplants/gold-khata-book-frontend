'use strict';

// Result collection and rendering.
//
// The distinction that matters: a FAIL is something a store will reject or
// refuse to accept. A WARN needs human judgement — it cannot be decided from the
// files alone, so it is surfaced rather than guessed at.

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `[${code}m${s}[0m` : s);
const red = c('0;31');
const green = c('0;32');
const yellow = c('1;33');
const cyan = c('0;36');
const dim = c('2');

const PASS = 'pass';
const FAIL = 'fail';
const WARN = 'warn';
const SKIP = 'skip';
const MANUAL = 'manual';

class Report {
  constructor() {
    this.results = [];
  }

  add(rule, status, message, detail) {
    this.results.push({ rule, status, message, detail: detail || null });
  }

  pass(rule, message) {
    this.add(rule, PASS, message);
  }

  // A rule's declared severity decides whether a violation blocks. This is why
  // the catalog carries `severity` rather than each check hardcoding it.
  violation(rule, message, detail) {
    this.add(rule, rule.severity === 'warn' ? WARN : FAIL, message, detail);
  }

  warn(rule, message, detail) {
    this.add(rule, WARN, message, detail);
  }

  skip(rule, message) {
    this.add(rule, SKIP, message);
  }

  manual(rule, message, detail) {
    this.add(rule, MANUAL, message, detail);
  }

  counts() {
    const n = { pass: 0, fail: 0, warn: 0, skip: 0, manual: 0 };
    for (const r of this.results) n[r.status] += 1;
    return n;
  }

  get failed() {
    return this.results.some((r) => r.status === FAIL || r.status === MANUAL);
  }

  render({ verbose = false } = {}) {
    const byStore = { apple: [], play: [], both: [] };
    for (const r of this.results) byStore[r.rule.store].push(r);

    const label = { apple: 'APP STORE', play: 'GOOGLE PLAY', both: 'BOTH STORES' };

    for (const store of ['apple', 'play', 'both']) {
      const rows = byStore[store].filter((r) => verbose || r.status !== SKIP);
      if (!rows.length) continue;
      process.stdout.write(`\n${cyan(label[store])}\n`);
      for (const r of rows) {
        const ref = dim(`[${r.rule.ref}]`);
        if (r.status === PASS) {
          process.stdout.write(`  ${green('✓')} ${r.message} ${ref}\n`);
        } else if (r.status === FAIL) {
          process.stdout.write(`  ${red('✗')} ${red(r.message)} ${ref}\n`);
        } else if (r.status === WARN) {
          process.stdout.write(`  ${yellow('!')} ${r.message} ${ref}\n`);
        } else if (r.status === MANUAL) {
          process.stdout.write(`  ${yellow('?')} ${r.message} ${ref}\n`);
        } else {
          process.stdout.write(`  ${dim('–')} ${dim(r.message)} ${ref}\n`);
        }
        if (r.detail) {
          for (const line of String(r.detail).split('\n')) {
            process.stdout.write(`      ${dim(line)}\n`);
          }
        }
        // A failure is only actionable if you can read the rule behind it.
        if (r.status === FAIL || r.status === MANUAL) {
          process.stdout.write(`      ${dim(r.rule.requires)}\n`);
          process.stdout.write(`      ${dim(r.rule.url)}\n`);
        }
      }
    }

    const n = this.counts();
    process.stdout.write(`\n${cyan('─'.repeat(60))}\n`);
    const parts = [
      `${n.pass} passed`,
      n.fail ? red(`${n.fail} failed`) : '0 failed',
      n.warn ? yellow(`${n.warn} warnings`) : '0 warnings',
      n.manual ? yellow(`${n.manual} unattested`) : '0 unattested',
    ];
    if (n.skip) parts.push(dim(`${n.skip} not applicable`));
    process.stdout.write(`${parts.join('  ·  ')}\n`);

    if (n.fail) {
      process.stdout.write(`${red('Each failure above is something a store will reject or refuse to accept.')}\n`);
    }
    if (n.manual) {
      process.stdout.write(
        `${yellow('Unattested items are store-console or judgement checks that cannot be read from the repo.')}\n` +
          `${dim('Each one says why it is being asked — a previous answer either expired or no longer applies.')}\n` +
          `${dim('Run `store-guard attest` to work through them, or `store-guard attestations` to see what is carried forward.')}\n`
      );
    }
  }

  toJSON() {
    return {
      counts: this.counts(),
      results: this.results.map((r) => ({
        id: r.rule.id,
        store: r.rule.store,
        ref: r.rule.ref,
        title: r.rule.title,
        status: r.status,
        message: r.message,
        detail: r.detail,
        url: r.rule.url,
      })),
    };
  }
}

module.exports = { Report, PASS, FAIL, WARN, SKIP, MANUAL, colors: { red, green, yellow, cyan, dim } };
