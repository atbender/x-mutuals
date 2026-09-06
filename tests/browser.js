let peakRequests=0,rankingMs=0;
let requests = 0, scenario = 'normal';
const main = document.querySelector('main');
const profile = '<header>Demo Profile</header><div class="cover"></div><section class="profile"><div class="avatar"></div><h1>Demo Profile</h1><p>@demo_profile</p><p>A fictional profile for testing.</p><div><div class="counts"><a href="/demo_profile/following">1,200 Following</a><a href="/demo_profile/followers">2,400 Followers</a></div></div><a href="/demo_profile/followers_you_follow">Followers you know</a></section>';
const list = '<header><a href="/demo_profile">← Demo Profile</a></header><nav><div class="tabs" role="tablist"><span>Verified</span><span>Followers you know</span><span>Followers</span></div></nav><div class="rows"><div class="row">Sample One · @sample_one</div><div class="row">Sample Two · @sample_two</div></div>';
function render() {
  const isList = location.pathname.endsWith('/followers_you_follow');
  main.innerHTML = (isList ? list : profile) + '<div class="tools"><button id="theme">Toggle theme</button><label>Scenario <select id="scenario"><option value="normal">Complete</option><option value="long">Long list</option><option value="rate">Rate limited</option><option value="zero">Zero mutuals</option><option value="repeat">Repeated cursor</option><option value="slow">Stop check</option></select></label></div><div class="metrics" role="status" id="metrics"></div>';
  document.querySelector('#scenario').value = scenario;
  document.querySelector('#theme').onclick = () => document.body.classList.toggle('dark');
  document.querySelector('#scenario').onchange = event => { scenario = event.target.value; location.href = '/demo_profile?scenario=' + scenario; };
  metrics();
  if (isList) setTimeout(loadList, 50);
  else setTimeout(() => fetch('/i/api/graphql/test/UserByScreenName?variables=' + encodeURIComponent(JSON.stringify({screen_name:'demo_profile'}))), 80);
}
function metrics() { document.querySelector('#metrics').textContent = `Observed requests: ${requests} · scenario: ${scenario} · peak concurrent: ${peakRequests} · ranking: ${rankingMs} ms`; }
async function loadList() {
  const variables = { userId: '123', count: 20 };
  await fetch('/i/api/graphql/test/FollowersYouKnow?variables=' + encodeURIComponent(JSON.stringify(variables)) + '&scenario=' + scenario);
}
// Count all requests at the server; update the visible diagnostic once a response
// is delivered, including continuation requests made by the extension.
setInterval(async () => { const response = await fetch('/metrics'); const data=await response.json();requests=data.requests;peakRequests=data.peakRequests;rankingMs=data.rankingMs;metrics(); }, 800);
document.addEventListener('click', event => {
  const a = event.target.closest('a');
  if (a?.getAttribute('href')?.startsWith('/demo_profile')) {
    event.preventDefault(); history.pushState({}, '', a.getAttribute('href')); render();
  }
});
scenario = new URL(location.href).searchParams.get('scenario') ?? 'normal'; render();
