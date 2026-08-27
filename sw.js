const CACHE="pegaso-trainer-ma1746-v3";
const ASSETS=[
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./data/q01.txt",
  "./data/q02a.txt","./data/q02b.txt",
  "./data/q03.txt","./data/q04.txt","./data/q05.txt","./data/q06.txt","./data/q07.txt","./data/q08.txt","./data/q09.txt","./data/q10.txt","./data/q11.txt","./data/q12.txt",
  "./data/q13a.txt","./data/q13b.txt",
  "./data/q14.txt","./data/q15.txt","./data/q16.txt"
];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    return response;
  })));
});
