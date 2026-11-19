import { createClient } from '@supabase/supabase-js';

export interface SupabaseStatus {
  configured: boolean;
  reachable: boolean;
  hostname?: string;
  code?: string;
}

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const parseSupabaseHostname = (url: string): string | undefined => {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
};

const isValidSupabaseUrl = (url: string): boolean => {
  if (!url || url.includes('placeholder.supabase.co')) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured =
  isValidSupabaseUrl(rawUrl) &&
  Boolean(rawKey) &&
  rawKey !== 'placeholder_key';

const configuredHostname = isSupabaseConfigured ? parseSupabaseHostname(rawUrl) : undefined;
const supabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawKey : 'placeholder_key';

const STATUS_CACHE_TTL_MS = 15000;
let cachedStatus: SupabaseStatus | null = null;
let lastStatusCheck = 0;
let inFlightStatusCheck: Promise<SupabaseStatus> | null = null;

export async function checkSupabaseStatus(force = false): Promise<SupabaseStatus> {
  if (!isSupabaseConfigured) {
    return { configured: false, reachable: false, code: 'NOT_CONFIGURED' };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { configured: true, reachable: false, hostname: configuredHostname, code: 'OFFLINE' };
  }

  const now = Date.now();
  if (!force && cachedStatus && now - lastStatusCheck < STATUS_CACHE_TTL_MS) {
    return cachedStatus;
  }

  if (!force && inFlightStatusCheck) {
    return inFlightStatusCheck;
  }

  inFlightStatusCheck = (async () => {
    try {
      const res = await window.fetch('/api/supabase-status', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const status: SupabaseStatus = {
          configured: Boolean(data.configured ?? true),
          reachable: Boolean(data.reachable),
          hostname: data.hostname || configuredHostname,
          code: data.code,
        };
        cachedStatus = status;
        lastStatusCheck = Date.now();
        return status;
      }
    } catch {
      // Static/Capacitor fallback when Express API route is not present
    }

    const fallback: SupabaseStatus = {
      configured: true,
      reachable: typeof navigator === 'undefined' ? true : navigator.onLine,
      hostname: configuredHostname,
    };
    cachedStatus = fallback;
    lastStatusCheck = Date.now();
    return fallback;
  })();

  try {
    return await inFlightStatusCheck;
  } finally {
    inFlightStatusCheck = null;
  }
}

const buildUnreachableResponse = (status?: SupabaseStatus) => {
  const code = status?.code || 'SUPABASE_UNREACHABLE';
  const message =
    code === 'NOT_CONFIGURED'
      ? 'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
      : code === 'ENOTFOUND'
      ? `Servidor Supabase (${status?.hostname || ''}) não encontrado (DNS ENOTFOUND).`
      : 'Não foi possível contactar o servidor Supabase.';

  return new Response(
    JSON.stringify({
      error: 'supabase_unreachable',
      error_code: 'supabase_unreachable',
      code,
      message,
      msg: message,
    }),
    {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

const safeSupabaseFetch: typeof fetch = async (input, init) => {
  const status = await checkSupabaseStatus();
  if (!status.configured || !status.reachable) {
    return buildUnreachableResponse(status);
  }
  try {
    return await window.fetch(input, init);
  } catch {
    cachedStatus = {
      configured: true,
      reachable: false,
      hostname: configuredHostname,
      code: 'UNREACHABLE',
    };
    lastStatusCheck = Date.now();
    return buildUnreachableResponse(cachedStatus);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
  },
  global: {
    fetch: safeSupabaseFetch,
  },
});

export const logout = async () => {
  if (!isSupabaseConfigured) return;
  const status = await checkSupabaseStatus();
  if (!status.reachable) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

