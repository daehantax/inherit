/* ============================================================
   대한세무법인 상속·증여 도구 공통 스크립트 (dh.js)
   - 숫자 입력 쉼표 처리, 한글 금액 보조표시
   - 페이지별 저장/불러오기 (localStorage, 키 충돌 방지)
   - 인쇄 보조 (접힌 details 펼치기, 인쇄 시각)
   - 공통 상단바/푸터 삽입
   모든 함수는 window.DH 아래에 둔다.
   ============================================================ */
(function () {
  'use strict';
  const DH = {};

  /* ---------- 숫자 ---------- */
  // "1,234,567" / "12억" 같은 문자열에서 숫자만 뽑는다. 빈 값은 0.
  DH.num = function (v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v).trim();
    if (!s) return 0;
    const neg = s.startsWith('-');
    const n = Number(s.replace(/[^\d.]/g, ''));
    return isFinite(n) ? (neg ? -n : n) : 0;
  };
  DH.fmt = function (n) { return Math.round(DH.num(n)).toLocaleString('ko-KR'); };
  DH.won = function (n) { return DH.fmt(n) + '원'; };
  // 1억 2,345만원 형식
  DH.kor = function (n) {
    n = Math.round(DH.num(n));
    if (!n) return '';
    const neg = n < 0; n = Math.abs(n);
    const eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), won = n % 1e4;
    let s = '';
    if (eok) s += eok.toLocaleString('ko-KR') + '억';
    if (man) s += (s ? ' ' : '') + man.toLocaleString('ko-KR') + '만';
    if (won && !eok && !man) s += won.toLocaleString('ko-KR');
    else if (won) s += ' ' + won.toLocaleString('ko-KR');
    return (neg ? '-' : '') + s + '원';
  };
  DH.floor = function (n) { return Math.floor(DH.num(n)); };
  DH.clamp0 = function (n) { return Math.max(0, DH.num(n)); };

  // 금액 입력칸: input[data-money] 에 쉼표를 자동으로 붙이고,
  // 바로 뒤의 .won 요소가 있으면 한글 금액을 보여 준다.
  DH.bindMoney = function (root) {
    (root || document).querySelectorAll('input[data-money]').forEach(function (inp) {
      if (inp.dataset.bound) return;
      inp.dataset.bound = '1';
      inp.setAttribute('inputmode', 'numeric');
      inp.classList.add('money');
      const hint = inp.parentElement && inp.parentElement.querySelector('.won');
      const update = function () {
        const raw = inp.value.replace(/[^\d]/g, '');
        inp.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
        if (hint) hint.textContent = raw ? DH.kor(raw) : '';
      };
      inp.addEventListener('input', update);
      inp.addEventListener('blur', update);
      update();
    });
  };
  DH.val = function (id) { const el = document.getElementById(id); return el ? DH.num(el.value) : 0; };
  DH.set = function (id, n, opt) {
    const el = document.getElementById(id); if (!el) return;
    const v = Math.round(DH.num(n));
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = (opt && opt.raw) ? String(v) : v.toLocaleString('ko-KR');
    else el.textContent = (opt && opt.won === false) ? v.toLocaleString('ko-KR') : DH.won(v);
    const hint = el.parentElement && el.parentElement.querySelector('.won');
    if (hint) hint.textContent = v ? DH.kor(v) : '';
  };

  /* ---------- 세법 상수 (2026.10 현행) ---------- */
  DH.RULES = {
    year: 2026,
    // 상속세·증여세율: [과세표준 상한, 세율, 누진공제]
    inheritRate: [[1e8, .10, 0], [5e8, .20, 1e7], [1e9, .30, 6e7], [3e9, .40, 1.6e8], [Infinity, .50, 4.6e8]],
    lumpSum: 5e8, basic: 2e8, child: 5e7, minorPerYear: 1e7, senior: 5e7, disabledPerYear: 1e7,
    spouseMin: 5e8, spouseMax: 3e9,
    finMax: 2e8, cohabitMax: 6e8,
    funeralMin: 5e6, funeralMax: 1e7, enshrineMax: 5e6,
    appraisalMax: 5e6, appraisalStockMax: 1e7,
    reportCredit: .03, minTax: 5e5,
    surcharge: .30, surchargeMinorBig: .40,
  };
  // 상속세 산출세액
  DH.inheritTax = function (base) {
    base = DH.clamp0(base);
    if (base <= 0) return 0;
    for (const [cap, rate, ded] of DH.RULES.inheritRate) if (base <= cap) return Math.floor(base * rate - ded);
    return 0;
  };
  DH.inheritRateOf = function (base) {
    base = DH.clamp0(base);
    for (const [cap, rate, ded] of DH.RULES.inheritRate) if (base <= cap) return { rate: rate, ded: ded };
    return { rate: .5, ded: 4.6e8 };
  };
  // 장례비 인정액: 최소 500만, 최대 1천만 + 봉안·자연장지 최대 500만
  DH.funeral = function (spent, enshrine) {
    spent = DH.clamp0(spent); enshrine = DH.clamp0(enshrine);
    const a = spent < DH.RULES.funeralMin ? DH.RULES.funeralMin : Math.min(spent, DH.RULES.funeralMax);
    return a + Math.min(enshrine, DH.RULES.enshrineMax);
  };
  // 금융재산상속공제
  DH.finDeduction = function (net) {
    net = DH.clamp0(net);
    if (net <= 2e7) return net;
    if (net <= 1e8) return 2e7;
    return Math.min(Math.floor(net * .2), DH.RULES.finMax);
  };
  // 공제 종합한도(§24): 과세가액 − 상속인 외 유증 − 상속포기로 후순위가 받은 재산 − (과세가액>5억일 때만) 사전증여 과세표준
  DH.deductionLimit = function (taxableAmount, bequestToNonHeir, renounced, priorGiftTaxBase) {
    taxableAmount = DH.clamp0(taxableAmount);
    let limit = taxableAmount - DH.clamp0(bequestToNonHeir) - DH.clamp0(renounced);
    if (taxableAmount > 5e8) limit -= DH.clamp0(priorGiftTaxBase);
    return Math.max(0, limit);
  };

  /* ---------- 저장 (페이지별 키) ---------- */
  DH.storeKey = function () { return 'dh.' + (document.body.dataset.store || location.pathname.split('/').pop().replace(/\.html$/, '')) + '.v1'; };
  // 저장 대상: data-save 영역 안의 input/select/textarea 중 id 또는 name 이 있는 것
  DH.collect = function () {
    const out = {};
    document.querySelectorAll('[data-save] input, [data-save] select, [data-save] textarea').forEach(function (el) {
      const k = el.id || el.name; if (!k) return;
      if (el.type === 'checkbox') out[k] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[k] = el.value;
    });
    return out;
  };
  DH.apply = function (data) {
    if (!data) return;
    document.querySelectorAll('[data-save] input, [data-save] select, [data-save] textarea').forEach(function (el) {
      const k = el.id || el.name; if (!k) return;
      if (el.type === 'checkbox') { if (k in data) el.checked = !!data[k]; }
      else if (el.type === 'radio') { if (el.name in data) el.checked = (data[el.name] === el.value); }
      else if (k in data) el.value = data[k];
    });
    DH.bindMoney();
    document.querySelectorAll('input[data-money]').forEach(function (i) { i.dispatchEvent(new Event('input')); });
  };
  DH.save = function (extra) {
    try {
      const data = Object.assign({ _savedAt: new Date().toISOString() }, DH.collect(), extra || {});
      localStorage.setItem(DH.storeKey(), JSON.stringify(data));
      DH.toast('저장했습니다. 이 브라우저에서 다시 열면 불러올 수 있습니다.');
      return data;
    } catch (e) { DH.toast('저장할 수 없습니다. (브라우저 저장 공간 차단)', true); return null; }
  };
  DH.load = function (silent) {
    try {
      const raw = localStorage.getItem(DH.storeKey());
      if (!raw) { if (!silent) DH.toast('저장된 내용이 없습니다.', true); return null; }
      const data = JSON.parse(raw);
      DH.apply(data);
      if (!silent) DH.toast('불러왔습니다. (' + (data._savedAt ? data._savedAt.slice(0, 16).replace('T', ' ') : '') + ')');
      return data;
    } catch (e) { return null; }
  };
  DH.clear = function () {
    if (!confirm('이 페이지의 저장 내용과 입력값을 모두 지울까요?')) return;
    try { localStorage.removeItem(DH.storeKey()); } catch (e) { }
    document.querySelectorAll('[data-save] input, [data-save] select, [data-save] textarea').forEach(function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = el.defaultChecked;
      else if (el.tagName === 'SELECT') el.selectedIndex = 0;
      else if (!el.readOnly) el.value = el.defaultValue || '';
    });
    document.querySelectorAll('input[data-money]').forEach(function (i) { i.dispatchEvent(new Event('input')); });
    DH.toast('지웠습니다.');
  };
  // 옛 키(formData 등)에서 한 번 옮겨오기
  DH.migrate = function (oldKey, test) {
    try {
      if (localStorage.getItem(DH.storeKey())) return;
      const raw = localStorage.getItem(oldKey); if (!raw) return;
      const data = JSON.parse(raw);
      if (test && !test(data)) return;
      localStorage.setItem(DH.storeKey(), JSON.stringify(data));
    } catch (e) { }
  };

  /* ---------- 알림 ---------- */
  DH.toast = function (msg, bad) {
    let t = document.getElementById('dh-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'dh-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#2b2a2a;color:#fff;padding:10px 18px;border-radius:999px;font-size:13.5px;z-index:99;opacity:0;transition:opacity .2s;max-width:90vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.background = bad ? '#c0392b' : '#2b2a2a'; t.style.opacity = '1';
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.opacity = '0'; }, 2600);
  };

  /* ---------- 인쇄 ---------- */
  DH.print = function () { window.print(); };
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('details:not([open])').forEach(function (d) { d.dataset.po = '1'; d.open = true; });
    let f = document.getElementById('dh-print-foot');
    if (!f) { f = document.createElement('div'); f.id = 'dh-print-foot'; f.className = 'print-foot'; document.body.appendChild(f); }
    f.textContent = '대한세무법인 · 상속·증여 도구 · ' + location.host + location.pathname + ' · 출력 ' + new Date().toLocaleString('ko-KR') + ' · 계산 결과는 참고용입니다.';
  });
  window.addEventListener('afterprint', function () {
    document.querySelectorAll('details[data-po]').forEach(function (d) { d.open = false; delete d.dataset.po; });
  });

  /* ---------- 공통 상단바·푸터 ---------- */
  DH.chrome = function (opt) {
    opt = opt || {};
    const here = location.pathname.split('/').pop();
    const nav = [['./', '상속세', 'index.html'], ['gift.html', '상황별 증여세', 'gift.html']];
    const top = document.createElement('header'); top.className = 'dh-top';
    top.innerHTML = '<div class="wrap' + (opt.wide ? ' wide' : '') + '"><a class="logo" href="./">대한세무법인 <span>상속·증여</span></a><nav>' +
      nav.map(function (n) { return '<a href="' + n[0] + '"' + (here === n[2] ? ' class="on"' : '') + '>' + n[1] + '</a>'; }).join('') +
      '<a class="hide-m" href="https://daehantax.github.io/tax/">전체 세무 도구 →</a></nav></div>';
    document.body.prepend(top);
    if (opt.contact !== false) {
      const c = document.createElement('div'); c.className = 'dh-contact';
      c.innerHTML = '<div class="wrap"><div><h2>' + (opt.contactTitle || '복잡한 상속, 세무사와 함께 검토하세요') + '</h2><p>대한세무법인 · 성남 분당 · 상속·증여·부동산 세무</p></div>' +
        '<a class="btn" href="mailto:sjlee@taxdh.net?subject=' + encodeURIComponent((opt.subject || '상속세') + ' 상담 문의') + '">상담 문의 →</a></div>';
      document.body.appendChild(c);
    }
    const f = document.createElement('footer'); f.className = 'dh-foot';
    f.innerHTML = '© 대한세무법인 · <a href="https://tuzaga.com/" target="_blank" rel="noopener">당신의세무사</a> · 2026년 10월 시행 세법 기준<br>계산 결과는 참고용이며, 실제 신고 전 세무 전문가의 검토를 권합니다.';
    document.body.appendChild(f);
  };

  /* ---------- 자동 시작 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    DH.bindMoney();
    if (document.body.dataset.chrome !== 'off') DH.chrome({ wide: document.body.dataset.wide === '1', subject: document.body.dataset.subject, contactTitle: document.body.dataset.contactTitle });
    document.querySelectorAll('[data-action="save"]').forEach(function (b) { b.addEventListener('click', function () { DH.save(); }); });
    document.querySelectorAll('[data-action="load"]').forEach(function (b) { b.addEventListener('click', function () { DH.load(); if (window.DH_recalc) window.DH_recalc(); }); });
    document.querySelectorAll('[data-action="clear"]').forEach(function (b) { b.addEventListener('click', function () { DH.clear(); if (window.DH_recalc) window.DH_recalc(); }); });
    document.querySelectorAll('[data-action="print"]').forEach(function (b) { b.addEventListener('click', DH.print); });
    if (document.body.dataset.autoload === '1') { DH.load(true); if (window.DH_recalc) window.DH_recalc(); }
  });

  window.DH = DH;
})();
