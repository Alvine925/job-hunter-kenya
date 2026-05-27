/**
 * Production Console Override
 * 
 * Silences ALL browser console output in production builds.
 * Preserves original methods in development for debugging.
 * 
 * This module MUST be imported as early as possible (ideally in the root layout's <head>
 * as an inline script) so it intercepts logs from third-party libraries, Supabase SDK,
 * TanStack Router, etc.
 */

/**
 * Production Console Override
 * 
 * Silences browser console output.
 * - In production: Silences ALL browser console output.
 * - In development: Silences only Supabase-related logs/warnings/errors to avoid clutter.
 * 
 * This module MUST be imported as early as possible (ideally in the root layout's <head>
 * as an inline script) so it intercepts logs from third-party libraries, Supabase SDK,
 * TanStack Router, etc.
 */

const noop = () => {};

/**
 * Returns an inline <script> string that overrides browser console output.
 * Designed to be injected via dangerouslySetInnerHTML inside <head> in the root shell.
 * 
 * @param isProd If true, completely silences all console methods. If false, filters out Supabase logs.
 */
export function getConsoleOverrideScript(isProd: boolean = false): string {
  if (isProd) {
    return `
(function() {
  try {
    var methods = ['log','debug','info','warn','error','trace','dir','dirxml',
                   'group','groupCollapsed','groupEnd','time','timeEnd','timeLog',
                   'table','count','countReset','assert','profile','profileEnd',
                   'clear'];
    var noop = function(){};
    for (var i = 0; i < methods.length; i++) {
      try { console[methods[i]] = noop; } catch(e) {}
    }
  } catch(e) {}
})();
`.trim();
  }

  // In development/non-prod, filter out Supabase/Postgrest/GoTrue logs
  return `
(function() {
  try {
    var methods = ['log','debug','info','warn','error'];
    var isSupabase = function(args) {
      for (var i = 0; i < args.length; i++) {
        var arg = args[i];
        if (typeof arg === 'string') {
          var lower = arg.toLowerCase();
          if (lower.indexOf('supabase') !== -1 || lower.indexOf('postgrest') !== -1 || lower.indexOf('gotrue') !== -1) {
            return true;
          }
        } else if (arg && typeof arg === 'object') {
          try {
            var str = JSON.stringify(arg).toLowerCase();
            if (str.indexOf('supabase') !== -1 || str.indexOf('postgrest') !== -1 || str.indexOf('gotrue') !== -1) {
              return true;
            }
          } catch(e) {}
        }
      }
      return false;
    };
    for (var i = 0; i < methods.length; i++) {
      (function(method) {
        var original = console[method];
        if (!original) return;
        console[method] = function() {
          var args = Array.prototype.slice.call(arguments);
          if (isSupabase(args)) {
            return;
          }
          original.apply(console, arguments);
        };
      })(methods[i]);
    }
  } catch(e) {}
})();
`.trim();
}

/**
 * Module-level side-effect override — suppresses console output at the module level.
 * Falls back gracefully if console is frozen.
 */
export function silenceConsole(isProd: boolean = false): void {
  if (typeof globalThis === "undefined" || !globalThis.console) return;

  if (isProd) {
    const methods = [
      "log", "debug", "info", "warn", "error", "trace", "dir", "dirxml",
      "group", "groupCollapsed", "groupEnd", "time", "timeEnd", "timeLog",
      "table", "count", "countReset", "assert", "profile", "profileEnd", "clear",
    ] as const;

    for (const method of methods) {
      try {
        (globalThis.console as any)[method] = noop;
      } catch {
        // Some environments freeze console
      }
    }
    return;
  }

  // Filter Supabase logs in dev
  const methods = ["log", "debug", "info", "warn", "error"] as const;
  const isSupabase = (args: any[]) => {
    for (const arg of args) {
      if (typeof arg === "string") {
        const lower = arg.toLowerCase();
        if (lower.includes("supabase") || lower.includes("postgrest") || lower.includes("gotrue")) {
          return true;
        }
      } else if (arg && typeof arg === "object") {
        try {
          const str = JSON.stringify(arg).toLowerCase();
          if (str.includes("supabase") || str.includes("postgrest") || str.includes("gotrue")) {
            return true;
          }
        } catch {}
      }
    }
    return false;
  };

  for (const method of methods) {
    try {
      const original = (globalThis.console as any)[method];
      if (!original) continue;
      (globalThis.console as any)[method] = function (...args: any[]) {
        if (isSupabase(args)) return;
        original.apply(this, args);
      };
    } catch {}
  }
}
