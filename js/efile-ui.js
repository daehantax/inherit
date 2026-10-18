/* 전자신고 파일 만들기 화면(efile.html) — 세무사용
   비밀 칸은 data-s="경로" 로 S 객체에 들어가고 sessionStorage 에만 남는다. 세무대리인 칸만 localStorage. */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  const SKEY = 'dh.efile.secret', AKEY = 'dh.efile.agent';
  let E = null, S = {}, lastBytes = null;
  try { S = JSON.parse(sessionStorage.getItem(SKEY) || '{}'); } catch (e) { S = {}; }
  try { S.agent = Object.assign({}, JSON.parse(localStorage.getItem(AKEY) || '{}'), S.agent || {}); } catch (e) { }

  function get(path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, S); }
  // 고객이 「신고서 채우기」에 적은 값 (세무사가 비우면 이 값이 쓰인다)
  function fget(path) { if (!E || !E.filing) return undefined; const F = FIL.get(E); return path.split('.').reduce(function (o, k) { return o && o[k]; }, F); }
  function set(path, v) { const p = path.split('.'); let o = S; p.slice(0, -1).forEach(function (k) { o[k] = o[k] || {}; o = o[k]; }); o[p[p.length - 1]] = v; }
  function save() { try { sessionStorage.setItem(SKEY, JSON.stringify(S)); localStorage.setItem(AKEY, JSON.stringify(S.agent || {})); } catch (e) { } }
  function inp(path, label, ph, type) {
    const v = get(path), fv = fget(path), cust = (v == null || v === '') && fv != null && fv !== '';
    return '<div' + (cust ? ' class="ef-cust"' : '') + '><label>' + label + (cust ? ' <em>고객 입력</em>' : '') + '</label><input type="' + (type || 'text') + '" data-s="' + path + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(cust ? fv : (ph || '')) + '" autocomplete="off"></div>';
  }
  function sel(path, label, list, def) {
    const fv = fget(path), v = get(path) || fv || def || '', cust = !get(path) && !!fv;
    return '<div' + (cust ? ' class="ef-cust"' : '') + '><label>' + label + (cust ? ' <em>고객 입력</em>' : '') + '</label><select data-s="' + path + '">' + list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + o[0] + ' ' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function addr(p) { const road = fget(p + '.road'); return (road ? '<div class="ef-road">고객이 적은 주소: <b>' + esc(road) + '</b> → 아래 법정동코드·지번으로 옮겨 적으세요</div>' : '') + inp(p + '.bjd', '법정동코드(10자리)', '예: 4113510300') + inp(p + '.bjdName', '법정동명', '예: 경기 성남분당 정자') + sel(p + '.san', '특수지(산 등)', EF_CODES.special, '0') + inp(p + '.bunji', '번지', '', 'number') + inp(p + '.ho', '호(부번)', '', 'number') + inp(p + '.block', '건물명(아파트명)', '') + inp(p + '.dong', '동', '') + inp(p + '.unit', '호수', ''); }
  const heirLabel = function (h) { const i = E.heirs.filter(function (x) { return x.rel === h.rel; }).indexOf(h) + 1; return EST.heirLabel(h, i); };

  function render() {
    $('efForm').hidden = false;
    $('efAgent').innerHTML = inp('agent.userId', '홈택스 사용자 ID') + inp('agent.name', '세무대리인 성명') + inp('agent.mgmtNo', '관리번호', 'T-1234-5') + inp('agent.phone', '전화번호') + inp('agent.bizNo', '사업자등록번호');
    $('efPeople').innerHTML = '<div class="ef-item"><h4>신고인 (상속인 중 1명)</h4><div class="ef-grid">' + sel('filer.heirId', '신고인', E.heirs.map(function (h) { return [h.id, heirLabel(h)]; }), E.heirs[0] && E.heirs[0].id) + inp('filer.phone', '전화번호') + inp('filer.email', '이메일') + inp('filer.address', '주소(한 줄)') + '</div></div>' +
      '<div class="ef-item"><h4>피상속인</h4><div class="ef-grid">' + inp('deceased.name', '성명') + inp('deceased.ssn', '주민등록번호') + sel('deceased.sex', '성별(배우자 관계코드용)', [['m', '남'], ['f', '여']], 'm') + sel('deceased.cause', '상속개시원인', EF_CODES.cause, '01') + addr('deceased') + '</div></div>';
    $('efHeirs').innerHTML = E.heirs.map(function (h) {
      const p = 'heirs.' + h.id;
      return '<div class="ef-item"><h4>' + esc(heirLabel(h)) + ' <small>(' + esc(EST.REL[h.rel]) + ')</small></h4><div class="ef-grid">' + inp(p + '.name', '성명', h.name) + inp(p + '.ssn', '주민등록번호') + inp(p + '.phone', '전화번호') + sel(p + '.relation', '피상속인과의 관계', EF_CODES.relation, EF_CODES.defaultRelation(h, get('deceased.sex'))) + '</div></div>';
    }).join('');
    $('efAssets').innerHTML = E.assets.filter(function (a) { return EC.assetValue(a) > 0; }).map(function (a) {
      const p = 'assets.' + a.id, name = a.name || EC.TYPES[a.type].label;
      if (EC.isReal(a) || a.type === 'bunyang') return '<div class="ef-item"><h4>' + esc(name) + '</h4><div class="ef-grid">' + addr(p) + inp(p + '.area', '면적(㎡)', '84.97', 'number') + inp(p + '.sharePct', '피상속인 지분율(%)', '100', 'number') + inp(p + '.uniqNo', '부동산고유번호(14자리, 선택)') + '</div></div>';
      const F = FIL.get(E), items = FIL.FIN_TYPES.indexOf(a.type) >= 0 ? F.fin[a.type] : [];
      if (items.length) {
        return '<div class="ef-item"><h4>' + esc(name) + ' <small>고객이 ' + items.length + '건으로 적음 · 합계 ' + Number(a.value).toLocaleString('ko-KR') + '원</small></h4>' + items.map(function (it, i) {
          const v = FIL.finItemValue(a.type, it);
          const head = '<b>' + (i + 1) + '. ' + esc(it.name || it.company || FIL.BANK_NAME(it.bankCode) || it.desc || '') + '</b> ' + v.toLocaleString('ko-KR') + '원' + (a.type === 'stock' ? ' · ' + (it.listed === '10' ? '비상장' : '상장') + ' ' + esc(it.qty || '') + '주 × ' + Number(it.unitPrice || 0).toLocaleString('ko-KR') + ' · 사업자 ' + esc(it.bizNo || '-') : '') + (a.type === 'deposit' ? ' · 은행코드 ' + esc(it.bankCode || '-') : '');
          return '<div class="ef-sub">' + head + (a.type === 'deposit' ? '<div class="ef-grid">' + inp('fin.' + it.id + '.account', '계좌번호 (잔액증명서)') + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      }
      if (a.type === 'deposit' || a.type === 'insurance' || a.type === 'retire') return '<div class="ef-item"><h4>' + esc(name) + '</h4><div class="ef-grid">' + inp(p + '.bankCode', '은행코드(3자리)', '004') + inp(p + '.account', '계좌번호') + '</div></div>';
      if (a.type === 'stock') return '<div class="ef-item"><h4>' + esc(name) + '</h4><div class="ef-grid">' + inp(p + '.bizNo', '주식 발행법인 사업자번호') + '</div></div>';
      return '';
    }).join('') || '<p class="es-note">추가로 넣을 칸이 없습니다.</p>';
    const d = E.debts || {}, F2 = FIL.get(E);
    let dh = '';
    const won = function (n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; };
    if (F2.debts.length) dh += '<div class="ef-item"><h4>채무 <small>고객이 ' + F2.debts.length + '건으로 적음 — 08 레코드에 그대로 들어감. 고치려면 고객 링크로 「신고서 채우기」를 여세요</small></h4><ul class="ef-rows">' + F2.debts.map(function (r) { return '<li>' + esc(r.kind) + ' ' + esc(r.creditor || '(채권자 없음)') + ' · ' + esc(r.creditorNo || '9999999999(번호 없음)') + ' · ' + esc(r.from || '(발생일 없음 → 상속개시일로)') + '~' + esc(r.to || '') + ' · ' + won(r.amount) + '</li>'; }).join('') + '</ul></div>';
    if (F2.charges.length) dh += '<div class="ef-item"><h4>공과금 <small>고객이 ' + F2.charges.length + '건으로 적음 (09 레코드)</small></h4><ul class="ef-rows">' + F2.charges.map(function (r) { return '<li>' + esc(r.kind) + ' ' + esc(r.year) + '년 ' + esc(r.quarter) + '분기 ' + (r.taxCode ? '세목 ' + esc(r.taxCode) + ' ' : '') + won(r.amount) + '</li>'; }).join('') + '</ul></div>';
    if (F2.funeral.length) dh += '<div class="ef-item"><h4>장례비 <small>고객이 ' + F2.funeral.length + '건으로 적음 (10 레코드)</small></h4><ul class="ef-rows">' + F2.funeral.map(function (r) { return '<li>' + (r.kind === '2' ? '봉안' : '일반') + ' ' + esc(r.payee || '') + ' ' + esc(r.payeeNo || '') + ' · ' + won(r.amount) + '</li>'; }).join('') + '</ul></div>';
    [['loan', '은행 대출'], ['deposit', '돌려줄 보증금'], ['other', '그 밖의 빚']].forEach(function (k) {
      if (F2.debts.length) return;
      if (!Number(d[k[0]])) return;
      const p = 'debts.' + k[0];
      dh += '<div class="ef-item"><h4>' + k[1] + ' ' + Number(d[k[0]]).toLocaleString('ko-KR') + '원</h4><div class="ef-grid">' + sel(p + '.kind', '채무종류', EF_CODES.debtKind, k[0] === 'loan' ? '01' : k[0] === 'deposit' ? '07' : '06') + inp(p + '.creditor', '채권자 성명(상호)') + inp(p + '.creditorNo', '채권자 주민·사업자번호', '모르면 비움 → 9999999999') + inp(p + '.from', '발생일', 'YYYY-MM-DD') + inp(p + '.to', '종료(예정)일', 'YYYY-MM-DD') + '</div></div>';
    });
    if (Number(d.tax) && !F2.charges.length) dh += '<div class="ef-item"><h4>공과금 ' + Number(d.tax).toLocaleString('ko-KR') + '원</h4><div class="ef-grid">' + sel('publicCharge.kind', '공과금종류', EF_CODES.publicCharge, '06') + inp('publicCharge.year', '연도', (E.deceased.date || '').slice(0, 4)) + inp('publicCharge.quarter', '분기(1~4)', '1') + inp('publicCharge.taxCode', '세목코드(국세일 때)', '') + '</div></div>';
    if (!F2.funeral.length) dh += '<div class="ef-item"><h4>장례비 지급처</h4><div class="ef-grid">' + inp('funeral.payee', '지급처 성명(상호)') + inp('funeral.payeeNo', '지급처 사업자번호') + '</div></div>';
    $('efDebts').innerHTML = dh;
  }
  function load(e, from) {
    if (!e || !e.heirs || !e.heirs.length) { $('efLoaded').textContent = '불러올 상속 파일이 없거나 상속인이 없습니다.'; return; }
    E = e; const inh = EC.calcInheritance(E);
    $('efLoaded').innerHTML = '<b>' + from + '</b>에서 불러옴 · 상속인 ' + E.heirs.length + '명 · 재산 ' + Math.round(inh.totalProperty).toLocaleString('ko-KR') + '원 · 납부세액 ' + Math.round(inh.payable).toLocaleString('ko-KR') + '원 · 상속개시일 ' + (E.deceased.date || '(없음)') +
      (FIL.has(E) ? '<br><span class="ef-ok">' + esc(FIL.summary(E)) + '</span> — 고객이 적은 값은 칸에 연하게 보입니다. 비워 두면 그 값이 쓰이고, 적으면 세무사 값이 우선합니다. 건별 금액·은행을 고쳐야 하면 「입력 내용 보기」 링크 → <b>신고서 채우기</b>에서 고친 뒤 이 화면의 「이 기기의 입력 쓰기」를 누르세요.' : '<br>고객이 「신고서 채우기」를 하지 않았습니다. 아래 칸을 모두 세무사가 채웁니다.') +
      ' <button type="button" class="btn ghost sm" id="efOpenReturn">신고서 서식 열기</button>';
    render();
  }
  function build() {
    save();
    const b = EF.build(E, S), out = EF.render(b);
    const ok = !b.problems.length && !out.errors.length;
    lastBytes = ok ? out.bytes : null; $('efDownload').disabled = !ok;
    const counts = {}; out.lines.forEach(function (l) { counts[l.code] = (counts[l.code] || 0) + 1; });
    $('efResult').innerHTML = '<p class="' + (ok ? 'ef-ok' : 'ef-bad') + '">' + (ok ? '검사 통과 · 파일을 내려받을 수 있습니다.' : '고칠 것이 있습니다. 아래를 채운 뒤 다시 검사하세요.') + '</p>' +
      (b.problems.length ? '<h4>채울 칸 · 검산</h4><ul>' + b.problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
      (out.errors.length ? '<h4>형식 오류</h4><ul>' + out.errors.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
      (out.warn.length ? '<h4>경고</h4><ul>' + out.warn.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
      '<p class="es-note">레코드: ' + Object.keys(counts).sort().map(function (k) { return k + '×' + counts[k]; }).join(' · ') + ' · 총 ' + out.bytes.length.toLocaleString('ko-KR') + '바이트 · 과세가액 ' + b.totals.taxable.toLocaleString('ko-KR') + '원 · 납부세액 ' + b.totals.payable.toLocaleString('ko-KR') + '원</p>' +
      '<p class="es-note">홈택스(세무대리인 로그인) 상속세 신고에서 「전자신고 파일 변환(일괄변환)」으로 이 파일을 올려 변환 결과 오류를 확인한 뒤 전송하세요(정확한 메뉴 이름은 홈택스 화면 기준). 처음 3건은 화면 입력 결과와 금액을 대조하세요.</p>';
  }
  document.addEventListener('input', function (ev) { const p = ev.target.dataset && ev.target.dataset.s; if (p) { set(p, ev.target.value); save(); } });
  document.addEventListener('change', function (ev) { const p = ev.target.dataset && ev.target.dataset.s; if (p) { set(p, ev.target.value); save(); if (p === 'deceased.sex') render(); } });
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.id === 'efLoadLink') load(EST.fromHash(($('efLink').value || '').replace(/^[^#]*/, '')), '링크');
    if (b.id === 'efLoadLocal') load(EST.load(), '이 기기');
    if (b.id === 'efBuild') build();
    if (b.id === 'efOpenReturn' && E) {
      save();
      const sec = { deceased: { ssn: get('deceased.ssn') }, heirs: {}, fin: {} };
      Object.keys(S.heirs || {}).forEach(function (id) { sec.heirs[id] = { ssn: (S.heirs[id] || {}).ssn }; });
      Object.keys(S.fin || {}).forEach(function (id) { sec.fin[id] = { account: (S.fin[id] || {}).account }; });
      // 세무사가 efile 에서 고친 값(성명·주소·면적 등)을 서식에도 반영
      const E2 = JSON.parse(JSON.stringify(E)); const F2 = FIL.get(E2);
      const over = function (base, top) { const o = Object.assign({}, base || {}); Object.keys(top || {}).forEach(function (k) { const v = top[k]; if (v !== '' && v !== undefined && v !== null) o[k] = v; }); return o; };
      F2.deceased = over(F2.deceased, S.deceased); F2.filer = over(F2.filer, S.filer);
      Object.keys(S.heirs || {}).forEach(function (id) { F2.heirs[id] = over(F2.heirs[id], S.heirs[id]); });
      Object.keys(S.assets || {}).forEach(function (id) { F2.assets[id] = over(F2.assets[id], S.assets[id]); });
      // 주민등록번호·계좌번호가 들어간 서식 데이터는 sessionStorage 로만 넘긴다(세무사 PC localStorage 에 남지 않게)
      try { sessionStorage.setItem('dh.inherit-tax-report.agent', JSON.stringify(Object.assign(EST.toReturn(E2, sec), { _agent: true }))); } catch (e) { DH.toast('이 브라우저에서 서식을 넘길 수 없습니다.', true); return; }
      window.open('inherit-tax-report.html#agent', '_blank');
    }
    if (b.id === 'efDownload' && lastBytes) {
      const name = EF.fileName(new Date().toISOString().slice(0, 10));
      const url = URL.createObjectURL(new Blob([lastBytes], { type: 'application/octet-stream' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }
  });
  const fromHash = EST.fromHash(); if (fromHash) load(fromHash, '주소');
  window.EFILE_UI = { load: load, build: build, get S() { return S; } };
})();
