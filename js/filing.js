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
  FIL.DEBT_GROUP = { '01': 'loan', '04': 'loan', '07': 'deposit', '08': 'deposit' };   // 그 밖의 채무종류 → other
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
    if (t === 'stock') { const q = n0(it.qty), u = n0(it.unitPrice); return q && u ? Math.round(q * u) : n0(it.value); }
    return Math.round(n0(it.value));
  };
  FIL.finSum = function (f, t) { return (f.fin[t] || []).reduce(function (s, it) { return s + FIL.finItemValue(t, it); }, 0); };
  FIL.debtGroup = function (kind) { return FIL.DEBT_GROUP[kind] || 'other'; };
  FIL.sync = function (e) {
    const f = FIL.get(e);
    FIL.FIN_TYPES.forEach(function (t) {
      if (!f.fin[t].length) return;
      const id = 'fin_' + t; let a = e.assets.find(function (x) { return x.id === id; });
      if (!a) { a = { id: id, type: t }; e.assets.push(a); }
      a.value = FIL.finSum(f, t); a.itemized = true;
    });
    if (f.debts.length) {
      const g = { loan: 0, deposit: 0, other: 0 };
      f.debts.forEach(function (d) { g[FIL.debtGroup(d.kind)] += Math.round(n0(d.amount)); });
      e.debts = Object.assign({}, e.debts, { loan: g.loan, deposit: g.deposit, other: g.other });
    }
    if (f.charges.length) e.debts = Object.assign({}, e.debts, { tax: f.charges.reduce(function (s, c) { return s + Math.round(n0(c.amount)); }, 0) });
    if (f.funeral.length) {
      const g = { '1': 0, '2': 0 };
      f.funeral.forEach(function (r) { g[r.kind === '2' ? '2' : '1'] += Math.round(n0(r.amount)); });
      e.funeral = Object.assign({}, e.funeral, { cost: g['1'], grave: g['2'] });
    }
    return e;
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
    return basis === 'appraisal' ? '02' : basis === 'gongsi' ? '08' : (a.type === 'apt' || a.type === 'officetel' ? '05' : '01');
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
