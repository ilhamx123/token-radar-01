// Token Radar model v2 ("radar-2"): comps-calibrated implied value.
//
// Every figure comes from the sealed snapshot alone. No protocol name is
// special-cased; one function scores every row.
//
// Valuation (implied value of a launch, if the record stayed as it is):
//   compMultiple = median(mcap_usd / tvl_usd) over live-token protocols in the
//                  same DefiLlama category (n >= 3), else the global median
//                  over all live-token protocols; clamped to [0.05, 1.00].
//                  A market cap is what the market already pays per dollar of
//                  TVL for a token that trades; the median, not the mean, so
//                  one outlier cannot set the price.
//   growthMult   = 1 + clamp(change_7d, -60, 120) / 100 * 0.5
//   maturityMult = 0.6 + min(age_days, 1095) / 1095 * 0.4   (unknown age: 365)
//   breadthMult  = 1 + min(max(chains - 1, 0), 4) * 0.02    (multi-chain reach)
//   implied      = max(1, round(tvl_usd * compMultiple * growthMult
//                        * maturityMult * breadthMult))
//
// Coverage: the whole watchlist (40) plus every pre-token protocol BELOW the
// watchlist floor that passes the watchlist's own visible exclusion rules
// (not CEX / Bridge / Canonical Bridge / Liquid Staking / Liquid Restaking /
// Restaked BTC, not version-named, no whole word wrapped/staked/staking in the
// name, not named for an exchange). Above the floor, a pre-token protocol the
// watchlist leaves out is NOT added: the watchlist was built with
// parentProtocol data the snapshot does not carry, so an above-floor omission
// is the house's exclusion, not an oversight we can verify away. 92 such
// protocols are set aside (WBTC, Binance staked ETH, USDT0, Sentora Curator,
// Polymarket International, ...); they are named in the dashboard's method
// note, not ranked. Below the floor the visible rules are the whole test.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  min_comps: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_floor: 0.05,
  multiple_cap: 1.0,
  min_comps: 3,
  breadth_per_chain: 0.02,
  breadth_max_chains: 4,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    comp_multiple: number;
    comp_multiple_raw: number;
    comp_n: number;
    comp_source: 'category' | 'global';
    growth_pct: number;
    growth_multiplier: number;
    growth_multiplier_raw: number;
    maturity_multiplier: number;
    maturity_multiplier_raw: number;
    breadth_multiplier: number;
    breadth_multiplier_raw: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  comp_multiple: number;
  comp_n: number;
  comp_source: 'category' | 'global';
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's calibration: the multiple the model used and how it was set. */
export interface CompRow {
  category: string;
  multiple: number;
  n: number;
  source: 'category' | 'global';
}

/** One category's leader: its strongest protocol, how many rows it holds, and their implied value. */
export interface CategoryLeader {
  category: string;
  rows: number;
  total_implied_usd: number;
  leader_slug: string;
  leader_name: string;
  leader_implied_usd: number;
}

/** The strongest protocol of each category, most implied value first. */
export function categoryLeaders(board: BoardRow[]): CategoryLeader[] {
  const byCategory = new Map<string, BoardRow[]>();
  for (const row of board) {
    const key = row.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(row);
    byCategory.set(key, list);
  }
  const leaders: CategoryLeader[] = [];
  for (const [category, rows] of byCategory) {
    const sorted = [...rows].sort((a, b) => b.implied_value_usd - a.implied_value_usd);
    const leader = sorted[0]!;
    leaders.push({
      category,
      rows: rows.length,
      total_implied_usd: rows.reduce((n, r) => n + r.implied_value_usd, 0),
      leader_slug: leader.slug,
      leader_name: leader.name,
      leader_implied_usd: leader.implied_value_usd,
    });
  }
  return leaders.sort((a, b) => b.total_implied_usd - a.total_implied_usd || (a.category < b.category ? -1 : 1));
}

/** Everything the dashboard needs: the board, the live set, the comps and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  excluded_above_floor: number;
  total_implied_usd: number;
  median_implied_usd: number;
  comps: CompRow[];
  leaders: CategoryLeader[];
  global_multiple: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a sorted-or-not list of numbers. */
function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Live-token comps: per-category median mcap/TVL, and the global median fallback. */
export function buildComps(snapshot: Snapshot): { byCategory: Map<string, { multiple: number; n: number }>; global: number } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.gecko_id === null || p.symbol === null) continue;
    if (p.category === 'CEX' || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    all.push(ratio);
    const key = p.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(ratio);
    byCategory.set(key, list);
  }
  const global = Math.min(MODEL.multiple_cap, Math.max(MODEL.multiple_floor, median(all)));
  const out = new Map<string, { multiple: number; n: number }>();
  for (const [cat, list] of byCategory) {
    if (list.length >= MODEL.min_comps) {
      out.set(cat, { multiple: Math.min(MODEL.multiple_cap, Math.max(MODEL.multiple_floor, median(list))), n: list.length });
    }
  }
  return { byCategory: out, global };
}

/** The comp multiple one protocol gets: its category's median, or the global median. */
export function compFor(p: SnapshotProtocol, comps: { byCategory: Map<string, { multiple: number; n: number }>; global: number }): { multiple: number; n: number; source: 'category' | 'global' } {
  const hit = p.category === null ? undefined : comps.byCategory.get(p.category);
  if (hit !== undefined) return { multiple: hit.multiple, n: hit.n, source: 'category' };
  return { multiple: comps.global, n: 0, source: 'global' };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  comps: { byCategory: Map<string, { multiple: number; n: number }>; global: number },
): { implied: number; comp: { multiple: number; n: number; source: 'category' | 'global' }; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const comp = compFor(protocol, comps);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult = 1 + Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains) * model.breadth_per_chain;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * comp.multiple * growthMult * maturityMult * breadthMult));
  return { implied, comp, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** The watchlist's wrapped / staked / bridged exclusion, as the snapshot's README states it. */
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol passes the watchlist's visible exclusion rules (no parentProtocol data needed). */
export function passesExclusions(p: SnapshotProtocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** Whether a protocol is one the board may rank below the floor: pre-token and not excluded. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && passesExclusions(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const comps = buildComps(snapshot);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols BELOW the watchlist floor, by TVL, uncapped.
  // Above the floor the watchlist is the whole test: a pre-token protocol it
  // leaves out there stays out (parentProtocol data the snapshot lacks).
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => ({ p, ...impliedValue(p, snapshot.as_of, model, comps) }));
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      comp_multiple: round4(s.comp.multiple),
      comp_multiple_raw: s.comp.multiple,
      comp_n: s.comp.n,
      comp_source: s.comp.source,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      growth_multiplier_raw: s.growthMult,
      maturity_multiplier: round4(s.maturityMult),
      maturity_multiplier_raw: s.maturityMult,
      breadth_multiplier: round4(s.breadthMult),
      breadth_multiplier_raw: s.breadthMult,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open; borrow a small amount once so both sides of the market are used.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
  if (c.includes('yield') || c.includes('aggregator')) return `Deposit $${capital} of USDC into ${name}'s main yield vault on ${chain} and keep the shares until the position has earned.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and hold the receipt; check the funding rate it publishes before adding more.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged trade, then close it.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} on ${chain} and place one market position; a resolved position counts more than an open one.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and keep the shares; the curator, not you, picks the underlying markets.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol's own app.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it; keep the receipt the protocol issues.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full term.`;
  if (c.includes('restak') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('payment')) return `Pay or receive $${capital} through ${name} on ${chain} once a week so the wallet shows repeated use, not one transfer.`;
  if (c.includes('governance') || c.includes('incentive')) return `Lock or stake $${capital} in ${name}'s incentives on ${chain} and vote on one proposal while it is open.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain and use it in one app there, so the wallet is active on the chain itself.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's second, activity-specific step. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Repay part of the borrow and supply again once, so the position shows two-way use.';
  if (c.includes('dex')) return 'Swap a small amount in the same pool once a week, so the wallet is a trader as well as a provider.';
  if (c.includes('yield') || c.includes('aggregator') || c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'Check the vault page each week and top up a small amount once, so the position grows instead of sitting still.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'Open and close one more small trade a week later; never leave a large position open overnight.';
  if (c.includes('prediction')) return 'Settle one market and enter another, so the wallet has a finished record, not just open bets.';
  if (c.includes('rwa')) return 'Reinvest one distribution back into the same asset, so the position compounds on-chain.';
  if (c.includes('insurance')) return 'Renew or extend the cover once before it lapses, so the policy history is continuous.';
  if (c.includes('governance') || c.includes('incentive')) return 'Vote on a second proposal when one opens, and delegate only if the protocol itself offers it.';
  return `Use the protocol's main feature once a week on ${chain}, such as a deposit, a swap or a vote.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const gas = chain === 'Ethereum' ? 'about $5 of gas' : chain === 'Solana' ? 'under $1 of fees' : 'about $2 of gas';
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas} to set up`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, chain),
      cost: `${gas} a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay a fee to claim, and never sign a transaction a stranger sent you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    comp_multiple: row.model.comp_multiple_raw,
    comp_n: row.model.comp_n,
    comp_source: row.model.comp_source,
    growth_multiplier: row.model.growth_multiplier_raw,
    maturity_multiplier: row.model.maturity_multiplier_raw,
    breadth_multiplier: row.model.breadth_multiplier_raw,
    watchlist: watchlist.has(row.slug),
  };
}

/** How many above-floor pre-token protocols the watchlist leaves out (set aside, not ranked). */
export function excludedAboveFloor(snapshot: Snapshot): number {
  const wl = new Set(snapshot.watchlist);
  return snapshot.protocols.filter((p) => isPreToken(p) && p.tvl_usd >= snapshot.floor_usd && !wl.has(p.slug)).length;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const comps = buildComps(snapshot);
  const wl = new Set(snapshot.watchlist);
  const early = board.filter((r) => !wl.has(r.slug)).length;
  const implied = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const compRows: CompRow[] = [...comps.byCategory.entries()]
    .map(([category, v]) => ({ category, multiple: round4(v.multiple), n: v.n, source: 'category' as const }))
    .sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    excluded_above_floor: excludedAboveFloor(snapshot),
    total_implied_usd: implied.reduce((a, b) => a + b, 0),
    median_implied_usd: implied.length % 2 === 1 ? implied[Math.floor(implied.length / 2)]! : Math.round((implied[implied.length / 2 - 1]! + implied[implied.length / 2]!) / 2),
    comps: compRows,
    leaders: categoryLeaders(board),
    global_multiple: round4(comps.global),
    rows: board.map((r) => radarRow(r, wl)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
