# Colossus arena

The distant face is the main landscape. Play stays on low, connected stone
terraces beneath it. Both eyes follow the living fighters through two slow
tracking filters; a head traverse takes over two minutes. The mech is outside
the playable world and cannot be hit, removed or captured by local weapons.

The host runs a forty-second cycle: sixteen seconds of stillness, ten seconds
of charging, a four-and-a-half-second sweep and a long decay. The eyes alternate.
The aim is selected when charging starts and cannot chase players during the
warning. A steady light fan and illuminated stone edges show the forthcoming
sweep. Players can leave it using normal movement and the connected terraces.

The sixty-unit-radius beam inflicts contact damage, fractures props and carves
the terrain it traverses. Surviving collision strips also clip the artwork and
cast shadows. Cuts persist through snapshots and hot joins, and reset next
round. Bots recognise the full forthcoming sweep and seek supported escape
positions. Guests do not calculate damage or terrain edits.

The charge/discharge uses one cached, seekable sound. It stops on mute, result,
reset, departure or suspended audio. Reduced motion removes camera shake,
optical rotation and beam turbulence while retaining the warning and beam.

## Artwork

`src/assets/colossus.webp` is the original background matte painting generated
with the built-in image-generation tool for this arena. The original PNG was
encoded as WebP at quality 91 without changing its composition or colours.
The animated eyes, atmosphere, stone terraces, shadows and laser are Canvas art.

Final generation prompt:

```text
Use case: stylized-concept.
Asset type: final production background matte painting for a 16:9 side-view 2D game arena, high resolution landscape 2560x1440 or larger.
Primary request: An ancient colossal mechanical god exists unimaginably far away. Its HEAD AND FACE dominate the entire distant skyline; not a nearby robot, not a combat enemy. It feels like a continent. Its forehead extends beyond the top frame; face fills central 65% of width, from top edge to lower mist. Broad asymmetrical weathered armoured cheeks, a long monolithic mechanical nose, sunken cold dead circular eyes beneath enormous brow plates, nested industrial rings deep within sockets, a severe ancient expression. Shoulders disappear beyond both sides into haze. No visible full body or limbs.
Composition: frontal three-quarter near-symmetric face looking slightly downward, two dark circular eye apertures around 37% and 63% of image width, 33% image height. Eye apertures intentionally dark and unlit to receive animated light overlays. Cloud ribbons pass across lower cheeks. Tiny mountain ranges and tiny abandoned needle towers at bottom, many distinct atmospheric depth layers. All landmarks absurdly small compared with head. Lower 35% increasingly dark quiet blue-grey fog with no foreground playable platforms, leaving readable negative space for gameplay. No close-up objects.
Style: extraordinarily beautiful cinematic science-fiction concept painting, painterly photoreal detail with textured brushwork, immense architectural mechanical complexity, weathered iron, mineral streaking, broken armor, internal ribbing, fine machinery barely discernible through immense distance; restrained atmospheric perspective, no sharp toy-like outline. A film establishing shot, monumental, solemn, eerie.
Lighting: cold storm light and pale luminous mist, narrow muted warm light from the far right horizon; huge soft shadows, rich charcoal and slate blue shadows, steel silver highlights, soft amber rim on right. Moody but legible facial planes, dramatic tonal depth. Not overly dark or flat.
Constraints: background ONLY, no text, logos, watermarks, border, HUD, characters, fighters, weapons, explosions or active lasers, no glowing eyes, no smile, no cartoon mascot. Face must dominate. Sky contains slow clouds only; no stars, no planets.
```
