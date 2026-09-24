# Quran page reviews and FSRS implementation plan

## Current implementation status

The page word review flow, FSRS scheduling, Settings dialog, JSON backup replacement, IndexedDB migration, shell caching, and relevant automated tests are implemented. All 604 public API page responses passed the word and line audit in `scripts/validate-quran-pages.mjs`. Browser checks in Chrome covered pages 1, 3, 187, and 604, including heading counts; page 1 also passed draft persistence and an offline reload. The mobile Settings check exposed a full-screen height issue, for which a `100vh` fallback was added. That fix still needs a browser recheck. The current reader uses QCF V2 line positions with Unicode QPC Hafs text and a Quran Foundation font; exact print typography may vary by device.

Quran Foundation's September 2026 Developer Terms limit ordinary API content caching to one week. Cached pages now expire after six days. The font is loaded from the Foundation CDN at runtime, with a system font fallback offline. Longer offline retention requires a compliant Content Sync integration. Public distribution also needs an active Developer Console account for any font bundling and the applicable privacy policy and terms of use.

## Goal

Review complete 604-page Hafs Madani Mushaf pages by marking each word that was a memorization error. One page has one due date and one FSRS record, including pages containing multiple surahs. Replace the Again / Hard / Good / Easy buttons with a single **Finish review** action.

## Findings in the existing app

- The review text in `src/App.tsx` is the same placeholder basmala for every page; no full-page words can be marked.
- `src/srs.ts` uses a custom ease-factor scheduler. The displayed rating buttons expose its internal ratings.
- `src/App.tsx` fetches bounds through an effect that depends on bounds updates, which can duplicate requests.
- The date is recalculated only when React renders. A tab left open across midnight may show stale due pages.
- The empty library's “Back home” button adds a page.
- The service worker caches the shell HTML but does not reliably make JS/CSS available for first offline use.
- The test script's glob is unreliable, and dependencies were absent during the initial review.

## Implementation

1. Add a versioned Mushaf page source with actual ayahs and stable word IDs (`surah:ayah:position`), QPC V2 page and line placement, headings, and ayah endings. Load page content when opened and cache it for later offline review. Show a clear retry state when an uncached page is unavailable. Check the selected source's terms before redistribution.
2. Show one due page at a time. A tap toggles a word error; repeated taps do not add duplicate errors. Persist an unfinished draft and keep it when the user opens Settings or leaves the review. Count only Quran words, excluding headings, verse ornaments, and decorative basmalas. An actual numbered basmala ayah contributes its words.
3. On **Finish review**, calculate `errors / total Quran words` without rounding. Map 0 errors to Easy, up to 5% to Good, up to 10% to Hard, and above 10% to Again. Use a pinned `ts-fsrs` release with 90% desired retention and short-term scheduling disabled. Store FSRS card state and immutable review history, including timestamp, word IDs, counts, derived rating, and content/policy versions. Commit page update, history, and draft removal atomically; block double submission.
4. Migrate existing page records without changing their current due dates or counts. Initialize FSRS card state on the next review, without inventing ratings for old reviews.
5. Add an accessible Settings dialog, full screen on small displays. Put the daily page target (1–20, default 2), Arabic/English language choice, and backup tools there. Preserve review marks while Settings is open. Persist setting changes and restore the prior value on a storage failure.
6. Export all personal data as a versioned JSON backup: pages, FSRS state, review history, error marks, drafts, and settings. Exclude Quran downloads and fonts. Import via schema validation and a preview of date and record counts, followed by explicit replacement confirmation. Replace personal data in one transaction, leave the original data intact on failure, and refresh the UI.
7. Fix service worker asset caching, date rollover, duplicate fetching, and the empty library navigation. Update README and tests for the new flow.

## Verification

- Verify all 604 pages have valid word/line mappings; inspect early pages, a page with multiple surahs, At-Tawbah's opening, and the final page.
- Test error thresholds at exact boundaries, word toggle behavior, drafts, review transactions, legacy migration, and date rollover.
- Test Settings keyboard behavior, mobile layout, RTL/LTR, input bounds, and persistence errors.
- Test backup round trips, empty data, malformed or incompatible files, cancellation, and failed replacements.
- Run the test suite and production build with installed dependencies.

## Scope defaults

FSRS parameters and error thresholds are product defaults. Parameter optimization, other Mushaf editions, audio, partial-page reviews, and backup merging are outside this implementation.
