// SPDX-License-Identifier: AGPL-3.0-or-later
// zeitgeber — the planning engine.
//
// Model, kept deliberately simple and documented in README.md:
//   * Your circadian phase is anchored to your habitual sleep. The core body
//     temperature minimum (CBTmin) sits ~2.5 h before habitual wake.
//   * Light after CBTmin advances the clock; light before CBTmin delays it.
//     In practical terms: to ADVANCE, seek bright light on waking and keep the
//     late evening dim; to DELAY, seek bright light in the evening and shield
//     your eyes for the first stretch after waking.
//   * Sustainable shift rates: ~1.0 h/day advancing, ~1.5 h/day delaying.
//   * Caffeine clearance is slow; cutoff is 8 h before each night's bedtime.
// This is a planning heuristic drawn from the chronobiology literature, not
// medical advice.

import { fmtDay, offsetMinutes, wallParts, wallToUtc } from "./tz";

export const ADVANCE_RATE_H = 1.0; // hours/day, sleeping earlier
export const DELAY_RATE_H = 1.5; // hours/day, sleeping later
export const CBT_BEFORE_WAKE_H = 2.5;
export const LIGHT_SEEK_H = 2.5; // duration of bright-light block
export const LIGHT_AVOID_H = 2.5; // duration of dim/shield block
export const CAFFEINE_CUTOFF_H = 8;

export type Mode = "travel" | "shift";
export type Direction = "advance" | "delay";

export interface PlanInput {
  mode: Mode;
  originTz: string;
  destTz: string; // === originTz in shift mode
  /** habitual bedtime / wake, minutes after midnight, origin wall clock */
  bedMin: number;
  wakeMin: number;
  /** target bedtime / wake, minutes after midnight, destination wall clock */
  targetBedMin: number;
  targetWakeMin: number;
  /** first day of the plan, origin wall date */
  startYear: number;
  startMonth: number; // 1-12
  startDay: number;
  /** 0-based day index on which you switch to the destination clock (travel day). */
  switchDayIndex: number;
}

export interface Interval {
  start: number; // UTC ms
  end: number; // UTC ms
}

export interface DayPlan {
  index: number;
  /** zone this day should be lived (and displayed) in */
  tz: string;
  dateLabel: string;
  sleep: Interval;
  lightSeek: Interval;
  lightAvoid: Interval;
  caffeineCutoff: number; // UTC ms
  cbtMin: number; // UTC ms — the internal anchor
  isTravelDay: boolean;
  isFinal: boolean;
}

export interface Plan {
  input: PlanInput;
  direction: Direction;
  /** total phase shift being applied, hours, in the chosen direction */
  shiftHours: number;
  days: DayPlan[];
  createdAt: number;
}

const H = 3_600_000;
const MIN = 60_000;

function mod24(h: number): number {
  return ((h % 24) + 24) % 24;
}

/**
 * Phase difference between current and target sleep, measured as an absolute
 * (UTC-anchored) gap so timezone changes are handled for free.
 * Returns hours in [0, 24): how far bedtime must move EARLIER (advance) to
 * land on target. Delay distance is 24 minus that.
 */
export function advanceGapHours(input: PlanInput, refUtc: number): number {
  const originOff = offsetMinutes(input.originTz, refUtc) / 60;
  const destOff = offsetMinutes(input.destTz, refUtc) / 60;
  const bedUtcNow = input.bedMin / 60 - originOff; // hours, mod 24
  const bedUtcTarget = input.targetBedMin / 60 - destOff;
  return mod24(bedUtcNow - bedUtcTarget);
}

export function chooseDirection(advGap: number): { direction: Direction; shiftHours: number; days: number } {
  const adv = advGap;
  const del = mod24(24 - advGap);
  const advDays = Math.ceil(adv / ADVANCE_RATE_H - 1e-9);
  const delDays = Math.ceil(del / DELAY_RATE_H - 1e-9);
  // Prefer the faster route; on a tie, delaying is physiologically easier.
  if (advDays < delDays) return { direction: "advance", shiftHours: adv, days: advDays };
  return { direction: "delay", shiftHours: del, days: delDays };
}

export function buildPlan(input: PlanInput): Plan {
  const refUtc = wallToUtc(input.originTz, input.startYear, input.startMonth, input.startDay, 12, 0);
  const advGap = advanceGapHours(input, refUtc);
  const { direction, shiftHours, days: shiftDays } = chooseDirection(advGap);

  // Day count: at least the days needed to shift, at least one day past the
  // switch day so the arrival is visible, capped for sanity.
  const nDays = Math.min(21, Math.max(shiftDays + 1, input.switchDayIndex + 2, 2));

  const sleepLenMin0 = mod24((input.wakeMin - input.bedMin) / 60) * 60 || 480;
  const sleepLenMinT = mod24((input.targetWakeMin - input.targetBedMin) / 60) * 60 || 480;

  // Anchor: bedtime instant on day 0 (bed "tonight" relative to the start date noon).
  let bed0 = wallToUtc(input.originTz, input.startYear, input.startMonth, input.startDay, Math.floor(input.bedMin / 60), input.bedMin % 60);
  if (bed0 < refUtc - 6 * H) bed0 += 24 * H; // bedtimes after midnight belong to the next calendar date

  const signed = direction === "advance" ? -1 : 1;
  const rate = (direction === "advance" ? ADVANCE_RATE_H : DELAY_RATE_H) * H;

  const days: DayPlan[] = [];
  for (let i = 0; i < nDays; i++) {
    const shifted = Math.min(i * (rate / H), shiftHours); // hours shifted by tonight
    const done = shifted >= shiftHours - 1e-9;
    // Each successive night is 24 h later, plus the accumulated phase shift.
    const bed = bed0 + i * 24 * H + signed * shifted * H;
    const frac = shiftHours === 0 ? 1 : shifted / shiftHours;
    const sleepLen = (sleepLenMin0 + (sleepLenMinT - sleepLenMin0) * frac) * MIN;
    const wake = bed + sleepLen;

    const cbtMin = wake - CBT_BEFORE_WAKE_H * H;

    let lightSeek: Interval;
    let lightAvoid: Interval;
    if (direction === "advance") {
      lightSeek = { start: wake, end: wake + LIGHT_SEEK_H * H };
      lightAvoid = { start: bed - LIGHT_AVOID_H * H, end: bed };
    } else {
      lightSeek = { start: bed - LIGHT_SEEK_H * H, end: bed };
      lightAvoid = { start: wake, end: wake + LIGHT_AVOID_H * H };
    }

    const tz = i >= input.switchDayIndex ? input.destTz : input.originTz;
    // Label the day by the wall date at the *start* of its noon-to-noon strip.
    const stripStart = noonBefore(tz, bed);
    days.push({
      index: i,
      tz,
      dateLabel: fmtDay(tz, stripStart),
      sleep: { start: bed, end: wake },
      lightSeek,
      lightAvoid,
      caffeineCutoff: bed - CAFFEINE_CUTOFF_H * H,
      cbtMin,
      isTravelDay: input.mode === "travel" && i === input.switchDayIndex,
      isFinal: done,
    });
    if (done && i >= input.switchDayIndex + 1) break;
  }

  return { input, direction, shiftHours, days, createdAt: Date.now() };
}

/** The most recent local noon at or before `utcMs` in `tz`. */
export function noonBefore(tz: string, utcMs: number): number {
  const w = wallParts(tz, utcMs);
  let noon = wallToUtc(tz, w.year, w.month, w.day, 12, 0);
  if (noon > utcMs) noon -= 24 * H;
  return noon;
}

/** Human summary like "Advance 7 h over 7 days". */
export function planSummary(plan: Plan): string {
  const h = Math.round(plan.shiftHours * 10) / 10;
  if (h < 0.5) return "You're already aligned — no shift needed";
  const dir = plan.direction === "advance" ? "Advance" : "Delay";
  const n = plan.days.filter((d) => !d.isFinal).length + 1;
  return `${dir} ${h} h over ${n} day${n === 1 ? "" : "s"}`;
}

export type NowStatus =
  | { kind: "sleep"; until: number }
  | { kind: "seek"; until: number }
  | { kind: "avoid"; until: number }
  | { kind: "nocaffeine"; until: number }
  | { kind: "free"; next: string; at: number; tz: string }
  | { kind: "done" };

/** What the plan asks of you at instant `now`. */
export function statusAt(plan: Plan, now: number): NowStatus {
  const last = plan.days[plan.days.length - 1];
  if (now > last.sleep.end) return { kind: "done" };
  for (const d of plan.days) {
    if (now >= d.sleep.start && now < d.sleep.end) return { kind: "sleep", until: d.sleep.end };
    if (now >= d.lightSeek.start && now < d.lightSeek.end) return { kind: "seek", until: d.lightSeek.end };
    if (now >= d.lightAvoid.start && now < d.lightAvoid.end) return { kind: "avoid", until: d.lightAvoid.end };
    if (now >= d.caffeineCutoff && now < d.sleep.start) return { kind: "nocaffeine", until: d.sleep.start };
  }
  // Free time: find the next scheduled thing.
  let bestAt = Infinity;
  let bestLabel = "";
  let bestTz = plan.input.originTz;
  for (const d of plan.days) {
    const events: Array<[number, string]> = [
      [d.lightSeek.start, "bright light"],
      [d.lightAvoid.start, "dim light"],
      [d.caffeineCutoff, "caffeine cutoff"],
      [d.sleep.start, "bedtime"],
    ];
    for (const [at, label] of events) {
      if (at > now && at < bestAt) {
        bestAt = at;
        bestLabel = label;
        bestTz = d.tz;
      }
    }
  }
  if (bestAt === Infinity) return { kind: "done" };
  return { kind: "free", next: bestLabel, at: bestAt, tz: bestTz };
}

/** Minutes into a noon-to-noon strip for a UTC instant. */
export function stripPos(stripStartUtc: number, utcMs: number): number {
  return (utcMs - stripStartUtc) / MIN;
}
