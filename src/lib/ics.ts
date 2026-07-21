// SPDX-License-Identifier: AGPL-3.0-or-later
// zeitgeber — .ics export. Events are written in UTC so every calendar app
// renders them correctly in whatever zone the phone happens to be in.

import type { Plan } from "./circadian";

function icsStamp(utcMs: number): string {
  const d = new Date(utcMs);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fold(line: string): string {
  // RFC 5545: lines ≤ 75 octets, continuation lines start with a space.
  const out: string[] = [];
  let s = line;
  while (s.length > 74) {
    out.push(s.slice(0, 74));
    s = " " + s.slice(74);
  }
  out.push(s);
  return out.join("\r\n");
}

interface Ev {
  start: number;
  end: number;
  title: string;
  desc: string;
}

export function planToIcs(plan: Plan): string {
  const events: Ev[] = [];
  for (const d of plan.days) {
    events.push({
      start: d.lightSeek.start,
      end: d.lightSeek.end,
      title: "Seek bright light",
      desc:
        plan.direction === "advance"
          ? "Get outside or sit by the brightest light you can find. Morning light pulls your clock earlier."
          : "Keep the lights up and stay active. Evening light pushes your clock later.",
    });
    events.push({
      start: d.lightAvoid.start,
      end: d.lightAvoid.end,
      title: "Keep it dim",
      desc:
        plan.direction === "advance"
          ? "Dim screens and lamps before bed. Evening light would undo today's progress."
          : "Sunglasses if you go outside; keep indoor light low. Morning light would undo today's progress.",
    });
    events.push({
      start: d.caffeineCutoff,
      end: d.caffeineCutoff + 15 * 60_000,
      title: "Caffeine cutoff",
      desc: "Last call — caffeine after this point lingers into your sleep window.",
    });
    events.push({
      start: d.sleep.start,
      end: d.sleep.end,
      title: d.isTravelDay ? "Sleep window (travel day)" : "Sleep window",
      desc: d.isTravelDay
        ? "If you're in transit, sleep as much of this window as the seat allows."
        : "Tonight's target sleep. Close enough counts.",
    });
  }

  const now = icsStamp(Date.now());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//zeitgeber//circadian planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold("X-WR-CALNAME:" + esc("zeitgeber plan")),
  ];
  events.forEach((ev, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:zeitgeber-${plan.createdAt}-${i}@zeitgeber.local`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsStamp(ev.start)}`,
      `DTEND:${icsStamp(ev.end)}`,
      fold("SUMMARY:" + esc(ev.title)),
      fold("DESCRIPTION:" + esc(ev.desc)),
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(plan: Plan): void {
  const blob = new Blob([planToIcs(plan)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zeitgeber-plan.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
