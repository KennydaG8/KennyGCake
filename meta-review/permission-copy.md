# Meta Threads Advanced Access review copy

## `threads_keyword_search`

KennyG Cake uses `threads_keyword_search` in a read-only internal sourcing tool. An authorized staff member enters a product-relevant keyword, such as “甜點” (dessert), and the server calls the official Threads Keyword Search endpoint. The interface displays a limited set of public post fields: username, post ID/permalink, a short text excerpt, timestamp, and media type. A staff member then reviews the result and independently decides whether the author may be relevant for a potential business collaboration.

Advanced Access is necessary because Standard Access restricts results to the authenticated user or app-role users and therefore cannot support discovery of relevant public posts. The feature does not publish, reply, message, like, follow, unfollow, modify accounts, or operate webhooks. Tokens are stored only as server-side secrets. Inputs are validated, requests are rate-limited, and results are not sold or used for automated decisions.

## `threads_profile_discovery`

KennyG Cake uses `threads_profile_discovery` only after a staff member selects an author found through a public keyword search. The server calls the official public profile lookup endpoint and displays username, name, public biography, follower count, profile URL, and verification status when Meta makes those fields available. These fields help a human distinguish an individual micro-organizer from a brand, platform, wholesaler, or large influencer before deciding whether any manual outreach is appropriate.

Advanced Access is necessary to look up eligible public profiles that are not owned by app-role users. The feature does not access private profiles, contact information, DMs, follower lists, or non-public data, and it performs no Threads write action. The UI states when a profile is unavailable under Meta's eligibility or access rules and never replaces an unavailable API response with mock data.
