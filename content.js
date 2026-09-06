(() => {
  'use strict';
  if (window.__mutualsLoaded) return;
  Object.defineProperty(window, '__mutualsLoaded', { value: true });
  const { countPages, findUsers, ratePlan } = window.__mutualsCore;
  const nativeFetch = window.fetch.bind(window);
  const records = new Map(), profiles = new Map(), ranks = new Map();
  let rankNextAt = 0;
  let rankJob = null, sortMode = false, rankVersion = 0, rankMessage = "";
  const TTL = 5 * 60 * 1000;
  const endpointPattern = /^\/i\/api\/graphql\/[^/]+\/FollowersYouKnow$/;
  const operations = /^\/i\/api\/graphql\/[^/]+\/(FollowersYouKnow|UserByScreenName|UserByRestId)$/;
  const headerNames = ['authorization', 'content-type', 'x-csrf-token', 'x-twitter-auth-type', 'x-twitter-active-user', 'x-twitter-client-language', 'x-client-transaction-id', 'x-twitter-client-user-id'];
  let endpoint = window.__mutualsEndpointSeed;
  try {
    const saved = JSON.parse(localStorage.getItem('mutuals.endpoint.v1'));
    if (endpointPattern.test(saved?.path) && saved.features && typeof saved.features === 'object') endpoint = saved;
  } catch {}
  let viewer = '', route = '', auth = null, active = null, host = null, root = null;
  let queued = false, signature = '', timer = null, blockedUntil = 0;
  let collapsed = false, visibleRows = 100, searchOpen = false, query = '', focusSearch = false;

  function account() {
    const href = document.querySelector('[data-testid="AppTabBar_Profile_Link"]')?.getAttribute('href');
    return href?.match(/^\/(\w{1,15})\/?$/)?.[1].toLowerCase() ?? '';
  }
  function page() {
    const m = location.pathname.match(/^\/(\w{1,15})(?:\/(followers_you_follow|with_replies|media|highlights|articles))?\/?$/);
    if (!m || /^(home|explore|notifications|messages|settings|compose|i|login|logout|search)$/i.test(m[1])) return null;
    return { handle: m[1].toLowerCase(), list: m[2] === 'followers_you_follow' };
  }
  function inspectRequest(input, init = {}) {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.origin);
      if (url.origin !== location.origin || (init.method ?? input?.method ?? 'GET').toUpperCase() !== 'GET' || !operations.test(url.pathname)) return null;
      const source = new Headers(init.headers ?? input?.headers ?? {}), headers = new Headers();
      headerNames.forEach(key => { if (source.has(key)) headers.set(key, source.get(key)); });
      return { url, headers, variables: JSON.parse(url.searchParams.get('variables')), viewer: account(), handle: page()?.handle, operation: url.pathname.split('/').pop() };
    } catch { return null; }
  }
  function save(handle, record) {
    records.set(handle, { ...record, time: Date.now() });
    while (records.size > 64) records.delete(records.keys().next().value);
    schedule();
  }
  function statusMessage(status) {
    if (status === 429) return 'X is limiting requests. Try again later.';
    if (status === 401 || status === 403) return 'X could not authorize this check. Open its mutuals list to reconnect.';
    if (status === 404) return 'Reconnect once through X’s mutuals list.';
    return 'Couldn’t load mutuals. Try again later.';
  }
  function observe(info, status, data) {
    if (!info || !account() || info.viewer && info.viewer !== account()) return;
    syncAccount();
    const p = page();
    if (!p || info.handle !== p.handle) return;
    if (info.operation !== 'FollowersYouKnow') {
      const user = data?.data?.user?.result;
      const handle = (user?.core?.screen_name ?? user?.legacy?.screen_name ?? info.variables?.screen_name ?? '').toLowerCase();
      if (status !== 200 || handle !== p.handle || !/^\d+$/.test(user?.rest_id ?? '')) return;
      profiles.set(handle, user.rest_id);
      while (profiles.size > 64) profiles.delete(profiles.keys().next().value);
      auth = { headers: info.headers, viewer: account() };
      schedule(); return;
    }
    if (!/^\d+$/.test(info.variables?.userId ?? '') || profiles.has(p.handle) && profiles.get(p.handle) !== info.variables.userId) return;
    profiles.set(p.handle, info.variables.userId);
    auth = { headers: info.headers, viewer: account() };
    if (status === 200) {
      try {
        endpoint = { path: info.url.pathname, features: JSON.parse(info.url.searchParams.get('features') ?? '{}'), fieldToggles: JSON.parse(info.url.searchParams.get('fieldToggles') ?? '{}') };
        // Public query metadata only. Never persist session headers or cookies.
        localStorage.setItem('mutuals.endpoint.v1', JSON.stringify(endpoint));
      } catch {}
    }
    if (active || records.has(p.handle)) return;
    if (status !== 200) {
      if (status === 429) blockedUntil = Date.now() + 60000;
      save(p.handle, { count: 0, users: [], complete: false, reason: statusMessage(status) }); return;
    }
    run(p.handle, info.variables.cursor ? undefined : data);
  }
  window.fetch = function (input, init) {
    const info = inspectRequest(input, init), promise = nativeFetch(input, init);
    if (info) promise.then(r => r.clone().json().then(data => observe(info, r.status, data)).catch(() => {})).catch(() => {});
    return promise;
  };
  const meta = new WeakMap(), open = XMLHttpRequest.prototype.open, header = XMLHttpRequest.prototype.setRequestHeader, send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    meta.delete(this);
    try { const u = new URL(url, location.origin); if (u.origin === location.origin && String(method).toUpperCase() === 'GET' && operations.test(u.pathname)) meta.set(this, { method, url, headers: {} }); } catch {}
    return open.call(this, method, url, ...args);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (key, value) { if (meta.has(this)) meta.get(this).headers[key] = value; return header.call(this, key, value); };
  XMLHttpRequest.prototype.send = function (...args) {
    const m = meta.get(this), info = m && inspectRequest(m.url, m);
    if (info) this.addEventListener('load', () => { try { observe(info, this.status, this.responseType === 'json' ? this.response : JSON.parse(this.responseText)); } catch {} }, { once: true });
    return send.apply(this, args);
  };

  async function run(handle, first) {
    if (active || rankJob || !auth || auth.viewer !== account() || !profiles.has(handle) || page()?.handle !== handle || document.hidden) return;
    if (Date.now() < blockedUntil) {
      save(handle, { ...records.get(handle), count: records.get(handle)?.count ?? 0, complete: false, reason: 'X is limiting requests. Wait before checking again.' }); return;
    }
    const job = { handle, viewer: account(), controller: new AbortController(), started: performance.now(), requests: 0 };
    const headers = new Headers(auth.headers), userId = profiles.get(handle), template = structuredClone(endpoint);
    active = job;
    const update = r => { if (job.viewer === account()) save(handle, { ...r, extraRequests: job.requests }); };
    const fetchPage = async cursor => {
      if (job.controller.signal.aborted) throw new Error('Check paused.');
      const url = new URL(template.path, location.origin);
      if (!endpointPattern.test(url.pathname) || url.origin !== location.origin) throw new Error('Reconnect through X’s mutuals list.');
      const variables = { userId, count: 100, includePromotedContent: false };
      if (cursor) variables.cursor = cursor;
      url.searchParams.set('variables', JSON.stringify(variables));
      url.searchParams.set('features', JSON.stringify(template.features));
      if (template.fieldToggles) url.searchParams.set('fieldToggles', JSON.stringify(template.fieldToggles));
      job.requests++;
      const r = await nativeFetch(url.href, { method: 'GET', credentials: 'same-origin', headers, signal: AbortSignal.any([job.controller.signal, AbortSignal.timeout(15000)]) });
      if (r.status === 429) blockedUntil = Math.max(Date.now() + 60000, Number(r.headers.get('x-rate-limit-reset')) * 1000 || 0);
      if (!r.ok) throw new Error(statusMessage(r.status));
      return r.json();
    };
    update({ count: 0, users: [], complete: false });
    try {
      first ??= await fetchPage();
      const result = await countPages({ first, signal: job.controller.signal, maxPages: 50, onProgress: update,
        fetchPage: async cursor => { await new Promise(resolve => setTimeout(resolve, 750)); return fetchPage(cursor); } });
      update({ ...result, elapsedMs: Math.round(performance.now() - job.started) });
    } catch (e) { update({ count: 0, users: [], complete: false, reason: job.controller.signal.aborted ? 'Check paused.' : e.message }); }
    finally { if (active === job) active = null; schedule(); }
  }

  function ranking(user) {
    const cached = records.get(user.handle?.toLowerCase());
    const result = cached?.complete ? cached : ranks.get(user.id);
    return result && Date.now()-result.time < TTL ? result : null;
  }
  function compareRanks(a,b) {
    const x=ranking(a),y=ranking(b);return x && y ? y.count-x.count : x ? -1 : y ? 1 : 0;
  }
  function updateRankOrder() {
    if(!rankJob)return;
    rankJob.order=new Map([...(records.get(rankJob.handle)?.users ?? [])].sort(compareRanks).map((user,index)=>[user.id,index]));
    rankJob.sinceSort=0;rankJob.lastSort=performance.now();rankVersion++;schedule();
  }
  async function rankBatch() {
    if(navigator.locks){
      return navigator.locks.request('mutuals-ranking-'+account(),{ifAvailable:true},lock=>{
        if(lock)return rankAll();
        rankMessage='Another tab is calculating. Pause it to continue here.';schedule();
      });
    }
    return rankAll();
  }
  async function rankAll() {
    const p=page();
    if(!p || active || rankJob || !auth || auth.viewer!==account() || collapsed || document.hidden)return;
    const order=new Map([...(records.get(p.handle)?.users ?? [])].sort(compareRanks).map((user,index)=>[user.id,index]));
    const job={controller:new AbortController(),viewer:account(),handle:p.handle,requests:0,order,currentId:null,delayMs:1000,lastSort:performance.now(),sinceSort:0};
    const candidates=(records.get(p.handle)?.users ?? []).filter(user=>!ranking(user));
    if(!candidates.length)return;
    rankJob=job;rankMessage='';schedule();
    const headers=new Headers(auth.headers), template=structuredClone(endpoint);
    const fetchRank=async(user,cursor)=>{
      const waitUntil=Math.max(rankNextAt,blockedUntil);
      if(Date.now()<waitUntil){
        if(Date.now()<blockedUntil){rankMessage='Taking a breather. Continuing when X’s allowance resets…';schedule();}
        await new Promise(resolve=>{
        const timer=setTimeout(done,Math.min(waitUntil-Date.now(),2147483647));
        function done(){clearTimeout(timer);job.controller.signal.removeEventListener('abort',done);resolve();}
        job.controller.signal.addEventListener('abort',done,{once:true});
      });
      if(!job.controller.signal.aborted){rankMessage='';schedule();}
      }
      if(job.controller.signal.aborted)throw new Error('Calculation paused.');
      if(job.requests>=300)throw new Error('Safety limit reached. Resume when ready.');

      const url=new URL(template.path,location.origin);
      if(!endpointPattern.test(url.pathname)||url.origin!==location.origin)throw new Error('Reconnect through X’s mutuals list.');
      url.searchParams.set('variables',JSON.stringify({userId:user.id,count:100,includePromotedContent:false,...(cursor?{cursor}:{})}));
      url.searchParams.set('features',JSON.stringify(template.features));
      if(template.fieldToggles)url.searchParams.set('fieldToggles',JSON.stringify(template.fieldToggles));
      job.requests++;
      const response=await nativeFetch(url.href,{credentials:'same-origin',headers,signal:AbortSignal.any([job.controller.signal,AbortSignal.timeout(15000)])});
      const pace=ratePlan(response.headers.get('x-rate-limit-remaining'),response.headers.get('x-rate-limit-reset'));
      job.delayMs=pace.delayMs;rankNextAt=Date.now()+pace.delayMs;blockedUntil=Math.max(blockedUntil,pace.blockedUntil);
      if(response.status===429)blockedUntil=Math.max(Date.now()+60000,Number(response.headers.get('x-rate-limit-reset'))*1000||0);
      if(!response.ok)throw new Error(statusMessage(response.status));
      return response.json();
    };
    try {
      for(const user of candidates){
        if(job.controller.signal.aborted || job.requests>=300){if(job.requests>=300)rankMessage='Safety limit reached. Resume when ready.';break;}
        job.currentId=user.id;rankVersion++;schedule();
        const maxPages=Math.min(2,300-job.requests);
        const result=await countPages({first:await fetchRank(user),maxPages,signal:job.controller.signal,fetchPage:cursor=>fetchRank(user,cursor)});
        if(job.viewer!==account() || job.controller.signal.aborted)break;
        ranks.set(user.id,{count:result.count,complete:result.complete,time:Date.now(),reason:result.reason});
        while(ranks.size>1000)ranks.delete(ranks.keys().next().value);
        job.sinceSort++;
        updateRankOrder();
        rankVersion++;schedule();
        if(!result.complete && !/page limit/.test(result.reason)){rankMessage=result.reason;break;}
      }
    }catch(error){rankMessage=job.controller.signal.aborted?'Calculation paused.':error.message;}
    finally{if(job.controller.signal.aborted)rankMessage='Calculation paused.';if(rankJob===job)rankJob=null;rankVersion++;schedule();}
  }

  const css = `
    :host{position:fixed;right:16px;top:76px;width:292px;z-index:1000;font:14px/1.4 TwitterChirp,"Avenir Next","Segoe UI",sans-serif;color:var(--text);color-scheme:light dark}
    *{box-sizing:border-box}button,a{font:inherit;color:inherit}button{cursor:pointer}a{text-decoration:none}
    .panel{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 4px 24px #0000000b}
    .heading{padding:17px 16px 12px}.top{display:flex;gap:9px;align-items:center}.title{font-size:17px;font-weight:700;margin:0}.count{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted);margin-left:1px}
    .icon{margin-left:auto;background:none;border:0;padding:3px 5px;color:var(--muted);font-size:20px;line-height:1}.icon:hover{color:var(--text)}
    .subtitle{font-size:12px;color:var(--muted);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.subtitle a{color:var(--text)}
    .people{max-height:min(560px,calc(100dvh - 230px));overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
    .person{display:flex;align-items:center;gap:10px;min-height:62px;padding:10px 16px}.person:hover{background:var(--hover)}.avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:none;background:var(--line);display:grid;place-items:center;font-size:13px;color:var(--muted)}
    .identity{min-width:0}.name{font-size:13px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.handle{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tick{color:#1d9bf0;font-size:11px;margin-left:4px}
    .footer{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding:11px 16px;font-size:11px;color:var(--muted)}
    .text-button{background:none;border:0;padding:0;color:var(--muted);font-size:11px}.text-button:hover{color:var(--text)}.text-button:disabled{cursor:default;opacity:.5}.status{display:flex;align-items:center;gap:5px}.dot{width:4px;height:4px;border-radius:50%;background:currentColor}.working .dot{animation:pulse .8s infinite alternate}@keyframes pulse{to{opacity:.25}}
    .empty{padding:18px 16px 24px;font-size:13px;color:var(--muted);line-height:1.6}.empty strong{display:block;color:var(--text);font-size:14px;margin-bottom:4px}.reconnect{display:inline-block;margin-top:12px;color:#1d9bf0}.more{display:block;padding:10px 16px;color:#1d9bf0;background:none;border:0;text-align:left;font-size:12px;width:100%}
    .collapsed{float:right;display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid var(--line);border-radius:99px;background:var(--paper);font-size:12px}.rings{display:flex;width:22px}.rings i{width:13px;height:13px;border:1.4px solid currentColor;border-radius:50%}.rings i+i{margin-left:-5px}
    button:focus-visible,a:focus-visible{outline:2px solid #1d9bf0;outline-offset:-3px}.skeleton{height:62px;padding:13px 16px;display:flex;gap:10px}.skeleton .avatar{opacity:.65}.bones{flex:1;padding-top:5px}.bone{height:7px;background:var(--line);border-radius:5px;width:74%;margin-bottom:9px}.bone+.bone{width:48%;opacity:.6}
    .search-button{display:grid;place-items:center;margin-left:auto}.search-button+.icon{margin-left:0}.search-box{margin-top:13px}.search-input{display:block;width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--paper);color:var(--text);font:12px/1.4 inherit;font-family:inherit;font-size:12px;outline:none}.search-input:focus{border-color:#1d9bf0}.search-input::placeholder{color:var(--muted)}.search-summary{padding:3px 16px 8px;color:var(--muted);font-size:11px}.people{scrollbar-gutter:stable;max-height:min(560px,calc(100dvh - 285px))}
    .ranking-controls{margin-top:13px}.sort-tabs{display:flex;gap:3px;background:var(--hover);border:1px solid var(--line);border-radius:8px;padding:3px}.sort-option{flex:1;border:0;border-radius:5px;padding:5px 3px;background:none;color:var(--muted);font-size:11px}.sort-option[aria-pressed=true]{background:var(--line);color:var(--text)}.rank-info{font-size:11px;color:var(--text);margin-top:12px}.rank-detail{font-size:11px;line-height:1.5;color:var(--muted);margin-top:4px}.rank-action{font-size:11px;border:1px solid var(--line);background:none;color:var(--text);border-radius:99px;padding:6px 11px;margin-top:9px}.rank-action:disabled{opacity:.5;cursor:default}.budget{display:block;color:var(--muted);font-size:10px;margin-top:6px}.connection-score{margin-left:auto;flex:none;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}.identity{flex:1}.panel{display:flex;flex-direction:column;max-height:calc(100dvh - 100px)}.heading,.footer{flex-shrink:0}.people{min-height:0;flex:0 1 auto}
    .rank-progress{display:flex;align-items:center;justify-content:space-between;margin-top:12px;gap:8px}.rank-info{margin:0;font-variant-numeric:tabular-nums}.rank-action{margin:0;padding:3px 0;border:0;color:var(--muted);font-size:11px}.rank-action:hover{color:var(--text)}.rank-track{height:2px;background:var(--line);margin:10px 0 8px;border-radius:2px;overflow:hidden}.rank-fill{height:100%;background:#1d9bf0;transition:width .3s ease}.row-spinner{width:13px;height:13px;border:1.5px solid var(--line);border-top-color:#1d9bf0;border-radius:50%;animation:spin .8s linear infinite}.row-queued{width:4px;height:4px;border-radius:50%;background:var(--muted);opacity:.4;margin-right:4px}@keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:1100px){:host{right:12px;width:270px;top:66px}.panel{box-shadow:0 8px 36px #0003}}@media(max-width:600px){:host{top:auto;bottom:18px;right:12px;width:min(292px,calc(100vw - 24px))}.people{max-height:45dvh}}
    @media(prefers-reduced-motion:reduce){*{animation:none!important}}
  `;
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function rings() { const n = el('span','rings'); n.setAttribute('aria-hidden','true'); n.append(el('i'),el('i')); return n; }
  function openNative(event, handle) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    records.delete(handle);
    const link = document.querySelector(`[data-testid="primaryColumn"] a[href="/${handle}/followers_you_follow" i]`);
    if (link) { event.preventDefault(); link.click(); }
  }
  function syncAccount() {
    const who = account();
    if (who !== viewer) { active?.controller.abort();rankJob?.controller.abort(); records.clear(); profiles.clear(); ranks.clear();rankVersion++; auth = null; viewer = who; }
  }
  function render() {
    queued = false;
    const who = account(), p = page();
    syncAccount();
    const next = p ? `${p.handle}:${p.list}` : '';
    const routeChanged = route !== next;
    if (routeChanged) { active?.controller.abort();rankJob?.controller.abort(); clearTimeout(timer); timer = null; route = next; signature = ''; visibleRows = 100; query = ''; rankMessage='';sortMode=false; }
    if (!p || !who || p.handle === who || !document.querySelector('[data-testid="primaryColumn"]')) { host?.remove(); host = root = null; signature = ''; return; }
    let record = records.get(p.handle);
    if (routeChanged && record && Date.now() - record.time > TTL && active?.handle !== p.handle) { records.delete(p.handle); record = null; }
    if (!host?.isConnected) { host = el('aside'); host.setAttribute('aria-label','Mutuals sidebar'); root = host.attachShadow({mode:'open'}); document.body.append(host); signature = ''; }
    if (!record && !active && !p.list && auth?.viewer === who && profiles.has(p.handle) && !collapsed) {
      if (!timer) timer = setTimeout(() => { timer = null; if (page()?.handle === p.handle && !records.has(p.handle) && !collapsed) run(p.handle); }, 600);
    }
    const background = getComputedStyle(document.body).backgroundColor;
    const rgb = background.match(/[\d.]+/g)?.map(Number) ?? [0,0,0];
    const dark = rgb[0]+rgb[1]+rgb[2] < 380;
    const running = active?.handle === p.handle;
    const nextSignature = JSON.stringify([route, record?.time, record?.count, record?.reason, running, sortMode, rankVersion, Boolean(rankJob), rankMessage, collapsed, visibleRows, background, searchOpen, query]);
    if (signature === nextSignature) return;
    signature = nextSignature;
    host.style.cssText = dark ? `--paper:${background};--text:#e7e9ea;--muted:#71767b;--line:${rgb[0]>8?'#38444d':'#2f3336'};--hover:rgba(255,255,255,.03)` : '--paper:#fff;--text:#0f1419;--muted:#536471;--line:#eff3f4;--hover:rgba(0,0,0,.025)';
    const focusedControl=root.activeElement?.tagName==='BUTTON'?{label:root.activeElement.getAttribute('aria-label'),text:root.activeElement.textContent}:null;
    const focusedPerson=root.activeElement?.closest('.person')?.getAttribute('href');
    const oldInput = root.querySelector('.search-input');
    const restoreFocus = root.activeElement === oldInput && Boolean(oldInput);
    const selection = oldInput ? [oldInput.selectionStart,oldInput.selectionEnd] : null;
    const previousScroll = root.querySelector('.people')?.scrollTop ?? 0;
    const style = el('style'); style.textContent = css; root.replaceChildren(style);
    const count = record ? `${record.count.toLocaleString()}${record.complete?'':'+'}` : '—';
    if (collapsed) { const button = el('button','collapsed'); button.type='button'; button.append(rings(),el('span','',record ? `${count} mutuals` : 'Mutuals')); button.setAttribute('aria-label','Open mutuals sidebar'); button.onclick=()=>{collapsed=false;signature='';schedule();}; root.append(button); return; }
    const panel = el('section','panel'), heading = el('div','heading'), top = el('div','top');
    const title = el('h2','title','Mutuals'), countLabel = el('span','count',count); countLabel.setAttribute('role','status'); countLabel.setAttribute('aria-live','polite');
    const close = el('button','icon','−'); close.type='button'; close.setAttribute('aria-label','Collapse mutuals sidebar'); close.onclick=()=>{collapsed=true;active?.controller.abort();rankJob?.controller.abort();clearTimeout(timer);timer=null;signature='';schedule();};
    const searchButton = el('button','icon search-button'); searchButton.type='button';
    searchButton.setAttribute('aria-label','Find mutuals'); searchButton.setAttribute('aria-keyshortcuts','Meta+f Control+f');
    searchButton.title='Find mutuals (⌘F / Ctrl+F)';
    searchButton.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
    searchButton.onclick=()=>{searchOpen=true;focusSearch=true;signature='';schedule();};
    top.append(title,countLabel,searchButton,close); heading.append(top);
    const subtitle = el('div','subtitle'); subtitle.append(el('span','','Mutuals with ')); const target = el('a','',`@${p.handle}`); target.href=`/${p.handle}`; subtitle.append(target); heading.append(subtitle);
    const people = el('div','people'); people.setAttribute('aria-label','Mutual connections');people.addEventListener('mouseleave',()=>{if(rankJob?.sinceSort)updateRankOrder();});people.addEventListener('focusout',()=>queueMicrotask(()=>{if(rankJob?.sinceSort)updateRankOrder();}));
    if(searchOpen){
      const searchBox=el('div','search-box'), input=el('input','search-input'); input.type='search';input.placeholder='Find a name or @handle';input.setAttribute('aria-label','Search mutuals');input.value=query;input.maxLength=100;
      input.oninput=()=>{query=input.value;visibleRows=100;schedule();};
      searchBox.append(input);heading.append(searchBox);
    }
    let users = findUsers(record?.users ?? [], query);
    if(sortMode)users=[...users].sort(rankJob ? (a,b)=>(rankJob.order.get(a.id)??Infinity)-(rankJob.order.get(b.id)??Infinity) : compareRanks);
    if(record?.users?.length){
      const controls=el('div','ranking-controls'), tabs=el('div','sort-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Order mutuals');
      for(const [label,value] of [['Default',false],['Most connected',true]]){
        const button=el('button','sort-option',label);button.type='button';button.setAttribute('aria-pressed',String(sortMode===value));button.disabled=Boolean(active);
        button.onclick=()=>{sortMode=value;visibleRows=100;if(!value)rankJob?.controller.abort();signature='';schedule();if(value)rankBatch();};tabs.append(button);
      }
      controls.append(tabs);
      if(sortMode){
        const checked=record.users.filter(user=>ranking(user)).length;
        const progress=el('div','rank-progress');
        const info=el('div','rank-info',rankJob?`Calculating · ${checked} / ${record.users.length}`:checked===record.users.length?'Ranking ready':`${checked} of ${record.users.length} calculated`);info.setAttribute('role','status');
        const button=el('button','rank-action',rankJob?'Pause':checked<record.users.length?'Resume':'↻');button.type='button';button.setAttribute('aria-label',rankJob?'Pause ranking':checked<record.users.length?'Resume ranking':'Recalculate ranking');button.disabled=Boolean(active);
        button.onclick=()=>{if(rankJob)rankJob.controller.abort();else {if(checked===record.users.length){for(const user of record.users)ranks.delete(user.id);}rankBatch();}};
        progress.append(info,button);controls.append(progress);
        const track=el('div','rank-track'),fill=el('div','rank-fill');fill.style.width=`${checked/record.users.length*100}%`;track.append(fill);controls.append(track);
        const partial=record.users.some(user=>ranking(user)&&!ranking(user).complete);
        if(rankMessage || partial)controls.append(el('div','rank-detail',rankMessage || 'Partial counts shown with +'));

      }
      heading.append(controls);
    }
    if(query.trim()) {
      const summary=el('div','search-summary',`${users.length} matching ${users.length===1?'person':'people'}${record?.complete?'':' so far'}`);summary.setAttribute('role','status');people.append(summary);
      if(!users.length)people.append(el('div','empty','No matching mutuals. Try a shorter name or handle.'));
    }
    for (const user of users.slice(0,visibleRows)) {
      const row = el(user.handle?'a':'div','person'); if(user.handle) row.href=`/${user.handle}`;
      const avatar = el(user.avatar?'img':'span','avatar',user.avatar?undefined:user.name.slice(0,1));
      if(user.avatar){avatar.src=user.avatar;avatar.alt='';avatar.loading='lazy';avatar.referrerPolicy='no-referrer';}
      const identity = el('div','identity'), name = el('div','name',user.name);
      if(user.verified){ const badge=el('span','tick','✓');badge.setAttribute('aria-label','Verified');name.append(badge); }
      identity.append(name,el('div','handle',user.handle?`@${user.handle}`:'Unavailable account')); row.append(avatar,identity);
      if(sortMode){const result=ranking(user),score=el('span','connection-score',result?`${result.count.toLocaleString()}${result.complete?'':'+'}`:'—');score.title=result?`${result.count}${result.complete?'':' or more'} people you follow also follow this person${result.reason?'. '+result.reason:''}`:'Not checked';score.setAttribute('aria-label',result?`${result.count}${result.complete?'':' or more'} mutual connections`:'Not checked');if(!result){score.textContent='';score.classList.add(rankJob?.currentId===user.id?'row-spinner':'row-queued');score.setAttribute('aria-label',rankJob?.currentId===user.id?'Calculating mutual connections':'Waiting to calculate');}row.append(score);}
      people.append(row);
    }
    if (users.length > visibleRows) { const more=el('button','more','Show more');more.type='button';more.onclick=()=>{visibleRows+=100;signature='';schedule();};people.append(more); }
    if (!users.length && !record?.reason && !record?.complete) {
      for(let i=0;i<3;i++){ const row=el('div','skeleton');row.setAttribute('aria-hidden','true');const bones=el('div','bones');bones.append(el('div','bone'),el('div','bone'));row.append(el('div','avatar'),bones);people.append(row); }
    }
    if (!query.trim() && record?.complete && !users.length) { const empty=el('div','empty');empty.append(el('strong','','No mutuals yet.'),el('span','','Nobody you follow appears in this account’s available followers.'));people.append(empty); }
    if (record?.reason || (!record && !running && !profiles.has(p.handle))) {
      const empty=el('div','empty',record?.reason || 'Connecting to this profile…');
      const reconnect=el('a','reconnect',p.list?'Reload X’s list':'Open X’s mutuals list');reconnect.href=`/${p.handle}/followers_you_follow`;
      reconnect.onclick=e=>{if(p.list){e.preventDefault();location.reload();}else openNative(e,p.handle);};empty.append(el('br'),reconnect);people.append(empty);
    }
    const footer=el('div','footer'); const state=el('span',`status ${running?'working':''}`);state.append(el('span','dot'),el('span','',running?'Checking…':record?.complete?'Up to date':record?'Partial count':'Connecting…'));
    if(record?.elapsedMs!==undefined) state.title=`${record.extraRequests} extra requests · ${(record.elapsedMs/1000).toFixed(1)}s · checked ${new Date(record.time).toLocaleTimeString()}`;
    const action=el('button','text-button',running?'Stop':'Refresh');action.type='button';
    action.disabled=!running && (Boolean(rankJob) || Date.now()<blockedUntil || Boolean(record && Date.now()-record.time<10000));
    action.onclick=()=>{if(running)active.controller.abort();else if(auth&&profiles.has(p.handle))run(p.handle);else location.reload();};
    footer.append(state,action);panel.append(heading,people,footer);root.append(panel);people.scrollTop=previousScroll;
    if(focusedControl){[...root.querySelectorAll('button')].find(n=>focusedControl.label?n.getAttribute('aria-label')===focusedControl.label:n.textContent===focusedControl.text)?.focus({preventScroll:true});}
    if(focusedPerson){[...root.querySelectorAll('.person')].find(n=>n.getAttribute('href')===focusedPerson)?.focus({preventScroll:true});}
    if(searchOpen && (focusSearch || restoreFocus)){const input=root.querySelector('.search-input');input.focus({preventScroll:true});if(restoreFocus && selection?.[0]!=null)input.setSelectionRange(...selection);focusSearch=false;}
    if(action.disabled) setTimeout(()=>{if(action.isConnected)action.disabled=Boolean(rankJob)||Date.now()<blockedUntil;},Math.max(10000,blockedUntil-Date.now()));
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(render);}}
  new MutationObserver(schedule).observe(document,{subtree:true,childList:true});
  for(const method of ['pushState','replaceState']){const original=history[method];history[method]=function(...args){const r=original.apply(this,args);schedule();return r;};}
  window.addEventListener('popstate',schedule);
  document.addEventListener('keydown',event=>{
    if(!host?.isConnected || !page())return;
    if((event.metaKey||event.ctrlKey) && event.key.toLowerCase()==='f' && !event.altKey && !event.shiftKey){
      event.preventDefault();collapsed=false;searchOpen=true;focusSearch=true;signature='';schedule();
    }else if(event.key==='Escape' && searchOpen && root.contains(event.composedPath()[0])){
      event.preventDefault();searchOpen=false;query='';signature='';schedule();requestAnimationFrame(()=>root.querySelector('.search-button')?.focus());
    }
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){active?.controller.abort();rankJob?.controller.abort();}else schedule();});
  document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['style','class']});},{once:true});
  schedule();
})();
