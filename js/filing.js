/* ============================================================
   신고서 채우기 (filing.js) — 상속 파일의 「건별 상세」 부분
   셀프 신고서·세무사 검토를 고르면 고객이 직접 채우는 칸들. 국세청 전자신고 레코드(02·05·06·08·09·10)에
   들어가는 값 중 주민등록번호·계좌번호를 뺀 모든 것이 여기 들어간다.
   저장: 상속 파일(dh.estate.v1).filing 에 함께 저장 → 링크(#e=)로 세무사에게 전달됨.
   비밀(주민등록번호·계좌번호): dh.estate.secret.v1 — 이 기기에만, 링크·시트·메일에는 절대 싣지 않음.
   ------------------------------------------------------------
   e.filing = {
     deceased: { name, cause('01'), bjd, bjdName, san, bunji, ho, block, dong, unit, road },
     filer:    { heirId, email, phone, address },
     heirs:    { [heirId]: { name, phone, relation(관계코드) } },
     assets:   { [assetId]: { bjd, bjdName, san, bunji, ho, block, dong, unit, road, area, sharePct, uniqNo, evalCode } },
     fin:      { deposit:[{ id, bank, bankCode, value }], stock:[{ id, name, listed('09'|'10'), qty, unitPrice, bizNo, value }],
                 insurance:[{ id, company, value }], retire:[{ id, company, value }], car:[{ id, name, value }], other:[{ id, desc, value }] },
     debts:    [{ id, kind('01'~'09'), creditor, creditorNo, from, to, amount }],
     charges:  [{ id, kind('01'~'06'), year, quarter, taxCode, amount }],
     funeral:  [{ id, kind('1'|'2'), payee, payeeNo, desc, amount }],
     updated
   }
   secret = { deceased: { ssn }, heirs: { [heirId]: { ssn } }, fin: { [itemId]: { account } } }
   ============================================================ */
(function (root) {
  'use strict';
  const EST = root.EST || require('./estate.js');
  const EC = root.EC || require('./estate-calc.js');
  const FIL = {};
  FIL.SECRET_KEY = 'dh.estate.secret.v1';
  FIL.LIMIT = 15e8;                                  // 셀프 신고서·세무사 검토는 총 상속재산 15억원 이하만
  FIL.FIN_TYPES = ['deposit', 'stock', 'insurance', 'retire', 'car', 'other'];
  FIL.FIN_LABEL = { deposit: '예금·적금', stock: '주식·펀드', insurance: '사망보험금', retire: '퇴직금·퇴직연금', car: '자동차', other: '그 밖의 재산' };
  FIL.DEBT_GROUP = { '01': 'loan', '07': 'deposit', '08': 'deposit' };   // 04 저당권채무는 채권자가 금융기관(사업자번호)일 때만 loan, 그 밖은 other
  FIL.STOCK_KIND = [['09', '상장주식'], ['10', '비상장주식'], ['fund', '펀드·ETF·채권']];
  FIL.TAX_CODES = [['10', '종합소득세'], ['22', '양도소득세'], ['41', '부가가치세'], ['31', '법인세'], ['32', '상속세'], ['33', '증여세'], ['57', '종합부동산세'], ['21', '퇴직소득세'], ['14', '근로소득세'], ['11', '이자소득세'], ['12', '배당소득세'], ['45', '증권거래세'], ['55', '농특세'], ['46', '인지세'], ['47', '개별소비세'], ['76', '과태료'], ['81', '가산금']];
  // 주식·펀드 구분 → 재산종류코드(②·05-5) / 유가증권구분(05-25) / 평가기준(⑧·05-6)
  FIL.stockCodes = function (it) {
    if (it.listed === '10') return { kind: '10', sec: '01', ev: '08' };
    if (it.listed === 'fund') return { kind: '09', sec: '08', ev: '06' };
    return { kind: '09', sec: '01', ev: '05' };
  };
  FIL.BANKS = [['004', 'KB국민'], ['088', '신한'], ['020', '우리'], ['081', '하나'], ['011', 'NH농협'], ['003', 'IBK기업'], ['023', 'SC제일'], ['027', '씨티'], ['002', 'KDB산업'], ['007', '수협'], ['031', 'iM(대구)'], ['032', '부산'], ['039', '경남'], ['034', '광주'], ['037', '전북'], ['035', '제주'], ['071', '우체국'], ['045', '새마을금고'], ['048', '신협'], ['050', '저축은행'], ['089', '케이뱅크'], ['090', '카카오뱅크'], ['092', '토스뱅크'], ['064', '산림조합'], ['ZZZ', '그 밖(증권사 등)']];
  FIL.BANK_NAME = function (code) { const b = FIL.BANKS.find(function (x) { return x[0] === code; }); return b ? b[1] : ''; };

  const n0 = function (v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; };
  FIL.blank = function () {
    return { deceased: {}, filer: {}, heirs: {}, assets: {}, fin: { deposit: [], stock: [], insurance: [], retire: [], car: [], other: [] }, debts: [], charges: [], funeral: [], updated: '' };
  };
  FIL.get = function (e) {
    const b = FIL.blank(); let f = e.filing;
    if (!f || typeof f !== 'object') f = {};
    Object.keys(b).forEach(function (k) { if (f[k] === undefined || f[k] === null || typeof f[k] !== typeof b[k]) f[k] = b[k]; });
    FIL.FIN_TYPES.forEach(function (t) { if (!Array.isArray(f.fin[t])) f.fin[t] = []; });
    ['debts', 'charges', 'funeral'].forEach(function (k) { if (!Array.isArray(f[k])) f[k] = []; });
    e.filing = f; return f;
  };
  FIL.id = function (p) { return EST.id(p || 'f'); };

  /* ---------- 건별 합계 → 1단계 금액 (엔진·서식·전산매체가 같은 숫자를 보게) ---------- */
  FIL.finItemValue = function (t, it) {
    if (t === 'stock') { const q = n0(it.qty), u = n0(it.unitPrice); return q && u ? Math.floor(q * u) : Math.round(n0(it.value)); }   // 원 단위 버림(서식 ⑦과 같게)
    return Math.round(n0(it.value));
  };
  FIL.finSum = function (f, t) { return (f.fin[t] || []).reduce(function (s, it) { return s + FIL.finItemValue(t, it); }, 0); };
  FIL.debtGroup = function (kind, r) {
    if (kind === '04') return String((r || {}).creditorNo || '').replace(/[^\d]/g, '').length === 10 ? 'loan' : 'other';
    return FIL.DEBT_GROUP[kind] || 'other';
  };
  const digits = function (v) { return String(v || '').replace(/[^\d]/g, ''); };
  // 건별 입력을 시작할 때 1단계 금액을 f.base 에 보관 → 건별을 모두 지우면 그 값으로 되돌린다 (금액이 0으로 사라지지 않게)
  FIL.sync = function (e) {
    const f = FIL.get(e); f.base = f.base || {};
    // 1단계에서 지워진 상속인·재산의 흔적 정리
    const heirIds = e.heirs.map(function (h) { return h.id; }), assetIds = e.assets.map(function (a) { return a.id; });
    Object.keys(f.heirs).forEach(function (id) { if (heirIds.indexOf(id) < 0) delete f.heirs[id]; });
    Object.keys(f.assets).forEach(function (id) { if (assetIds.indexOf(id) < 0) delete f.assets[id]; });
    if (f.filer.heirId && heirIds.indexOf(f.filer.heirId) < 0) delete f.filer.heirId;
    f.debts.forEach(function (r) { if (digits(r.creditorNo).length !== 10) r.creditorNo = '';   // 개인 주민번호는 받지 않는다(링크에 실리므로)
      else r.creditorNo = digits(r.creditorNo); });
    FIL.FIN_TYPES.forEach(function (t) {
      const id = 'fin_' + t; let a = e.assets.find(function (x) { return x.id === id; });
      if (f.fin[t].length) {
        if (!a) { a = { id: id, type: t }; e.assets.push(a); }
        if (!a.itemized) f.base[t] = n0(a.value);
        a.value = FIL.finSum(f, t); a.itemized = true;
      } else if (a && a.itemized) { delete a.itemized; a.value = f.base[t] || 0; if (!a.value) delete a.value; }
    });
    const d = e.debts || {};
    if (f.debts.length) {
      if (!f.base.debts) f.base.debts = { loan: n0(d.loan), deposit: n0(d.deposit), other: n0(d.other) };
      const g = { loan: 0, deposit: 0, other: 0 };
      f.debts.forEach(function (r) { g[FIL.debtGroup(r.kind, r)] += Math.round(n0(r.amount)); });
      e.debts = Object.assign({}, d, { loan: g.loan, deposit: g.deposit, other: g.other });
    } else if (f.base.debts) { e.debts = Object.assign({}, d, f.base.debts); delete f.base.debts; }
    if (f.charges.length) {
      if (f.base.tax === undefined) f.base.tax = n0(d.tax);
      e.debts = Object.assign({}, e.debts, { tax: f.charges.reduce(function (s, c) { return s + Math.round(n0(c.amount)); }, 0) });
    } else if (f.base.tax !== undefined) { e.debts = Object.assign({}, e.debts, { tax: f.base.tax }); delete f.base.tax; }
    const fu = e.funeral || {};
    if (f.funeral.length) {
      if (!f.base.funeral) f.base.funeral = { cost: n0(fu.cost), grave: n0(fu.grave) };
      const g = { '1': 0, '2': 0 };
      f.funeral.forEach(function (r) { g[r.kind === '2' ? '2' : '1'] += Math.round(n0(r.amount)); });
      e.funeral = Object.assign({}, fu, { cost: g['1'], grave: g['2'] });
    } else if (f.base.funeral) { e.funeral = Object.assign({}, fu, f.base.funeral); delete f.base.funeral; }
    return e;
  };
  // 1단계 금액(건별 시작 전 값) — 화면 머리글용
  FIL.baseOf = function (e, key) { const f = FIL.get(e), b = f.base || {}; return b[key]; };
  // 처음 건별로 나눌 때 1단계 금액을 첫 행으로 옮겨 준다 (고객이 "이미 넣은 3억"을 다시 적지 않게)
  FIL.seedRows = function (e, what) {
    const f = FIL.get(e), d = e.debts || {}, fu = e.funeral || {};
    if (FIL.FIN_TYPES.indexOf(what) >= 0) {
      const a = e.assets.find(function (x) { return x.id === 'fin_' + what; });
      const it = { id: FIL.id('i') }; if (what === 'stock') it.listed = '09';
      if (a && n0(a.value) && !a.itemized) it.value = Math.round(a.value);
      f.fin[what].push(it); return f.fin[what];
    }
    if (what === 'debts' && !f.debts.length) {
      if (n0(d.loan)) f.debts.push({ id: FIL.id('r'), kind: '01', creditor: '', amount: Math.round(d.loan) });
      if (n0(d.deposit)) f.debts.push({ id: FIL.id('r'), kind: '07', creditor: '', amount: Math.round(d.deposit) });
      if (n0(d.other)) f.debts.push({ id: FIL.id('r'), kind: '06', creditor: '', amount: Math.round(d.other) });
      if (f.debts.length) return f.debts;
    }
    if (what === 'charges' && !f.charges.length && n0(d.tax)) { f.charges.push({ id: FIL.id('r'), kind: '06', year: (e.deceased.date || '').slice(0, 4), quarter: '1', amount: Math.round(d.tax) }); return f.charges; }
    if (what === 'funeral' && !f.funeral.length && (n0(fu.cost) || n0(fu.grave))) {
      if (n0(fu.cost)) f.funeral.push({ id: FIL.id('r'), kind: '1', amount: Math.round(fu.cost) });
      if (n0(fu.grave)) f.funeral.push({ id: FIL.id('r'), kind: '2', amount: Math.round(fu.grave) });
      return f.funeral;
    }
    const DEF = { debts: { kind: '01' }, charges: { kind: '06', quarter: '1', year: (e.deceased.date || '').slice(0, 4) }, funeral: { kind: '1' } };
    f[what].push(Object.assign({ id: FIL.id('r') }, DEF[what] || {})); return f[what];
  };
  // 1단계 화면에서 어느 칸이 건별 입력으로 잠겨 있는지
  FIL.locked = function (e) {
    const f = e.filing ? FIL.get(e) : FIL.blank(); const out = {};
    FIL.FIN_TYPES.forEach(function (t) { if (f.fin[t].length) out['a.fin_' + t + '.value'] = f.fin[t].length; });
    if (f.debts.length) { out['debts.loan'] = out['debts.deposit'] = out['debts.other'] = f.debts.length; }
    if (f.charges.length) out['debts.tax'] = f.charges.length;
    if (f.funeral.length) { out['funeral.cost'] = out['funeral.grave'] = f.funeral.length; }
    return out;
  };
  FIL.save = function (e) { FIL.get(e).updated = new Date().toISOString(); FIL.sync(e); return EST.save(e); };

  /* ---------- 비밀 칸 (이 기기에만) ---------- */
  FIL.loadSecret = function () { try { return JSON.parse(localStorage.getItem(FIL.SECRET_KEY) || '{}') || {}; } catch (err) { return {}; } };
  FIL.saveSecret = function (s) { try { localStorage.setItem(FIL.SECRET_KEY, JSON.stringify(s || {})); return true; } catch (err) { return false; } };
  FIL.clearSecret = function () { try { localStorage.removeItem(FIL.SECRET_KEY); } catch (err) { } };
  FIL.mask = function (acct) { const d = String(acct || '').replace(/[^\d]/g, ''); return d.length >= 4 ? '****' + d.slice(-4) : ''; };

  /* ---------- 링크·전송용 ---------- */
  FIL.has = function (e) { const c = FIL.count(e); return c.total > 0; };
  FIL.NAME_DEFAULT = /^(배우자|자녀\d*|손자녀\d*|부모님|그 밖의 가족)$/;   // 1단계가 붙인 이름(성명이 아님)
  FIL.count = function (e) {
    const f = e.filing ? FIL.get(e) : FIL.blank();
    const fin = FIL.FIN_TYPES.reduce(function (s, t) { return s + f.fin[t].length; }, 0);
    const real = (e.assets || []).filter(function (a) { return EC.isReal(a) || a.type === 'bunyang'; });
    const addr = real.filter(function (a) { return !!FIL.addrText(f.assets[a.id]); }).length;
    const people = (f.deceased.name ? 1 : 0) + Object.keys(f.heirs).filter(function (id) { return f.heirs[id] && f.heirs[id].name; }).length;
    return { people: people, realTotal: real.length, realAddr: addr, fin: fin, debts: f.debts.length, charges: f.charges.length, funeral: f.funeral.length,
      total: people + addr + fin + f.debts.length + f.charges.length + f.funeral.length };
  };
  FIL.summary = function (e) {
    const c = FIL.count(e); if (!c.total) return '';
    return '신고서 채우기: 사람 ' + c.people + '명 · 부동산 주소 ' + c.realAddr + '/' + c.realTotal + ' · 금융 등 ' + c.fin + '건 · 채무 ' + c.debts + '건 · 공과금 ' + c.charges + '건 · 장례비 ' + c.funeral + '건';
  };
  FIL.strip = function (e) { const c = JSON.parse(JSON.stringify(e)); delete c.filing; return c; };
  FIL.overLimit = function (e, inh) { inh = inh || EC.calcInheritance(e); return (n0(inh.totalProperty) + n0(inh.priorGifts)) > FIL.LIMIT; };

  /* ---------- 주소 한 줄 (서식·안내용) ---------- */
  FIL.addrText = function (x) {
    if (!x) return '';
    if (x.road) return x.road;
    const parts = [x.bjdName, (x.san === '1' ? '산 ' : '') + (x.bunji ? x.bunji + (x.ho ? '-' + x.ho : '') : ''), x.block, x.dong ? x.dong + '동' : '', x.unit ? x.unit + '호' : ''];
    return parts.filter(Boolean).join(' ').trim();
  };
  // 평가기준코드 기본값 (상속 파일의 평가 방법에서)
  FIL.evalCode = function (a) {
    const basis = EC.valueBasis(a);
    if (EC.isFin(a) || a.type === 'retire' || a.type === 'car' || a.type === 'other') return a.type === 'stock' ? '05' : '06';
    if (basis === 'appraisal') return '02';
    if (basis === 'gongsi') return '08';
    if (a.type === 'apt' || a.type === 'officetel') return '05';          // 유사매매사례가액
    return a.basis === 'market' ? '01' : '06';                            // 땅·단독: 매매가를 골랐을 때만 01, 참고 시세만 넣었으면 06
  };
  // 아직 채우지 않은 칸(고객에게 보여 주는 목록)
  FIL.missing = function (e) {
    const f = FIL.get(e), out = [];
    if (!f.deceased.name) out.push({ sec: 'people', text: '돌아가신 분 성명' });
    if (!FIL.addrText(f.deceased)) out.push({ sec: 'people', text: '돌아가신 분 주소' });
    if (!f.filer.heirId) out.push({ sec: 'people', text: '신고인(상속인 중 한 명)' });
    if (!f.filer.address) out.push({ sec: 'people', text: '신고인 주소' });
    if (!f.filer.phone) out.push({ sec: 'people', text: '신고인 전화번호' });
    e.heirs.forEach(function (h, i) { const x = f.heirs[h.id] || {}; if (!x.name) out.push({ sec: 'people', text: EST.heirLabel(h, i + 1) + ' 성명' }); });
    e.assets.filter(function (a) { return (EC.isReal(a) || a.type === 'bunyang') && EC.assetValue(a) > 0; }).forEach(function (a) {
      const x = f.assets[a.id] || {}, nm = a.name || EC.TYPES[a.type].label;
      if (!FIL.addrText(x)) out.push({ sec: 'real', text: nm + ' 주소' });
      if (!n0(x.area) && a.type !== 'bunyang') out.push({ sec: 'real', text: nm + ' 면적(㎡)' });
    });
    FIL.FIN_TYPES.forEach(function (t) {
      const a = e.assets.find(function (x) { return x.id === 'fin_' + t; });
      if (a && n0(a.value) && !f.fin[t].length) out.push({ sec: 'fin', text: FIL.FIN_LABEL[t] + ' ' + Math.round(a.value).toLocaleString('ko-KR') + '원을 건별로 나눠 적기' });
      f.fin[t].forEach(function (it, i) {
        if (t === 'deposit' && !it.bankCode) out.push({ sec: 'fin', text: '예금 ' + (i + 1) + '번 은행' });
        if (t === 'stock' && !it.name) out.push({ sec: 'fin', text: '주식 ' + (i + 1) + '번 종목명' });
        if (!FIL.finItemValue(t, it)) out.push({ sec: 'fin', text: FIL.FIN_LABEL[t] + ' ' + (i + 1) + '번 금액' });
      });
    });
    const d = e.debts || {};
    if ((n0(d.loan) || n0(d.deposit) || n0(d.other)) && !f.debts.length) out.push({ sec: 'debt', text: '빚을 건별로 나눠 적기(채권자별)' });
    f.debts.forEach(function (r, i) { if (!r.creditor) out.push({ sec: 'debt', text: '채무 ' + (i + 1) + '번 채권자 이름' }); if (!r.from) out.push({ sec: 'debt', text: '채무 ' + (i + 1) + '번 빌린 날' }); if (!n0(r.amount)) out.push({ sec: 'debt', text: '채무 ' + (i + 1) + '번 금액' }); });
    if (n0(d.tax) && !f.charges.length) out.push({ sec: 'debt', text: '밀린 세금·공과금을 건별로 적기' });
    f.charges.forEach(function (r, i) { if (!/^\d{4}$/.test(String(r.year || ''))) out.push({ sec: 'debt', text: '공과금 ' + (i + 1) + '번 연도(4자리)' }); if (r.kind === '01' && !r.taxCode) out.push({ sec: 'debt', text: '공과금 ' + (i + 1) + '번 세목코드(국세)' }); });
    const fu = e.funeral || {};
    if ((n0(fu.cost) || n0(fu.grave)) && !f.funeral.length) out.push({ sec: 'debt', text: '장례비 지급처 적기' });
    return out;
  };

  root.FIL = FIL;
  if (typeof module === 'object' && module.exports) module.exports = FIL;
})(typeof window !== 'undefined' ? window : globalThis);
