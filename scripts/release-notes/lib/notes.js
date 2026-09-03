'use strict';

// Turning a commit range into store copy.
//
// The mechanical half lives here: which store, what its limits are, which
// commits are worth showing a shop owner, and how to lay all that out as a
// brief. The prose half is a judgement call, so it is left to a model — either
// the local `claude` CLI via --generate, or a human pasting the brief.

const STORES = {
  play: {
    key: 'play',
    name: 'Google Play',
    field: "What's new",
    // Play caps the release notes field at 500 characters per language, and
    // silently refuses to save anything longer.
    limit: 500,
    console: 'Play Console > Release > Production > Create new release > Release notes',
    notes: [
      'Hard cap is 500 characters INCLUDING spaces, newlines and bullet characters. This is not a target to fill — it is a wall. Going over means the field will not save.',
      'The limit is per language — write English only unless asked otherwise.',
      'Plain text. No HTML, no markdown headings, no bold.',
      'Play shows roughly the first two lines in the collapsed card, so the most important change has to come first.',
    ],
    style: [
      'Space is the binding constraint. Four to six short lines, one per area of change.',
      'No opening sentence and no sign-off — start on the first real change.',
      'Merge aggressively. Several changes to the same feature are one line.',
      'When it does not fit, cut adjectives and context before you cut a feature.',
      'It is better to leave out the smallest changes than to compress everything into an unreadable list.',
    ],
  },
  ios: {
    key: 'ios',
    name: 'the App Store',
    field: "What's New in This Version",
    limit: 4000,
    console: 'App Store Connect > App > iOS App version > What\'s New in This Version',
    notes: [
      'The cap is 4000 characters — roughly eight times what Play allows. Use the room; a cramped App Store note is a wasted one. Aim for 2500 to 3500 characters, which is full without crowding the cap.',
      'Plain text. No markdown, but blank lines and short section headings read well and are fine.',
      'Apple reviewers read this alongside the build, so anything that changes a permission, a login path or a payment flow is worth stating explicitly.',
    ],
    style: [
      'Be generous and complete. Cover every user-facing change in the list, including the small ones — there is space for all of them.',
      'Open with one or two sentences on what this release is about overall.',
      'Group the changes under short plain headings, e.g. "Old gold purchase", "Advance orders", "Bills and printing", "Smaller fixes". Order the sections by what matters most at the counter.',
      'Under each heading, give a change a full sentence rather than a clipped fragment. Saying what a shop owner can now do, and why it helps, is welcome here.',
      'Warm and readable is right; hype is not. Describe the work, do not sell it.',
    ],
  },
};

// Conventional-commit types and subject shapes that describe work a shop owner
// can never see. They stay in the brief but are marked, so the model can pick up
// a behaviour change hiding under a `build:` prefix instead of blindly dropping it.
const INTERNAL_TYPES = /^(ci|build|chore|test|tests|docs|style|refactor|deps)(\([^)]*\))?!?:/i;
const INTERNAL_SUBJECTS = [
  /^merge\b/i,
  /^revert\b/i,
  /^bump\b/i,
  /version bump/i,
  /^(bump|update) version/i,
  /for play store release$/i,
  /^wip\b/i,
];

function isInternal(commit) {
  if (INTERNAL_TYPES.test(commit.subject)) return true;
  return INTERNAL_SUBJECTS.some((re) => re.test(commit.subject));
}

function classify(commits) {
  const user = [];
  const internal = [];
  for (const c of commits) {
    (isInternal(c) ? internal : user).push(c);
  }
  return { user, internal };
}

// A commit body often carries the "why", which is exactly what store copy needs
// — but bodies also carry trailers and generated footers that only add noise.
const DROP_BODY_LINES = /^(co-authored-by|signed-off-by|refs?|closes?|fixes?|see also|🤖)\b/i;

function bodyLines(commit, max) {
  if (!commit.body) return [];
  return commit.body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !DROP_BODY_LINES.test(l))
    .slice(0, max);
}

function renderCommits(list, { bodyLimit }) {
  return list
    .map((c) => {
      const head = `- ${c.subject}`;
      const extra = bodyLines(c, bodyLimit).map((l) => `    ${l}`);
      return [head, ...extra].join('\n');
    })
    .join('\n');
}

function buildPrompt(ctx, store) {
  const { user, internal } = classify(ctx.commits);
  const bodyLimit = store.limit >= 4000 ? 4 : 2;

  const lines = [];
  lines.push(
    `Write the "${store.field}" release notes for ${ctx.appName}, for ${store.name}.`,
    '',
    `${ctx.appName} is a billing app for Indian gold and silver jewellery shops. The people`,
    'reading these notes are shop owners and their counter staff, not developers. They',
    'care about what they can now do at the counter.',
    '',
    `Version: ${ctx.version}`,
  );
  if (ctx.previousVersion) lines.push(`Previous released version: ${ctx.previousVersion}`);
  lines.push(
    `Commit range: ${ctx.range} (${ctx.commits.length} commits, ${ctx.dateFrom} to ${ctx.dateTo})`,
    '',
    `${store.name.toUpperCase()} RULES`,
    ...store.notes.map((n) => `- ${n}`),
    '',
    'HOW TO WRITE IT',
    ...store.style.map((n) => `- ${n}`),
    '',
    'ALWAYS',
    '- Describe changes in the user\'s words, never the codebase\'s. No file names,',
    '  screen or class names, package names, commit hashes or ticket ids.',
    '- Do not invent anything that is not in the commits below, and do not promise',
    '  anything the commits do not deliver.',
    '- No emoji, no "we are excited to", no version numbers in the body.',
    '- Order by how much it matters to a shop owner, biggest first.',
    '',
    'OUTPUT',
    `- Output only the release note text, ready to paste into ${store.name}. No`,
    '  preamble, no explanation, no code fence, no character count.',
    `- Stay under ${store.limit} characters. Count them before answering.`,
    '',
    `USER-FACING COMMITS (${user.length})`,
    user.length ? renderCommits(user, { bodyLimit }) : '(none)',
  );

  if (internal.length) {
    lines.push(
      '',
      `INTERNAL COMMITS (${internal.length}) — exclude these unless one clearly changes`,
      'what a user sees, in which case describe the user-visible part only.',
      renderCommits(internal, { bodyLimit: 0 }),
    );
  }

  return lines.join('\n');
}

// Character counting is the one part of this that must not be left to judgement:
// both stores reject silently or truncate, and it costs a round trip to find out.
function checkLength(text, store) {
  const body = text.replace(/\s+$/, '');
  return {
    length: body.length,
    limit: store.limit,
    over: Math.max(0, body.length - store.limit),
    ok: body.length <= store.limit,
  };
}

module.exports = { STORES, classify, isInternal, buildPrompt, checkLength, renderCommits };
