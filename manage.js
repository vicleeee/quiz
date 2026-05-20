// ===== Question Management =====
function escH(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s){ return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function renderQuestionMgmt(){
  const search=($('q-search')?$('q-search').value:'').toLowerCase();
  const fc=$('q-filter-class');
  const currentVal=fc.value;
  const qClasses=[...new Set(allQuestions.map(q=>q.class).filter(Boolean))].sort();
  fc.innerHTML='<option value="__all__">全部班级</option>';
  qClasses.forEach(c=>{ fc.appendChild(Object.assign(document.createElement('option'),{value:c,textContent:c+'班'})); });
  fc.value=qClasses.includes(currentVal)?currentVal:'__all__';

  let filtered=allQuestions;
  if(fc.value!=='__all__') filtered=filtered.filter(q=>q.class===fc.value);
  if(search) filtered=filtered.filter(q=>(q.question||'').toLowerCase().includes(search)||(q.class||'').toLowerCase().includes(search));

  $('q-count-info').textContent='共 '+allQuestions.length+' 题'+(filtered.length!==allQuestions.length?'，显示 '+filtered.length+' 题':'');
  const el=$('q-list');
  if(!filtered.length){ el.innerHTML='<div class="empty-rank"><div class="icon">📝</div><p>暂无题目</p></div>'; return; }

  el.innerHTML=filtered.map(q=>{
    const ri=allQuestions.indexOf(q);
    const checked=selectedQIndices.has(ri)?'checked':'';
    const selCls=selectedQIndices.has(ri)?'selected':'';
    const opts=['A','B','C','D'].filter(k=>q[k]).map(k=>'<span'+(k===q.answer?' style="color:var(--success);font-weight:700;"':'')+'>'+k+'.'+escH(q[k])+'</span>').join(' &nbsp;');
    return '<div class="q-item '+selCls+'"><div class="q-header"><input type="checkbox" class="q-check" data-idx="'+ri+'" '+checked+' onchange="toggleQSelect('+ri+')"><div class="q-body"><div class="q-title"><span class="q-cls">'+escH(q.class||'未分类')+'</span>'+escH(q.question)+'</div><div class="q-opts">'+opts+'</div>'+(q.explanation?'<div style="font-size:12px;color:var(--gray-500);">💡 '+escH(q.explanation)+'</div>':'')+'</div><div class="q-actions"><button class="mgmt-btn" onclick="editQuestion('+ri+')">✏️</button><button class="mgmt-btn danger" onclick="deleteQuestion('+ri+')">🗑️</button></div></div></div>';
  }).join('');
  updateBatchBtn();
}

function toggleQSelect(idx){
  if(selectedQIndices.has(idx)) selectedQIndices.delete(idx); else selectedQIndices.add(idx);
  updateBatchBtn();
  document.querySelectorAll('.q-check').forEach(cb=>{
    if(parseInt(cb.dataset.idx)===idx) cb.closest('.q-item').classList.toggle('selected',selectedQIndices.has(idx));
  });
}

function toggleSelectAllQ(){
  const all=$('q-select-all').checked;
  const search=($('q-search')?$('q-search').value:'').toLowerCase();
  const clsFilter=$('q-filter-class')?$('q-filter-class').value:'__all__';
  let filtered=allQuestions;
  if(clsFilter!=='__all__') filtered=filtered.filter(q=>q.class===clsFilter);
  if(search) filtered=filtered.filter(q=>(q.question||'').toLowerCase().includes(search)||(q.class||'').toLowerCase().includes(search));
  if(all){ filtered.forEach(q=>selectedQIndices.add(allQuestions.indexOf(q))); }
  else { selectedQIndices.clear(); }
  renderQuestionMgmt();
}

function updateBatchBtn(){
  const btn=$('q-batch-del');
  if(btn){ btn.disabled=selectedQIndices.size===0; btn.textContent='🗑️ 批量删除'+(selectedQIndices.size>0?' ('+selectedQIndices.size+')':''); }
}

function editQuestion(idx){
  editingQIdx=idx;
  const q=allQuestions[idx];
  $('edit-q-title').textContent='编辑题目';
  $('eq-class').value=q.class||'';
  $('eq-question').value=q.question||'';
  $('eq-A').value=q.A||'';
  $('eq-B').value=q.B||'';
  $('eq-C').value=q.C||'';
  $('eq-D').value=q.D||'';
  $('eq-answer').value=q.answer||'A';
  $('eq-explanation').value=q.explanation||'';
  $('modal-edit-q').classList.add('show');
}

async function saveQuestionEdit(){
  const q=allQuestions[editingQIdx];
  q.class=$('eq-class').value.trim();
  q.question=$('eq-question').value.trim();
  q.A=$('eq-A').value.trim();
  q.B=$('eq-B').value.trim();
  q.C=$('eq-C').value.trim();
  const dVal=$('eq-D').value.trim();
  if(dVal) q.D=dVal; else delete q.D;
  q.answer=$('eq-answer').value;
  q.explanation=$('eq-explanation').value.trim();
  closeModal('modal-edit-q');
  await syncQuestions('保存题目...');
  renderQuestionMgmt();
}

function deleteQuestion(idx){
  showConfirm('确定删除这道题吗？<br><b>'+escH(allQuestions[idx].question).substring(0,60)+'</b>',async()=>{
    allQuestions.splice(idx,1);
    selectedQIndices.delete(idx);
    const newSet=new Set();
    selectedQIndices.forEach(i=>{ if(i<idx) newSet.add(i); else if(i>idx) newSet.add(i-1); });
    selectedQIndices=newSet;
    await syncQuestions('删除题目...');
    renderQuestionMgmt();
  });
}

async function batchDeleteQuestions(){
  showConfirm('确定删除选中的 <b>'+selectedQIndices.size+'</b> 道题吗？<br>此操作不可撤销！',async()=>{
    [...selectedQIndices].sort((a,b)=>b-a).forEach(i=>allQuestions.splice(i,1));
    selectedQIndices.clear();
    await syncQuestions('批量删除...');
    renderQuestionMgmt();
  });
}

async function syncQuestions(msg){
  showLoading(msg||'同步题库...');
  try{
    // clear 接口无 CORS 头，用 no-cors 模式（请求会执行但无法读响应）
    await fetch(API.questions.clear,{mode:'no-cors'});
    // 等待一小段时间确保清空生效
    await new Promise(r=>setTimeout(r,500));
    // 重新提交所有题目
    if(allQuestions.length>0){
      const resp=await fetch(API.questions.post,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(allQuestions)});
      const result=await resp.json();
      if(result.status!=='success') throw new Error(result.message||'提交失败');
    }
    showToast('✅ 题库已同步');
  }catch(e){ showToast('❌ 同步失败: '+e.message); console.error(e); }
  hideLoading();
}

// ===== Class Management =====
function renderClassMgmt(){
  const classes=Object.keys(students).sort();
  const totalStu=classes.reduce((s,c)=>s+students[c].length,0);
  $('cls-count-info').textContent='共 '+classes.length+' 个班级，'+totalStu+' 名学员';
  const el=$('cls-list');
  if(!classes.length){ el.innerHTML='<div class="empty-rank"><div class="icon">🏫</div><p>暂无班级数据</p></div>'; return; }

  el.innerHTML=classes.map(c=>{
    const stuList=students[c].sort();
    const ec=escAttr(c);
    return '<div class="cls-card"><div class="cls-header"><div><span class="cls-name">'+escH(c)+' 班</span> <span class="cls-count">('+stuList.length+'人)</span></div><div style="display:flex;gap:6px;flex-wrap:wrap;"><button class="mgmt-btn" onclick="renameClass(\''+ec+'\')">✏️ 改名</button><button class="mgmt-btn" onclick="addStudentToClass(\''+ec+'\')">➕ 添加</button><button class="mgmt-btn danger" onclick="deleteClass(\''+ec+'\')">🗑️ 删除班级</button></div></div><div style="display:flex;flex-wrap:wrap;">'+
    stuList.map(n=>{
      const en=escAttr(n);
      return '<span class="stu-tag"><span>'+escH(n)+'</span><span class="stu-edit" onclick="editStudent(\''+ec+'\',\''+en+'\')">✏️</span><span class="stu-del" onclick="deleteStudent(\''+ec+'\',\''+en+'\')">&times;</span></span>';
    }).join('')+
    '</div></div>';
  }).join('');
}

function showAddClassModal(){
  $('ac-name').value='';
  $('ac-students').value='';
  $('modal-add-class').classList.add('show');
}

async function saveNewClass(){
  const name=$('ac-name').value.trim();
  const stuText=$('ac-students').value.trim();
  if(!name){ showToast('请输入班级名称'); return; }
  if(!students[name]) students[name]=[];
  stuText.split('\n').map(s=>s.trim()).filter(Boolean).forEach(n=>{ if(!students[name].includes(n)) students[name].push(n); });
  closeModal('modal-add-class');
  await syncStudents('创建班级...');
  renderClassMgmt();
}

function renameClass(oldName){
  const newName=prompt('请输入新的班级名称：',oldName);
  if(!newName||newName.trim()===oldName) return;
  const trimmed=newName.trim();
  if(students[trimmed]){ showToast('该班级名已存在'); return; }
  students[trimmed]=students[oldName];
  delete students[oldName];
  allQuestions.forEach(q=>{ if(q.class===oldName) q.class=trimmed; });
  Promise.all([syncStudents('重命名班级...'),syncQuestions('同步题库...')]);
  renderClassMgmt();
}

function addStudentToClass(cls){
  const name=prompt('请输入学员姓名：');
  if(!name||!name.trim()) return;
  if(students[cls]&&students[cls].includes(name.trim())){ showToast('该学员已存在'); return; }
  if(!students[cls]) students[cls]=[];
  students[cls].push(name.trim());
  syncStudents('添加学员...');
  renderClassMgmt();
}

function editStudent(cls,name){
  editingStuKey={cls,name};
  $('edit-stu-title').textContent='编辑学员';
  $('es-class').value=cls;
  $('es-name').value=name;
  $('modal-edit-stu').classList.add('show');
}

async function saveStudentEdit(){
  const newCls=$('es-class').value.trim();
  const newName=$('es-name').value.trim();
  if(!newCls||!newName){ showToast('班级和姓名不能为空'); return; }
  const {cls:oldCls,name:oldName}=editingStuKey;
  if(students[oldCls]){
    students[oldCls]=students[oldCls].filter(n=>n!==oldName);
    if(!students[oldCls].length) delete students[oldCls];
  }
  if(!students[newCls]) students[newCls]=[];
  if(!students[newCls].includes(newName)) students[newCls].push(newName);
  closeModal('modal-edit-stu');
  await syncStudents('保存学员...');
  renderClassMgmt();
}

function deleteStudent(cls,name){
  showConfirm('确定删除 <b>'+escH(cls)+'班</b> 的 <b>'+escH(name)+'</b> 吗？',async()=>{
    if(students[cls]){
      students[cls]=students[cls].filter(n=>n!==name);
      if(!students[cls].length) delete students[cls];
    }
    await syncStudents('删除学员...');
    renderClassMgmt();
  });
}

function deleteClass(cls){
  showConfirm('确定删除 <b>'+escH(cls)+' 班</b> 及其所有 <b>'+((students[cls]||[]).length)+'</b> 名学员吗？',async()=>{
    delete students[cls];
    await syncStudents('删除班级...');
    renderClassMgmt();
  });
}

async function syncStudents(msg){
  showLoading(msg||'同步学员...');
  try{
    const data=[];
    Object.keys(students).sort().forEach(cls=>{
      students[cls].sort().forEach(name=>data.push({class:cls,name:name}));
    });
    // clear 接口无 CORS 头，用 no-cors 模式
    await fetch(API.students.clear,{mode:'no-cors'});
    await new Promise(r=>setTimeout(r,500));
    if(data.length>0){
      const resp=await fetch(API.students.post,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result=await resp.json();
      if(result.status!=='success') throw new Error(result.message||'提交失败');
    }
    showToast('✅ 学员已同步');
  }catch(e){ showToast('❌ 同步失败: '+e.message); console.error(e); }
  hideLoading();
}

// ===== Modals & Confirm =====
function closeModal(id){ $(id).classList.remove('show'); }
function showConfirm(msg,onYes){
  const el=$('confirm-dialog');
  el.style.display='block';
  el.innerHTML='<div class="confirm-overlay" onclick="if(event.target===this)closeConfirm()"><div class="confirm-box"><div class="confirm-icon">⚠️</div><div class="confirm-msg">'+msg+'</div><div class="confirm-actions"><button class="mgmt-btn" onclick="closeConfirm()">取消</button><button class="mgmt-btn danger" id="confirm-yes-btn">确定</button></div></div></div>';
  $('confirm-yes-btn').onclick=()=>{ closeConfirm(); onYes(); };
}
function closeConfirm(){ $('confirm-dialog').style.display='none'; $('confirm-dialog').innerHTML=''; }
function showLoading(msg){ $('loading-mask-text').textContent=msg||'处理中...'; $('loading-mask').style.display='flex'; }
function hideLoading(){ $('loading-mask').style.display='none'; }

// ===== Import Functions =====
function toggleTextImport(type){
  const el=$('text-import-'+type);
  el.style.display=el.style.display==='none'?'block':'none';
}

function downloadTemplate(type){
  let csv='';
  if(type==='students') csv='\uFEFF班级,姓名\n北大,张三\n北大,李四\n科大,王五\n';
  else csv='\uFEFF班级,题目,A选项,B选项,C选项,答案,解析\n北大,She ____ from Brazil.,am,is,are,B,She是第三人称单数 be动词用is\n北大,I ____ hungry.,is,am,are,B,I搭配am\n';
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=type==='students'?'学生名单模板.csv':'题库模板.csv'; a.click(); URL.revokeObjectURL(a.href);
  showToast('模板已下载');
}

function parseCSVLine(line){
  const result=[]; let current=''; let inQuotes=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(inQuotes){ if(ch==='"'&&line[i+1]==='"'){current+='"';i++;} else if(ch==='"'){inQuotes=false;} else{current+=ch;} }
    else{ if(ch==='"'){inQuotes=true;} else if(ch===','){ result.push(current.trim()); current=''; } else{current+=ch;} }
  }
  result.push(current.trim());
  return result;
}
function parseCSVText(text){ return text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l).map(parseCSVLine); }

async function handleFileImport(type, input){
  const file=input.files[0]; if(!file) return;
  const statusEl=$('import-status-'+type);
  statusEl.textContent='正在读取文件...'; statusEl.style.color='var(--gray-500)';
  try{
    if(!file.name.endsWith('.csv')&&!file.name.endsWith('.txt')) throw new Error('请使用CSV格式导入');
    const text=await file.text();
    const rows=parseCSVText(text);
    if(rows.length<2){ statusEl.textContent='❌ 文件为空或格式不对'; statusEl.style.color='var(--danger)'; return; }
    const header=rows[0].map(h=>(h||'').toString().trim().toLowerCase());
    const dataRows=rows.slice(1).filter(r=>r.some(c=>c&&c.toString().trim()));
    if(type==='students') await importStudents(dataRows,header,statusEl);
    else await importQuestions(dataRows,header,statusEl);
  }catch(e){ statusEl.textContent='❌ '+e.message; statusEl.style.color='var(--danger)'; }
  input.value='';
}

async function submitTextImport(type){
  const text=$('textarea-'+type).value.trim();
  const statusEl=$('import-status-'+type);
  if(!text){ showToast('请输入数据'); return; }
  const rows=parseCSVText(text);
  if(!rows.length){ statusEl.textContent='❌ 无有效数据'; statusEl.style.color='var(--danger)'; return; }
  let dataRows=rows;
  const first=rows[0].map(c=>(c||'').toLowerCase());
  if(first.includes('班级')||first.includes('class')||first.includes('姓名')||first.includes('question')||first.includes('题目')) dataRows=rows.slice(1);
  if(type==='students') await importStudents(dataRows,[],statusEl);
  else await importQuestions(dataRows,[],statusEl);
  $('textarea-'+type).value='';
}

async function importStudents(dataRows, header, statusEl){
  statusEl.textContent='正在处理...'; statusEl.style.color='var(--gray-500)';
  let clsIdx=0, nameIdx=1;
  if(header.length>0){
    const ci=header.findIndex(h=>h.includes('班级')||h==='class');
    const ni=header.findIndex(h=>h.includes('姓名')||h==='name'||h.includes('名'));
    if(ci>=0) clsIdx=ci; if(ni>=0) nameIdx=ni;
  }
  const data=[];
  dataRows.forEach(r=>{
    const cls=(r[clsIdx]||'').toString().trim();
    const name=(r[nameIdx]||'').toString().trim();
    if(cls&&name) data.push({class:cls,name:name});
  });
  if(!data.length){ statusEl.textContent='❌ 未找到有效数据'; statusEl.style.color='var(--danger)'; return; }
  try{
    const resp=await fetch(API.students.post,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await resp.json();
    if(result.status==='success'){
      statusEl.innerHTML='✅ 导入 <b>'+data.length+'</b> 名学生，<a href="javascript:location.reload()" style="color:var(--primary);">刷新页面</a>生效';
      statusEl.style.color='var(--success)';
    } else { statusEl.textContent='❌ '+(result.message||'未知错误'); statusEl.style.color='var(--danger)'; }
  }catch(e){ statusEl.textContent='❌ '+e.message; statusEl.style.color='var(--danger)'; }
}

async function importQuestions(dataRows, header, statusEl){
  statusEl.textContent='正在处理...'; statusEl.style.color='var(--gray-500)';
  let clsIdx=0, qIdx=1, aIdx=2, bIdx=3, cIdx=4, ansIdx=5, expIdx=6;
  if(header.length>0){
    const find=kw=>header.findIndex(h=>kw.some(k=>h.includes(k)));
    const ci=find(['班级','class']); if(ci>=0) clsIdx=ci;
    const qi=find(['题目','question','题干']); if(qi>=0) qIdx=qi;
    const ai=find(['a选项','a']); if(ai>=0) aIdx=ai;
    const bi=find(['b选项','b']); if(bi>=0) bIdx=bi;
    const cci=find(['c选项','c']); if(cci>=0) cIdx=cci;
    const ansi=find(['答案','answer','正确答案']); if(ansi>=0) ansIdx=ansi;
    const expi=find(['解析','explanation','解释']); if(expi>=0) expIdx=expi;
  }
  const data=[];
  dataRows.forEach(r=>{
    const cls=(r[clsIdx]||'').toString().trim();
    const question=(r[qIdx]||'').toString().trim();
    const A=(r[aIdx]||'').toString().trim();
    const B=(r[bIdx]||'').toString().trim();
    const C=(r[cIdx]||'').toString().trim();
    const answer=(r[ansIdx]||'').toString().trim().toUpperCase();
    const explanation=(r[expIdx]||'').toString().trim();
    if(cls&&question&&A&&B&&C&&['A','B','C','D'].includes(answer)){
      const q={question,A,B,C,answer,explanation,class:cls};
      if(r.length>7){ const D=(r[7]||'').toString().trim(); if(D) q.D=D; }
      data.push(q);
    }
  });
  if(!data.length){ statusEl.textContent='❌ 未找到有效题目'; statusEl.style.color='var(--danger)'; return; }
  try{
    const resp=await fetch(API.questions.post,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await resp.json();
    if(result.status==='success'){
      statusEl.innerHTML='✅ 导入 <b>'+data.length+'</b> 道题，<a href="javascript:location.reload()" style="color:var(--primary);">刷新页面</a>生效';
      statusEl.style.color='var(--success)';
    } else { statusEl.textContent='❌ '+(result.message||'未知错误'); statusEl.style.color='var(--danger)'; }
  }catch(e){ statusEl.textContent='❌ '+e.message; statusEl.style.color='var(--danger)'; }
}

// Keyboard
document.addEventListener('keydown',e=>{
  if(!$('screen-quiz').classList.contains('active')) return;
  const map={a:'A',b:'B',c:'C',d:'D','1':'A','2':'B','3':'C','4':'D'};
  const k=map[e.key.toLowerCase()];
  if(k){ const b=document.querySelector('.option[data-key="'+k+'"]:not(.correct):not(.wrong):not(.disabled)'); if(b)b.click(); }
  if((e.key==='Enter'||e.key===' ')&&$('next-wrap').style.display!=='none'){ e.preventDefault(); $('btn-next').click(); }
});

// Click overlay to close modals
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',function(e){ if(e.target===this) this.classList.remove('show'); });
});

init();