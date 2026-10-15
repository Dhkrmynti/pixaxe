# Pixaxe · $PIXAXE

Memecoin site + engine for **$PIXAXE · Pixaxe** (Robinhood Chain 4663, to be launched on Pons). Creator fees run a two-step loop: ETH straight to the **10 biggest wallets that never sold**, then the treasury, then again. No buyback, no burn. Lore and vocabulary: `CONCEPT.md`. Design: `DESIGN.md`.

The engine in `bot/` is the one from `../token2` ($HANG); only the token name in logs, the text a wallet signs, the default port (5031) and two read-only endpoints (`GET /api/graveyard`, every wallet that sold; `GET /api/diamond`, holders by time held) are different. Nothing that claims or sends ETH was changed.

## Run locally

```bash
npm install
npm run bot          # engine + API on 127.0.0.1:5031 (standby until /lotnok is filled)
npm run dev          # site on http://localhost:5193 (proxies /api to 5031)
```

- The local dev server always shows labelled demo data; `http://localhost:5193/?live` shows the real state (empty until the engine has a token). Never share demo screenshots as real numbers.
- `http://localhost:5193/lotnok` is the engine room (add `?live` in dev to see the engine's state).

## Engine (`bot/pads-engine.ts`)

| Step | What happens |
|---|---|
| Indexer | Follows every `$PIXAXE` Transfer from the mint block. Tracks balance, first-buy time and whether the wallet ever sold. Routers are recognised and never counted as holders. |
| Sold | A wallet that sends `$PIXAXE` to the Pons curve, a DEX, or any other contract is out forever. Wallet-to-wallet is fine. |
| The cycle | Each time the Pons fee escrow reaches the current step's size, the engine claims it and spends it on that step: **feeding** `FEEDING_ETH` (0.02) → ETH to the top `FEEDING_TOP_N` (10) holders, split by tier (`FEEDING_TIERS`: No. 1-5 share 70%, No. 6-10 share 30%) and by balance inside each tier · **keeper** `KEEPER_ETH` (0.025) → treasury · back to feeding. |
| Eligible | Never sold, balance ≥ `MIN_BALANCE` (100,000), first $PIXAXE at least `MIN_HOLD_HOURS` old (code default 1 hour; `.env.example` sets 0). |
| Restarts | Every tx hash is saved before it is awaited; a restart resumes the round, so nothing is sent or counted twice. |

Settings come from env or `bot-config.json` (see `.env.example`). Token, operator key and treasury are set in `/lotnok`; every save needs `ADMIN_SECRET`.

## Not done yet

- No token, domain, X account or server exists yet. `X_URL` in `src/lib/api.ts` is empty (hides X links). `public/terms.html` and `public/privacy.html` say `your-domain.example`: change before deploying.
- The VPS deploy scripts from token2 were not copied (they name another project's server and domain).

## Launch checklist

1. Launch $PIXAXE on Pons **from the wallet whose key goes into the engine** (creator fees only reach the launching wallet).
2. Put a little ETH in it for gas.
3. `/lotnok` → CA, key, treasury, admin secret → Save. Check `/api/status` shows the token and an indexed block.
4. The first reward runs once the escrow reaches 0.02 ETH and at least one wallet is eligible.
