import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

const sessionId = crypto.randomUUID();
let logBuffer: LogEntry[] = [];
let flushTimeout: number | null = null;

export const remoteLogger = {
  log(level: 'info' | 'warn' | 'error', category: string, message: string, data?: Record<string, unknown>) {
    // Always log to console
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[${category}] ${message}`, data ?? '');
    
    // Buffer for remote sending
    logBuffer.push({
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    });
    
    // Flush immediately on errors, otherwise debounce
    if (level === 'error') {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  },
  
  info(category: string, message: string, data?: Record<string, unknown>) {
    this.log('info', category, message, data);
  },
  
  warn(category: string, message: string, data?: Record<string, unknown>) {
    this.log('warn', category, message, data);
  },
  
  error(category: string, message: string, data?: Record<string, unknown>) {
    this.log('error', category, message, data);
  },
  
  scheduleFlush() {
    if (flushTimeout) return;
    flushTimeout = window.setTimeout(() => {
      this.flush();
    }, 5000);  // Batch every 5 seconds
  },
  
  async flush() {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    
    if (logBuffer.length === 0) return;
    
    const logsToSend = [...logBuffer];
    logBuffer = [];
    
    try {
      await supabase.functions.invoke('client-logs', {
        body: {
          logs: logsToSend,
          sessionId,
          userAgent: navigator.userAgent,
        },
      });
    } catch (e) {
      // Silent - don't let logging failures break the app
      console.error('Failed to send remote logs:', e);
    }
  },
};

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    remoteLogger.flush();
  });
}
