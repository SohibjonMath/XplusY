/*
 * OrzuMall external catalog landed-cost calculator.
 * Admin-managed CN import policy: source price + China domestic delivery
 * + overweight fee above the configured free limit + tiered OrzuMall markup.
 */
const DEFAULT_TIERS = Object.freeze([
  Object.freeze({ maxCostUzs: 5000, label: '0–5 ming', markupPercent: 45, minProfitUzs: 1500 }),
  Object.freeze({ maxCostUzs: 10000, label: '5–10 ming', markupPercent: 35, minProfitUzs: 2000 }),
  Object.freeze({ maxCostUzs: 20000, label: '10–20 ming', markupPercent: 28, minProfitUzs: 3000 }),
  Object.freeze({ maxCostUzs: 50000, label: '20–50 ming', markupPercent: 22, minProfitUzs: 5000 }),
  Object.freeze({ maxCostUzs: 100000, label: '50–100 ming', markupPercent: 18, minProfitUzs: 7500 }),
  Object.freeze({ maxCostUzs: 250000, label: '100–250 ming', markupPercent: 15, minProfitUzs: 10000 }),
  Object.freeze({ maxCostUzs: 500000, label: '250–500 ming', markupPercent: 12, minProfitUzs: 15000 }),
  Object.freeze({ maxCostUzs: null, label: '500 ming+', markupPercent: 10, minProfitUzs: 25000 }),
]);
const DEFAULT_POLICY = Object.freeze({
  version: 'china-landed-admin-v2',
  freeWeightKg: 7,
  extraKgRateUzs: 77777,
  kgStep: 1,
  roundToUzs: 500,
  tiers: DEFAULT_TIERS,
});
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(value, min, max, fallback) {
  return Math.max(min, Math.min(max, num(value, fallback)));
}
function normalizePolicy(raw = {}) {
  const srcTiers = Array.isArray(raw?.tiers) ? raw.tiers : [];
  return {
    version: 'china-landed-admin-v2',
    freeWeightKg: clamp(raw?.freeWeightKg, 0, 1000, DEFAULT_POLICY.freeWeightKg),
    extraKgRateUzs: Math.round(clamp(raw?.extraKgRateUzs, 0, 1e9, DEFAULT_POLICY.extraKgRateUzs)),
    kgStep: clamp(raw?.kgStep, 0.01, 100, DEFAULT_POLICY.kgStep),
    roundToUzs: Math.round(clamp(raw?.roundToUzs, 1, 100000, DEFAULT_POLICY.roundToUzs)),
    tiers: DEFAULT_TIERS.map((base, index) => ({
      maxCostUzs: base.maxCostUzs,
      label: base.label,
      markupPercent: clamp(srcTiers[index]?.markupPercent, 0, 300, base.markupPercent),
      minProfitUzs: Math.round(clamp(srcTiers[index]?.minProfitUzs, 0, 1e8, base.minProfitUzs)),
    })),
  };
}
function roundUp(value, step = DEFAULT_POLICY.roundToUzs) {
  const safeStep = Math.max(1, Math.round(num(step, DEFAULT_POLICY.roundToUzs)));
  return Math.ceil(Math.max(0, num(value, 0)) / safeStep) * safeStep;
}
function tierFor(costUzs, rawPolicy = DEFAULT_POLICY) {
  const policy = normalizePolicy(rawPolicy);
  const cost = Math.max(0, num(costUzs, 0));
  return policy.tiers.find(tier => tier.maxCostUzs == null || cost <= tier.maxCostUzs) || policy.tiers[policy.tiers.length - 1];
}
function calculateChinaLandedPrice(input = {}, rawPolicy = DEFAULT_POLICY) {
  const policy = normalizePolicy(rawPolicy);
  const cnyToUzs = Math.max(1, num(input.cnyToUzs, 1850));
  const sourcePriceUzs = Math.max(0, num(input.sourcePriceUzs, 0) || num(input.sourcePriceCny, 0) * cnyToUzs);
  const chinaDomesticFeeUzs = Math.max(0, num(input.chinaDomesticFeeUzs, 0));
  const weightKg = Math.max(0, num(input.weightKg, 0));
  const freeWeightKg = Math.max(0, num(input.freeWeightKg, policy.freeWeightKg));
  const extraKgRateUzs = Math.max(0, num(input.extraKgRateUzs, policy.extraKgRateUzs));
  const kgStep = Math.max(0.01, num(input.kgStep, policy.kgStep));
  const overweightKgRaw = Math.max(0, weightKg - freeWeightKg);
  const billedExtraKg = overweightKgRaw > 0 ? Math.ceil(overweightKgRaw / kgStep) * kgStep : 0;
  const overweightFeeUzs = roundUp(billedExtraKg * extraKgRateUzs, 1);
  const landedCostUzs = roundUp(sourcePriceUzs + chinaDomesticFeeUzs + overweightFeeUzs, 1);
  const tier = tierFor(landedCostUzs, policy);
  const percentProfitUzs = landedCostUzs * tier.markupPercent / 100;
  const profitUzs = roundUp(Math.max(percentProfitUzs, tier.minProfitUzs), policy.roundToUzs);
  const finalPriceUzs = roundUp(landedCostUzs + profitUzs, policy.roundToUzs);
  return {
    policyVersion: policy.version,
    sourcePriceUzs: Math.round(sourcePriceUzs),
    sourcePriceCny: Math.max(0, num(input.sourcePriceCny, 0)),
    cnyToUzs,
    chinaDomesticFeeUzs: Math.round(chinaDomesticFeeUzs),
    weightKg,
    freeWeightKg,
    billedExtraKg,
    extraKgRateUzs: Math.round(extraKgRateUzs),
    overweightFeeUzs: Math.round(overweightFeeUzs),
    landedCostUzs: Math.round(landedCostUzs),
    tierLabel: tier.label,
    markupPercent: tier.markupPercent,
    minProfitUzs: tier.minProfitUzs,
    profitUzs: Math.round(profitUzs),
    finalPriceUzs: Math.round(finalPriceUzs),
    roundToUzs: policy.roundToUzs,
  };
}
function publicPolicy(rawPolicy = DEFAULT_POLICY) {
  return normalizePolicy(rawPolicy);
}
async function loadPricingPolicy(db) {
  try {
    const snap = await db.doc('settings/externalCatalogPricing').get();
    return normalizePolicy(snap.exists ? (snap.data() || {}) : {});
  } catch (_e) {
    return normalizePolicy({});
  }
}
async function savePricingPolicy(db, raw = {}, actor = {}) {
  const policy = normalizePolicy(raw);
  const now = new Date().toISOString();
  await db.doc('settings/externalCatalogPricing').set({
    ...policy,
    updatedAt: now,
    updatedBy: String(actor?.email || actor?.uid || 'admin').slice(0, 180),
  }, { merge: false });
  return policy;
}
module.exports = {
  DEFAULT_POLICY,
  normalizePolicy,
  calculateChinaLandedPrice,
  publicPolicy,
  loadPricingPolicy,
  savePricingPolicy,
  tierFor,
  roundUp,
};
