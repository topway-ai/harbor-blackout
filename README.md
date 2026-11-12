# HARBOR BLACKOUT

A single-player, browser-based first-person mission set at NORTHSTAR HARBOR on a
rain-soaked dawn. The harbor's automated defense grid has gone rogue. Disable the
three relay stations, survive the reinforcement waves, and reach the extraction
boat.

This is a self-contained playable vertical slice designed for a short first
playthrough, written with Three.js / WebGL, HTML, CSS and JavaScript. It is a
browser game, not a production AAA title. The automated, optimal-route playthrough
time actually measured is reported in `VALIDATION.md`; a human playthrough was
not timed on real hardware.

## Play

**Live site:** https://topway-ai.github.io/harbor-blackout/

Open `index.html` in a modern desktop browser with WebGL enabled. That is all
that is required: the file embeds the game code, styles, the Three.js runtime,
every generated texture and the MIT license notice. There is no backend, no
login, no API key, no paid service, no build command, and no network request for
assets at runtime. Audio is synthesized with WebAudio and starts only after a
user gesture (clicking BEGIN MISSION).

A local static server is recommended instead of `file://`, because some browsers
restrict pointer lock and WebAudio on local files:

```
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## Mission

1. Start at the container yard. Find RELAY A and hold **E** until it is disabled.
2. Move through the maintenance shed to RELAY B, then along the quayside to
   RELAY C. Each shutdown is followed by a telegraphed reinforcement wave.
3. After all three relays are offline, the EXTRACTION BOAT marker activates at
   berth 04. Reach it and hold **E** to board.
4. A mission debrief reports completion time, accuracy, enemies destroyed,
   shots fired and retry count.

Ammo caches near each relay resupply the rifle. Health regenerates after six
seconds without damage. Falling into the water costs health and returns you to
the nearest safe ground. Death offers RETRY; pause and debrief offer RESTART.
Both reset the mission state.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | W A S D | Left virtual stick |
| Look | Mouse (pointer lock) or arrow keys as fallback | Drag on the right-side look zone |
| Fire | Left mouse button | FIRE button |
| Aim down sights | Right mouse button | AIM button |
| Reload | R | RELOAD button |
| Interact / hold to disable | E | USE button |
| Sprint | Shift | SPRINT button |
| Crouch | C or Ctrl | CROUCH button |
| Jump | Space | JUMP button |
| Pause | Esc | Leaving and returning to the app pauses; the pause menu is touch-operable |

Pointer lock is requested only after a user gesture. If pointer lock is
unavailable or is lost, mouse movement over the canvas and the arrow keys still
steer the view; an on-screen hint appears. Losing browser focus pauses an active
mission.

Touch controls appear automatically on touch-capable devices and are positioned
away from the compass, objective tracker, health and ammunition readouts.

## Settings

Available from the title screen and the pause menu:

- Master volume and mute
- Mouse sensitivity
- Invert Y
- Field of view
- Graphics quality (LOW / MEDIUM / HIGH)
- Reduced camera shake
- Radio subtitles

Graphics quality scales render resolution, shadows, rain density, aberration,
grain and the planar water reflection. LOW is the recommended mobile setting.

## Live hosting on GitHub Pages

The public repository `topway-ai/harbor-blackout` publishes the site at:

```
https://topway-ai.github.io/harbor-blackout/
```

It uses GitHub Pages on a public repository under GitHub Free, configured as
"Deploy from a branch" on the `main` branch root folder. No workflow file is
tracked in this repository: the only entry visible under Actions is GitHub's
own automatically generated `pages-build-deployment` job, whose billing timer
reports 0 billable milliseconds. There is no Git LFS, no custom domain, no CDN,
no Codespaces configuration and no paid add-on. GitHub Pages on a public
repository has no usage charge, and Actions usage on public repositories is
free. Its soft limits are a 1 GB published site, 100 GB per month of bandwidth
and 10 builds per hour; exceeding a soft limit can pause serving or prompt a
support email, but does not create a bill. This repository is about 16 MB and
needs no recurring builds.

To reproduce the same setup elsewhere:

1. Create a public repository and copy `index.html` and `.nojekyll` into its root.
2. Commit and push to the `main` branch.
3. In repository Settings > Pages, select "Deploy from a branch", then choose
   `main` and `/ (root)`, and save.
4. Open `https://<user>.github.io/<repository>/` in a browser.

The build has no absolute paths and no external resources, so it works under a
repository subpath such as `https://<user>.github.io/<repository>/index.html`.
`.nojekyll` is required so GitHub Pages does not run the folder through Jekyll;
without it, files beginning with an underscore can be dropped. Keep it next to
`index.html`. Relative paths are used throughout, so no base-href or rewrite
rules are needed.

## Source layout

The playable distribution is the single file `index.html`. Readable sources live
in `src/` and are concatenated by the development-only bundler:

| Path | Contents |
| --- | --- |
| `src/index.template.html` | Document shell and all screens, with English catalog keys |
| `src/styles.css` | Interface, HUD and responsive/touch layout |
| `src/modules/01-strings.js` | Validated English string catalog and runtime audit |
| `src/modules/02-util.js` | Math, noise, rectangles |
| `src/modules/03-materials.js` | Procedural PBR textures and controlled English label rendering |
| `src/modules/04-audio.js` | WebAudio rain, wind, harbor and combat soundscape |
| `src/modules/05-render.js` | WebGL renderer, post-processing, quality tiers, water reflection |
| `src/modules/06-world.js` | Three-zone harbor, collision, relays, signage, rain and sea |
| `src/modules/07-input.js` | Keyboard, mouse, pointer lock, fallback look, touch state |
| `src/modules/08-player.js` | Movement, collision response, vitals, camera |
| `src/modules/09-weapon.js` | AR-9 SERVICE RIFLE viewmodel, ADS, recoil, reload |
| `src/modules/10-combat.js` | Hitscan combat and pooled effects |
| `src/modules/11-enemies.js` | Defense drones and security hounds AI |
| `src/modules/12-objectives.js` | Relay holds, waves, extraction |
| `src/modules/13-ui.js` | HUD, screens, settings, markers, subtitles, touch |
| `src/modules/14-game.js` | Settings, state machine, boot stages, main loop |
| `src/modules/15-main.js` | Bootstrap |
| `src/vendor/` | three.js r149 UMD build and its original MIT license |
| `src/build.js` | Development-only bundler (not needed to play) |
| `tools/` | Development-only browser QA and validation scripts |
| `screenshots/` | Selected QA screenshots |

Rebuild the single-file distribution after editing a source module:

```
node src/build.js
```

The bundler writes `index.html` at the repository root, injects the project MIT
notice and the verbatim third-party notice as HTML comments, and keeps the
vendor license intact. `LICENSE` at the repository root is the source of the
project notice. Only Node.js is needed for this optional step; the game itself
does not need Node.js.

## Language

The game is English-only by construction. Every visible phrase, including
procedural texture lettering, is stored in the validated catalog in
`01-strings.js`. Scene labels are rendered through a shared function that
rejects unexpected scripts, and a runtime audit checks DOM text, aria labels,
titles and document metadata. Base textures contain no lettering or logos. The
document language is fixed to `en` and does not follow the browser locale.
See `VALIDATION.md` for the checks actually performed and their limits.

## License and third-party software

The original game code, text, procedural textures, generated geometry and
synthesized audio in this repository are licensed under the MIT License. See
`LICENSE` for the full text. Copyright (c) 2026 topway-ai. The single-file
`index.html` also embeds the project MIT notice, so a standalone copy of the
game carries its license with it.

The bundled runtime is three.js r149 (UMD build), also MIT licensed, with its
own copyright held by the three.js authors. Its full license is reproduced in
`THIRD_PARTY_NOTICES.md`, in `src/vendor/THREE_LICENSE.txt`, and as an HTML
comment at the top of `index.html`. No other third-party code or assets are
shipped. Generated textures, geometry and audio are produced at runtime by
original code in this repository.

## Performance notes

Simulation is frame-rate independent: each frame is split into fixed-size
substeps, and the total catch-up after focus loss is capped. Repeated geometry
and materials are reused, active enemies and particles are capped, and the
quality setting scales resolution and expensive effects. Measured numbers from
the test environment are reported in `VALIDATION.md`; they are not a guarantee of
frame rates on other hardware.
