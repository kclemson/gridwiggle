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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { logs, sessionId, userAgent }: LogPayload = await req.json();
    
    console.log('=== CLIENT LOGS ===');
    console.log('Session:', sessionId);
    console.log('User-Agent:', userAgent);
    console.log('Log count:', logs.length);
    
    for (const log of logs) {
      const timestamp = new Date(log.timestamp).toISOString();
      const dataStr = log.data ? JSON.stringify(log.data) : '';
      console.log(`[${timestamp}] [${log.level.toUpperCase()}] ${log.category}: ${log.message}`, dataStr);
    }
    
    console.log('=== END LOGS ===');
    
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
