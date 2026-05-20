// ===== Teacher Dashboard =====

// Time filter state
let timeFilterRange = 'all';
let timeFilterStart = null;
let timeFilterEnd = null;

function parseSubmitTime(str) {
  if (!str) return null;
  // Handle "2026/4/18 上午11:53:58" or "2026/4/18 下午3:26:43"
  let s = str.replace('上午', '').replace('下午', '').trim();
  // Handle PM indicator
  const isPM = str.includes('下午');
  // Try parsing as-is first
  let d = new Date(s);
  if (isNaN(d.getTime())) {
    // Try replacing / with -
    s = s.replace(/\//g, '-');
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return null;
  // Adjust for PM
  if (isPM && d.getHours() < 12) {
    d.setHours(d.getHours() + 12);
  }
  return d;
}

function getDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getFilteredRecords() {
  if (timeFilterRange === 'all') return allRecords;

  const now = new Date();
  let start, end;

  if (timeFilterRange === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (timeFilterRange === 'yesterday') {
    const yd = new Date(now);
    yd.setDate(yd.getDate() - 1);
    start = new Date(yd.getFullYear(), yd.getMonth(), yd.getDate());
    end = new Date(yd.getFullYear(), yd.getMonth(), yd.getDate(), 23, 59, 59, 999);
  } else if (timeFilterRange === 'week') {
    start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (timeFilterRange === 'custom') {
    if (!timeFilterStart || !timeFilterEnd) return allRecords;
    start = new Date(timeFilterStart + 'T00:00:00');
    end = new Date(timeFilterEnd + 'T23:59:59');
  } else {
    return allRecords;
  }

  return allRecords.filter(r => {
    const t = parseSubmitTime(r.submit_time || r.submitted_at);
    if (!t) return false;
    return t >= start && t <= end;
  });
}

function setTimeFilter(range) {
  timeFilterRange = range;
  // Update chip styles
  document.querySelectorAll('.time-chip').forEach(c => c.classList.toggle('active', c.dataset.range === range));
  // Show/hide custom range
  const customEl = $('time-custom-range');
  if (range === 'custom') {
    customEl.style.display = 'flex';
    // Set defaults
    if (!$('time-start').value) {
      const now = new Date();
      $('time-end').value = getDateStr(now);
      const wk = new Date(now); wk.setDate(wk.getDate() - 7);
      $('time-start').value = getDateStr(wk);
    }
    return; // Don't refresh until "确定" clicked
  } else {
    customEl.style.display = 'none';
  }
  refreshTeacherData();
}

function applyCustomDate() {
  timeFilterStart = $('time-start').value;
  timeFilterEnd = $('time-end').value;
  if (!timeFilterStart || !timeFilterEnd) { showToast('请选择日期范围'); return; }
  if (timeFilterStart > timeFilterEnd) { showToast('开始日期不能晚于结束日期'); return; }
  refreshTeacherData();
}

function updateTimeFilterInfo() {
  const filtered = getFilteredRecords();
  const el = $('time-filter-info');
  if (timeFilterRange === 'all') {
    el.textContent = '显示全部 ' + filtered.length + ' 条记录';
  } else if (timeFilterRange === 'today') {
    el.textContent = '今天 · ' + filtered.length + ' 条记录';
  } else if (timeFilterRange === 'yesterday') {
    el.textContent = '昨天 · ' + filtered.length + ' 条记录';
  } else if (timeFilterRange === 'week') {
    el.textContent = '近7天 · ' + filtered.length + ' 条记录';
  } else if (timeFilterRange === 'custom') {
    el.textContent = (timeFilterStart || '') + ' 至 ' + (timeFilterEnd || '') + ' · ' + filtered.length + ' 条记录';
  }
}

function refreshTeacherData() {
  updateTimeFilterInfo();
  renderTeacherStats();
  renderTeacherTable($('t-filter-class').value || '__all__');
}

function renderTeacherStats() {
  const filtered = getFilteredRecords().filter(r => r.student_name);
  const totalStudents = new Set(filtered.map(r => (r.student_class || '') + '|' + r.student_name)).size;
  const totalAttempts = filtered.length;
  const avgAcc = totalAttempts > 0 ? Math.round(filtered.filter(r => r.accuracy !== undefined).reduce((s, r) => s + r.accuracy, 0) / totalAttempts) : 0;
  $('teacher-stats').innerHTML =
    '<div class="t-stat"><div class="t-num">' + totalStudents + '</div><div class="t-label">参与学生</div></div>' +
    '<div class="t-stat"><div class="t-num">' + totalAttempts + '</div><div class="t-label">答题次数</div></div>' +
    '<div class="t-stat"><div class="t-num">' + avgAcc + '%</div><div class="t-label">平均正确率</div></div>';
}

function renderTeacherDashboard() {
  const fc = $('t-filter-class'); fc.innerHTML = '<option value="__all__">全部班级</option>';
  const efc = $('err-filter-class'); efc.innerHTML = '<option value="__all__">全部班级</option>';
  const classes = [...new Set(allRecords.filter(r => r.student_class).map(r => r.student_class))].sort();
  classes.forEach(c => {
    fc.appendChild(Object.assign(document.createElement('option'), { value: c, textContent: c + '班' }));
    efc.appendChild(Object.assign(document.createElement('option'), { value: c, textContent: c + '班' }));
  });
  refreshTeacherData();
}

$('t-filter-class').addEventListener('change', function () { renderTeacherTable(this.value); });

function renderTeacherTable(cls) {
  const timeFiltered = getFilteredRecords();
  const filtered = cls === '__all__' ? timeFiltered.filter(r => r.student_name) : timeFiltered.filter(r => r.student_name && r.student_class === cls);
  const map = {};
  filtered.forEach(r => {
    const k = (r.student_class || '') + '|' + r.student_name;
    if (!map[k]) map[k] = { name: r.student_name, cls: r.student_class || '', attempts: 0, bestAcc: 0, latestAcc: 0, totalTimeSec: 0, records: [] };
    const s = map[k]; s.attempts++; s.records.push(r);
    if (r.accuracy > s.bestAcc) s.bestAcc = r.accuracy;
    s.totalTimeSec += (r.total_time_sec || 0);
  });
  Object.values(map).forEach(s => {
    s.records.sort((a, b) => {
      const ta = parseSubmitTime(a.submit_time || a.submitted_at);
      const tb = parseSubmitTime(b.submit_time || b.submitted_at);
      return (tb || 0) - (ta || 0);
    });
    s.latestAcc = s.records[0].accuracy || 0;
  });
  const sorted = Object.values(map).sort((a, b) => b.bestAcc !== a.bestAcc ? b.bestAcc - a.bestAcc : (a.totalTimeSec / a.attempts) - (b.totalTimeSec / b.attempts));
  const tbody = $('teacher-tbody'); tbody.innerHTML = '';
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray-400);">' +
      (timeFilterRange === 'all' ? '暂无答题记录' : '该时间段内暂无答题记录') + '</td></tr>';
    return;
  }
  sorted.forEach((s, i) => {
    const accCls = s.bestAcc >= 80 ? 'acc-high' : s.bestAcc >= 60 ? 'acc-mid' : 'acc-low';
    const latCls = s.latestAcc >= 80 ? 'acc-high' : s.latestAcc >= 60 ? 'acc-mid' : 'acc-low';
    const avgT = s.attempts > 0 ? Math.round(s.totalTimeSec / s.attempts) + '秒' : '-';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + (i + 1) + '</td><td><b>' + s.name + '</b></td><td>' + s.cls + '班</td><td>' + s.attempts + '</td><td class="' + accCls + '">' + s.bestAcc + '%</td><td class="' + latCls + '">' + s.latestAcc + '%</td><td>' + avgT + '</td><td><button class="detail-btn" data-key="' + s.cls + '|' + s.name + '">详情</button></td>';
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.detail-btn').forEach(btn => { btn.addEventListener('click', () => showStudentDetail(btn.dataset.key)); });
}

// Track current detail state for filter toggle
let _detailKey = '';
let _detailOnlyWrong = false;

function showStudentDetail(key, onlyWrong) {
  _detailKey = key;
  _detailOnlyWrong = !!onlyWrong;

  const timeFiltered = getFilteredRecords();
  const recs = timeFiltered.filter(r => (r.student_class || '') + '|' + r.student_name === key).sort((a, b) => {
    const ta = parseSubmitTime(a.submit_time || a.submitted_at);
    const tb = parseSubmitTime(b.submit_time || b.submitted_at);
    return (tb || 0) - (ta || 0);
  });
  if (!recs.length) return;
  const name = recs[0].student_name, cls = recs[0].student_class || '';

  // Time range label
  let timeLabel = '';
  if (timeFilterRange === 'today') timeLabel = '（今天）';
  else if (timeFilterRange === 'yesterday') timeLabel = '（昨天）';
  else if (timeFilterRange === 'week') timeLabel = '（近7天）';
  else if (timeFilterRange === 'custom') timeLabel = '（' + (timeFilterStart || '') + ' 至 ' + (timeFilterEnd || '') + '）';

  $('modal-title').textContent = cls + '班 · ' + name + ' 的答题记录' + timeLabel + '（共' + recs.length + '次）';

  // Calculate summary stats
  const totalAttempts = recs.length;
  const avgAcc = Math.round(recs.reduce((s, r) => s + (r.accuracy || 0), 0) / totalAttempts);
  const bestAcc = Math.max(...recs.map(r => r.accuracy || 0));
  const totalCorrect = recs.reduce((s, r) => s + (r.correct_count || 0), 0);
  const totalQ = recs.reduce((s, r) => s + (r.total_questions || 0), 0);
  const totalWrong = totalQ - totalCorrect;

  let html = '';

  // Summary card
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">';
  html += '<div style="text-align:center;padding:10px;background:var(--primary-bg);border-radius:8px;"><div style="font-size:20px;font-weight:800;color:var(--primary);">' + totalAttempts + '</div><div style="font-size:11px;color:var(--gray-500);">答题次数</div></div>';
  html += '<div style="text-align:center;padding:10px;background:var(--success-bg);border-radius:8px;"><div style="font-size:20px;font-weight:800;color:var(--success);">' + avgAcc + '%</div><div style="font-size:11px;color:var(--gray-500);">平均正确率</div></div>';
  html += '<div style="text-align:center;padding:10px;background:#DBEAFE;border-radius:8px;"><div style="font-size:20px;font-weight:800;color:#2563EB;">' + bestAcc + '%</div><div style="font-size:11px;color:var(--gray-500);">最高正确率</div></div>';
  html += '<div style="text-align:center;padding:10px;background:var(--gray-100);border-radius:8px;"><div style="font-size:20px;font-weight:800;color:var(--gray-700);">' + totalCorrect + '/' + totalQ + '</div><div style="font-size:11px;color:var(--gray-500);">总答对/总题数</div></div>';
  html += '</div>';

  // Filter toggle bar: 全部题目 / 只看错题
  const allActive = !_detailOnlyWrong ? 'filter-toggle-active' : '';
  const wrongActive = _detailOnlyWrong ? 'filter-toggle-active' : '';
  html += '<div class="detail-filter-bar">';
  html += '<button class="detail-filter-btn ' + allActive + '" onclick="showStudentDetail(\'' + key.replace(/'/g, "\\'") + '\', false)">全部题目</button>';
  html += '<button class="detail-filter-btn ' + wrongActive + '" onclick="showStudentDetail(\'' + key.replace(/'/g, "\\'") + '\', true)">只看错题 <span class="wrong-count-badge">' + totalWrong + '</span></button>';
  if (_detailOnlyWrong && totalWrong > 0) {
    html += '<button class="detail-copy-btn" onclick="copyWrongQuestions(\'' + key.replace(/'/g, "\\'") + '\')">📋 一键复制错题</button>';
  }
  html += '</div>';

  // Check if filtering results in empty
  let hasWrong = false;
  if (_detailOnlyWrong) {
    recs.forEach(r => { if (r.details) r.details.forEach(d => { if (!d.is_correct) hasWrong = true; }); });
  }

  if (_detailOnlyWrong && !hasWrong) {
    html += '<div style="text-align:center;padding:40px 20px;color:var(--gray-400);"><div style="font-size:36px;margin-bottom:8px;">🎉</div><div>该学生没有错题，全部答对！</div></div>';
    $('modal-content').innerHTML = html;
    $('modal-detail').classList.add('show');
    return;
  }

  // Timeline records
  html += '<div class="stu-timeline">';
  recs.forEach((r, i) => {
    const accCls = r.accuracy >= 80 ? 'acc-high' : r.accuracy >= 60 ? 'acc-mid' : 'acc-low';
    const timeStr = r.submit_time || r.submitted_at || '';

    // In wrong-only mode, skip records with no wrong answers
    const wrongDetails = r.details ? r.details.filter(d => !d.is_correct) : [];
    if (_detailOnlyWrong && wrongDetails.length === 0) return;

    html += '<div class="stu-timeline-item">';
    html += '<div class="stu-timeline-head">';
    html += '<span style="font-weight:700;">第' + (recs.length - i) + '次答题</span>';
    html += '<span class="stu-timeline-acc ' + accCls + '">' + r.accuracy + '%</span>';
    html += '</div>';

    if (_detailOnlyWrong) {
      html += '<div class="stu-timeline-meta">' + wrongDetails.length + '题答错 · ' + timeStr + '</div>';
    } else {
      html += '<div class="stu-timeline-meta">' + r.correct_count + '/' + r.total_questions + '对 · ' + (r.total_time_sec || '-') + '秒 · ' + timeStr + '</div>';
    }

    if (r.details && r.details.length) {
      const displayDetails = _detailOnlyWrong ? wrongDetails : r.details;
      html += '<div class="stu-timeline-details">';
      displayDetails.forEach(d => {
        const icon = d.is_correct ? '✅' : '❌';
        const selDisplay = d.selected_text ? d.selected + '. ' + d.selected_text : d.selected;
        const corDisplay = d.correct_text ? d.correct + '. ' + d.correct_text : d.correct;
        if (d.is_correct) {
          html += '<div class="stu-detail-q">' + icon + ' ' + d.question + '</div>';
        } else {
          html += '<div class="stu-detail-q wrong">' + icon + ' ' + d.question +
            '<br><span style="margin-left:20px;">学生选：<b style="color:var(--danger);">' + selDisplay + '</b></span>' +
            '<br><span style="margin-left:20px;">正确答案：<b style="color:var(--success);">' + corDisplay + '</b></span></div>';
        }
      });
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  $('modal-content').innerHTML = html;
  $('modal-detail').classList.add('show');
}

// Copy wrong questions to clipboard
function copyWrongQuestions(key) {
  const timeFiltered = getFilteredRecords();
  const recs = timeFiltered.filter(r => (r.student_class || '') + '|' + r.student_name === key).sort((a, b) => {
    const ta = parseSubmitTime(a.submit_time || a.submitted_at);
    const tb = parseSubmitTime(b.submit_time || b.submitted_at);
    return (tb || 0) - (ta || 0);
  });
  if (!recs.length) return;
  const name = recs[0].student_name, cls = recs[0].student_class || '';

  // Collect all wrong questions (deduplicated by question text)
  const wrongMap = {};
  recs.forEach((r, ri) => {
    if (!r.details) return;
    r.details.forEach(d => {
      if (d.is_correct) return;
      const q = d.question;
      if (!wrongMap[q]) {
        wrongMap[q] = {
          question: q,
          selected: d.selected_text ? d.selected + '. ' + d.selected_text : d.selected,
          correct: d.correct_text ? d.correct + '. ' + d.correct_text : d.correct,
          count: 0,
          options: {}
        };
        // Try to find options from allQuestions
        const found = allQuestions.find(aq => aq.question === q);
        if (found) {
          wrongMap[q].options = { A: found.A || '', B: found.B || '', C: found.C || '', D: found.D || '' };
          wrongMap[q].explanation = found.explanation || '';
        }
      }
      wrongMap[q].count++;
      // Update to latest selected answer
      wrongMap[q].selected = d.selected_text ? d.selected + '. ' + d.selected_text : d.selected;
    });
  });

  const wrongList = Object.values(wrongMap);
  if (!wrongList.length) { showToast('没有错题可复制'); return; }

  // Format text
  let text = '📋 ' + cls + '班 ' + name + ' 的错题汇总（共' + wrongList.length + '题）\n';
  text += '━━━━━━━━━━━━━━━━━━━━\n\n';

  wrongList.forEach((w, i) => {
    text += (i + 1) + '. ' + w.question + '\n';
    if (w.options && (w.options.A || w.options.B || w.options.C || w.options.D)) {
      if (w.options.A) text += '   A. ' + w.options.A + '\n';
      if (w.options.B) text += '   B. ' + w.options.B + '\n';
      if (w.options.C) text += '   C. ' + w.options.C + '\n';
      if (w.options.D) text += '   D. ' + w.options.D + '\n';
    }
    text += '   ❌ 学生选：' + w.selected + '\n';
    text += '   ✅ 正确答案：' + w.correct + '\n';
    if (w.explanation) text += '   💡 解析：' + w.explanation + '\n';
    if (w.count > 1) text += '   ⚠️ 错了' + w.count + '次\n';
    text += '\n';
  });

  // Copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('已复制 ' + wrongList.length + ' 道错题 ✅');
    }).catch(() => {
      fallbackCopy(text, wrongList.length);
    });
  } else {
    fallbackCopy(text, wrongList.length);
  }
}

function fallbackCopy(text, count) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('已复制 ' + count + ' 道错题 ✅');
  } catch (e) {
    showToast('复制失败，请手动选择复制');
  }
  document.body.removeChild(ta);
}

$('modal-close').addEventListener('click', () => $('modal-detail').classList.remove('show'));
$('modal-detail').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('show'); });

// Export
function exportCSV(records, filename) {
  if (!records.length) { showToast('暂无数据可导出'); return; }
  const header = ['班级', '姓名', '总题数', '答对', '答错', '正确率(%)', '用时(秒)', '提交时间', '题目', '所选答案', '所选内容', '正确答案', '正确内容', '是否正确', '答题用时(秒)'];
  let rows = [header.join(',')];
  records.forEach(r => {
    if (!r.student_name) return;
    const base = ['"' + (r.student_class || '').replace(/"/g, '""') + '"', '"' + (r.student_name || '').replace(/"/g, '""') + '"'];
    if (r.details && r.details.length) {
      r.details.forEach((d, i) => {
        rows.push([...base, i === 0 ? r.total_questions : '', i === 0 ? r.correct_count : '', i === 0 ? r.wrong_count : '', i === 0 ? r.accuracy : '', i === 0 ? r.total_time_sec : '', i === 0 ? '"' + (r.submit_time || '').replace(/"/g, '""') + '"' : '', '"' + (d.question || '').replace(/"/g, '""') + '"', d.selected || '', '"' + (d.selected_text || '').replace(/"/g, '""') + '"', d.correct || '', '"' + (d.correct_text || '').replace(/"/g, '""') + '"', d.is_correct ? '正确' : '错误', d.time_sec || ''].join(','));
      });
    } else {
      rows.push([...base, r.total_questions || '', r.correct_count || '', r.wrong_count || '', r.accuracy || '', r.total_time_sec || '', '"' + (r.submit_time || '') + '"', '', '', '', '', '', '', ''].join(','));
    }
  });
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  showToast('导出成功 ✅');
}

$('t-btn-export').addEventListener('click', () => {
  const cls = $('t-filter-class').value;
  const filtered = getFilteredRecords();
  const records = cls === '__all__' ? filtered.filter(r => r.student_name) : filtered.filter(r => r.student_name && r.student_class === cls);
  exportCSV(records, '答题记录_' + (cls === '__all__' ? '全部班级' : cls + '班') + '_' + new Date().toISOString().slice(0, 10) + '.csv');
});
$('t-btn-export-all').addEventListener('click', () => {
  exportCSV(getFilteredRecords().filter(r => r.student_name), '答题记录_全部_' + new Date().toISOString().slice(0, 10) + '.csv');
});
$('t-btn-ranking').addEventListener('click', () => { showRanking('teacher'); });

// ===== Teacher Tabs =====
function switchTeacherTab(tab) {
  document.querySelectorAll('.t-nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.t-tab-panel').forEach(p => p.style.display = 'none');
  const panel = $('tab-' + tab);
  if (panel) panel.style.display = 'block';
  if (tab === 'errors') renderErrorAnalysis($('err-filter-class').value || '__all__');
  if (tab === 'qmgmt') renderQuestionMgmt();
  if (tab === 'cmgmt') renderClassMgmt();
}

// ===== Error Analysis =====
function renderErrorAnalysis(cls) {
  const filtered = cls === '__all__' ? allRecords.filter(r => r.details) : allRecords.filter(r => r.details && r.student_class === cls);
  const qmap = {};
  filtered.forEach(r => {
    if (!r.details) return;
    r.details.forEach(d => {
      const q = d.question; if (!q) return;
      if (!qmap[q]) qmap[q] = { question: q, correct: d.correct, total: 0, wrong: 0, wrongChoices: {} };
      qmap[q].total++;
      if (!d.is_correct) { qmap[q].wrong++; qmap[q].wrongChoices[d.selected || '?'] = (qmap[q].wrongChoices[d.selected || '?'] || 0) + 1; }
    });
  });
  Object.values(qmap).forEach(q => {
    const found = allQuestions.find(aq => aq.question === q.question);
    if (found) { q.explanation = found.explanation || ''; q.A = found.A || ''; q.B = found.B || ''; q.C = found.C || ''; q.D = found.D || ''; }
  });
  const sorted = Object.values(qmap).filter(q => q.total >= 1).sort((a, b) => (b.wrong / b.total) - (a.wrong / a.total));
  const el = $('error-analysis');
  if (!sorted.length) { el.innerHTML = '<div class="empty-rank"><div class="icon">📊</div><p>暂无答题数据</p></div>'; return; }
  el.innerHTML = '<div style="font-size:13px;color:var(--gray-500);margin-bottom:12px;">共分析 ' + Object.keys(qmap).length + ' 道题</div>' +
    sorted.slice(0, 30).map((q, i) => {
      const errRate = Math.round(q.wrong / q.total * 100);
      const barColor = errRate >= 60 ? 'var(--danger)' : errRate >= 30 ? 'var(--warning)' : 'var(--success)';
      const wrongDist = Object.entries(q.wrongChoices).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + (q[k] ? '(' + q[k] + ')' : '') + '(' + v + '人)').join('、');
      return '<div class="err-item"><div class="err-q">' + (i + 1) + '. ' + q.question + '</div><div class="err-bar"><div class="err-bar-fill" style="width:' + errRate + '%;background:' + barColor + ';"></div></div><div class="err-meta"><span>错误率 <b style="color:' + barColor + '">' + errRate + '%</b>（' + q.wrong + '/' + q.total + '人答错）</span><span>正确答案：<b>' + q.correct + (q[q.correct] ? '. ' + q[q.correct] : '') + '</b></span></div>' + (wrongDist ? '<div class="err-detail">🔍 主要错选：' + wrongDist + '</div>' : '') + (q.explanation ? '<div class="err-detail">💡 ' + q.explanation + '</div>' : '') + '</div>';
    }).join('');
}

document.addEventListener('change', function (e) { if (e.target.id === 'err-filter-class') renderErrorAnalysis(e.target.value); });
