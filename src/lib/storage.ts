// SPDX-License-Identifier: AGPL-3.0-or-later
// zeitgeber — persistence. Everything lives in localStorage on this device.

import type { Plan, PlanInput } from "./circadian";

const PLAN_KEY = "zeitgeber.activePlan.v1";
const FORM_KEY = "zeitgeber.form.v1";

export function saveActivePlan(plan: Plan): void {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  } catch {
    /* storage full or unavailable — the app still works for this session */
  }
}

export function loadActivePlan(): Plan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const plan = JSON.parse(raw) as Plan;
    if (!plan?.days?.length) return null;
    return plan;
  } catch {
    return null;
  }
}

export function clearActivePlan(): void {
  try {
    localStorage.removeItem(PLAN_KEY);
  } catch {
    /* ignore */
  }
}

export function saveForm(input: PlanInput): void {
  try {
    localStorage.setItem(FORM_KEY, JSON.stringify(input));
  } catch {
    /* ignore */
  }
}

export function loadForm(): PlanInput | null {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    return raw ? (JSON.parse(raw) as PlanInput) : null;
  } catch {
    return null;
  }
}
