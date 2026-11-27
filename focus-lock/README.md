# Focus Lock — Chrome & Microsoft Edge extension

A local Manifest V3 extension for blocking websites with a 4-digit PIN. No build step, account, server, or paid service is required.

## Install

1. Extract this ZIP to a permanent folder on your computer.
2. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `focus-lock` folder containing `manifest.json`.
5. Pin **Focus Lock** from the browser's Extensions menu. Click it, then **Open protected settings**.
6. Create and confirm a 4-digit PIN. There is no preset PIN.

Keep the extracted folder in place; the browser loads the extension from it. Repeat installation separately in each browser/profile. Managed school or work browsers may prevent unpacked installations.

Official installation instructions: [Chrome](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked) · [Microsoft Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading).

## Update an existing installation to 1.1.0

1. Extract the new ZIP to a temporary folder.
2. Copy everything **inside** its `focus-lock` folder into the **original extension folder** you already loaded. Replace the existing files, including `manifest.json`, `core.js`, `background.js`, and `guard.js`.
3. Open `chrome://extensions` or `edge://extensions` and click **Reload** on the existing Focus Lock card. Check that the version is **1.1.0**.
4. Refresh any already-open YouTube tabs so they receive the updated page guard.

Keep the existing extension installed and use the same original folder to preserve its identity, PIN, blocked domains and approved videos. Temporary unlocks may end on reload. Old per-video network rules are removed automatically when the updated extension initializes. If older errors remain listed, clear them and check whether any new errors appear.

Version 1.1.0 removes the per-video regex rules that could exceed Chrome's 2 KB compiled-regex memory limit. YouTube video decisions now compare the URL's video ID directly with the approved list. Other blocked websites keep their network blocking rules.

## Use

### Block websites

Unlock settings, then enter domains such as `youtube.com`, `instagram.com`, or `tiktok.com`. Add sites individually. Subdomains are included. YouTube has a special rule: adding `youtube.com` restricts video playback on its subdomains, short links and privacy-enhanced embeds, while browsing stays available.

A blocked page asks for your PIN. A correct PIN unlocks that domain and its subdomains for **15 minutes**, across tabs. Other blocked domains stay blocked. Settings include **End all website unlocks** to revoke access early. Unlocks end on browser restart. Existing blocked tabs are checked when settings change and unlocks expire.

### Breakthrough permission: specific YouTube videos

1. Add `youtube.com` under **Blocked websites**.
2. While settings are unlocked with your PIN, paste a specific video URL into **Approved YouTube videos**. An optional label helps identify it.
3. Click **Approve this video**.
4. Open the video's approved link from that list. It opens a canonical `https://www.youtube.com/watch?v=VIDEO_ID` page.

When `youtube.com` is in Blocked websites:

- The homepage, search results, channels, feeds and playlist pages remain available for finding videos.
- An approved video plays without another PIN. An unapproved video opens the block page and can be temporarily unlocked with the PIN, as before.
- Playlist autoplay, Shorts, direct links, new tabs, and in-page navigation are checked by video ID. Approving one video does not approve its playlist or recommendations.
- Hover previews and the miniplayer are paused on browsing pages. Open an approved video page to play it.
- Removing `youtube.com` from Blocked websites removes these restrictions, unless another matching YouTube domain is still listed. Adding approvals alone never turns blocking on.

YouTube uses URL checks in the background worker and page guard, rather than per-video network rules. The guard pauses playback while an unknown YouTube route is being checked and discards stale responses after navigation. These asynchronous checks can still briefly render a page before redirecting; they are not a guarantee of zero visible frames on every YouTube implementation.

Paste a normal URL as copied from the browser, **without adding backslashes**, or paste the 11-character video ID (for example, `FLDx2MFEkdU`). `youtu.be`, `/shorts/`, `/live/` and `/embed/` links identify the same video. Approved videos can open using those supported routes as well as the canonical watch link. Extra timestamp and playlist parameters do not change which video is approved. Duplicate `v` parameters are rejected, including encoded duplicate keys.

Blocking `youtube.com` also applies these video checks to `youtu.be` and `youtube-nocookie.com`. An unapproved embedded player is stopped inside its frame; the containing page stays open.

Settings sessions last **5 minutes**, covering additions and removals. Click **Lock settings** to close access sooner. The PIN is also required to change the PIN. Lists and the PIN hash are stored on this device, without cloud sync.

### Adult-site filter

A bundled starter list of **44 known adult domains**, including their subdomains, is enabled on installation, even before PIN setup. It stays active alongside your own blocked domains. Listed sites can be unlocked temporarily with the PIN.

This is a domain filter, **not universal adult-content detection**. It does not inspect images or classify pages. New domains, alternate domains, search results, proxies, and mixed-content platforms may not be covered. Add any extra domains under Blocked websites. The bundled list is in `adult-domains.json`; update that file and reload the extension to maintain it. No browsing URLs are sent to an external filtering service.

## Security and scope

- Blocks browser websites, not installed desktop/mobile applications or other browsers.
- Uses declarative network rules for ordinary blocked sites. YouTube uses URL decisions in the background worker and content guard, including browser-history navigation and already-open tabs.
- Child frames on ordinary blocked domains are blocked. YouTube frames are checked by video ID, including privacy-enhanced embeds; only approved video routes or a temporary domain unlock permit playback.
- It is a focus aid, not tamper-proof parental control. A browser/device owner can disable or uninstall it, edit an unpacked extension, use another profile, or access browsers where it is not installed. Private browsing is not covered unless you explicitly enable the extension there.
- Four digits provide only 10,000 combinations. The PIN is salted and hashed using PBKDF2-SHA-256 (210,000 iterations). Five failed attempts trigger a 60-second pause, shared between settings and website access. This is not designed to withstand an attacker with local developer access.
- Extension content scripts cannot read stored credentials; messages from ordinary websites cannot change settings or grant access. Settings changes are checked in the background, not just in the UI.
- Local data contains your blocked domains, video approvals, PIN hash/salt, and failed-attempt counter. Temporary access state is held in session storage. No full browsing history is recorded; the blocked destination appears locally in the block page's URL fragment.
- There is no PIN recovery service. Uninstalling/reinstalling resets the PIN and custom lists. Keep your PIN somewhere safe.

## Permissions

| Permission | Purpose |
| --- | --- |
| HTTP/HTTPS host access | Apply the user's chosen domains; run the local navigation guard. |
| declarativeNetRequest | Redirect ordinary blocked sites and block their frames; grant temporary access. YouTube approvals do not create network rules. |
| storage | Save local configuration and hashed PIN; hold temporary access sessions. |
| webNavigation | Check in-page route changes, including YouTube navigation. |
| alarms | Expire temporary website access. |
| tabs | Check open tab URLs and send blocked tabs to the local block page. |

## Validation

Run `npm test` with Node.js 20 or newer. No dependency installation is required. **16 automated tests pass**, covering URL parsing and domain boundaries, browse-versus-playback decisions, exact video IDs and duplicate query parameters, 100 approvals without per-video regex rules, migration away from old rules, mocked service-worker lifecycle/authentication/grants, and page-guard playback, embedded players and stale navigation responses. Browser APIs and the DOM are simulated in these tests.

A live browser smoke test was attempted for this update, but the environment's Chromium launcher points to a missing browser executable. **Actual Chrome/Edge installation and real YouTube playback still need local verification.** After updating:

1. Keep `youtube.com` in Blocked websites. Visit the homepage, search for a lesson and open a channel: browsing should remain available.
2. Approve a video using its normal browser URL or ID. Open the watch page: it should play. Open an unapproved video: the PIN block page should appear.
3. Test Shorts, `youtu.be`, embeds, playlist autoplay, Back/Forward, mobile URLs and new tabs. Previews and the miniplayer should be paused on browsing pages.
4. Remove an approval while that video is already open. It should be blocked. Temporarily unlock with the PIN, then use **End all website unlocks** and confirm restrictions return.
5. Confirm another blocked website and a bundled adult domain still block. Settings and PIN changes should still require authentication.
6. Reload/restart the browser and verify the saved PIN and lists remain. Temporary unlocks should end after restart. Check that no new regex-rule error appears.
7. Repeat in your installed Chrome and Edge versions.

## Source files

- `manifest.json`: browser registration and permissions.
- `background.js`: authenticated commands, throttling, grants, network rules, and navigation enforcement.
- `core.js`: domain parsing, video parsing, rule generation, PIN derivation.
- `guard.js`: in-page navigation and playback guard.
- `options.*`: PIN-protected management screen.
- `blocked.*`: block page and temporary unlock.
- `popup.*`: toolbar entry point.
- `style.css`, `ui.js`: shared local interface resources.
- `adult-domains.json`: starter filter list.
- `tests/`: dependency-free automated tests.
