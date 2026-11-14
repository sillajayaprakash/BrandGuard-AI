(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrandGuardAuth = api.createController({ root });
})(typeof window !== 'undefined' ? window : globalThis, function (defaultRoot) {
  function createController(options = {}) {
    const root = options.root || defaultRoot;
    const fetchImpl = options.fetchImpl || root.fetch.bind(root);
    const sdk = options.sdk || root.supabase;
    let client = null;

    async function initialize() {
      if (!sdk || typeof sdk.createClient !== 'function') {
        throw new Error('The Supabase browser library did not load. Reload the page and try again.');
      }
      let response;
      try {
        response = await fetchImpl('/api/auth/config', { credentials: 'same-origin' });
      } catch {
        throw new Error('Could not reach the BrandGuard server. Check the connection and try again.');
      }
      if (!response.ok) {
        if (response.status === 503) throw new Error('Supabase authentication is not configured on this server.');
        throw new Error('Could not load authentication settings. Try again later.');
      }
      const config = await response.json();
      if (!config.supabaseUrl || !config.publishableKey) {
        throw new Error('Supabase authentication settings are incomplete.');
      }
      client = sdk.createClient(config.supabaseUrl, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storage: root.sessionStorage
        }
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error('Could not restore the sign-in session. Please sign in again.');
      if (!data.session) return { session: null, user: null };
      try {
        return { session: data.session, user: await getVerifiedUser() };
      } catch (error) {
        if (error && error.code === 'AUTH_INVALID_SESSION') {
          await client.auth.signOut({ scope: 'local' });
          return { session: null, user: null };
        }
        throw error;
      }
    }

    async function signUp(email, password) {
      if (!client) throw new Error('Authentication is not ready. Reload the page and try again.');
      const { data, error } = await client.auth.signUp({
        email: String(email || '').trim(),
        password,
        options: { emailRedirectTo: root.location.origin }
      });
      if (error) throw new Error(error.message || 'Registration could not be completed.');
      return data;
    }

    async function signIn(email, password) {
      if (!client) throw new Error('Authentication is not ready. Reload the page and try again.');
      const { data, error } = await client.auth.signInWithPassword({
        email: String(email || '').trim(),
        password
      });
      if (error) throw new Error(error.message || 'Sign in failed. Check your email and password.');
      return data;
    }

    async function signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw new Error('Could not complete sign out. Please try again.');
    }

    async function getSession() {
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error('Could not read the sign-in session.');
      return data.session || null;
    }

    async function apiFetch(input, init = {}) {
      const session = await getSession();
      if (!session || !session.access_token) throw new Error('Please sign in to continue.');
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${session.access_token}`);
      const response = await fetchImpl(input, {
        ...init,
        headers,
        credentials: 'same-origin'
      });
      if (response.status === 401 && client) {
        await client.auth.signOut({ scope: 'local' });
      }
      return response;
    }

    async function getVerifiedUser() {
      const response = await apiFetch('/api/auth/me');
      if (!response.ok) {
        const error = new Error(response.status === 401
          ? 'Your sign-in session has expired. Please sign in again.'
          : 'Could not verify the signed-in user.');
        if (response.status === 401) error.code = 'AUTH_INVALID_SESSION';
        throw error;
      }
      const result = await response.json();
      if (!result.user || !result.user.id) throw new Error('The server did not return a verified user.');
      return { ...result.user, role: result.role || 'user' };
    }

    function onAuthStateChange(callback) {
      if (!client) return null;
      const { data } = client.auth.onAuthStateChange((event, session) => callback(event, session));
      return data && data.subscription;
    }

    return { initialize, signUp, signIn, signOut, getSession, getVerifiedUser, apiFetch, onAuthStateChange };
  }

  return { createController };
});
