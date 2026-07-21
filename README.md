<a name="readme-top"></a>

# zeitgeber\*

https://sleeplight.org

*retune your body clock with light, not luck*

**zeitgeber** is a free, open-source circadian schedule planner. Tell it where — or when — you need to be, and it builds a day-by-day protocol: when to seek bright light, when to hide from it, when your sleep window moves, and when to stop drinking coffee. It handles jet lag in either direction, and it also handles the no-airplane version of the same problem: becoming a 6 a.m. person before a new job starts.

The name is the chronobiology term of art: a *zeitgeber* ("time-giver") is any external cue that entrains a circadian rhythm. Light is by far the strongest one, which is the entire premise of this tool.

Everything runs in your browser. The IANA timezone database ships inside `Intl`, so there are no API calls, no keys, no accounts, no tracking, and no server. Your plan is saved in `localStorage` on your device and exports to any calendar app as `.ics`.

## What it does

- **Travel mode** — pick origin and destination zones, your usual sleep, and how many days of head start you have before the flight. It decides whether advancing or delaying your clock reaches the destination schedule in fewer days (eastward trips past ~10 zones are often faster *the long way around*), then lays out the whole protocol.
- **Shift mode** — same engine, one time zone. Move your bedtime from 1 a.m. to 10:30 p.m. over a few days without white-knuckling it.
- **The strip chart** — one noon-to-noon row per day. Deep blue is sleep, amber is *seek bright light*, hatched violet is *keep it dim*, the small mug is your caffeine cutoff, and the white dot is your estimated body-clock anchor migrating night by night. Watching that dot drift is the plan.
- **Right now card** — the live instruction for this exact moment, with a countdown. This is the part you actually glance at from a hotel lobby.
- **Calendar export** — every light window, sleep window, and caffeine cutoff as UTC-anchored `.ics` events, so your phone renders them correctly wherever it thinks it is.

## The model (and its honesty)

The engine is a deliberately simple, documented heuristic drawn from the chronobiology literature on phase response curves and jet-lag protocols (Khalsa et al. 2003; Eastman & Burgess's pre-flight adjustment work; Czeisler and colleagues on light as the dominant zeitgeber):

1. Your circadian phase is anchored to habitual sleep; the core body temperature minimum (CBTmin) sits roughly 2.5 h before habitual wake.
2. Bright light *after* CBTmin advances the clock; light *before* it delays the clock. Practically: to advance, get bright light on waking and keep the late evening dim; to delay, seek evening light and shield your eyes for the first stretch after waking.
3. Sustainable shift rates are about 1.0 h/day advancing and 1.5 h/day delaying. The planner picks the direction that lands sooner.
4. Caffeine has a long half-life; the cutoff is 8 h before each night's bedtime.

Known approximations: chronotype is not individualized, plans that span a daylight-saving transition can land up to an hour off (rebuild after the switch), and airplane cabins are terrible places to follow advice. **This is an educational planning tool, not medical advice** — if you have a sleep disorder or other health concerns, talk to a clinician.

## Run it

```sh
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
npm run selftest   # engine tests (direction choice, DST edges, .ics integrity)
npm run smoketest  # server-render smoke test of the UI
```

## Deploy on bolt.new / Netlify

This is a pure static Vite site — no backend, no environment variables, no secrets. Import the repo into [bolt.new](https://bolt.new) (or point Netlify at it), and the defaults work: build command `npm run build`, publish directory `dist`.

## Stack

Vite + React 18 + TypeScript, strict mode, zero runtime dependencies beyond React itself. Timezone math is built on the browser's own `Intl` IANA data. Fonts are Instrument Serif, Instrument Sans, and Spline Sans Mono (all SIL OFL). Every source file carries an SPDX header.

## License

[AGPL-3.0-or-later](LICENSE). Free as in freedom: run it, study it, modify it, self-host it — and if you serve a modified version over a network, share your changes.



--------------------------------------------------------------------------------------------------------------------------
== We're Using GitHub Under Protest ==

This project is currently hosted on GitHub.  This is not ideal; GitHub is a
proprietary, trade-secret system that is not Free and Open Souce Software
(FOSS).  We are deeply concerned about using a proprietary system like GitHub
to develop our FOSS project. I have a [website](https://bellKevin.me) where the
project contributors are actively discussing how we can move away from GitHub
in the long term.  We urge you to read about the [Give up GitHub](https://GiveUpGitHub.org) campaign 
from [the Software Freedom Conservancy](https://sfconservancy.org) to understand some of the reasons why GitHub is not 
a good place to host FOSS projects.

If you are a contributor who personally has already quit using GitHub, please
email me at **kevinBell@Linux.com** for how to send us contributions without
using GitHub directly.

Any use of this project's code by GitHub Copilot, past or present, is done
without our permission.  We do not consent to GitHub's use of this project's
code in Copilot.

![Logo of the GiveUpGitHub campaign](https://sfconservancy.org/img/GiveUpGitHub.png)

<p align="right"><a href="#readme-top">back to top</a></p>
