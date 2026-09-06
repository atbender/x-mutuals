/* Shared, dependency-free parsing and pagination. No browser credentials here. */
(function (root) {
  'use strict';
  function parsePage(data) {
    if (data?.errors?.length) throw new Error('X could not return this list. Try again later.');
    const result = data?.data?.user?.result;
    const instructions = result?.timeline?.timeline?.instructions ?? result?.timeline?.instructions;
    if (!Array.isArray(instructions)) throw new Error('X changed its response. The count could not be verified.');
    const ids = new Set(), users = new Map();
    let cursor = null, unknown = false, recognized = false, terminated = false;
    let userEntries = 0;
    for (const instruction of instructions) {
      if (instruction.type === 'TimelineTerminateTimeline' && /Bottom|Both/i.test(instruction.direction)) {
        recognized = true; terminated = true;
      }
      if (!['TimelineAddEntries', 'TimelineReplaceEntry'].includes(instruction.type)) continue;
      recognized = true;
      const entries = instruction.entries ?? (instruction.entry ? [instruction.entry] : []);
      for (const entry of entries) {
        const c = entry.content;
        if (c?.cursorType === 'Bottom') cursor = typeof c.value === 'string' ? c.value : null;
        if (!/^user-/.test(entry.entryId ?? '')) continue;
        userEntries++;
        const user = c?.itemContent?.user_results?.result;
        if (user?.__typename === 'User' && /^\d+$/.test(user.rest_id ?? '')) {
          ids.add(user.rest_id);
          const handle = user.core?.screen_name ?? user.legacy?.screen_name ?? '';
          const image = user.avatar?.image_url ?? user.legacy?.profile_image_url_https ?? '';
          users.set(user.rest_id, {
            id: user.rest_id, handle: /^\w{1,15}$/.test(handle) ? handle : '',
            name: String(user.core?.name ?? user.legacy?.name ?? 'X account').slice(0,100),
            avatar: /^https:\/\/pbs\.twimg\.com\//.test(image) ? image : '',
            verified: Boolean(user.is_blue_verified || user.legacy?.verified)
          });
        }
        else unknown = true;
      }
    }
    if (!recognized) throw new Error('X returned an unfamiliar list. The count could not be verified.');
    // An empty, successfully parsed page is the end used by X clients. A hidden
    // user is NOT an empty page, and a short page is NOT proof of exhaustion.
    return { ids: [...ids], users: [...users.values()], cursor, unknown, done: terminated || !cursor || userEntries === 0 };
  }

  async function countPages({ first, fetchPage, onProgress = () => {}, signal, maxPages = 100 }) {
    const ids = new Set(), users = new Map(), cursors = new Set();
    let data = first, pages = 0, unknown = false;
    const snapshot = (complete, reason = '') => ({ count: ids.size, users: [...users.values()], pages, complete, reason });
    try {
      while (pages < maxPages) {
        if (signal?.aborted) return snapshot(false, 'Check paused.');
        const page = parsePage(data);
        pages++;
        page.ids.forEach(id => ids.add(id));
        page.users.forEach(user => users.set(user.id, user));
        unknown ||= page.unknown;
        onProgress(snapshot(false));
        if (page.done) return snapshot(!unknown, unknown ? 'Some connections are unavailable.' : '');
        if (signal?.aborted) return snapshot(false, 'Check paused.');
        if (pages >= maxPages) return snapshot(false, 'Reached the page limit. This is a minimum count.');
        if (cursors.has(page.cursor)) return snapshot(false, 'X repeated a page. Try again later.');
        cursors.add(page.cursor);
        data = await fetchPage(page.cursor, signal);
      }
      return snapshot(false, 'Reached the page limit. This is a minimum count.');
    } catch (error) {
      return snapshot(false, signal?.aborted ? 'Check paused.' : error.message || 'Connection interrupted.');
    }
  }
  function findUsers(users, query) {
    const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return users;
    const score = (text, term) => {
      const direct = text.indexOf(term);
      if (direct >= 0) return direct;
      let at = -1, first = -1;
      for (const char of term) {
        at = text.indexOf(char, at + 1);
        if (at < 0) return Infinity;
        if (first < 0) first = at;
      }
      return 100 + first + at - first - term.length;
    };
    return users.map((user, index) => ({ user, index, score: terms.reduce((total, term) =>
      total + Math.min(score(normalize(user.name), term), score(normalize(user.handle), term.replace(/^@/, ''))), 0) }))
      .filter(item => Number.isFinite(item.score)).sort((a,b) => a.score-b.score || a.index-b.index).map(item => item.user);
  }
  const api = { parsePage, countPages, findUsers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.defineProperty(root, '__mutualsCore', { value: api, configurable: true });
})(globalThis);
