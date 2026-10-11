# Arena review — v0.76.1

Reviewed the fourteen arenas in the current release at desktop resolutions.
The pass concentrates on readable surfaces, unobstructed opening routes and
artwork that follows surviving collision geometry. Colossus gains a central
jump opening; hazard timing, movement and destruction rules are preserved.

## Shared corrections

- Generated liquid containers leave opening weapon approaches and 65 units at
  platform edges clear. Placement is checked again after random resizing.
- Car Assembly no longer moves three already-validated containers onto fixed
  maintenance-ledge positions after clearance checks.
- Bots recover stalled pickup/crown approaches using collision- and
  hazard-checked flights, including when damage leaves navigation incomplete.
- Colossus's upper terrace has a central opening so the lower central route
  is no longer trapped under one broad roof when side galleries are cut.
- Metal, concrete and grating have distinct faces and restrained depth.
  Metal panels no longer inherit the wooden-panel colours. Stone no longer
  falls through to the renderer's large rectangular shadow.
- Static cut surfaces use their original face as the artwork anchor, clipped
  to the surviving collision pieces. Gradients, ribs and top trim no longer
  restart on each thin collision slice. Moving structures keep their own art.

## Arena coverage

Every row received intact, active and damaged visual inspection, plus guest
movement and a late join into actual transported blast damage.

| Arena | Review and resulting correction |
| --- | --- |
| Transmission Towers | Added subdued outdoor sky, distant hills and pylons; clearer steel and grating. Kept physical crossings, warning colours and falling wires. |
| Arc Furnace | Clearer structural metal and opening pickups; checked active arcs and surviving furnace cuts. |
| Car Assembly | Removed unsafe supply relocation; checked the conveyor, tooling, cars and alternate maintenance routes. |
| Turbine Hall | Clearer open grating and unobstructed pickup approaches; checked continuous rotors and the open void. |
| Bullet Train | Cropped lower guideway fragments retain guideway artwork and original gradients. Checked upper routes and damaged track. |
| Scrap Foundry | Replaced misleading long platform shadows with bounded material faces; checked ladles, press and open upper routes. |
| Cargo Plane Hold | Checked banked hull, cargo, platforms and damaged openings; preserved hull-relative art and movement. |
| Car Wash | Darkened the tiled wall for fighter contrast. Damaged floor rollers keep the original top/bottom trim; lower catwalk slices do not grow new guard rails. |
| Ocean Liner | Checked compartment cuts, water and deck routes; surviving static deck art keeps its original anchor. |
| Waterworks | Clearer basin concrete and catwalks; checked broken mains, flooding and platform cuts. |
| Suspension Bridge | Checked moving road spans, surviving cables and maintenance bays after cuts; retained the bridge's independent moving art. |
| Colossus | Split the upper terrace to provide a jump exit from the lower centre; checked active beam, foreground routes and cut stone faces. Retained the statue and landscape artwork. |
| Rocket Test Stand | Deck art is clipped to surviving bounds; checked plume and damaged stand routes. |
| Refinery | Deck stripes are clipped to surviving bounds; checked pipes, vessels, basin and damaged process geometry. |

## Repeating the checks

Install root and desktop dependencies with `npm ci` and `npm ci --prefix desktop`.
Run the normal `npm test`, `npm run test:stress` and production `npm run build`
release gates.

- `node desktop/tests/arena-review-browser.mjs after` captures 42 deterministic
  scenes using the actual renderer and validates ten Canvas pixel comparisons
  for cropped material faces, train guideway and Car Wash floor. Actors are
  kept alive in this visual fixture so a complete setpiece cycle is visible.
- `node desktop/tests/arena-relay-browser.mjs` checks real host/guest controls
  and damaged-world late joins for every arena through the public TURN service.
  Set the configured `VITE_ROOM_SERVICE_URL` and `VITE_TURN_CREDENTIALS_URL`
  first. The host simulation freezes after damage only while exact transported
  geometry and resized container bounds are compared. Transport keeps running.
  The check also covers round reset, reduced motion, desktop resize and departure.
- `node desktop/tests/browser-online.mjs` checks the production bundle; add
  `--public` to check the published site after Pages deployment.

Evidence is written to ignored `desktop/test-results/arena-review/` and
`desktop/test-results/`. The new placement regression covers all fourteen
arenas, three random-size selections and rounds 1, 3 and 6, including snapshot
round trips and immutable arena templates.

The stress pass exposed Crown approaches stalling on Car Wash and Colossus.
Both original scenarios now pass. Additional regressions check objective
recovery with an incomplete route graph and the central Colossus route with
both side galleries absent. The older two-bot Colossus debris reproduction
allows two more seconds for the added crossing (the first contact in the
revised layout occurs at 16.04 seconds); its escape and combat assertions stay.

Protocol 112 separates the revised Colossus platform/art indices from older
clients. Refresh all players' tabs together when updating.

Browser relay evidence uses separate contexts on one desktop machine. It does
not establish cross-ISP latency or Steam connectivity. Visual captures and
automated checks are a repeatable quality gate, not a claim that all possible
gameplay combinations or long-term balance have been exhausted.
