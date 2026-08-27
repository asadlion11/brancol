import { describe, expect, it } from "vitest";

import {
  attemptBudget,
  createDeadline,
  FIRST_ATTEMPT_MS,
  MIN_ATTEMPT_MS,
  RESPONSE_RESERVE_MS,
  TOTAL_BUDGET_MS,
} from "../ai/openrouter";

/**
 * The whole point of the budget: 30s has to cover BOTH model attempts. A naive
 * 30s timeout on attempt 1 would leave nothing for failover.
 */
describe("timeout budgeting", () => {
  const total = TOTAL_BUDGET_MS - RESPONSE_RESERVE_MS;

  it("keeps the total under the route's maxDuration", () => {
    expect(TOTAL_BUDGET_MS).toBe(30_000);
    expect(total).toBeLessThan(TOTAL_BUDGET_MS);
  });

  it("gives the first of two attempts ~12s, not the whole budget", () => {
    const first = attemptBudget(total, 2);
    expect(first).toBe(FIRST_ATTEMPT_MS);
    expect(first).toBeLessThan(total / 2 + 1);
  });

  it("hands the entire remainder to the final attempt", () => {
    const remaining = total - FIRST_ATTEMPT_MS;
    expect(attemptBudget(remaining, 1)).toBe(remaining);
    expect(attemptBudget(remaining, 1)).toBeGreaterThan(FIRST_ATTEMPT_MS);
  });

  it("two attempts always fit inside the budget", () => {
    const first = attemptBudget(total, 2);
    const second = attemptBudget(total - first, 1);
    expect(first + second).toBeLessThanOrEqual(total);
  });

  it("shares the budget out when a third model is added by env alone", () => {
    const first = attemptBudget(total, 3);
    const second = attemptBudget(total - first, 2);
    const third = attemptBudget(total - first - second, 1);

    expect(first + second + third).toBeLessThanOrEqual(total);
    for (const slice of [first, second, third]) {
      expect(slice).toBeGreaterThanOrEqual(MIN_ATTEMPT_MS);
    }
  });

  it("never hands an attempt more time than the deadline has left", () => {
    // The MIN_ATTEMPT_MS floor must not be able to outlive the shared budget —
    // that is what pushed a request past maxDuration.
    expect(attemptBudget(1_000, 4)).toBe(1_000);
    for (const remaining of [0, 500, 3_000, 9_000, 27_500]) {
      expect(attemptBudget(remaining, 2)).toBeLessThanOrEqual(remaining);
    }
  });

  it("tracks remaining and elapsed time", () => {
    const deadline = createDeadline(5_000);
    expect(deadline.remaining()).toBeLessThanOrEqual(5_000);
    expect(deadline.remaining()).toBeGreaterThan(4_900);
    expect(deadline.elapsed()).toBeLessThan(100);
    expect(deadline.expired()).toBe(false);
  });

  it("reports an exhausted budget as expired with zero remaining", () => {
    const deadline = createDeadline(-1);
    expect(deadline.expired()).toBe(true);
    expect(deadline.remaining()).toBe(0);
  });
});
