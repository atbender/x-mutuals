# Install and use Mutuals

## Download

Get the ZIP for your browser from [the latest release](https://github.com/atbender/x-mutuals/releases/latest), then extract it into a folder you will keep. No build tools or API key are needed.

## Chrome, Edge or Brave

1. Open the extensions page: `chrome://extensions`, `edge://extensions`, or `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted `mutuals-chrome` folder. The selected folder must contain `manifest.json` directly.
4. Sign into X, reload the X tab, and open another person’s profile.

The sidebar appears automatically. These builds target Chromium 120+; installation in these browsers has not yet been manually verified.

## Firefox or Zen

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` inside the extracted `mutuals-firefox` folder.
4. Sign into X, reload the X tab, and open another person’s profile.

Requires Firefox engine 140+. Temporary add-ons disappear when the browser restarts: repeat the steps to load it again. The download is unsigned; permanent installation requires a signed Mozilla release. No need to disable browser security settings.

## Use the sidebar

- **Count and list:** the sidebar follows the profile you open. The list scrolls inside the screen.
- **Search:** click the magnifying glass or press **⌘F / Ctrl+F**. Type a name, handle, or partial spelling. Search includes loaded people beyond the visible rows and sends no requests. Escape closes search. On profile pages the shortcut replaces browser Find; browser Find remains available from the browser menu.
- **Collapse:** click **−**. Click the small Mutuals pill to reopen.
- **Refresh / Stop:** refresh the profile’s mutuals, or stop an ongoing check.
- **Most connected:** select once to start a continuous calculation. A spinner marks the active person, dots mark the queue, and counts appear as results arrive. **Pause** stops requests; **Resume** skips completed cached people. Switching to Default, collapsing, leaving the profile, or hiding the tab also stops calculation. No repeated batch clicks.


The number next to each person means **how many accounts you follow also follow that person**. It is not their follower count or their connections to everyone in the sidebar.

Checked people sort from highest known count to lowest; unchecked people show `—` and stay below them. Ordering updates after four completed people or four seconds of progress, and waits while you hover over the list or focus a person. `20+` means at least 20, not an exact total. A partial ranking is not a definitive top list. Each person is checked for up to two pages. Incomplete results are not automatically expanded; opening that person’s profile can produce a fuller cached count. Result caches last five minutes and are cleared on reload or account change.

## Update or remove

After downloading an update, extract it over the folder you loaded. On the extensions page, choose **Reload** (Firefox/Zen: the **Reload** button beside Mutuals in `about:debugging`), then reload X. To uninstall, choose **Remove** beside Mutuals.

## Troubleshooting

**No sidebar:** make sure you are signed in, viewing someone else’s profile, and have reloaded X after loading the extension. It does not appear on Home or your own profile.

**Connecting / authorization error:** use **Open X’s mutuals list** in the sidebar. This lets the extension learn X’s current endpoint metadata. Reload if necessary.

**Partial count or `+`:** X may have limited requests, returned unavailable accounts, or reached this extension’s page budget. Available results remain visible. Rate limits enforce a cooldown; repeatedly clicking does not bypass it.

**Taking a breather:** no click is needed. Requests adapt to X’s reported allowance, wait with five requests in reserve, and continue automatically after the reset. **Ranking paused after an error:** wait for the cooldown, then select Resume. Without rate headers, the queue waits one second after each response. Errors do not trigger automatic retries. A run stops after 300 requests as a safety limit. Same-origin tabs coordinate ranking through Web Locks where supported; other X traffic and other devices still consume allowance.

**Theme or layout conflict:** other X styling extensions can affect the available space. Mutuals uses the page background and an isolated sidebar, but unusually narrow layouts may cover part of X. Collapse the panel when needed.
