# Design — Explicit Discover search

> **Status:** Approved · **Owner:** Thomas · **Last updated:** 2026-11-12
>
> Scope: let users set their constraints before starting Discover. Reuses the existing refinement chips, recommendation grid, and discovery API.

## 1. Architecture

`planning/product.md` calls for an explicit search. The current `DiscoveryPage` starts a request on mount, and `useDiscoveryManager` starts another request on each chip edit. The mount behavior also has a page test. Discover can fetch recommendations before the user has entered a constraint.

Open Discover with an enabled **Search** button and an optional plain-language field. The user can search with an empty field, type a request and search directly, or use **Add filter** to stage several constraints as chips. Adding, removing, and clearing chips edits the draft. Results remain visible while editing, with helper text saying **Search to apply your filters**. Search submits the ordered draft, including any text still in the field, in one request.

Keep the discovery manager mounted in the protected route layout. Users can leave Discover and return to their results and filter chips without a new request. The state lives in memory for the lifetime of the protected layout.

Removing only the mount effect would still start a request each time a user edits the chips. A separate prompt input and API field would add a second way to enter the same kind of instruction. The existing text field already accepts natural language and the existing API accepts an ordered list of instructions.

## 2. Components and Interfaces

| File | Proposed change |
|---|---|
| `client/src/pages/App.tsx` | Mount the discovery manager in a shared protected route layout and pass it to Discover through the route outlet. |
| `client/src/components/PrivateRoute.tsx` | Check the session when navigating between protected pages. |
| `client/src/pages/DiscoveryPage.tsx` | Remove the mount effect. Wire search and chip editing through `RefineSearchBar`. Use neutral intro copy before the first result. Keep the existing loading, results, and onboarding states. Show an error or a successful empty state as appropriate. The Search button is available to retry. |
| `client/src/components/discovery/RefineSearchBar.tsx` | Use the existing field in a form with **Search** as the submit action, including Enter. **Add filter** stages nonblank input as a chip. Search also stages any pending nonblank input and clears the field. At the chip limit, the user can still search with the staged chips. Disable editing and search while a request is in flight. |
| `client/src/hooks/useDiscoveryManager.tsx` | Keep the ordered draft and make chip editing local. `generate` accepts optional pending text, trims it, and submits the resulting list through the existing request path. Guard against overlapping submissions and keep the submitted chips available for retry after an error. |

## 3. Data Models

The draft is an ordered `string[]` in the hook, capped at the existing eight refinements, and the text field holds one uncommitted string. `POST /discovery/generate` accepts `{ refinements: string[] }`. An empty draft submits `[]`. The server continues to sanitize refinements and cache the response by profile and refinements.

## 4. Correctness Properties

| Property | Named regression test |
|---|---|
| **P1 — Discover stays idle until Search.** Opening the page and adding, removing, or clearing chips make zero discovery requests. | `DiscoveryPage.test.tsx`: `waits for Search while the user edits filters` |
| **P2 — Search works with or without constraints.** A blank draft submits `[]`. Search appends pending nonblank text once and preserves chip order. At capacity it still submits the eight staged chips. | `useDiscoveryManager.test.tsx`: `searches with an empty draft`, `includes pending text after the staged filters`, `searches with eight staged filters` |
| **P3 — One request at a time.** A second submission during an active request makes zero additional requests. After a failure, loading clears and the submitted filters can be searched again. | `useDiscoveryManager.test.tsx`: `ignores a second search while one is pending`, `keeps submitted filters available for retry` |
| **P4 — Result states stay distinct.** An empty success shows the empty state. A failed request shows the error and leaves Search available. | `DiscoveryPage.test.tsx`: `shows empty state when a run returns nothing`, `shows the request error and offers another search` |
| **P5 — Navigation retains results and filters.** Returning to Discover restores the results and draft chips without a request. Removing a chip changes the draft and the next explicit search uses the updated filters. | `DiscoveryPage.test.tsx`: `restores results and filters after leaving Discover without searching again` |

Run the Discovery page and hook tests, the frontend suite, and `npm run lint`. Check the idle, filtered, and error states visually for the PR.

## 5. Resolved decisions

Use one field for optional search instructions and chip creation. **Search** and Enter submit. **Add filter**, chip removal, and **Clear all** only edit the draft. Proposed button labels and behavior are for review.
