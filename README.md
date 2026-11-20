# Focus Lock

A browser extension for Google Chrome and Microsoft Edge that helps you limit distracting websites with a 4-digit PIN, a built-in adult-site domain filter, and exceptions for specific YouTube videos.

Block YouTube while keeping a lesson or tutorial available. Unlock a blocked website temporarily when you need it, then let Focus Lock restore the boundary automatically.

> **Project status:** Initial implementation. Seven automated tests passed during development, including tests against mocked Chrome APIs. Live browser installation, YouTube playback, and Edge compatibility remain unverified.

## Features

| Feature | Behavior |
| --- | --- |
| Custom website blocking | Add domains to block, including their subdomains. |
| PIN-protected access | Enter a 4-digit PIN to temporarily unlock a website. |
| Temporary website unlocks | Allow a domain for 15 minutes across tabs. Revoke access early from settings. |
| Protected settings | Use your PIN to manage blocked websites and video approvals. Settings sessions last 5 minutes. |
| YouTube breakthrough permissions | Approve individual videos while keeping the rest of YouTube blocked. |
| Default adult-site filter | A bundled starter list blocks 44 known adult domains and their subdomains. |
| Failed-attempt limit | Five incorrect PIN attempts trigger a 60-second pause. |
| Local configuration | No account, backend, analytics, or configuration sync. |

## Installation

There is no build step. Load the source folder as an unpacked extension.

1. Clone this repository or download and extract its ZIP archive.
2. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the folder containing `manifest.json`. In the original download, this is the `focus-lock` folder.
6. Open **Focus Lock** from the browser's Extensions menu, then select **Open protected settings**.
7. Create and confirm your 4-digit PIN. There is no default PIN.

Keep the source folder in place after installation. Install the extension separately in each browser and profile you want to cover. A managed browser may restrict unpacked extensions.

The manifest specifies Chrome 120 or newer. The extension also targets Microsoft Edge's Chromium extension platform; compatibility still requires live verification.

## Usage

### Block a website

1. Open protected settings and enter your PIN.
2. Under **Blocked websites**, enter a domain such as `youtube.com` or `instagram.com`.
3. Select **Add site**.

Blocking `youtube.com` also covers `www.youtube.com` and `m.youtube.com`. Enter a domain, without a page path or query string.

When you visit a blocked website, Focus Lock displays a local block page. Enter your PIN to allow that domain and its subdomains for **15 minutes**. Other blocked domains remain blocked.

Use **End all website unlocks** in settings to revoke temporary access early. Temporary unlocks also end when the browser session ends.

### Approve a specific YouTube video

The **Approved YouTube videos** section provides breakthrough permission for individual videos.

1. Add `youtube.com` to **Blocked websites**.
2. While your settings session is unlocked with the PIN, paste a video URL or its 11-character ID into **Approved YouTube videos**.
3. Optionally add a label, such as the lesson title.
4. Select **Approve this video**.
5. Open the approved video using its link in the list.

Approved links use the standard watch-page format:

```text
https://www.youtube.com/watch?v=VIDEO_ID
```

An approved video remains available without another PIN. Approving one video does not approve its channel, playlist, recommendations, or other videos.

Pasted `youtu.be`, Shorts, live-video, and embed links are normalized to a video ID. Use the generated watch-page link afterward: the original Shorts, embed, or short-link route is not itself an approved route through a blocked domain. Add `youtu.be` separately if you also want to block that domain.

Adding an approved video does **not** automatically block YouTube. You must add `youtube.com` to the blocked list first.

### Manage the adult-site filter

The bundled adult-site domain list is active by default, including before PIN setup. It works alongside your custom domain list. Listed domains can be temporarily unlocked with the PIN.

The filter is a **starter domain list**, not an adult-content classifier. It does not inspect images or recognize all adult material. Unlisted domains, proxies, search results, and mixed-content platforms may remain accessible.

Add extra domains in settings as needed. To maintain the bundled list, edit `adult-domains.json` and reload the extension. The list does not update automatically.

### Change or lock your PIN settings

Settings sessions last **5 minutes**. During that period, you can add or remove domains and video approvals. Select **Lock settings** to close access sooner.

Changing the PIN requires your current PIN. Five failed attempts trigger a shared **60-second pause** for settings login and website unlocks.

There is no PIN recovery service. Uninstalling and reinstalling resets the PIN and removes custom settings.

## How it works

Focus Lock uses Manifest V3 and the browser's declarative network rules to redirect blocked top-level pages, block frames from blocked domains, and allow approved YouTube watch pages.

A background service worker manages PIN verification, settings authorization, temporary access, and expiry. Navigation listeners and a content script check in-page route changes, including YouTube navigation that happens without a full page load.

Ordinary YouTube link clicks are checked before navigation. History changes and autoplay can briefly begin rendering before the navigation guard redirects an unapproved page. This behavior requires live browser testing.

Approved videos are intended to open as full watch pages. The extension does not provide exceptions for embedded videos inside blocked-domain frames.

## Privacy and security

- Configuration stays in local extension storage. Temporary access grants use browser-session storage.
- The extension does not upload browsing URLs or maintain a full browsing-history log.
- Blocked destination URLs appear locally in the block page's URL fragment.
- The PIN is stored as a salted PBKDF2-SHA-256 hash using 210,000 iterations.
- Settings commands are authorized in the background service worker. Ordinary websites cannot use those commands to change your configuration.

A 4-digit PIN has only 10,000 possible combinations. Focus Lock is a focus tool, not tamper-proof parental control or a security boundary against a device owner. Someone who controls the browser can disable or uninstall the extension, change unpacked source files, or use another profile.

The extension blocks **browser websites**, not installed desktop or mobile applications. Other browsers and profiles are unaffected unless the extension is installed there. Private browsing requires enabling the extension separately in the browser's extension settings.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| HTTP/HTTPS host access | Apply custom blocking across websites and run the local navigation guard. |
| `declarativeNetRequest` | Redirect blocked pages, block frames, and allow approved video pages. |
| `storage` | Store configuration, PIN verification data, and temporary access state. |
| `webNavigation` | Detect page navigation and in-page route changes. |
| `alarms` | Expire temporary website access. |
| `tabs` | Check open tabs and redirect blocked pages when protection changes. |

## Development

The extension uses JavaScript ES modules, HTML, CSS, and browser extension APIs. It has no runtime package dependencies or build pipeline.

After changing the source:

1. Open your browser's extensions page.
2. Select **Reload** on Focus Lock.
3. Refresh any open website tabs so they receive the updated content script.

### Run automated tests

From the extension directory containing `package.json`, use Node.js 20 or newer:

```bash
npm test
```

No `npm install` is required. The suite uses Node's built-in test runner and covers domain boundaries, video URL validation, rule generation, PIN hashing, authorization, failed-attempt limits, and temporary access expiry. The service-worker integration test uses mocked Chrome APIs.

### Browser testing checklist

Live browser testing remains outstanding. Before relying on the extension:

- Load it in both Chrome and Edge and check the extension's **Errors** section.
- Confirm that blocked domains and their subdomains redirect to the block page.
- Verify incorrect PIN handling, the failed-attempt pause, and PIN changes.
- Confirm that temporary unlocks expire, affect open tabs, and can be revoked early.
- Approve one YouTube video, verify playback, and confirm that another video remains blocked.
- Check autoplay, playlists, Back/Forward navigation, mobile URLs, and new tabs.
- Verify blocking for a bundled adult domain and for frames from blocked domains.
- Restart the browser and confirm that custom settings persist while temporary unlocks end.

## Source overview

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension registration, permissions, and entry points. |
| `background.js` | Authenticated commands, access grants, network rules, and navigation enforcement. |
| `core.js` | Domain and video parsing, blocking decisions, rule generation, and PIN hashing. |
| `guard.js` | In-page navigation and playback checks. |
| `options.html` / `options.js` | PIN setup and protected settings. |
| `blocked.html` / `blocked.js` | Block page and temporary website unlock. |
| `popup.html` / `popup.js` | Toolbar popup. |
| `ui.js` / `style.css` | Shared interface helpers and styling. |
| `adult-domains.json` | Bundled adult-site domain list. |
| `tests/` | Automated unit and service-worker tests. |
