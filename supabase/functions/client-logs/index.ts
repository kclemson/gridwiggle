/**
 * client-logs: Privacy-safe usage telemetry endpoint
 *
 * This edge function receives batched log entries from the client-side
 * `remoteLogger` and formats them as compact, human-readable lines in the
 * function's console output (viewable in Lovable Cloud logs).
 *
 * WHY THIS EXISTS:
 * GridWiggle is a client-side app with no user accounts. This is the only
 * way to understand usage patterns (how many photos, how often people
 * shuffle, whether they export). It was originally built for mobile
 * debugging but has been streamlined into a minimal telemetry feed.
 *
 * PRIVACY:
 * - No photo content, filenames, or thumbnails are ever sent
 * - No user identifiers, IP addresses, or device fingerprints
 * - Session IDs are random UUIDs generated fresh each page load
 * - Only numeric data (photo counts, aspect ratios) and event categories
 *
 * LOG FORMAT:
 *   [s:<6-char session prefix>] YY-MM-DD HH:MM:SS <event> | <details>
 *
 * EXPECTED EVENTS (category=telemetry):
 *   session   — app loaded, includes platform (mobile/desktop)
 *   photos    — layout generated, includes count + aspect ratios
 *   shuffle   — user clicked shuffle, includes shuffle # in session
 *   export    — user downloaded collage, includes photo count
 *
 * Non-telemetry logs (errors, warnings) are printed with full detail
 * to help diagnose crashes without requiring on-device debugging.
 *
 * The client batches logs every 5 seconds and sends them as a JSON array.
 * This function just reformats and prints — no database writes.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

interface LogPayload {
  logs: LogEntry[];
  sessionId: string;
  userAgent: string;
}

/**
 * Format a timestamp as "YY-MM-DD HH:MM:SS" for compact, scannable output.
 */
function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Format a telemetry log entry into a compact one-liner.
 *
 * Examples:
 *   [s:a1b2c3] 26-02-14 18:50:14 session | desktop
 *   [s:a1b2c3] 26-02-14 18:51:02 photos:5 | ARs: 0.75, 1.33, 1.0
 *   [s:a1b2c3] 26-02-14 18:51:08 shuffle:5 | #3
 *   [s:a1b2c3] 26-02-14 18:51:15 export:5
 */
function formatTelemetryLog(prefix: string, ts: string, log: LogEntry): string {
  const data = log.data ?? {};
  const count = data.count !== undefined ? `:${data.count}` : '';

  switch (log.message) {
    case 'session':
      return `${prefix} ${ts} session | ${data.platform ?? 'unknown'}`;

    case 'photos': {
      const ars = Array.isArray(data.aspectRatios)
        ? ` | ARs: ${(data.aspectRatios as number[]).join(', ')}`
        : '';
      const hero = (data.heroCount as number) > 0 ? ` | hero:${data.heroCount}` : '';
      return `${prefix} ${ts} photos${count}${ars}${hero}`;
    }

    case 'shuffle':
      return `${prefix} ${ts} shuffle${count} | #${data.shuffleNum ?? '?'}`;

    case 'export':
      return `${prefix} ${ts} export${count}`;

    default:
      // Unknown telemetry event — print raw data as fallback
      return `${prefix} ${ts} ${log.message}${count} | ${JSON.stringify(data)}`;
  }
}

serve(async (req) => {
  // CORS preflight for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { logs, sessionId }: LogPayload = await req.json();

    // Use first 6 chars of session UUID as a short, scannable prefix
    const sessionPrefix = `[s:${(sessionId ?? 'unknown').slice(0, 6)}]`;

    for (const log of logs) {
      const ts = formatTimestamp(log.timestamp);

      if (log.category === 'telemetry') {
        // Telemetry events get compact one-liner formatting
        console.log(formatTelemetryLog(sessionPrefix, ts, log));
      } else if (log.level === 'error' || log.level === 'warn') {
        // Errors and warnings keep full detail for debugging
        const dataStr = log.data ? ` ${JSON.stringify(log.data)}` : '';
        console.log(`${sessionPrefix} ${ts} ${log.level.toUpperCase()} | ${log.category}: ${log.message}${dataStr}`);
      }
      // Info logs from non-telemetry categories are silently dropped
      // (these are the old diagnostic logs we no longer need)
    }

    return new Response(JSON.stringify({ received: logs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Log ingestion error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process logs' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
