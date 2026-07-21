// SPDX-License-Identifier: AGPL-3.0-or-later
// zeitgeber — timezone math on top of the IANA database that ships inside Intl.
// No network, no bundled tz data: the browser already knows every zone.

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    dtfCache.set(tz, f);
  }
  return f;
}

interface WallParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Wall-clock parts of a UTC instant, as seen in `tz`. */
export function wallParts(tz: string, utcMs: number): WallParts {
  const parts = dtf(tz).formatToParts(new Date(utcMs));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return {
    year: Number(m.year),
    month: Number(m.month),
    day: Number(m.day),
    hour: m.hour === "24" ? 0 : Number(m.hour),
    minute: Number(m.minute),
    second: Number(m.second),
  };
}

/** Offset of `tz` from UTC in minutes at a given instant (east positive). */
export function offsetMinutes(tz: string, utcMs: number): number {
  const w = wallParts(tz, utcMs);
  const asUTC = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUTC - utcMs) / 60_000);
}

/**
 * Convert a wall-clock time in `tz` to a UTC instant (ms).
 * Two-pass refinement handles DST edges; ambiguous times resolve to the
 * earlier offset, nonexistent times slide forward — both fine for planning.
 */
export function wallToUtc(
  tz: string,
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number
): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes(tz, Date.UTC(year, month - 1, day, hour, minute)) * 60_000;
  // refine once more in case the first guess straddled a transition
  guess = Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes(tz, guess) * 60_000;
  return guess;
}

/** Minutes after local midnight for a UTC instant viewed in `tz`. */
export function minutesOfDay(tz: string, utcMs: number): number {
  const w = wallParts(tz, utcMs);
  return w.hour * 60 + w.minute;
}

/** "HH:MM" for a UTC instant viewed in `tz`. */
export function fmtTime(tz: string, utcMs: number): string {
  const w = wallParts(tz, utcMs);
  return `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
}

/** "Tue Mar 3" style label for a UTC instant viewed in `tz`. */
export function fmtDay(tz: string, utcMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(utcMs));
}

/** "UTC-7" / "UTC+9" style label at an instant. */
export function fmtOffset(tz: string, utcMs: number): string {
  const off = offsetMinutes(tz, utcMs);
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

/** All IANA zones the runtime knows, with a small fallback list. */
export function listTimeZones(): string[] {
  const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof anyIntl.supportedValuesOf === "function") {
    try {
      return anyIntl.supportedValuesOf("timeZone");
    } catch {
      /* fall through */
    }
  }
  return [
    "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver",
    "America/Chicago", "America/New_York", "America/Sao_Paulo", "UTC",
    "Europe/London", "Europe/Paris", "Europe/Athens", "Africa/Cairo",
    "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Bangkok",
    "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
  ];
}

export function guessLocalZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
