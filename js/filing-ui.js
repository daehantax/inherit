/* ============================================================
   신고서 채우기 화면(filing.html) 동작
   - 상속 파일(EST)의 filing 부분(FIL)을 고친다. 입력칸: data-f="deceased.name" / data-f="fin.deposit.<id>.bank"
   - 주민등록번호·계좌번호: data-sec="deceased.ssn" / "heirs.<id>.ssn" / "fin.<itemId>.account" → 비밀 저장소(이 기기)
   - 바뀔 때마다 0.3초 뒤 저장(건별 합계 → 1단계 금액 동기화)하고 오른쪽 요약을 다시 계산
   ============================================================ */
(function () {
  'use strict';
  const $ = function (id) { return document.getElementById(id); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const won = function (n) { return Math.round(Number(n) || 0).toLocaleString('ko-KR') + '원'; };
  const kor = function (n) {
    n = Math.round(Number(n) || 0); if (!n) return ''; const neg = n < 0; n = Math.abs(n);
    const eok = Math.floor(n / 1e8), man = Math.round((n % 1e8) / 1e4);
    let s = ''; if (eok) s += eok.toLocaleString('ko-KR') + '억'; if (man) s += (s ? ' ' : '') + man.toLocaleString('ko-KR') + '만';
    return (neg ? '-' : '') + (s || n.toLocaleString('ko-KR')) + '원';
  };
  const SCREENS = ['people', 'real', 'fin', 'debt', 'done'];
  const cur = EST.current();
  const E = cur.e; const F = FIL.get(E); let SEC = FIL.loadSecret();
  const PRODUCTS = { self: '셀프 신고서', review: '세무사 검토', file: '신고까지 맡기기' };
  let product = (/[?&]p=(self|review|file)/.exec(location.search) || [])[1] || '';
  if (product) { try { localStorage.setItem('dh.estate.product', product); } catch (e) { } }
  else { try { product = localStorage.getItem('dh.estate.product') || ''; } catch (e) { } }
  let screen = (/[#&]s=(\w+)/.exec(location.hash) || [])[1]; if (SCREENS.indexOf(screen) < 0) screen = 'people';

  /* ---------- 경로 읽기·쓰기 (filing) : 배열은 id로 찾는다 ---------- */
  function walk(path, create) {
    const p = path.split('.'); let o = F;
    for (let i = 0; i < p.length - 1; i++) {
      const k = p[i];
      if (Array.isArray(o)) { let it = o.find(function (x) { return x.id === k; }); if (!it) { if (!create) return null; it = { id: k }; o.push(it); } o = it; }
      else { if (o[k] === undefined || o[k] === null) { if (!create) return null; o[k] = {}; } o = o[k]; }
    }
    return { obj: o, key: p[p.length - 1] };
  }
  function getF(path) { const t = walk(path); return t ? t.obj[t.key] : undefined; }
  function setF(path, v) { const t = walk(path, true); if (!t) return; if (v === '' || v === null || v === undefined) delete t.obj[t.key]; else t.obj[t.key] = v; }
  function getS(path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, SEC); }
  function setS(path, v) { const p = path.split('.'); let o = SEC; p.slice(0, -1).forEach(function (k) { o[k] = o[k] || {}; o = o[k]; }); if (v) o[p[p.length - 1]] = v; else delete o[p[p.length - 1]]; }

  /* ---------- 입력칸 ---------- */
  function fid(path) { return 'f_' + path.replace(/[^\w]/g, '_'); }
  function text(path, label, opt) {
    opt = opt || {};
    return '<div class="fl-f' + (opt.wide ? ' wide' : '') + '"><label for="' + fid(path) + '">' + label + (opt.hint ? '<small>' + opt.hint + '</small>' : '') + '</label><input type="' + (opt.type || 'text') + '" id="' + fid(path) + '" data-f="' + path + '"' + (opt.num ? ' inputmode="numeric"' : '') + ' value="' + esc(getF(path) == null ? '' : getF(path)) + '" placeholder="' + esc(opt.ph || '') + '" autocomplete="off"' + (opt.maxlength ? ' maxlength="' + opt.maxlength + '"' : '') + '></div>';
  }
  function moneyIn(path, label, opt) {
    opt = opt || {}; const v = Number(getF(path)) || 0;
    return '<div class="fl-f' + (opt.wide ? ' wide' : '') + '"><label for="' + fid(path) + '">' + label + (opt.hint ? '<small>' + opt.hint + '</small>' : '') + '</label><div class="fl-money"><input type="text" inputmode="numeric" id="' + fid(path) + '" data-f="' + path + '" data-type="won" value="' + (v ? v.toLocaleString('ko-KR') : '') + '" placeholder="0" autocomplete="off"><span class="unit">원</span><span class="kor">' + kor(v) + '</span></div></div>';
  }
  function select(path, label, list, def, opt) {
    opt = opt || {}; const v = getF(path) || def || '';
    return '<div class="fl-f"><label for="' + fid(path) + '">' + label + (opt.hint ? '<small>' + opt.hint + '</small>' : '') + '</label><select id="' + fid(path) + '" data-f="' + path + '">' + (opt.blank ? '<option value="">' + opt.blank + '</option>' : '') + list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + (opt.code ? ' (' + o[0] + ')' : '') + '</option>'; }).join('') + '</select></div>';
  }
  function secret(path, label, opt) {
    opt = opt || {}; const v = getS(path) || '';
    return '<div class="fl-f fl-secret"><label for="s_' + fid(path) + '">' + label + '<small>' + (opt.hint || '이 기기에만 저장 · 전송 안 함') + '</small></label><input type="text" inputmode="numeric" id="s_' + fid(path) + '" data-sec="' + path + '" value="' + esc(v) + '" placeholder="' + esc(opt.ph || '') + '" autocomplete="off"' + (opt.maxlength ? ' maxlength="' + opt.maxlength + '"' : '') + '></div>';
  }
  function addrFields(p, opt) {
    opt = opt || {};
    return text(p + '.road', '주소 (도로명 또는 지번, 한 줄)', { wide: true, ph: '경기 성남시 분당구 정자일로 1, 101동 1001호' }) +
      '<details class="fl-more"><summary>법정동코드·지번으로 자세히 (전자신고용 · 몰라도 됨)</summary><div class="fl-grid">' +
      text(p + '.bjd', '법정동코드 10자리', { ph: '4113510300', num: true, maxlength: 10 }) + text(p + '.bjdName', '법정동명', { ph: '경기 성남분당 정자' }) +
      select(p + '.san', '특수지', EF_CODES.special, '0') + text(p + '.bunji', '번지(본번)', { ph: '', num: true }) + text(p + '.ho', '호(부번)', { ph: '', num: true }) +
      text(p + '.block', '건물명(아파트명)') + text(p + '.dong', '동', { ph: '101' }) + text(p + '.unit', '호수', { ph: '1001' }) +
      (opt.real ? text(p + '.uniqNo', '부동산고유번호 14자리 (등기부 맨 위, 선택)', { num: true, maxlength: 14 }) : '') +
      '</div></details>';
  }
  const heirName = function (h) { const i = E.heirs.filter(function (x) { return x.rel === h.rel; }).indexOf(h) + 1; return EST.heirLabel(h, i); };

  /* ---------- 1. 사람 ---------- */
  function renderPeople() {
    $('flDeceased').innerHTML = '<div class="fl-grid">' + text('deceased.name', '성명', { ph: '홍길동' }) + secret('deceased.ssn', '주민등록번호', { ph: '13자리, - 없이', maxlength: 13 }) +
      select('deceased.cause', '상속이 열린 원인', EF_CODES.cause, '01') + select('deceased.sex', '성별 <small>배우자 관계코드를 정합니다</small>', [['m', '남'], ['f', '여']], 'm') + '</div>' + addrFields('deceased');
    const opts = E.heirs.map(function (h) { return [h.id, heirName(h) + ' (' + EST.REL[h.rel] + ')']; });
    $('flFiler').innerHTML = '<div class="fl-grid">' + select('filer.heirId', '신고인', opts, E.heirs[0] && E.heirs[0].id, { blank: '고르세요' }) +
      text('filer.phone', '휴대폰', { ph: '010-0000-0000', type: 'tel' }) + text('filer.email', '이메일', { ph: 'name@example.com', type: 'email' }) +
      text('filer.address', '신고인 주소 (한 줄)', { wide: true, ph: '주민등록상 주소' }) + '</div>';
    $('flHeirs').innerHTML = E.heirs.map(function (h) {
      const p = 'heirs.' + h.id;
      return '<div class="es-item"><div class="es-item-head"><div><span class="rel">' + esc(EST.REL[h.rel]) + '</span><b>' + esc(heirName(h)) + '</b></div></div><div class="fl-grid">' +
        text(p + '.name', '성명', { ph: h.name && h.name !== heirName(h) ? h.name : '' }) + secret(p + '.ssn', '주민등록번호', { ph: '13자리', maxlength: 13 }) + text(p + '.phone', '전화번호', { type: 'tel' }) +
        select(p + '.relation', '돌아가신 분과의 관계', EF_CODES.relation, EF_CODES.defaultRelation(h, getF('deceased.sex')), { code: true }) + '</div></div>';
    }).join('') || '<p class="es-empty">상속인이 없습니다. 1단계에서 가족을 넣어 주세요.</p>';
  }

  /* ---------- 2. 집·땅 ---------- */
  function renderReal() {
    const list = E.assets.filter(function (a) { return (EC.isReal(a) || a.type === 'bunyang') && EC.assetValue(a) > 0; });
    $('flReal').innerHTML = list.map(function (a) {
      const p = 'assets.' + a.id, nm = a.name || EC.TYPES[a.type].label;
      const ev = EF_CODES.evalMethod;
      return '<div class="es-item"><div class="es-item-head"><div><span class="rel">' + esc(EC.TYPES[a.type].label) + '</span><b>' + esc(nm) + '</b> <small>' + won(EC.assetValue(a)) + '</small></div></div>' +
        addrFields(p, { real: true }) + '<div class="fl-grid">' +
        (a.type === 'bunyang' ? '' : text(p + '.area', '면적(㎡)', { ph: '84.97', hint: '등기부 전유부분 면적. 땅은 토지 면적' })) +
        text(p + '.sharePct', '돌아가신 분 지분(%)', { ph: '100', hint: '단독 소유면 100' }) +
        select(p + '.evalCode', '평가 방법', ev, FIL.evalCode(a), { code: true, hint: '계산에 쓴 방법이 미리 골라져 있습니다' }) + '</div></div>';
    }).join('') || '<p class="es-empty">1단계에 집·땅이 없습니다.</p>';
  }

  /* ---------- 3. 예금·주식 등 ---------- */
  function itemRow(t, it) {
    const p = 'fin.' + t + '.' + it.id;
    let f = '';
    if (t === 'deposit') f = select(p + '.bankCode', '은행', FIL.BANKS, '', { blank: '고르세요' }) + secret('fin.' + it.id + '.account', '계좌번호', { ph: '- 없이' , maxlength: 20 }) + moneyIn(p + '.value', '돌아가신 날 잔액');
    else if (t === 'stock') f = text(p + '.name', '종목명(펀드명)', { ph: '삼성전자' }) + select(p + '.listed', '구분', [['09', '상장'], ['10', '비상장·펀드']], '09') + text(p + '.qty', '수량(주)', { num: true }) + moneyIn(p + '.unitPrice', '1주 평가액', { hint: '상장: 돌아가신 날 앞뒤 2개월 종가 평균' }) + text(p + '.bizNo', '발행법인 사업자번호', { num: true, maxlength: 10, hint: '모르면 비움' }) + moneyIn(p + '.value', '평가액 합계', { hint: '수량×단가가 있으면 자동' });
    else if (t === 'insurance') f = text(p + '.company', '보험회사') + moneyIn(p + '.value', '받는 보험금');
    else if (t === 'retire') f = text(p + '.company', '회사(지급처)') + moneyIn(p + '.value', '퇴직금·퇴직연금');
    else if (t === 'car') f = text(p + '.name', '차종·연식', { ph: '그랜저 2021' }) + moneyIn(p + '.value', '중고 시세');
    else f = text(p + '.desc', '무엇인지 자세히', { wide: true, ph: '골프회원권 / 빌려준 돈(차용증) / 받을 전세보증금 등' }) + moneyIn(p + '.value', '평가액');
    return '<div class="fl-item" data-item="' + it.id + '"><div class="fl-grid">' + f + '</div><button type="button" class="es-del" data-del-fin="' + t + '|' + it.id + '">지우기</button></div>';
  }
  function renderFin() {
    F.fin.stock.forEach(function (it) { if (Number(it.qty) > 0 && Number(it.unitPrice) > 0) it.value = FIL.finItemValue('stock', it); });
    $('flFin').innerHTML = FIL.FIN_TYPES.map(function (t) {
      const a = E.assets.find(function (x) { return x.id === 'fin_' + t; }), total = a ? Number(a.value) || 0 : 0;
      const rows = F.fin[t];
      if (!total && !rows.length) return '';
      const sum = FIL.finSum(F, t);
      return '<div class="es-item"><div class="es-item-head"><div><b>' + FIL.FIN_LABEL[t] + '</b> <small>1단계 금액 ' + won(total) + (rows.length ? ' · 건별 합계 ' + won(sum) : '') + '</small></div></div>' +
        rows.map(function (it) { return itemRow(t, it); }).join('') +
        (!rows.length ? '<p class="es-note">아직 건별로 나누지 않았습니다. 「+ 추가」로 한 건씩 적으면 합계가 1단계 금액이 됩니다.</p>' : '') +
        '<button type="button" class="es-add sm" data-add-fin="' + t + '">+ ' + FIL.FIN_LABEL[t] + ' 추가</button></div>';
    }).join('') || '<p class="es-empty">1단계에 예금·주식 등이 없습니다. 있다면 <a href="estate.html#s=C">1단계 C</a>에서 넣거나, 아래에서 바로 추가하세요.</p>' +
      '<div class="es-ctl">' + FIL.FIN_TYPES.map(function (t) { return '<button type="button" class="btn ghost sm" data-add-fin="' + t + '">+ ' + FIL.FIN_LABEL[t] + '</button>'; }).join('') + '</div>';
  }

  /* ---------- 4. 빚·공과금·장례비 ---------- */
  function renderDebt() {
    const d = E.debts || {}, fu = E.funeral || {};
    const sumD = (Number(d.loan) || 0) + (Number(d.deposit) || 0) + (Number(d.other) || 0);
    let h = '<div class="es-item"><div class="es-item-head"><div><b>빚</b> <small>1단계 금액 ' + won(sumD) + '</small></div></div>';
    h += F.debts.map(function (r) {
      const p = 'debts.' + r.id;
      return '<div class="fl-item"><div class="fl-grid">' + select(p + '.kind', '종류', EF_CODES.debtKind, '01', { code: true }) + text(p + '.creditor', '채권자 (은행·세입자·병원 이름)') + text(p + '.creditorNo', '채권자 사업자번호·주민번호', { num: true, maxlength: 13, hint: '모르면 비움' }) +
        text(p + '.from', '빌린 날(계약일)', { type: 'date' }) + text(p + '.to', '갚을 날(만기)', { type: 'date', hint: '없으면 비움' }) + moneyIn(p + '.amount', '돌아가신 날 잔액') + '</div><button type="button" class="es-del" data-del="debts|' + r.id + '">지우기</button></div>';
    }).join('');
    h += (!F.debts.length && sumD ? '<p class="es-note">채권자별로 한 건씩 적으면 합계가 1단계 금액이 됩니다. 종류: 은행 대출 → 금융채무, 세입자 보증금 → 주택임대보증금, 병원비 → 기타채무.</p>' : '') + '<button type="button" class="es-add sm" data-add="debts">+ 빚 추가</button></div>';

    h += '<div class="es-item"><div class="es-item-head"><div><b>밀린 세금·공과금</b> <small>1단계 금액 ' + won(d.tax) + '</small></div></div>';
    h += F.charges.map(function (r) {
      const p = 'charges.' + r.id;
      return '<div class="fl-item"><div class="fl-grid">' + select(p + '.kind', '종류', EF_CODES.publicCharge, '06', { code: true }) + text(p + '.year', '연도', { ph: (E.deceased.date || '').slice(0, 4), num: true, maxlength: 4 }) + select(p + '.quarter', '분기', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], '1') +
        text(p + '.taxCode', '세목코드 (국세일 때)', { hint: '예: 종합소득세 10', maxlength: 2 }) + moneyIn(p + '.amount', '금액') + '</div><button type="button" class="es-del" data-del="charges|' + r.id + '">지우기</button></div>';
    }).join('');
    h += '<button type="button" class="es-add sm" data-add="charges">+ 세금·공과금 추가</button></div>';

    h += '<div class="es-item"><div class="es-item-head"><div><b>장례비</b> <small>1단계 금액 ' + won((Number(fu.cost) || 0) + (Number(fu.grave) || 0)) + ' · 공제는 일반 장례비 1,000만원·봉안 500만원까지</small></div></div>';
    h += F.funeral.map(function (r) {
      const p = 'funeral.' + r.id;
      return '<div class="fl-item"><div class="fl-grid">' + select(p + '.kind', '구분', EF_CODES.funeralKind, '1') + text(p + '.payee', '지급처 (장례식장·상조·납골당)') + text(p + '.payeeNo', '지급처 사업자번호', { num: true, maxlength: 10, hint: '영수증에 있음 · 모르면 비움' }) +
        text(p + '.desc', '내용', { ph: '장례식장 비용 / 봉안당 안치' }) + moneyIn(p + '.amount', '금액') + '</div><button type="button" class="es-del" data-del="funeral|' + r.id + '">지우기</button></div>';
    }).join('');
    h += '<button type="button" class="es-add sm" data-add="funeral">+ 장례비 추가</button></div>';
    $('flDebt').innerHTML = h;
  }

  /* ---------- 5. 확인·다음 ---------- */
  function renderDone() {
    const miss = FIL.missing(E);
    const SEC_LABEL = { people: '1. 사람', real: '2. 집·땅', fin: '3. 예금·주식 등', debt: '4. 빚·공과금·장례비' };
    $('flMissing').innerHTML = miss.length ? '<div class="note warn"><b>아직 비운 칸 ' + miss.length + '개</b> — 몰라서 비운 칸은 그대로 두셔도 됩니다. 세무사 검토·맡기기에서는 세무사가 서류를 보고 채웁니다.<ul class="fl-miss">' +
      miss.slice(0, 30).map(function (m) { return '<li><a href="#s=' + m.sec + '" data-go="' + m.sec + '">' + SEC_LABEL[m.sec] + '</a> · ' + esc(m.text) + '</li>'; }).join('') + (miss.length > 30 ? '<li>… 외 ' + (miss.length - 30) + '개</li>' : '') + '</ul></div>'
      : '<div class="note ok"><b>모든 칸이 채워졌습니다.</b></div>';
    // 서식 행 미리 보기
    const r = EST.toReturn(E, SEC);
    const sumRows = r.assets.reduce(function (s, x) { return s + (Number(x.qty) > 0 ? Math.floor(Number(x.qty) * x.price) : x.price); }, 0);
    $('flPreview').innerHTML = '<thead><tr><th>번호</th><th>① 구분</th><th>② 종류</th><th>③ 소재지·명칭</th><th>④ 번호·지분</th><th>⑤ 수량</th><th>⑦ 평가가액</th><th>⑧ 평가</th></tr></thead><tbody>' +
      r.assets.map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td>' + x.atype + '</td><td>' + x.ptype + '</td><td>' + esc(x.loc) + '</td><td>' + esc(x.reg ? FIL.mask(x.reg) || x.reg : '') + '</td><td class="num">' + esc(x.qty || '') + '</td><td class="num">' + (Number(x.qty) > 0 ? Math.floor(Number(x.qty) * x.price) : x.price).toLocaleString('ko-KR') + '</td><td>' + x.eval + '</td></tr>'; }).join('') +
      '<tr class="total"><td colspan="6">계</td><td class="num">' + sumRows.toLocaleString('ko-KR') + '</td><td></td></tr></tbody>';
    // 다음 단계 (상품별)
    const inh = EC.calcInheritance(E), over = FIL.overLimit(E, inh);
    let key = null; try { key = JSON.parse(localStorage.getItem('dh.estate.key') || 'null'); } catch (e) { }
    let h = '';
    if (!product) {
      h = '<h3 class="subhead">어떻게 진행할까요?</h3><div class="fl-choice">' +
        '<a class="btn" href="filing.html?p=self#s=done">셀프 신고서로</a><a class="btn" href="filing.html?p=review#s=done">세무사 검토로</a><a class="btn ghost" href="result.html?p=file#ask">신고까지 맡기기</a></div>';
    } else if (product === 'self') {
      h = '<h3 class="subhead">셀프 신고서 — 이렇게 끝냅니다</h3><ol class="fl-steps">' +
        '<li><b>신청·결제</b> ' + (key ? '<span class="ok">완료 (접수번호 ' + esc(key.no) + ')</span>' : '<a class="btn sm" href="result.html?p=self#ask">셀프 신고서 신청하기 →</a> <small>9만 9천원 · 결제 확인 후 열쇠 코드를 이메일로 보내 드립니다</small>') + '</li>' +
        '<li><b>신고서 열기</b> ' + (key ? '<button type="button" class="btn sm" id="btnOpenReturn">신고서 서식 열기 (여기 내용으로 채움) →</button> <small>별지·부표3·부표1·제9호 서식이 모두 채워집니다. 인쇄·PDF 저장.</small>' : '<small>열쇠 코드를 받으면 <a href="result.html#ask">결과 화면 「셀프 신고서 열기」</a>에 넣으세요. 그다음 여기로 돌아오면 이 버튼이 열립니다.</small>') + '</li>' +
        '<li><b>홈택스에서 직접 제출</b> <details class="fl-more"><summary>순서 보기 (화면·칸 단위)</summary>' + hometaxGuide() + '</details></li>' +
        '<li><b>납부</b> <small>신고서 4단계 「납부 안내」대로 홈택스 자진납부. 2천만원 넘으면 분납·연부연납 검토.</small></li></ol>' +
        '<p class="es-note">막히면 sjlee@taxdh.net 으로 화면을 찍어 보내 주세요. 중간에 세무사 검토로 바꾸시면 9만 9천원은 빼 드립니다.</p>';
    } else if (product === 'review') {
      h = '<h3 class="subhead">세무사 검토 — 이렇게 진행됩니다</h3><ol class="fl-steps">' +
        '<li><b>신청</b> <a class="btn sm" href="result.html?p=review#ask">세무사 검토 신청하기 →</a> <small>33만원 · 여기 적은 내용이 「입력 내용 보기」 링크로 담당 세무사에게 갑니다(주민등록번호·계좌번호 제외)</small></li>' +
        '<li><b>서류 보내기</b> <small>아래 서류를 이메일로 보내 주세요. 세무사가 주민등록번호·계좌번호·법정동코드를 서류에서 채웁니다.</small><ul class="fl-docs">' + EST.docs(E).map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></li>' +
        '<li><b>검토</b> <small>입력값·평가액·공제를 확인하고, 절세 포인트 적용 여부를 확정한 서면 답변서 + 30분 통화</small></li>' +
        '<li><b>신고서</b> <small>검토가 끝난 신고서 서식(PDF)을 보내 드립니다. 직접 홈택스로 내시거나, 신고까지 맡기기(차액만 추가)로 바꾸실 수 있습니다.</small></li></ol>';
    } else {
      h = '<h3 class="subhead">신고까지 맡기기</h3><p class="es-lead">여기 적은 내용이 있으면 함께 보내 드릴 수 있습니다. 세무사가 서류로 나머지를 채우고 전자신고까지 합니다.</p><a class="btn" href="result.html?p=file#ask">신고까지 맡기기 신청하기 →</a>';
    }
    if (over && (product === 'self' || product === 'review')) h = '<div class="note warn"><b>총 상속재산이 15억원을 넘습니다.</b> 셀프 신고서·세무사 검토는 15억원 이하만 진행합니다. 이 경우는 <a href="result.html?p=file#ask">신고까지 맡기기</a>로 하시거나, 세무사에게 따로 문의해 주세요 (031-783-8877 · sjlee@taxdh.net).</div>' + h;
    $('flNext').innerHTML = h;
  }
  function hometaxGuide() {
    return '<ol class="fl-ht">' +
      '<li>홈택스 로그인(신고인 본인 공동인증서·간편인증) → <b>세금신고 › 상속세 › 일반증여·상속세 신고 › 정기신고</b> (메뉴 이름은 홈택스 화면 기준이며 바뀔 수 있습니다)</li>' +
      '<li><b>기본사항</b>: 피상속인 성명·주민등록번호·주소, 상속개시일, 신고인(상속인) 정보 — 신고서 4단계 ①~⑫ 칸 그대로</li>' +
      '<li><b>상속인 입력</b>: 상속인마다 성명·주민등록번호·관계 — 이 화면 「1. 사람」의 내용</li>' +
      '<li><b>상속재산 명세</b>: 재산을 한 건씩 추가 — 위 「신고서에 이렇게 들어갑니다」 표의 행 순서대로. 부동산은 주소 검색, 예금은 은행·계좌번호, 주식은 종목·수량·단가</li>' +
      '<li><b>채무·공과금·장례비</b>: 「4. 빚·공과금·장례비」의 건별 내용. 증빙은 신고 후 첨부서류로 올립니다</li>' +
      '<li><b>상속공제</b>: 신고서 2단계(부표3)의 금액 — 일괄공제/기초+인적공제, 배우자공제, 금융재산공제, 동거주택공제</li>' +
      '<li><b>세액계산·신고서 제출</b>: 홈택스가 계산한 금액이 신고서 4단계 ⑳~㉛과 같은지 확인하고 제출. 다르면 어느 칸이 다른지 보고 sjlee@taxdh.net 으로 물어보세요</li>' +
      '<li><b>첨부서류</b>: 가족관계증명서, 등기부등본, 잔액증명서, 채무 증빙, 장례비 영수증, 협의분할서를 PDF로 올립니다</li>' +
      '<li><b>납부</b>: 납부·고지·환급 › 자진납부. 신고기한 안에 신고와 납부를 모두 마쳐야 3% 신고세액공제가 유지됩니다</li></ol>';
  }

  /* ---------- 요약 ---------- */
  function renderSum() {
    const inh = EC.calcInheritance(E);
    $('sumProp').textContent = kor(inh.totalProperty) || '0원';
    $('sumMinus').textContent = kor(inh.debts + inh.funeral) || '0원';
    $('sumTax').textContent = inh.totalProperty ? (kor(inh.payable) || '0원') : '—';
    $('sumMissing').textContent = FIL.missing(E).length + '개';
    const over = FIL.overLimit(E, inh);
    $('flLimit').hidden = !(over && (product === 'self' || product === 'review'));
    if (!$('flLimit').hidden) $('flLimit').innerHTML = '<b>총 상속재산 ' + kor(inh.totalProperty + inh.priorGifts) + '</b> — 셀프 신고서·세무사 검토는 15억원 이하만 진행합니다. 적어 두신 내용은 <a href="result.html?p=file#ask">신고까지 맡기기</a>에 그대로 쓸 수 있습니다.';
  }
  function render() {
    $('flProd').textContent = product ? '· ' + PRODUCTS[product] : '';
    $('flEmpty').hidden = !!(E.heirs.length || E.assets.length);
    renderPeople(); renderReal(); renderFin(); renderDebt(); renderDone(); renderSum();
  }
  function show(s, push) {
    screen = s;
    document.querySelectorAll('.es-screen').forEach(function (el) { el.classList.toggle('on', el.dataset.screen === s); });
    document.querySelectorAll('#flSteps button').forEach(function (b, i) { b.classList.toggle('on', b.dataset.go === s); b.classList.toggle('done', i < SCREENS.indexOf(s)); });
    const i = SCREENS.indexOf(s);
    $('btnPrev').style.visibility = i === 0 ? 'hidden' : 'visible';
    $('btnNext').textContent = i === SCREENS.length - 1 ? (product ? '신청 화면으로 →' : '결과 화면으로 →') : '다음 →';
    if (push) { try { history.replaceState(null, '', location.pathname + location.search + '#s=' + s); } catch (e) { } window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (s === 'done') renderDone();
  }

  /* ---------- 저장 ---------- */
  let timer = null;
  function save(now) {
    clearTimeout(timer);
    const run = function () { FIL.save(E); FIL.saveSecret(SEC); $('sumSaved').textContent = '저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); renderSum(); };
    if (now) run(); else timer = setTimeout(run, 300);
  }
  document.addEventListener('input', function (ev) {
    const el = ev.target;
    if (el.dataset.f) {
      let v = el.value;
      if (el.dataset.type === 'won') { v = DH.num(v); const k = el.parentElement.querySelector('.kor'); if (k) k.textContent = kor(v); if (!v) v = ''; }
      setF(el.dataset.f, v); save();
      // 주식: 수량×단가 → 평가액
      const m = /^fin\.stock\.([^.]+)\.(qty|unitPrice)$/.exec(el.dataset.f);
      if (m) { const it = F.fin.stock.find(function (x) { return x.id === m[1]; }); if (it) { const v2 = FIL.finItemValue('stock', it); const out = document.getElementById(fid('fin.stock.' + it.id + '.value')); if (out && Number(it.qty) > 0 && Number(it.unitPrice) > 0) { out.value = v2.toLocaleString('ko-KR'); it.value = v2; const k = out.parentElement.querySelector('.kor'); if (k) k.textContent = kor(v2); } } }
    }
    if (el.dataset.sec) { setS(el.dataset.sec, el.value.replace(/[^\d]/g, '')); save(); }
  });
  document.addEventListener('change', function (ev) {
    const el = ev.target;
    if (el.dataset.f) {
      if (el.dataset.type === 'won') { const n = DH.num(el.value); setF(el.dataset.f, n || ''); el.value = n ? DH.fmt(n) : ''; }
      else setF(el.dataset.f, el.value);
      save(true); if (el.dataset.f === 'deceased.sex') renderPeople();
    }
  });
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('button, a'); if (!b) return;
    if (b.dataset.go) { ev.preventDefault(); show(b.dataset.go, true); return; }
    if (b.dataset.addFin) { const it = { id: FIL.id('i') }; if (b.dataset.addFin === 'stock') it.listed = '09'; F.fin[b.dataset.addFin].push(it); save(true); renderFin(); return; }
    if (b.dataset.delFin) { const x = b.dataset.delFin.split('|'); F.fin[x[0]] = F.fin[x[0]].filter(function (it) { return it.id !== x[1]; }); if (SEC.fin) delete SEC.fin[x[1]]; if (!F.fin[x[0]].length) { const a = E.assets.find(function (q) { return q.id === 'fin_' + x[0]; }); if (a) delete a.itemized; } save(true); renderFin(); return; }
    if (b.dataset.add) { const DEF = { debts: { kind: '01' }, charges: { kind: '06', quarter: '1', year: (E.deceased.date || '').slice(0, 4) }, funeral: { kind: '1' } }; F[b.dataset.add].push(Object.assign({ id: FIL.id('r') }, DEF[b.dataset.add] || {})); save(true); renderDebt(); return; }
    if (b.dataset.del) { const x = b.dataset.del.split('|'); F[x[0]] = F[x[0]].filter(function (it) { return it.id !== x[1]; }); save(true); renderDebt(); return; }
    if (b.id === 'btnPrev') { const i = SCREENS.indexOf(screen); if (i > 0) show(SCREENS[i - 1], true); return; }
    if (b.id === 'btnNext') { const i = SCREENS.indexOf(screen); if (i < SCREENS.length - 1) show(SCREENS[i + 1], true); else { save(true); location.href = product ? 'result.html?p=' + product + '#ask' : 'result.html'; } return; }
    if (b.id === 'btnClearSecret') { if (confirm('이 기기에 저장된 주민등록번호·계좌번호를 모두 지울까요?')) { SEC = {}; FIL.clearSecret(); render(); DH.toast('지웠습니다.'); } return; }
    if (b.id === 'btnOpenReturn') { openReturn(); return; }
  });
  function openReturn() {
    const RKEY = 'dh.inherit-tax-report.v1';
    try {
      save(true);
      const data = EST.toReturn(E, SEC); let key = null; try { key = JSON.parse(localStorage.getItem('dh.estate.key') || 'null'); } catch (e) { }
      data._key = (key || {}).no || '';
      localStorage.setItem(RKEY, JSON.stringify(data));
    } catch (e) { DH.toast('이 브라우저에 저장할 수 없습니다.', true); return; }
    location.href = 'inherit-tax-report.html#from=estate';
  }

  if (cur.from === 'link') { try { history.replaceState(null, '', location.pathname + location.search + location.hash); } catch (err) { } }
  render(); show(screen, false);
  window.FILING_UI = { get E() { return E; }, get F() { return F; }, get SEC() { return SEC; }, render: render, show: show, product: product };
})();
