// SPDX-License-Identifier: AGPL-3.0-or-later
// zeitgeber — what the plan asks of you right now.

import { useEffect, useState } from "react";
import { statusAt, type Plan } from "../lib/circadian";
import { fmtTime } from "../lib/tz";

function countdown(untilMs: number, nowMs: number): string {
  const mins = Math.max(0, Math.round((untilMs - nowMs) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} m`;
}

const SunIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
  </svg>
);
const ShadeIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 9h19M4 9c0 3.2 1.6 5.5 4 5.5S12 12.2 12 9M12 9c0 3.2 1.6 5.5 4 5.5S20 12.2 20 9" />
  </svg>
);
const MoonIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);
const MugIcon = (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z M16 9h2.5a2.5 2.5 0 0 1 0 5H16 M3 21h14" />
  </svg>
);

export default function NowCard({ plan }: { plan: Plan }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const s = statusAt(plan, now);

  let icon = SunIcon;
  let cls = "";
  let text = "";
  let sub: React.ReactNode = null;

  switch (s.kind) {
    case "seek":
      icon = SunIcon;
      cls = "seek";
      text = "Seek bright light";
      sub = (
        <>
          Outside beats indoors. <strong>{countdown(s.until, now)}</strong> to go.
        </>
      );
      break;
    case "avoid":
      icon = ShadeIcon;
      cls = "avoid";
      text = "Keep it dim";
      sub = (
        <>
          Low light, low screens{plan.direction === "delay" ? ", sunglasses outdoors" : ""}. <strong>{countdown(s.until, now)}</strong> to go.
        </>
      );
      break;
    case "sleep":
      icon = MoonIcon;
      text = "Sleep window";
      sub = (
        <>
          Lights out until <strong>{countdown(s.until, now)}</strong> from now.
        </>
      );
      break;
    case "nocaffeine":
      icon = MugIcon;
      text = "No more caffeine";
      sub = (
        <>
          Bedtime in <strong>{countdown(s.until, now)}</strong>.
        </>
      );
      break;
    case "free":
      icon = SunIcon;
      text = "Nothing required";
      sub = (
        <>
          Next: {s.next} at <strong>{fmtTime(s.tz, s.at)}</strong> local.
        </>
      );
      break;
    case "done":
      icon = SunIcon;
      cls = "seek";
      text = "Plan complete";
      sub = <>You should be running on the new clock. Build a fresh plan any time.</>;
      break;
  }

  return (
    <section className="panel now-card" aria-live="polite">
      <div className="now-kicker">Right now</div>
      <div className={`now-instruction ${cls}`}>
        {icon}
        <span>{text}</span>
      </div>
      <p className="now-sub">{sub}</p>
    </section>
  );
}
