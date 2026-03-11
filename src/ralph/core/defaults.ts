import type { ComplexityTier } from './complexity.js';

export interface Pricing {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export interface TierConfig {
  maxTurns: number;
  timeout: number;
}

export type TierScaling = Record<ComplexityTier, TierConfig>;

const DEFAULT_PRICING: Pricing = {
  input: 3.0,
  cacheWrite: 3.75,
  cacheRead: 0.3,
  output: 15.0,
};

const DEFAULT_TIER_SCALING: TierScaling = {
  light: { maxTurns: 50, timeout: 600 },
  standard: { maxTurns: 75, timeout: 900 },
  heavy: { maxTurns: 125, timeout: 1200 },
};

function parsePositiveFloat(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseFloat(value);
  if (isNaN(num)) return undefined;
  return num;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = parseInt(value, 10);
  if (isNaN(num) || num <= 0) return undefined;
  return num;
}

export function getPricing(): Pricing {
  return {
    input: parsePositiveFloat(process.env.RALPH_PRICE_INPUT) ?? DEFAULT_PRICING.input,
    cacheWrite:
      parsePositiveFloat(process.env.RALPH_PRICE_CACHE_WRITE) ?? DEFAULT_PRICING.cacheWrite,
    cacheRead: parsePositiveFloat(process.env.RALPH_PRICE_CACHE_READ) ?? DEFAULT_PRICING.cacheRead,
    output: parsePositiveFloat(process.env.RALPH_PRICE_OUTPUT) ?? DEFAULT_PRICING.output,
  };
}

export function getTierScaling(): TierScaling {
  return {
    light: {
      maxTurns:
        parsePositiveInt(process.env.RALPH_TIER_LIGHT_MAX_TURNS) ??
        DEFAULT_TIER_SCALING.light.maxTurns,
      timeout:
        parsePositiveInt(process.env.RALPH_TIER_LIGHT_TIMEOUT) ??
        DEFAULT_TIER_SCALING.light.timeout,
    },
    standard: {
      maxTurns:
        parsePositiveInt(process.env.RALPH_TIER_STANDARD_MAX_TURNS) ??
        DEFAULT_TIER_SCALING.standard.maxTurns,
      timeout:
        parsePositiveInt(process.env.RALPH_TIER_STANDARD_TIMEOUT) ??
        DEFAULT_TIER_SCALING.standard.timeout,
    },
    heavy: {
      maxTurns:
        parsePositiveInt(process.env.RALPH_TIER_HEAVY_MAX_TURNS) ??
        DEFAULT_TIER_SCALING.heavy.maxTurns,
      timeout:
        parsePositiveInt(process.env.RALPH_TIER_HEAVY_TIMEOUT) ??
        DEFAULT_TIER_SCALING.heavy.timeout,
    },
  };
}
