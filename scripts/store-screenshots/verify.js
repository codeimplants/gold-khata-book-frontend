// Checks the store images before upload: each one is the exact size its store
// asks for, and none of them is byte-identical to a file in the SoneBill
// checkout (the 4.3(a) rejection included SoneBill's screenshots).
//
//   node verify.js [path/to/sonebill-frontend]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const SONEBILL = path.resolve(process.argv[2] || path.join(ROOT, '../../sonebill/sonebill-frontend'));
const EXPECT = {
  'ios/iphone-6.9': [1320, 2868],
  'ios/ipad-13': [2064, 2752],
  'android/phone': [1080, 1920],
  'android/tablet-10': [1600, 2560],
  'android/tablet-7': [1200, 1920],
};

const jpegSize = buf => {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
};
const md5 = buf => crypto.createHash('md5').update(buf).digest('hex');

const soneHashes = new Set();
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const f of fs.readdirSync(d)) {
    if (f === 'node_modules' || f === '.git') continue;
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(png|jpe?g)$/i.test(f)) soneHashes.add(md5(fs.readFileSync(p)));
  }
})(SONEBILL);

let problems = 0;
for (const [dir, [w, h]] of Object.entries(EXPECT)) {
  const full = path.join(ROOT, 'store-assets', 'screenshots', dir);
  const files = fs.existsSync(full) ? fs.readdirSync(full).filter(f => /\.(png|jpe?g)$/i.test(f)) : [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(full, f));
    const size = /\.jpe?g$/i.test(f) ? jpegSize(buf) : [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    const okSize = size && size[0] === w && size[1] === h;
    const fromSone = soneHashes.has(md5(buf));
    if (!okSize || fromSone) problems++;
    console.log(`${okSize && !fromSone ? 'ok ' : 'BAD'} ${dir}/${f} ${size ? size.join('x') : '?'}${fromSone ? '  IDENTICAL TO A SONEBILL FILE' : ''}`);
  }
  if (!files.length) { problems++; console.log(`BAD ${dir}: no images`); }
}
console.log(`compared against ${soneHashes.size} images in ${SONEBILL}`);
console.log(problems ? `${problems} problem(s)` : 'all store images pass');
process.exitCode = problems ? 1 : 0;
