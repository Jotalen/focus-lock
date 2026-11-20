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

## Use

### Block websites

Unlock settings, then enter domains such as `youtube.com`, `instagram.com`, or `tiktok.com`. Add sites individually. Subdomains are included: blocking `youtube.com` also blocks `www.youtube.com` and `m.youtube.com`.

A blocked page asks for your PIN. A correct PIN unlocks that domain and its subdomains for **15 minutes**, across tabs. Other blocked domains stay blocked. Settings include **End all website unlocks** to revoke access early. Unlocks end on browser restart. Existing blocked tabs are checked when settings change and unlocks expire.

### Breakthrough permission: specific YouTube videos

1. Add `youtube.com` under **Blocked websites**.
2. While settings are unlocked with your PIN, paste a specific video URL into **Approved YouTube videos**. An optional label helps identify it.
3. Click **Approve this video**.
4. Open the video's approved link from that list. It opens a canonical `https://www.youtube.com/watch?v=VIDEO_ID` page.

The approved video remains available without another PIN. YouTube's homepage, searches, and other videos remain blocked. Playlist autoplay and recommendations do not approve additional videos. Regular YouTube link clicks are routed through the extension before navigation; history-based navigation and autoplay are checked by the background worker and page guard. Browser history and autoplay changes can briefly begin rendering before those checks redirect the page.

Pasted `youtu.be`, `/shorts/`, `/live/`, and `/embed/` links are converted to the corresponding watch-page video ID. **Use the canonical approved link afterward**; Shorts, embeds, and short-link routes are not themselves allowed through a blocked domain. If you want to block `youtu.be` short links, add `youtu.be` separately. These redirects may otherwise resolve to a blocked YouTube watch page.

Settings sessions last **5 minutes**, covering additions and removals. Click **Lock settings** to close access sooner. The PIN is also required to change the PIN. Lists and the PIN hash are stored on this device, without cloud sync.

### Adult-site filter

A bundled starter list of **44 known adult domains**, including their subdomains, is enabled on installation, even before PIN setup. It stays active alongside your own blocked domains. Listed sites can be unlocked temporarily with the PIN.

This is a domain filter, **not universal adult-content detection**. It does not inspect images or classify pages. New domains, alternate domains, search results, proxies, and mixed-content platforms may not be covered. Add any extra domains under Blocked websites. The bundled list is in `adult-domains.json`; update that file and reload the extension to maintain it. No browsing URLs are sent to an external filtering service.

## Security and scope

- Blocks browser websites, not installed desktop/mobile applications or other browsers.
- Uses declarative network rules for direct page navigation and blocked-site frames, with additional checks for browser-history navigation and already-open tabs.
- Child frames on blocked domains are blocked, even if a video is approved; approved videos open as full watch pages.
- It is a focus aid, not tamper-proof parental control. A browser/device owner can disable or uninstall it, edit an unpacked extension, use another profile, or access browsers where it is not installed. Private browsing is not covered unless you explicitly enable the extension there.
- Four digits provide only 10,000 combinations. The PIN is salted and hashed using PBKDF2-SHA-256 (210,000 iterations). Five failed attempts trigger a 60-second pause, shared between settings and website access. This is not designed to withstand an attacker with local developer access.
- Extension content scripts cannot read stored credentials; messages from ordinary websites cannot change settings or grant access. Settings changes are checked in the background, not just in the UI.
- Local data contains your blocked domains, video approvals, PIN hash/salt, and failed-attempt counter. Temporary access state is held in session storage. No full browsing history is recorded; the blocked destination appears locally in the block page's URL fragment.
- There is no PIN recovery service. Uninstalling/reinstalling resets the PIN and custom lists. Keep your PIN somewhere safe.

## Permissions

| Permission | Purpose |
| --- | --- |
| HTTP/HTTPS host access | Apply the user's chosen domains; run the local navigation guard. |
| declarativeNetRequest | Redirect blocked top-level pages, block frames, and allow approved videos. |
| storage | Save local configuration and hashed PIN; hold temporary access sessions. |
| webNavigation | Check in-page route changes, including YouTube navigation. |
| alarms | Expire temporary website access. |
| tabs | Check open tab URLs and send blocked tabs to the local block page. |

## Validation

Run `npm test` with Node.js 20 or newer. No dependency installation is required. Seven automated tests cover domain boundaries, video exceptions, duplicate video-parameter rejection, PIN hashing, temporary grant expiry, rate limiting, and service-worker authorization/state transitions. The background integration test uses mocked Chrome APIs.

A live Chromium smoke test was attempted in the build environment, but the browser could not start because local socket creation was prohibited. **Live installation, browser API integration, YouTube playback, and Edge compatibility have not been verified in a running browser.** Complete these checks after loading:

1. Create your PIN; add `example.com` and `youtube.com`. Check that direct visits and subdomains redirect to the block page.
2. Try a wrong PIN, then the correct one. Check that the unlock lasts 15 minutes, and **End all website unlocks** closes open blocked pages.
3. Add one approved YouTube video. Open its canonical link and confirm playback; navigate to another video and confirm it is blocked. Test autoplay, Back/Forward, playlists, mobile URLs, and new tabs.
4. Check a bundled adult domain, including an embedded frame. Expect a block page for direct visits and a failed frame load for embeds.
5. Lock settings; confirm that changing lists and the PIN requires authentication. Make five incorrect PIN attempts and confirm the 60-second pause.
6. Restart the browser. Custom lists and your PIN should remain; temporary unlocks should be gone.
7. Repeat in your installed Chrome and Edge versions. Check the extension's Errors section for browser API or regex-rule errors.

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
