const { createClient } = require('@supabase/supabase-js');

function createSupabaseAuth(options = {}) {
  const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL || '';
  const anonKey = options.anonKey || process.env.SUPABASE_ANON_KEY || '';
  const clientFactory = options.clientFactory || createClient;

  function isConfigured() {
    return Boolean(supabaseUrl && anonKey);
  }

  function getPublicConfig() {
    if (!isConfigured()) return null;
    return { supabaseUrl, publishableKey: anonKey };
  }

  async function verifyAccessToken(accessToken) {
    if (!accessToken || typeof accessToken !== 'string') return null;
    if (!isConfigured()) {
      const error = new Error('Authentication is not configured.');
      error.code = 'AUTH_NOT_CONFIGURED';
      throw error;
    }

    try {
      const supabase = clientFactory(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error) {
        if ([400, 401, 403].includes(Number(error.status))) return null;
        const unavailable = new Error('Authentication service unavailable.');
        unavailable.code = 'AUTH_SERVICE_UNAVAILABLE';
        throw unavailable;
      }
      if (!data || !data.user || typeof data.user.id !== 'string' || !data.user.id) return null;
      return {
        id: data.user.id,
        email: typeof data.user.email === 'string' ? data.user.email : null
      };
    } catch (error) {
      if (error && error.code === 'AUTH_SERVICE_UNAVAILABLE') throw error;
      if (error && error.code === 'AUTH_NOT_CONFIGURED') throw error;
      const unavailable = new Error('Authentication service unavailable.');
      unavailable.code = 'AUTH_SERVICE_UNAVAILABLE';
      throw unavailable;
    }
  }

  async function authenticateRequest(req) {
    const header = req && req.headers && req.headers.authorization;
    const match = typeof header === 'string' ? header.match(/^Bearer\s+([^\s]+)$/i) : null;
    if (!match) return null;
    return verifyAccessToken(match[1]);
  }

  return { isConfigured, getPublicConfig, verifyAccessToken, authenticateRequest };
}

module.exports = { createSupabaseAuth };
