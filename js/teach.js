/* ============================================================
   티칭 포인트 (꼭 알아야 할 것 + ▶ 영상)
   ▶ 영상 연결: 아래 목록에서 video 칸에 유튜브 주소, t 칸에 시작 초를 넣으면 바로 켜집니다.
     예) video: 'https://youtu.be/AbCdEfGhIjk', t: 312
     video 가 비어 있으면 ▶ 버튼은 숨기고 한 줄만 보입니다.
   화면에서는 <p class="teach" data-teach="T02"></p> 만 두면 이 목록에서 채웁니다.
   ============================================================ */
(function (root) {
  'use strict';
  const TEACH = [
    { id: 'T01', line: '신고는 돌아가신 달의 말일부터 6개월 안에 해야 합니다. 늦으면 가산세가 20% 붙습니다.', title: '상속세 기한, 늦으면 얼마나 무나', video: '', t: 0 },
    { id: 'T02', line: '배우자가 있으면 최소 5억원이 더 공제됩니다. 더 받으면 최대 30억원까지, 단 실제로 받고 등기해야 합니다.', title: '배우자공제, 5억과 30억 사이', video: '', t: 0 },
    { id: 'T03', line: '손자녀가 바로 받으면 그 몫의 세금에 30%가 더 붙습니다. 먼저 돌아가신 자녀 대신 받는 경우는 붙지 않습니다.', title: '손자녀 상속, 할증과 그래도 유리한 때', video: '', t: 0 },
    { id: 'T04', line: '아파트는 최근 거래가로, 땅과 단독주택은 보통 공시가격으로 평가됩니다. 모르면 공시가격만 넣어도 됩니다.', title: '상속재산은 얼마로 평가되나', video: '', t: 0 },
    { id: 'T05', line: '공시가격으로 평가하면 지금 세금은 줄지만, 나중에 팔 때 양도세가 커집니다.', title: '감정평가 받을까 말까', video: '', t: 0 },
    { id: 'T06', line: '10년 넘게 같이 산 집을 집 없는 자녀가 받으면 최대 6억원이 더 공제됩니다.', title: '동거주택 상속공제 조건', video: '', t: 0 },
    { id: 'T07', line: '분양권도 상속재산입니다. 낸 돈 + 프리미엄으로 평가되고, 집 수에도 들어갈 수 있습니다.', title: '분양권 상속, 취득세와 양도세', video: '', t: 0 },
    { id: 'T08', line: '예금·주식은 대출을 뺀 금액의 20%(최대 2억원)가 따로 공제됩니다.', title: '금융재산 상속공제', video: '', t: 0 },
    { id: 'T09', line: '돌아가신 분이 보험료를 냈으면 사망보험금도 상속재산입니다. 다른 사람이 냈으면 빼세요.', title: '보험금은 상속세를 내나', video: '', t: 0 },
    { id: 'T10', line: '예금·대출·보험·연금은 「안심상속 원스톱 서비스」에서 한 번에 조회됩니다(주민센터·정부24).', title: '안심상속 원스톱 신청하는 법', video: '', t: 0 },
    { id: 'T11', line: '세입자에게 돌려줄 보증금도 빚입니다. 빼먹으면 세금을 더 냅니다.', title: '상속세에서 뺄 수 있는 빚', video: '', t: 0 },
    { id: 'T12', line: '장례비는 영수증 없이 500만원, 영수증이 있으면 1,000만원까지 빠집니다. 봉안시설은 500만원 따로.', title: '장례비 공제', video: '', t: 0 },
    { id: 'T13', line: '10년 안에 가족에게 준 재산(가족 외는 5년)은 상속재산에 다시 더해집니다.', title: '10년 합산, 미리 주는 게 늘 유리하진 않은 이유', video: '', t: 0 },
    { id: 'T14', line: '그때 낸 증여세는 상속세에서 빼 줍니다. 증여세 신고서를 찾아 두세요.', title: '', video: '', t: 0 },
    { id: 'T15', line: '돌아가시기 1년 안 2억원, 2년 안 5억원이 넘게 나간 돈은 어디에 썼는지 설명해야 합니다.', title: '추정상속, 통장 출금 조심', video: '', t: 0 },
    { id: 'T16', line: '누가 집을 받느냐에 따라 취득세·종부세·나중 양도세가 달라집니다. 상속세는 같아도요.', title: '협의분할, 누가 무엇을 받을까', video: '', t: 0 },
    { id: 'T17', line: '배우자가 아무것도 안 받아도 5억원은 공제됩니다. 더 받으면 더 공제됩니다.', title: '', video: '', t: 0 },
    { id: 'T18', line: '배우자 몫은 신고기한 다음 날부터 9개월 안에 등기까지 끝내야 공제됩니다.', title: '배우자 분할기한', video: '', t: 0 },
    { id: 'T19', line: '상속받은 집에도 취득세(보통 2.96%)를 6개월 안에 냅니다. 집 없는 사람이 받으면 0.96%.', title: '상속 취득세, 누가 받아야 싸지나', video: '', t: 0 },
    { id: 'T20', line: '상속받은 집은 5년 동안 종부세 주택 수에서 빠집니다. 지분 40% 이하면 계속 빠집니다.', title: '상속주택과 종부세', video: '', t: 0 },
    { id: 'T21', line: '재산세는 6월 1일 주인이 냅니다. 등기 전이면 주된 상속인에게 나옵니다.', title: '', video: '', t: 0 },
    { id: 'T22', line: '나중에 팔 때 "산 값"은 상속받을 때 평가한 금액입니다. 그래서 지금 평가가 중요합니다.', title: '상속주택 팔 때 양도세', video: '', t: 0 },
    { id: 'T23', line: '원래 집 1채를 먼저 팔면 상속받은 집이 있어도 비과세가 될 수 있습니다.', title: '1세대1주택 상속주택 특례', video: '', t: 0 },
    { id: 'T24', line: '세금이 2,000만원을 넘으면 최대 10년에 나눠 낼 수 있고, 부동산으로 낼 수도 있습니다.', title: '연부연납·물납', video: '', t: 0 },
  ];

  function ytId(url) {
    const m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(url || '');
    return m ? m[1] : '';
  }
  function find(id) { return TEACH.find(function (x) { return x.id === id; }); }

  // 열어 본 포인트 기록 → 상속 파일 opened 에 남겨 세무사 문의에 함께 전달
  let onOpen = null;
  function open(id) {
    const t = find(id); const vid = t && ytId(t.video); if (!vid) return;
    let box = document.getElementById('teachVideo');
    if (!box) {
      box = document.createElement('div'); box.id = 'teachVideo'; box.className = 'teach-video no-print';
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      box.innerHTML = '<div class="tv-card"><div class="tv-head"><b id="tvTitle"></b><button type="button" class="tv-close" aria-label="닫기">✕</button></div><div class="tv-frame"><iframe id="tvFrame" title="설명 영상" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div><p class="tv-note">영상을 닫아도 입력한 내용은 그대로 있습니다.</p></div>';
      document.body.appendChild(box);
      const close = function () { box.classList.remove('open'); document.getElementById('tvFrame').src = 'about:blank'; };
      box.addEventListener('click', function (ev) { if (ev.target === box || ev.target.closest('.tv-close')) close(); });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    }
    document.getElementById('tvTitle').textContent = t.title || '설명 영상';
    document.getElementById('tvFrame').src = 'https://www.youtube-nocookie.com/embed/' + vid + '?rel=0&autoplay=1' + (t.t ? '&start=' + t.t : '');
    box.classList.add('open');
    if (onOpen) onOpen(id);
  }
  function render(rootEl) {
    (rootEl || document).querySelectorAll('[data-teach]').forEach(function (el) {
      const t = find(el.dataset.teach); if (!t) return;
      const vid = ytId(t.video);
      el.classList.add('teach');
      el.innerHTML = '<span class="teach-k">꼭 알아두세요</span> ' + t.line.replace(/</g, '&lt;') +
        (vid ? ' <button type="button" class="teach-play" data-play="' + t.id + '">▶ 영상</button>' : '');
    });
  }
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest && ev.target.closest('[data-play]');
    if (b) { ev.preventDefault(); open(b.dataset.play); }
  });

  root.TEACH = { list: TEACH, render: render, open: open, find: find, ytId: ytId, onOpen: function (f) { onOpen = f; } };
})(window);
