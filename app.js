window.stopAuto=()=>{};
/* 日语学习系统 — mobile PWA. Clip audio = Immersion Kit originals only (no TTS for clips). */
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const main=$('#main'), title=$('#title'), subtitle=$('#subtitle');
const DB='jp_learn_sys_v1';
const state={tab:'ex', ex:null, gold:null, drill:null, twelve:null, shadowSegs:null, shadowTips:null, user:null, view:{}};

async function loadJSON(p){const r=await fetch(p); return r.json()}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function addDays(ymd,n){const [y,m,d]=ymd.split('-').map(Number);const dt=new Date(y,m-1,d);dt.setDate(dt.getDate()+n);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`}
function uid(){return Math.random().toString(36).slice(2,10)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* IndexedDB wrapper */
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function kvGet(k){const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('kv').objectStore('kv').get(k);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)})}
async function kvSet(k,v){const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite').objectStore('kv').put(v,k);t.onsuccess=()=>res();t.onerror=()=>rej(t.error)})}

async function loadUser(){
  let u=await kvGet('user');
  if(!u){
    u={mine:[],stars:{},gold:null,drill:null,review:{},settings:{}};
    await kvSet('user',u);
  }
  state.user=u; return u;
}
async function saveUser(){await kvSet('user',state.user)}

function setTab(tab){window.stopAuto();
  state.tab=tab;
  $$('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  render();
  window.scrollTo(0,0);
}

$('#nav').onclick=e=>{const b=e.target.closest('button[data-tab]');if(b)setTab(b.dataset.tab)};

async function boot(){
  if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./sw.js')}catch(e){}}
  await loadUser();
  const [ex,twelve,goldSeed,drillSeed,segs,tips]=await Promise.all([
    loadJSON('data_ex.json'),loadJSON('twelve.json'),loadJSON('gold_seed.json'),
    loadJSON('drill_seed.json'),loadJSON('shadowing_segs.json'),loadJSON('shadowing_tips.json')
  ]);
  state.ex=ex; state.twelve=twelve; state.shadowSegs=segs; state.shadowTips=tips;
  if(!state.user.gold){
    const t=today();
    state.user.gold={interval:14,items:goldSeed.map(r=>({id:uid(),...r,round:1,added:addDays(t,-14),due:t,level:'new',history:[],demo:true}))};
  }
  if(!state.user.drill){
    state.user.drill={secs:5,cards:drillSeed.map(c=>({...c,id:uid(),tries:0,fast:0,demo:true}))};
  }
  await saveUser();
  render();
}

/* ========== 例句本 ========== */
function deckFilter(){
  const v=state.view.ex||{deck:'all',q:'',star:false,word:''};
  return v;
}
function renderEx(){
  title.textContent='例句本';
  const v=deckFilter();
  const decks=[
    {id:'all',label:'全部用法'},
    {id:'kakeru',label:'かける'},
    {id:'poly',label:'多义词1–100'},
    {id:'fixed',label:'固定搭配'},
    {id:'part',label:'助词'},
    {id:'mine',label:'我加的'},
  ];
  let items=[];
  if(v.deck==='kakeru'){
    items=state.ex.kakeru.map((c,i)=>({key:'k'+i,word:'かける',group:c.g,usage:c.u,usage_zh:c.z,ja:c.ja,zh:c.zh,work:c.work,clips:c.img?[{ja:c.ja,zh:c.zh,work:c.work,img:c.img,aud:c.aud}]:[],star:!!state.user.stars['k'+i]}));
  } else if(v.deck==='mine'){
    items=state.user.mine.map(m=>({...m,key:m.id,clips:m.img?[{ja:m.ja,zh:m.zh,work:m.work||'我加的',img:m.img,aud:m.aud}]:[]}));
  } else {
    items=state.ex.usages.filter(u=>{
      if(v.deck==='fixed') return u.w==='固定搭配';
      if(v.deck==='part') return u.w==='助词';
      if(v.deck==='poly') return u.w!=='固定搭配'&&u.w!=='助词';
      return true;
    }).map(u=>({key:'u'+u.i,word:u.w,group:u.g,usage:u.u,usage_zh:u.z,ja:u.e,zh:'',reading:u.r,clips:u.clips,star:!!u.s||!!state.user.stars['u'+u.i]}));
  }
  if(v.star) items=items.filter(x=>x.star);
  if(v.word) items=items.filter(x=>x.word===v.word);
  if(v.q){const q=v.q.toLowerCase();items=items.filter(x=>[x.word,x.usage,x.usage_zh,x.ja,x.zh,x.group].join(' ').toLowerCase().includes(q))}
  const words=[...new Set(items.map(x=>x.word))].sort();
  const withClips=items.filter(x=>x.clips&&x.clips.length).length;
  main.innerHTML=`
  <div class="chips">${decks.map(d=>`<button class="chip ${v.deck===d.id?'on':''}" data-deck="${d.id}">${d.label}</button>`).join('')}</div>
  <div class="card">
    <input id="exq" placeholder="搜索词、用法、例句、中文" value="${esc(v.q||'')}">
    <div class="row" style="margin-top:8px">
      <select id="exw" style="flex:1"><option value="">全部词</option>${words.map(w=>`<option ${v.word===w?'selected':''}>${esc(w)}</option>`).join('')}</select>
      <label class="row" style="margin:0"><input type="checkbox" id="exstar" ${v.star?'checked':''}> ★</label>
      <button class="btn" id="exAdd">＋ 添加</button>
    </div>
    <div class="muted" style="margin-top:8px">共 ${items.length} 条 · ${withClips} 条有影视原声片段</div>
  </div>
  <div class="list card" style="padding:0" id="exlist">
    ${items.slice(0,80).map((x,i)=>`
      <button class="item" data-i="${i}">
        <div class="row"><span class="badge">${esc(x.word)}</span><span class="muted">${esc(x.group||'')}</span>${x.star?'<span>★</span>':''}${x.clips&&x.clips.length?`<span class="badge">🎬${x.clips.length}</span>`:''}</div>
        <div class="jp">${esc(x.usage||x.ja||'')}</div>
        <div class="zh">${esc(x.usage_zh||x.zh||'')}</div>
      </button>`).join('')||'<div class="empty">没有符合条件的内容</div>'}
    ${items.length>80?`<div class="muted" style="padding:12px">仅显示前 80 条，请用搜索缩小范围</div>`:''}
  </div>`;
  state.view._exItems=items.slice(0,80);
  $$('[data-deck]').forEach(b=>b.onclick=()=>{state.view.ex={...deckFilter(),deck:b.dataset.deck,word:''};renderEx()});
  $('#exq').onchange=$('#exq').onkeydown=(e)=>{if(e.type==='change'||e.key==='Enter'){state.view.ex={...deckFilter(),q:$('#exq').value.trim()};renderEx()}};
  $('#exw').onchange=()=>{state.view.ex={...deckFilter(),word:$('#exw').value};renderEx()};
  $('#exstar').onchange=()=>{state.view.ex={...deckFilter(),star:$('#exstar').checked};renderEx()};
  $('#exAdd').onclick=()=>renderExAdd();
  $('#exlist').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;renderExDetail(state.view._exItems[+b.dataset.i])};
  subtitle.textContent=`影视原声 · Immersion Kit · ${state.ex.meta.with_clips}/${state.ex.meta.usages_total} 用法有片段`;
}

function renderExDetail(x){
  const clips=x.clips||[];
  main.innerHTML=`
  <button class="btn" id="back">← 返回</button>
  <div class="card">
    <div class="row"><span class="badge">${esc(x.word)}</span><button class="btn" id="star">${x.star?'★ 已标':'+ ★'}</button>
    <button class="btn" id="toGold">加入记忆本</button></div>
    <div class="big" style="margin-top:8px">${esc(x.usage||'')}</div>
    <div class="zh">${esc(x.usage_zh||'')}</div>
    ${x.ja?`<div class="jp" style="margin-top:10px">${esc(x.ja)}</div>`:''}
  </div>
  ${clips.length?clips.map((c,i)=>`
    <div class="card player" data-ci="${i}">
      ${c.img?`<img class="thumb" loading="lazy" src="${esc(c.img)}" alt="">`:''}
      <div class="jp">▶ ${esc(c.ja)}</div>
      <div class="zh">${esc(c.zh)}</div>
      <div class="muted">🎬 ${esc(c.work)} · 原声音频</div>
      ${c.aud?`<audio controls preload="none" src="${esc(c.aud)}"></audio>`:'<div class="muted">无音频</div>'}
    </div>`).join(''):`<div class="card muted">暂无影视片段（Immersion Kit 动画/日剧中未找到贴合义项的句子）。</div>`}
  `;
  $('#back').onclick=()=>{stopAuto();renderEx()};
  // 原声自动连播：进入详情自动播第一段，播完接下一段；点卡片从该段开始播
  const auds=[...main.querySelectorAll('.player audio')];
  const AP=localStorage.getItem('autoplay')!=='0';
  const tg=document.createElement('button');tg.className='btn';tg.id='apTog';tg.textContent=AP?'🔁 自动连播：开':'🔁 自动连播：关';
  main.querySelector('.card .row').appendChild(tg);
  tg.onclick=()=>{const on=localStorage.getItem('autoplay')==='0';localStorage.setItem('autoplay',on?'1':'0');tg.textContent=on?'🔁 自动连播：开':'🔁 自动连播：关';if(!on)stopAuto();else playAt(0)};
  function playAt(i){const a=auds[i];if(!a)return;auds.forEach(o=>{if(o!==a){o.pause()}});a.currentTime=0;const pr=a.play();if(pr)pr.catch(()=>{});a.closest('.player').scrollIntoView({behavior:'smooth',block:'center'})}
  auds.forEach((a,i)=>{a.onplay=()=>auds.forEach(o=>{if(o!==a)o.pause()});a.onended=()=>{if(localStorage.getItem('autoplay')!=='0'&&document.contains(a))playAt(i+1)}});
  main.querySelectorAll('.player').forEach(c=>c.addEventListener('click',e=>{if(e.target.tagName==='AUDIO')return;const a=c.querySelector('audio');if(a)playAt(auds.indexOf(a))}));
  window.stopAuto=()=>auds.forEach(a=>a.pause());
  if(AP&&auds.length)playAt(0);
  $('#star').onclick=async()=>{
    const k=x.key; state.user.stars[k]=!state.user.stars[k]; x.star=!!state.user.stars[k]; await saveUser(); renderExDetail(x);
  };
  $('#toGold').onclick=async()=>{
    const t=today(); const g=state.user.gold;
    if(g.items.filter(i=>i.added===t&&i.round===1).length>=20){alert('今天记忆本清单已满 20 条');return}
    g.items.push({id:uid(),jp:x.usage||x.ja,kana:x.reading||'',zh:x.usage_zh||x.zh||'',ex:x.ja||'',own:'',scene:x.word||'',round:1,added:t,due:addDays(t,g.interval),level:'new',history:[]});
    await saveUser(); alert('已加入记忆本');
  };
}

function renderExAdd(){
  main.innerHTML=`
  <button class="btn" id="back">← 返回</button>
  <div class="card">
    <div class="big">添加自己的例句</div>
    <div class="muted">可用手机拍照/录音；音频不会用 TTS 冒充影视原声。</div>
    <label>词</label><input id="m_word" placeholder="とる">
    <label>用法</label><input id="m_usage" placeholder="責任を取る">
    <label>中文</label><input id="m_zh" placeholder="承担责任">
    <label>日语例句</label><textarea id="m_ja"></textarea>
    <label>截图（可选）</label><input id="m_img" type="file" accept="image/*" capture="environment">
    <label>音频（可选）</label><input id="m_aud" type="file" accept="audio/*" capture>
    <div class="row" style="margin-top:12px"><button class="btn pri" id="save">保存</button></div>
  </div>`;
  $('#back').onclick=renderEx;
  $('#save').onclick=async()=>{
    const word=$('#m_word').value.trim(), usage=$('#m_usage').value.trim(), zh=$('#m_zh').value.trim(), ja=$('#m_ja').value.trim();
    if(!ja&&!usage){alert('请至少填用法或例句');return}
    const readFile=(f)=>new Promise((res,rej)=>{if(!f)return res('');const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
    const img=await readFile($('#m_img').files[0]);
    const aud=await readFile($('#m_aud').files[0]);
    state.user.mine.unshift({id:'m'+Date.now(),word,usage,usage_zh:zh,ja,zh,work:'我加的',img,aud,star:false});
    await saveUser(); renderEx();
  };
}

/* ========== Goldlist ========== */
function renderGold(){
  title.textContent='Goldlist 记忆本';
  subtitle.textContent='先遮答案回想 · A/B/C 蒸馏 · 可从例句本导入';
  const g=state.user.gold; const t=today();
  const due=g.items.filter(i=>i.due<=t);
  const tab=state.view.goldTab||'check';
  main.innerHTML=`
  <div class="seg">
    <button data-g="check" class="${tab==='check'?'on':''}">今日检查 (${due.length})</button>
    <button data-g="add" class="${tab==='add'?'on':''}">添加</button>
    <button data-g="list" class="${tab==='list'?'on':''}">清单 (${g.items.length})</button>
    <button data-g="from" class="${tab==='from'?'on':''}">从例句导入</button>
  </div>
  <div id="goldbody"></div>`;
  $$('[data-g]').forEach(b=>b.onclick=()=>{state.view.goldTab=b.dataset.g;renderGold()});
  const body=$('#goldbody');
  if(tab==='check'){
    const cur=due[0];
    if(!cur){body.innerHTML=`<div class="card"><div class="big">今天没有到期条目</div><div class="muted">等间隔到了再来，或在清单里提前检查。</div></div>`;return}
    let revealed=false;
    const paint=()=>{
      body.innerHTML=`<div class="card">
        <div class="muted">第 ${cur.round} 轮 · 还剩 ${due.length} 条${cur.demo?' · 示例':''}</div>
        <div class="muted">中文意思</div>
        <div class="big">${esc(cur.zh)}</div>
        ${cur.scene?`<div class="muted">场景：${esc(cur.scene)}</div>`:''}
        <label>先遮住答案，写出日语</label>
        <input id="attempt" placeholder="例如：責任を取る" value="">
        <div class="row" style="margin-top:10px" id="act"></div>
        <div id="ans" class="hidden" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"></div>
      </div>`;
      const act=$('#act');
      if(!revealed){
        act.innerHTML=`<button class="btn pri" id="reveal">显示答案</button>`;
        $('#reveal').onclick=()=>{revealed=true;paint();};
      } else {
        $('#ans').classList.remove('hidden');
        $('#ans').innerHTML=`
          <div class="muted">答案</div><div class="big">${esc(cur.jp)}</div>
          ${cur.kana?`<div class="muted">${esc(cur.kana)}</div>`:''}
          ${cur.ex?`<div style="margin-top:8px">原始例句：${esc(cur.ex)}</div>`:''}
          <label>新场景造句（可选）</label><input id="variant">
          <div class="muted" style="margin-top:8px">给自己评级</div>
          <div class="grid2" style="margin-top:8px">
            <button class="btn pri" data-gr="A">A 已掌握</button>
            <button class="btn warn" data-gr="B">B 不稳</button>
            <button class="btn danger" data-gr="C">C 想不起</button>
          </div>`;
        $$('[data-gr]').forEach(b=>b.onclick=async()=>{
          const gr=b.dataset.gr; const variant=($('#variant')?.value||'').trim();
          const next={...cur,history:[...cur.history,{date:t,grade:gr}]};
          if(gr==='A'){next.level='A';next.due=addDays(t,60)}
          else{next.level=gr;next.round=cur.round+1;next.due=addDays(t,g.interval)}
          if(variant&&gr!=='C') next.own=next.own?next.own+' / '+variant:variant;
          g.items=g.items.map(i=>i.id===cur.id?next:i);
          await saveUser(); renderGold();
        });
      }
    };
    paint();
  } else if(tab==='add'){
    body.innerHTML=`<div class="card">
      <label>日语表达 *</label><input id="fjp">
      <label>读音</label><input id="fkana">
      <label>中文意思 *</label><input id="fzh">
      <label>原始例句</label><input id="fex">
      <label>自己的例句</label><input id="fown">
      <label>场景</label><input id="fscene">
      <div class="row" style="margin-top:10px"><button class="btn pri" id="add">加入清单</button>
      <select id="iv"><option value="14">间隔14天</option><option value="7">7天</option><option value="10">10天</option><option value="21">21天</option></select></div>
      <div class="muted" id="msg"></div>
    </div>`;
    $('#iv').value=String(g.interval);
    $('#add').onclick=async()=>{
      const jp=$('#fjp').value.trim(),zh=$('#fzh').value.trim();
      if(!jp||!zh){$('#msg').textContent='至少填写日语和中文';return}
      const batch=g.items.filter(i=>i.round===1&&i.added===t).length;
      if(batch>=20){$('#msg').textContent='今日清单已满20条';return}
      g.interval=+$('#iv').value;
      g.items.push({id:uid(),jp,kana:$('#fkana').value.trim(),zh,ex:$('#fex').value.trim(),own:$('#fown').value.trim(),scene:$('#fscene').value.trim(),round:1,added:t,due:addDays(t,g.interval),level:'new',history:[]});
      await saveUser(); $('#msg').textContent=`已加入，今日 ${batch+1}/20`; 
    };
  } else if(tab==='list'){
    body.innerHTML=`<div class="card" style="padding:0"><div class="list">${g.items.map(i=>`
      <div class="item">
        <div class="jp">${esc(i.jp)} ${i.demo?'·示例':''}</div>
        <div class="zh">${esc(i.zh)}</div>
        <div class="muted">第${i.round}轮 · ${i.level} · 下次 ${i.due<=t?'今天':i.due}</div>
        <div class="row"><button class="btn" data-early="${i.id}">提前查</button><button class="btn danger" data-del="${i.id}">删除</button></div>
      </div>`).join('')}</div>
      <div class="row" style="padding:12px"><button class="btn" id="clearDemo">删除示例词</button>
      <button class="btn" id="expG">导出JSON</button></div></div>`;
    body.onclick=async e=>{
      const early=e.target.closest('[data-early]'); const del=e.target.closest('[data-del]');
      if(early){g.items=g.items.map(i=>i.id===early.dataset.early?{...i,due:t}:i);await saveUser();state.view.goldTab='check';renderGold()}
      if(del){g.items=g.items.filter(i=>i.id!==del.dataset.del);await saveUser();renderGold()}
    };
    $('#clearDemo').onclick=async()=>{g.items=g.items.filter(i=>!i.demo);await saveUser();renderGold()};
    $('#expG').onclick=()=>{const blob=new Blob([JSON.stringify(g)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='goldlist.json';a.click()};
  } else {
    // from example decks
    const pool=state.ex.usages.filter(u=>u.clips&&u.clips.length).slice(0,200);
    body.innerHTML=`<div class="card muted">从有影视片段的用法里挑进记忆本（今日仍受 20 条上限）。</div>
    <div class="list card" style="padding:0">${pool.slice(0,40).map(u=>`
      <button class="item" data-add="${u.i}"><div class="jp">${esc(u.u)}</div><div class="zh">${esc(u.z)}</div></button>`).join('')}</div>`;
    body.onclick=async e=>{
      const b=e.target.closest('[data-add]'); if(!b)return;
      const u=state.ex.usages.find(x=>String(x.i)===b.dataset.add);
      const batch=g.items.filter(i=>i.round===1&&i.added===t).length;
      if(batch>=20){alert('今日已满20条');return}
      g.items.push({id:uid(),jp:u.u,kana:u.r||'',zh:u.z,ex:u.e||(u.clips[0]&&u.clips[0].ja)||'',own:'',scene:u.w,round:1,added:t,due:addDays(t,g.interval),level:'new',history:[]});
      await saveUser(); alert('已加入'); 
    };
  }
}

/* ========== Drill ========== */
function renderDrill(){
  title.textContent='预期抢答';
  subtitle.textContent='先硬说再对答案 · 影视语感之外的口语反应训练';
  const d=state.user.drill;
  const tab=state.view.drillTab||'idle';
  if(tab==='idle'||tab==='done'){
    main.innerHTML=`<div class="card">
      <div class="big">${tab==='done'?'本轮结束':'抢答训练'}</div>
      <div class="muted">共 ${d.cards.length} 个情境 · 每题 ${d.secs} 秒</div>
      <label>每题时间</label>
      <select id="secs"><option value="3">3秒</option><option value="5">5秒</option><option value="8">8秒</option></select>
      <div class="row" style="margin-top:12px"><button class="btn pri" id="start">开始训练</button>
      <button class="btn" id="list">情境库</button></div>
      <div class="muted" style="margin-top:8px">对方台词可用系统朗读辅助；地道回复对照不替代例句本的影视原声。</div>
    </div>`;
    $('#secs').value=String(d.secs);
    $('#start').onclick=()=>{d.secs=+$('#secs').value; state.view.drill={queue:shuffle(d.cards.map(c=>c.id)),phase:'answer',attempt:'',log:[]}; state.view.drillTab='run'; renderDrill()};
    $('#list').onclick=()=>{state.view.drillTab='list';renderDrill()};
    return;
  }
  if(tab==='list'){
    main.innerHTML=`<button class="btn" id="back">← 返回</button><div class="list card" style="padding:0">${d.cards.map(c=>`
      <div class="item"><div class="jp">${esc(c.line)}</div><div class="zh">${esc(c.scene)}</div>
      <div class="muted">${esc(c.chunk)} · ${c.fast}/${c.tries}</div></div>`).join('')}</div>`;
    $('#back').onclick=()=>{state.view.drillTab='idle';renderDrill()};
    return;
  }
  // run
  const st=state.view.drill; const cur=d.cards.find(c=>c.id===st.queue[0]);
  if(!cur){state.view.drillTab='done';renderDrill();return}
  if(st.phase==='answer'){
    main.innerHTML=`<div class="card">
      <div class="muted">剩余 ${st.queue.length} 题</div>
      <div class="muted">场景：${esc(cur.scene)}</div>
      <div class="big" style="margin-top:8px">${esc(cur.line)}</div>
      <div class="timer" id="tm">${d.secs}</div>
      <div class="muted">不准打草稿，开口说！</div>
      <input id="att" placeholder="顺手记下你说的（可选）">
      <div class="row" style="margin-top:10px"><button class="btn" id="speak">朗读对方的话</button>
      <button class="btn pri" id="done">我说完了</button></div>
    </div>`;
    $('#speak').onclick=()=>speakJA(cur.line);
    speakJA(cur.line);
    let left=d.secs; const iv=setInterval(()=>{left--; const el=$('#tm'); if(!el){clearInterval(iv);return} el.textContent=left; if(left<=0){clearInterval(iv);st.phase='reveal';st.attempt=$('#att')?.value||'';renderDrill()}},1000);
    state.view._iv=iv;
    $('#done').onclick=()=>{clearInterval(iv);st.phase='reveal';st.attempt=$('#att').value;renderDrill()};
  } else {
    main.innerHTML=`<div class="card">
      <div class="muted">场景：${esc(cur.scene)}</div>
      <div class="jp">${esc(cur.line)}</div>
      ${st.attempt?`<div>你的版本：${esc(st.attempt)}</div>`:''}
      <div class="muted" style="margin-top:10px">母语者会这样说</div>
      ${cur.replies.map((r,i)=>`<div class="jp">${i+1}. ${esc(r)}</div>`).join('')}
      <div style="margin-top:8px">关键语块：<b>${esc(cur.chunk)}</b>（${esc(cur.chunkZh)}）</div>
      <div class="muted">中式说法：${esc(cur.wrong)}</div>
      <div class="muted">差异：${esc(cur.diff)}</div>
      <div class="grid2" style="margin-top:12px">
        <button class="btn pri" data-r="fast">秒接</button>
        <button class="btn warn" data-r="stuck">卡壳</button>
        <button class="btn danger" data-r="miss">没接住</button>
      </div>
    </div>`;
    $$('[data-r]').forEach(b=>b.onclick=async()=>{
      const r=b.dataset.r;
      d.cards=d.cards.map(c=>c.id===cur.id?{...c,tries:c.tries+1,fast:c.fast+(r==='fast'?1:0),last:r}:c);
      st.log.push({id:cur.id,result:r});
      let rest=st.queue.slice(1);
      if(r!=='fast'){const pos=Math.min(2,rest.length);rest=[...rest.slice(0,pos),cur.id,...rest.slice(pos)]}
      st.queue=rest; st.phase='answer'; st.attempt='';
      await saveUser(); renderDrill();
    });
  }
}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function speakJA(t){try{const u=new SpeechSynthesisUtterance(t);u.lang='ja-JP';u.rate=1.05;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}}

/* ========== Review ========== */
function renderReview(){
  title.textContent='复习';
  subtitle.textContent='跨模块的简易间隔队列';
  const t=today();
  // queue: gold due + starred example usages due-ish
  const dueGold=state.user.gold.items.filter(i=>i.due<=t);
  const stars=Object.keys(state.user.stars).filter(k=>state.user.stars[k]);
  main.innerHTML=`
  <div class="card">
    <div class="big">今日待复习</div>
    <div>记忆本到期：<b>${dueGold.length}</b></div>
    <div>例句★标记：<b>${stars.length}</b></div>
    <div class="row" style="margin-top:12px">
      <button class="btn pri" id="goGold">去检查记忆本</button>
      <button class="btn" id="goStar">看★例句</button>
    </div>
  </div>
  <div class="card">
    <div class="muted">说明：影视原声片段只在「例句」模块播放 Immersion Kit 音频；记忆本/抢答的朗读是练习辅助，不是例句原声。</div>
  </div>`;
  $('#goGold').onclick=()=>{state.view.goldTab='check';setTab('gold')};
  $('#goStar').onclick=()=>{state.view.ex={deck:'all',q:'',star:true,word:''};setTab('ex')};
}

/* ========== More: 12金句 / 跟读 / 备份 ========== */
function renderMore(){
  title.textContent='更多';
  subtitle.textContent='12金句 · 跟读 · 备份 · 关于';
  const sub=state.view.more||'home';
  if(sub==='home'){
    main.innerHTML=`
    <div class="card"><button class="item" id="twelve"><div class="big">12 金句解构</div><div class="muted">英×日×中对照</div></button></div>
    <div class="card"><button class="item" id="shadow"><div class="big">跟读（海绵盲听）</div><div class="muted">常速 / 70% 慢速 · 已压缩音频</div></button></div>
    <div class="card"><button class="item" id="bak"><div class="big">备份 / 导入</div><div class="muted">导出 JSON（含记忆本、抢答、我加的）</div></button></div>
    <div class="card muted">本系统可安装到主屏幕离线使用。例句音频均为 Immersion Kit 动画/日剧原声，勿公开传播。</div>`;
    $('#twelve').onclick=()=>{state.view.more='twelve';renderMore()};
    $('#shadow').onclick=()=>{state.view.more='shadow';renderMore()};
    $('#bak').onclick=()=>{state.view.more='bak';renderMore()};
    return;
  }
  if(sub==='twelve'){
    main.innerHTML=`<button class="btn" id="back">← 返回</button>`+state.twelve.map(it=>`
      <div class="card">
        <div class="muted">#${it.n}</div>
        <div class="big">${esc(it.en)}</div>
        <div class="jp">${esc(it.jp)}</div>
        <div class="zh">${esc(it.work_zh||'')}</div>
        <div class="muted" style="margin-top:8px">英语陷阱：${esc(it.en_trap)}</div>
        <div class="muted">日语讲解：${esc(it.jp_note)}</div>
        <div style="margin-top:8px">职场：${esc(it.work)}</div>
        <button class="btn" data-speak="${esc(it.jp)}">朗读日语</button>
      </div>`).join('');
    $('#back').onclick=()=>{state.view.more='home';renderMore()};
    main.onclick=e=>{const b=e.target.closest('[data-speak]');if(b)speakJA(b.dataset.speak)};
    return;
  }
  if(sub==='shadow'){
    const tips=(state.shadowTips||[]).slice(0,12);
    main.innerHTML=`<button class="btn" id="back">← 返回</button>
    <div class="card">
      <div class="big">跟读音频</div>
      <div class="muted">来源：N2 听力口语 / 海绵盲听笔记配套音频；已压成单声道 32kbps MP3（iOS Safari 可播）。</div>
      <label>常速</label><audio controls preload="none" src="media/shadowing/normal.mp3"></audio>
      <label>慢速 70%</label><audio controls preload="none" src="media/shadowing/slow70.mp3"></audio>
    </div>
    <div class="card"><div class="big">笔记要点</div>${tips.map(t=>`<div class="muted">• ${esc(t)}</div>`).join('')}</div>
    <div class="card"><div class="big">转写（节选）</div>
      ${(state.shadowSegs||[]).slice(0,40).map(s=>`<div><span class="muted">${esc(s.t)}</span> ${esc(s.text)}</div>`).join('')}
    </div>`;
    $('#back').onclick=()=>{state.view.more='home';renderMore()};
    return;
  }
  if(sub==='bak'){
    main.innerHTML=`<button class="btn" id="back">← 返回</button>
    <div class="card">
      <button class="btn pri" id="exp">导出全部用户数据</button>
      <label>导入 JSON</label><textarea id="imp"></textarea>
      <button class="btn" id="doImp">导入</button>
      <div class="muted" id="msg"></div>
    </div>`;
    $('#back').onclick=()=>{state.view.more='home';renderMore()};
    $('#exp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state.user)],{type:'application/json'}));a.download='日语学习系统_备份.json';a.click()};
    $('#doImp').onclick=async()=>{try{const u=JSON.parse($('#imp').value);state.user=u;await saveUser();$('#msg').textContent='导入成功'}catch(e){$('#msg').textContent='导入失败'}};
  }
}

function render(){
  if(!state.ex){main.innerHTML='<div class="empty">加载中…</div>';return}
  ({ex:renderEx,gold:renderGold,drill:renderDrill,review:renderReview,more:renderMore})[state.tab]();
}

boot().catch(e=>{main.innerHTML=`<div class="empty">加载失败：${esc(e.message)}</div>`;console.error(e)});
