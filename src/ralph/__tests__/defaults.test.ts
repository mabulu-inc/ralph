import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPricing, getTierScaling } from '../core/defaults.js';

describe('getPricing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default pricing when no env vars are set', () => {
    delete process.env.RALPH_PRICE_INPUT;
    delete process.env.RALPH_PRICE_CACHE_WRITE;
    delete process.env.RALPH_PRICE_CACHE_READ;
    delete process.env.RALPH_PRICE_OUTPUT;

    const pricing = getPricing();
    expect(pricing).toEqual({
      input: 3.0,
      cacheWrite: 3.75,
      cacheRead: 0.3,
      output: 15.0,
    });
  });

  it('overrides input price from RALPH_PRICE_INPUT', () => {
    process.env.RALPH_PRICE_INPUT = '5.0';
    const pricing = getPricing();
    expect(pricing.input).toBe(5.0);
    expect(pricing.cacheWrite).toBe(3.75);
  });

  it('overrides cache write price from RALPH_PRICE_CACHE_WRITE', () => {
    process.env.RALPH_PRICE_CACHE_WRITE = '4.5';
    const pricing = getPricing();
    expect(pricing.cacheWrite).toBe(4.5);
  });

  it('overrides cache read price from RALPH_PRICE_CACHE_READ', () => {
    process.env.RALPH_PRICE_CACHE_READ = '0.5';
    const pricing = getPricing();
    expect(pricing.cacheRead).toBe(0.5);
  });

  it('overrides output price from RALPH_PRICE_OUTPUT', () => {
    process.env.RALPH_PRICE_OUTPUT = '20.0';
    const pricing = getPricing();
    expect(pricing.output).toBe(20.0);
  });

  it('ignores invalid (non-numeric) env var values', () => {
    process.env.RALPH_PRICE_INPUT = 'not-a-number';
    const pricing = getPricing();
    expect(pricing.input).toBe(3.0);
  });

  it('ignores empty string env vars', () => {
    process.env.RALPH_PRICE_INPUT = '';
    const pricing = getPricing();
    expect(pricing.input).toBe(3.0);
  });
});

describe('getTierScaling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns default tier scaling when no env vars are set', () => {
    const scaling = getTierScaling();
    expect(scaling).toEqual({
      light: { maxTurns: 50, timeout: 600 },
      standard: { maxTurns: 75, timeout: 900 },
      heavy: { maxTurns: 125, timeout: 1200 },
    });
  });

  it('overrides light tier maxTurns from RALPH_TIER_LIGHT_MAX_TURNS', () => {
    process.env.RALPH_TIER_LIGHT_MAX_TURNS = '30';
    const scaling = getTierScaling();
    expect(scaling.light.maxTurns).toBe(30);
    expect(scaling.light.timeout).toBe(600);
  });

  it('overrides light tier timeout from RALPH_TIER_LIGHT_TIMEOUT', () => {
    process.env.RALPH_TIER_LIGHT_TIMEOUT = '300';
    const scaling = getTierScaling();
    expect(scaling.light.timeout).toBe(300);
    expect(scaling.light.maxTurns).toBe(50);
  });

  it('overrides standard tier values', () => {
    process.env.RALPH_TIER_STANDARD_MAX_TURNS = '100';
    process.env.RALPH_TIER_STANDARD_TIMEOUT = '1000';
    const scaling = getTierScaling();
    expect(scaling.standard).toEqual({ maxTurns: 100, timeout: 1000 });
  });

  it('overrides heavy tier values', () => {
    process.env.RALPH_TIER_HEAVY_MAX_TURNS = '200';
    process.env.RALPH_TIER_HEAVY_TIMEOUT = '1800';
    const scaling = getTierScaling();
    expect(scaling.heavy).toEqual({ maxTurns: 200, timeout: 1800 });
  });

  it('ignores invalid (non-numeric) env var values', () => {
    process.env.RALPH_TIER_LIGHT_MAX_TURNS = 'abc';
    const scaling = getTierScaling();
    expect(scaling.light.maxTurns).toBe(50);
  });

  it('ignores negative values', () => {
    process.env.RALPH_TIER_LIGHT_TIMEOUT = '-100';
    const scaling = getTierScaling();
    expect(scaling.light.timeout).toBe(600);
  });

  it('ignores zero values', () => {
    process.env.RALPH_TIER_LIGHT_MAX_TURNS = '0';
    const scaling = getTierScaling();
    expect(scaling.light.maxTurns).toBe(50);
  });
});
