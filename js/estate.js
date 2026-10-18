/* ============================================================
   상속 파일 (estate.js) — 한 번 입력하면 모든 화면이 같이 쓰는 데이터
   저장: localStorage 'dh.estate.v1' (이 기기에만) / 주소 #e=… (링크로 공유·시트 「다시 보기」)
   주민등록번호·계좌번호·정확한 주소는 이 파일에 넣지 않는다(일부러 칸이 없음).
   ------------------------------------------------------------
   {
     v: 1,
     deceased: { date: 'YYYY-MM-DD' },
     heirs:  [{ id, rel: spouse|child|grandchild|parent|other, name, age, houses(지금 가진 집 수), ownGongsi(그 집 공시가 합계),
                livedYears(돌아가신 분과 같이 산 햇수), disabledYears(장애인 기대여명 연수), substitute(대습 손자녀) }],
     assets: [{ id, type(EC.TYPES), name, value(시가), gongsi(공시가), lived(10년 이상 같이 산 집), secured(이 집 담보대출),
                small(85㎡ 이하, 기본 true), metro(수도권, 기본 true), sellPlan(soon|y3|y5|y10|keep), sellPrice,
                paid·premium(분양권), premiumByOther(보험료를 다른 사람이 냄), split: [{ heir, share }] }],
     debts:  { loan(은행 대출), deposit(돌려줄 보증금), tax(밀린 세금·공과금), other(병원비 등) },
     funeral:{ cost, grave },
     gifts:  [{ id, to(heirId|'other'), year, value, taxBase, taxPaid }],
     misc:   { appraisalFee },
     opened: ['T02', …],   // 열어 본 티칭 포인트
     meta:   { updated, source }
   }
   ============================================================ */
(function (root) {
  'use strict';
  const EST = {};
  EST.KEY = 'dh.estate.v1';

  /* ---------- 가격·회사 정보 (여기만 고치면 모든 화면에 반영) ---------- */
  EST.PRICE = {
    self: 99000,          // 셀프 신고서
    review: 330000,       // 세무사 검토 상담
    fileBase: 990000,     // 신고 대행 기본
    fileRate: 0.001,      // 신고 대행: 상속재산 10억 초과분 × 0.1%
    fileOver: 1e9
  };
  EST.FIRM = { name: '대한세무법인', email: 'sjlee@taxdh.net', bank: '' /* 예: '○○은행 000-000-000000 대한세무법인' — 비어 있으면 접수 후 이메일로 안내 */ };
  EST.fileFee = function (totalProperty, paidBefore) {
    const p = EST.PRICE;
    const fee = p.fileBase + Math.max(0, (Number(totalProperty) || 0) - p.fileOver) * p.fileRate;
    return Math.max(0, Math.round(fee / 10000) * 10000 - (paidBefore || 0));
  };

  /* ---------- 기본 모양 ---------- */
  EST.blank = function () {
    return { v: 1, deceased: { date: '' }, heirs: [], assets: [], debts: {}, funeral: {}, gifts: [], priors: [], misc: {}, opened: [], meta: {} };
  };
  let seq = 0;
  EST.id = function (p) { seq += 1; return (p || 'x') + Date.now().toString(36).slice(-4) + seq.toString(36); };
  EST.normalize = function (e) {
    const b = EST.blank();
    e = (e && typeof e === 'object') ? e : {};
    Object.keys(b).forEach(function (k) { if (e[k] === undefined || e[k] === null) e[k] = b[k]; });
    ['heirs', 'assets', 'gifts', 'priors', 'opened'].forEach(function (k) { if (!Array.isArray(e[k])) e[k] = []; });
    e.heirs = e.heirs.filter(function (h) { return h && h.id && h.rel; });
    e.assets = e.assets.filter(function (a) { return a && a.id && a.type; });
    e.v = 1;
    return e;
  };

  /* ---------- 저장 ---------- */
  EST.load = function () {
    try { const raw = localStorage.getItem(EST.KEY); return raw ? EST.normalize(JSON.parse(raw)) : null; } catch (err) { return null; }
  };
  EST.save = function (e) {
    e.meta = Object.assign({}, e.meta, { updated: new Date().toISOString() });
    try { localStorage.setItem(EST.KEY, JSON.stringify(e)); return true; } catch (err) { return false; }
  };
  EST.clear = function () { try { localStorage.removeItem(EST.KEY); } catch (err) { } };

  /* ---------- 링크 (#e=) ---------- */
  function compact(o) {
    if (Array.isArray(o)) return o.map(compact);
    if (!o || typeof o !== 'object') return o;
    const out = {};
    Object.keys(o).forEach(function (k) { const v = o[k]; if (v === '' || v === null || v === undefined || v === false) return; if (Array.isArray(v) && !v.length) return; out[k] = (typeof v === 'object') ? compact(v) : v; });
    return out;
  }
  EST.encode = function (e) {
    const s = JSON.stringify(compact(e));
    return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  EST.decode = function (str) {
    try { str = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return EST.normalize(JSON.parse(decodeURIComponent(escape(atob(str))))); } catch (err) { return null; }
  };
  EST.fromHash = function (hash) {
    const m = /[#&]e=([A-Za-z0-9_-]+)/.exec(hash || (root.location ? root.location.hash : ''));
    return m ? EST.decode(m[1]) : null;
  };
  EST.link = function (file, e) {
    const base = root.location ? root.location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '') : '';
    return base + file + '#e=' + EST.encode(e);
  };
  // 이 화면이 쓸 상속 파일: 주소(#e=)가 있으면 그것(그리고 저장), 없으면 이 기기에 저장된 것
  EST.current = function () {
    const fromLink = EST.fromHash();
    if (fromLink) { EST.save(fromLink); return { e: fromLink, from: 'link' }; }
    const saved = EST.load();
    return saved ? { e: saved, from: 'saved' } : { e: EST.blank(), from: 'new' };
  };

  /* ---------- 상속인 ---------- */
  EST.REL = { spouse: '배우자', child: '자녀', grandchild: '손자녀', parent: '부모님', other: '그 밖의 가족' };
  EST.heirLabel = function (h, i) { return h.name || ((EST.REL[h.rel] || '가족') + (h.rel === 'child' || h.rel === 'grandchild' ? (i || '') : '')); };
  // 자녀 수만 바꿨을 때: 자녀 heir 를 늘리거나 줄인다(입력한 정보는 앞에서부터 유지)
  EST.setChildren = function (e, n) {
    n = Math.max(0, Math.min(10, Math.floor(Number(n) || 0)));
    const kids = e.heirs.filter(function (h) { return h.rel === 'child'; });
    if (kids.length < n) for (let i = kids.length; i < n; i++) e.heirs.push({ id: EST.id('c'), rel: 'child', name: '자녀' + (i + 1) });
    else if (kids.length > n) {
      const drop = kids.slice(n).map(function (h) { return h.id; });
      e.heirs = e.heirs.filter(function (h) { return drop.indexOf(h.id) < 0; });
      e.assets.forEach(function (a) { if (a.split) a.split = a.split.filter(function (s) { return drop.indexOf(s.heir) < 0; }); });
      e.gifts.forEach(function (g) { if (drop.indexOf(g.to) >= 0) g.to = ''; });
    }
    return e;
  };
  EST.setSpouse = function (e, yes) {
    const sp = e.heirs.find(function (h) { return h.rel === 'spouse'; });
    if (yes && !sp) e.heirs.unshift({ id: EST.id('s'), rel: 'spouse', name: '배우자' });
    if (!yes && sp) {
      e.heirs = e.heirs.filter(function (h) { return h !== sp; });
      e.assets.forEach(function (a) { if (a.split) a.split = a.split.filter(function (s) { return s.heir !== sp.id; }); });
    }
    return e;
  };

  /* ---------- 더 정확해지는 빈칸 ---------- */
  EST.missing = function (e) {
    const out = [];
    const EC = root.EC;
    if (!(e.deceased || {}).date) out.push({ screen: 'A', field: 'deathDate', text: '돌아가신 날 — 신고 기한을 계산합니다' });
    (e.assets || []).forEach(function (a) {
      if (EC && EC.isReal(a) && !Number(a.gongsi)) out.push({ screen: 'B', field: 'gongsi_' + a.id, text: (a.name || EC.TYPES[a.type].label) + '의 공시가격 — 취득세·재산세·종부세가 정확해집니다' });
      if (EC && EC.isReal(a) && !Number(a.value) && a.type !== 'land' && a.type !== 'farm') out.push({ screen: 'B', field: 'value_' + a.id, text: (a.name || EC.TYPES[a.type].label) + '의 시세 — 아파트는 최근 거래가로 평가됩니다' });
    });
    (e.heirs || []).forEach(function (h, i) {
      if (h.houses === undefined || h.houses === '') out.push({ screen: 'A', field: 'houses_' + h.id, text: EST.heirLabel(h, i + 1) + '님이 지금 가진 집 수 — 취득세·종부세가 달라집니다' });
      else if (Number(h.houses) >= 1 && !Number(h.ownGongsi)) out.push({ screen: 'A', field: 'ownGongsi_' + h.id, text: EST.heirLabel(h, i + 1) + '님 집의 공시가격 — 종부세를 계산합니다' });
    });
    (e.priors || []).forEach(function (q) {
      if (!q.date || !Number(q.prevTax) || !Number(q.prevEstate) || !Number(q.reinherit)) out.push({ screen: 'E', field: 'prior_' + q.id, text: '그때의 상속(단기재상속) — 날짜·그때 산출세액·상속재산가액·다시 상속되는 재산을 넣으면 공제가 계산됩니다' });
    });
    return out;
  };

  /* ---------- 신고 서류 목록 (입력값 기준) ---------- */
  EST.docs = function (e) {
    const EC = root.EC, has = function (f) { return (e.assets || []).some(f); };
    const out = ['돌아가신 분의 가족관계증명서·기본증명서(상세)', '상속인 전원의 주민등록등본', '사망진단서 또는 제적등본'];
    if (has(function (a) { return EC && EC.isReal(a); })) out.push('부동산 등기부등본(집·땅·건물 모두)');
    if (has(function (a) { return a.basis === 'appraisal'; })) out.push('감정평가서(받으셨다면)');
    if (has(function (a) { return a.type === 'deposit' || a.type === 'stock'; })) out.push('돌아가신 날 기준 예금·주식 잔액증명서 (안심상속 원스톱 조회 결과로 은행 목록 확인)');
    if (has(function (a) { return a.type === 'insurance'; })) out.push('사망보험금 지급 내역서');
    if (has(function (a) { return a.type === 'bunyang'; })) out.push('분양계약서·납부 영수증');
    const d = e.debts || {};
    if (Number(d.loan)) out.push('은행 대출 잔액증명서');
    if (Number(d.deposit)) out.push('임대차계약서(돌려줄 보증금)');
    if (Number(d.tax)) out.push('밀린 세금·공과금 고지서');
    if (Number((e.funeral || {}).cost) > 5e6) out.push('장례비 영수증(장례식장·상조·묘지·봉안)');
    if ((e.gifts || []).length) out.push('10년 안에 낸 증여세 신고서');
    if ((e.priors || []).length) out.push('10년 안에 있었던 그때 상속의 상속세 신고서·결정통지서(단기재상속 세액공제용)');
    out.push('협의분할서(가족끼리 나누기로 했다면, 인감증명서 첨부)');
    return out;
  };

  /* ---------- 기존 「계산 후 셀프 절세」 20단계로 넘기기 ---------- */
  EST.toReport = function (e) {
    const EC = root.EC; if (!EC) return {};
    const won = function (v) { v = Math.round(Number(v) || 0); return v ? v.toLocaleString('ko-KR') : ''; };
    const inh = EC.calcInheritance(e);
    const sp = e.heirs.find(function (h) { return h.rel === 'spouse'; });
    const houses = e.assets.filter(EC.isHouse);
    const d = { hasSpouse: sp ? 'yes' : 'no', houseCount: String(Math.min(4, houses.length)) };
    houses.slice(0, 4).forEach(function (a, i) {
      const k = i + 1, sfx = k === 1 ? '' : '_' + k;
      d['houseValue' + sfx] = won(EC.assetValue(a));
      d['houseGongsi_' + k] = won(a.gongsi);
      if (a.lived) d['houseLived_' + k] = '10';
    });
    const sumOf = function (f) { return e.assets.filter(f).reduce(function (s, a) { return s + EC.assetValue(a); }, 0); };
    d.buildingValue = won(sumOf(function (a) { return a.type === 'shop'; }));
    d.agriculturalLandValue = won(sumOf(function (a) { return a.type === 'farm'; }));
    d.forestLandValue = won(sumOf(function (a) { return a.type === 'land'; }));
    d.otherProperty = won(sumOf(function (a) { return !EC.isHouse(a) && ['shop', 'farm', 'land'].indexOf(a.type) < 0; }));
    d.debts = won(inh.debts);
    d.funeralExpense = won((e.funeral || {}).cost); d.funeralEnshrine = won((e.funeral || {}).grave);
    const gSum = function (f) { return (e.gifts || []).filter(f).reduce(function (s, g) { return s + (Number(g.value) || 0); }, 0); };
    d.giftFromMother = won(gSum(function (g) { return sp && g.to === sp.id; }));
    d.giftToChildren = won(gSum(function (g) { return g.to && g.to !== 'other' && (!sp || g.to !== sp.id); }));
    d.giftToOthers = won(gSum(function (g) { return !g.to || g.to === 'other'; }));
    d.priorGiftTaxBase = won(inh.priorGiftTaxBase);
    d.giftTaxDeduction = won(inh.giftTaxPaid);
    d.appraisalFee = won((e.misc || {}).appraisalFee);
    d.childrensNumber = String(inh.ded.children); d.children = String(inh.ded.children);
    d.minorYears = String(inh.ded.minorYears); d.seniors = String(inh.ded.seniors); d.disabledYears = String(inh.ded.disabledYears);
    d.financialAssets = won(e.assets.filter(EC.isFin).reduce(function (s, a) { return s + EC.assetValue(a); }, 0));
    d.financialDebts = won((e.debts || {}).loan);
    d.skipGenAmount = won(inh.skipAmount);
    // 단기재상속: 20단계 보고서는 한 건만 받으므로 합쳐서 넘기고 기간은 가장 짧은 것
    const pr = (e.priors || []).filter(function (q) { return Number(q.prevTax) && Number(q.reinherit); });
    if (pr.length) {
      const yrs = pr.map(function (q) { return EC.shortYears(q.date, e.deceased.date); }).filter(Boolean);
      if (yrs.length) { d.shortYears = String(Math.min.apply(null, yrs)); d.shortPrevTax = won(pr[0].prevTax); d.shortPrevEstate = won(pr[0].prevEstate); d.shortReinherit = won(pr[0].reinherit); }
    }
    d._from = 'estate';
    Object.keys(d).forEach(function (k) { if (d[k] === '' || d[k] === '0' && /Value|Property|debts|gift/.test(k)) delete d[k]; });
    return d;
  };

  /* ---------- 셀프 신고서(inherit-tax-report.html) 서식으로 바꾸기 ----------
     신고서 페이지의 저장 모양 { assets:[행], step2:{칸·rows}, step4:{칸} } 을 만든다.
     ② 재산종류코드·⑧ 평가기준코드는 국세청 서식 코드표 기준. */
  const PTYPE = { apt: '05', house: '04', officetel: '06', shop: '06', land: '02', farm: '02', bunyang: '08', deposit: '11', stock: '09', insurance: '11', retire: '12', car: '12', other: '12' };
  EST.toReturn = function (e, secret) {
    const EC = root.EC, FIL = root.FIL; if (!EC) return {};
    secret = secret || {};
    const f = FIL ? FIL.get(e) : null;
    const inh = EC.calcInheritance(e);
    const won = function (v) { v = Math.round(Number(v) || 0); return v ? v.toLocaleString('ko-KR') : ''; };
    const heirIds = e.heirs.map(function (h) { return h.id; });
    const nonHeir = e.heirs.filter(function (h) { return h.rel === 'grandchild' && !h.substitute; }).map(function (h) { return h.id; });
    const assets = [];
    // 한 재산을 상속인/상속인외(A11/A12) 몫으로 나눠 행을 만든다
    const pushRows = function (a, v, base) {
      const s = EC.sharesOf(e, a);
      const toNon = nonHeir.reduce(function (t, id) { return t + (s[id] || 0); }, 0);
      const row = function (atype, amount) {
        const r = Object.assign({ atype: atype, ptype: PTYPE[a.type] || '12', foreign: 'no', country: '', loc: a.name || EC.TYPES[a.type].label, reg: '', qty: '', price: Math.round(amount), eval: '' }, base);
        if (toNon > 0 && toNon < 1 && !r.reg) r.reg = '지분 ' + Math.round((atype === 'A12' ? toNon : 1 - toNon) * 1000) / 10 + '%';
        if (r.qty && Number(r.qty) > 0) r.price = Math.round(amount / Number(r.qty));   // 서식은 수량 × 단가
        assets.push(r);
      };
      if (toNon >= 0.999) row('A12', v);
      else if (toNon > 0) { row('A11', v * (1 - toNon)); row('A12', v * toNon); }
      else row('A11', v);
    };
    e.assets.filter(function (a) { return EC.assetValue(a) > 0; }).forEach(function (a) {
      const v = EC.assetValue(a);
      const ev = FIL ? FIL.evalCode(a) : (EC.isFin(a) || a.type === 'retire' ? '08' : '01');
      // 건별로 적은 금융재산 등: 한 건이 한 행
      if (f && FIL.FIN_TYPES.indexOf(a.type) >= 0 && f.fin[a.type].length) {
        f.fin[a.type].forEach(function (it) {
          const iv = FIL.finItemValue(a.type, it); if (!iv) return;
          const sec = (secret.fin || {})[it.id] || {};
          const base = { eval: ev };
          if (a.type === 'deposit') { base.loc = (FIL.BANK_NAME(it.bankCode) || it.bank || '은행') + ' 예금'; base.reg = sec.account || ''; }
          else if (a.type === 'stock') { base.loc = it.name || '주식'; base.reg = it.bizNo || ''; base.qty = Number(it.qty) > 0 ? String(it.qty) : ''; base.ptype = it.listed === '10' ? '10' : '09'; base.eval = it.listed === '10' ? '08' : '05'; }
          else if (a.type === 'insurance') base.loc = (it.company ? it.company + ' ' : '') + '사망보험금';
          else if (a.type === 'retire') base.loc = (it.company ? it.company + ' ' : '') + '퇴직금';
          else base.loc = it.name || it.desc || EC.TYPES[a.type].label;
          pushRows(a, iv, base);
        });
        return;
      }
      const base = { eval: ev };
      if (f && f.assets[a.id]) {
        const x = f.assets[a.id];
        const addr = FIL.addrText(x); if (addr) base.loc = (a.name ? a.name + ' · ' : '') + addr;
        if (Number(x.area) > 0 && EC.isReal(a)) base.loc = (base.loc || a.name || EC.TYPES[a.type].label) + ' (' + Number(x.area) + '㎡)';   // 면적은 ⑤가 아니라 소재지 칸에 — ⑦은 수량×단가라서
        if (x.sharePct !== undefined && x.sharePct !== '' && Number(x.sharePct) < 100) base.reg = '지분 ' + Number(x.sharePct) + '%';
        if (x.evalCode) base.eval = x.evalCode;
      }
      pushRows(a, v, base);
    });
    (e.gifts || []).filter(function (g) { return Number(g.value) > 0; }).forEach(function (g) {
      assets.push({ atype: heirIds.indexOf(g.to) >= 0 ? 'A21' : 'A22', ptype: '12', foreign: 'no', country: '', loc: '사전증여' + (g.year ? ' (' + g.year + '년)' : ''), reg: '', qty: '', price: Math.round(Number(g.value)), eval: '' });
    });
    const d = e.debts || {}, fu = e.funeral || {};
    const KIND = { '01': 'finance', '02': 'other', '03': 'personal', '04': 'finance', '05': 'other', '06': 'other', '07': 'deposit', '08': 'deposit', '09': 'other' };
    let debt = [], utility = [], funeral = [];
    if (f && f.debts.length) debt = f.debts.filter(function (r) { return Number(r.amount) > 0; }).map(function (r) { return { kind: KIND[r.kind] || 'other', from: r.from || '', to: r.to || '', creditor: r.creditor || '', creditorId: r.creditorNo || '', addr: '', amt: Math.round(Number(r.amount)) }; });
    else {
      if (Number(d.loan)) debt.push({ kind: 'finance', creditor: '금융기관', amt: Number(d.loan) });
      if (Number(d.deposit)) debt.push({ kind: 'deposit', creditor: '임차인', amt: Number(d.deposit) });
      if (Number(d.other)) debt.push({ kind: 'other', creditor: '', amt: Number(d.other) });
    }
    if (f && f.charges.length) utility = f.charges.filter(function (r) { return Number(r.amount) > 0; }).map(function (r) { return { kind: r.kind || '06', year: r.year || '', quarter: r.quarter || '', amt: Math.round(Number(r.amount)) }; });
    else if (Number(d.tax)) utility = [{ kind: '06', year: (e.deceased.date || '').slice(0, 4), quarter: '', amt: Number(d.tax) }];
    // 서식의 봉안시설·자연장지 비용은 장례비 합계 「그중」 금액이므로 행에는 모두 적고 ㉘에 봉안 금액을 따로 적는다
    if (f && f.funeral.length) funeral = f.funeral.filter(function (r) { return Number(r.amount) > 0; }).map(function (r) { return { payeeId: r.payeeNo || '', payee: r.payee || '', desc: r.desc || (r.kind === '2' ? '봉안시설·자연장지' : '장례비용'), amt: Math.round(Number(r.amount)) }; });
    else { const funeralAll = (Number(fu.cost) || 0) + (Number(fu.grave) || 0); if (funeralAll) funeral = [{ payeeId: '', payee: '', desc: Number(fu.grave) ? '장례비용(봉안시설 포함)' : '장례비용', amt: funeralAll }]; }
    const sp = e.heirs.some(function (h) { return h.rel === 'spouse'; });
    // 4단계 신고인·피상속인 (주민등록번호는 비밀 저장소에서만)
    const step4 = { inheritance_date: e.deceased.date || '', skipValue: won(inh.skipAmount), skipMinor: !!inh.skipBig, giftTaxCredit: won(inh.giftTaxPaid), shortTermCredit: won(inh.shortTermCredit), appraisalFee: won((e.misc || {}).appraisalFee) };
    if (f) {
      const REL = { spouse: '배우자', child: '자녀', grandchild: '손자녀', parent: '부모', other: '기타 상속인' };
      const filer = e.heirs.find(function (h) { return h.id === f.filer.heirId; });
      if (filer) {
        const x = f.heirs[filer.id] || {};
        step4.applicant_name = x.name || filer.name || ''; step4.applicant_email = f.filer.email || ''; step4.applicant_address = f.filer.address || '';
        step4.applicant_phone_mobile = f.filer.phone || x.phone || ''; step4.relationship = filer.rel === 'grandchild' && !filer.substitute ? '수유자' : (REL[filer.rel] || '');
        step4.applicant_ssn = ((secret.heirs || {})[filer.id] || {}).ssn || '';
      }
      step4.deceased_name = f.deceased.name || ''; step4.deceased_address = FIL.addrText(f.deceased); step4.deceased_ssn = (secret.deceased || {}).ssn || '';
    }
    return {
      assets: assets,
      step2: { filing: 'ontime', residency: 'res', spouse: sp ? 'yes' : 'no', heirs: inh.ded.spouseOnly ? 'spouseOnly' : 'mixed',
        childCount: String(inh.ded.children || ''), minorYears: String(inh.ded.minorYears || ''), seniorCount: String(inh.ded.seniors || ''), disabledYears: String(inh.ded.disabledYears || ''),
        spouseInheritance: won(inh.ded.spouse), financialInheritance: won(inh.ded.fin), cohabitationDeduction: won(inh.ded.cohabit), enshrineAmount: won(fu.grave),
        priorGiftBase: won(inh.priorGiftTaxBase), renounced: '',
        rows: { debt: debt, utility: utility, funeral: funeral } },
      step4: step4,
      _from: 'estate', _savedAt: new Date().toISOString()
    };
  };

  root.EST = EST;
  if (typeof module === 'object' && module.exports) module.exports = EST;
})(typeof window !== 'undefined' ? window : globalThis);
