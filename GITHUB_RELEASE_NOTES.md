# GitHub release notes

Suggested tag: `v1.1.0`

Suggested release or pull request title:

**Fix YouTube video approvals and allow browsing — v1.1.0**

Copy the following description into the GitHub release or pull request after adding the updated source files to your repository.

---

## Problem and resulting behavior

Approving a YouTube video could fail because its generated `regexFilter` exceeded Chrome's 2 KB compiled-regex memory limit. Blocking `youtube.com` also prevented searching or browsing for videos.

This update replaces per-video network regex rules with URL parsing and exact video-ID checks. With `youtube.com` in the blocked list, users can browse YouTube and open approved videos. Unapproved video destinations still open the PIN-protected block page.

## Changes

- Keep the YouTube homepage, search results, channels, feeds, and playlist pages available for browsing.
- Compare exact, case-sensitive video IDs across watch pages, short links, Shorts, live videos, and supported embeds.
- Apply YouTube restrictions to `youtu.be` and `youtube-nocookie.com` when `youtube.com` is blocked.
- Pause previews and the miniplayer on browsing pages, and check playlist/autoplay destinations individually.
- Remove old per-video dynamic rules when installing the updated rule set.
- Recheck open pages and frames when restrictions or temporary grants change.
- Ignore stale navigation responses and reject ambiguous or malformed video URLs.
- Clarify the settings text and reorganize the README with a final **Updates** section for future version entries.
- Set `manifest.json` and `package.json` to version `1.1.0`; retain the existing permissions.

Ordinary website/adult-domain blocking and the existing PIN, settings-session, and temporary-unlock durations retain their previous behavior.

## Validation

- All **16 automated tests passed** after the implementation update.
- JavaScript syntax checks passed for `core.js`, `background.js`, and `guard.js`.
- Tests cover domain boundaries, URL parsing, exact IDs, duplicate video parameters, browsing/playback decisions, 100 approvals without per-video regex rules, migration away from old rules, authentication, temporary grants, stale navigation, and embedded playback decisions.
- Browser APIs and the DOM are simulated. A live browser smoke test could not run because Chromium's executable was missing. Real YouTube playback and Chrome/Edge compatibility still need local verification. URL-based checks may briefly render a page before redirection.

## Upgrade instructions

1. Replace files inside the original extension folder; keep the existing extension installed.
2. Select **Reload** on Focus Lock in `chrome://extensions` or `edge://extensions`.
3. Refresh already-open YouTube tabs.
4. Keep `youtube.com` in the blocked list and approve videos using normal URLs without backslashes, or their 11-character IDs.

Keeping the same extension identity preserves the saved PIN and lists. Temporary unlocks may end on reload.

---

## Files to include in the repository update

Paths are relative to the extension directory containing `manifest.json`.

| File | Change |
| --- | --- |
| `core.js` | URL-based video policy; browsing/playback decisions; removal of per-video network rules. |
| `background.js` | Return playback decisions, refresh existing pages/frames, and ignore stale blocked navigations. |
| `guard.js` | Pause unapproved/pending playback, handle route changes, and refresh policy after configuration changes. |
| `options.html` | Explain YouTube browsing and approved-video behavior. |
| `manifest.json` | Set extension version to `1.1.0`. |
| `package.json` | Set package version to `1.1.0`. |
| `tests/core.test.js` | Expand URL, policy, alias, and rule-generation coverage. |
| `tests/background.test.js` | Cover old-rule removal, open-tab decisions, grants, and stale navigation. |
| `tests/guard.test.js` | Add playback, preview, embed, stale-response, and approval-change tests. |
| `README.md` | Update usage and add versioned release history at the end. |

The implementation files are supplied in the updated extension ZIP from this conversation. Use the separate, newly generated `README.md` in place of the earlier README inside that ZIP. Keep this notes file as a local reference or add it to the repository if desired.

Suggested commit title:

```text
Fix YouTube video approval rules and allow browsing (v1.1.0)
```

These notes are prepared for copying into GitHub; no repository commit, push, pull request, or release has been created.
