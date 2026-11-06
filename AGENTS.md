# AGENTS.md

How AI agents work on this repo. Claude Code reads this through `CLAUDE.md`; Codex reads it directly.

You are part of Thomas's team. Thomas reviews every PR and builds his own features locally at the same time. Write code and PRs that a busy reviewer can read in one sitting.

What the app is, and what stays out of it: `planning/product.md`. Read it before designing anything.

---

## 1. Design before code

Every feature or non-trivial fix follows these steps, in order:

1. **Question the brief.** Docs and requests carry assumptions, including Thomas's and other AIs'. Before designing:
   - Is the stated problem the real problem? Is it a problem for the customer at all?
   - Is the proposed solution the best one, or is there a simpler or better one?
   - Which design decisions in the doc are unjustified, outdated, or contradicted by the code?
   - Think from the customer's side: what do they see, what do they need, what would confuse them?
   - Check claims against the code. Docs drift; line numbers drift faster.
2. **High-level design.** Problem, approach, architecture, key decisions, and the alternatives you rejected and why.
3. **Low-level design.** Files, components, functions, data models, API shapes, migrations, edge cases, tests.
4. **Review.** Show the design to Thomas in the editor. Iterate until he approves. **Do not implement before approval.**
5. **Implement**, in small PRs (§3), each with tests (§4).

Small bug fixes (a few lines, obvious cause) can skip the design doc: state the cause and the fix in the PR description.

If something during implementation contradicts the approved design, stop and raise it. Don't quietly redesign.

## 2. Design docs

- Live in `planning/NN-short-name/design.md` (next free number). Optional `requirements.md` and `tasks.md` beside it.
- Match the existing docs (`planning/06-radar-table-refinement/design.md` is a good model):
  - Header block: `> **Status:** … · **Owner:** Thomas · **Last updated:** YYYY-MM-DD`, then a short scope and what it reuses/touches.
  - `## 1. Architecture` (where it fits, key decisions, data flow) → `## 2. Components and Interfaces` → `## 3. Data Models` → `## 4. Correctness Properties` (`### P1 — …`, each one testable) → `## 5. Resolved decisions` / open questions.
- Plain, direct sentences. Tables over long paragraphs. Real file paths, not hypotheticals.
- Never overwrite another feature's design doc. Add a new one or propose an edit in review.
- Mark facts you could not verify as unverified. Don't present guesses as findings.

## 3. Branches and PRs

- **Always PR into `dev`. Never into `main`.** Never push directly to `dev` or `main`.
- Work only in your own branch and your own folder (each agent has its own git worktree). Never switch, edit, or reset another worktree's branch.
- Never force-push a branch someone else is using.
- Keep `dev` merged into your branch so conflicts stay small.

**Keep PRs small.** Use judgment, but the target is:

- One concern per PR. A refactor, a bug fix, and a feature are three PRs.
- Roughly **under 10 files and ~400 changed lines**, not counting tests, lockfiles, and generated migrations. Going over needs a reason in the PR description.
- A large feature ships as a series of PRs that each work on their own (e.g. data layer → API → UI). Say in each description where it sits in the series.
- No drive-by refactors, renames, or reformatting of code the task doesn't need. Note them as follow-ups instead.

**PR description:**

```
## What
One or two sentences.

## Why
The problem, from the user's side. Link the design doc section.

## How it was checked
Tests added/run, commands, screenshots for UI changes.

## Notes for review
Where to look first, risks, anything deliberately left out.
```

**Commits:** one plain sentence describing the change, ending with a period, e.g. `Stop treating missing provider values as zero.`

## 4. Testing

Every PR adds or updates tests for the behavior it changes. A PR without tests needs a reason.

- Backend: `pytest` in `server/tests/`.
- Frontend: `npm test` (Vitest + Testing Library) and `npm run lint` in `client/`.
- Test the edge cases, not only the happy path: missing data, zero, negative, empty lists, errors.
- Every Correctness Property in a design doc maps to at least one named test.
- Run the relevant suites before opening a PR and report the result honestly. If a test fails or was skipped, say so.

## 5. Repo map

| Area | Where |
|---|---|
| Flask API | `server/app/routes/`, services in `server/app/services/`, models in `server/app/models.py` |
| Migrations | `server/migrations/versions/` (Alembic) |
| Scoring | `server/app/services/score_engine.py`, `server/app/utils/normalization.py`, `server/app/services/template_seed.py` |
| Data providers | `server/app/services/alpha_api.py`, `server/app/services/stock_manager.py` |
| AI calls | `server/app/alphaBot/` |
| React app | `client/src/` (pages, components, hooks, utils) |
| Planning | `planning/` — `README.md` has the feature sequence, `misc-tasks.md` the small fixes |

## 6. Rules that prevent real problems

- **Secrets:** never read, print, or commit `.env`, `*.secrets.local.txt`, or tokens. Never paste keys into code, tests, or PRs.
- **Data providers:** provider-specific calls and parsing stay in provider modules, so the data source can be swapped later. Don't spread Alpha Vantage field names through the codebase.
- **Migrations:** two branches that each add an Alembic migration create two heads (it has happened: `e7f8a9b0c1d2`). Before opening a PR with a migration, merge `dev` and re-point `down_revision` to the current head. Keep migrations additive unless the design says otherwise.
- **API cost:** Alpha Vantage and Claude calls cost money and share rate limits across every running environment. Don't add calls a click can trigger without a reason, and don't loop real API calls in tests. See `planning/13-cost-efficiency/design.md`.
- **Local stacks:** the Docker ports (5001, 5432, 5173) are fixed today, so only one full stack runs at a time. Prefer unit tests, which don't need ports.
- **Honesty:** don't claim something works unless you ran it. Say what you didn't verify.

## 7. When to stop and ask

- The design doc is ambiguous or wrong.
- The change would touch another agent's area or a file outside your task.
- The PR is heading past the size target.
- A fix needs a product decision (copy, defaults, what the user sees).
