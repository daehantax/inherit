/* ============================================================
   고객 답변서 화면(answer.html)
   - ?no=접수번호&t=확인코드 → 접수 서버(doGet ?answer=)에서 답변서 JSON 을 받아 보여 준다 (세무사가 고치면 최신본)
   - #preview → 세무사가 「미리 보기」로 넘긴 sessionStorage 사본
   - 받은 답변서는 이 기기(localStorage dh.answer.v1.<no>)에도 남겨 두어, 서버가 안 될 때도 다시 볼 수 있다
   ============================================================ */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const para = function (t) { return String(t || '').split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); };
  const fmtDate = function (s) { if (!s) return ''; const p = String(s).split('-'); return p.length === 3 ? p[0] + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일' : s; };

  function render(a, state) {
    document.title = (a.title || '상속세 검토 답변서') + ' · 대한세무법인';
    $('anSheet').innerHTML =
      '<header class="an-head"><div class="an-firm">대한세무법인</div><h1>' + esc(a.title || '상속세 검토 답변서') + '</h1><div class="an-meta">접수번호 ' + esc(a.no || '') + ' · ' + fmtDate(a.date) + (a.agent ? ' · 담당 ' + esc(a.agent) : '') + '</div></header>' +
      '<p class="an-to">' + esc(a.to || '고객') + '님께</p>' + para(a.greeting) +
      (a.conclusion ? '<div class="an-conclusion"><b>결론</b>' + para(a.conclusion) + '</div>' : '') +
      (a.sections || []).map(function (s) { return '<section class="an-sec"><h2>' + esc(s.title) + '</h2>' + para(s.text) + '</section>'; }).join('') +
      ((a.todo || []).length ? '<section class="an-sec"><h2>고객님이 하실 일</h2><ul>' + a.todo.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>' : '') +
      '<section class="an-sec an-closing">' + para(a.closing) + '</section>' +
      ((a.assumptions || []).length ? '<section class="an-sec an-assume"><h2>이 답변의 전제</h2><ul>' + a.assumptions.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul><p>이 답변서는 고객님이 입력하신 내용을 기준으로 작성되었으며, 서류 확인 후 금액이 달라질 수 있습니다. 신고 전 담당 세무사와 최종 확인하세요.</p></section>' : '');
    $('anSheet').hidden = false; $('anEmpty').hidden = true;
    $('anState').textContent = state || '';
  }
  function fail(t) { $('anSheet').hidden = true; $('anEmpty').hidden = false; $('anEmptyText').textContent = t; $('anState').textContent = ''; }

  async function main() {
    if (/preview/.test(location.hash)) {
      let a = null; try { a = JSON.parse(sessionStorage.getItem('dh.answer.preview') || 'null'); } catch (e) { }
      if (a) { render(a, '미리 보기 — 세무사 화면에서 넘어온 사본입니다. 고객에게는 「고객에게 보내기」 후 링크로 전달됩니다.'); return; }
      fail('미리 볼 답변서가 없습니다. 검토표 화면에서 「답변서 미리 보기」를 누르세요.'); return;
    }
    const q = new URLSearchParams(location.search); const no = (q.get('no') || '').toUpperCase(), t = (q.get('t') || '').toUpperCase();
    if (!no || !t) { fail('답변서 주소가 올바르지 않습니다. 메일에 있는 링크를 그대로 열어 주세요.'); return; }
    const LKEY = 'dh.answer.v1.' + no;
    let cached = null; try { cached = JSON.parse(localStorage.getItem(LKEY) || 'null'); } catch (e) { }
    try {
      const res = await fetch(DH.CONSULT_URL + '?answer=' + encodeURIComponent(no) + '&t=' + encodeURIComponent(t));
      const j = await res.json();
      if (j && j.ok && j.answer) {
        try { localStorage.setItem(LKEY, JSON.stringify({ answer: j.answer, sent: j.sent, updated: j.updated, savedAt: new Date().toISOString() })); } catch (e) { }
        render(j.answer, '보낸 날 ' + (j.sent || '') + (j.updated && j.updated !== j.sent ? ' · 고친 날 ' + j.updated : '') + ' · 이 기기에도 사본을 저장했습니다.'); return;
      }
      if (j && j.error === 'notsent') { fail('아직 답변서가 발송되지 않았습니다. 담당 세무사가 보내면 같은 링크에서 열립니다.'); return; }
      if (j && j.error === 'token') { fail('링크의 확인코드가 맞지 않습니다. 메일에 있는 링크를 그대로 열어 주세요.'); return; }
    } catch (e) { }
    if (cached) { render(cached.answer, '지금은 서버에 연결되지 않아 이 기기에 저장된 사본(' + String(cached.savedAt).slice(0, 10) + ')을 보여 드립니다.'); return; }
    fail('답변서를 불러오지 못했습니다. 잠시 뒤 다시 열거나 031-783-8877로 연락 주세요.');
  }
  document.addEventListener('click', function (ev) { if (ev.target.closest('#anPrint')) window.print(); });
  main();
  window.ANSWER_UI = { reload: main };
})();
