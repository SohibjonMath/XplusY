/*
 * OrzuMall external catalog landed-cost calculator.
 * CN imports use one transparent policy: source price + China domestic delivery
 * + overweight fee above 7 kg + tiered OrzuMall markup. The values are kept in
 * one helper so they can be changed later without touching storefront logic.
 */
const POLICY = Object.freeze({
  version: 'china-landed-tier-v1',
  freeWeightKg: 7,
  extraKgRateUzs: 77777,
  kgStep: 1,
  roundToUzs: 500,
  tiers: Object.freeze([
    Object.freeze({ maxCostUzs: 5000, label: '0–5 ming', markupPercent: 100, minProfitUzs: 5000 }),
    Object.freeze({ maxCostUzs: 10000, label: '5–10 ming', markupPercent: 75, minProfitUzs: 5000 }),
    Object.freeze({ maxCostUzs: 20000, label: '10–20 ming', markupPercent: 55, minProfitUzs: 7000 }),
    Object.freeze({ maxCostUzs: 50000, label: '20–50 ming', markupPercent: 40, minProfitUzs: 10000 }),
    Object.freeze({ maxCostUzs: 100000, label: '50–100 ming', markupPercent: 30, minProfitUzs: 15000 }),
    Object.freeze({ maxCostUzs: 250000, label: '100–250 ming', markupPercent: 22, minProfitUzs: 20000 }),
    Object.freeze({ maxCostUzs: 500000, label: '250–500 ming', markupPercent: 17, minProfitUzs: 30000 }),
    Object.freeze({ maxCostUzs: Number.POSITIVE_INFINITY, label: '500 ming+', markupPercent: 12, minProfitUzs: 50000 }),
  ]),
});
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function roundUp(value, step = POLICY.roundToUzs) {
  const safeStep = Math.max(1, Math.round(num(step, POLICY.roundToUzs)));
  return Math.ceil(Math.max(0, num(value, 0)) / safeStep) * safeStep;
}
function tierFor(costUzs) {
  const cost = Math.max(0, num(costUzs, 0));
  return POLICY.tiers.find(tier => cost <= tier.maxCostUzs) || POLICY.tiers[POLICY.tiers.length - 1];
}
function calculateChinaLandedPrice(input = {}) {
  const cnyToUzs = Math.max(1, num(input.cnyToUzs, 1850));
  const sourcePriceUzs = Math.max(0, num(input.sourcePriceUzs, 0) || num(input.sourcePriceCny, 0) * cnyToUzs);
  const chinaDomesticFeeUzs = Math.max(0, num(input.chinaDomesticFeeUzs, 0));
  const weightKg = Math.max(0, num(input.weightKg, 0));
  const freeWeightKg = Math.max(0, num(input.freeWeightKg, POLICY.freeWeightKg));
  const extraKgRateUzs = Math.max(0, num(input.extraKgRateUzs, POLICY.extraKgRateUzs));
  const kgStep = Math.max(0.01, num(input.kgStep, POLICY.kgStep));
  const overweightKgRaw = Math.max(0, weightKg - freeWeightKg);
  const billedExtraKg = overweightKgRaw > 0 ? Math.ceil(overweightKgRaw / kgStep) * kgStep : 0;
  const overweightFeeUzs = roundUp(billedExtraKg * extraKgRateUzs, 1);
  const landedCostUzs = roundUp(sourcePriceUzs + chinaDomesticFeeUzs + overweightFeeUzs, 1);
  const tier = tierFor(landedCostUzs);
  const percentProfitUzs = landedCostUzs * tier.markupPercent / 100;
  const profitUzs = roundUp(Math.max(percentProfitUzs, tier.minProfitUzs), POLICY.roundToUzs);
  const finalPriceUzs = roundUp(landedCostUzs + profitUzs, POLICY.roundToUzs);
  return {
    policyVersion: POLICY.version,
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
    roundToUzs: POLICY.roundToUzs,
  };
}
function publicPolicy() {
  return {
    version: POLICY.version,
    freeWeightKg: POLICY.freeWeightKg,
    extraKgRateUzs: POLICY.extraKgRateUzs,
    kgStep: POLICY.kgStep,
    roundToUzs: POLICY.roundToUzs,
    tiers: POLICY.tiers.map(tier => ({
      maxCostUzs: Number.isFinite(tier.maxCostUzs) ? tier.maxCostUzs : null,
      label: tier.label,
      markupPercent: tier.markupPercent,
      minProfitUzs: tier.minProfitUzs,
    })),
  };
}
module.exports = { POLICY, calculateChinaLandedPrice, publicPolicy, tierFor, roundUp };
