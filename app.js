const DEPTS=["경영지원","인사","영업","마케팅","생산","R&D","IT"];
const LEVELS=["사원","대리","과장","차장","부장"];
const TOPICS=["리더십","데이터·AI 활용","커뮤니케이션","직무전문성","조직문화","디지털 협업툴","커리어 개발","법정의무교육"];
const FORMATS=["오프라인 집합","온라인 라이브","이러닝","블렌디드"];
const TIMINGS=["1분기","2분기","3분기","4분기"];
const FMT_COLORS=["var(--accent)","var(--signal)","var(--muted)","var(--good)"];
const WD=["일","월","화","수","목","금","토"];

const S={courses:[],enrolls:[],surveys:[],feedback:[],me:null,canEdit:false,db:null,cat:"전체",current:null};

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const nps=a=>a.length?Math.round((a.filter(v=>v>=9).length-a.filter(v=>v<=6).length)/a.length*100):null;
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* ---------- 폼 구성 ---------- */
function opts(sel,list,ph){sel.innerHTML=(ph?`<option value="">${ph}</option>`:"")+list.map(v=>`<option>${esc(v)}</option>`).join("")}
function chips(box,name,list,type){box.innerHTML=list.map((v,i)=>`<label class="chip"><input type="${type}" name="${name}" id="${name}-${i}" value="${esc(v)}"><span>${esc(v)}</span></label>`).join("")}
function scale(box,name,from,to){let h="";for(let i=from;i<=to;i++)h+=`<label><input type="radio" name="${name}" id="${name}-${i}" value="${i}"><span>${i}</span></label>`;box.innerHTML=h}
opts($("sv-dept"),DEPTS,"선택");opts($("sv-level"),LEVELS,"선택");
chips($("sv-topics"),"topic",TOPICS,"checkbox");chips($("sv-format"),"fmt",FORMATS,"radio");chips($("sv-timing"),"tim",TIMINGS,"radio");
scale($("fb-score"),"score",1,5);scale($("fb-apply"),"apply",1,5);scale($("fb-nps"),"npsv",0,10);
opts($("ap-dept"),DEPTS);opts($("ad-cat"),TOPICS);opts($("ad-format"),FORMATS);
$("sv-topics").addEventListener("change",e=>{const c=[...document.querySelectorAll('input[name=topic]:checked')];if(c.length>3){e.target.checked=false}});

/* ---------- 라우팅 ---------- */
const VIEWS=["survey","courses","feedback","dashboard"];
function route(){const v=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):"courses";
  VIEWS.forEach(x=>{$("v-"+x).hidden=x!==v});
  document.querySelectorAll(".steps a").forEach(a=>{if(a.dataset.view===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});}
addEventListener("hashchange",route);route();

/* ---------- 계산 ---------- */
function stats(c){const es=S.enrolls.filter(e=>e.courseId===c.id);const fb=S.feedback.filter(f=>f.courseId===c.id);
  return{conf:es.filter(e=>e.status==="확정").length,wait:es.filter(e=>e.status==="대기").length,
    score:avg(fb.map(f=>f.score)),apply:avg(fb.map(f=>f.apply)),nps:nps(fb.map(f=>f.nps)),n:fb.length}}
function fmtDate(d){const t=new Date(d+"T00:00:00");return isNaN(t)?{m:"",d:"-",w:""}:{m:(t.getMonth()+1)+"월",d:t.getDate(),w:WD[t.getDay()]}}

/* ---------- 렌더: 교육신청 ---------- */
function renderFilter(){const cats=["전체",...TOPICS.filter(t=>S.courses.some(c=>c.category===t))];
  $("catFilter").innerHTML=cats.map(c=>`<button type="button" aria-pressed="${c===S.cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
$("catFilter").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;S.cat=b.dataset.cat;renderFilter();renderCourses()});
const TODAY=(()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")})();
const ended=c=>String(c.date)<TODAY;
function renderCourses(){
  const list=S.courses.filter(c=>S.cat==="전체"||c.category===S.cat).sort((a,b)=>(ended(a)-ended(b))||String(a.date).localeCompare(String(b.date)));
  if(!S.courses.length){$("courseList").innerHTML=`<div class="empty">아직 개설된 과정이 없습니다. 대시보드의 '과정 개설'에서 첫 과정을 등록하세요.</div>`;return}
  $("courseList").innerHTML=list.map(c=>{const st=stats(c),d=fmtDate(c.date),pct=Math.min(100,st.conf/c.capacity*100),full=st.conf>=c.capacity;
    const mine=S.enrolls.find(e=>e.courseId===c.id&&S.me&&e.applicantId===S.me);
    let pill=ended(c)?`<span class="pill closed">교육 종료</span>`:c.open===false?`<span class="pill closed">신청 마감</span>`:full?`<span class="pill wait">대기 접수</span>`:`<span class="pill ok">신청 가능</span>`;
    let cta=ended(c)?(mine&&mine.status==="확정"?`<span class="pill closed">수강 완료</span>`:``):mine?`<span class="pill ${mine.status==="확정"?"ok":"wait"}">${mine.status==="확정"?"신청 완료":"대기 "+waitRank(mine)+"번"}</span>`
      :c.open===false?``:`<button class="btn btn-sm" data-apply="${esc(c.id)}">${full?"대기 신청":"신청"}</button>`;
    return `<article class="course"><div class="date" aria-label="${esc(c.date)}"><span class="m">${d.m}</span><span class="d num">${d.d}</span><span class="w">${d.w}</span></div>
      <div class="body"><span class="cat">${esc(c.category)}</span><h3>${esc(c.title)}</h3>
      <div class="meta"><span>${esc(c.format)}</span><span>${esc(c.hours)}시간</span>${c.instructor?`<span>강사 ${esc(c.instructor)}</span>`:""}${pill}</div>
      <div class="seat"><span class="bar"><i class="${full?"full":""}" style="width:${pct}%"></i></span><span class="num">${st.conf}/${c.capacity}</span>${st.wait?`<span>대기 ${st.wait}</span>`:""}</div></div>
      <div class="cta">${cta}</div></article>`}).join("")||`<div class="empty">이 분야에 개설된 과정이 없습니다.</div>`}
function waitRank(e){const w=S.enrolls.filter(x=>x.courseId===e.courseId&&x.status==="대기").sort((a,b)=>a.createdAt-b.createdAt);return w.findIndex(x=>x.id===e.id)+1}
function renderMine(){const mine=S.me?S.enrolls.filter(e=>e.applicantId===S.me):[];
  $("myList").innerHTML=mine.length?mine.map(e=>{const c=S.courses.find(x=>x.id===e.courseId);
    return `<li><span><strong>${esc(c?c.title:"삭제된 과정")}</strong><br><span class="hint">${esc(e.name)} · ${esc(e.dept)} · ${e.status==="확정"?"확정":"대기 "+waitRank(e)+"번"}</span></span>${c&&ended(c)?`<span class="pill closed">교육 종료</span>`:`<button class="btn-ghost btn-sm" data-cancel="${esc(e.id)}">취소</button>`}</li>`}).join("")
    :`<li class="hint" style="border:0">아직 신청한 과정이 없습니다.</li>`}
$("courseList").addEventListener("click",e=>{const b=e.target.closest("[data-apply]");if(b)openSheet(b.dataset.apply)});
$("myList").addEventListener("click",async e=>{const b=e.target.closest("[data-cancel]");if(!b)return;b.disabled=true;await cancelEnroll(b.dataset.cancel)});

/* ---------- 신청 시트 ---------- */
function openSheet(id){const c=S.courses.find(x=>x.id===id);if(!c||ended(c))return;S.current=c;const st=stats(c);
  $("ap-cat").textContent=c.category;$("ap-title").textContent=c.title;$("ap-meta").textContent=`${c.date} · ${c.format} · ${c.hours}시간`;
  $("ap-note").textContent=st.conf>=c.capacity?`정원이 찼습니다. 대기 ${st.wait+1}번으로 접수됩니다.`:`잔여 ${c.capacity-st.conf}석`;
  $("ap-name").value=store.get("lh-name")||"";const d=store.get("lh-dept");if(d)$("ap-dept").value=d;
  $("ap-msg").textContent="";$("ap-submit").disabled=false;$("applySheet").hidden=false;$("ap-name").focus()}
function closeSheet(){$("applySheet").hidden=true;S.current=null}
$("ap-cancel").addEventListener("click",closeSheet);
$("applySheet").addEventListener("click",e=>{if(e.target===$("applySheet"))closeSheet()});
addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("applySheet").hidden)closeSheet()});
$("applyForm").addEventListener("submit",async e=>{e.preventDefault();const c=S.current;const name=$("ap-name").value.trim(),dept=$("ap-dept").value;
  if(!name){$("ap-msg").textContent="이름을 입력해 주세요.";return}
  if(!S.db){$("ap-msg").textContent="미리보기에서는 저장되지 않습니다. 로그인한 상태로 열면 실제로 제출할 수 있습니다.";return}
  if(S.enrolls.some(x=>x.courseId===c.id&&x.name===name&&x.dept===dept)){$("ap-msg").textContent="이미 같은 이름으로 신청된 과정입니다.";return}
  $("ap-submit").disabled=true;store.set("lh-name",name);store.set("lh-dept",dept);
  const full=stats(c).conf>=c.capacity;
  try{await S.db.collection("enrollments").add({courseId:c.id,name,dept,status:full?"대기":"확정",applicantId:S.me||"",createdAt:Date.now()});closeSheet()}
  catch(err){$("ap-submit").disabled=false;$("ap-msg").textContent=err&&err.code==="quota_exceeded"?"저장 공간이 가득 찼습니다.":"저장하지 못했습니다. 잠시 후 다시 시도해 주세요."}});
async function cancelEnroll(id){const e=S.enrolls.find(x=>x.id===id);if(!e)return;
  try{await S.db.doc("enrollments/"+id).delete();
    if(e.status==="확정"){const next=S.enrolls.filter(x=>x.courseId===e.courseId&&x.status==="대기"&&x.id!==id).sort((a,b)=>a.createdAt-b.createdAt)[0];
      if(next)await S.db.doc("enrollments/"+next.id).update({status:"확정"})}}catch(err){}}

/* ---------- 수요조사 ---------- */
$("surveyForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("sv-msg");m.className="msg";
  const topics=[...document.querySelectorAll('input[name=topic]:checked')].map(i=>i.value);
  const fmt=document.querySelector('input[name=fmt]:checked'),tim=document.querySelector('input[name=tim]:checked');
  if(!$("sv-dept").value||!$("sv-level").value||!topics.length||!fmt||!tim){m.className="msg err";m.textContent="부서, 직급, 주제, 방식, 시기를 모두 골라 주세요.";return}
  if(!S.db){m.className="msg err";m.textContent="미리보기에서는 저장되지 않습니다. 로그인한 상태로 열면 실제로 제출할 수 있습니다.";return}
  try{await S.db.collection("surveys").add({dept:$("sv-dept").value,level:$("sv-level").value,topics,format:fmt.value,timing:tim.value,comment:$("sv-comment").value.trim(),createdAt:Date.now()});
    e.target.reset();m.textContent="응답이 제출되었습니다. 감사합니다."}catch(err){m.className="msg err";m.textContent="제출하지 못했습니다. 잠시 후 다시 시도해 주세요."}});

/* ---------- 만족도 ---------- */
function renderFbSelect(){const sel=$("fb-course"),v=sel.value;
  sel.innerHTML=`<option value="">과정 선택</option>`+[...S.courses].filter(ended).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(c=>`<option value="${esc(c.id)}">${esc(c.title)} (${esc(c.date)})</option>`).join("");sel.value=v}
$("fbForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("fb-msg");m.className="msg";
  const g=n=>{const i=document.querySelector(`input[name=${n}]:checked`);return i?Number(i.value):null};
  const score=g("score"),apply=g("apply"),n=g("npsv");
  if(!$("fb-course").value||score==null||apply==null||n==null){m.className="msg err";m.textContent="과정과 세 가지 점수를 모두 선택해 주세요.";return}
  if(!S.db){m.className="msg err";m.textContent="미리보기에서는 저장되지 않습니다. 로그인한 상태로 열면 실제로 제출할 수 있습니다.";return}
  try{await S.db.collection("feedback").add({courseId:$("fb-course").value,score,apply,nps:n,comment:$("fb-comment").value.trim(),createdAt:Date.now()});
    e.target.reset();m.textContent="평가가 제출되었습니다."}catch(err){m.className="msg err";m.textContent="제출하지 못했습니다. 잠시 후 다시 시도해 주세요."}});

/* ---------- 대시보드 ---------- */
function bars(rows,max){return rows.map(r=>`<div class="brow"><span class="t" title="${esc(r.t)}">${esc(r.t)}</span><span class="track"><i class="${r.gap?"gap":""}" style="width:${max?r.v/max*100:0}%"></i></span><span class="v">${r.v}</span></div>`).join("")}
/* 차수 증설 기준: 정원 규모별 대기 비율 (소규모일수록 한 차수를 더 열 만큼 모여야 하므로 높게) */
function surgeRate(cap){return cap<=15?0.5:cap<=30?0.3:0.2}
function renderDash(){
  const cap=S.courses.reduce((a,c)=>a+Number(c.capacity||0),0);
  const conf=S.enrolls.filter(e=>e.status==="확정").length,wait=S.enrolls.filter(e=>e.status==="대기").length;
  const sc=avg(S.feedback.map(f=>f.score)),np=nps(S.feedback.map(f=>f.nps));
  const k=[["총 신청",`${conf+wait}<small>명</small>`,`확정 ${conf} · 대기 ${wait}`],
    ["정원 충족률",cap?`${Math.round(Math.min(conf,cap)/cap*100)}<small>%</small>`:"–",`정원 ${cap}석 · ${S.courses.length}개 과정`],
    ["평균 만족도",sc!=null?`${sc.toFixed(2)}<small>/5</small>`:"–",`평가 ${S.feedback.length}건`],
    ["NPS",np!=null?`${np>0?"+":""}${np}`:"–",`수요조사 응답 ${S.surveys.length}건`]];
  $("kpis").innerHTML=k.map(([a,b,c])=>`<div class="kpi"><span class="k">${a}</span><span class="v">${b}</span><span class="s">${c}</span></div>`).join("");

  const thinC=S.courses.map(c=>({c,st:stats(c)})).filter(x=>x.st.n>0&&x.st.conf>0&&x.st.n/x.st.conf<0.5);
  $("kpiNote").hidden=!thinC.length;
  $("kpiNote").innerHTML=thinC.length?`<span class="pill thin">응답 부족 포함</span> 평균 만족도와 NPS에는 응답률 50% 미만 과정 ${thinC.length}개(${thinC.map(x=>`${esc(x.c.title)}, 응답 ${x.st.n}명`).join(" / ")})가 포함되어 있어 해석에 주의가 필요합니다.`:"";
  const cnt={};S.surveys.forEach(s=>(s.topics||[]).forEach(t=>cnt[t]=(cnt[t]||0)+1));
  const offered=new Set(S.courses.map(c=>c.category));
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([t,v])=>({t,v,gap:!offered.has(t)}));
  $("demandBars").innerHTML=top.length?bars(top,top[0].v):`<div class="empty">수요조사 응답이 들어오면 주제별 순위가 표시됩니다.</div>`;
  const gaps=top.filter(r=>r.gap).slice(0,2);
  const hot=S.courses.map(c=>({c,st:stats(c)})).filter(x=>x.c.format!=="이러닝"&&x.st.wait>0&&x.st.wait>=x.c.capacity*surgeRate(x.c.capacity)).sort((a,b)=>b.st.wait-a.st.wait)[0];
  const ins=[];if(gaps.length)ins.push(`<span><b>개설 검토</b> 수요가 있지만 과정이 없는 주제: ${gaps.map(g=>`${esc(g.t)}(${g.v}명)`).join(", ")}</span>`);
  if(hot)ins.push(`<span><b>차수 증설</b> '${esc(hot.c.title)}' 대기자 ${hot.st.wait}명 (정원의 ${Math.round(hot.st.wait/hot.c.capacity*100)}%, 기준 ${Math.round(surgeRate(hot.c.capacity)*100)}%)</span>`);
  const lows=S.courses.map(c=>({c,st:stats(c)})).filter(x=>x.st.conf>0&&x.st.n/x.st.conf>=0.5&&x.st.apply!=null&&x.st.apply<3.5).sort((a,b)=>a.st.apply-b.st.apply);
  if(lows.length)ins.push(`<span><b>내용 보완</b> ${lows.map(low=>`'${esc(low.c.title)}' 현업적용도 ${low.st.apply.toFixed(1)}점 (응답률 ${Math.round(low.st.n/low.st.conf*100)}%)`).join(", ")}</span>`);
  $("insight").innerHTML=ins.join("");$("insight").hidden=!ins.length;

  $("courseTable").innerHTML=S.courses.length?[...S.courses].sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(c=>{const st=stats(c),thin=st.n>0&&st.conf>0&&st.n/st.conf<0.5;
    return `<tr><td>${esc(c.title)}<br><span class="hint">${esc(c.date)} · ${esc(c.category)}</span></td><td class="r num">${st.conf}/${c.capacity}</td><td class="r num">${st.wait||"–"}</td><td class="r num">${st.conf?Math.round(st.n/st.conf*100)+"%":"–"}${thin?'<br><span class="pill thin">응답 부족</span>':""}</td>
    <td class="r num${thin?" dim":""}">${st.score!=null?st.score.toFixed(1):"–"}</td><td class="r num${thin?" dim":""}">${st.apply!=null?st.apply.toFixed(1):"–"}</td><td class="r num${thin?" dim":""}">${st.nps!=null?(st.nps>0?"+":"")+st.nps:"–"}</td></tr>`}).join("")
    :`<tr><td colspan="7" class="hint">개설된 과정이 없습니다.</td></tr>`;

  const dc={};S.enrolls.forEach(e=>dc[e.dept]=(dc[e.dept]||0)+1);
  const dr=DEPTS.map(t=>({t,v:dc[t]||0})).filter(r=>r.v).sort((a,b)=>b.v-a.v);
  $("deptBars").innerHTML=dr.length?bars(dr,dr[0].v):`<div class="empty">신청이 들어오면 표시됩니다.</div>`;

  const fc={};S.surveys.forEach(s=>s.format&&(fc[s.format]=(fc[s.format]||0)+1));const tot=Object.values(fc).reduce((a,b)=>a+b,0);
  $("formatStack").innerHTML=tot?`<div class="stack" role="img" aria-label="선호 교육 방식 비율">${FORMATS.map((f,i)=>fc[f]?`<i style="width:${fc[f]/tot*100}%;background:${FMT_COLORS[i]}"></i>`:"").join("")}</div>
    <div class="legend" style="margin-top:10px">${FORMATS.map((f,i)=>fc[f]?`<span><b style="background:${FMT_COLORS[i]}"></b>${f} <span class="num">${Math.round(fc[f]/tot*100)}%</span></span>`:"").join("")}</div>`
    :`<div class="empty">수요조사 응답이 들어오면 표시됩니다.</div>`;
  $("adminPanel").hidden=!S.canEdit;$("adminHint").textContent=S.demo?"체험 모드에서는 누구나 개설해 볼 수 있습니다":"관리자 전용";
}

/* ---------- 과정 개설 ---------- */
$("addForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("ad-msg");m.className="msg";
  const t=$("ad-title").value.trim(),d=$("ad-date").value;
  if(!t||!d){m.className="msg err";m.textContent="과정명과 교육일을 입력해 주세요.";return}
  try{await S.db.collection("courses").add({title:t,category:$("ad-cat").value,format:$("ad-format").value,date:d,hours:Number($("ad-hours").value)||4,capacity:Number($("ad-cap").value)||20,instructor:$("ad-inst").value.trim(),open:true,createdAt:Date.now()});
    e.target.reset();$("ad-hours").value=4;$("ad-cap").value=20;m.textContent="과정이 개설되었습니다."}
  catch(err){m.className="msg err";m.textContent="개설하지 못했습니다. 관리자 권한이 있는지 확인해 주세요."}});

function renderAll(){renderFilter();renderCourses();renderMine();renderFbSelect();renderDash()}
/* ---------- 체험 모드: 저장 없이 이 화면에서만 반영 ---------- */
function mockDb(){const K={courses:"courses",enrollments:"enrolls",surveys:"surveys",feedback:"feedback"};let n=0;
  const at=p=>{const[c,id]=p.split("/");return{arr:S[K[c]],id}};
  return{collection:c=>({add:async d=>{S[K[c]].push({id:"local"+(++n),...d});renderAll()}}),
    doc:p=>({delete:async()=>{const{arr,id}=at(p);const i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1);renderAll()},
      update:async d=>{const{arr,id}=at(p);const x=arr.find(x=>x.id===id);if(x)Object.assign(x,d);renderAll()}})}}
function startDemo(keepLive){S.demo=true;S.db=mockDb();if(!S.me)S.me="demo-viewer";if(!keepLive)S.canEdit=true;$("dbNotice").hidden=false;renderAll()}

/* ---------- 데이터 연결 ---------- */
(async()=>{
  try{const r=await fetch("sample-data.json");Object.assign(S,await r.json())}catch(e){}
  renderAll();
  let db=null;try{db=await window.claude?.use?.("db")}catch(e){}
  if(!db){startDemo();return}
  S.db=db;
  const user=await window.claude.use("user");
  if(user){try{S.me=await user.id()}catch(e){}try{S.canEdit=!!(await user.canEdit())}catch(e){}
    let w=null;try{w=await user.can("data.write")}catch(e){}
    if(w===false){startDemo(true)}}
  const sub=(col,key)=>db.collection(col).onSnapshot(s=>{S[key]=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()},()=>{});
  sub("courses","courses");sub("enrollments","enrolls");sub("surveys","surveys");sub("feedback","feedback");
})();
