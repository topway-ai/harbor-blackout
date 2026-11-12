/* HARBOR BLACKOUT - bundles readable sources into a single playable index.html.
   Development only. The shipped build needs no build step: index.html is
   self-contained and works from any static host, including a GitHub Pages
   repository subpath. Run: node src/build.js */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = __dirname;
const moduleDir = path.join(srcDir, 'modules');
const template = fs.readFileSync(path.join(srcDir, 'index.template.html'), 'utf8');
const css = fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf8');
const vendor = fs.readFileSync(path.join(srcDir, 'vendor', 'three.min.js'), 'utf8');
const license = fs.readFileSync(path.join(srcDir, 'vendor', 'THREE_LICENSE.txt'), 'utf8');
const projectLicense = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');

const modules = fs.readdirSync(moduleDir)
  .filter(f => f.endsWith('.js'))
  .sort()
  .map(f => ({ name: f, code: fs.readFileSync(path.join(moduleDir, f), 'utf8') }));

function assertNoClosingTag(code, name) {
  if (/<\/script/i.test(code)) throw new Error('Unsafe closing script tag in ' + name);
}

/* The single-file build is a standalone copy of the work, so it carries both
   the project MIT notice and the verbatim third-party MIT notice. LICENSE at
   the repository root is the single source of truth for the project text. */
const notices = [
  '<!--',
  'PROJECT LICENSE - HARBOR BLACKOUT original code, text and generated assets.',
  'The full MIT License below is also shipped as LICENSE at the repository root.',
  '',
  ...projectLicense.trimEnd().split('\n'),
  '-->',
  '',
  '<!--',
  'THIRD-PARTY NOTICE - three.js r149 (UMD build), MIT License.',
  'Bundled verbatim below. Original license also shipped in src/vendor/THREE_LICENSE.txt',
  'and THIRD_PARTY_NOTICES.md. All game code and generated art are original.',
  '',
  ...license.trimEnd().split('\n'),
  '-->'
].join('\n');

modules.forEach(m => assertNoClosingTag(m.code, m.name));
const moduleCode = modules.map(m => '/* ---- ' + m.name + ' ---- */\n' + m.code).join('\n\n');
const bundled = template
  .replace('<!--INJECT_NOTICES-->', notices)
  .replace('/*INJECT_CSS*/', () => css)
  .replace('/*INJECT_VENDOR*/', () => vendor)
  .replace('/*INJECT_MODULES*/', () => moduleCode);

fs.writeFileSync(path.join(root, 'index.html'), bundled, 'utf8');
console.log('Bundled index.html: ' + bundled.length + ' bytes, ' + modules.length + ' source modules.');
