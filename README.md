# Token Radar — pre-token protocols ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ilhamx123/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ilhamx123/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A program plus the static dashboard it writes. It reads the sealed DefiLlama
snapshot (`input/snapshot.json`, fetched 2026-11-14), works out which protocols
still record no token and are not a wrapped or staked product of one that
trades, ranks them by what their launch would be worth, and hands in a web
dashboard with the board, a detail view for each protocol and the steps to
farm it.

## Run it

```sh
node main.ts --input <snapshot.json|directory>   # writes /output (or $MAKEFUN_OUTPUT_DIR)
```

Node 22, standard library only, no install. `main.ts` reads the snapshot,
writes `board.json` (178 rows), `data.js` beside the page, copies `dashboard/` and
`screenshots/`, and writes `dossier.json` with the vendored
`vendor/makefun-board.ts`.

## Model — radar-2, comps-calibrated

```
implied = round( tvl_usd x comp_multiple
                 x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
                 x (0.6 + min(age_days, 1095) / 1095 x 0.4)
                 x (1 + min(chains - 1, 4) x 0.02) )
```

- **comp_multiple**: the median market cap per dollar of TVL among the
  live-token protocols in the same DefiLlama category in this same snapshot
  (at least 3 comps), else the global median (0.25x); clamped to 0.05x–1.00x.
  A market cap is what the market already pays per dollar of TVL for a token
  that trades; the median, not the mean, so one outlier cannot set the price.
- **Growth**: seven-day TVL change, clamped, half-weighted.
- **Maturity**: time since first listed, up to 3 years; an unlisted age uses
  365 days.
- **Breadth**: multi-chain distribution, at most +8%.
- No protocol name is special-cased; one function scores every row. The
  dashboard recomputes each row live and checks it against `board.json`.

Headline result on this snapshot: 178 rows, total implied value ≈ $3.1B,
median ≈ $3.7M. Rank 1 is Steakhouse Financial (≈ $578M implied).

## Coverage

- **Watchlist: 40 / 40.** Every protocol on the snapshot's watchlist is ranked.
- **Early radar: 138 rows.** Every pre-token protocol below the $50M floor
  that passes the watchlist's visible exclusion rules (not a bridge, liquid
  staking/restaking product or CEX; not version-named; no wrapped/staked/
  staking word in the name; not named for an exchange).
- **Set aside, not ranked: 92 above-floor pre-token protocols.** The
  watchlist was built with `parentProtocol` data the snapshot does not carry,
  so an above-floor omission is the house's exclusion, not an oversight this
  entry can verify away. That set includes WBTC and Binance staked ETH
  (wrapped/staked products of tokens that already trade), USDT0 (bridged),
  and Sentora Curator and Polymarket International (products of a parent
  protocol). Live-token protocols are shown separately with their market caps.

## What "no token" means

A protocol here *records* no token in the snapshot: market cap, CoinGecko id
and symbol are all null. That is DefiLlama's record, not proof it has none.
An implied value is this model's claim about a launch, never a price, and it
says nothing about whether or when a token is issued.

## Farm plans

Each row carries a six-step plan derived from its own record (category,
chain, TVL, age): a fresh wallet, the category's action at a capital tier
($50 / $100 / $150 / $250 by TVL), a weekly qualifying action, a hold of
30–60 days, claiming only from the protocol's own published link (never pay
to claim), and a farm log. Gas notes are chain-specific (Ethereum ≈ $5,
Solana < $1, otherwise ≈ $2).

## Dashboard

`dashboard/` is a static page (index.html + app.css + app.js, no network, no
framework). Board with search, category and chain filters, a watchlist-only
toggle and sortable columns; a "start here" panel with the top three and
their one main farm action, plus a board.json download; a detail view per
protocol with the full model breakdown and farm plan; a live-token view; a
leaders-by-category table (each category's strongest protocol and the
category's total implied value); the calibration table (category multiples
and comp counts); and the method, coverage and limits, in the page.

## Files

- `main.ts` — the program (root, Node 22)
- `lib/model.ts` — snapshot parsing, comps, valuation, farm plans
- `vendor/makefun-board.ts` — make.fun's dossier library, byte for byte from the kit
- `dashboard/` — the static page
- `screenshots/` — board, protocol detail, filtered view
- `board.json`, `dossier.json` — written by `main.ts` into the output directory

## License

MIT (see LICENSE).

<sub>Entered on [make.fun](https://make.fun/?ref=b78g9j81&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
