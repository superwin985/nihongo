const CACHE='jp-learn-v2';
const SHELL=['./','./index.html','./app.js','./styles.css','./manifest.webmanifest','./data_ex.json','./twelve.json','./gold_seed.json','./drill_seed.json','./shadowing_segs.json','./shadowing_tips.json','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=e.request.url;
  if(e.request.method!=='GET')return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(e.request);
    if(hit) return hit;
    try{
      const res=await fetch(e.request);
      if(res.ok && (u.includes('/media/') || u.endsWith('.json') || u.endsWith('.js') || u.endsWith('.css') || u.endsWith('.html') || u.endsWith('.png') || u.endsWith('.webp') || u.endsWith('.mp3'))){
        c.put(e.request,res.clone());
      }
      return res;
    }catch(err){
      return hit || new Response('offline',{status:503});
    }
  })());
});
