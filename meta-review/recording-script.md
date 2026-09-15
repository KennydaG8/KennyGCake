# Screen recording script and shot list

Record two separate 1080p or higher videos, one for each requested permission. Use an English browser/UI, show the full browser address bar, and add English captions where spoken narration is not in English. Do not reveal tokens, App Secret, cookies, developer tools, password-manager popups, or unrelated tabs.

## Video 1 — `threads_keyword_search` (about 90 seconds)

1. Show the Meta App Dashboard app name and app ID, then the requested `threads_keyword_search` permission/access-level screen.
2. Open `https://kennygcake.com/threads-review/`; show the URL and read-only safety notice.
3. Show the keyword field and explain that the staff user is searching public posts for manual collaboration assessment.
4. Enter `甜點`, click **Search public posts**, and wait for the live official Threads API response.
5. Point to username, post permalink, text excerpt, timestamp, and media type. Open one public permalink in a new tab.
6. Return to the demo and state that there are no publish, reply, DM, like, follow, or account-management controls.
7. If recording before Advanced Access approval, clearly caption: “Standard Access test: Meta limits results to the authenticated/app-role user. Advanced Access is requested to return eligible public posts.”

## Video 2 — `threads_profile_discovery` (about 90 seconds)

1. Show the Meta App Dashboard requested `threads_profile_discovery` permission/access-level screen.
2. Open the reviewer demo and scroll to **Public profile lookup**.
3. Enter an eligible public username, click **Look up public profile**, and wait for the live official Threads API response.
4. Point to username, name, biography, follower count, profile URL, and verification status. Explain that a human uses these public fields to distinguish a micro-organizer from a brand, platform, wholesaler, or large influencer.
5. Show that no private data, contact details, follower list, or interaction controls are present.
6. If the permission/token grant is not ready, record only after the human reviewer/test account has granted it; do not submit a video containing only a permission error as the primary evidence.

## Pre-recording checklist

- Live demo URL and backend both return HTTP 200.
- Token is valid for at least the expected review window.
- Each requested permission has produced a successful official API call within the previous 30 days.
- Browser zoom is 100–125%; text and cursor are readable.
- Notifications are disabled; secrets and personal tabs are closed.
- Final video file is reviewed frame-by-frame for accidental secret exposure.
