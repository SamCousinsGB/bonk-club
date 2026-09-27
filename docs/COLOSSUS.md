# Colossus arena

A small ancient mech stands beyond the mountain valley. Its dark, blocky,
weathered silhouette follows the original painting. Mountains hide the legs
and lower body. The landscape contains no painted mech: the head, torso and
four arm segments are separate transparent parts attached to a shared rigid
skeleton. A cached atmospheric tint and foreground mountain layer establish
distance. Do not replace this with a large, clean geometric or toy-like robot.

The head, shoulders and elbows move independently. At a 1600px desktop camera,
head and hand travel each exceed ten pixels within six seconds. This preserves
readable slow movement even at the final small scale. Pose comes from validated
hazard age and gaze, never a separate client animation clock. Foot anchors
remain fixed below the obscuring ridge. Narrow metallic eye shutters replace
black dot eyes. Both light apertures and damaging rays use the same head frame.

Living fighters attract the gaze through two slow tracking filters. The host
runs a forty-second cycle: sixteen quiet seconds, ten seconds of charging,
a four-and-a-half-second sweep and a long decay. Both eyes charge and fire
together; successive cycles reverse their direction. The target locks when
charging begins. Two light fans and illuminated stone show the forthcoming
sweeps; ordinary movement and connected terraces provide escape routes.

The beams widen from their moving apertures to a sixty-unit radius, with
endpoints 320 units apart. Shared geometry governs warnings, actor contact,
props and terrain cuts. Surviving stone casts shadows and clips art. Damage
remains host-owned and persists through transport and late joins; round reset
restores it. Bots avoid the complete upcoming sweep. Local weapons cannot
damage the remote machine.

The cached, seekable charge/discharge sound stops on mute, result, reset,
departure or suspended audio. Reduced motion removes camera shake, drifting
fog and beam turbulence while retaining slow articulation and warning geometry.

## Artwork provenance

The built-in image-generation tool produced both assets, encoded as WebP at
quality 93 for scenery and 95 with full alpha quality for the parts atlas.
The original colossus.webp remains in source as prior-release provenance but
is no longer loaded or bundled. No new image-generation dependencies were added.

Scenery: src/assets/colossus-landscape.webp. Complete editing prompt:

> Use case: precise-object-edit. Asset type: cinematic background landscape for a game, 16:9. Edit target: the supplied mountain-valley painting. Remove the tiny robot/mech standing at the exact centre of the image completely, including its head, shoulders, torso, arms, legs and shadow. Fill its small footprint naturally with the distant sky, mist and continuing mountain ridges. Preserve the rest of the painting: the immense layered misty valley, ruined stone towers, spectacular storm clouds, warm golden break in the clouds at the right, sombre slate-blue palette, dramatic cinematic light and all framing. This is a scenery-only background plate to place a separately animated mech in front of. There must be absolutely NO robot, mech, humanoid, silhouette of a figure, face, eyes, laser or creature anywhere in this output. No text or logos. Change only the removal of the central figure; preserve the beautiful landscape.

Parts: src/assets/colossus-parts.webp. Complete generation prompt, referencing
the original colossus.webp:

> Use case: stylized-concept / game sprite asset. Reference image: the tiny dark ancient mech at the exact centre of this landscape. Create a production-ready TRANSPARENT PNG sprite atlas containing FOUR SEPARATE parts of that same mech for rigid skeletal animation. Square canvas, evenly divided into four imaginary equal quadrants with generous empty transparent gutters, no visible grid. TOP LEFT: only its square expressionless armored head, front view. TOP RIGHT: only its broad hulking torso with massive squared shoulder armor and upper-body chassis, no head, no arms, no legs. BOTTOM LEFT: only the complete left hanging arm from the shoulder pivot to the heavy hand. BOTTOM RIGHT: only the complete right hanging arm from the shoulder pivot to the heavy hand. Each part isolated, centred in its quadrant, no parts crossing into another quadrant. Consistent front-facing perspective, cloudy soft light coming from upper right. Dark atmospheric blue-grey, low contrast, photorealistic cinematic matte-painting texture. Faithful to the original mech's brutally square, heavy, slightly hunched silhouette, enormous old industrial machinery rather than a human-shaped cartoon robot. Encrusted mineral weathering, huge layered rectangular plates, eroded cast metal, dense recessed mechanical structures, asymmetrical ruined details. Head has no human mouth or human face, NO black circular eyes, only two barely visible narrow horizontal slits for laser emission. Torso is massive and squat, arms hang straight and extend low, chunky rectangular forearms and heavy hands. NO thin limbs, shiny ball joints, round chest reactor, cartoon styling, toy styling, cute expression, heroic superhero anatomy, bright colors, ornamental neon, text, labels, background scenery, drop shadows or legs. This atlas will be drawn small and extremely far away in the original landscape; prioritize the original imposing silhouette and beautiful realistic texture. Genuinely transparent background.
