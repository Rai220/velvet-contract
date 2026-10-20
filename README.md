# VELVET CONTRACT

A 2D top-down social-stealth assassination game built with **HTML5 Canvas, vanilla JavaScript, and CSS**. No frameworks, no build step, no external assets.

You are a contract killer inside a living, procedurally generated location. The target is guarded, the rooms have dress codes, and every body is a liability. Blend in, steal a uniform, poison a glass, rig an accident, and get out clean.

## Run it

```bash
cd _sushko_game
python3 -m http.server 8000
# open http://localhost:8000
```

You can also open `index.html` directly in a browser. The game uses only classic scripts, so no local server is strictly required.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| `Shift` | Sprint |
| `Ctrl` or `C` | Crouch |
| `E` | Context action: disguise, poison, sabotage, search body, hide body |
| `F` | Drag / drop a body |
| `Space` | Knife attack |
| `M` | Open tactical floor plan |
| `Esc` | Pause / close map |
| Mouse wheel | Zoom the camera |

## The stealth loop

### Social zones and outfits
Every room is assigned a functional zone: **public**, **private**, **staff**, **service**, or **security**. Your current outfit has a clearance level:

- **Guest** — public and private rooms
- **House Staff** — public, private, staff, and service areas
- **Kitchen Chef** — public and kitchen/staff areas
- **Security** — almost everywhere, including security rooms
- **Technician** — public, staff, and service areas
- **VIP** — public and private rooms

Walking into a room without the right clearance raises suspicion. Guards will stare, close in, and eventually raise the alarm. Guests and staff can also witness suspicious behavior and panic.

Uniforms are found as pickups in relevant rooms, and can be taken from the bodies of NPCs you have killed. A body's clothing remains searchable until looted.

### Blending in
Standing still near guests in a social room while wearing a social outfit makes you harder to notice. Crouching also reduces your visual signature. A HUD hint shows when you are blending in.

### Accidental kills
Two accident routes are generated into each level:

1. **Poison** — find the poison vial in a kitchen or storage room, then poison the target's glass. The target dies after a short delay, with no blade and no direct witnesses to the death.
2. **Environmental traps** — chandeliers, faulty wiring, gas lines, steam valves, or unstable crates. Rig one of the accident points and let the target walk into the danger zone.

Accidental kills score a bonus.

### Bodies, witnesses, and alarms
Guards and guests can discover corpses. Bodies can be dragged to wardrobes, lockers, freezers, or crates and hidden. Hiding a body removes it from the floor and grants a score bonus.

If a guard sees a kill, a restricted player, dragged body, or a corpse, an alarm is raised. Guards converge, draw weapons, and search the last known position. They will shoot if they have line of sight. The target flees to a safe room.

### Target and guards
The mission target has two bodyguards who escort them around a small social circuit. The target's name, title, and starting room are revealed in the mission briefing. The target is marked with a gold diamond in the world, on the minimap, and on the tactical floor plan.

## Procedural locations

Every contract generates a fresh floor plan from a seed:

- **Meridian Embassy** — marble halls, diplomatic offices, laundry, motor pool, and security.
- **SS Aurelia** — a cruise ship with a bridge, galley, engine room, cabins, and cargo hold.
- **Azure 890** — a long private jet with an aisle, galley, suites, cockpit, and cargo bay.
- **Casa del Lago** — a lakeside villa with a garage, wine cellar, pool, gardens, and suites.
- **Hotel Nocturne** — an art deco hotel with a ballroom, kitchen, spa, penthouse, and underground garage.

Rooms are selected from setting-specific names and furnished according to their function: kitchens have counters, islands, stoves, fridges, and freezers; bedrooms have beds, wardrobes, and nightstands; garages have cars, workbenches, and tool racks; security rooms have monitor banks, lockers, and server racks; lounges have sofas, bars, pianos, and social seating.

Each generated floor has:
- 10–14 large rooms
- a central corridor
- a connected navigation grid and A* pathfinding
- room-specific furniture and containers
- a target circuit, bodyguards, patrol guards, staff, and guests
- outfit pickups, poison, a target glass, and accident points
- a guaranteed set of functional rooms, including a kitchen, security room, storage, bathroom, social room, private room, and service space

Seeds can be entered manually in the main menu and are displayed on the score screen, so a floor can be replayed exactly.

## Scoring

The score screen appears after the target is eliminated:

- Contract completion
- Accidental-death bonus
- No collateral kills
- No alarm raised
- Bodies concealed
- Disguise changes
- Time bonus

Ranks range from **Messy** to **Silent Assassin**. The field report also records elapsed time, alerts, witnesses, collateral kills, concealed bodies, and disguises used.

## Project structure

```
index.html          Page shell and overlays
css/style.css       Menu, HUD, pause, results, and map styling
js/utils.js         Seeded RNG, math, A* pathfinding, drawing helpers
js/data.js          Outfits, zones, room archetypes, and five settings
js/level.js         Layout generation, furniture, navigation, props, spawns
js/render.js        Static map renderer and vector furniture artwork
js/entities.js      Player, NPC AI, bodies, particles
js/game.js          Game loop, perception, interactions, scoring, UI, audio
```

## Developer notes

- The game is deterministic for a given **setting + seed**.
- Entering a setting and seed in the menu replays the same generated floor.
- For quick testing, append `?autostart=1&theme=embassy&seed=TEST` to the URL.
- Never expose exact guard positions on the full map unless they are nearby or the alarm has been raised.
- Rendering is static-canvas based: the floor and furniture are rendered once, then dynamic actors, vision cones, props, and particles are drawn each frame.

## License

This is an original prototype created for this project. Do not use the names or content for real-world contracts. Obviously.
