# Pixaxe ($PIXAXE) · 15 Oct 2026, renamed from the working name Menkrep

A new lore on the same engine as $HANG (token2). Mechanics and tokenomics are unchanged; the name, ticker, characters, UI and words are new.

## Lore

A hardcore world made of blocks. Hardcore means one life: die once and you only watch from then on.

A floating island with two terraces. The ten biggest holders stand on them. **No. 1 stands on the beacon**, whose light shoots up into the sky. Overtake someone and you walk to your new spot. **Sell once and you fall in the lava**: you are a spectator, for good. The dev wallet is **the golem** on the grass: it guards, never digs, never paid.

- Tagline: **"One life. Don't sell."** Closing line: **"Keep digging."**
- Voice: deadpan, short, a little dry, like a game's rules sign. Never yield, APY, passive income or promises of value.
- Original world and characters. Never use Minecraft's name, logo, font, textures, mobs or characters. The footer says it is not affiliated with Mojang or Microsoft. "pixaxe", "menkrep", "minecraft", "mojang" and "notch" are banned in holder nicknames.

| Word on the site | What it is in the engine |
|---|---|
| **the scoreboard** | the leaderboard |
| **the beacon** | No. 1 |
| **diamond ledge / gold ledge** (the two terraces) | the two reward tiers (No. 1-5 share 0.014 ETH, No. 6-10 share 0.006 ETH of every 0.02 ETH reward) |
| **still in the stone** | ranks 11-50 |
| **spawning** | holding, but the first buy is not old enough yet |
| **spectator / fell in the lava** | sold: out forever |
| **the golem** | the dev wallet |
| **your miner / inventory** | the wallet check |
| **skin** | setting a name, a skin, or an X account (a signed message, no transaction) |
| **the furnace** | the cycle: Reward, then Treasury, then again |
| **smelting** | the fee escrow filling toward the next step |
| **the chest** | the log of every round, with its transaction |
| **advancements** | the rules |
| **XP bar / level** | the escrow filling toward the next step / the number of rounds run |
| **hotbar** | the page navigation (keys 1-7) |
| **chat** | live events: a new No. 1, a new name on a ledge, a sale, a round |

Money always keeps its plain name: Reward, Treasury.

## The miner

One pixel figure (`src/world/Miner.tsx`), used for the ten on the ledges, the portrait on the card and the mark. Four slots, same counts as the engine validates (5, 5, 6, 6):

- Skin tone: Pale, Sand, Tan, Umber, Deep
- Headgear: bare head, hard hat, bandana, leaf crown, bucket
- Gear: nothing, goggles, dust mask, pickaxe, goggles + pickaxe, mask + pickaxe
- Backdrop: grass, sky, cave, lava, night, sand

## Mechanics (unchanged from token2)

1. Every 3 seconds the engine reads the Pons fee escrow. When it reaches the next step's size it claims it.
2. **Reward** (0.02 ETH) → ETH straight to the top 10 by balance, by tier and by balance inside each tier.
3. **Treasury** (0.025 ETH) → the treasury wallet.
4. Again from 2. Over a full loop that is 44% to the ten and 56% to the treasury, shown openly on the page.

No buyback and no burn. To be on a ledge: never sold, at least 100,000 $PIXAXE, and the hold time the server sets.

## Where things are

Name and ticker: `src/lib/brand.ts` (plus the engine logs in `bot/`, the signed text in `bot/byline.ts`, `index.html`, `public/favicon.svg`). The screens: `src/game/`. The 3D island: `src/world3d/Island.tsx`. The miner: `src/world/Miner.tsx`. Styles: `src/styles/game.css` and `screens.css`. Design: `DESIGN.md`.
