/* ============================================================
   입력 화면(estate.html) 동작
   - 상속 파일(EST) 하나를 화면 A~F 가 같이 고친다
   - 입력칸은 data-path="h.<상속인id>.age" 처럼 상속 파일 위치를 가리킨다
     data-type: money(만원으로 입력, 원으로 저장) · int · text · bool · sel
   - 바뀔 때마다 0.3초 뒤 저장하고 오른쪽 요약을 다시 계산한다
   ============================================================ */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const kor = function (n) { n = Math.round(Number(n) || 0); return n ? SAVINGS_KOR(n) : ''; };
  function SAVINGS_KOR(n) {
    const neg = n < 0; n = Math.abs(n);
    const eok = Math.floor(n / 1e8), man = Math.round((n % 1e8) / 1e4);
    let s = ''; if (eok) s += eok.toLocaleString('ko-KR') + '억'; if (man) s += (s ? ' ' : '') + man.toLocaleString('ko-KR') + '만';
    if (!s) s = n.toLocaleString('ko-KR');
    return (neg ? '-' : '') + s + '원';
  }
  const SCREENS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const cur = EST.current();
  const E = cur.e;
  E.meta = E.meta || {};

  /* ---------- 경로 읽기·쓰기 ---------- */
  function target(path, create) {
    const p = path.split('.');
    if (p[0] === 'd') return { obj: E.deceased, key: p[1] };
    if (p[0] === 'h') { const h = E.heirs.find(function (x) { return x.id === p[1]; }); return h ? { obj: h, key: p[2] } : null; }
    if (p[0] === 'a') {
      let a = E.assets.find(function (x) { return x.id === p[1]; });
      if (!a && create && /^fin_/.test(p[1])) { a = { id: p[1], type: p[1].slice(4) }; E.assets.push(a); }
      return a ? { obj: a, key: p[2] } : null;
    }
    if (p[0] === 'g') { const g = E.gifts.find(function (x) { return x.id === p[1]; }); return g ? { obj: g, key: p[2] } : null; }
    if (p[0] === 'p') { E.priors = E.priors || []; const q = E.priors.find(function (x) { return x.id === p[1]; }); return q ? { obj: q, key: p[2] } : null; }
    if (p[0] === 'debts' || p[0] === 'funeral' || p[0] === 'misc') { E[p[0]] = E[p[0]] || {}; return { obj: E[p[0]], key: p[1] }; }
    return null;
  }
  function getVal(path) { const t = target(path); return t ? t.obj[t.key] : undefined; }
  function setVal(path, v) { const t = target(path, true); if (t) { if (v === '' || v === null || v === undefined) delete t.obj[t.key]; else t.obj[t.key] = v; } }

  /* ---------- 입력칸 만들기 ---------- */
  function money(path, opt) {
    opt = opt || {};
    const v = Number(getVal(path)) || 0;
    const id = 'f_' + path.replace(/\./g, '_');
    const lockN = (window.FIL ? FIL.locked(E) : {})[path];
    const sec = /^a\.fin_/.test(path) ? 'fin' : 'debt';
    return '<input type="text" inputmode="numeric" autocomplete="off" id="' + id + '" data-path="' + path + '" data-type="money" value="' + (v ? Math.round(v / 1e4).toLocaleString('ko-KR') : '') + '" placeholder="' + (opt.ph || '0') + '"' + (lockN ? ' readonly class="locked" title="신고서 채우기에서 건별로 적은 합계입니다"' : '') + '><span class="unit">만원</span><span class="kor">' + (v ? kor(v) : '') + '</span>' +
      (lockN ? '<a class="es-lock" href="filing.html#s=' + sec + '">건별 ' + lockN + '건 합계 · 신고서 채우기에서 고치기 →</a>' : '');
  }
  function intIn(path, opt) {
    opt = opt || {};
    const v = getVal(path);
    return '<input type="number" class="num" min="0" max="' + (opt.max || 120) + '" inputmode="numeric" id="f_' + path.replace(/\./g, '_') + '" data-path="' + path + '" data-type="int" value="' + (v === undefined || v === '' ? '' : esc(v)) + '" placeholder="' + (opt.ph || '') + '"><span class="unit">' + (opt.unit || '') + '</span>';
  }
  function textIn(path, cls, ph) {
    return '<input type="text" class="' + (cls || '') + '" id="f_' + path.replace(/\./g, '_') + '" data-path="' + path + '" data-type="text" value="' + esc(getVal(path) || '') + '" placeholder="' + esc(ph || '') + '">';
  }
  function check(path, label, invert) {
    const v = getVal(path);
    const on = invert ? v === false : !!v;
    return '<label class="check"><input type="checkbox" id="f_' + path.replace(/\./g, '_') + '" data-path="' + path + '" data-type="bool"' + (invert ? ' data-invert="1"' : '') + (on ? ' checked' : '') + '> ' + label + '</label>';
  }
  function sel(path, options, blank) {
    const v = getVal(path);
    return '<select id="f_' + path.replace(/\./g, '_') + '" data-path="' + path + '" data-type="sel">' + (blank ? '<option value="">' + blank + '</option>' : '') +
      options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function row(label, ctl, small) { return '<div class="es-row"><span class="lab">' + label + (small ? '<small>' + small + '</small>' : '') + '</span><div class="es-ctl">' + ctl + '</div></div>'; }

  /* ---------- A. 가족 ---------- */
  function heirName(h) { const i = E.heirs.filter(function (x) { return x.rel === h.rel; }).indexOf(h) + 1; return EST.heirLabel(h, i); }
  function renderA() {
    $('deathDate').value = E.deceased.date || '';
    const sp = E.heirs.some(function (h) { return h.rel === 'spouse'; });
    document.querySelectorAll('input[name="hasSpouse"]').forEach(function (r) { r.checked = E.meta.family ? (r.value === (sp ? 'yes' : 'no')) : false; });
    const kids = E.heirs.filter(function (h) { return h.rel === 'child'; }).length;
    $('kidsOut').textContent = kids;
    $('addParent').hidden = kids > 0 || E.heirs.some(function (h) { return h.rel === 'grandchild' && h.substitute; });
    const list = $('heirList');
    if (!E.heirs.length) { list.innerHTML = '<p class="es-empty">배우자와 자녀 수를 고르면 여기에 가족이 나타납니다.</p>'; return; }
    list.innerHTML = E.heirs.map(function (h) {
      const base = 'h.' + h.id + '.';
      const removable = h.rel === 'grandchild' || h.rel === 'parent' || h.rel === 'other';
      let html = '<div class="es-item" data-heir="' + h.id + '"><div class="es-item-head"><div><span class="rel">' + esc(EST.REL[h.rel]) + '</span><b>' + esc(heirName(h)) + '</b></div>' +
        (removable ? '<button type="button" class="es-del" data-del-heir="' + h.id + '">삭제</button>' : '') + '</div>';
      html += row('부르는 이름', textIn(base + 'name', 'name', EST.REL[h.rel]));
      html += row('나이', intIn(base + 'age', { unit: '세', ph: '만 나이' }), h.rel === 'spouse' ? '' : '19세 미만·65세 이상이면 공제가 늘어납니다');
      html += row('지금 가진 집 (세대 전체)', sel(base + 'houses', [['0', '없음'], ['1', '1채'], ['2', '2채'], ['3', '3채 이상']], '고르세요'), '상속받는 집은 빼고, 함께 사는 배우자·자녀 집까지 합쳐서');
      if (Number(h.houses) >= 1) html += row('그 집 공시가격', money(base + 'ownGongsi', { ph: '모르면 비움' }), '여러 채면 합계 · 종부세 계산용');
      let more = '';
      if (h.rel === 'child' || h.rel === 'grandchild') more += row('돌아가신 분과 같이 산 햇수', intIn(base + 'livedYears', { unit: '년', max: 80 }), '10년 이상이면 같이 살던 집 공제 대상') + '<p data-teach="T06"></p>';
      more += row('장애인 공제', intIn(base + 'disabledYears', { unit: '년', max: 100 }) + ' <button type="button" class="dh-life-btn" data-life="' + base + 'disabledYears">기대여명 찾기 ▸</button>', '등록 장애인이면 기대여명 연수 × 1천만원');
      if (h.rel === 'grandchild') more += row('먼저 돌아가신 자녀 대신 받나요?', check(base + 'substitute', '네, 부모(돌아가신 분의 자녀)가 먼저 돌아가셨습니다'), '이 경우는 할증(30%)이 없습니다');
      html += '<details class="es-more"' + (h.livedYears || h.disabledYears || h.rel === 'grandchild' ? ' open' : '') + '><summary>더 알려 주시면 더 정확해집니다</summary>' + more + '</details>';
      return html + '</div>';
    }).join('');
    TEACH.render(list);
  }

  /* ---------- B. 집·땅 ---------- */
  const REAL_TYPES = ['apt', 'house', 'officetel', 'shop', 'land', 'farm', 'bunyang'];
  const PLANS = [['keep', '계속 가지고 있을 생각'], ['soon', '1년 안에 팔 생각'], ['y3', '3년쯤 뒤 팔 생각'], ['y5', '5년쯤 뒤 팔 생각'], ['y10', '10년쯤 뒤 팔 생각']];
  function renderB() {
    const list = $('assetList');
    const items = E.assets.filter(function (a) { return REAL_TYPES.indexOf(a.type) >= 0; });
    if (!items.length) { list.innerHTML = '<p class="es-empty">집이나 땅이 없으면 다음으로 넘어가세요.</p>'; return; }
    list.innerHTML = items.map(function (a, i) {
      const base = 'a.' + a.id + '.';
      const T = EC.TYPES[a.type];
      let html = '<div class="es-item" data-asset="' + a.id + '"><div class="es-item-head"><div><span class="rel">' + (i + 1) + '</span><b>' + esc(a.name || T.label) + '</b></div><button type="button" class="es-del" data-del-asset="' + a.id + '">삭제</button></div>';
      html += row('종류', sel(base + 'type', REAL_TYPES.map(function (t) { return [t, EC.TYPES[t].label]; })));
      html += row('이름', textIn(base + 'name', '', '예: 분당 아파트'), '나중에 알아보기 쉽게');
      if (T.bunyang) {
        html += row('지금까지 낸 돈', money(base + 'paid'), '계약금·중도금 합계');
        html += row('프리미엄', money(base + 'premium', { ph: '모르면 비움' }), '지금 팔면 더 받을 수 있는 금액');
        html += '<p data-teach="T07"></p>';
      } else {
        const mkt = a.type === 'apt' || a.type === 'officetel';
        html += row('시세', money(base + 'value', { ph: '모르면 비움' }), mkt ? '최근 같은 단지·면적 거래가 (이 금액으로 평가)' : '참고용 · 땅·단독주택·상가는 보통 공시가격으로 평가');
        html += row('공시가격', money(base + 'gongsi', { ph: '모르면 비움' }), a.type === 'land' || a.type === 'farm' ? '개별공시지가 × 면적' : '주택·건물 공시가격');
        if (!mkt) html += row('감정평가', check(base + 'basis', '감정평가를 받았거나 받을 예정 (시세로 평가)'));
      }
      if (T.house) {
        html += row('같이 산 집인가요?', check(base + 'lived', '돌아가신 분과 자녀가 10년 넘게 같이 산 집'));
        if (a.lived) html += row('이 집에 걸린 대출', money(base + 'secured', { ph: '없으면 비움' }), '빚(D 화면)에 넣은 대출 중 이 집 담보분');
      }
      if (!T.bunyang) {
        html += row('앞으로 이 ' + (T.house ? '집' : '부동산') + '은', sel(base + 'sellPlan', PLANS, '고르세요'));
        if (EC.sells(a)) html += row('팔 때 예상 가격', money(base + 'sellPrice', { ph: '시세와 같으면 비움' })) + '<p data-teach="T05"></p>';
      }
      let more = row('지역', check(base + 'metro', '수도권(서울·경기·인천)이 아님', true));
      if (T.house) more += row('면적', check(base + 'small', '전용 85㎡(약 33평)가 넘음', true), '넘으면 취득세에 농특세 0.2%가 붙습니다');
      html += '<details class="es-more"><summary>지역·면적</summary>' + more + '</details>';
      return html + '</div>';
    }).join('');
    TEACH.render(list);
  }

  /* ---------- C. 예금·그 밖의 재산 ---------- */
  const FIN = [
    ['deposit', '예금·적금', '돌아가신 날 잔액 합계', 'T08'],
    ['stock', '주식·펀드', '돌아가신 날 앞뒤 2개월 평균(상장주식)', ''],
    ['insurance', '사망보험금', '돌아가신 분이 보험료를 낸 보험', 'T09'],
    ['retire', '퇴직금·퇴직연금', '회사에서 받을 돈', ''],
    ['car', '자동차', '중고 시세', ''],
    ['other', '그 밖의 재산', '회원권·빌려준 돈·전세보증금(받을 돈) 등', '']
  ];
  function renderC() {
    $('finList').innerHTML = FIN.map(function (f) {
      const path = 'a.fin_' + f[0] + '.value';
      let html = row(f[1], money(path), f[2]);
      if (f[0] === 'insurance') { const a = E.assets.find(function (x) { return x.id === 'fin_insurance'; }); if (a && a.value) html += row('', check('a.fin_insurance.premiumByOther', '보험료는 돌아가신 분이 아닌 다른 사람이 냈습니다')); }
      if (f[3]) html += '<p data-teach="' + f[3] + '"></p>';
      return html;
    }).join('');
    TEACH.render($('finList'));
  }

  /* ---------- D. 빚·장례비 ---------- */
  function renderD() {
    $('debtList').innerHTML =
      '<h3 class="subhead">빚</h3>' +
      row('은행 대출', money('debts.loan'), '주택담보대출·신용대출 등 금융기관 빚') +
      row('돌려줄 보증금', money('debts.deposit'), '세입자에게 돌려줄 전세·월세 보증금') + '<p data-teach="T11"></p>' +
      row('밀린 세금·공과금', money('debts.tax'), '돌아가신 날까지 나온 세금·건강보험료 등') +
      row('그 밖의 빚', money('debts.other'), '병원비, 갚을 개인 빚(차용증 등 증빙)') +
      '<h3 class="subhead">장례비</h3>' +
      row('장례비', money('funeral.cost'), '장례식장·상조·음식·묘지 등') +
      row('봉안시설·자연장지', money('funeral.grave'), '납골당 등 (따로 500만원까지)') + '<p data-teach="T12"></p>';
    TEACH.render($('debtList'));
  }

  /* ---------- E. 미리 준 재산 ---------- */
  function renderE() {
    const has = E.gifts.length > 0 || E.meta.gifts === 'yes';
    document.querySelectorAll('input[name="hasGifts"]').forEach(function (r) { r.checked = E.meta.gifts ? r.value === (has ? 'yes' : 'no') : (has && r.value === 'yes'); });
    $('addGift').hidden = !has;
    const opts = E.heirs.map(function (h) { return [h.id, heirName(h)]; }).concat([['other', '가족 외의 사람']]);
    $('giftList').innerHTML = !has ? '' : (E.gifts.length ? E.gifts.map(function (g, i) {
      const base = 'g.' + g.id + '.';
      return '<div class="es-item"><div class="es-item-head"><div><span class="rel">' + (i + 1) + '</span><b>미리 준 재산</b></div><button type="button" class="es-del" data-del-gift="' + g.id + '">삭제</button></div>' +
        row('받은 사람', sel(base + 'to', opts, '고르세요')) +
        row('준 해', intIn(base + 'year', { unit: '년', max: 2100, ph: '2020' })) +
        row('준 재산 가액', money(base + 'value'), '그때 평가한 금액(증여세 신고 금액)') +
        '<details class="es-more"' + (g.taxBase || g.taxPaid ? ' open' : '') + '><summary>증여세를 냈다면</summary>' +
        row('그때 과세표준', money(base + 'taxBase', { ph: '모르면 비움' }), '증여세 신고서의 과세표준') +
        row('그때 낸 증여세', money(base + 'taxPaid'), '상속세에서 빼 줍니다') + '<p data-teach="T14"></p></details></div>';
    }).join('') : '<p class="es-empty">아래 버튼으로 추가하세요.</p>');
    TEACH.render($('giftList'));
    renderPriors();
  }
  // 단기재상속: 돌아가신 분이 10년 안에 받은 상속
  function renderPriors() {
    E.priors = E.priors || [];
    const has = E.priors.length > 0;
    document.querySelectorAll('input[name="hasPriors"]').forEach(function (r) { r.checked = E.meta.priors ? r.value === (has ? 'yes' : 'no') : (has && r.value === 'yes'); });
    $('priorList').innerHTML = E.priors.map(function (q) {
      const base = 'p.' + q.id + '.';
      const c = EC.shortCredit(q, E.deceased.date);
      return '<div class="es-item"><div class="es-item-head"><div><b>그때의 상속</b></div><button type="button" class="es-del" data-del-prior="' + q.id + '">삭제</button></div>' +
        row('그때 돌아가신 분', textIn(base + 'who', 'name', '예: 아버지')) +
        row('그때 돌아가신 날', '<input type="date" id="f_p_' + q.id + '_date" data-path="' + base + 'date" data-type="text" value="' + esc(q.date || '') + '">', '이번에 돌아가신 날까지 10년 안이어야 합니다') +
        row('그때 상속세 산출세액', money(base + 'prevTax'), '그때 신고서의 산출세액(할증 포함)') +
        row('그때 상속재산가액', money(base + 'prevEstate'), '빚·장례비 빼기 전 전체 재산, 사전증여 포함') +
        row('그중 이번에 다시 상속되는 재산', money(base + 'reinherit'), '그때 평가한 금액 기준') +
        '<p class="es-note prior-out">' + (c.years ? (c.years + '년 이내 · 공제율 ' + Math.round(c.rate * 100) + '%' + (c.amount ? ' · 공제액 약 ' + kor(c.amount) + ' (이번 상속세 한도 안에서)' : '')) : (q.date && E.deceased.date ? '10년이 지나 공제 대상이 아닙니다.' : '두 날짜를 넣으면 공제율이 나옵니다.')) + '</p></div>';
    }).join('');
  }

  /* ---------- F. 나누기 ---------- */
  function shareMode(a) {
    if (a.splitMode === 'custom') return 'custom';
    const sp = (a.split || []).filter(function (s) { return Number(s.share) > 0; });
    if (!sp.length) return 'legal';
    if (sp.length === 1) return sp[0].heir;
    return 'custom';
  }
  function splitGroups() {
    const real = E.assets.filter(function (a) { return REAL_TYPES.indexOf(a.type) >= 0 && EC.assetValue(a) > 0; });
    const money = E.assets.filter(function (a) { return REAL_TYPES.indexOf(a.type) < 0 && EC.assetValue(a) > 0; });
    const g = real.map(function (a) { return { key: a.id, name: a.name || EC.TYPES[a.type].label, value: EC.assetValue(a), assets: [a] }; });
    if (money.length) g.push({ key: '_money', name: '예금·그 밖의 재산 전체', value: money.reduce(function (s, a) { return s + EC.assetValue(a); }, 0), assets: money });
    return g;
  }
  function renderF() {
    const groups = splitGroups(), L = EC.legalShares(E);
    const legalText = E.heirs.filter(function (h) { return L[h.id] > 0; }).map(function (h) { return heirName(h) + ' ' + Math.round(L[h.id] * 1000) / 10 + '%'; }).join(' · ');
    if (!E.heirs.length || !groups.length) { $('splitList').innerHTML = '<p class="es-empty">가족(A)과 재산(B·C)을 먼저 넣어 주세요.</p>'; $('splitTable').innerHTML = ''; return; }
    $('splitList').innerHTML = '<p class="es-note" style="margin-bottom:10px">법에 정한 비율: ' + esc(legalText || '—') + '</p>' + groups.map(function (g) {
      const a = g.assets[0], mode = shareMode(a);
      const opts = [['legal', '법에 정한 비율대로']].concat(E.heirs.map(function (h) { return [h.id, heirName(h) + ' 전부']; })).concat([['custom', '직접 나누기 (%)']]);
      let html = '<div class="split-row" data-group="' + g.key + '"><div class="top"><b>' + esc(g.name) + '<small>' + kor(g.value) + '</small></b>' +
        '<select data-split-mode="' + g.key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (mode === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
      if (mode === 'custom') {
        const s = EC.sharesOf(E, a);
        html += '<div class="split-pcts">' + E.heirs.map(function (h) { return '<label>' + esc(heirName(h)) + ' <input type="number" min="0" max="100" step="1" data-split-pct="' + g.key + '" data-heir="' + h.id + '" value="' + Math.round((s[h.id] || 0) * 1000) / 10 + '">%</label>'; }).join('') + '</div>';
        const t = (a.split || []).reduce(function (x, y) { return x + Number(y.share || 0); }, 0);
        if (Math.abs(t - 1) > 0.005) html += '<p class="split-warn">합계가 ' + Math.round(t * 1000) / 10 + '%입니다. 계산은 비율대로 맞춰서 합니다.</p>';
      }
      return html + '</div>';
    }).join('');
    renderSplitTable();
  }
  function renderSplitTable() {
    if (!E.heirs.length) return;
    const all = EC.calcAll(E);
    const fm = function (n) { return n ? kor(n) : '—'; };
    $('splitTable').innerHTML = '<thead><tr><th>받는 사람</th><th>받는 재산</th><th>상속세 몫</th><th>취득세</th></tr></thead><tbody>' +
      all.heirs.map(function (h) { const hh = E.heirs.find(function (x) { return x.id === h.id; }); return '<tr><td>' + esc(heirName(hh)) + '</td><td>' + fm(h.received) + '</td><td>' + fm(h.inheritTax) + '</td><td>' + fm(h.acquisition) + '</td></tr>'; }).join('') +
      '<tr class="total"><td>합계</td><td>' + fm(all.inheritance.totalProperty) + '</td><td>' + fm(all.inheritance.payable) + '</td><td>' + fm(all.parts.acquisition) + '</td></tr></tbody>';
  }
  function setSplit(key, fn, custom) {
    const g = splitGroups().find(function (x) { return x.key === key; }); if (!g) return;
    g.assets.forEach(function (a) { a.split = fn(a); if (!a.split || !a.split.length) delete a.split; if (custom) a.splitMode = 'custom'; else delete a.splitMode; });
  }

  /* ---------- 요약 ---------- */
  function fmtDate(s) { if (!s) return ''; const p = s.split('-'); return p[0] + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일'; }
  function renderSum() {
    const ready = E.heirs.length > 0;
    const all = ready ? EC.calcAll(E) : null;
    const inh = all ? all.inheritance : EC.calcInheritance(E);
    $('sumProp').textContent = kor(inh.totalProperty) || '0원';
    $('sumMinus').textContent = kor(inh.debts + (inh.totalProperty ? inh.funeral : 0)) || '0원';
    $('sumGift').textContent = kor(inh.priorGifts) || '0원';
    if (!ready) { $('sumTax').textContent = '—'; $('sumNow').textContent = '가족(A)을 먼저 알려 주세요'; }
    else if (!inh.totalProperty && !inh.priorGifts) { $('sumTax').textContent = '—'; $('sumNow').textContent = '재산(B·C)을 넣어 주세요'; }
    else {
      $('sumTax').textContent = inh.payable ? kor(inh.payable) : '0원';
      $('sumNow').textContent = inh.payable ? '취득세까지 6개월 안에 약 ' + kor(all.now) : (all.parts.acquisition ? '상속세는 없고, 취득세 약 ' + kor(all.parts.acquisition) : '공제 안에 들어 상속세가 없습니다');
    }
    const dt = all && all.dates;
    $('sumDeadline').hidden = !dt;
    if (dt) $('sumDeadline').textContent = '신고·납부 기한: ' + fmtDate(dt.report) + '까지';
  }

  /* ---------- 화면 전환 ---------- */
  const askScreen = /[#&]s=([A-F])/.exec(location.hash);       // 결과 화면의 「이 칸을 채우면」 링크
  let screen = askScreen ? askScreen[1] : (SCREENS.indexOf(E.meta.screen) >= 0 ? E.meta.screen : 'A');
  const RENDER = { A: renderA, B: renderB, C: renderC, D: renderD, E: renderE, F: renderF };
  function show(s, scroll) {
    screen = s; E.meta.screen = s;
    document.querySelectorAll('.es-screen').forEach(function (el) { el.classList.toggle('on', el.dataset.screen === s); });
    const i = SCREENS.indexOf(s);
    document.querySelectorAll('#esSteps button').forEach(function (b) { const j = SCREENS.indexOf(b.dataset.go); b.classList.toggle('on', j === i); b.classList.toggle('done', j < i); });
    $('btnPrev').style.visibility = i === 0 ? 'hidden' : 'visible';
    $('btnNext').textContent = i === SCREENS.length - 1 ? '세금 보기 →' : '다음 →';
    RENDER[s]();
    TEACH.render(document.querySelector('.es-screen.on'));
    if (scroll) { const top = document.querySelector('.es-steps'); if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    save();
  }

  /* ---------- 저장 ---------- */
  let timer = null;
  function save() { clearTimeout(timer); timer = setTimeout(function () { EST.save(E); }, 300); }
  function changed() { renderSum(); if (screen === 'F') renderSplitTable(); if (screen === 'E') refreshPriorNotes(); save(); }
  function refreshPriorNotes() {
    document.querySelectorAll('#priorList .es-item').forEach(function (box, i) {
      const q = (E.priors || [])[i]; const out = box.querySelector('.prior-out'); if (!q || !out) return;
      const c = EC.shortCredit(q, E.deceased.date);
      out.textContent = c.years ? (c.years + '년 이내 · 공제율 ' + Math.round(c.rate * 100) + '%' + (c.amount ? ' · 공제액 약 ' + kor(c.amount) + ' (이번 상속세 한도 안에서)' : '')) : (q.date && E.deceased.date ? '10년이 지나 공제 대상이 아닙니다.' : '두 날짜를 넣으면 공제율이 나옵니다.');
    });
  }
  window.addEventListener('pagehide', function () { EST.save(E); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') EST.save(E); });

  /* ---------- 입력 처리 ---------- */
  // 구조가 바뀌는 칸(다시 그려야 하는 칸)
  const RERENDER = /\.(houses|type|lived|sellPlan|substitute)$|^a\.fin_insurance\.value$/;
  document.addEventListener('input', function (ev) {
    const el = ev.target; const path = el.dataset && el.dataset.path; if (!path) return;
    const t = el.dataset.type;
    if (t === 'money') {
      const raw = el.value.replace(/[^\d]/g, '');
      const n = raw ? Number(raw) : 0;
      el.value = raw ? n.toLocaleString('ko-KR') : '';
      const k = el.parentElement.querySelector('.kor'); if (k) k.textContent = n ? kor(n * 1e4) : '';
      setVal(path, n ? n * 1e4 : '');
    } else if (t === 'int') setVal(path, el.value === '' ? '' : Math.max(0, Math.floor(Number(el.value) || 0)));
    else if (t === 'text') setVal(path, el.value.trim());
    else return;    // bool·sel 은 change 에서
    changed();
  });
  document.addEventListener('change', function (ev) {
    const el = ev.target;
    if (el.name === 'hasSpouse') { E.meta.family = true; EST.setSpouse(E, el.value === 'yes'); renderA(); changed(); return; }
    if (el.name === 'hasPriors') { E.meta.priors = el.value; E.priors = E.priors || []; if (el.value === 'no') E.priors = []; else if (!E.priors.length) E.priors.push({ id: EST.id('p') }); renderPriors(); changed(); return; }
    if (el.name === 'hasGifts') { E.meta.gifts = el.value; if (el.value === 'no') E.gifts = []; else if (!E.gifts.length) E.gifts.push({ id: EST.id('g') }); renderE(); changed(); return; }
    if (el.dataset.splitMode) {
      const key = el.dataset.splitMode, m = el.value;
      if (m === 'legal') setSplit(key, function () { return null; });
      else if (m === 'custom') setSplit(key, function (a) { const s = EC.sharesOf(E, a); return Object.keys(s).filter(function (id) { return s[id] > 0; }).map(function (id) { return { heir: id, share: Math.round(s[id] * 1000) / 1000 }; }); }, true);
      else setSplit(key, function () { return [{ heir: m, share: 1 }]; });
      renderF(); changed(); return;
    }
    if (el.dataset.splitPct) {
      const key = el.dataset.splitPct;
      const vals = {}; document.querySelectorAll('[data-split-pct="' + key + '"]').forEach(function (i) { vals[i.dataset.heir] = Math.max(0, Number(i.value) || 0) / 100; });
      setSplit(key, function () { return Object.keys(vals).filter(function (id) { return vals[id] > 0; }).map(function (id) { return { heir: id, share: vals[id] }; }); }, true);
      renderF(); changed(); return;
    }
    const path = el.dataset && el.dataset.path; if (!path) return;
    const t = el.dataset.type;
    if (t === 'bool') setVal(path, /\.basis$/.test(path) ? (el.checked ? 'appraisal' : '') : el.dataset.invert ? (el.checked ? false : '') : (el.checked ? true : ''));
    else if (t === 'sel') setVal(path, el.value === '' ? '' : (/\.houses$/.test(path) ? Number(el.value) : el.value));
    else if (t === 'text' && path === 'd.date') setVal(path, el.value);
    if (RERENDER.test(path) || t === 'bool' || path === 'd.date') { RENDER[screen](); }
    changed();
  });
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('button, a'); if (!b) return;
    if (b.dataset.go) { show(b.dataset.go, true); return; }
    if (b.dataset.kids) {
      const n = E.heirs.filter(function (h) { return h.rel === 'child'; }).length + Number(b.dataset.kids);
      E.meta.family = true; EST.setChildren(E, n); renderA(); changed(); return;
    }
    if (b.dataset.addHeir) {
      const rel = b.dataset.addHeir; E.meta.family = true;
      E.heirs.push({ id: EST.id(rel.charAt(0)), rel: rel, name: rel === 'parent' ? '부모님' : '' });
      renderA(); changed(); return;
    }
    if (b.dataset.delHeir) {
      const id = b.dataset.delHeir;
      E.heirs = E.heirs.filter(function (h) { return h.id !== id; });
      E.assets.forEach(function (a) { if (a.split) { a.split = a.split.filter(function (s) { return s.heir !== id; }); if (!a.split.length) delete a.split; } });
      renderA(); changed(); return;
    }
    if (b.dataset.life) { const inp = document.getElementById('f_' + b.dataset.life.replace(/\./g, '_')); if (inp && window.DH && DH.openLifeHelper) DH.openLifeHelper(inp); return; }
    if (b.id === 'addAsset') { E.assets.push({ id: EST.id('a'), type: 'apt' }); renderB(); changed(); const last = document.querySelector('#assetList .es-item:last-child input[data-type="money"]'); if (last) last.focus(); return; }
    if (b.dataset.delAsset) { const id = b.dataset.delAsset; if (!confirm('이 재산을 지울까요?')) return; E.assets = E.assets.filter(function (a) { return a.id !== id; }); renderB(); changed(); return; }
    if (b.dataset.delPrior) { const id = b.dataset.delPrior; E.priors = (E.priors || []).filter(function (q) { return q.id !== id; }); renderPriors(); changed(); return; }
    if (b.id === 'addGift') { E.gifts.push({ id: EST.id('g') }); renderE(); changed(); return; }
    if (b.dataset.delGift) { const id = b.dataset.delGift; E.gifts = E.gifts.filter(function (g) { return g.id !== id; }); renderE(); changed(); return; }
    if (b.id === 'btnPrev') { const i = SCREENS.indexOf(screen); if (i > 0) show(SCREENS[i - 1], true); return; }
    if (b.id === 'btnNext') { const i = SCREENS.indexOf(screen); if (i < SCREENS.length - 1) show(SCREENS[i + 1], true); else { EST.save(E); location.href = 'result.html'; } return; }
    if (b.id === 'btnResult') { EST.save(E); return; }
    if (b.id === 'btnLink') {
      const url = EST.link('estate.html', E);
      const done = function () { if (window.DH) DH.toast('링크를 복사했습니다. 가족에게 보내면 같은 내용으로 열립니다.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('이 링크를 복사하세요', url); });
      else prompt('이 링크를 복사하세요', url);
      return;
    }
    if (b.id === 'btnReset') {
      if (!confirm('입력한 내용을 모두 지우고 처음부터 할까요?')) return;
      EST.clear(); location.href = 'estate.html'; return;
    }
  });

  /* ---------- 티칭 포인트 열람 기록 ---------- */
  TEACH.onOpen(function (id) { if (E.opened.indexOf(id) < 0) { E.opened.push(id); save(); } });

  /* ---------- 시작 ---------- */
  if (cur.from === 'link' || askScreen) { try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { } }   // 주소창의 긴 링크 정리
  show(screen, false);
  renderSum();
  if (cur.from === 'link' && window.DH) setTimeout(function () { DH.toast('보내 주신 내용을 불러왔습니다.'); }, 300);
  window.ESTATE_UI = { E: E, show: show, renderSum: renderSum };
})();
