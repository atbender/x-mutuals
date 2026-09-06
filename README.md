# Mutuals

A quiet sidebar for X. Open a profile and see the people you follow who also follow that account: a count, avatars, and a vertical list in X’s palette.

Vanilla JavaScript. No dependencies, backend, API key, analytics, or sign-up.

![Mutuals walkthrough: open the minimized pill, view eight people, select Most connected, and calculate their counts](docs/walkthrough.gif)

Minimized pill → mutual list → **Most connected** → automatic calculation.

*Recorded with the production extension UI over an anonymized screenshot of X. All displayed identities and ranking counts are fictional demo data. No developer tools or logs are shown.*

**[Download](https://github.com/atbender/x-mutuals/releases/latest)** · **[Install and use](INSTALL.md)**

| Browser | Build | Validation |
| --- | --- | --- |
| Zen / Firefox engine 140+ | Firefox ZIP; temporary add-on | Live mutual lookup tested in Zen |
| Chrome / Edge / Brave, Chromium 120+ | Chrome ZIP; load unpacked | Script integration tested; native installation unverified |
| Firefox Android 142+ | Firefox manifest target | Not tested; desktop instructions below |
| Safari | No build | Not supported |


## Install

**[Step-by-step installation and usage guide](INSTALL.md)** · **[Download browser ZIPs](https://github.com/atbender/x-mutuals/releases/latest)**

Run `npm run build`. Ready-to-load builds appear in `dist/`.

**Chrome / Edge / Brave (Chromium 120+)**

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode → Load unpacked**.
3. Select `dist/chrome`.
4. Reload X and open a profile while signed in.

**Firefox / Zen (Firefox engine 140+, Android 142+)**

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on** and choose `dist/firefox/manifest.json`.
3. Reload X and open a profile while signed in.

Temporary Firefox installations last until restart. Permanent installation needs Mozilla signing. Safari is not packaged. Android has not been tested.

## Use

The sidebar appears on the right of the current profile. Collapse it with **−**, reopen the pill, or use **Refresh** to check again. **Stop** cancels pagination. On narrow screens it becomes a compact floating panel. Long lists scroll within the available screen height.

Click the search icon or press **⌘F / Ctrl+F** on a profile to fuzzy-search loaded mutuals by name or handle. Missing letters, multiple terms, and accents are supported. **Escape** closes the finder. Search runs locally with no additional requests. On profile pages this shortcut opens Mutuals instead of the browser’s page finder; the browser menu still provides its normal Find action.

“Mutuals” means **accounts you follow who follow the target**, not shared followers or reciprocal follows. A count with `+` is a lower bound: pagination was interrupted or X returned incomplete data. “Up to date” means X’s available list was exhausted; inaccessible connections cannot be independently verified.

If X changes its endpoint or rejects authorization, select **Open X’s mutuals list**. The extension can learn current query metadata from that native request and reuse the first page.

## Most connected

Select **Most connected** once to calculate the list automatically. Counts arrive one person at a time: the active row has a spinner, queued rows show quiet dots, and a thin progress line tracks completion. Use **Pause / Resume** at any time. The list gently reorders after four completed people or four seconds of progress. Reordering waits while you hover over the list or focus a person, so links do not move out from under you.

Requests are sequential. When X supplies rate-limit headers, pacing adapts to the remaining allowance and reset time, reserving five requests. Without headers, requests wait one second after each response. When the reported allowance reaches the reserve, calculation waits for the reset and continues automatically. Actual rate-limit errors and other failures stop the run; failed requests are not retried automatically. Completed counts are cached, so resuming skips them. Tabs use a same-origin Web Lock to prevent simultaneous ranking runs for the same signed-in account when supported.

Each person is limited to two pages, and a continuous run has a 300-request safety ceiling. Lower bounds show `+`; partial results are explicitly indicated. These safeguards reduce traffic but cannot guarantee avoidance of X’s limits, which may also be consumed by X itself or other tabs/devices.

## Request budget

- Reuses X’s profile response for the target ID and current authorization; no extra profile lookup.
- Waits 600 ms before starting, so quick navigation can avoid a check.
- Requests up to 100 connections per page; X may return fewer.
- Reuses native mutual-list responses when available, including zero additional requests for an exhausted first page.
- One check at a time per tab, sequential pages with a 750 ms pause; 50-page cap.
- Stops when navigating away, collapsing, hiding the tab, or pressing Stop.
- Five-minute reuse window, at most 64 profiles per tab. Reload or account change clears results.
- No timed refresh, automatic retries, background worker, network polling, or full follower graph crawl.
- Rate limits stop the check and enforce at least 60 seconds of cooldown, or X’s later reset time.

Caches are per tab. Ranking runs coordinate through a same-origin Web Lock where supported; ordinary profile loading and X’s own requests are outside that lock. Avatars use normal lazy image loading from X’s image host; request diagnostics count connection API requests, not image loads.

## Privacy and implementation

The scripts run in X’s MAIN world and observe only same-origin GET requests for `UserByScreenName`, `UserByRestId`, and `FollowersYouKnow`. Session headers remain in page memory and are sent only to the same X origin. Cookies are attached by the browser; the extension does not extract them. There is no external service or telemetry.

Only public query metadata (endpoint path and feature flags) is persisted in X’s localStorage. Profile results and up to 1,000 ranking counts remain in tab memory. X’s page can inspect or interfere with MAIN-world code; this is not an isolated security boundary.

`endpoint.js` provides initial query metadata. `content.js` observes responses, manages the cache and displays the Shadow DOM sidebar. `core.js` parses responses and deduplicates numeric IDs. `tools/build.cjs` produces the browser manifests. The extension injects only on `https://x.com/*` and `https://twitter.com/*`, without cookies, tabs, storage, or broad host permissions.

X’s internal API can change. If the response is unfamiliar, Mutuals reports an incomplete state instead of inventing a total. Compatibility with Chrome-family manifests is provided; see the test record for which browsers were actually exercised.

## Development

```sh
npm test
npm run build
node tests/server.cjs
```

Open `http://127.0.0.1:8766/demo_profile` for the synthetic browser fixture. It uses the production scripts with fictional profile data and controllable complete, empty, rate-limited, repeated-cursor, and slow responses. Diagnostic polling is fixture-only and excluded from extension packages.

See [TESTING.md](TESTING.md) for validation and limitations.
