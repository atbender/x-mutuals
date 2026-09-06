# Validation — 2026-09-06

## Automated

Node tests cover ID deduplication, cursor pagination, short pages, empty versus malformed responses, GraphQL errors, HTTP failure lower bounds, repeated cursors, unavailable users, cancellation, the page cap, fuzzy search, and safe user normalization. Cancellation and the cap assert that no unnecessary continuation is sent.

## Live X, installed extension in Zen

Tested through Computer Use with an existing signed-in session. No live account names, IDs, response dumps, or screenshots are included in this repository.

- Automatic profile sidebar displayed a count of 2 and two vertical user rows, matching the native X mutuals list.
- The profile check used 1 additional connection API request and took approximately 0.4 seconds after starting (excluding page load and the 600 ms debounce).
- The updated extension opened its local finder with Command-F on live X.
- Sidebar visually matched X’s dark background and border palette.
- The earlier inline version verified native-response reuse: a complete first page needed 0 extra requests; another list with 72 unique accounts needed 1 continuation, approximately 1.3 seconds after the native first response. The sidebar uses that same parser and pagination mechanism.

These are individual observations, not guaranteed latency or completeness across accounts.

## Controlled Chromium browser

Computer Use exercised the production scripts in the in-app browser against synthetic responses:

- Automatic profile loading produced 4 distinct users from 2 overlapping pages, with 2 API requests total.
- Collapse, reopen, theme switch, and cached profile navigation added no connection requests.

- A rate limit on page 2 preserved `2+`, stopped at 2 requests, and displayed the cooldown state.
- The search icon opened the finder; `smpl 3` returned only the matching synthetic person without increasing the 2-request total.

- A 120-person fixture stayed in a 416px scroll container. Searching `sample_120` found a person beyond the first 100 rendered rows, with no additional requests.
- Escape closed the finder and Command-F reopened it.
- Final validation: 11 Node tests passed; Firefox web-ext lint reported zero errors, notices, or warnings.

This checks browser UI and script integration, not installed Chrome-extension behavior or live Chrome authorization.

## Limits

Chrome and standalone Firefox native windows were unavailable to Computer Use. The installed live test used Zen’s Firefox engine. Chrome/Edge/Brave manifests are built, but installation in those browsers is not yet verified. Safari and Android were not tested.

## Ranking UI — 0.2.0

Computer Use tested the opt-in ranking against synthetic accounts in the Chromium fixture:

- Selecting Most connected sent no extra requests.
- A batch stopped at 10 requests: 11 total including the original profile list.
- Ten distinct fixture counts sorted descending, with unchecked people below them.
- Stopping the next batch prevented further requests after its first request.
- Light and dark layouts were visually inspected, including the screen-bounded list.

Ranking-specific lookups have not yet been manually verified on live X. They use the same endpoint and authorization mechanism as the previously verified profile check. The implementation does not assume X provides a free embedded count. Batches use at most two pages per person, so `+` counts and partial rankings are expected for large lists.

## Continuous ranking — 0.3.0

- Selecting Most connected starts a sequential queue without batch buttons. Computer Use observed it continue past 30 people without another click.
- Computer Use verified the active-row spinner, quiet queue dots, progress line, Pause, and Resume. Completed results remained cached across pause/resume.
- A synthetic low-allowance response (five requests remaining) stopped further requests: two initial profile-list requests plus one ranking request, with a visible allowance-preservation message.
- Rate-pacing unit tests cover missing/invalid headers, the five-request reserve, reset timing, and the minimum interval.
- The same-origin Web Lock serializes ranking runs for the same account when supported. Other X traffic is outside this lock.

Continuous ranking pacing remains to be verified against live X rate-limit headers. No guarantee is made that X will never rate-limit the extension.
