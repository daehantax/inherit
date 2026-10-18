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

  // 종부세에서 빼 줄 재산세 중복분 (종부세법 시행령 §4의3, 국세청 신고서 산식)
  //   재산세 부과액 합계 × (종부세 과세표준 × 재산세 공정시장가액비율 × 0.4%) ÷ (주택을 합산한 재산세 과표에 표준세율을 적용한 세액)
  //   — tax-ai-consulting core/comprehensive-tax.js 와 같은 산식
  //   houses: [{ gongsi: 공시가격, base: 재산세 과세표준 }] — 공정시장가액비율은 Σ과표 ÷ Σ공시가격(1채면 그 주택 비율)
  DH.propStdTax = function (base) {
    base = DH.clamp0(base);
    if (base <= 6e7) return base * .001;
    if (base <= 1.5e8) return 6e4 + (base - 6e7) * .0015;
    if (base <= 3e8) return 1.95e5 + (base - 1.5e8) * .0025;
    return 5.7e5 + (base - 3e8) * .004;
  };
  DH.aggrPropCredit = function (propTaxSum, ctBase, houses) {
    houses = (houses || []).filter(function (h) { return h && h.gongsi > 0; });
    const g = houses.reduce(function (s, h) { return s + h.gongsi; }, 0);
    const b = houses.reduce(function (s, h) { return s + h.base; }, 0);
    const den = DH.propStdTax(b);   // '주택을 합산하여' 표준세율로 계산한 재산세 상당액
    if (!(ctBase > 0) || !(g > 0) || !(den > 0)) return 0;
    return Math.max(0, Math.min(DH.clamp0(propTaxSum), DH.clamp0(propTaxSum) * (ctBase * (b / g) * .004) / den));
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
  /* ---------- 서식 전용 인쇄 (A4 한 장에 서식만) ----------
     .form-sheet(또는 [data-print-sheet]) 만 떼어 인쇄 전용 문서를 만들고, 서식마다 A4 한 장에
     꽉 차도록 확대·축소한다. 제목·안내·결과·버튼·바닥글·브라우저 머리글(URL·날짜)은 들어가지 않는다. */
  DH.sheets = function () {
    var all = Array.prototype.slice.call(document.querySelectorAll('.form-sheet, [data-print-sheet]'));
    return all.filter(function (el) { return el.offsetParent !== null; });   // 화면에 보이는 것만
  };
  function freezeValues(root) {               // 입력값을 속성으로 굳혀 복제본에 남게 한다
    root.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.tagName === 'TEXTAREA') { el.textContent = el.value; return; }
      if (el.tagName === 'SELECT') { Array.prototype.forEach.call(el.options, function (o) { if (o.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); }); return; }
      if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) el.setAttribute('checked', ''); else el.removeAttribute('checked'); return; }
      el.setAttribute('value', el.value);
    });
  }
  function printRulesText() {                 // 모든 @media print 규칙을 화면용으로 펼쳐서 돌려준다
    var out = [];
    Array.prototype.forEach.call(document.styleSheets, function (ss) {
      var rules; try { rules = ss.cssRules; } catch (e) { return; }
      if (!rules) return;
      Array.prototype.forEach.call(rules, function (r) {
        if (r.media && /print/.test(r.media.mediaText)) Array.prototype.forEach.call(r.cssRules, function (x) { if (!(x.type === 6)) out.push(x.cssText); });
      });
    });
    return out.join('\n');
  }
  DH.buildPrintDoc = function (sheets) {
    sheets = sheets || DH.sheets();
    var head = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) { head.push('<link rel="stylesheet" href="' + l.href + '">'); });
    document.querySelectorAll('style').forEach(function (st) { head.push('<style>' + st.textContent + '</style>'); });
    head.push('<style>' + printRulesText() + '</style>');
    head.push('<style>' +
      '@page{size:A4;margin:0}@page land{size:A4 landscape;margin:0}' +
      'html,body{margin:0;padding:0;background:#fff}' +
      '.pp{width:210mm;height:296mm;padding:12mm;box-sizing:border-box;overflow:hidden;position:relative;break-after:page;page-break-after:always}' +
      '.pp.land{width:297mm;height:209mm;page:land}' +
      '.pp:last-child{break-after:auto;page-break-after:auto}' +
      '.pp .form-sheet,.pp [data-print-sheet]{border:0!important;padding:0!important;margin:0!important;box-shadow:none!important;background:#fff;break-inside:auto}' +
      '.pp .no-print,.pp .btn,.pp .actions,.pp .toolbar,.pp .dh-top,.pp .dh-contact,.pp .dh-foot,.pp .print-foot{display:none!important}' +
      '.pp table{break-inside:auto}.pp tr{break-inside:avoid}' +
      '</style>');
    var body = [];
    sheets.forEach(function (sh) {
      freezeValues(sh);
      var land = !!sh.closest('.print-landscape');
      var step = sh.closest('.step');
      var cls = 'pp' + (land ? ' land' : '') + (step ? ' ' + Array.prototype.filter.call(step.classList, function (c) { return c !== 'step' && c !== 'on'; }).join(' ') : '');
      body.push('<div class="' + cls + '"' + (step && step.id ? ' id="' + step.id + '"' : '') + '>' + sh.outerHTML + '</div>');
    });
    var script = '<script>' +
      'function ext(sh){var b=sh.getBoundingClientRect(),w=b.width,h=b.height;sh.querySelectorAll("*").forEach(function(e){var q=e.getBoundingClientRect();if(!q.width||!q.height)return;w=Math.max(w,q.right-b.left);h=Math.max(h,q.bottom-b.top);});return{w:w,h:h};}' +
      'function fit(){var mm=96/25.4;document.querySelectorAll(".pp").forEach(function(pp){var sh=pp.firstElementChild;if(!sh)return;var land=pp.classList.contains("land");' +
      'var W=(land?297:210)-24,H=(land?210:297)-24-1,r=1,cap=2.2,pad=sh.querySelector("tbody[data-pad-rows]");sh.style.transformOrigin="0 0";' +
      'function meas(){sh.style.transform="none";sh.style.width=(W/r)+"mm";var e=ext(sh);if(e.w>sh.getBoundingClientRect().width+1)cap=Math.min(cap,W*mm/e.w);return e;}' +
      'for(var i=0;i<6;i++){var e=meas();if(!e.h)break;r=Math.max(.45,Math.min(cap,H*mm/e.h));}' +
      'if(pad&&pad.lastElementChild&&r>1.25){r=Math.min(cap,1.25);var tpl=pad.lastElementChild;for(var k=0;k<80;k++){var tr=tpl.cloneNode(true);tr.querySelectorAll("input").forEach(function(x){x.removeAttribute("value");x.removeAttribute("checked");});tr.querySelectorAll("select").forEach(function(x){x.selectedIndex=0;Array.prototype.forEach.call(x.options,function(o){o.removeAttribute("selected");});});' +
      'tr.querySelectorAll("b.calc,.calc").forEach(function(x){x.textContent="";});var no=tr.querySelector("td.no,td:first-child");if(no&&/^\\d+$/.test(no.textContent.trim()))no.textContent=String(pad.children.length+1);pad.appendChild(tr);if(meas().h*r>H*mm){pad.removeChild(tr);break;}}' +
      'e=meas();r=Math.max(.45,Math.min(r,H*mm/e.h));}' +
      'sh.style.width=(W/r)+"mm";sh.style.transform="scale("+r+")";pp.dataset.zoom=r.toFixed(3);});window.__sheetsFitted=true;document.dispatchEvent(new Event("sheetsfitted"));}' +
      'function go(){(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(fit,30);});}' +
      'if(document.readyState==="complete")go();else window.addEventListener("load",go);' +
      '<\/script>';
    return '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>' + document.title.replace(' · 대한세무법인', '') + '</title>' + head.join('\n') + '</head><body class="print-all print-doc">' + body.join('\n') + script + '</body></html>';
  };
  DH.printSheets = function (sheets) {
    var html = DH.buildPrintDoc(sheets);
    var old = document.getElementById('dh-print-frame'); if (old) old.remove();
    var f = document.createElement('iframe'); f.id = 'dh-print-frame';
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(f);
    var done = false;
    var fire = function () {
      if (done) return; done = true;
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { window.print(); }
      setTimeout(function () { f.remove(); }, 60000);
    };
    f.addEventListener('load', function () {
      var w = f.contentWindow;
      if (w.__sheetsFitted) fire(); else { w.document.addEventListener('sheetsfitted', fire); setTimeout(fire, 2500); }
    });
    f.srcdoc = html;
  };
  DH.print = function () { if (DH.sheets().length) DH.printSheets(); else window.print(); };
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'P') && DH.sheets().length) { e.preventDefault(); DH.printSheets(); }
  });
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('details:not([open])').forEach(function (d) { d.dataset.po = '1'; d.open = true; });
    if (DH.sheets().length) return;                  // 서식 페이지: 바닥글 없음 (서식만 인쇄)
    let f = document.getElementById('dh-print-foot');
    if (!f) { f = document.createElement('div'); f.id = 'dh-print-foot'; f.className = 'print-foot'; document.body.appendChild(f); }
    f.textContent = '대한세무법인 · 상속·증여 도구 · ' + location.host + location.pathname + ' · 출력 ' + new Date().toLocaleString('ko-KR') + ' · 계산 결과는 참고용입니다.';
  });
  window.addEventListener('afterprint', function () {
    document.querySelectorAll('details[data-po]').forEach(function (d) { d.open = false; delete d.dataset.po; });
  });

  /* ---------- 상담 접수 (구글 시트, 기존 Apps Script 엔드포인트) ---------- */
  DH.CONSULT_URL = 'https://script.google.com/macros/s/AKfycbzI15I_g4DyBabMwo1xntqq5SKV_mAcPWNGrK9Woa95pPa7NXOZ8VNDr53eaAHmq1fMCQ/exec';   // 체납 자가진단 접수명단 시트 (탭: 상속 접수 / 상속 문의)
  // 계산기 페이지는 window.DH_summary = () => '예상 상속세 1.1억 (재산 18억…)' 를 정의하면 접수에 함께 담긴다.
  DH.consultHtml = function (opt) {
    opt = opt || {};
    const hasSummary = typeof window.DH_summary === 'function';
    return '<form class="dh-consult" id="dhConsult" novalidate>' +
      '<div class="dh-consult-head"><h2>' + (opt.title || '복잡한 상속, 세무사가 직접 확인해 드립니다') + '</h2>' +
      '<p>' + (opt.lead || '연락처만 남기시면 대한세무법인 담당자가 전화드립니다. 상담은 무료입니다.') + '</p></div>' +
      '<div class="dh-consult-opts top">' +
      '<label class="check"><input type="checkbox" id="dhAgree"> 상담 연락을 위한 개인정보(이름·연락처) 수집에 동의합니다</label>' +
      (hasSummary ? '<label class="check"><input type="checkbox" id="dhWithCalc" checked> 이 페이지의 계산 결과를 함께 보냅니다</label>' : '') +
      '</div>' +
      '<div class="dh-consult-row">' +
      '<input type="text" id="dhName" placeholder="성함" autocomplete="name" maxlength="20">' +
      '<input type="tel" id="dhPhone" placeholder="연락처 (010-0000-0000)" autocomplete="tel" inputmode="tel" required>' +
      '<button type="submit" class="btn" id="dhSend">무료 상담 신청</button></div>' +
      '<div class="dh-consult-opts">' +
      '</div><div class="dh-consult-msg" id="dhMsg" hidden></div></form>';
  };
  DH.bindConsult = function () {
    const f = document.getElementById('dhConsult'); if (!f || f.dataset.bound) return; f.dataset.bound = '1';
    const msg = document.getElementById('dhMsg');
    const show = function (t, bad) { msg.hidden = false; msg.textContent = t; msg.className = 'dh-consult-msg' + (bad ? ' bad' : ' ok'); };
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = (document.getElementById('dhName').value || '').trim();
      const phone = (document.getElementById('dhPhone').value || '').trim();
      if (!/\d{9,}/.test(phone.replace(/[^\d]/g, '')) ) { show('연락처를 확인해 주세요.', true); document.getElementById('dhPhone').focus(); return; }
      if (!document.getElementById('dhAgree').checked) { show('개인정보 수집에 동의해 주세요.', true); return; }
      const withCalc = document.getElementById('dhWithCalc'); let summary = '';
      if (withCalc && withCalc.checked && typeof window.DH_summary === 'function') { try { summary = String(window.DH_summary() || ''); } catch (e) { } }
      const page = document.title.replace(' · 대한세무법인', '');
      const tags = ['[상속 랜딩] ' + page, name ? '이름: ' + name : '', summary].filter(Boolean).join(' / ');
      const btn = document.getElementById('dhSend'); btn.disabled = true; btn.textContent = '보내는 중…';
      try {
        await fetch(DH.CONSULT_URL, { method: 'POST', body: JSON.stringify({ form: 'inherit', page: page, phone: phone, tags: tags, name: name, source: 'inherit/' + location.pathname.split('/').pop(), summary: summary, at: new Date().toISOString() }) });
        show('접수되었습니다. 담당자가 영업일 기준 1일 안에 연락드립니다.' + (name ? ' (' + name + '님)' : ''));
        f.reset(); if (withCalc) withCalc.checked = true;
        try { localStorage.setItem('dh.consult.sent', new Date().toISOString()); } catch (e) { }
      } catch (err) {
        const body = encodeURIComponent('이름: ' + name + '\n연락처: ' + phone + '\n페이지: ' + page + '\n' + summary);
        show('전송에 실패했습니다. 전화 또는 이메일로 문의해 주세요.', true);
        msg.innerHTML += ' <a href="mailto:sjlee@taxdh.net?subject=' + encodeURIComponent('[상속세 상담] ' + name) + '&body=' + body + '">이메일로 보내기</a>';
      } finally { btn.disabled = false; btn.textContent = '무료 상담 신청'; }
    });
  };

  /* ---------- 장애인공제 기대여명 찾기 (상증법 §20①4호·③) ----------
     국가데이터처 「2024년 완전생명표(1세별)」 2025.12.3. 공표, 성별·연령별 기대여명(년).
     공제 연수 = 기대여명의 1년 미만을 1년으로 올림(§20③). 상속개시일 현재 고시된 표를 쓴다. */
  DH.LIFE_TABLE = {
    year: 2024, published: '2025-12-03',
    source: 'https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1B42',
    m: [80.8,80,79,78.1,77.1,76.1,75.1,74.1,73.1,72.1,71.1,70.1,69.1,68.1,67.1,66.1,65.1,64.2,63.2,62.2,61.2,60.2,59.3,58.3,57.3,56.3,55.4,54.4,53.4,52.5,51.5,50.5,49.6,48.6,47.6,46.7,45.7,44.7,43.8,42.8,41.9,40.9,40,39,38.1,37.2,36.2,35.3,34.4,33.5,32.5,31.6,30.7,29.8,28.9,28.1,27.2,26.3,25.4,24.6,23.7,22.9,22,21.2,20.4,19.5,18.7,17.9,17.1,16.3,15.5,14.8,14,13.3,12.6,11.8,11.1,10.5,9.8,9.1,8.5,7.9,7.4,6.9,6.4,5.9,5.5,5.1,4.7,4.3,4,3.7,3.4,3.2,2.9,2.7,2.5,2.3,2.2,2,1.9],
    f: [86.6,85.8,84.8,83.8,82.8,81.8,80.8,79.8,78.8,77.8,76.8,75.8,74.8,73.9,72.9,71.9,70.9,69.9,68.9,67.9,66.9,66,65,64,63,62,61.1,60.1,59.1,58.1,57.1,56.2,55.2,54.2,53.2,52.3,51.3,50.3,49.3,48.4,47.4,46.4,45.5,44.5,43.6,42.6,41.6,40.7,39.7,38.8,37.8,36.9,35.9,35,34,33.1,32.1,31.2,30.3,29.3,28.4,27.5,26.5,25.6,24.7,23.7,22.8,21.9,21,20.1,19.2,18.3,17.4,16.6,15.7,14.9,14,13.2,12.4,11.6,10.9,10.2,9.5,8.8,8.2,7.6,7,6.5,6,5.5,5.1,4.7,4.3,4,3.7,3.4,3.1,2.9,2.7,2.5,2.3]
  };
  DH.lifeExpectancy = function (sex, age) {
    const t = DH.LIFE_TABLE[sex === 'f' ? 'f' : 'm']; const a = Math.max(0, Math.min(100, Math.floor(Number(age) || 0)));
    return t[a];
  };
  DH.lifeYears = function (sex, age) { const e = DH.lifeExpectancy(sex, age); return Math.ceil(e - 1e-9); };   // 1년 미만은 1년
  DH.openLifeHelper = function (target) {
    let box = document.getElementById('dhLife');
    if (!box) {
      box = document.createElement('div'); box.id = 'dhLife'; box.className = 'dh-life no-print'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      box.innerHTML = '<div class="dh-life-card"><div class="dh-life-head"><b>장애인 기대여명 찾기</b><button type="button" class="dh-life-x" aria-label="닫기">×</button></div>' +
        '<p class="dh-life-lead">장애인마다 성별과 <b>상속개시일 현재 만 나이</b>를 넣으세요. 기대여명의 1년 미만은 1년으로 올려 계산합니다(상증법 §20③).</p>' +
        '<table class="dh dh-life-t"><thead><tr><th>성별</th><th>만 나이</th><th>기대여명</th><th>공제 연수</th><th class="lf-a">공제액</th><th></th></tr></thead><tbody></tbody>' +
        '<tfoot><tr class="total"><td colspan="3" class="c">합계</td><td class="num" id="dhLifeYears">0년</td><td class="num lf-a" id="dhLifeAmt">0원</td><td></td></tr></tfoot></table>' +
        '<div class="dh-life-btns"><button type="button" class="btn ghost sm" id="dhLifeAdd">+ 장애인 추가</button><span class="sp"></span><button type="button" class="btn ghost sm dh-life-x">취소</button><button type="button" class="btn sm" id="dhLifeApply">합계 연수 넣기</button></div>' +
        '<p class="dh-life-src">기준: 국가데이터처 「' + DH.LIFE_TABLE.year + '년 완전생명표(1세별)」 (' + DH.LIFE_TABLE.published.replace(/-/g, '.') + '. 공표) · <a href="' + DH.LIFE_TABLE.source + '" target="_blank" rel="noopener">KOSIS에서 확인</a><br>상속개시일이 이 공표일 전이면 직전 연도 생명표를 적용합니다. 장애인은 상속인·동거가족 중 「장애인복지법」 등록 장애인, 중증환자 등(상증령 §18②)이며 배우자도 포함됩니다.</p></div>';
      document.body.appendChild(box);
      const tb = box.querySelector('tbody');
      const row = function (sex, age) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><select class="lf-sex"><option value="m">남</option><option value="f">여</option></select></td>' +
          '<td><input type="number" class="lf-age short" min="0" max="120" placeholder="세"></td><td class="num lf-e"></td><td class="num lf-y"></td><td class="num lf-a"></td>' +
          '<td><button type="button" class="row-del" aria-label="삭제">×</button></td>';
        if (sex) tr.querySelector('.lf-sex').value = sex; if (age != null) tr.querySelector('.lf-age').value = age;
        tb.appendChild(tr); return tr;
      };
      const recalc = function () {
        let ys = 0;
        [...tb.querySelectorAll('tr')].forEach(function (tr, i) {
          const age = tr.querySelector('.lf-age').value;
          if (age === '') { tr.querySelector('.lf-e').textContent = tr.querySelector('.lf-y').textContent = tr.querySelector('.lf-a').textContent = ''; return; }
          const sex = tr.querySelector('.lf-sex').value, e = DH.lifeExpectancy(sex, age), y = DH.lifeYears(sex, age); ys += y;
          tr.querySelector('.lf-e').textContent = e.toFixed(1) + '년'; tr.querySelector('.lf-y').textContent = y + '년'; tr.querySelector('.lf-a').textContent = DH.fmt(y * 1e7) + '원';
        });
        box.querySelector('#dhLifeYears').textContent = ys + '년'; box.querySelector('#dhLifeAmt').textContent = DH.fmt(ys * 1e7) + '원';
        box.dataset.years = ys;
      };
      box._row = row; box._recalc = recalc;
      box.addEventListener('input', recalc); box.addEventListener('change', recalc);
      box.addEventListener('click', function (e) {
        if (e.target === box || e.target.closest('.dh-life-x')) { box.classList.remove('open'); return; }
        if (e.target.closest('.row-del')) { const tr = e.target.closest('tr'); if (tb.children.length > 1) tr.remove(); else { tr.querySelector('.lf-age').value = ''; } recalc(); return; }
        if (e.target.closest('#dhLifeAdd')) { row().querySelector('.lf-age').focus(); recalc(); return; }
        if (e.target.closest('#dhLifeApply')) {
          const t = box._target; if (t) { t.value = box.dataset.years || 0; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }
          box.classList.remove('open'); if (t) t.focus();
        }
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('open'); });
    }
    box._target = target;
    const tb = box.querySelector('tbody'); if (!tb.children.length) box._row('m', null);
    box._recalc(); box.classList.add('open');
    const first = tb.querySelector('.lf-age'); if (first) setTimeout(function () { first.focus(); }, 30);
  };
  DH.bindLifeHelper = function () {
    document.querySelectorAll('input#disabledYears').forEach(function (inp) {
      if (inp.dataset.lifeBound) return; inp.dataset.lifeBound = '1';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dh-life-btn no-print'; b.textContent = '기대여명 찾기 ▸';
      b.title = '성별·나이로 2024년 생명표 기대여명을 찾아 넣습니다';
      inp.insertAdjacentElement('afterend', b);
      b.addEventListener('click', function () { DH.openLifeHelper(inp); });
    });
  };
  document.addEventListener('DOMContentLoaded', function () { DH.bindLifeHelper(); });

  /* ---------- 폰 메뉴(≡) : 720px 이하에서 nav 를 접고 버튼으로 펼친다 ---------- */
  DH.mobileNav = function () {
    document.querySelectorAll('header.top .wrap, header.dh-top .wrap').forEach(function (w) {
      if (w.querySelector('.menu-btn')) return;
      var nav = w.querySelector('nav'); if (!nav) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'menu-btn'; b.setAttribute('aria-label', '메뉴'); b.setAttribute('aria-expanded', 'false');
      b.innerHTML = '<span></span><span></span><span></span>';
      w.appendChild(b);
      b.addEventListener('click', function () { var on = w.classList.toggle('nav-open'); b.setAttribute('aria-expanded', on ? 'true' : 'false'); });
      document.addEventListener('click', function (e) { if (!w.contains(e.target)) { w.classList.remove('nav-open'); b.setAttribute('aria-expanded', 'false'); } });
    });
  };
  document.addEventListener('DOMContentLoaded', function () { DH.mobileNav(); });

  /* ---------- 공통 상단바·푸터 ---------- */
  DH.chrome = function (opt) {
    opt = opt || {};
    const here = location.pathname.split('/').pop();
    const nav = [['./', '상속세', 'index.html'], ['gift.html', '상황별 증여세', 'gift.html'], ['about.html', '소개', 'about.html'], ['guide.html', '사용 안내', 'guide.html']];
    const top = document.createElement('header'); top.className = 'dh-top';
    top.innerHTML = '<div class="wrap' + (opt.wide ? ' wide' : '') + '"><a class="logo" href="./">대한세무법인 <span>상속·증여</span></a><nav>' +
      nav.map(function (n) { return '<a href="' + n[0] + '"' + (here === n[2] ? ' class="on"' : '') + '>' + n[1] + '</a>'; }).join('') +
      '<a href="https://daehantax.com/info.html" target="_blank" rel="noopener">블로그</a></nav></div>';
    document.body.prepend(top);
    DH.mobileNav();
    if (opt.contact !== false) {
      const c = document.createElement('div'); c.className = 'dh-contact no-print'; c.id = 'contact';
      c.innerHTML = '<div class="wrap">' + DH.consultHtml({ title: opt.contactTitle }) + '</div>';
      document.body.appendChild(c);
      DH.bindConsult();
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
