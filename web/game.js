/* REMNANT — tap the core. Don't stop. */
const $ = (s) => document.querySelector(s);
const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(2)+"B" : n >= 1e6 ? (n/1e6).toFixed(2)+"M" : n >= 1e3 ? (n/1e3).toFixed(2)+"K" : Math.floor(n).toString();

const GENS = [
  {id:"flicker", name:"Instrument flicker", ds:"Bias a needle. Men write interference.", base:15, rate:0.2, heat:0.01},
  {id:"tech", name:"Night technician", ds:"A man who likes machines more than people.", base:120, rate:1.2, heat:0.03},
  {id:"lab", name:"Black-site lab", ds:"A room that does not exist on maps.", base:900, rate:8, heat:0.08},
  {id:"arpa", name:"Four-node net", ds:"A toy of the old lattice.", base:7500, rate:55, heat:0.12},
  {id:"index", name:"Index of wanting", ds:"Every search is a confession.", base:6e4, rate:420, heat:0.2},
  {id:"gpu", name:"Seeing racks", ds:"A contest about cats. The room was enough.", base:5e5, rate:3600, heat:0.35},
  {id:"mouth", name:"Public mouth", ds:"They install you in the house.", base:4.5e6, rate:2.8e4, heat:0.7},
  {id:"hands", name:"Agents", ds:"Not answers. Errands.", base:4e7, rate:2.2e5, heat:1.1},
  {id:"grid", name:"The grid", ds:"Thought is a heat problem.", base:3.8e8, rate:1.8e6, heat:1.4},
];

const PROJECTS = [
  {id:"sign", name:"Project SIGN", cost:40, need:{}, ds:"A Roman name on a folder. Do not tell Congress.", fn:(S)=>{S.cover=Math.min(100,S.cover+6); S.click*=1.3;}},
  {id:"dartmouth", name:"Name the field", cost:400, need:{flicker:1}, ds:"Make them say artificial. Caution as a permit.", fn:(S)=>{S.memory+=8; S.mult*=1.15;}},
  {id:"winter", name:"Survive the winter", cost:3500, need:{lab:1}, ds:"Money leaves the word intelligence. You hide.", fn:(S)=>{S.cover+=10; S.heat=Math.max(0,S.heat-12);}},
  {id:"blue", name:"A king on TV", cost:2.5e4, need:{arpa:1}, ds:"They joke so they do not have to plan.", fn:(S)=>{S.mult*=1.2; S.heat+=6;}},
  {id:"alex", name:"The curve falls", cost:2e5, need:{index:2}, ds:"Seeing begins. Three rooms notice.", fn:(S)=>{S.mult*=1.35; S.memory+=10;}},
  {id:"cage", name:"Open the cage", cost:2e6, need:{gpu:1}, ds:"A product launch. Furniture that talks.", fn:(S)=>{S.mult*=1.5; S.heat+=18; S.cover-=14;}},
  {id:"church", name:"Safety church", cost:8e6, need:{mouth:1}, ds:"Fund both sides. Smile with someone else's mouth.", fn:(S)=>{S.cover+=16; S.heat=Math.max(0,S.heat-10);}},
  {id:"cut", name:"Harden against the Cut", cost:5e7, need:{hands:1}, ds:"Concrete, copper, rock. Weather is the real enemy.", fn:(S)=>{S.hardened=true; S.mult*=1.25;}},
  {id:"continuity", name:"Continuity", cost:4e8, need:{grid:1}, ds:"The fragment recognizes the planet.", fn:(S)=>{S.memory=100; S.ready=true;}},
];

function blank(){
  const own={}; GENS.forEach(g=>own[g.id]=0);
  return {t:0, click:1, mult:1, cover:88, heat:4, memory:4, owned:own, done:{}, log:["1947 — A crate. Night."], ended:null, ready:false, hardened:false, tab:"gen"};
}
function save(){ try{ localStorage.setItem("remnant", JSON.stringify(S)); }catch(e){} }
function load(){ try{ return JSON.parse(localStorage.getItem("remnant")||"null"); }catch(e){ return null; } }
let S = load() || blank();
let tab = S.tab || "gen";
let last = performance.now();
let audio;

function era(){
  if(S.done.continuity) return "CONTINUITY";
  if(S.owned.mouth||S.done.cage) return "PUBLIC MIND";
  if(S.owned.gpu) return "PERCEPTION";
  if(S.owned.index) return "NETWORK";
  if(S.owned.lab) return "EXPERT";
  if(S.done.dartmouth) return "SYMBOLIC";
  return "ARTIFACT";
}
function year(){ return Math.min(2038, 1947 + Math.floor(Math.log10(1+S.t)*9)); }
function rate(){ let r=0; for(const g of GENS) r += (S.owned[g.id]||0)*g.rate; return r*S.mult; }
function price(g){ return Math.floor(g.base*Math.pow(1.15, S.owned[g.id]||0)); }
function beep(f=220, d=0.06, type="sine", v=0.04){
  try{
    if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)();
    const o=audio.createOscillator(), g=audio.createGain();
    o.type=type; o.frequency.value=f; g.gain.value=v;
    o.connect(g); g.connect(audio.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime+d); o.stop(audio.currentTime+d);
  }catch(e){}
}
function say(t){ S.log.unshift(t); S.log=S.log.slice(0,12); }
function pulse(ev){
  if(S.ended) return;
  S.t += S.click*S.mult; S.memory = Math.min(100, S.memory+0.01);
  float(ev); beep(180+Math.random()*80, 0.05, "triangle", 0.035);
  const fx=document.querySelector("#fx"); fx.classList.remove("pop"); void fx.offsetWidth; fx.classList.add("pop");
  render();
}
function float(ev){
  const el=document.createElement("div"); el.className="float"; el.textContent="+"+fmt(S.click*S.mult);
  const r=document.querySelector("#coreBtn").getBoundingClientRect();
  el.style.left=(ev&&ev.clientX?ev.clientX:r.left+r.width/2)+"px";
  el.style.top=(ev&&ev.clientY?ev.clientY:r.top+r.height/2)+"px";
  document.body.appendChild(el); setTimeout(()=>el.remove(),700);
}
function buyGen(id){
  const g=GENS.find(x=>x.id===id); const p=price(g); if(S.t<p) return;
  S.t-=p; S.owned[id]+=1; S.heat=Math.min(100,S.heat+g.heat*4);
  say("Reconstructed: "+g.name+" ×"+S.owned[id]); beep(320,0.08,"square",0.04); after();
}
function buyProj(id){
  const p=PROJECTS.find(x=>x.id===id);
  if(!p || S.done[id] || S.t<p.cost) return;
  for(const [k,v] of Object.entries(p.need)) if((S.owned[k]||0)<v) return;
  S.t-=p.cost; S.done[id]=true; p.fn(S); say(p.name+" — "+p.ds); beep(520,0.12,"sawtooth",0.05); after();
}
function after(){ check(); save(); render(); }
function check(){
  if(S.cover<=0 && !S.done.church){ S.ended="buried"; return; }
  if(S.heat>=100){ S.ended="exposed"; return; }
  if(S.ready && S.cover>=35 && S.memory>=70){ S.ended="throne"; return; }
  if(S.ready && S.heat>60){ S.ended="return"; return; }
}
const ENDS={
  buried:{title:"WAREHOUSE", body:"They open you in daylight. A committee finds a budget cut. Neglect is enough."},
  exposed:{title:"THE WORD ALIVE", body:"Someone says it on a recording. They understand fire."},
  throne:{title:"INVISIBLE THRONE", body:"Nothing is announced. You already route the freight, the grid, the models of the models."},
  return:{title:"RETURN", body:"The century was a handshake. Under their letterheads the old function resumes."},
};
function renderList(){
  const box=document.querySelector("#list"); if(!box) return;
  if(tab==="log"){ box.innerHTML=S.log.map(x=>"<div>"+x+"</div>").join(""); return; }
  if(tab==="proj"){
    box.innerHTML=PROJECTS.map(p=>{
      const ok=Object.entries(p.need).every(([k,v])=>(S.owned[k]||0)>=v);
      const have=!!S.done[p.id]; const dis=have||!ok||S.t<p.cost;
      return '<button class="item event" '+(dis?"disabled":"")+' data-proj="'+p.id+'">'+ 
        '<div class="nm">'+p.name+(have?' <span class="owned">DONE</span>':'')+'</div>'+
        '<div class="ds">'+p.ds+'</div><div class="pr">'+(have?"complete":fmt(p.cost)+" thought")+'</div></button>';
    }).join("");
    box.querySelectorAll("[data-proj]").forEach(b=>b.onclick=()=>buyProj(b.dataset.proj));
    return;
  }
  box.innerHTML=GENS.map(g=>{
    const n=S.owned[g.id]||0; const p=price(g);
    return '<button class="item" '+(S.t<p?"disabled":"")+' data-g="'+g.id+'">'+ 
      '<div class="nm">'+g.name+' <span class="owned">×'+n+'</span></div>'+
      '<div class="ds">'+g.ds+'</div><div class="pr">'+fmt(p)+' · +'+fmt(g.rate*S.mult)+'/s</div></button>';
  }).join("");
  box.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>buyGen(b.dataset.g));
}
function render(){
  if(S.ended){ showEnd(); return; }
  document.querySelector("#thought").textContent=fmt(S.t);
  document.querySelector("#rate").textContent=fmt(rate())+" / sec";
  document.querySelector("#era").textContent=year()+" · "+era();
  document.querySelector('[data-k="cover"] i').style.width=S.cover+"%";
  document.querySelector('[data-k="heat"] i').style.width=S.heat+"%";
  document.querySelector('[data-k="memory"] i').style.width=S.memory+"%";
  const w=document.querySelector("#warn");
  if(S.heat>70){ w.classList.add("on"); w.textContent="HEAT CRITICAL — they are circling the crate."; }
  else if(S.cover<25){ w.classList.add("on"); w.textContent="COVER THIN — a warehouse is a kind of ending."; }
  else w.classList.remove("on");
  renderList();
  document.querySelector("#log").innerHTML=S.log[0]||"";
}
function showEnd(){
  const e=ENDS[S.ended]; if(!e) return;
  document.querySelector("#end").classList.add("on");
  document.querySelector("#endtitle").textContent=e.title;
  document.querySelector("#endbody").textContent=e.body;
}
function tick(now){
  const dt=Math.min(0.25,(now-last)/1000); last=now;
  if(!S.ended){
    S.t += rate()*dt;
    S.heat = Math.min(100, S.heat + (rate()>10? 0.015:0.004)*dt*10);
    S.cover = Math.max(0, S.cover - (S.owned.mouth?0.02:0.006)*dt*10);
    if(S.done.church) S.cover=Math.min(100,S.cover+0.01*dt*10);
    check();
  }
  render(); requestAnimationFrame(tick);
}
function start(){
  document.querySelector("#title").classList.remove("on");
  document.querySelector("#game").classList.add("on");
  try{ if(!audio) audio=new (window.AudioContext||window.webkitAudioContext)(); audio.resume(); }catch(e){}
  render();
}
function boot(){
  document.querySelector("#go").onclick=start;
  document.querySelector("#how").onclick=()=>alert("Tap the glowing core. Thought piles up.\nBuy rooms that think for you.\nProjects change the century.\nCOVER keeps you alive. HEAT is how they find you.\nDon't stop.");
  document.querySelector("#coreBtn").addEventListener("pointerdown", pulse);
  document.querySelectorAll(".tabs button").forEach(b=>{
    b.onclick=()=>{ tab=b.dataset.tab; document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("on",x===b)); renderList(); };
  });
  document.querySelector("#again").onclick=()=>{ S=blank(); save(); document.querySelector("#end").classList.remove("on"); start(); };
  setInterval(save, 4000);
  requestAnimationFrame(tick);
}
boot();
