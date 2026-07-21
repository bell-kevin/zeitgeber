// SPDX-License-Identifier: AGPL-3.0-or-later
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";
import Timeline from "../src/components/Timeline";
import NowCard from "../src/components/NowCard";
import { buildPlan } from "../src/lib/circadian";

const plan = buildPlan({
  mode: "travel", originTz: "America/Denver", destTz: "Asia/Tokyo",
  bedMin: 23 * 60, wakeMin: 7 * 60, targetBedMin: 23 * 60, targetWakeMin: 7 * 60,
  startYear: 2026, startMonth: 7, startDay: 22, switchDayIndex: 2,
});

const a = renderToStaticMarkup(<App />);
const t = renderToStaticMarkup(<Timeline plan={plan} animate={false} />);
const n = renderToStaticMarkup(<NowCard plan={plan} />);
console.log("App renders:", a.includes("zeitgeber") && a.includes("Build plan"));
console.log("Timeline renders:", t.includes("<svg") && t.includes("Denver") && t.includes("Tokyo") && t.includes("polyline"));
console.log("Timeline rows:", (t.match(/zg-sleep/g) || []).length - 1, "sleep bars for", plan.days.length, "days");
console.log("NowCard renders:", n.includes("Right now"));
console.log("Sample day strip:", plan.days.map(d => d.dateLabel).join(" | "));
