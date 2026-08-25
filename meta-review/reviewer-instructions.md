# Reviewer instructions

## Entry point

Open `https://kennygcake.com/threads-review/` in a desktop browser. The interface is in English for review clarity. No Threads password, cookie, session, or access token is requested in the browser.

## Test `threads_keyword_search`

1. Confirm the page states that the feature is read-only and lists the prohibited write actions.
2. In **Public post keyword**, keep the prefilled keyword `甜點` or enter another simple keyword.
3. Click **Search public posts**.
4. Observe the server response. Each returned item contains only username, post ID/permalink, text excerpt, timestamp, and media type.
5. Open a permalink in a separate tab if desired to compare it with the public Threads post.
6. Note: before Advanced Access is approved, Meta may restrict results to the authenticated test user's own posts. The UI reports this restriction and does not show mocked public results.

## Test `threads_profile_discovery`

1. In **Public Threads username**, enter `meta` (or another profile eligible under Meta's current review/test rules).
2. Click **Look up public profile**.
3. Observe the public fields: username, name, biography, follower count, profile URL, and verification status.
4. If the permission has not yet been added to the review token, the UI displays Meta's sanitized permission error. After the reviewer/test user grants the requested permission, repeat this step.

## Expected safety behavior

- Tokens remain server-side and never appear in page source, browser storage, query strings, or UI output.
- Invalid keywords/usernames are rejected before an API call.
- Requests are rate-limited.
- The demo contains no button or API route for publishing, replying, messaging, liking, following, unfollowing, webhooks, or account changes.

## Reviewer account/access

Use the Meta reviewer/test-user flow configured in App Dashboard. If Meta requires credentials for a dedicated reviewer account, provide them only through Meta's protected reviewer-instructions field, never in source control or email.
