const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
let requests = 0, scenario = 'normal',activeRequests=0,peakRequests=0,rankStarted=0,rankFinished=0;
const fictional = [['Mira Vale','mira_builds'],['Theo Finch','theofinch_dev'],['Nova Reed','novareed_lab'],['Eli Moss','elimoss_notes'],['Aria Cove','ariacove_makes'],['Rowan Pike','rowanpike_io'],['Luna Hart','lunahart_space'],['Kai Wren','kaiwren_codes']];
const user = id => ({ entryId: `user-${id}`, content: { itemContent: { user_results: { result: { __typename: 'User', rest_id: String(id), core: {screen_name: fictional[id-1]?.[1] ?? 'sample_' + id, name: fictional[id-1]?.[0] ?? 'Sample Person ' + id} } } } } });
const page = (ids, cursor) => ({ data: { user: { result: { timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: [...ids.map(user), ...(cursor ? [{ entryId: 'cursor-bottom', content: { cursorType: 'Bottom', value: cursor } }] : [])] }] } } } } } });
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/metrics') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({requests,peakRequests,rankingMs:rankFinished-rankStarted})); return; }
  if (url.pathname.includes('/UserByScreenName')) { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({data:{user:{result:{rest_id:'123',core:{screen_name:'demo_profile'}}}}})); return; }
  if (url.pathname.includes('/FollowersYouKnow')) {
    requests++;
    const vars = JSON.parse(url.searchParams.get('variables'));
    res.setHeader('Content-Type','application/json');
    if((scenario==='budget' || scenario==='budget_auto' && requests===3) && vars.userId!=='123'){res.setHeader('x-rate-limit-remaining','5');res.setHeader('x-rate-limit-reset',String(Math.ceil(Date.now()/1000)+(scenario==='budget_auto'?2:60)));}
    if (vars.cursor && scenario === 'rate') { res.statusCode=429; res.end(JSON.stringify({errors:[{message:'Rate limited'}]})); return; }
    const data = ['demo','parallel'].includes(scenario) ? vars.userId==='123' ? page([1,2,3,4,5,6,7,8]) : page(Array.from({length:(Number(vars.userId)*7)%37+1},(_,i)=>1000+i)) : vars.userId !== '123' && scenario === 'long' ? page(Array.from({length:(Number(vars.userId)*7)%37+1},(_,i)=>1000+i)) : scenario === 'long' ? page(Array.from({length:120},(_,i)=>i+1)) : scenario === 'zero' ? page([]) : vars.cursor ? scenario === 'repeat' ? page([1,2], 'next') : page([2,3,4]) : page([1,2], 'next');
    if(vars.userId!=='123'){activeRequests++;peakRequests=Math.max(peakRequests,activeRequests);rankStarted ||= Date.now();}
    setTimeout(() => {res.end(JSON.stringify(data));if(vars.userId!=='123'){activeRequests--;rankFinished=Date.now();}},scenario==='parallel' && vars.userId!=='123'?2500:scenario === 'slow' && vars.cursor ? 6000 : 80); return;
  }
  let file;
  if (/^\/demo_profile(?:\/followers_you_follow)?$/.test(url.pathname)) { requests=0;activeRequests=peakRequests=rankStarted=rankFinished=0; scenario=url.searchParams.get('scenario') ?? 'normal'; file=scenario==='demo'?'tests/demo.html':'tests/browser.html'; }
  else if (['/endpoint.js','/core.js','/content.js','/popup.html','/popup.css','/tests/browser.js','/tests/demo.js','/tests/one-worker.js','/docs/x-open.jpg'].includes(url.pathname)) file=url.pathname.slice(1);
  else { res.statusCode=404; res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  res.setHeader('Cache-Control','no-store');
  const body=fs.readFileSync(path.join(base,file));
  res.end(file.endsWith('.html') && url.searchParams.get('baseline')==='1' ? body.toString().replace('<script src="/content.js">','<script src="/tests/one-worker.js"></script><script src="/content.js">') : body);
}).listen(8766,'127.0.0.1',()=>console.log('Browser test: http://127.0.0.1:8766/demo_profile'));
