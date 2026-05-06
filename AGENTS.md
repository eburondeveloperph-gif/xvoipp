# Repository Guidelines

## Project Structure & Module Organization

This is a Vite + React + TypeScript app. Runtime code lives in `src/`.
`src/App.tsx` contains the main UI, Gemini Live session wiring, Firebase auth, and Realtime Database interactions. `src/main.tsx` mounts the React app. Shared browser utilities live in `src/lib/`, including `audio.ts` for microphone/PCM playback and `personality.ts` for agent prompt content. Global Tailwind CSS is in `src/index.css`.

Configuration files are at the repository root: `vite.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `firebase-applet-config.json`, `firestore.rules`, and `DRAFT_firestore.rules`. Build output goes to `dist/` and should not be edited manually.

## Build, Test, and Development Commands

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts Vite on `0.0.0.0:3000`.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally for final checks.
- `npm run lint` runs `tsc --noEmit`; treat this as the current type-check gate.
- `npm run clean` removes `dist/`.

## Coding Style & Naming Conventions

Use TypeScript/TSX with React functional components and hooks. Follow the existing style: single quotes, semicolons, two-space indentation in JSX-heavy blocks, and named exports for shared utilities. Components and interfaces use `PascalCase`; functions, variables, refs, and state setters use `camelCase`. Keep large reusable logic out of `App.tsx` when it becomes independently testable; place it under `src/lib/`.

## Testing Guidelines

There is no dedicated test runner configured yet. Before submitting changes, run `npm run lint` and `npm run build`. For UI/audio/session changes, also run `npm run dev` and verify sign-in, microphone permission handling, chat updates, and generated artifact actions manually. If tests are added, prefer colocated `*.test.ts` or `*.test.tsx` files and add the matching npm script in `package.json`.

## Commit & Pull Request Guidelines

This checkout has no local Git history, so no project-specific commit convention can be inferred. Use short Conventional Commit-style messages, for example `fix: handle mic permission errors` or `feat: add artifact download state`. Pull requests should include a clear summary, validation commands run, linked issue or task context, screenshots for UI changes, and notes for Firebase rules or environment changes.

## Security & Configuration Tips

Store `VITE_GEMINI_API_KEY` in `.env.local`; never commit local env files. The app reads this value from `import.meta.env`, so review client-side key exposure before production deployment. Do not hardcode secrets in `src/`. Keep Firebase config and rules changes deliberate, and document any database path or permission changes in the PR.
