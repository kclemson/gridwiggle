

# Identify Dev Sessions in Client Logs

## What this solves

Right now, every session log looks the same in the edge function output -- you can't tell which ones are from your local dev environment vs. real production users. This makes it hard to filter out your own activity when reviewing telemetry.

## What changes for you

Dev-mode sessions will be tagged in the logs:

```
[s:a1b2c3] 26-02-14 18:50:14 session | desktop [DEV]
```

Production sessions remain unchanged:

```
[s:d4e5f6] 26-02-14 18:50:14 session | desktop
```

You can then scan or search for `[DEV]` in the edge function logs to find (or exclude) your own sessions.

## Technical details

Two small changes:

### 1. Client: include `isDev` flag in session telemetry

**`src/hooks/useCollageState.ts`** (line ~262): Add `isDev: import.meta.env.DEV` to the session event data:

```typescript
remoteLogger.info('telemetry', 'session', {
  platform: isMobileDevice() ? 'mobile' : 'desktop',
  isDev: import.meta.env.DEV,
});
```

In production builds, `import.meta.env.DEV` is `false` (Vite statically replaces it). No privacy concern since it's a boolean flag about the build mode, not about the user.

### 2. Edge function: append `[DEV]` tag to session log line

**`supabase/functions/client-logs/index.ts`** in the `formatTelemetryLog` function, `session` case: check `data.isDev` and append a tag:

```typescript
case 'session': {
  const devTag = data.isDev ? ' [DEV]' : '';
  return `${prefix} ${ts} session | ${data.platform ?? 'unknown'}${devTag}`;
}
```

No changes to other event types needed -- once you see a `[DEV]` session line, you know every subsequent log with the same `[s:______]` prefix is yours.

