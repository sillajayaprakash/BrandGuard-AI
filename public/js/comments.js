/**
 * Finding comment storage, scoped to a preset, finding ID, and audited content.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.BrandFindingComments = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  const STORAGE_KEY = 'brandguard_finding_comments_v1';

  function fingerprintContent(content) {
    const value = String(content == null ? '' : content);
    let hashA = 0x811c9dc5;
    let hashB = 0x1505;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      hashA = Math.imul(hashA ^ code, 0x01000193);
      hashB = Math.imul(hashB ^ code, 0x5bd1e995);
    }
    return `${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0).toString(16).padStart(8, '0')}`;
  }

  function createManager(storage) {
    function getStore() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }

    function saveStore(store) {
      storage.setItem(STORAGE_KEY, JSON.stringify(store));
    }

    function makeKey(presetId, findingId, content, userId) {
      if (!presetId || !findingId) throw new Error('A brand preset and finding ID are required.');
      const scope = [String(presetId), String(findingId), fingerprintContent(content)];
      return JSON.stringify(userId ? [String(userId), ...scope] : scope);
    }

    function getComments(presetId, findingId, content, userId) {
      const store = getStore();
      const key = makeKey(presetId, findingId, content, userId);
      if (userId && !Array.isArray(store[key])) {
        const legacyKey = makeKey(presetId, findingId, content);
        if (Array.isArray(store[legacyKey])) {
          store[key] = store[legacyKey];
          delete store[legacyKey];
          saveStore(store);
        }
      }
      const value = store[key];
      return Array.isArray(value) ? value.filter(comment =>
        comment && typeof comment.id === 'string' && typeof comment.text === 'string' && typeof comment.createdAt === 'string'
      ).map(comment => ({ ...comment })) : [];
    }

    function addComment(presetId, findingId, content, text, userId) {
      const cleanText = String(text == null ? '' : text).trim();
      if (!cleanText) throw new Error('Comment cannot be empty.');
      const key = makeKey(presetId, findingId, content, userId);
      const store = getStore();
      if (!Array.isArray(store[key])) store[key] = [];
      let id;
      try {
        id = root.crypto && typeof root.crypto.randomUUID === 'function'
          ? root.crypto.randomUUID()
          : `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      } catch {
        id = `comment_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      }
      const comment = { id, text: cleanText, createdAt: new Date().toISOString() };
      store[key].push(comment);
      saveStore(store);
      return { ...comment };
    }

    function deleteComment(presetId, findingId, content, commentId, userId) {
      const key = makeKey(presetId, findingId, content, userId);
      const store = getStore();
      if (!Array.isArray(store[key])) return false;
      const originalLength = store[key].length;
      store[key] = store[key].filter(comment => comment.id !== commentId);
      if (store[key].length === originalLength) return false;
      if (store[key].length === 0) delete store[key];
      saveStore(store);
      return true;
    }

    return { getComments, addComment, deleteComment };
  }

  function escapeMarkdownComment(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\\/g, '\\\\')
      .replace(/([`*_{}\[\]()#+\-.!|~])/g, '\\$1');
  }

  function formatMarkdownComments(comments) {
    return comments.map(comment => {
      const timestamp = new Date(comment.createdAt).toLocaleString();
      const text = escapeMarkdownComment(comment.text).replace(/\r\n?/g, '\n').replace(/\n/g, '\n  ');
      return `- **Comment (${timestamp}):** ${text}`;
    }).join('\n');
  }

  function formatPlainTextComments(comments) {
    return comments.map(comment => `- ${comment.createdAt}: ${comment.text}`).join('\n');
  }

  function getDefaultManager() {
    try {
      return createManager(root.localStorage);
    } catch {
      return createManager({
        getItem: () => null,
        setItem: () => { throw new Error('Comment storage is unavailable in this browser.'); }
      });
    }
  }

  const defaultManager = getDefaultManager();
  return {
    STORAGE_KEY,
    fingerprintContent,
    createManager,
    formatMarkdownComments,
    formatPlainTextComments,
    getComments: (...args) => defaultManager.getComments(...args),
    addComment: (...args) => defaultManager.addComment(...args),
    deleteComment: (...args) => defaultManager.deleteComment(...args)
  };
});
