/* ============================================================
   상속 파일 + 비밀 칸 → 국세청 전자신고 레코드 값 (efile-map.js)
   EF.build(estate, secret) → { records: [{ code, values(칸 번호: 값) }], problems: [...], totals }
   고객이 「신고서 채우기」(e.filing)에 적은 값이 먼저 들어가고, secret(세무사가 efile.html 에서 입력)이 있으면 그 값이 우선한다.
   secret(세무사가 efile.html 에서만 입력, 저장 안 함):
     agent   { userId, name, mgmtNo, phone, bizNo }                       세무대리인
     filer   { heirId, email, phone, address }                            신고인(상속인 중 1명)
     deceased{ name, ssn, sex, bjd, bjdName, san, bunji, ho, block, dong, unit, cause }
     heirs   { [heirId]: { name, ssn, phone, relation } }
     assets  { [assetId]: { bjd, bjdName, san, bunji, ho, block, dong, unit, area, sharePct, uniqNo, bankCode, account, bizNo } }
     fin     { [finItemId]: { account } }                                 건별 예금의 계좌번호
     debts   { loan|deposit|other: { creditor, creditorNo, from, to, kind } }, publicCharge { kind, year, quarter, taxCode }  (건별 입력이 없을 때)
     funeral { payee, payeeNo }
   ============================================================ */
(function (root) {
  'use strict';
  const EC = root.EC || require('./estate-calc.js');
  const CODES = root.EF_CODES || require('./efile-codes.js');
  const EF = root.EF || require('./efile.js');
  const FIL = root.FIL || require('./filing.js');
  // 고객이 적은 값(filing) 위에 세무사가 적은 값(secret)을 덮는다. 빈 문자열은 덮지 않는다.
  function over(base, top) { const o = Object.assign({}, base || {}); Object.keys(top || {}).forEach(function (k) { const v = top[k]; if (v !== '' && v !== undefined && v !== null) o[k] = v; }); return o; }
  const digits = function (s) { return String(s || '').replace(/[^\d]/g, ''); };
  const seq = function (n) { return String(n).padStart(6, '0'); };
  const ymd = function (s) { return digits(s).slice(0, 8); };
  const today = function () { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  // 끝수 배분: total 을 weights 비율로 나눠 정수 합계가 total 과 정확히 같게 (큰 나머지 우선)
  function allocate(total, weights) {
    total = Math.round(total); const W = weights.reduce(function (a, b) { return a + b; }, 0);
    if (!W) return weights.map(function () { return 0; });
    const raw = weights.map(function (w) { return total * w / W; }), base = raw.map(Math.floor);
    let rest = total - base.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - base[i], i]; }).sort(function (a, b) { return b[0] - a[0]; }).forEach(function (x) { if (rest > 0) { base[x[1]] += 1; rest -= 1; } });
    return base;
  }
  // 법정상속분을 정수 분수로: 배우자 1.5 · 자녀 1 · 대습 손자녀는 한 몫을 나눔
  function legalFractions(e) {
    // 모든 상속인의 법정상속분이 정수 분자가 되는 가장 작은 분모(최대 9999, 칸 길이 4)
    const L = EC.legalShares(e), ids = Object.keys(L);
    for (let D = 1; D <= 9999; D++) {
      if (ids.every(function (id) { const x = L[id] * D; return Math.abs(x - Math.round(x)) < 1e-6; })) {
        const num = {}; ids.forEach(function (id) { num[id] = Math.round(L[id] * D); }); return { num: num, den: D };
      }
    }
    const num = {}; ids.forEach(function (id) { num[id] = Math.round(L[id] * 1000); }); return { num: num, den: 1000 };
  }
  const PT = { apt: '05', house: '04', officetel: '06', shop: '06', land: '02', farm: '02', bunyang: '08', deposit: '11', stock: '09', insurance: '11', retire: '12', car: '12', other: '12' };   // 서식(estate.js PTYPE)과 같아야 한다
  const REAL = ['02', '03', '04', '05', '06', '07', '08'];

  function build(e, S) {
    S = S || {};
    const problems = [], add = function (t) { problems.push(t); };
    const warnings = [], warnAdd = function (t) { warnings.push(t); };
    const inh = EC.calcInheritance(e), d = inh.ded, legal = EC.legalShares(e);
    const date = e.deceased.date || '', ym = ymd(date).slice(0, 6);
    const F = FIL.get(e);
    const heirs = e.heirs.slice();
    const hs = {}; heirs.forEach(function (h) { hs[h.id] = over(F.heirs[h.id], (S.heirs || {})[h.id]); });
    const as = {}; e.assets.forEach(function (a) { as[a.id] = over(F.assets[a.id], (S.assets || {})[a.id]); });
    const fs0 = over(F.filer, S.filer), dc0 = over(F.deceased, S.deceased);
    const heirSeq = {}; heirs.forEach(function (h, i) { heirSeq[h.id] = seq(i + 1); });
    const filer = heirs.find(function (h) { return h.id === fs0.heirId; }) || heirs[0];
    if (!filer) add('상속인이 없습니다.');
    const relOf = function (h) { return (hs[h.id] && hs[h.id].relation) || CODES.defaultRelation(h, dc0.sex); };
    const R = [];

    /* 01 헤더 */
    const ag = S.agent || {};
    R.push({ code: '01', values: { 3: digits((hs[filer && filer.id] || {}).ssn), 8: '1', 9: ym, 10: ag.userId, 11: ag.name, 12: String(ag.mgmtNo || '').replace(/-/g, ''), 13: ag.phone, 14: digits(ag.bizNo), 15: '9000', 16: ym, 17: ym, 19: 'N', 20: 'N' } });

    /* 02 기본사항 */
    const dc = dc0, fs = fs0, fh = hs[filer && filer.id] || {};
    if (!dc.name) add('피상속인 성명을 넣어 주세요.');
    if (digits(dc.ssn).length !== 13) add('피상속인 주민등록번호 13자리를 넣어 주세요.');
    if (digits(dc.bjd).length !== 10) add('피상속인 주소의 법정동코드 10자리를 넣어 주세요.');
    if (!fs.address) add('신고인 주소를 넣어 주세요.');
    if (!fs.phone && !fh.phone) add('신고인 전화번호를 넣어 주세요.');
    R.push({ code: '02', values: { 3: fh.name || (filer && filer.name), 4: digits(fh.ssn), 5: fs.email, 6: fs.address, 7: filer ? relOf(filer) : '', 8: fs.phone, 9: 'N',
      10: dc.name, 11: digits(dc.ssn), 12: digits(dc.bjd), 13: dc.bjdName, 14: dc.san || '0', 15: dc.bunji || 0, 16: dc.ho || 0, 17: dc.block, 18: dc.dong, 19: dc.unit, 22: dc.cause || '01', 23: ymd(date) } });
    R[R.length - 1].values[8] = fs.phone || fh.phone;

    /* 05 재산명세 (상속재산 + 사전증여) */
    const assetRows = []; let aNo = 0;
    const nonHeir = heirs.filter(function (h) { return h.rel === 'grandchild' && !h.substitute; }).map(function (h) { return h.id; });
    const finRows = [];                                   // 19 레코드용: { no, name, account }
    e.assets.filter(function (a) { return EC.assetValue(a) > 0; }).forEach(function (a) {
      const s = EC.sharesOf(e, a, legal), x = as[a.id] || {};
      const toNon = nonHeir.reduce(function (t, id) { return t + (s[id] || 0); }, 0);
      const items = FIL.FIN_TYPES.indexOf(a.type) >= 0 && F.fin[a.type].length ? F.fin[a.type] : null;
      // 건별 입력이 있으면 한 건이 한 레코드, 없으면 합계 한 레코드
      (items || [null]).forEach(function (it) {
        const v = it ? FIL.finItemValue(a.type, it) : EC.assetValue(a); if (!v) return;
        const sec = it ? ((S.fin || {})[it.id] || {}) : {};
        let kind = PT[a.type] || '12', ev = x.evalCode || FIL.evalCode(a), secKind = '01';
        if (it && a.type === 'stock') { const sc = FIL.stockCodes(it); kind = sc.kind; ev = sc.ev; secKind = sc.sec; }
        // 상속인 몫(A11)과 상속인 외(유증, A12) 몫이 섞이면 레코드를 둘로 나눈다 (서식 별지와 같게)
        const parts = toNon >= 0.999 ? [['A12', 1]] : toNon > 0 ? [['A11', 1 - toNon], ['A12', toNon]] : [['A11', 1]];
        const amounts = allocate(Math.round(v), parts.map(function (q) { return q[1]; }));
        parts.forEach(function (part, pi) {
        aNo += 1; const no = seq(aNo);
        const isNonPart = part[0] === 'A12', pv = amounts[pi];
        const vals = { 3: no, 4: part[0], 5: kind, 6: ev, 7: pv, 21: 'N' };
        const label = it ? (it.name || it.company || FIL.BANK_NAME(it.bankCode) || it.bank || it.desc || EC.TYPES[a.type].label) : (a.name || EC.TYPES[a.type].label);
        if (REAL.indexOf(kind) >= 0) {
          Object.assign(vals, { 9: Number(x.area) || 0, 11: digits(x.bjd), 12: x.bjdName, 13: x.san || '0', 14: x.bunji || 0, 15: x.ho || 0, 16: x.block, 17: x.dong, 18: x.unit, 19: x.uniqNo, 20: x.sharePct !== undefined && x.sharePct !== '' ? Number(x.sharePct) : 100 });
          if (digits(x.bjd).length !== 10) add(label + ': 법정동코드 10자리를 넣어 주세요.');
          if (!Number(x.area) && a.type !== 'bunyang') add(label + ': 면적(㎡)을 넣어 주세요.');
        }
        if (kind === '09' || kind === '10') {
          const share = parts.length > 1 ? part[1] : 1;
          const qty = it && Number(it.qty) > 0 ? Math.round(Number(it.qty) * share * 1000) / 1000 : 1, unit = it && Number(it.qty) > 0 && Number(it.unitPrice) > 0 ? Math.round(Number(it.unitPrice)) : pv;
          Object.assign(vals, { 8: qty, 10: unit, 24: digits(it ? it.bizNo : x.bizNo), 25: secKind });
        }
        if (kind === '11') {
          const bank = it ? (it.bankCode || x.bankCode) : x.bankCode, acct = it ? (sec.account || x.account) : x.account;
          Object.assign(vals, { 26: bank && bank !== 'ZZZ' ? bank : 'ZZZ', 27: digits(dc.ssn), 28: acct });
          finRows.push({ no: no, name: label + (a.type === 'deposit' ? ' 예금' : ''), account: acct });
        }
        if (kind === '12') Object.assign(vals, { 8: 1, 29: label });
        if (a.type === 'insurance') vals[30] = '20';
        if (a.type === 'retire') vals[30] = '10';
        R.push({ code: '05', values: vals });
        // 07 레코드용 지분: 이 레코드가 가리키는 사람들(상속인 / 상속인 외)만, 합이 1이 되게
        const sh = {}; heirs.forEach(function (h) { const isNon = nonHeir.indexOf(h.id) >= 0; if (isNon === isNonPart && (s[h.id] || 0) > 0) sh[h.id] = s[h.id] / (part[1] || 1); });
        assetRows.push({ a: a, no: no, value: pv, shares: sh, area: Math.round((Number(x.area) || 0) * (part[1] || 1) * 1000) / 1000 });
        });
      });
    });
    const heirIds = heirs.map(function (h) { return h.id; });
    (e.gifts || []).filter(function (g) { return Number(g.value) > 0; }).forEach(function (g) {
      aNo += 1;
      R.push({ code: '05', values: { 3: seq(aNo), 4: heirIds.indexOf(g.to) >= 0 && nonHeir.indexOf(g.to) < 0 ? 'A21' : 'A22', 5: '12', 6: '06', 7: Math.round(Number(g.value)), 8: 1, 21: 'N', 29: '사전증여재산' + (g.year ? ' ' + g.year + '년' : '') } });
    });

    /* 04 과세가액 */
    const f10 = Math.round(inh.totalProperty), f22 = Math.round(inh.debtParts.tax), f23 = Math.round(inh.funeral), f24 = Math.round(inh.debtParts.loan + inh.debtParts.deposit + inh.debtParts.other);
    const f21 = f22 + f23 + f24, f26 = Math.round(inh.priorGifts);
    const f29 = Math.max(0, f10 - f21) + f26;
    if (f29 !== Math.round(inh.taxable)) add('과세가액 검산 불일치: ' + f29 + ' ≠ ' + inh.taxable);
    R.push({ code: '04', values: { 3: f10, 4: 0, 5: f10, 6: 0, 10: 0, 14: f21, 15: f22, 16: f23, 17: f24, 18: f26, 19: f26, 22: f29 } });

    /* 06 상속인별 상속현황 · 07 상속재산관계 */
    const fr = legalFractions(e);
    const received = heirs.map(function (h) { return inh.byHeir[h.id] || 0; });
    const recInt = allocate(f10, received);
    const legalAmt = allocate(f10, heirs.map(function (h) { return legal[h.id] || 0; }));
    const pct = allocate(10000000, received.some(function (x) { return x > 0; }) ? received : heirs.map(function (h) { return legal[h.id] || 0; }));   // 0.00001% 단위, 합계 100%
    const act = allocate(1000, received);
    const debtA = allocate(f24, received), taxA = allocate(f22, received), funA = allocate(f23, received);
    heirs.forEach(function (h, i) {
      const x = hs[h.id] || {};
      const gifts = Math.round((e.gifts || []).filter(function (g) { return g.to === h.id; }).reduce(function (s, g) { return s + Number(g.value || 0); }, 0));
      const dy = Math.floor(Number(h.disabledYears) || 0);
      R.push({ code: '06', values: { 3: heirSeq[h.id], 4: relOf(h), 5: x.name || h.name, 6: digits(x.ssn), 7: x.phone,
        8: fr.num[h.id] || 0, 9: fr.den || 1, 10: legalAmt[i], 11: act[i], 12: 1000, 13: recInt[i], 14: pct[i] / 100000,
        15: recInt[i], 23: gifts, 26: recInt[i] + gifts, 27: 'N', 28: CODES.defaultHeirKind(h), 29: dy ? 'Y' : 'N', 30: Number(h.livedYears) > 0 ? 'Y' : 'N', 31: dy,
        32: debtA[i], 33: taxA[i], 34: funA[i] } });
      if (digits(x.ssn).length !== 13) add((x.name || h.name || '상속인') + ': 주민등록번호 13자리를 넣어 주세요.');
    });
    assetRows.forEach(function (r) {
      const ids = heirs.filter(function (h) { return (r.shares[h.id] || 0) > 0; });
      const vals = allocate(r.value, ids.map(function (h) { return r.shares[h.id]; }));
      ids.forEach(function (h, k) {
        R.push({ code: '07', values: { 3: r.no, 4: heirSeq[h.id], 5: Math.round(r.shares[h.id] * 100000) / 1000, 6: 100, 7: 0, 8: vals[k], 9: Math.round(r.area * r.shares[h.id] * 10000) / 10000 } });
      });
    });

    /* 08 채무 · 09 공과금 · 10 장례비용 — 건별 입력(filing)이 있으면 그대로, 없으면 합계 한 줄 */
    const dS = S.debts || {}; let dNo = 0; const debtNos = {};
    if (F.debts.length) {
      F.debts.forEach(function (r) {
        const amt = Math.round(Number(r.amount) || 0); if (!amt) return;
        dNo += 1; const no = seq(dNo); if (FIL.debtGroup(r.kind, r) === 'loan') { debtNos.loanList = debtNos.loanList || []; debtNos.loanList.push({ no: no, name: r.creditor || '금융채무' }); }
        R.push({ code: '08', values: { 3: no, 4: r.kind || '06', 5: ymd(r.from) || ymd(date), 6: ymd(r.to), 7: r.creditor, 8: digits(r.creditorNo) || '9999999999', 9: amt, 10: f24 } });
        if (!r.creditor) add('채무 ' + dNo + '번: 채권자 이름을 넣어 주세요.');
      });
      const dSum = F.debts.reduce(function (t, r) { return t + Math.round(Number(r.amount) || 0); }, 0);
      if (dSum !== f24) add('채무 건별 합계(' + dSum + ')가 과세가액의 채무(' + f24 + ')와 다릅니다. 「신고서 채우기」에서 저장을 다시 눌러 주세요.');
    } else {
      [['loan', '01'], ['deposit', '07'], ['other', '06']].forEach(function (k) {
        const amt = Math.round(inh.debtParts[k[0]]); if (!amt) return;
        const x = dS[k[0]] || {}; dNo += 1; debtNos[k[0]] = seq(dNo);
        R.push({ code: '08', values: { 3: seq(dNo), 4: x.kind || k[1], 5: ymd(x.from) || ymd(date), 6: ymd(x.to), 7: x.creditor || (k[0] === 'loan' ? '금융기관' : ''), 8: digits(x.creditorNo) || '9999999999', 9: amt, 10: f24 } });
        if (!x.creditor && k[0] !== 'loan') add('채무(' + k[0] + '): 채권자 이름을 넣어 주세요.');
      });
    }
    if (F.charges.length) {
      F.charges.forEach(function (r) {
        const amt = Math.round(Number(r.amount) || 0); if (!amt) return;
        dNo += 1; R.push({ code: '09', values: { 3: seq(dNo), 4: r.kind || '06', 5: r.year || ym.slice(0, 4), 6: r.quarter || '1', 7: amt, 8: f22, 9: r.kind === '01' ? (r.taxCode || '') : '' } });
        if (r.kind === '01' && !r.taxCode) add('공과금 ' + dNo + '번(국세): 세목코드를 넣어 주세요.');
      });
      const cSum = F.charges.reduce(function (t, r) { return t + Math.round(Number(r.amount) || 0); }, 0);
      if (cSum !== f22) add('공과금 건별 합계(' + cSum + ')가 과세가액의 공과금(' + f22 + ')과 다릅니다.');
    } else if (f22) { const pc = S.publicCharge || {}; dNo += 1; R.push({ code: '09', values: { 3: seq(dNo), 4: pc.kind || '06', 5: pc.year || ym.slice(0, 4), 6: pc.quarter || '1', 7: f22, 8: f22, 9: pc.kind === '01' ? (pc.taxCode || '') : '' } }); }
    if (F.funeral.length) {
      // 서식·전산매체의 장례비 행은 실제 지출액, 공제액(f23)은 04·06 레코드에서 한도 적용
      F.funeral.forEach(function (r) {
        const amt = Math.round(Number(r.amount) || 0); if (!amt) return;
        dNo += 1; R.push({ code: '10', values: { 3: seq(dNo), 4: r.kind === '2' ? '2' : '1', 5: digits(r.payeeNo), 6: r.payee, 7: r.desc || (r.kind === '2' ? '봉안시설·자연장지' : '장례비용'), 8: amt, 9: f23 } });
      });
    } else {
      const fx = S.funeral || {}; const general = Math.max(inh.funeralGeneral, EC.R.funeralMin);
      dNo += 1; R.push({ code: '10', values: { 3: seq(dNo), 4: '1', 5: digits(fx.payeeNo), 6: fx.payee, 7: '장례비용', 8: Math.round(general), 9: f23 } });
      if (inh.funeralGrave) { dNo += 1; R.push({ code: '10', values: { 3: seq(dNo), 4: '2', 5: digits(fx.payeeNo), 6: fx.payee, 7: '봉안시설·자연장지', 8: Math.round(inh.funeralGrave), 9: f23 } }); }
    }

    /* 11 상속공제 */
    const lump = d.lumpOrPersonal === EC.R.lumpSum && !d.spouseOnly && (EC.R.basic + d.personal) <= EC.R.lumpSum;
    const p19 = d.children * EC.R.child, p20 = d.minorYears * EC.R.minorPerYear, p21 = d.seniors * EC.R.senior, p22 = d.disabledYears * EC.R.disabledPerYear;
    const g19 = Math.round(f29) > 5e8 ? Math.round(inh.priorGiftTaxBase) : 0;
    const limit = Math.max(0, f29 - Math.round(inh.skipAmount) - g19);
    if (limit !== Math.round(d.limit)) add('공제한도 검산 불일치: ' + limit + ' ≠ ' + d.limit);
    R.push({ code: '11', values: { 3: lump ? 0 : EC.R.basic, 4: lump ? 0 : p19, 5: lump ? 0 : p20, 6: lump ? 0 : p21, 7: lump ? 0 : p22, 8: lump ? EC.R.lumpSum : 0,
      11: Math.round(d.spouse), 12: Math.round(d.fin), 14: Math.round(d.cohabit), 15: limit, 16: Math.round(d.applied), 17: Math.round(inh.skipAmount), 18: 0, 19: g19 } });

    /* 12 배우자 */
    const sp = heirs.find(function (h) { return h.rel === 'spouse'; });
    if (sp) R.push({ code: '12', values: { 3: heirSeq[sp.id], 4: e.assets.some(function (a) { return (a.split || []).length; }) ? 'Y' : 'N', 5: fr.num[sp.id] || 0, 6: fr.den || 1, 7: Math.round(d.giftToSpouseBase || 0) } });

    /* 19·20 금융재산 */
    if (d.fin > 0) {
      let fNo = 0;
      assetRows.filter(function (r) { return EC.isFin(r.a); }).forEach(function (r) { const fr = finRows.find(function (q) { return q.no === r.no; }); fNo += 1; R.push({ code: '19', values: { 3: seq(fNo), 4: r.no, 6: fr ? fr.name : (r.a.name || EC.TYPES[r.a.type].label), 7: fr ? fr.account : (as[r.a.id] || {}).account } }); });
      (debtNos.loanList || (debtNos.loan ? [{ no: debtNos.loan, name: '금융채무' }] : [])).forEach(function (q) { fNo += 1; R.push({ code: '19', values: { 3: seq(fNo), 5: q.no, 6: q.name } }); });
      const finA = Math.round(e.assets.filter(EC.isFin).reduce(function (s, a) { return s + EC.assetValue(a); }, 0)), finD = Math.round(inh.debtParts.loan);
      const net = Math.max(0, finA - finD);
      R.push({ code: '20', values: { 3: finA, 4: finD, 5: net, 6: EC.finDeduction(net), 7: Math.round(d.fin) } });
    }

    /* 23·24 동거주택 */
    if (d.cohabit > 0) {
      const r = assetRows.find(function (x) { return EC.isHouse(x.a) && x.a.lived; });
      const q = heirs.filter(function (h) { return (h.rel === 'child' || (h.rel === 'grandchild' && h.substitute)) && !Number(h.houses) && Number(h.livedYears) >= 10 && (r.shares[h.id] || 0) > 0; });
      const qPct = Math.round(q.reduce(function (s, h) { return s + r.shares[h.id]; }, 0) * 100);
      const base = Math.max(0, r.value - Math.round(Number(r.a.secured) || 0));
      const target = Math.floor(base * qPct / 100);
      R.push({ code: '23', values: { 3: r.no, 5: Math.max.apply(null, q.map(function (h) { return Math.floor(Number(h.livedYears) || 0); })), 6: base, 7: 'Y', 8: 'ZZ', 9: qPct, 10: target, 11: EC.R.cohabitMax, 12: Math.min(target, EC.R.cohabitMax) } });
      if (Math.min(target, EC.R.cohabitMax) !== Math.round(d.cohabit)) warnAdd('동거주택공제: 전산매체 23레코드는 지분을 정수 %로만 받아(' + qPct + '%) 공제액이 ' + Math.min(target, EC.R.cohabitMax).toLocaleString('ko-KR') + '원으로 계산되지만, 11·03레코드와 신고서는 엔진 값 ' + Math.round(d.cohabit).toLocaleString('ko-KR') + '원입니다. 홈택스 변환 결과에서 어느 쪽을 쓰는지 확인하고 필요하면 11레코드 14번을 맞추세요.');
      q.forEach(function (h) { const p = Math.round(r.shares[h.id] * 10000) / 100; R.push({ code: '24', values: { 3: heirSeq[h.id], 4: p, 5: 'Y', 6: 'Y', 7: p } }); });
    }

    /* 03 세액계산 (공제 합계는 11 레코드와 같아야 함) */
    const t20 = Math.round(inh.taxBase), t22 = Math.round(inh.calculatedTax), t23 = Math.round(inh.surcharge), t24 = t22 + t23;
    const t29 = Math.round(inh.giftCredit), t32 = Math.round(inh.shortTermCredit || 0), t33 = Math.round(inh.reportCredit), t27 = t29 + t32 + t33;
    const t40 = Math.max(0, t24 - t27);
    if (t40 !== Math.round(inh.payable)) add('납부세액 검산 불일치: ' + t40 + ' ≠ ' + inh.payable);
    R.push({ code: '03', values: { 3: f29, 4: Math.round(d.applied), 5: Math.round(inh.appraisalFee), 6: t20, 7: t20 ? inh.rate.rate * 100 : 0, 8: t22, 9: t23, 10: t24, 13: t27, 14: t29, 15: t29, 18: t32, 19: t33, 26: t40, 33: t40 ? today() : '', 34: t40 } });

    // 수록 순서: 01, 02, 03, 그다음 첨부서류(자료구분 순)
    const order = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '19', '20', '23', '24'];
    R.sort(function (x, y) { return order.indexOf(x.code) - order.indexOf(y.code); });
    return { records: R, problems: problems, warnings: warnings, totals: { taxable: f29, payable: t40 } };
  }

  // 레코드 → 바이트 + 형식 오류
  function render(built) {
    const lines = built.records.map(function (r) { return EF.record(r.code, r.values); });
    const errors = [], warn = [];
    lines.forEach(function (l) { Array.prototype.push.apply(errors, l.errors); Array.prototype.push.apply(warn, l.warn); });
    Array.prototype.push.apply(warn, built.warnings || []);
    return { lines: lines, errors: errors, warn: warn, bytes: EF.fileBytes(lines) };
  }

  EF.build = build; EF.render = render; EF.allocate = allocate; EF.legalFractions = legalFractions;
  if (typeof module === 'object' && module.exports) module.exports = EF;
})(typeof window !== 'undefined' ? window : globalThis);
