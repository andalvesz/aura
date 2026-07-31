/**
 * First Value metric — time from signup to first meaningful action.
 */

import {
  getBetaOpsState,
  newId,
  nowIso,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type { FirstValueEvent, FirstValueType } from "@/lib/beta-ops/types";
import { recordProductEventPure } from "@/lib/beta-ops/analytics";

export function recordSignupAt(userId: string, at = nowIso()): void {
  const s = getBetaOpsState();
  if (!s.signupAtByUser[userId]) {
    s.signupAtByUser[userId] = at;
  }
}

export function recordOnboardingCompletedAt(userId: string, at = nowIso()): void {
  getBetaOpsState().onboardingCompletedAtByUser[userId] = at;
}

export function recordFirstValuePure(
  state: BetaOpsState,
  input: {
    userId: string;
    type: FirstValueType;
    at?: string;
  }
): { state: BetaOpsState; event: FirstValueEvent | null; alreadyHad: boolean } {
  if (state.firstValueEvents.some((e) => e.userId === input.userId)) {
    return { state, event: null, alreadyHad: true };
  }
  const at = input.at ?? nowIso();
  const signupAt = state.signupAtByUser[input.userId] ?? at;
  const onboardingCompletedAt = state.onboardingCompletedAtByUser[input.userId] ?? null;
  const event: FirstValueEvent = {
    id: newId("fv"),
    userId: input.userId,
    signupAt,
    onboardingCompletedAt,
    firstValueAt: at,
    firstValueType: input.type,
    timeToFirstValueMs: Math.max(0, new Date(at).getTime() - new Date(signupAt).getTime()),
  };
  let next: BetaOpsState = {
    ...state,
    firstValueEvents: [...state.firstValueEvents, event],
  };
  const pe = recordProductEventPure(next, {
    name: "first_value",
    userId: input.userId,
    metadata: { type: input.type, timeToFirstValueMs: event.timeToFirstValueMs },
    consentOverride: { essential: true, product: true, performance: true, providers: false },
  });
  next = pe.state;
  return { state: next, event, alreadyHad: false };
}

export function recordFirstValue(input: Parameters<typeof recordFirstValuePure>[1]) {
  const res = recordFirstValuePure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}

export function getFirstValueForUser(
  userId: string,
  state = getBetaOpsState()
): FirstValueEvent | null {
  return state.firstValueEvents.find((e) => e.userId === userId) ?? null;
}

export function averageTimeToFirstValueMs(state = getBetaOpsState()): number | null {
  if (!state.firstValueEvents.length) return null;
  const sum = state.firstValueEvents.reduce((a, e) => a + e.timeToFirstValueMs, 0);
  return Math.round(sum / state.firstValueEvents.length);
}
