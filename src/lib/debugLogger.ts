export interface HeroLogEntry {
  timestamp: number;
  label: string;
  data: Record<string, unknown>;
}

/**
 * Wraps a function execution and captures all [Hero] console.log calls.
 * Only captures in dev mode - in production, runs the function without patching.
 */
export function captureHeroLogs<T>(fn: () => T): { result: T; logs: HeroLogEntry[] } {
  // Only capture in dev mode
  if (!import.meta.env.DEV) {
    return { result: fn(), logs: [] };
  }
  
  const logs: HeroLogEntry[] = [];
  const originalLog = console.log;
  
  console.log = (...args: unknown[]) => {
    originalLog.apply(console, args);
    
    if (typeof args[0] === 'string' && args[0].startsWith('[Hero]')) {
      logs.push({
        timestamp: Date.now(),
        label: args[0].replace('[Hero] ', ''),
        data: (args[1] as Record<string, unknown>) || {},
      });
    }
  };
  
  try {
    const result = fn();
    return { result, logs };
  } finally {
    console.log = originalLog;
  }
}
