# What the app is

Last updated 2026-11-06.

A few tools, each one actually useful. A pile of mediocre features is the failure mode. Simply Wall St already covers the "everything about a stock, thrown at you" version. This app does not try to match that surface.

Compare and the radar scoring pass are being refined separately. They are not tracked on this page.

The test for anything below: does this help the user? If it does not, it does not ship.

## The tools

1. **Invest.** Turn a ranking and a budget into share counts. Feature 07. One diversity control (sectors) and one distribution (stocks). Selling to rebalance is a later idea, written in that design. This version only buys.
2. **Discover.** Find stocks worth adding. The user starts the search, even if the search box is empty. Loading the page must not spend an AI call. A tag added after an automatic search would be a second call for the same visit.
3. **History of one stock.** The AlphaBot writeup on the stock page. It has to be something the user can use. It is not that today.
4. **Charge for it.** The product needs a way to make money. Cost of API and model calls is part of that, tracked in `planning/13-cost-efficiency/`. Work that before, during, or after the items on this page. Decide the order later.

## Discover, in a bit more detail

The tag style can stay. "Exclude EV companies" and "prefer dividend yield over 3%" are good constraints. Add one free-text line so the user can go further than tags, for example: "Show companies that would likely hold up if an AI bubble popped, including ones that do not touch AI." The line is optional. The search still does not run until the user asks.

## Stock-page analysis

The current AlphaBot analysis is slop. It uses emojis. It has no structure. It reads like a chat transcript, including the model's own planning and its tool calls. A real response opened with "Let me conduct a comprehensive analysis of Apple Inc.…" and then showed the raw `alpha_vantage_company_overview`, `earnings`, `cash_flow`, and `news_sentiment` invocations. The user should never see that.

Replace it with a fixed, intentional layout. A short list of what is working and what can go wrong is closer than another chat bubble. The exact layout can change. The tool trace cannot stay.

## Notes that are not features yet

- **User score.** A column the user fills in, plus a short reason they gave that score. Blank until they write it. Remembering why you bought it matters. It can later feed the user's own template. It does not feed the shared defaults.
- **News leaves the main page.** The main-page feed gives a little and costs a lot. Delete it, rework it, or move it to discovery. It is not part of Compare.
- **Edit the risk profile without retaking the questionnaire.** The user can change the risk score or setting directly. Taking every question again stays optional.
- **Profile sectors match the stock list.** The sectors in onboarding are the same sector names the tables and the diversity pie use. A profile sector that never appears on a stock is a broken control.
- **Design language.** `planning/12-design-language/` should either be what the app actually looks like, or be cleaned up with the other finished planning docs.
- **Clean up planning docs that are already built.** If a doc still has a real pending task, keep it. Brokerage import is the example: SnapTrade is in, and adding Plaid is still an open choice, so that doc stays.
- **Do not add a chart the user did not ask for.** Correlation and the like stay out until a tool above needs them.
