const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePage, countPages } = require('../core.js');
const user = id => ({ entryId: `user-${id}`, content: { itemContent: { user_results: { result: { __typename: 'User', rest_id: id } } } } });
const page = (ids, cursor = null, extra = []) => ({ data: { user: { result: { timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: [...ids.map(user), ...extra, ...(cursor ? [{ entryId: 'cursor-bottom-0', content: { cursorType: 'Bottom', value: cursor } }] : [])] }] } } } } } });
test('counts distinct IDs across pages and requests the end', async () => {
  const requested = [];
  const result = await countPages({ first: page(['1', '2'], 'next'), fetchPage: async c => { requested.push(c); return page(['2', '3']); } });
  assert.equal(result.count, 3); assert.equal(result.complete, true); assert.deepEqual(requested, ['next']);
});
test('a short page with a cursor is not a full count', async () => {
  let called = false;
  await countPages({ first: page(['1'], 'next'), fetchPage: async () => { called = true; return page([]); } });
  assert.equal(called, true);
});
test('empty valid list is zero; malformed response is not', async () => {
  assert.equal((await countPages({ first: page([]) })).complete, true);
  assert.equal((await countPages({ first: {} })).complete, false);
  assert.throws(() => parsePage({ data: {} }));
});
test('rate limit retains verified lower bound', async () => {
  const r = await countPages({ first: page(['1', '2'], 'next'), fetchPage: async () => { throw new Error('X is limiting requests.'); } });
  assert.equal(r.count, 2); assert.equal(r.complete, false); assert.match(r.reason, /limiting/);
});
test('GraphQL errors, including partial data, never certify a count', async () => {
  const data = page(['1']); data.errors = [{ message: 'Forbidden' }];
  assert.equal((await countPages({ first: data })).complete, false);
});
test('repeating cursors terminate as incomplete', async () => {
  const r = await countPages({ first: page(['1'], 'same'), fetchPage: async () => page(['2'], 'same') });
  assert.equal(r.count, 2); assert.equal(r.complete, false); assert.match(r.reason, /repeated/);
});
test('unavailable users never result in a falsely complete list', async () => {
  const r = await countPages({ first: page(['1'], null, [{ entryId: 'user-2', content: { itemContent: { user_results: { result: { __typename: 'UserUnavailable' } } } } }]) });
  assert.equal(r.count, 1); assert.equal(r.complete, false);
});
test('abort stops additional pages and preserves lower bound', async () => {
  const c = new AbortController();
  let calls = 0;
  const r = await countPages({ first: page(['1'], 'next'), signal: c.signal, onProgress: () => c.abort(), fetchPage: async () => { calls++; throw new Error('aborted'); } });
  assert.equal(r.count, 1); assert.equal(r.complete, false); assert.equal(r.reason, 'Check paused.');
  assert.equal(calls, 0);
});
test('page cap is incomplete', async () => {
  let calls = 0;
  const r = await countPages({ first: page(['1'], 'next'), maxPages: 1, fetchPage: async () => { calls++; return page(['2'], 'another'); } });
  assert.equal(r.complete, false); assert.match(r.reason, /limit/);
  assert.equal(calls, 0);
});
module.exports = { page };
test('fuzzy finder matches accents, handles and missing letters without unrelated hits', () => {
  const { findUsers } = require('../core.js');
  const users = [{name:'Sample Person',handle:'sample_1'}, {name:'Café Studio',handle:'design_lab'}, {name:'Other',handle:'unrelated'}];
  assert.deepEqual(findUsers(users,'smpl'), [users[0]]);
  assert.deepEqual(findUsers(users,'cafe'), [users[1]]);
  assert.deepEqual(findUsers(users,'@design cafe'), [users[1]]);
  assert.deepEqual(findUsers(users,'zzzz'), []);
  assert.equal(findUsers(users,'  '),users);
});
test('user normalization excludes unsafe avatar and handle URLs', () => {
  const data=page(['1']);
  Object.assign(data.data.user.result.timeline.timeline.instructions[0].entries[0].content.itemContent.user_results.result, {core:{name:'<script>example</script>',screen_name:'javascript:bad'},avatar:{image_url:'https://untrusted.example/image.png'}});
  const parsed=parsePage(data).users[0];
  assert.equal(parsed.handle,'');assert.equal(parsed.avatar,'');assert.equal(parsed.name,'<script>example</script>');
});
