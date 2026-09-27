# Colossus arena

The ancient mech is a tiny, almost square silhouette on the far horizon, with
its head, torso, arms and legs visible through the haze. Low, connected ruins
leave the horizon clear. Both eyes follow the living fighters through two slow
tracking filters. A small textured mesh animates the original painted head,
shoulders and hanging arms independently. Motion takes tens of seconds, stays
within a few screen pixels and leaves the feet and surrounding valley fixed.
The machine is beyond the playable world; local weapons cannot damage it.

The host runs a forty-second cycle: sixteen seconds of stillness, ten seconds
of charging, a four-and-a-half-second sweep and a long decay. Both eyes charge
and fire together; the pair reverses its sweep direction on successive cycles.
Aim is selected when charging begins and cannot chase players during the
warning. Two steady light fans and illuminated stone edges show the forthcoming
sweeps. Players leave their paths using ordinary movement and connected terraces.

Each beam narrows to its moving eye and widens toward the foreground, reaching a
sixty-unit radius; their endpoints are 320 units apart. Shared projected geometry
governs actor contact, physical
prop damage and terrain cuts. Surviving collision strips also clip the artwork
and cast shadows. Cuts persist through snapshots and hot joins and reset next
round. Bots recognise the full forthcoming sweep and seek supported escape
positions. Guests do not calculate damage or terrain edits.

The charge/discharge uses one cached, seekable sound. It stops on mute, result,
reset, departure or suspended audio. Reduced motion removes camera shake,
optical rotation and beam turbulence while retaining the warnings and beams.

## Artwork

`src/assets/colossus.webp` is an original background matte painting generated
and revised with the built-in image-generation tool for this arena. Sam's
latest direction replaces the initial face-dominated composition with a tiny,
distant full-body silhouette. The selected PNG was encoded as WebP at quality
93 without changing its composition or colours. Animated eyes, atmosphere,
stone terraces, shadows and the lasers are Canvas art. The animation deforms
only a small local mesh around the mech; it does not regenerate or replace the
background painting. Both optical apertures and damaging rays use that same pose.

The final two editing prompts are recorded below. Both used the built-in tool;
the second used the first edit as its reference.

```text
Use case: precise-object-edit.
Asset type: final production background matte painting for a 16:9 side-view 2D game arena.
Edit target: the supplied cinematic painting of an enormous mechanical face.
Primary change: Move the mech MUCH MUCH farther away. The user now wants it to be a tiny almost square shape in the distance, still identifiable, with much more of its body visible. Remove the huge foreground face completely. Recompose this as an immense empty landscape with a very small, remote, unnervingly stationary ancient mech almost lost in distant haze.
Composition: the ENTIRE mech silhouette occupies only about 5% of the image width and 13% of the image height, near the centre, at x=50%, with feet at y=57%. Its head, broad square hunched shoulders, torso, hanging heavy arms and legs are all visible. A square, blocky ancient mechanical humanoid seen far across dozens of miles of enormous mountain ridges, towers and cloud banks. A small geometric shape on the horizon. NOT a close-up, NOT a giant figure filling the image. More than 90% of the composition is empty landscape and sky. The camera is extremely far away. Its face is a tiny dark square with two minuscule cold, barely visible eye apertures, to receive live game light overlays.
Scene: broken mountain ranges and tiny abandoned needle towers receding across multiple valleys, huge fields of mist, impossibly distant ruined architecture, a pale cold sky with immense layered storm clouds and faint waning light at the right horizon. The lonely central silhouette is wrong and unsettling in its stillness, its age and scale hinted at by clouds halfway up its body and mountains far below its head. It appears to be watching the viewer. No aggression or battle pose.
Preserve: the supplied image's beautiful painterly cinematic science-fiction visual quality, mineral-weathered ancient metal, slate-blue mist and subtle muted amber light. Refine the mood to be creepier, quieter, lonelier and more oppressive, with an uncomfortably large amount of empty space around the distant machine.
Lower 35%: dark, low contrast quiet valley and fog for readable gameplay overlay. No foreground playable platforms.
Constraints: no text, logos, watermarks, border, HUD, characters, nearby robots, weapons, active lasers, explosions, glowing red eyes, stars, planets or giant nearby face. The mech must be SMALL IN THE IMAGE and very far away.
```

```text
Use case: precise-object-edit.
Edit target: the supplied distant-mech mountain landscape. Keep its beautiful landscape, cloud lighting, all mountain ranges, mist, towers, colour palette and framing unchanged.
Make ONLY this precise change: shrink the central mech's visible size by one half in BOTH dimensions, retaining its feet at the same horizon position. In the final 1672x941 composition the whole mech should be only about 75 pixels wide and 95 pixels tall, centred around x=836 with the feet around y=456. It should read as a tiny, almost square silhouette on the farthest horizon, barely discernible but recognisably mechanical. It must look dozens of miles farther away. Its head, torso, arms and legs remain visible, with the lower body partially hidden by thin distant fog.
Make the reduced figure creepier: an utterly still, dark weathered block of metal with a small square, expressionless head; no human face or visible mouth, only two dark narrow eye apertures. Slightly stooped shoulders and heavy arms hanging still. Distant atmospheric blue-grey desaturates the whole figure. No glow yet. It seems to be silently watching across all this empty space.
Fill the area vacated by the larger mech with the existing distant sky and clouds, naturally continuing this exact landscape. Do not move the horizon or change the camera. Do not enlarge the tiny mech to make it the hero of the frame. The landscape, immense empty space and loneliness must dominate. No text, HUD, characters, foreground platforms, laser, explosions or extra objects.
```
