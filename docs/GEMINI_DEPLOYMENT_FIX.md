# Reproducible Report — Gemini API deployment issue and fix

Date: 2026-05-10

## Summary

This document explains the deployment problems observed when building and running the project on Vercel, the root causes, the exact code fixes applied, and reproducible steps to verify the fix locally and in production.

Key problems addressed:
- Build-time TypeScript error caused by incorrect Firestore API usage.
- Runtime API failures because the Gemini API key was used directly in client-side code (exposed via `NEXT_PUBLIC_*`) and the frontend called the Gemini endpoint directly.

This repo change moves Gemini calls behind a server API route and corrects the Firestore API usage.

---

## Symptoms (observed)

From Vercel build log (abridged):

```
Failed to compile.

./src/app/page.tsx:383:89
Type error: Property 'doc' does not exist on type 'CollectionReference<DocumentData, DocumentData>'.

  381 |     if (!db) return
  382 |     try {
> 383 |       await deleteDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'profiles').doc(profileId) as any)
      |                                                                                         ^
  384 |     } catch (err) {
  385 |       setError('Delete failed.')
  386 |     }
```

Also: initially a local SWC binary load error was observed on Windows during local builds (not relevant to Linux Vercel):

```
Failed to load SWC binary for win32/x64
```

Runtime symptom before the fix:
- AI-generation features failed silently with generic messages like `Generation failed.` or `AI response failed.` The app used `NEXT_PUBLIC_GEMINI_API_KEY` and called `https://generativelanguage.googleapis.com/...` from the browser.

---

## Root causes

1. Firestore modular SDK usage: the code used chained `.doc()` on a `collection()` call which is not available in the v9+ modular Firestore API. The modular API expects `doc(db, ...segments)` to create a document reference.

2. Security and runtime reliability: The frontend called Gemini directly using a public API key (`NEXT_PUBLIC_GEMINI_API_KEY`). This exposes the key to users, and causes operational problems because server-side secrets are not guaranteed to be present or safe in client builds. Additionally, calling the Gemini endpoint from the browser is fragile (CORS, quota exposure, and secret leakage).

---

## Files changed

- `src/app/page.tsx` — fixed Firestore delete usage and replaced direct Gemini fetches with calls to the server API helper `callGemini()`.
- `src/app/api/gemini/route.ts` — NEW server route that forwards requests to the Gemini API using a server-side env var.

Commit: the fix was pushed in commit `5cd8971` (see git log).

---

## Exact fixes (what changed)

1) Firestore delete bug

- Broken code (original):

```ts
await deleteDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'profiles').doc(profileId) as any)
```

- Fix applied:

```ts
import { /* ... */, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'

// guard
if (!db || !user) return
await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profiles', profileId))
```

This uses `doc(db, ...segments, profileId)` which correctly returns a `DocumentReference` and fixes the TypeScript error.

2) Gemini API moved server-side

- Before: the frontend repeatedly called the Gemini REST endpoint directly, e.g.:

```js
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {...})
```

- After: all frontend Gemini calls were replaced with an internal helper `callGemini(payload)` which POSTs to `/api/gemini`.

- New server route: `src/app/api/gemini/route.ts` handles incoming requests and forwards them server-to-server to Google using a server-only env var `GEMINI_API_KEY`. It also supports an optional `GEMINI_MODEL` env var (default: `gemini-2.5-flash`).

Why this is better:
- The real API key stays in server env (not exposed to browsers).
- You can control rate limits, caching, and error handling on the server route and produce much clearer errors in Vercel logs.

---

## Reproducible steps (local)

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/Joshu2001/CV-master-Pro.git
cd CV-master-Pro
npm ci
```

2. Reproduce the original TypeScript build error (before the fix)

```bash
npm run build
# you should see the TypeScript ``Property 'doc' does not exist...`` error
```

3. After applying the Firestore fix (already in the repo), run:

```bash
npx tsc --noEmit
npm run build
```

Both commands should complete without the earlier TypeScript error.

---

## Reproducible steps (server API / deployment)

1. In Vercel project settings, set the server environment variables (Production & Preview):

- `GEMINI_API_KEY` = (your server-side API key)
- Optionally: `GEMINI_MODEL` = `gemini-2.5-flash` (default, optional)

Note: Do NOT set the key as `NEXT_PUBLIC_GEMINI_API_KEY` in production. Exposing keys publicly is insecure.

2. Redeploy the `main` branch (Vercel auto-deploys on push). Confirm the deployment corresponds to commit `5cd8971` or a newer commit.

3. Test the server route directly (replace `<your-deploy>` with your Vercel domain):

```bash
curl -X POST https://<your-deploy>.vercel.app/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

Expected result: a JSON response from the Gemini API (proxied) or a clear error message explaining the problem (e.g., invalid API key, quota, model deprecation).

4. After a successful server response, exercise the UI features that call Gemini (Rewrite CV, Cover Letter, etc.) — errors will now surface server-side and be visible in Vercel logs.

---

## Verification commands

- Type-check locally:

```bash
npx tsc --noEmit
```

- Build locally:

```bash
npm run build
```

- Test server proxy endpoint (example):

```bash
curl -X POST https://<your-deploy>.vercel.app/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Test"}]}]}'
```

---

## Recommendations / follow-ups

- Rotate your Gemini API key if it was ever committed or exposed (replace the key in Google Cloud and update `GEMINI_API_KEY` in Vercel).
- Do not create `NEXT_PUBLIC_GEMINI_API_KEY` with production keys; only use `NEXT_PUBLIC_*` for non-sensitive client-only values.
- Monitor Vercel deployment logs for server route errors (they will be much more specific now).
- Consider adding request quotas and simple caching on the server route to reduce cost and throttle misuse.

---

## Where to look in the code

- Fixes implemented in:
  - `src/app/page.tsx`
  - `src/app/api/gemini/route.ts`

View the files for exact diffs and code.

---

If you want, I can also:
- Add a short automated `curl` smoke-test script to `scripts/`.
- Update `DEPLOYMENT.md` to include the recommended Vercel env var names.


