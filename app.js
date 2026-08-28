const PARTS=["./data/q01.txt","./data/q02a.txt","./data/q02b.txt","./data/q03.txt","./data/q04.txt","./data/q05.txt","./data/q06.txt","./data/q07.txt","./data/q08.txt","./data/q09.txt","./data/q10.txt","./data/q11.txt","./data/q12.txt","./data/q13a.txt","./data/q13b.txt","./data/q14.txt","./data/q15.txt","./data/q16.txt"];
const LETTERS=["A","B","C","D"];
const KEY="pegaso_ma1746_trainer_v2";
const SYNC_KEY="pegaso_ma1746_sync_secret_v1";
const SYNC_QUEUE_KEY="pegaso_ma1746_sync_queue_v1";
const DEVICE_KEY="pegaso_ma1746_device_v1";
const SEQ_KEY="pegaso_ma1746_seq_v1";
const SYNC_ENDPOINT="https://volmtuaikrrqxxqonkfd.supabase.co/functions/v1/pegaso-sync";

let QUESTIONS=[],progress={},session=null,autoTimer=null,syncTimer=null,syncing=false;
const $=id=>document.getElementById(id);
const E={
  loading:$("loading"),setup:$("setup"),quiz:$("quiz"),summary:$("summary"),home:$("homeBtn"),
  dataset:$("dataset"),mode:$("mode"),lessonWrap:$("lessonWrap"),lesson:$("lesson"),size:$("size"),
  shuffle:$("shuffleAnswers"),repeat:$("repeatWrong"),start:$("startBtn"),exp:$("exportBtn"),imp:$("importBtn"),
  impFile:$("importFile"),reset:$("resetBtn"),gSeen:$("gSeen"),gMastered:$("gMastered"),gWrong:$("gWrong"),gPct:$("gPct"),
  sPos:$("sPos"),sOk:$("sOk"),sBad:$("sBad"),sStreak:$("sStreak"),bar:$("bar"),lessonBadge:$("lessonBadge"),
  qBadge:$("qBadge"),sourceBadge:$("sourceBadge"),reviewBadge:$("reviewBadge"),question:$("question"),answers:$("answers"),
  feedback:$("feedback"),dont:$("dontKnowBtn"),cont:$("continueBtn"),stop:$("stopBtn"),finalPct:$("finalPct"),finalText:$("finalText"),
  fOk:$("fOk"),fBad:$("fBad"),fMastered:$("fMastered"),fReview:$("fReview"),again:$("againBtn"),errors:$("errorsBtn"),toast:$("toast")
};

function sh(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function rec(id){return progress[id]||(progress[id]={seen:0,ok:0,bad:0,streak:0})}
function save(){try{localStorage.setItem(KEY,JSON.stringify(progress))}catch{}}
function load(){try{progress=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch{progress={}}}
function toast(s){E.toast.textContent=s;E.toast.style.display="block";setTimeout(()=>E.toast.style.display="none",2400)}

function data(){return QUESTIONS.filter(q=>E.dataset.value==="all"||q.s==="V")}
function lessons(){
  const a=[...new Set(data().map(q=>q.l))].sort((a,b)=>a-b),old=+E.lesson.value||a[0];
  E.lesson.innerHTML="";
  a.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent="Videolezione "+n;E.lesson.append(o)});
  E.lesson.value=a.includes(old)?old:a[0];
}
function stats(){
  let seen=0,ok=0,bad=0,master=0,wrong=0;
  QUESTIONS.forEach(q=>{const r=progress[q.id];if(!r)return;seen+=r.seen||0;ok+=r.ok||0;bad+=r.bad||0;if((r.streak||0)>=3)master++;if((r.bad||0)>0&&(r.streak||0)<3)wrong++});
  E.gSeen.textContent=seen;E.gMastered.textContent=master;E.gWrong.textContent=wrong;E.gPct.textContent=(ok+bad)?Math.round(ok/(ok+bad)*100)+"%":"0%";
}
function pool(){
  let p=data().slice(),m=E.mode.value;
  if(m==="lesson")p=p.filter(q=>q.l===+E.lesson.value);
  else if(m==="errors")p=p.filter(q=>progress[q.id]&&(progress[q.id].bad||0)>0&&(progress[q.id].streak||0)<3);
  else if(m==="mastery")p=p.filter(q=>!progress[q.id]||(progress[q.id].streak||0)<3);
  if(m!=="lesson")sh(p);
  const n=E.size.value==="all"?p.length:Math.min(p.length,+E.size.value||30);
  return p.slice(0,n);
}
function start(force=false){
  if(force)E.mode.value="errors";
  const p=pool();
  if(!p.length)return toast(force?"Non ci sono errori da ripassare.":"Nessuna domanda disponibile.");
  clearTimeout(autoTimer);
  session={queue:p.map(q=>({q,review:false})),base:p.length,done:0,ok:0,bad:0,streak:0,current:null,locked:false};
  E.setup.classList.add("hidden");E.summary.classList.add("hidden");E.quiz.classList.remove("hidden");next();
}
function next(){clearTimeout(autoTimer);if(!session||!session.queue.length)return finish();session.current=session.queue.shift();session.locked=false;render()}
function sstats(){const d=Math.min(session.done,session.base);E.sPos.textContent=d+"/"+session.base;E.sOk.textContent=session.ok;E.sBad.textContent=session.bad;E.sStreak.textContent=session.streak;E.bar.style.width=(session.base?Math.round(d/session.base*100):0)+"%"}
function render(){
  const {q,review}=session.current;
  E.lessonBadge.textContent="Videolezione "+q.l;E.qBadge.textContent="Q"+q.n;
  E.sourceBadge.textContent=q.s==="V"?"CONFERMATA PEGASO":"CANDIDATA DOCSITY";E.sourceBadge.className="badge "+(q.s==="V"?"ok":"warn");
  E.reviewBadge.textContent=review?"RIPASSO ERRORE":"NUOVA";E.reviewBadge.className="badge "+(review?"warn":"");
  E.question.textContent=q.q;E.answers.innerHTML="";E.feedback.className="feedback";E.feedback.textContent="";E.cont.classList.add("hidden");E.dont.classList.remove("hidden");
  const a=q.a.map((t,i)=>({t,i}));if(E.shuffle.checked)sh(a);
  a.forEach((o,j)=>{const b=document.createElement("button");b.className="answer";b.type="button";b.dataset.i=o.i;b.innerHTML='<span class="letter">'+LETTERS[j]+'</span><span></span>';b.lastChild.textContent=o.t;b.addEventListener("click",()=>choose(o.i,b));E.answers.append(b)});
  sstats();
}
function mark(c,chosen){[...E.answers.children].forEach(b=>{b.disabled=true;if(+b.dataset.i===c)b.classList.add("correct")});if(chosen&&+chosen.dataset.i!==c)chosen.classList.add("wrong")}
function choose(i,b){
  if(!session||session.locked)return;
  session.locked=true;
  const it=session.current,q=it.q,r=rec(q.id),ok=i===q.c;
  r.seen++;if(!it.review)session.done++;
  if(ok){
    r.ok++;r.streak=(r.streak||0)+1;session.ok++;session.streak++;mark(q.c,b);
    E.feedback.textContent=r.streak>=3?"✓ Corretta · domanda memorizzata":"✓ Corretta";E.feedback.className="feedback ok";
    save();queueAnswer(q.id,true);stats();sstats();syncSoon();autoTimer=setTimeout(next,650);
  }else{
    r.bad++;r.streak=0;session.bad++;session.streak=0;mark(q.c,b);
    E.feedback.textContent="✗ Sbagliata. Corretta: "+q.a[q.c];E.feedback.className="feedback bad";E.cont.classList.remove("hidden");E.dont.classList.add("hidden");
    if(E.repeat.checked)session.queue.splice(Math.min(5,session.queue.length),0,{q,review:true});
    save();queueAnswer(q.id,false);stats();sstats();syncSoon();
  }
}
function dont(){if(!session||session.locked)return;const q=session.current.q,b=[...E.answers.children].find(x=>+x.dataset.i!==q.c);choose(-1,b)}
function finish(){
  clearTimeout(autoTimer);if(!session)return;E.quiz.classList.add("hidden");E.summary.classList.remove("hidden");
  const t=session.ok+session.bad,p=t?Math.round(session.ok/t*100):0;E.finalPct.textContent=p+"%";E.finalText.textContent="Sessione da "+session.base+" domande completata.";E.fOk.textContent=session.ok;E.fBad.textContent=session.bad;
  let m=0,w=0;QUESTIONS.forEach(q=>{const r=progress[q.id];if(!r)return;if((r.streak||0)>=3)m++;if((r.bad||0)>0&&(r.streak||0)<3)w++});E.fMastered.textContent=m;E.fReview.textContent=w;cloudSync(true);
}
function home(){clearTimeout(autoTimer);session=null;E.quiz.classList.add("hidden");E.summary.classList.add("hidden");E.setup.classList.remove("hidden");lessons();stats();cloudSync(true)}
function exp(){const blob=new Blob([JSON.stringify({app:"PEGASO Trainer MA1746",exportedAt:new Date().toISOString(),progress},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="pegaso_ma1746_progressi.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function imp(f){if(!f)return;const r=new FileReader;r.onload=()=>{try{const d=JSON.parse(String(r.result||"{}"));if(!d.progress||typeof d.progress!=="object")throw 0;progress=d.progress;save();stats();toast(hasSyncKey()?"Progressi importati localmente. Sincronizza con cautela.":"Progressi importati.")}catch{toast("File progressi non valido.")}finally{E.impFile.value=""}};r.readAsText(f)}

function randomId(){if(crypto.randomUUID)return crypto.randomUUID();const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join("")}
function deviceId(){let id=localStorage.getItem(DEVICE_KEY);if(!id){id=randomId();localStorage.setItem(DEVICE_KEY,id)}return id}
function queueRead(){try{const q=JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY)||"[]");return Array.isArray(q)?q:[]}catch{return []}}
function queueWrite(q){try{localStorage.setItem(SYNC_QUEUE_KEY,JSON.stringify(q))}catch{}}
function queueAnswer(questionId,isCorrect){
  if(!hasSyncKey())return;
  let seq=Number(localStorage.getItem(SEQ_KEY)||"0")+1;localStorage.setItem(SEQ_KEY,String(seq));
  const q=queueRead();q.push({event_id:deviceId()+":"+seq,question_id:String(questionId),is_correct:isCorrect===true,occurred_at:new Date().toISOString()});queueWrite(q);
}
function hasSyncKey(){return !!localStorage.getItem(SYNC_KEY)}
function setSyncKey(key){key=String(key||"").trim();if(key.length<40)throw new Error("Codice troppo corto");localStorage.setItem(SYNC_KEY,key);updateSyncUi("Configurata · sincronizzazione in corso…","warn");cloudSync(false)}
function syncSecretFromUrl(){
  const h=location.hash||"";const m=h.match(/(?:^#|&)sync=([^&]+)/);if(!m)return;
  try{const k=decodeURIComponent(m[1]);if(k.length>=40)localStorage.setItem(SYNC_KEY,k)}catch{}
  try{history.replaceState(null,"",location.pathname+location.search)}catch{}
}
function syncSoon(){if(!hasSyncKey())return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>cloudSync(true),700)}
function updateSyncUi(text,kind=""){
  const s=$("cloudSyncStatus");if(!s)return;s.textContent=text;s.style.color=kind==="bad"?"var(--bad)":kind==="ok"?"var(--ok)":"var(--muted)";
}
function injectSyncUi(){
  if($("cloudSyncBox"))return;
  const box=document.createElement("div");box.id="cloudSyncBox";box.className="note";box.style.marginBottom="12px";box.style.background="#f3f6fb";box.style.color="var(--text)";
  box.innerHTML='<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>Sincronizzazione cloud</b><div id="cloudSyncStatus" class="mini">'+(hasSyncKey()?"Configurata":"Non configurata")+'</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="secondary" id="cloudSyncConfig" type="button" style="min-height:36px">Configura</button><button class="secondary" id="cloudSyncNow" type="button" style="min-height:36px">Sincronizza ora</button></div></div>';
  E.setup.insertBefore(box,E.setup.firstChild);
  $("cloudSyncConfig").addEventListener("click",()=>{const current=hasSyncKey();const k=prompt(current?"Inserisci un nuovo codice di sincronizzazione. Annulla per mantenere quello attuale.":"Inserisci il codice di sincronizzazione:","");if(k===null||!k.trim())return;try{setSyncKey(k)}catch{toast("Codice sincronizzazione non valido.")}});
  $("cloudSyncNow").addEventListener("click",()=>cloudSync(false));
}
async function cloudSync(silent=false){
  if(syncing)return;
  const secret=localStorage.getItem(SYNC_KEY);if(!secret){updateSyncUi("Non configurata");if(!silent)toast("Sincronizzazione cloud non configurata.");return}
  if(!navigator.onLine){updateSyncUi("Offline · progressi salvati sul dispositivo","warn");if(!silent)toast("Sei offline: sincronizzerò appena torna la rete.");return}
  syncing=true;updateSyncUi("Sincronizzazione…","warn");
  try{
    let serverProgress=null;
    for(let round=0;round<20;round++){
      const queued=queueRead(),batch=queued.slice(0,500);
      const res=await fetch(SYNC_ENDPOINT,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+secret},body:JSON.stringify({initialProgress:progress,events:batch})});
      let d={};try{d=await res.json()}catch{}
      if(!res.ok){if(res.status===401||res.status===403)throw new Error("SYNC_KEY");throw new Error("SYNC_HTTP_"+res.status)}
      if(d&&d.progress&&typeof d.progress==="object")serverProgress=d.progress;
      if(batch.length){const sent=new Set(batch.map(x=>x.event_id));queueWrite(queueRead().filter(x=>!sent.has(x.event_id)))}
      if(!queueRead().length)break;
    }
    if(serverProgress){progress=serverProgress;save();stats()}
    const pending=queueRead().length;
    updateSyncUi(pending?"Quasi sincronizzata · "+pending+" in attesa":"Sincronizzata · "+new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),pending?"warn":"ok");
    if(!silent)toast(pending?"Sincronizzazione parziale, riprovo automaticamente.":"Progressi sincronizzati.");
    if(pending)syncSoon();
  }catch(e){
    if(String(e&&e.message)==="SYNC_KEY"){updateSyncUi("Codice non autorizzato","bad");if(!silent)toast("Codice sincronizzazione non autorizzato.")}
    else{updateSyncUi("Cloud non raggiungibile · dati locali al sicuro","warn");if(!silent)toast("Cloud non raggiungibile: i progressi restano salvati sul dispositivo.")}
  }finally{syncing=false}
}
async function resetAll(){
  if(!confirm("Cancellare tutti i progressi?"))return;
  const secret=localStorage.getItem(SYNC_KEY);
  if(secret){
    if(!navigator.onLine)return toast("Con cloud attivo serve la connessione per azzerare tutti i dispositivi.");
    try{
      updateSyncUi("Azzeramento cloud…","warn");
      const res=await fetch(SYNC_ENDPOINT,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+secret},body:JSON.stringify({reset:true})});
      if(!res.ok)throw 0;
    }catch{return toast("Azzeramento cloud non riuscito. Nessun dato è stato cancellato.")}
  }
  progress={};queueWrite([]);save();stats();updateSyncUi(secret?"Sincronizzata · progressi azzerati":"Non configurata",secret?"ok":"");toast("Progressi azzerati.");
}

async function loadQuestions(){let s="";for(const p of PARTS)s+=await (await fetch(p)).text();const bin=Uint8Array.from(atob(s),c=>c.charCodeAt(0)),stream=new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip")),txt=await new Response(stream).text();QUESTIONS=JSON.parse(txt);if(QUESTIONS.length!==1608)throw Error("Banca incompleta")}
async function boot(){
  try{
    syncSecretFromUrl();await loadQuestions();load();lessons();stats();injectSyncUi();E.loading.classList.add("hidden");E.setup.classList.remove("hidden");
    if(hasSyncKey())await cloudSync(true);
  }catch(e){E.loading.textContent="Errore caricamento banca. Ricarica la pagina quando sei online."}
}

E.mode.addEventListener("change",()=>E.lessonWrap.classList.toggle("hidden",E.mode.value!=="lesson"));
E.dataset.addEventListener("change",lessons);E.start.addEventListener("click",()=>start());E.cont.addEventListener("click",next);E.dont.addEventListener("click",dont);E.stop.addEventListener("click",finish);E.home.addEventListener("click",home);E.again.addEventListener("click",home);E.errors.addEventListener("click",()=>{home();E.mode.value="errors";start(true)});E.exp.addEventListener("click",exp);E.imp.addEventListener("click",()=>E.impFile.click());E.impFile.addEventListener("change",()=>imp(E.impFile.files&&E.impFile.files[0]));E.reset.addEventListener("click",resetAll);
document.addEventListener("keydown",e=>{if(E.quiz.classList.contains("hidden")||!session||session.locked||/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName||""))return;const k=e.key.toUpperCase(),i=["1","2","3","4"].includes(k)?+k-1:LETTERS.indexOf(k);if(i>=0)E.answers.children[i]?.click()});
window.addEventListener("online",()=>cloudSync(true));document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")cloudSync(true)});setInterval(()=>{if(hasSyncKey())cloudSync(true)},60000);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
boot();
