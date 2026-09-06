const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
let requests = 0, scenario = 'normal';
const user = id => ({ entryId: `user-${id}`, content: { itemContent: { user_results: { result: { __typename: 'User', rest_id: String(id), core: {screen_name: 'sample_' + id, name: 'Sample Person ' + id} } } } } });
const page = (ids, cursor) => ({ data: { user: { result: { timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: [...ids.map(user), ...(cursor ? [{ entryId: 'cursor-bottom', content: { cursorType: 'Bottom', value: cursor } }] : [])] }] } } } } } });
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/metrics') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({requests})); return; }
  if (url.pathname.includes('/UserByScreenName')) { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({data:{user:{result:{rest_id:'123',core:{screen_name:'demo_profile'}}}}})); return; }
  if (url.pathname.includes('/FollowersYouKnow')) {
    requests++;
    const vars = JSON.parse(url.searchParams.get('variables'));
    res.setHeader('Content-Type','application/json');
    if (vars.cursor && scenario === 'rate') { res.statusCode=429; res.end(JSON.stringify({errors:[{message:'Rate limited'}]})); return; }
    const data = scenario === 'long' ? page(Array.from({length:120},(_,i)=>i+1)) : scenario === 'zero' ? page([]) : vars.cursor ? scenario === 'repeat' ? page([1,2], 'next') : page([2,3,4]) : page([1,2], 'next');
    setTimeout(() => res.end(JSON.stringify(data)), scenario === 'slow' && vars.cursor ? 6000 : 80); return;
  }
  let file;
  if (/^\/demo_profile(?:\/followers_you_follow)?$/.test(url.pathname)) { file='tests/browser.html'; requests=0; scenario=url.searchParams.get('scenario') ?? 'normal'; }
  else if (['/endpoint.js','/core.js','/content.js','/popup.html','/popup.css','/tests/browser.js'].includes(url.pathname)) file=url.pathname.slice(1);
  else { res.statusCode=404; res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.setHeader('Cache-Control','no-store'); res.end(fs.readFileSync(path.join(base,file)));
}).listen(8766,'127.0.0.1',()=>console.log('Browser test: http://127.0.0.1:8766/demo_profile'));
