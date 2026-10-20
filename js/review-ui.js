/* ============================================================
   세무사 검토표 화면(review.html) 동작
   - 접수번호 + 세무사 키로 접수 서버(Apps Script)에서 링크·고객 정보·저장된 검토표를 받는다
   - 상속 파일(E) → RV.build → 항목(RV.sections) → 판단·의견 입력 → 답변서(RV.answerDraft) 편집
   - 저장: 시트 「검토」(원본) + 이 PC localStorage(백업) + json 파일
   ============================================================ */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = RV.esc;
  const AKEY = 'dh.review.agent', NKEY = 'dh.review.agentName';
  let E = null, M = null, R = null;        // R = { no, meta:{customer}, items:{id:{verdict,note,hide}}, memo, answer, link, agentName, status }
  let timer = null;

  const agentKey = function () { return ($('rvAgent').value || '').trim(); };
  const storeKey = function () { return 'dh.review.v1.' + (R && R.no || 'local'); };
  const msg = function (t, bad) { $('rvStatus').textContent = t; $('rvStatus').className = 'es-note' + (bad ? ' bad' : ''); };

  /* ---------- 불러오기 ---------- */
  async function loadFromSheet() {
    const no = ($('rvNo').value || '').trim().toUpperCase();
    if (!/^F-\d{8}-\d{2,}$/.test(no)) { msg('접수번호를 확인하세요. 예: F-20261020-02', true); return; }
    if (!agentKey()) { msg('세무사 키를 넣어 주세요.', true); return; }
    try { localStorage.setItem(AKEY, agentKey()); localStorage.setItem(NKEY, $('rvAgentName').value || ''); } catch (e) { }
    msg('불러오는 중…');
    let j = null;
    try { const res = await fetch(DH.CONSULT_URL + '?load=' + encodeURIComponent(no) + '&agent=' + encodeURIComponent(agentKey())); j = await res.json(); } catch (e) { j = null; }
    if (!j || !j.ok) { msg(j && j.error === 'agent' ? '세무사 키가 맞지 않습니다.' : j && j.error === 'nokey' ? 'Apps Script 「프로젝트 설정 › 스크립트 속성」에 AGENT_KEY 가 아직 없습니다.' : j && j.error === 'nofile' ? '시트 「신고 접수」에 그 접수번호가 없습니다.' : '접수 서버에 연결하지 못했습니다(Apps Script v7 배포 확인). 아래 「링크로 열기」를 쓰세요.', true); return; }
    const e = EST.fromHash((j.file.link || '').replace(/^[^#]*/, ''));
    if (!e) { msg('접수 링크에서 상속 파일을 읽지 못했습니다: ' + (j.file.link || '(링크 없음)'), true); return; }
    const meta = { no: no, customer: { name: j.file.name, phone: j.file.phone, email: j.file.email, question: j.file.question, product: j.file.product } };
    start(e, meta, j.review, j.answer, { link: j.answerLink, status: j.status, sent: j.sent }, '시트');
  }
  function loadFromLink(e, from) {
    if (!e) { msg('링크에서 상속 파일을 읽지 못했습니다.', true); return; }
    const no = ($('rvNo').value || '').trim().toUpperCase() || 'LOCAL';
    start(e, { no: no, customer: {} }, null, null, {}, from);
  }
  function start(e, meta, review, answer, extra, from) {
    E = e; M = RV.build(E, meta);
    let saved = null; try { saved = JSON.parse(localStorage.getItem('dh.review.v1.' + meta.no) || 'null'); } catch (err) { }
    R = Object.assign({ no: meta.no, meta: meta, items: {}, memo: '', answer: null, link: '', agentName: $('rvAgentName').value || '', status: '' }, saved || {}, review ? { items: review.items || {}, memo: review.memo || '', meta: Object.assign({}, meta, review.meta || {}) } : {});
    if (answer) R.answer = answer;
    if (extra.link) R.link = extra.link; if (extra.status) R.status = extra.status;
    if (!R.answer) R.answer = RV.answerDraft(M, R);
    R.meta.customer = Object.assign({}, meta.customer, (R.meta || {}).customer || {});
    $('rvLoaded').innerHTML = '<b>' + esc(from) + '</b>에서 불러옴 · 접수번호 ' + esc(R.no) + ' · 상속인 ' + E.heirs.length + '명 · 재산 ' + RV.kor(M.tax.totalProperty) + ' · 상속세 ' + RV.kor(M.tax.payable) + (extra.status ? ' · 시트 상태 「' + esc(extra.status) + '」' : '') + (extra.sent ? ' · 답변 보냄 ' + esc(extra.sent) : '') + (saved && !review ? ' · 이 PC에 저장된 검토표를 이어서 씁니다' : '');
    $('rvBody').hidden = false;
    render();
  }

  /* ---------- 그리기 ---------- */
  function render() {
    document.querySelectorAll('[data-m]').forEach(function (el) { el.value = R.meta.customer[el.dataset.m] || ''; });
    const S = RV.sections(M);
    $('rvSections').innerHTML = S.map(function (s) {
      const it = R.items[s.id] || {};
      return '<div class="rv-sec' + (it.hide ? ' hide' : '') + '" data-sec="' + s.id + '"><div class="rv-sec-head"><b>' + esc(s.title) + '</b>' + (s.hint ? '<small>' + esc(s.hint) + '</small>' : '') + '</div>' +
        '<div class="rv-auto">' + s.html + '</div>' +
        '<div class="rv-judge"><span class="radio-row">' + [['ok', '확인'], ['fix', '고침'], ['check', '서류 확인']].map(function (v) { return '<label><input type="radio" name="v_' + s.id + '" value="' + v[0] + '"' + (it.verdict === v[0] ? ' checked' : '') + '><span>' + v[1] + '</span></label>'; }).join('') + '</span>' +
        '<label class="check"><input type="checkbox" data-hide="' + s.id + '"' + (it.hide ? ' checked' : '') + '> 답변서에서 뺌</label>' +
        '<textarea data-note="' + s.id + '" rows="2" placeholder="세무사 의견 — 답변서에 「세무사 의견: …」으로 들어갑니다">' + esc(it.note || '') + '</textarea></div></div>';
    }).join('');
    document.querySelector('[data-r="memo"]').value = R.memo || '';
    renderAnswer();
    $('rvAnswerLink').innerHTML = R.link ? '<a href="' + esc(R.link) + '" target="_blank" rel="noopener">' + esc(R.link) + '</a> <small>(「고객에게 보내기」 전에는 열리지 않습니다)</small>' : '(시트에 저장하면 나옵니다)';
  }
  function renderAnswer() {
    const a = R.answer;
    const ta = function (path, label, v, rows) { return '<div class="fl-f wide"><label>' + label + '</label><textarea data-a="' + path + '" rows="' + (rows || 3) + '">' + esc(v || '') + '</textarea></div>'; };
    $('rvAnswer').innerHTML = '<div class="fl-grid">' +
      '<div class="fl-f"><label>제목</label><input type="text" data-a="title" value="' + esc(a.title) + '"></div><div class="fl-f"><label>받는 분</label><input type="text" data-a="to" value="' + esc(a.to) + '"></div><div class="fl-f"><label>날짜</label><input type="date" data-a="date" value="' + esc(a.date) + '"></div>' +
      ta('greeting', '인사', a.greeting, 2) + ta('conclusion', '결론 한 줄 (세무사가 직접) <small>예: 배우자공제를 최대로 쓰면 상속세 0원, 취득세만 672만원</small>', a.conclusion, 2) +
      a.sections.map(function (s, i) { return '<div class="fl-f wide"><label><input type="text" class="rv-sec-title" data-a="sections.' + i + '.title" value="' + esc(s.title) + '"></label><textarea data-a="sections.' + i + '.text" rows="' + Math.min(14, Math.max(3, (s.text || '').split('\n').length + 1)) + '">' + esc(s.text) + '</textarea></div>'; }).join('') +
      ta('todo', '고객이 하실 일 (한 줄에 하나)', (a.todo || []).join('\n'), 3) + ta('closing', '맺음말', a.closing, 3) + '</div>';
  }

  /* ---------- 읽기·저장 ---------- */
  function collect() {
    document.querySelectorAll('[data-m]').forEach(function (el) { R.meta.customer[el.dataset.m] = el.value; });
    document.querySelectorAll('.rv-sec').forEach(function (sec) {
      const id = sec.dataset.sec; const it = R.items[id] = R.items[id] || {};
      const v = sec.querySelector('input[type=radio]:checked'); it.verdict = v ? v.value : '';
      it.hide = !!sec.querySelector('[data-hide]').checked; it.note = sec.querySelector('[data-note]').value;
    });
    R.memo = document.querySelector('[data-r="memo"]').value;
    document.querySelectorAll('[data-a]').forEach(function (el) {
      const p = el.dataset.a.split('.'); let o = R.answer;
      for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
      o[p[p.length - 1]] = p[0] === 'todo' ? el.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : el.value;
    });
    R.agentName = $('rvAgentName').value || R.agentName;
    R.updated = new Date().toISOString();
    return R;
  }
  function saveLocal() { try { localStorage.setItem(storeKey(), JSON.stringify(collect())); } catch (e) { } }
  function scheduleSave() { clearTimeout(timer); timer = setTimeout(saveLocal, 400); }
  function answerForCustomer() {
    collect();
    const a = JSON.parse(JSON.stringify(R.answer));
    // 「답변서에서 뺌」 항목의 이름을 가진 문단은 초안 재생성 때만 반영되므로, 보내기 전 현재 답변서를 그대로 쓴다
    a.no = R.no; a.agent = R.agentName; a.assumptions = M.assumptions; a.updated = R.updated;
    return a;
  }
  async function post(action) {
    if (!agentKey()) { msg('세무사 키를 넣어 주세요.', true); return null; }
    if (!/^F-\d{8}-\d{2,}$/.test(R.no)) { msg('시트에 저장하려면 접수번호(F-…)로 불러와야 합니다. 지금은 파일로 내보내기만 됩니다.', true); return null; }
    saveLocal();
    const payload = { form: 'inherit-review', action: action, no: R.no, agent: agentKey(), agentName: R.agentName, customerName: R.meta.customer.name, customerEmail: R.meta.customer.email,
      review: { items: R.items, memo: R.memo, meta: R.meta, updated: R.updated }, answer: answerForCustomer(), status: action === 'send' ? '답변 발송' : (R.status || '검토 중') };
    msg(action === 'send' ? '보내는 중…' : '저장하는 중…');
    try {
      const res = await fetch(DH.CONSULT_URL, { method: 'POST', body: JSON.stringify(payload) });
      const j = await res.json();
      if (!j || !j.ok) { msg({ agent: '세무사 키가 맞지 않습니다.', nokey: 'Apps Script 스크립트 속성에 AGENT_KEY 를 먼저 넣어 주세요.', email: '고객 이메일을 확인하세요.', toolong: '내용이 너무 깁니다(시트 한 칸 49,000자). 답변서를 줄여 주세요.', mail: '시트에는 저장됐지만 메일 발송에 실패했습니다. 링크를 직접 보내세요: ' + (j && j.link || '') }[j && j.error] || '접수 서버가 거부했습니다(Apps Script v7 배포 확인).', true); return null; }
      R.link = j.link; R.status = j.status; saveLocal(); $('rvAnswerLink').innerHTML = '<a href="' + esc(R.link) + '" target="_blank" rel="noopener">' + esc(R.link) + '</a>';
      msg(action === 'send' ? '고객(' + R.meta.customer.email + ')에게 답변서 링크를 보냈습니다. 시트 「검토」 상태 「답변 발송」.' : '시트 「검토」에 저장했습니다 (' + new Date().toLocaleTimeString('ko-KR') + ').');
      return j;
    } catch (e) { msg('접수 서버에 연결하지 못했습니다. 「파일로 내보내기」로 보관하세요.', true); return null; }
  }
  function exportFile() {
    collect(); saveLocal();
    const blob = new Blob([JSON.stringify({ kind: 'dh-review', no: R.no, review: { items: R.items, memo: R.memo, meta: R.meta }, answer: answerForCustomer(), estate: E, at: new Date().toISOString() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '검토표-' + R.no + '-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
  }
  function importFile(file) {
    const rd = new FileReader();
    rd.onload = function () {
      try {
        const j = JSON.parse(rd.result); if (j.kind !== 'dh-review') throw new Error('kind');
        $('rvNo').value = j.no || '';
        start(EST.normalize(j.estate), { no: j.no || 'LOCAL', customer: (j.review.meta || {}).customer || {} }, j.review, j.answer, {}, '파일');
      } catch (e) { msg('검토표 파일이 아닙니다.', true); }
    };
    rd.readAsText(file);
  }
  function preview() {
    try { sessionStorage.setItem('dh.answer.preview', JSON.stringify(Object.assign(answerForCustomer(), { _preview: true }))); } catch (e) { }
    window.open('answer.html#preview', '_blank');
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'rvLoad') loadFromSheet();
    if (b.id === 'rvLoadLink') loadFromLink(EST.fromHash(($('rvLink').value || '').replace(/^[^#]*/, '')), '링크');
    if (b.id === 'rvLoadLocal') loadFromLink(EST.load(), '이 기기');
    if (b.id === 'rvDraft' && R) { if (confirm('답변서를 지금 검토표 내용으로 다시 만들까요? 고친 내용은 사라집니다.')) { collect(); R.answer = RV.answerDraft(M, R); renderAnswer(); saveLocal(); } }
    if (b.id === 'rvSave') post('save');
    if (b.id === 'rvSend' && R) { if (confirm('고객 ' + (R.meta.customer.email || '(이메일 없음)') + '에게 답변서 링크를 메일로 보낼까요?')) post('send'); }
    if (b.id === 'rvPreview' && R) preview();
    if (b.id === 'rvExport' && R) exportFile();
  });
  document.addEventListener('input', function (ev) { if (R && ev.target.closest('#rvBody')) scheduleSave(); });
  document.addEventListener('change', function (ev) { if (ev.target.id === 'rvFile' && ev.target.files[0]) importFile(ev.target.files[0]); if (R && ev.target.closest('#rvBody')) scheduleSave(); });
  window.addEventListener('pagehide', function () { if (R) saveLocal(); });

  try { $('rvAgent').value = localStorage.getItem(AKEY) || ''; $('rvAgentName').value = localStorage.getItem(NKEY) || ''; } catch (e) { }
  { const m = /[?&]no=(F-\d{8}-\d{2,})/.exec(location.search); if (m) { $('rvNo').value = m[1]; if (agentKey()) loadFromSheet(); } }
  const fromHash = EST.fromHash(); if (fromHash) loadFromLink(fromHash, '주소');
  window.REVIEW_UI = { get E() { return E; }, get M() { return M; }, get R() { return R; }, start: start, collect: collect };
})();
