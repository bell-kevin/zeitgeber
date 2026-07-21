// SPDX-License-Identifier: AGPL-3.0-or-later
// zeitgeber — the strip chart. One noon-to-noon row per day; the white dot is
// your estimated body-clock anchor (CBTmin) migrating night by night.

import type { Plan } from "../lib/circadian";
import { noonBefore } from "../lib/circadian";
import { fmtOffset, fmtTime } from "../lib/tz";

const W = 960;
const GUTTER = 148;
const PAD_R = 14;
const AXIS_H = 30;
const ROW_H = 62;
const BAR_Y = 22; // bar centerline within row
const CHART_W = W - GUTTER - PAD_R;
const DAY_MS = 24 * 3_600_000;

function zoneCity(tz: string): string {
  const last = tz.split("/").pop() || tz;
  return last.replace(/_/g, " ");
}

interface Props {
  plan: Plan;
  animate: boolean;
}

export default function Timeline({ plan, animate }: Props) {
  const n = plan.days.length;
  const height = AXIS_H + n * ROW_H + 6;

  const rows = plan.days.map((d) => {
    const start = noonBefore(d.tz, d.sleep.start);
    const x = (utc: number) => GUTTER + Math.max(0, Math.min(1, (utc - start) / DAY_MS)) * CHART_W;
    return { d, start, x };
  });

  const cbtPoints = rows.map((r, i) => ({
    x: r.x(r.d.cbtMin),
    y: AXIS_H + i * ROW_H + BAR_Y,
  }));

  return (
    <div className="timeline-wrap">
      <svg
        className="timeline-svg"
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Day-by-day light and sleep schedule, ${n} days`}
      >
        <defs>
          <linearGradient id="zg-night" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#232a58" />
            <stop offset="0.5" stopColor="#141834" />
            <stop offset="1" stopColor="#232a58" />
          </linearGradient>
          <linearGradient id="zg-sleep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--deepsleep)" />
            <stop offset="1" stopColor="var(--deepsleep-2)" />
          </linearGradient>
          <pattern id="zg-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
            <rect width="6" height="6" fill="rgba(141,123,232,0.22)" />
            <rect width="2.6" height="6" fill="var(--umbra)" />
          </pattern>
          <filter id="zg-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        {/* axis */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const gx = GUTTER + f * CHART_W;
          const label = ["noon", "6 pm", "midnight", "6 am", "noon"][i];
          return (
            <g key={f}>
              <line x1={gx} y1={AXIS_H - 6} x2={gx} y2={height - 4} stroke="var(--hairline-soft)" strokeWidth="1" />
              <text x={gx} y={AXIS_H - 12} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--moon-dim)">
                {label}
              </text>
            </g>
          );
        })}

        {/* the drift line — signature element */}
        {n > 1 && (
          <polyline
            points={cbtPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--umbra)"
            strokeWidth="1.5"
            strokeDasharray="3 5"
            opacity="0.85"
          />
        )}

        {rows.map((r, i) => {
          const { d, x } = r;
          const top = AXIS_H + i * ROW_H;
          const cy = top + BAR_Y;
          const sleepX1 = x(d.sleep.start);
          const sleepX2 = x(d.sleep.end);
          const seekX1 = x(d.lightSeek.start);
          const seekX2 = x(d.lightSeek.end);
          const avoidX1 = x(d.lightAvoid.start);
          const avoidX2 = x(d.lightAvoid.end);
          const cafX = x(d.caffeineCutoff);
          const style = animate ? { animationDelay: `${i * 70}ms` } : undefined;

          return (
            <g key={d.index} className={animate ? "day-enter" : undefined} style={style}>
              <title>
                {`${d.dateLabel} · sleep ${fmtTime(d.tz, d.sleep.start)}–${fmtTime(d.tz, d.sleep.end)} · bright light ${fmtTime(d.tz, d.lightSeek.start)}–${fmtTime(d.tz, d.lightSeek.end)} · dim ${fmtTime(d.tz, d.lightAvoid.start)}–${fmtTime(d.tz, d.lightAvoid.end)} (${zoneCity(d.tz)} time)`}
              </title>

              {/* row background */}
              <rect x={GUTTER} y={top + 6} width={CHART_W} height={ROW_H - 18} rx="9" fill="url(#zg-night)" stroke="var(--hairline-soft)" />

              {/* gutter labels */}
              <text x={10} y={cy - 2} fontSize="13.5" fontFamily="var(--font-body)" fill="var(--moon)">
                {d.dateLabel}
                {d.isTravelDay ? "  ✈" : ""}
              </text>
              <text x={10} y={cy + 14} fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--moon-dim)">
                {zoneCity(d.tz)} · {fmtOffset(d.tz, d.sleep.start)}
              </text>

              {/* avoid-light block */}
              {avoidX2 > avoidX1 && (
                <rect x={avoidX1} y={cy - 6} width={avoidX2 - avoidX1} height={12} rx="4" fill="url(#zg-hatch)" stroke="var(--umbra-deep)" strokeWidth="0.8" />
              )}

              {/* seek-light block with glow */}
              {seekX2 > seekX1 && (
                <>
                  <rect x={seekX1} y={cy - 6} width={seekX2 - seekX1} height={12} rx="4" fill="var(--dawnlight)" opacity="0.55" filter="url(#zg-glow)" />
                  <rect x={seekX1} y={cy - 6} width={seekX2 - seekX1} height={12} rx="4" fill="var(--dawnlight)" />
                </>
              )}

              {/* sleep bar */}
              <rect x={sleepX1} y={cy - 9} width={Math.max(2, sleepX2 - sleepX1)} height={18} rx="6" fill="url(#zg-sleep)" stroke="rgba(233,235,247,0.22)" strokeWidth="0.8" />
              <text x={sleepX1} y={cy - 14} fontSize="10" fontFamily="var(--font-mono)" fill="var(--moon-dim)" textAnchor="middle">
                {fmtTime(d.tz, d.sleep.start)}
              </text>
              <text x={sleepX2} y={cy - 14} fontSize="10" fontFamily="var(--font-mono)" fill="var(--moon-dim)" textAnchor="middle">
                {fmtTime(d.tz, d.sleep.end)}
              </text>

              {/* caffeine cutoff tick */}
              <line x1={cafX} y1={cy + 9} x2={cafX} y2={cy + 17} stroke="var(--moon-dim)" strokeWidth="1.6" />
              <path
                d={`M ${cafX - 4} ${cy + 19} h 8 v 4.5 a 4 4 0 0 1 -8 0 Z M ${cafX + 4.6} ${cy + 19.6} a 2.6 2.6 0 0 1 0 4.4`}
                fill="none"
                stroke="var(--moon-dim)"
                strokeWidth="1.1"
              />

              {/* body-clock anchor */}
              <circle cx={x(d.cbtMin)} cy={cy} r={d.isFinal ? 5 : 4} fill="var(--moon)" stroke={d.isFinal ? "var(--dawnlight)" : "var(--umbra)"} strokeWidth="2" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
