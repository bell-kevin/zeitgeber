// SPDX-License-Identifier: AGPL-3.0-or-later
// zeitgeber — app shell.

import { useEffect, useMemo, useRef, useState } from "react";
import Timeline from "./components/Timeline";
import NowCard from "./components/NowCard";
import { buildPlan, planSummary, type Mode, type Plan, type PlanInput } from "./lib/circadian";
import { downloadIcs } from "./lib/ics";
import { clearActivePlan, loadActivePlan, loadForm, saveActivePlan, saveForm } from "./lib/storage";
import { guessLocalZone, listTimeZones } from "./lib/tz";

function minToHHMM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function hhmmToMin(v: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return fallback;
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]));
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function App() {
  const zones = useMemo(() => listTimeZones(), []);
  const localZone = useMemo(() => guessLocalZone(), []);
  const saved = useMemo(() => loadForm(), []);

  const [mode, setMode] = useState<Mode>(saved?.mode ?? "travel");
  const [originTz, setOriginTz] = useState(saved?.originTz ?? localZone);
  const [destTz, setDestTz] = useState(saved?.mode === "shift" ? "Asia/Tokyo" : saved?.destTz ?? "Asia/Tokyo");
  const [bed, setBed] = useState(minToHHMM(saved?.bedMin ?? 23 * 60));
  const [wake, setWake] = useState(minToHHMM(saved?.wakeMin ?? 7 * 60));
  const [tBed, setTBed] = useState(minToHHMM(saved?.targetBedMin ?? 23 * 60));
  const [tWake, setTWake] = useState(minToHHMM(saved?.targetWakeMin ?? 7 * 60));
  const [startDate, setStartDate] = useState(todayISO());
  const [headStart, setHeadStart] = useState(saved?.mode === "travel" ? saved.switchDayIndex : 2);

  const [plan, setPlan] = useState<Plan | null>(() => loadActivePlan());
  const [justBuilt, setJustBuilt] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (justBuilt) chartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [justBuilt, plan]);

  function build() {
    const [y, mo, da] = startDate.split("-").map(Number);
    const input: PlanInput = {
      mode,
      originTz,
      destTz: mode === "shift" ? originTz : destTz,
      bedMin: hhmmToMin(bed, 23 * 60),
      wakeMin: hhmmToMin(wake, 7 * 60),
      targetBedMin: hhmmToMin(tBed, 23 * 60),
      targetWakeMin: hhmmToMin(tWake, 7 * 60),
      startYear: y || new Date().getFullYear(),
      startMonth: mo || 1,
      startDay: da || 1,
      switchDayIndex: mode === "shift" ? 0 : Math.max(0, Math.min(14, headStart)),
    };
    const p = buildPlan(input);
    setPlan(p);
    saveActivePlan(p);
    saveForm(input);
    setJustBuilt(true);
  }

  function clear() {
    setPlan(null);
    setJustBuilt(false);
    clearActivePlan();
  }

  const zoneOptions = zones.map((z) => (
    <option key={z} value={z}>
      {z.replace(/_/g, " ")}
    </option>
  ));

  return (
    <>
      <div className="shell">
        <header className="masthead">
          <h1 className="wordmark">
            zeitgeber<span className="mark-sun">*</span>
          </h1>
          <span className="tagline">retune your body clock with light, not luck</span>
        </header>
        <p className="subhead">
          Tell it where — or when — you need to be, and it builds a day-by-day protocol:{" "}
          <em>when to seek bright light, when to hide from it, when to sleep, when to stop the coffee.</em>{" "}
          Runs entirely in your browser. Nothing leaves this device.
        </p>

        <div className="layout">
          <div>
            <section className="panel" aria-label="Plan settings">
              <div className="tabs" role="tablist" aria-label="Plan type">
                <button role="tab" aria-selected={mode === "travel"} className="tab" onClick={() => setMode("travel")}>
                  Travel
                </button>
                <button role="tab" aria-selected={mode === "shift"} className="tab" onClick={() => setMode("shift")}>
                  Shift my schedule
                </button>
              </div>

              {mode === "travel" ? (
                <>
                  <div className="field">
                    <label htmlFor="origin">From</label>
                    <select id="origin" value={originTz} onChange={(e) => setOriginTz(e.target.value)}>
                      {zoneOptions}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="dest">To</label>
                    <select id="dest" value={destTz} onChange={(e) => setDestTz(e.target.value)}>
                      {zoneOptions}
                    </select>
                  </div>
                </>
              ) : (
                <div className="field">
                  <label htmlFor="tz">Time zone</label>
                  <select id="tz" value={originTz} onChange={(e) => setOriginTz(e.target.value)}>
                    {zoneOptions}
                  </select>
                </div>
              )}

              <div className="field">
                <label>{mode === "travel" ? "My usual sleep" : "Sleep now"}</label>
                <div className="pair">
                  <input aria-label="Usual bedtime" type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
                  <input aria-label="Usual wake time" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
                </div>
                <div className="hint">Bedtime, then wake time.</div>
              </div>

              <div className="field">
                <label>{mode === "travel" ? "Sleep at destination" : "Sleep I want"}</label>
                <div className="pair">
                  <input aria-label="Target bedtime" type="time" value={tBed} onChange={(e) => setTBed(e.target.value)} />
                  <input aria-label="Target wake time" type="time" value={tWake} onChange={(e) => setTWake(e.target.value)} />
                </div>
                {mode === "travel" && <div className="hint">On the destination clock.</div>}
              </div>

              <div className="field">
                <label htmlFor="start">Start date</label>
                <input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              {mode === "travel" && (
                <div className="field">
                  <label htmlFor="head">Days before travel</label>
                  <input
                    id="head"
                    type="number"
                    min={0}
                    max={14}
                    value={headStart}
                    onChange={(e) => setHeadStart(Number(e.target.value))}
                  />
                  <div className="hint">Start shifting before you fly — even one day helps.</div>
                </div>
              )}

              <button className="btn btn-primary" onClick={build}>
                Build plan
              </button>
            </section>

            {plan && <div style={{ marginTop: 18 }}><NowCard plan={plan} /></div>}
          </div>

          <main ref={chartRef}>
            {plan ? (
              <section className="panel" aria-label="Your plan">
                <div className="plan-head">
                  <h2 className="plan-title">
                    {plan.input.mode === "travel"
                      ? `${plan.input.originTz.split("/").pop()?.replace(/_/g, " ")} → ${plan.input.destTz.split("/").pop()?.replace(/_/g, " ")}`
                      : "New sleep schedule"}
                  </h2>
                  <span className={`plan-summary${plan.shiftHours < 0.5 ? " aligned" : ""}`}>{planSummary(plan)}</span>
                </div>

                <div className="legend" aria-hidden="true">
                  <span><i className="chip sleep" /> sleep</span>
                  <span><i className="chip seek" /> seek bright light</span>
                  <span><i className="chip avoid" /> keep it dim</span>
                  <span><i className="chip cbt" /> body-clock anchor</span>
                </div>

                <Timeline plan={plan} animate={justBuilt} />

                <div className="btn-row">
                  <button className="btn btn-ghost" onClick={() => downloadIcs(plan)}>
                    Download calendar (.ics)
                  </button>
                  <button className="btn btn-ghost" onClick={clear}>
                    Clear plan
                  </button>
                </div>

                <details className="assumptions">
                  <summary>How this is computed</summary>
                  <p>
                    Your body clock is anchored to your habitual sleep; its low point (the white dot) sits about 2.5 hours
                    before your usual wake time. Bright light after that low point pulls the clock earlier; light before it
                    pushes the clock later. zeitgeber schedules light to move you about 1 hour per day earlier or 1.5 hours
                    per day later, picks whichever direction reaches your target in fewer days, and holds a strict caffeine
                    cutoff 8 hours before each bedtime. Plans that cross a daylight-saving change can land up to an hour
                    off — rebuild the plan after the switch.
                  </p>
                  <p className="disclaimer">
                    This is an educational planning tool built on published chronobiology heuristics, not medical advice.
                    If you have a sleep disorder or other health concerns, talk to a clinician.
                  </p>
                </details>
              </section>
            ) : (
              <div className="empty">
                <div className="big">No plan yet</div>
                <p>
                  Pick your route or your new schedule on the left, then <strong>Build plan</strong>.<br />
                  Your plan is saved on this device and exports to any calendar app.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="site">
        <div className="inner">
          <span>
            zeitgeber — free software under{" "}
            <a href="https://www.gnu.org/licenses/agpl-3.0.html" rel="noreferrer">AGPL-3.0-or-later</a>
          </span>
          <span>
            <a href="https://github.com/bell-kevin/zeitgeber" rel="noreferrer">source on GitHub</a>
            {" · "}no accounts · no tracking · no server
          </span>
        </div>
      </footer>
    </>
  );
}
