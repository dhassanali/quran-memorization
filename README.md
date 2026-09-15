# Hifz Journey

An offline-first Quran memorization progress tracker. It uses the Quran page (1–604) as its core unit, keeps all progress in IndexedDB on your device, and gives every page an independent spaced-repetition schedule.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## SRS ratings

| Rating | Meaning | Next interval |
| --- | --- | --- |
| 5 | Easy / perfect | previous × 2.5 |
| 4 | Good / a little work | previous × 1.6 |
| 3 | Average / needs practice | previous × 0.8 |
| 2 | Not good / needs work | 1 day |
| 1 | Very bad / hard | 1 day |

The site is configured for deployment at `https://dhassanali.github.io/quran-memorization/` using the included GitHub Actions workflow.
