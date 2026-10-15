---
name: Pixaxe — Game Client
description: "$PIXAXE as a game you open: a title screen with a floating voxel island (three.js) where the top ten stand, then menu screens (scoreboard, furnace, advancements, inventory, chest) and a hardcore ending, with a HUD on screen the whole time."
colors:
  sky: "#6fb3e6 → #bde0f6 in hard bands"
  gui: "#c6c6c6 (windows), #8b8b8b (slots)"
  menu: "dirt texture under rgba(12,9,7,.8)"
  tooltip: "#100010 with #2a0a5e border"
  xp: "#7fe14b"
  diamond: "#4fe0d4"
  gold: "#f2c230"
  lava: "#ff6a1a"
  red: "#ff6b5e / #b3261a"
typography:
  said: "Pixelify Sans (headings 700, reading 400)"
  counted: "VT323 (every number, address, label and button, set 1.22x larger)"
---

# Pixaxe — Game Client

The page is not a story you scroll through; it is a game you have open. A title screen, then the
menus you would open in a game, then the screen you get when the run is over. The HUD never leaves.

## Screens (src/game/)
- **Title.tsx**: block-letter logo (stone and gold textures clipped to the letters), the tagline, and the island. If WebGL is missing, the ten are shown as portraits on two ledges instead.
- **world3d/Island.tsx**: the floating island in three.js, orthographic and isometric. Upper terrace with diamond ore in its cliff (No. 1-5, No. 1 on the beacon with its beam), lower terrace with gold ore (No. 6-10), lava at the front, the golem at the back. Miners are built from the same pixel skins as the 2D portraits (head textures come from `headRows`). They turn to face you, bob, walk to a new spot on a rank change, and a seller steps off into the lava. Drag turns the island (mouse only; a finger scrolls the page). Tags show the rank; the name opens on hover.
- **Scoreboard.tsx**: the player list you get when you hold Tab: diamond and gold groups, a signal bar for how much each holds next to No. 1, the next reward; golem, spawning and spectators below; No. 11-50 behind a fold.
- **FurnaceUI.tsx**: the loop as a furnace window: fees in, trades as fuel, the progress arrow, Reward or Treasury out. Beside it the recipe (steps in order) and the 44/56 split bar.
- **Advancements.tsx**: the rules as an advancement tree: spawn in → on a ledge → light the beacon, and the red Hardcore challenge.
- **Inventory.tsx**: the wallet check as an inventory window: a doll with the miner on its chosen backdrop, a status effect, four stat slots; the skin editor below (name, skin, X).
- **ChestUI.tsx**: a 54-slot double chest, one item per round (ingots for Reward, a chest for Treasury). Hover, focus or tap a slot to read it in the tooltip, with the transaction.
- **GameOver.tsx**: "No respawn." on red bedrock, with Buy, a dead Respawn button and the CA.
- **Hud.tsx**: the top bar (name, wallet, buy) and the HUD: one heart, the XP bar (fees smelting; the level is the number of rounds run), the hotbar (keys 1-8) and the chat (`lib/feed.ts`), whose lines fade like game chat.

## Things that make it a game
- **Armor by hold time** (`lib/armor.ts`): leather at 1 day, iron at 7, gold at 30, diamond at 90, worked out from the first buy alone. Drawn on the 2D miner, the 3D miner, the scoreboard (a chestplate by the timer), the inventory (with a countdown to the next piece) and the advancements.
- **Reward rain**: every new Reward round fires `pixaxe:reward` (`lib/feed.ts`). Ingots fall on each of the ten with its share floating up, the beacon flares, and the HUD shows LEVEL UP. The demo edition shows one 7 s after load and every 45 s, marked "(demo)" in the chat.
- **Next goal** in the inventory: how much more to pass the wallet above (or reach a ledge, or spawn), and how close the one below is, from the live board.
- **Share card** (`lib/sharecard.ts`): a 1200 by 630 PNG drawn on a canvas in the browser: the miner in its armor, rank, status, held for, armor, holds, paid. Save, share (where the browser can share files) or post on X.
- **The graveyard** (`game/Graveyard.tsx`, hotbar slot 7): one stone per wallet that sold, newest first: its ghost, how long it held, the armor it died in, an epitaph from how far it got, what it had been paid, and the sale's transaction. Records at the gate: spectators, shortest life, longest thrown away. Reads `GET /api/graveyard`.
- **Sound** (`lib/sound.ts`): synthesised with Web Audio, no files. Off by default, a speaker button in the top bar, remembered per device. Level up on a Reward, a bright chord for a new No. 1, a pop for a new name on a ledge, a falling cry into lava for a sale, a click on the hotbar, skin dials and chest slots.
- **Diamond hands** (a tab on the scoreboard): the eligible holders ranked by how long they have held, with armor, a live timer and their place by holdings. Reads `GET /api/diamond`.
- **Day and night** (`lib/daytime.ts`): the island follows the clock in Jakarta (WIB). A night layer and stars over the sky bands, a warm layer at dawn and dusk, the sun or the moon on an arc over the island, the lights dim and turn blue, torches flicker, the beacon shines brighter. `?time=22` pins the hour.
- **Live timers** (`lib/clock.tsx`): one shared one-second tick; held-for in the scoreboard, inventory and on hover on the island; spawn countdowns.

## Shared
- `src/world/Miner.tsx`: the miner, golem, mark and portrait as palette grids. `src/lib/icons.tsx`: item icons. `src/lib/pixels.ts`: block textures as CSS variables and as canvases for three.js.
- Styles: `src/styles/game.css` (tokens, base, buttons) and `src/styles/screens.css` (everything above).

## Rules
- Square everything: 4px black outlines, bevels as flat light and dark inset edges, no radius, no blur.
- Light grey windows for things you operate (furnace, inventory, chest, skin); dark translucent panels for lists (scoreboard, chat); dark purple tooltips for descriptions.
- No em or en dashes in visible text. No yield or APY language.
- three.js loads lazily, after the page is on screen. The render loop pauses when the island is off screen or the tab is hidden.
- All motion is off under prefers-reduced-motion (the island stands still, no bobbing, no tweens).
- Never reference Minecraft assets or names on the page. Every texture, model and icon is drawn here.
