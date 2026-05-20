// ===== State =====
let allQuestions=[], students={}, currentClass='', currentName='', selectedCount=10;
let classQuestions=[];
let quizQuestions=[], currentIdx=0, answers=[], startTime=0, questionStartTime=0, timerInterval=null;
let allRecords=[], isTeacher=false, cameFrom='select';
let editingQIdx=-1, editingStuKey=null;
let selectedQIndices=new Set();

const $=id=>document.getElementById(id);

// ===== API Config =====
function getApiUrl(key, defaultPath, suffix){
  var s=localStorage.getItem('quizApi_'+key);
  var base=s||('https://quickform.cn/api/'+defaultPath);
  return suffix?base+suffix:base;
}
const _isT=new URLSearchParams(location.search).get('role')==='teacher';
const API={
  questions:{ read:getApiUrl('questions','uzubqztmvc','/all'), post:getApiUrl('questions','uzubqztmvc',''),
    clear:_isT?atob('aHR0cHM6Ly9xdWlja2Zvcm0uY24vdGFzay8xNTAwMS9zdWJtaXNzaW9ucy9jbGVhcj9lZGl0X2NvZGU9MEphdW1paGNlOTdkcTZFMlBBN2hpLXpWUjRTRVlmOEI='):'' },
  students:{ read:getApiUrl('students','5j9aayuuzl','/all'), post:getApiUrl('students','5j9aayuuzl',''),
    clear:_isT?atob('aHR0cHM6Ly9xdWlja2Zvcm0uY24vdGFzay83MDg0L3N1Ym1pc3Npb25zL2NsZWFyP2VkaXRfY29kZT02UjgyZnNMUURlaHNQVTFsdEtfbUxVeWc0SVVEbzk4RA=='):'' },
  records:{ read:getApiUrl('records','9x9k35vdah','/all'), post:getApiUrl('records','9x9k35vdah','') }
};

function playSound(correct){
  try{ const s=$(correct?'snd-success':'snd-fail'); s.currentTime=0; s.play().catch(()=>{}); }catch(e){}
}

// ===== Composite Score (based on cumulative stats) =====
function compositeScore(r){
  const acc=r.accuracy||0;
  const tq=r.total_questions||0;
  const ts=r.total_time_sec||0;
  const avgTime=tq>0?ts/tq:999;
  // 题量权重：累计刷题越多分越高，50题满分
  const qWeight=Math.min(tq/50,1)*100;
  // 速度得分：平均每题用时，5秒内满分，越慢越低
  const speedScore=Math.max(0, 100-(avgTime-5)*2);
  return Math.round(acc*0.5 + qWeight*0.3 + speedScore*0.2);
}

// ===== Init =====
async function init(){
  const params=new URLSearchParams(location.search);
  isTeacher=params.get('role')==='teacher';
  try{
    const fetches=[
      fetch(API.questions.read).then(r=>r.json()),
      fetch(API.students.read).then(r=>r.json()),
    ];
    if(isTeacher) fetches.push(fetch(API.records.read).then(r=>r.json()));
    const results=await Promise.all(fetches);
    const [qRes,sRes]=results;

    if(qRes.submissions){
      qRes.submissions.forEach(sub=>{
        try{
          const raw=sub.data||sub.raw_data; const parsed=typeof raw==='string'?JSON.parse(raw):raw;
          if(Array.isArray(parsed)&&parsed.length>0&&parsed[0].question){
            allQuestions=allQuestions.concat(parsed);
          }
        }catch(e){}
      });
      const seen=new Set();
      allQuestions=allQuestions.filter(q=>{
        const key=(q.class||'')+'|'+q.question;
        if(seen.has(key))return false;
        seen.add(key); return true;
      });
    }

    if(sRes.submissions){
      sRes.submissions.forEach(sub=>{
        let list;
        const raw2=sub.data||sub.raw_data; if(typeof raw2==='string') list=JSON.parse(raw2);
        else if(Array.isArray(raw2)) list=raw2;
        else if(sub.class&&sub.name) list=[sub];
        else return;
        list.forEach(s=>{
          if(!students[s.class]) students[s.class]=[];
          if(!students[s.class].includes(s.name)) students[s.class].push(s.name);
        });
      });
    }

    if(isTeacher&&results[2]) parseRecords(results[2]);
    if(allQuestions.length===0&&!isTeacher){ $('loading').querySelector('p').textContent='暂无题目数据'; return; }

    const selClass=$('sel-class');
    Object.keys(students).sort().forEach(c=>{
      const opt=document.createElement('option'); opt.value=c; opt.textContent=c+' 班';
      selClass.appendChild(opt);
    });

    const savedClass=localStorage.getItem('quiz_class');
    const savedName=localStorage.getItem('quiz_name');
    if(savedClass&&students[savedClass]){
      selClass.value=savedClass;
      selClass.dispatchEvent(new Event('change'));
      if(savedName){
        setTimeout(()=>{
          const selName=$('sel-name');
          if([...selName.options].some(o=>o.value===savedName)){
            selName.value=savedName;
            selName.dispatchEvent(new Event('change'));
          }
        },0);
      }
    }

    if(!isTeacher) loadRanking();
    $('loading').style.display='none';

    if(isTeacher){
      $('app-container').classList.add('teacher-container');
      showScreen('teacher');
      renderTeacherDashboard();
    } else {
      showScreen('select');
    }
  }catch(e){
    $('loading').querySelector('p').textContent='加载失败，请刷新重试';
    console.error(e);
  }
}

function parseRecords(data){
  allRecords=[];
  if(data.submissions){
    data.submissions.forEach(sub=>{
      if(sub.student_name&&sub.accuracy!==undefined){ allRecords.push(sub); }
      else if(typeof sub.raw_data==='string'){
        try{ const r=JSON.parse(sub.raw_data); if(r.student_name&&r.accuracy!==undefined) allRecords.push(r); }catch(e){}
      }
    });
  }
}

function buildChips(pool){
  const group=$('chip-group'); group.innerHTML='';
  if(!pool) pool=allQuestions;
  const total=pool.length;
  if(total===0){ $('total-info').textContent='⚠️ 该班级暂无题目'; $('btn-start').disabled=true; return; }
  const opts=[5,10,15,20].filter(n=>n<=total);
  if(selectedCount>total) selectedCount=opts.length>0?opts[opts.length-1]:total;
  if(!opts.includes(selectedCount)&&selectedCount!==total) selectedCount=opts.includes(10)?10:(opts[opts.length-1]||total);
  opts.forEach(n=>{
    const c=document.createElement('span');
    c.className='chip'+(n===selectedCount?' active':'');
    c.textContent=n+'题'; c.dataset.count=n;
    c.addEventListener('click',()=>{ selectedCount=n; updateChips(); });
    group.appendChild(c);
  });
  if(!opts.includes(total)){
    const ac=document.createElement('span');
    ac.className='chip'+(selectedCount===total?' active':'');
    ac.textContent='全部('+total+'题)'; ac.dataset.count=total;
    ac.addEventListener('click',()=>{ selectedCount=total; updateChips(); });
    group.appendChild(ac);
  }
  $('total-info').textContent='本班题库共 '+total+' 题，每次随机抽取';
}

function updateChips(){ document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',parseInt(c.dataset.count)===selectedCount)); }

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('screen-'+name).classList.add('active');
  window.scrollTo(0,0);
}
function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

// ===== Select =====
$('sel-class').addEventListener('change',function(){
  currentClass=this.value;
  localStorage.setItem('quiz_class',currentClass);
  const sn=$('sel-name'); sn.innerHTML='<option value="">请选择姓名</option>';
  if(currentClass&&students[currentClass]){
    students[currentClass].sort().forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; sn.appendChild(o); });
    sn.disabled=false;
  } else sn.disabled=true;
  $('btn-start').disabled=true;
  if(currentClass){
    classQuestions=allQuestions.filter(q=>q.class===currentClass);
    buildChips(classQuestions);
  } else { classQuestions=[]; $('chip-group').innerHTML=''; $('total-info').textContent=''; }
});
$('sel-name').addEventListener('change',function(){ currentName=this.value; localStorage.setItem('quiz_name',currentName); $('btn-start').disabled=!currentName||classQuestions.length===0; });
$('btn-start').addEventListener('click',startQuiz);

// ===== Quiz =====
function shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; }

function startQuiz(){
  if(classQuestions.length===0){ showToast('该班级暂无题目'); return; }
  quizQuestions=shuffle(classQuestions).slice(0,Math.min(selectedCount,classQuestions.length));
  currentIdx=0; answers=[]; startTime=Date.now();
  if(timerInterval) clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    const e=Math.floor((Date.now()-startTime)/1000);
    $('timer-text').textContent=String(Math.floor(e/60)).padStart(2,'0')+':'+String(e%60).padStart(2,'0');
  },1000);
  showScreen('quiz'); renderQuestion();
}

function renderQuestion(){
  const q=quizQuestions[currentIdx], total=quizQuestions.length;
  $('progress-fill').style.width=(currentIdx/total*100)+'%';
  $('progress-label').textContent='第 '+(currentIdx+1)+' 题';
  $('progress-count').textContent=currentIdx+' / '+total;
  $('q-num').textContent='第'+(currentIdx+1)+'题';
  $('q-text').textContent=q.question;
  const oc=$('q-options'); oc.innerHTML='';
  ['A','B','C','D'].forEach(k=>{
    if(!q[k]) return;
    const btn=document.createElement('button'); btn.className='option';
    btn.innerHTML='<span class="opt-label">'+k+'</span><span>'+q[k]+'</span>';
    btn.dataset.key=k; btn.addEventListener('click',()=>selectAnswer(k));
    oc.appendChild(btn);
  });
  $('q-explanation').className='explanation'; $('q-explanation').innerHTML='';
  $('next-wrap').style.display='none';
  questionStartTime=Date.now();
  $('quiz-card').style.animation='none'; $('quiz-card').offsetHeight; $('quiz-card').style.animation='fadeUp .3s ease';
}

function selectAnswer(key){
  const q=quizQuestions[currentIdx], ok=key===q.answer, ms=Date.now()-questionStartTime;
  answers.push({ questionIndex:currentIdx+1, question:q.question, selected:key, selectedText:q[key], correct:q.answer, correctText:q[q.answer], isCorrect:ok, timeMs:ms, explanation:q.explanation||'' });
  playSound(ok);
  document.querySelectorAll('.option').forEach(b=>{
    const k=b.dataset.key;
    if(k===q.answer) b.classList.add('correct');
    else if(k===key&&!ok) b.classList.add('wrong');
    else b.classList.add('disabled');
  });
  const ex=$('q-explanation');
  if(ok){ ex.className='explanation correct-exp show'; ex.innerHTML='<span>✅</span> 回答正确！'+(q.explanation?'<br>'+q.explanation:''); }
  else{ ex.className='explanation wrong-exp show'; ex.innerHTML='<span>❌</span> 正确答案是 <b>'+q.answer+'</b>'+(q.explanation?'<br>'+q.explanation:''); }
  $('next-wrap').style.display='block';
  $('btn-next').textContent=currentIdx>=quizQuestions.length-1?'查看成绩 🎯':'下一题 →';
}

$('btn-next').addEventListener('click',()=>{ currentIdx++; if(currentIdx>=quizQuestions.length) finishQuiz(); else renderQuestion(); });

// ===== Finish =====
async function finishQuiz(){
  if(timerInterval) clearInterval(timerInterval);
  const tt=Date.now()-startTime, tq=quizQuestions.length, cc=answers.filter(a=>a.isCorrect).length;
  const wc=tq-cc, acc=Math.round(cc/tq*100), ts=Math.floor(tt/1000);
  showScreen('result');
  $('result-player').textContent=currentClass+' 班 · '+currentName;
  $('stat-total').textContent=tq; $('stat-correct').textContent=cc; $('stat-wrong').textContent=wc;
  const mm=Math.floor(ts/60),ss=ts%60;
  $('stat-time').textContent=(mm>0?mm+'分':'')+ss+'秒';
  $('stat-avg').textContent=(tq>0?(ts/tq).toFixed(1):'-')+'秒';

  const circ=2*Math.PI*62, off=circ-(acc/100)*circ;
  $('score-ring').style.transition='none'; $('score-ring').style.strokeDashoffset=circ;
  setTimeout(()=>{
    $('score-ring').style.transition='stroke-dashoffset 1s ease'; $('score-ring').style.strokeDashoffset=off;
    $('score-ring').setAttribute('stroke', acc>=80?'#10B981':acc>=60?'#F59E0B':'#EF4444');
  },50);
  animateNum($('score-num'),0,acc,1000,v=>v+'%');

  if(acc===100) $('result-greeting').textContent='🏆 满分！太厉害了！';
  else if(acc>=80) $('result-greeting').textContent='🎉 表现优秀！';
  else if(acc>=60) $('result-greeting').textContent='👍 继续加油！';
  else $('result-greeting').textContent='💪 多多练习哦！';

  const ws=$('wrong-section'); ws.innerHTML='';
  const wrongs=answers.filter(a=>!a.isCorrect);
  if(wrongs.length>0){
    let h='<div class="card"><div class="wrong-title">❌ 错题回顾（'+wrongs.length+'题）</div>';
    wrongs.forEach((w,i)=>{ h+='<div class="wrong-item"><div class="wi-q">'+(i+1)+'. '+w.question+'</div><div class="wi-ans">你的答案：'+w.selected+'. '+w.selectedText+'</div><div class="wi-correct">正确答案：'+w.correct+'. '+w.correctText+'</div>'+(w.explanation?'<div class="wi-exp">💡 '+w.explanation+'</div>':'')+'</div>'; });
    h+='</div>'; ws.innerHTML=h;
  }

  const record={ student_class:currentClass, student_name:currentName, total_questions:tq, correct_count:cc, wrong_count:wc, accuracy:acc, total_time_sec:ts, submit_time:new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}), details:answers.map(a=>({question:a.question,selected:a.selected,selected_text:a.selectedText||'',correct:a.correct,correct_text:a.correctText||'',is_correct:a.isCorrect,time_sec:(a.timeMs/1000).toFixed(1)})) };
  try{
    await fetch(API.records.post,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
    await loadRanking();
    const mr=findMyRank(); $('stat-rank').textContent=mr>0?'第'+mr+'名':'-';
  }catch(e){ showToast('成绩提交失败'); }
}

function animateNum(el,from,to,dur,fmt){
  const s=performance.now();
  (function tick(now){ const t=Math.min((now-s)/dur,1); el.textContent=fmt?fmt(Math.round(from+(to-from)*(1-Math.pow(1-t,3)))):Math.round(from+(to-from)*(1-Math.pow(1-t,3))); if(t<1)requestAnimationFrame(tick); })(performance.now());
}

// ===== Ranking (composite score) =====
async function loadRanking(){
  try{ const d=await fetch(API.records.read).then(r=>r.json()); parseRecords(d); }catch(e){}
}

// Cumulative stats: aggregate all records per student
function cumulativeMap(recs){
  const m={};
  recs.forEach(r=>{
    if(!r.student_name||r.accuracy===undefined) return;
    const k=(r.student_class||'')+'|'+r.student_name;
    if(!m[k]) m[k]={ student_class:r.student_class||'', student_name:r.student_name, total_questions:0, correct_count:0, total_time_sec:0, sessions:0 };
    const c=m[k];
    c.total_questions+=(r.total_questions||0);
    c.correct_count+=(r.correct_count||0);
    c.total_time_sec+=(r.total_time_sec||0);
    c.sessions++;
  });
  // Calculate cumulative accuracy
  Object.values(m).forEach(c=>{
    c.wrong_count=c.total_questions-c.correct_count;
    c.accuracy=c.total_questions>0?Math.round(c.correct_count/c.total_questions*100):0;
  });
  return m;
}

function findMyRank(){
  const sorted=Object.values(cumulativeMap(allRecords)).sort((a,b)=>{
    const sa=compositeScore(a), sb=compositeScore(b);
    return sb!==sa?sb-sa:b.accuracy-a.accuracy;
  });
  for(let i=0;i<sorted.length;i++) if(sorted[i].student_name===currentName&&sorted[i].student_class===currentClass) return i+1;
  return 0;
}

function showRanking(from){
  cameFrom=from||'select'; showScreen('ranking');
  $('rank-update-time').textContent=allRecords.length>0?'共 '+allRecords.length+' 条答题记录 · 综合排名':'';
  const classes=[...new Set(allRecords.filter(r=>r.student_class).map(r=>r.student_class))].sort();
  const tabs=$('rank-tabs'); tabs.innerHTML='';
  const at=document.createElement('button'); at.className='rank-tab active'; at.textContent='全部'; at.dataset.cls='__all__';
  at.addEventListener('click',()=>switchTab('__all__')); tabs.appendChild(at);
  classes.forEach(c=>{ const t=document.createElement('button'); t.className='rank-tab'; t.textContent=c+'班'; t.dataset.cls=c; t.addEventListener('click',()=>switchTab(c)); tabs.appendChild(t); });
  renderRank('__all__');
}

function switchTab(c){ document.querySelectorAll('.rank-tab').forEach(t=>t.classList.toggle('active',t.dataset.cls===c)); renderRank(c); }

function renderRank(cls){
  const filtered=cls==='__all__'?[...allRecords]:allRecords.filter(r=>r.student_class===cls);
  const sorted=Object.values(cumulativeMap(filtered)).sort((a,b)=>{
    const sa=compositeScore(a), sb=compositeScore(b);
    return sb!==sa?sb-sa:b.accuracy-a.accuracy;
  });
  const list=$('rank-list');
  if(!sorted.length){ list.innerHTML='<div class="empty-rank"><div class="icon">🏆</div><p>暂无答题记录</p></div>'; return; }
  list.innerHTML=sorted.map((r,i)=>{
    const pc=i===0?'gold':i===1?'silver':i===2?'bronze':'';
    const md=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
    const me=r.student_name===currentName&&r.student_class===currentClass;
    const ts=r.total_time_sec, tt=ts?(ts>=60?Math.floor(ts/60)+'分'+(ts%60)+'秒':ts+'秒'):'-';
    const cs=compositeScore(r);
    return '<div class="rank-item'+(me?' rank-me':'')+'"><div class="rank-pos '+pc+'">'+md+'</div><div class="rank-info"><div class="rank-name">'+r.student_name+(me?' (我)':'')+'</div><div class="rank-meta">'+(r.student_class||'')+'班 · 累计'+r.total_questions+'题 · '+r.correct_count+'/'+r.total_questions+'对 · 用时'+tt+'</div></div><div class="rank-score-wrap"><div class="rank-score">'+cs+'<span style="font-size:12px;font-weight:400;color:var(--gray-500);">分</span></div><div class="rank-score-sub">正确率 '+r.accuracy+'%</div></div></div>';
  }).join('');
}

$('btn-ranking').addEventListener('click',()=>showRanking('result'));
$('btn-view-rank').addEventListener('click',async()=>{ if(!allRecords.length) await loadRanking(); showRanking('select'); });
$('btn-back').addEventListener('click',()=>{
  if(isTeacher&&cameFrom==='teacher') showScreen('teacher');
  else if(cameFrom==='result') showScreen('result');
  else showScreen('select');
});
$('btn-retry').addEventListener('click',()=>{ showScreen('select'); });