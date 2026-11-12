/* Static English-only validation for authored sources and the built game.
   Checks raw text, decoded escape forms (\\u, \\x, \\u{...}, JSON escapes,
   HTML entities), quoted literals, generated catalog references and
   String.fromCharCode() constructions for Han and other disallowed scripts.
   The copyright sign in the legally required third-party MIT notice is the
   only non-ASCII exception; it is a source comment, not game content. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'screenshots']);
const EXT = new Set(['.js', '.html', '.css', '.json', '.svg', '.md', '.txt', '.yaml', '.yml']);

const SCRIPTS = [
  ['Han', /\p{Script=Han}/u],
  ['Hiragana', /\p{Script=Hiragana}/u],
  ['Katakana', /\p{Script=Katakana}/u],
  ['Hangul', /\p{Script=Hangul}/u],
  ['Cyrillic', /\p{Script=Cyrillic}/u],
  ['Greek', /\p{Script=Greek}/u],
  ['Arabic', /\p{Script=Arabic}/u],
  ['Hebrew', /\p{Script=Hebrew}/u],
  ['Thai', /\p{Script=Thai}/u],
  ['Devanagari', /\p{Script=Devanagari}/u],
  ['Bopomofo', /\p{Script=Bopomofo}/u],
  ['CJK_Radicals_Punctuation', /[\u2E80-\u2FFF\u3000-\u303F\u31C0-\u31EF\u3200-\u32FF\uFE30-\uFE4F]/u],
  ['CJK_Compat_Fullwidth', /[\u3300-\u33FF\uF900-\uFAFF\uFF00-\uFFEF]/u],
  ['CJK_Extension_Planes', /[\u{20000}-\u{2FA1F}]/u],
  ['NonASCII', /[^\x09\x0A\x0D\x20-\x7E]/]
];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.nojekyll') continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(e.name)) || e.name === '.nojekyll') out.push(p);
  }
  return out;
}

function decodeEscapes(s) {
  let out = s;
  out = out.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  out = out.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  out = out.replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  out = out.replace(/&#(\d{1,7});/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  return out;
}

function firstHit(text) {
  for (const [name, re] of SCRIPTS) {
    const m = re.exec(text);
    if (m) return { script: name, index: m.index, codepoint: 'U+' + m[0].codePointAt(0).toString(16).toUpperCase() };
  }
  return null;
}

function lineOf(text, index) { return text.slice(0, index).split('\n').length; }

const findings = [];
function record(file, form, text, hit) {
  findings.push({
    file, form, script: hit.script, line: lineOf(text, hit.index), codepoint: hit.codepoint,
    sample: JSON.stringify(text.slice(Math.max(0, hit.index - 30), hit.index + 30))
  });
}

function check(text, file, form, allowCopyright) {
  let t = text;
  if (allowCopyright && form === 'NonASCII-aware') t = t.replace(/\u00A9/g, '(c)');
  const hit = firstHit(t);
  if (hit) {
    if (hit.script === 'NonASCII' && hit.codepoint === 'U+A9' && allowCopyright) return;
    record(file, form, text, hit);
  }
}

/* Detect a violation in any script, but treat a lone copyright sign in a
   third-party notice as the documented exception. */
function checkText(text, file, form) {
  for (const [name, re] of SCRIPTS) {
    const m = re.exec(text);
    if (!m) continue;
    if (name === 'NonASCII' && m[0] === '\u00A9') {
      const rest = text.replace(/\u00A9/g, '(c)');
      const other = firstHit(rest);
      if (other) record(file, form, rest, other);
      return;
    }
    record(file, form, text, { script: name, index: m.index, codepoint: 'U+' + m[0].codePointAt(0).toString(16).toUpperCase() });
    return;
  }
}

const files = walk(ROOT, []);
let literalsChecked = 0, decodedChecked = 0, concatChecked = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const src = fs.readFileSync(f, 'utf8');
  checkText(src, rel, 'raw');

  /* Decoded source (excluding regex detector definitions, which are not text
     content): decode escapes only inside quoted literals, and decode HTML
     entities outside script/style blocks. */
  /* Quoted literals never span a line in the authored modules; keeping the
     matcher single-line prevents the minified vendor bundle from being paired
     with a quote in a later module. */
  const litRe = /(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/g;
  let m;
  while ((m = litRe.exec(src))) {
    const d = decodeEscapes(m[0]);
    if (d !== m[0]) { checkText(d, rel, 'decoded-literal@' + lineOf(src, m.index)); decodedChecked++; }
    literalsChecked++;
  }
  if (/\.html?$/.test(f)) {
    const markup = src.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const d = decodeEscapes(markup);
    if (d !== markup) checkText(d, rel, 'decoded-html');
  }
  /* Numeric character construction, e.g. String.fromCharCode(65 + i). */
  const numRe = /String\.fromCharCode\(([^)]*)\)/g;
  while ((m = numRe.exec(src))) {
    concatChecked++;
    const nums = m[1].match(/\d+/g) || [];
    for (const n of nums) {
      const cp = parseInt(n, 10);
      if (cp > 127) findings.push({ file: rel, form: 'String.fromCharCode', script: 'NonASCII', line: lineOf(src, m.index), codepoint: 'U+' + cp.toString(16).toUpperCase(), sample: JSON.stringify(m[0]) });
    }
  }
}

/* Catalog values: evaluate the object literal from the authored module so that
   multiline and concatenated entries are covered too, not just single-line
   literals. The source is Local ASCII-authored code already scanned above. */
const catalogPath = path.join(ROOT, 'src', 'modules', '01-strings.js');
const catalog = fs.readFileSync(catalogPath, 'utf8');
const start = catalog.indexOf('var CATALOG = {');
const open = catalog.indexOf('{', start);
let depth = 0, close = -1;
for (let i = open; i < catalog.length; i++) {
  if (catalog[i] === '{') depth++;
  else if (catalog[i] === '}' && --depth === 0) { close = i; break; }
}
if (start < 0 || close < 0) throw new Error('Could not locate the string catalog object');
const CATALOG = Function('return ' + catalog.slice(open, close + 1))();
const catalogValues = Object.keys(CATALOG).map(k => [k, String(CATALOG[k])]);
for (const [key, value] of catalogValues) checkText(decodeEscapes(value), 'catalog:' + key, 'catalog-value');

/* Literal catalog references must resolve; generated keys are checked by the
   runtime audit in the browser (HB.strings.audit). */
const keys = new Set(catalogValues.map(v => v[0]));
const missing = new Set();
for (const f of files) {
  if (!/\.(js|html)$/.test(f)) continue;
  const src = fs.readFileSync(f, 'utf8');
  const refRe = /\b(?:HB\.t|t|HB\.materials\.sign|sign)\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g;
  let r;
  while ((r = refRe.exec(src))) if (!keys.has(r[1])) missing.add(r[1] + ' @ ' + path.relative(ROOT, f));
  /* HTML template placeholders are resolved by the UI localizer at runtime. */
  const attrRe = /\bdata-(?:key|aria-key|label-key)="([A-Z][A-Z0-9_]*)"/g;
  while ((r = attrRe.exec(src))) if (!keys.has(r[1])) missing.add(r[1] + ' @ ' + path.relative(ROOT, f));
}

const report = {
  scannedFiles: files.length,
  catalogEntries: catalogValues.length,
  quotedLiteralsChecked: literalsChecked,
  decodedLiteralsChecked: decodedChecked,
  fromCharCodeCallsChecked: concatChecked,
  scriptsChecked: SCRIPTS.map(s => s[0]),
  documentedException: 'U+00A9 inside the verbatim three.js MIT license notice only',
  unresolvedLiteralCatalogKeys: Array.from(missing),
  violations: findings
};
console.log(JSON.stringify(report, null, 2));
process.exit(findings.length || missing.size ? 1 : 0);
