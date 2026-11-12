# HARBOR BLACKOUT - Validation Report

This report lists the checks that were actually executed on the delivered build.
Checks that were not run are listed under Limitations. No result below is
extrapolated to hardware that was not tested.

## 1. Build and test environment

- Deliverable: `index.html`, 844,866 bytes, produced by `node src/build.js`
  from 15 readable source modules. It embeds CSS, the three.js UMD runtime,
  all game code, all generated textures, WebAudio synthesis and the full MIT
  notice. No build step is needed to play it.
- Host: macOS 26.5, arm64. Node.js v22.22.2 (development and QA tooling only).
- Browser: Google Chrome 157.0.8103.78, driven headless by
  `playwright-core` 1.55.0.
- WebGL renderer: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
  (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`. This is a software
  renderer; no hardware GPU was used for any measurement below.
- Static subpath check: a local Node HTTP server served `index.html` and
  `.nojekyll` from `http://127.0.0.1:<port>/harbor-blackout/index.html`,
  reproducing a GitHub Pages repository subpath. No deployment was performed.
- Viewports and locales: 1280x720 (en-US), 1024x640 (zh-CN, timezone
  Asia/Shanghai), 390x844 at 2x (ja-JP, mobile + touch emulation), 960x540
  (en-US, playthrough).

## 2. English-only validation

Command: `node tools/validate-language.js`

Final run result: 35 files scanned (this report included), 292 catalog entries,
8,587 quoted literals checked, 9 `String.fromCharCode()` constructions checked,
0 violations, 0 unresolved literal catalog-key references.

The static scan covers authored HTML, CSS, JS, JSON, SVG-like sources, Markdown
and text notices. It checks raw bytes and decoded forms: `\u`, `\x` and
`\u{...}` escapes, numeric and hexadecimal HTML entities, escaped JSON, quoted
literals, generated concatenations, literal `HB.t('KEY')` references and
`data-key` / `data-aria-key` / `data-label-key` attributes. Forbidden scripts:
Han, Hiragana, Katakana, Hangul, Cyrillic, Greek, Arabic, Hebrew, Thai,
Devanagari, Bopomofo, CJK radicals and punctuation, CJK compatibility and
fullwidth forms, CJK extension planes, and any non-ASCII character.

Documented exception: U+00A9 (copyright sign) occurs only inside the verbatim
three.js MIT license text, which must be preserved. It is a source comment,
not game content. `index.html` contains 0 non-ASCII characters outside that
notice.

Runtime checks: `HB.strings.audit()` returned `violations: []` with
`catalogSize: 292` and 263 registered strings; the audit covers catalog
values, registered strings, DOM text nodes, aria labels, `document.lang`,
`document.title` and the meta description. A `MutationObserver` checks
dynamically inserted text and attributes. All visible phrases, including
procedural in-world labels, come from the catalog and pass through
`assertEnglish()` before reaching a Canvas, SVG or scene-label texture.
Base environment textures contain no lettering, logos or watermarks.

Locale check: with `navigator.language` set to `zh-CN`, the document stayed
`lang="en"`, the title stayed `HARBOR BLACKOUT`, DOM Han count was 0 and the
runtime audit returned 0 violations. The mobile `ja-JP` context produced
English-only touch labels: FIRE, AIM, RELOAD, JUMP, CROUCH, USE, SPRINT.

Visual check: the screenshots listed in section 5 were inspected manually.
No Han characters, pseudo-Han glyphs, missing-glyph boxes, or blurred or
masked lettering were observed in near-field or distant signage, container
markings, equipment plates, boat names, weapon engravings or UI screens.
OCR was NOT run (see Limitations); manual visual inspection was the primary
check and was not substituted by OCR.

## 3. Automated checks executed

| Command | Outcome |
| --- | --- |
| `node tools/smoke.js` | BOOT reached TITLE; 3 relays, 109 colliders, 115 signs, 5 walkable rects; BEGIN -> INTRO -> PLAYING; runtime audit clean; 0 page/console errors; 0 external requests. |
| `node tools/ui-qa.js` | 37 of 37 checks PASS, 0 failures, 0 errors. Report: `screenshots/qa-report.json`. |
| `node tools/playthrough.js` | Full mission won with no debug shortcuts; RADIO RESET PASS; RESTART RESET PASS; 0 errors. |
| `node tools/validate-language.js` | 0 violations (details in section 2). |
| Build inspection | `index.html` has exactly 1 `src`/`href` attribute (the inline `data:,` favicon), 0 external URLs, `<html lang="en">`, English `<title>`, MIT notice and vendor `@license` present. |

UI QA coverage: boot/title, settings persistence and reset to defaults,
controls panel, intro SKIP via real mouse click, W movement, Shift sprint,
walkable collision, C crouch, Space jump, right mouse ADS, left mouse fire
and ammo consumption, R reload with reserve decrement, damage, death, retry,
Esc pause, settings from pause and back, resume, runtime catalog audit,
document language, no Han in desktop DOM text, no runtime errors or external
requests, zh-CN desktop locale, ja-JP mobile title and gameplay, touch
control visibility, touch buttons not overlapping critical HUD readouts,
objective title fitting its panel, virtual stick, look zone, touch FIRE
press and release, and English-only touch labels.

Full playthrough: the bot drove the game only through the public input layer
(virtual actions, look deltas and DOM button clicks). It did not write relay
or extraction state and did not call `HB.game.win()`. It disabled RELAY A,
RELAY B and RELAY C, survived the three telegraphed reinforcement waves,
boarded the extraction boat, and reached VICTORY then DEBRIEF. Measured
mission stats: 48.37 seconds, 8 shots, 8 hits (100% accuracy), 3 enemies
destroyed, 3 of 3 relays, 0 retries. The debrief screenshot shows 00:48,
100%, 3, 8, 0 and 3 / 3, matching those stats.

Restart verification after debrief: state PLAYING, all relays `online`,
extraction inactive, stats zeroed, health 100, magazine 30, reserve 210.
The regression check added for this build also confirmed the radio subtitle
was cleared (`RADIO RESET PASS`), fixing a stale victory-era subtitle that
had appeared in the restarted mission.

## 4. Measured performance

All figures come from the SwiftShader software renderer in headless Chrome.
They are real recorded frame durations, not clamped simulation deltas. They
must not be read as hardware GPU frame rates.

| Context | Quality / resolution | Samples | Avg frame | Avg FPS | p95 frame | Max frame |
| --- | --- | --- | --- | --- | --- | --- |
| `tools/ui-qa.js`, desktop | medium / 1280x720 | 168 | 325.38 ms | 3.1 | 933.3 ms | 7533 ms |
| `tools/smoke.js`, desktop | medium / 1280x720 | 21 | 493.60 ms | 2.0 | 1566.6 ms | 7399.7 ms |
| `tools/playthrough.js` | low / 960x540 | 240 | 158.19 ms | 6.3 | 333.3 ms | 366.6 ms |

`HB.game.perf()` reports `avgFrameMs`, `avgFps`, `p95FrameMs`, `maxFrameMs`,
the WebGL renderer string, quality tier and render resolution. The long
maximum values are single startup or scene-build frames under software
rendering. No 60 FPS result was measured and no frame rate is guaranteed on
unspecified hardware. LOW quality is the intended mobile setting.

## 5. Screenshots reviewed

Saved in `screenshots/`. Loading, title, intro, settings, controls, pause,
death, victory, debrief, gameplay, weapon ADS, three in-world label views,
zh-CN locale title, mobile title and touch HUD: `qa-loading`, `qa-title`,
`qa-intro`, `qa-settings`, `qa-controls`, `qa-pause`, `qa-death`,
`qa-gameplay`, `qa-weapon-ads`, `qa-labels-0`, `qa-labels-1`, `qa-labels-2`,
`qa-locale-zh-title`, `qa-mobile-title`, `qa-touch`. Playthrough captures:
`play-zone-yard`, `play-zone-shed`, `play-zone-quay`,
`play-zone-extraction`, `play-victory`, `play-debrief`, `play-restart`.
The machine-readable UI QA result is `screenshots/qa-report.json`.

## 6. Defects found and fixed during validation

- Missing global `HB.t` alias, which caused a fatal startup error.
- Favicon 404 from a missing icon; replaced with an inline data favicon.
- Boot stage failure (`M.get is not a function`) in material initialization.
- Loading stalled on the slow software renderer; boot stages are now paced
  by wall-clock timestamps and the scene is not rendered during BOOT/ERROR.
- Frame deltas were clamped as a single step, producing slow motion; the loop
  now splits each frame into capped fixed-size substeps and records real
  frame durations for the performance report.
- Pointer lock was requested before active gameplay and a failed request was
  misread as a lock loss, forcing a false pause. It is now requested only
  after a user gesture on desktop, with arrow-key and mouse-look fallback.
- The first-person viewmodel appeared on title, intro and end screens; it is
  now visible only in gameplay and menu states.
- Touch HUD readouts overlapped the virtual stick and action buttons; mobile
  vitals and ammo were moved to the upper band with short-screen rules.
- A victory-era radio subtitle survived into a restarted mission. Transient
  HUD state is now cleared on mission reset and quit-to-title, and terminal
  radio lines are shown immediately instead of being left in the queue.
- Redundant speaker names were removed from radio subtitle lines, since the
  speaker is already rendered separately.
- QA tooling issues that were not product defects: a too-conservative bot
  navigation radius, a stale static catalog parser, and short key holds that
  did not span a slow software-rendered frame.

## 7. Limitations and checks not performed

- No OCR was run: `tesseract` is not installed. The required visual
  inspection was performed manually on rendered screenshots and is reported
  above; OCR would only have been supplementary.
- No human playthrough was timed. The 48.37 s figure is an automated,
  optimal-route bot run with prior knowledge of relay positions. It is not a
  human playtime estimate and the README makes no 5-10 minute claim.
- No hardware GPU benchmark was run. All performance numbers are from
  SwiftShader in headless Chrome on one arm64 macOS machine; no 60 FPS claim
  is made.
- Touch input was exercised with Chrome DevTools Protocol touch events in an
  emulated 390x844 mobile context, not on a physical phone or tablet.
- Audio was not recorded or listened to. WebAudio starts only after a user
  gesture, is mutable, and produced no console errors; no acoustic
  verification was performed.
- Touch devices have no dedicated on-screen pause button. Moving focus away
  from the browser pauses the mission and the resulting modal menu is fully
  touch-operable. The requested touch action set (move, look, fire, ADS,
  reload, jump, interact) is present; crouch and sprint are also provided.
- No GitHub Pages deployment, repository push or account action was taken.
  Hosting was verified only against a local repository-style subpath server.
- The attached reference HTML was treated as untrusted reference material
  only. No implementation code, text, brand, font stack or art from it was
  copied or redistributed. No license is assigned to the original game code,
  text and generated assets; that choice is left to the owner.
- The distribution targets modern desktop browsers with WebGL; an explicit
  WebGL-unavailable error screen is provided, but very old browsers and
  screen readers were not audited for full accessibility.

## 8. Deliverables

`index.html` (playable single-file build), `.nojekyll`, `README.md`
(English), `THIRD_PARTY_NOTICES.md`, `VALIDATION.md` (this file),
`src/` (readable sources, vendor runtime and original MIT license),
`tools/` (development-only validation and QA scripts), `screenshots/`
(selected QA screenshots and `qa-report.json`).
