'use strict';

// A small XML-plist reader.
//
// The obvious implementation shells out to `plutil`, but that only exists on
// macOS and the Android side of this tool has to run on Windows. So we parse the
// XML ourselves. RN and Expo both emit plain XML plists, never the binary form.
//
// Note for anyone tempted to go back to plutil: `plutil -extract KEY json FILE`
// WRITES BACK to FILE and destroys it. If you ever reintroduce it, it must be
// `plutil -extract KEY json -o - FILE`.

const fs = require('fs');

// Strip comments and the doctype so the tag walker below doesn't trip on them.
function clean(xml) {
  return xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[\s\S]*?>/g, '');
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&'); // last, so &amp;lt; survives as &lt;
}

// Tokenise into tags and text, then build the value tree. Plist is a simple
// enough grammar that a full XML parser would be more machinery than it earns.
function tokenize(xml) {
  const tokens = [];
  const re = /<\/?([A-Za-z]+)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) {
      const selfClosing = m[2] === '/';
      const closing = m[0][1] === '/';
      tokens.push({ type: closing ? 'close' : 'open', name: m[1], selfClosing });
    } else if (m[3] && m[3].trim()) {
      tokens.push({ type: 'text', value: m[3] });
    }
  }
  return tokens;
}

function parseTokens(tokens, start) {
  // Returns [value, nextIndex] for the element opening at `start`.
  const open = tokens[start];
  const tag = open.name;

  if (open.selfClosing) {
    if (tag === 'true') return [true, start + 1];
    if (tag === 'false') return [false, start + 1];
    if (tag === 'dict') return [{}, start + 1];
    if (tag === 'array') return [[], start + 1];
    return [null, start + 1];
  }

  let i = start + 1;

  if (tag === 'dict') {
    const out = {};
    let pendingKey = null;
    while (i < tokens.length && !(tokens[i].type === 'close' && tokens[i].name === 'dict')) {
      const t = tokens[i];
      if (t.type === 'open' && t.name === 'key') {
        // <key>NAME</key>
        const textTok = tokens[i + 1];
        pendingKey = textTok && textTok.type === 'text' ? decodeEntities(textTok.value).trim() : '';
        i = textTok && textTok.type === 'text' ? i + 3 : i + 2;
      } else if (t.type === 'open') {
        const [val, next] = parseTokens(tokens, i);
        if (pendingKey !== null) out[pendingKey] = val;
        pendingKey = null;
        i = next;
      } else {
        i += 1;
      }
    }
    return [out, i + 1];
  }

  if (tag === 'array') {
    const out = [];
    while (i < tokens.length && !(tokens[i].type === 'close' && tokens[i].name === 'array')) {
      if (tokens[i].type === 'open') {
        const [val, next] = parseTokens(tokens, i);
        out.push(val);
        i = next;
      } else {
        i += 1;
      }
    }
    return [out, i + 1];
  }

  // Scalar: <string>x</string>, <integer>3</integer>, <true/> handled above.
  let text = '';
  while (i < tokens.length && !(tokens[i].type === 'close' && tokens[i].name === tag)) {
    if (tokens[i].type === 'text') text += tokens[i].value;
    i += 1;
  }
  const raw = decodeEntities(text);
  if (tag === 'integer') return [parseInt(raw.trim(), 10), i + 1];
  if (tag === 'real') return [parseFloat(raw.trim()), i + 1];
  if (tag === 'true') return [true, i + 1];
  if (tag === 'false') return [false, i + 1];
  return [raw, i + 1];
}

function parse(xml) {
  const tokens = tokenize(clean(xml));
  const plistIdx = tokens.findIndex((t) => t.type === 'open' && t.name === 'plist');
  const rootIdx = tokens.findIndex(
    (t, idx) => idx > plistIdx && t.type === 'open' && (t.name === 'dict' || t.name === 'array')
  );
  if (rootIdx === -1) return {};
  return parseTokens(tokens, rootIdx)[0];
}

function read(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return null;
  }
}

module.exports = { parse, read };
