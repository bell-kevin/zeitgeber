// SPDX-License-Identifier: AGPL-3.0-or-later
// Run with: npm run selftest
import {
  advanceGapHours,
  buildPlan,
  chooseDirection,
  statusAt,
  type PlanInput,
} from "../src/lib/circadian";
import { planToIcs } from "../src/lib/ics";
import { fmtTime, offsetMinutes, wallToUtc } from "../src/lib/tz";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.error(`  FAIL ${name} ${detail}`);
  }
}

function baseInput(over: Partial<PlanInput>): PlanInput {
  return {
    mode: "travel",
    originTz: "America/Denver",
    destTz: "Asia/Tokyo",
    bedMin: 23 * 60,
    wakeMin: 7 * 60,
    targetBedMin: 23 * 60,
    targetWakeMin: 7 * 60,
    startYear: 2026,
    startMonth: 7,
    startDay: 22,
    switchDayIndex: 3,
    ...over,
  };
}

console.log("zone offsets sanity");
{
  const jul = Date.UTC(2026, 6, 22, 12);
  check("Denver is UTC-6 in July", offsetMinutes("America/Denver", jul) === -360);
  check("Tokyo is UTC+9", offsetMinutes("Asia/Tokyo", jul) === 540);
  check("London is UTC+1 in July", offsetMinutes("Europe/London", jul) === 60);
}

console.log("direction choice");
{
  const tokyo = baseInput({});
  const gap = advanceGapHours(tokyo, Date.UTC(2026, 6, 22, 12));
  check("Denver→Tokyo advance gap is 15 h", Math.abs(gap - 15) < 1e-6, `got ${gap}`);
  const pick = chooseDirection(gap);
  check("Denver→Tokyo goes the delay way (9 h)", pick.direction === "delay" && Math.abs(pick.shiftHours - 9) < 1e-6);

  const london = baseInput({ destTz: "Europe/London" });
  const gapL = advanceGapHours(london, Date.UTC(2026, 6, 22, 12));
  const pickL = chooseDirection(gapL);
  check("Denver→London advances 7 h", pickL.direction === "advance" && Math.abs(pickL.shiftHours - 7) < 1e-6, `got ${pickL.direction} ${pickL.shiftHours}`);
}

console.log("plan construction");
{
  const plan = buildPlan(baseInput({ destTz: "Europe/London", switchDayIndex: 2 }));
  check("direction advance", plan.direction === "advance");
  const beds = plan.days.map((d) => d.sleep.start);
  let monotonic = true;
  for (let i = 1; i < beds.length; i++) {
    const delta = (beds[i] - beds[i - 1]) / 3_600_000;
    if (delta > 24.001 || delta < 22.5) monotonic = false; // advancing: 23–24 h between bedtimes
  }
  check("bedtimes advance by ≤1 h/night", monotonic, beds.map((b, i) => (i ? ((b - beds[i - 1]) / 3.6e6).toFixed(2) : "")).join(","));
  check("final day lands on target wall clock", fmtTime("Europe/London", plan.days[plan.days.length - 1].sleep.start) === "23:00",
    fmtTime("Europe/London", plan.days[plan.days.length - 1].sleep.start));
  const overlaps = plan.days.some((d, i) => i > 0 && d.sleep.start < plan.days[i - 1].sleep.end);
  check("sleep windows never overlap", !overlaps);
  check("light windows sit outside sleep", plan.days.every((d) => d.lightSeek.start >= d.sleep.end || d.lightSeek.end <= d.sleep.start));
}

console.log("delay plan lands on target");
{
  const plan = buildPlan(baseInput({ switchDayIndex: 1 }));
  const last = plan.days[plan.days.length - 1];
  check("Tokyo final bedtime is 23:00 JST", fmtTime("Asia/Tokyo", last.sleep.start) === "23:00", fmtTime("Asia/Tokyo", last.sleep.start));
  check("Tokyo final wake is 07:00 JST", fmtTime("Asia/Tokyo", last.sleep.end) === "07:00", fmtTime("Asia/Tokyo", last.sleep.end));
}

console.log("shift mode (no travel)");
{
  const plan = buildPlan(
    baseInput({ mode: "shift", destTz: "America/Denver", bedMin: 24.5 * 60 % 1440 ? 0.5 * 60 : 0, wakeMin: 8.5 * 60, targetBedMin: 22.5 * 60, targetWakeMin: 6.5 * 60, switchDayIndex: 0 })
  );
  check("00:30→22:30 is a 2 h advance", plan.direction === "advance" && Math.abs(plan.shiftHours - 2) < 1e-6, `${plan.direction} ${plan.shiftHours}`);
  const last = plan.days[plan.days.length - 1];
  check("lands at 22:30 bed", fmtTime("America/Denver", last.sleep.start) === "22:30", fmtTime("America/Denver", last.sleep.start));
}

console.log("status engine");
{
  const plan = buildPlan(baseInput({ destTz: "Europe/London", switchDayIndex: 2 }));
  const d0 = plan.days[0];
  const midSleep = (d0.sleep.start + d0.sleep.end) / 2;
  check("mid-sleep reports sleep", statusAt(plan, midSleep).kind === "sleep");
  check("during morning light reports seek", statusAt(plan, d0.lightSeek.start + 1) .kind === "seek");
  check("after plan reports done", statusAt(plan, plan.days[plan.days.length - 1].sleep.end + 1).kind === "done");
}

console.log("ics export");
{
  const plan = buildPlan(baseInput({ destTz: "Europe/London", switchDayIndex: 2 }));
  const ics = planToIcs(plan);
  const events = (ics.match(/BEGIN:VEVENT/g) || []).length;
  check("4 events per day", events === plan.days.length * 4, `${events} vs ${plan.days.length * 4}`);
  check("calendar closes", ics.trimEnd().endsWith("END:VCALENDAR"));
  check("CRLF line endings", ics.includes("\r\n") && !/[^\r]\n/.test(ics));
}

console.log("DST edges");
{
  // 02:30 on 2026-03-08 does not exist in Denver (spring forward).
  const t = wallToUtc("America/Denver", 2026, 3, 8, 2, 30);
  check("nonexistent wall time resolves finitely", Number.isFinite(t));
  const back = fmtTime("America/Denver", t);
  check("resolves within the transition hour", back === "03:30" || back === "01:30", back);
}

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall good");
