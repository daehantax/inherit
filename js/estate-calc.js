/* ============================================================
   상속 파일 계산 엔진 (estate-calc.js) — 화면과 무관한 순수 함수
   입력: 상속 파일(JSON, js/estate.js 스키마)
   출력: 상속세(전체) + 상속인별 취득세·재산세·종부세·양도세 + 합계
   브라우저: window.EC / Node: module.exports (테스트용)
   세율·공제는 2026년 10월 시행 기준. 기존 셀프 절세(report-engine.js)와 같은 산식.
   ============================================================ */
(function (root) {
  'use strict';

  const R = {
    inheritRate: [[1e8, .10, 0], [5e8, .20, 1e7], [1e9, .30, 6e7], [3e9, .40, 1.6e8], [Infinity, .50, 4.6e8]],
    lumpSum: 5e8, basic: 2e8, child: 5e7, minorPerYear: 1e7, senior: 5e7, disabledPerYear: 1e7,
    spouseMin: 5e8, spouseMax: 3e9, finMax: 2e8, cohabitMax: 6e8,
    funeralMin: 5e6, funeralMax: 1e7, enshrineMax: 5e6, appraisalMax: 5e6,
    reportCredit: .03, minTax: 5e5, surcharge: .30, surchargeMinorBig: .40,
    installmentMin: 2e7,
  };

  /* ---------- 자산 종류 ---------- */
  // 화면에 보이는 이름(쉬운 말)과 계산상 분류
  const TYPES = {
    apt:       { label: '아파트',            house: true,  real: true },
    house:     { label: '단독·다가구 주택',   house: true,  real: true },
    officetel: { label: '주거용 오피스텔',    house: true,  real: true },
    bunyang:   { label: '분양권·입주권',      house: false, real: false, bunyang: true },
    shop:      { label: '상가·건물',          house: false, real: true },
    land:      { label: '땅(대지·임야)',      house: false, real: true },
    farm:      { label: '농지(논·밭·과수원)', house: false, real: true, farm: true },
    deposit:   { label: '예금·적금',          fin: true },
    stock:     { label: '주식·펀드',          fin: true },
    insurance: { label: '사망보험금',         fin: true },
    retire:    { label: '퇴직금',             fin: false },
    car:       { label: '자동차',             fin: false },
    other:     { label: '그 밖의 재산',       fin: false },
  };
  function isHouse(a) { return !!(TYPES[a.type] && TYPES[a.type].house); }
  function isReal(a) { return !!(TYPES[a.type] && TYPES[a.type].real); }
  function isFin(a) { return !!(TYPES[a.type] && TYPES[a.type].fin); }

  const n0 = function (v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; };
  const sum = function (arr, f) { return arr.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); };
  const floor10 = function (v) { return Math.floor(v / 10) * 10; };

  /* ---------- 기본 세액표 ---------- */
  function inheritTax(base) {
    base = n0(base); if (!base) return 0;
    for (const [cap, rate, ded] of R.inheritRate) if (base <= cap) return Math.floor(base * rate - ded);
    return 0;
  }
  function inheritRateOf(base) {
    base = n0(base);
    for (const [cap, rate, ded] of R.inheritRate) if (base <= cap) return { rate: rate, ded: ded };
    return { rate: .5, ded: 4.6e8 };
  }
  function funeralAllowed(spent, grave) {
    spent = n0(spent); grave = n0(grave);
    const a = spent < R.funeralMin ? R.funeralMin : Math.min(spent, R.funeralMax);
    return a + Math.min(grave, R.enshrineMax);
  }
  function finDeduction(net) {
    net = n0(net);
    if (net <= 2e7) return net;
    if (net <= 1e8) return 2e7;
    return Math.min(Math.floor(net * .2), R.finMax);
  }
  function deductionLimit(taxable, bequestNonHeir, priorGiftTaxBase) {
    taxable = n0(taxable);
    let lim = taxable - n0(bequestNonHeir);
    if (taxable > 5e8) lim -= n0(priorGiftTaxBase);
    return Math.max(0, lim);
  }

  /* ---------- 상속인·법정상속분 ---------- */
  // 배우자 1.5 : 자녀 각 1. 대습상속 손자녀(먼저 돌아가신 자녀 몫)는 한 몫을 나눠 갖는 것으로 본다.
  // 자녀가 없으면 배우자 1.5 : 부모 각 1. 둘 다 없으면 배우자 단독, 배우자도 없으면 부모 → 그 밖의 가족 균등.
  function heirsOf(e) { return (e.heirs || []).filter(function (h) { return h && h.id; }); }
  function isLegalHeir(h) { return h.rel === 'spouse' || h.rel === 'child' || h.rel === 'parent' || h.rel === 'other' || (h.rel === 'grandchild' && h.substitute); }
  function legalShares(e) {
    const hs = heirsOf(e);
    const sp = hs.filter(function (h) { return h.rel === 'spouse'; });
    const ch = hs.filter(function (h) { return h.rel === 'child'; });
    const sub = hs.filter(function (h) { return h.rel === 'grandchild' && h.substitute; });
    const pa = hs.filter(function (h) { return h.rel === 'parent'; });
    const ot = hs.filter(function (h) { return h.rel === 'other'; });
    const out = {};
    hs.forEach(function (h) { out[h.id] = 0; });
    let units = [];   // [heirId|[ids], weight]
    const lineal = ch.length + (sub.length ? 1 : 0);
    if (lineal) {
      ch.forEach(function (h) { units.push([h.id, 1]); });
      if (sub.length) units.push([sub.map(function (h) { return h.id; }), 1]);
    } else if (pa.length) pa.forEach(function (h) { units.push([h.id, 1]); });
    else if (!sp.length && ot.length) ot.forEach(function (h) { units.push([h.id, 1]); });
    if (sp.length) units.push([sp[0].id, units.length ? 1.5 : 1]);
    const total = sum(units, function (u) { return u[1]; });
    if (!total) return out;
    units.forEach(function (u) {
      const ids = Array.isArray(u[0]) ? u[0] : [u[0]];
      ids.forEach(function (id) { out[id] += u[1] / total / ids.length; });
    });
    return out;
  }
  // 자산별 나누기: split 이 비어 있으면 법정상속분. 합이 1이 아니면 비율로 맞춘다.
  function sharesOf(e, a, legal) {
    legal = legal || legalShares(e);
    const ids = heirsOf(e).map(function (h) { return h.id; });
    const out = {}; ids.forEach(function (id) { out[id] = 0; });
    const sp = (a.split || []).filter(function (s) { return s && ids.indexOf(s.heir) >= 0 && n0(s.share) > 0; });
    if (!sp.length) { ids.forEach(function (id) { out[id] = legal[id] || 0; }); return out; }
    const t = sum(sp, function (s) { return n0(s.share); });
    sp.forEach(function (s) { out[s.heir] += n0(s.share) / t; });
    return out;
  }

  /* ---------- 자산 평가액 ---------- */
  // value(시가·감정가)가 있으면 그 값, 없으면 공시가격. 분양권은 낸 돈 + 프리미엄.
  function assetValue(a) {
    if (TYPES[a.type] && TYPES[a.type].bunyang) return n0(a.paid) + n0(a.premium) || n0(a.value);
    if (a.type === 'insurance' && a.premiumByOther) return 0;   // 보험료를 돌아가신 분이 내지 않았으면 상속재산 아님
    return n0(a.value) || n0(a.gongsi);
  }
  function valueBasis(a) {
    if (!isReal(a)) return 'value';
    if (a.basis === 'appraisal') return 'appraisal';
    return n0(a.value) ? 'market' : (n0(a.gongsi) ? 'gongsi' : 'none');
  }

  /* ---------- 상속세 ---------- */
  function calcInheritance(e, opt) {
    opt = opt || {};
    const hs = heirsOf(e), legal = legalShares(e);
    const assets = (e.assets || []).filter(function (a) { return a && assetValue(a) > 0; });
    const byHeir = {}; hs.forEach(function (h) { byHeir[h.id] = 0; });
    assets.forEach(function (a) { const s = sharesOf(e, a, legal); Object.keys(s).forEach(function (id) { byHeir[id] += assetValue(a) * s[id]; }); });

    const totalProperty = sum(assets, assetValue);
    const d = e.debts || {};
    const debts = n0(d.loan) + n0(d.deposit) + n0(d.tax) + n0(d.other);
    const f = e.funeral || {};
    const funeral = funeralAllowed(f.cost, f.grave);
    const gifts = (e.gifts || []).filter(function (g) { return g && n0(g.value) > 0; });
    const heirIds = hs.map(function (h) { return h.id; });
    const giftsToHeirs = sum(gifts.filter(function (g) { return heirIds.indexOf(g.to) >= 0; }), function (g) { return n0(g.value); });
    const priorGifts = sum(gifts, function (g) { return n0(g.value); });
    const giftTaxPaid = sum(gifts, function (g) { return n0(g.taxPaid); });
    // 증여 과세표준: 넣었으면 그 값, 없으면 받은 사람별 합계 − 증여재산공제(배우자 6억·성년 자녀 5천만·미성년 2천만·그 밖의 친족 1천만)
    const exemptOf = function (to) {
      const h = hs.find(function (x) { return x.id === to; });
      if (!h) return 0;
      if (h.rel === 'spouse') return 6e8;
      if (h.rel === 'child' || h.rel === 'grandchild') return n0(h.age) && h.age < 19 ? 2e7 : 5e7;
      return 1e7;
    };
    const groups = {};
    gifts.forEach(function (g) { const k = g.to || 'other'; (groups[k] = groups[k] || { value: 0, base: 0, known: true }); groups[k].value += n0(g.value); if (g.taxBase === undefined || g.taxBase === '' || g.taxBase === null) groups[k].known = false; else groups[k].base += n0(g.taxBase); });
    let priorGiftTaxBase = 0, giftBaseGuessed = false;
    Object.keys(groups).forEach(function (k) { const gr = groups[k]; if (gr.known) priorGiftTaxBase += gr.base; else { giftBaseGuessed = true; priorGiftTaxBase += Math.max(0, gr.value - exemptOf(k)); } });
    const giftToSpouseBase = (function () { const sp = hs.find(function (h) { return h.rel === 'spouse'; }); if (!sp || !groups[sp.id]) return 0; const gr = groups[sp.id]; return gr.known ? gr.base : Math.max(0, gr.value - 6e8); })();

    const taxable = Math.max(0, totalProperty - debts - funeral) + priorGifts;

    // 세대생략: 대습이 아닌 손자녀가 받는 재산
    const skipHeirs = hs.filter(function (h) { return h.rel === 'grandchild' && !h.substitute; });
    const skipAmount = Math.min(sum(skipHeirs, function (h) { return byHeir[h.id]; }), totalProperty);
    const skipBig = skipHeirs.some(function (h) { return n0(h.age) && h.age < 19; }) && skipAmount > 2e9;
    const skipDenom = totalProperty + giftsToHeirs;
    const skipRatio = skipDenom > 0 ? skipAmount / skipDenom : 0;

    // 받는 사람별 채무 부담: 받은 재산 비율로 나눈다
    const debtShare = function (id) { return totalProperty > 0 ? debts * byHeir[id] / totalProperty : 0; };

    /* 공제 */
    const spouse = hs.find(function (h) { return h.rel === 'spouse'; });
    const nonSpouse = hs.filter(function (h) { return h.rel !== 'spouse'; });
    const children = hs.filter(function (h) { return h.rel === 'child'; }).length;
    const minorYears = sum(nonSpouse.filter(function (h) { return h.age !== undefined && h.age !== '' && Number(h.age) < 19; }), function (h) { return 19 - Math.max(0, Math.floor(Number(h.age))); });
    const seniors = nonSpouse.filter(function (h) { return Number(h.age) >= 65; }).length;
    const disabledYears = sum(hs, function (h) { return Math.floor(n0(h.disabledYears)); });
    const personal = children * R.child + minorYears * R.minorPerYear + seniors * R.senior + disabledYears * R.disabledPerYear;
    // 배우자 단독상속(다른 상속인이 아예 없을 때)이면 일괄공제 불가(상증법 21조②, 기본통칙 21-0-1: 포기·협의분할로 혼자 받은 경우는 제외)
    const spouseOnly = !!spouse && hs.filter(isLegalHeir).length === 1;
    const basicPersonal = R.basic + personal;
    const lumpOrPersonal = spouseOnly ? basicPersonal : Math.max(basicPersonal, R.lumpSum);

    let spouseDed = 0, spouseLimit = 0, spouseActual = 0;
    if (spouse) {
      const share = legal[spouse.id] || 0;
      const base = Math.max(0, totalProperty + giftsToHeirs - skipAmount - debts);
      spouseLimit = Math.min(Math.max(0, Math.floor(base * share) - giftToSpouseBase), R.spouseMax);
      spouseActual = Math.floor(opt.spouseActual !== undefined ? opt.spouseActual : Math.max(0, byHeir[spouse.id] - debtShare(spouse.id)));
      spouseDed = Math.max(R.spouseMin, Math.min(spouseActual, spouseLimit));
    }

    // 동거주택: 10년 이상 함께 산 무주택 자녀가 받은 지분만
    // 돌아가신 분이 집을 2채 이상 가졌으면(1세대1주택 아님) 공제하지 않는다
    let cohabit = 0;
    if (assets.filter(isHouse).length === 1) assets.filter(function (a) { return isHouse(a) && a.lived; }).forEach(function (a) {
      const s = sharesOf(e, a, legal);
      const q = hs.filter(function (h) { return (h.rel === 'child' || (h.rel === 'grandchild' && h.substitute)) && !n0(h.houses) && n0(h.livedYears) >= 10; });
      const qs = sum(q, function (h) { return s[h.id] || 0; });
      cohabit += Math.max(0, assetValue(a) - n0(a.secured)) * qs;
    });
    cohabit = Math.min(Math.floor(cohabit), R.cohabitMax);

    const finAssets = sum(assets.filter(isFin), assetValue);
    const finNet = Math.max(0, finAssets - n0(d.loan));
    const finDed = finDeduction(finNet);

    const requested = lumpOrPersonal + spouseDed + cohabit + finDed;
    const limit = deductionLimit(taxable, skipAmount, priorGiftTaxBase);
    const applied = Math.min(requested, limit);
    const appraisalFee = Math.min(n0((e.misc || {}).appraisalFee), R.appraisalMax);

    let taxBase = Math.max(0, taxable - applied - appraisalFee);
    if (taxBase < R.minTax) taxBase = 0;
    const calculatedTax = inheritTax(taxBase);
    const surcharge = Math.floor(calculatedTax * skipRatio * (skipBig ? R.surchargeMinorBig : R.surcharge));
    const withSurcharge = calculatedTax + surcharge;
    const giftCreditLimit = (taxBase > 0 && priorGiftTaxBase > 0) ? Math.floor(withSurcharge * Math.min(1, priorGiftTaxBase / taxBase)) : 0;
    const giftCredit = Math.min(giftTaxPaid, giftCreditLimit, withSurcharge);
    const reportCredit = Math.floor((withSurcharge - giftCredit) * R.reportCredit);
    const payable = Math.max(0, withSurcharge - giftCredit - reportCredit);

    // 상속인별 상속세 부담(연대납부 의무가 있지만 보통 받은 비율로 나눔)
    const net = {}; let netSum = 0;
    hs.forEach(function (h) { net[h.id] = Math.max(0, byHeir[h.id] - debtShare(h.id)); netSum += net[h.id]; });
    const taxShare = {}; hs.forEach(function (h) { taxShare[h.id] = netSum > 0 ? Math.round(payable * net[h.id] / netSum) : 0; });

    return {
      totalProperty: totalProperty, debts: debts, funeral: funeral, priorGifts: priorGifts, giftsToHeirs: giftsToHeirs,
      priorGiftTaxBase: priorGiftTaxBase, giftBaseGuessed: giftBaseGuessed, taxable: taxable,
      skipAmount: skipAmount, skipRatio: skipRatio, skipBig: skipBig,
      ded: { lumpOrPersonal: lumpOrPersonal, personal: personal, spouseOnly: spouseOnly, children: children, minorYears: minorYears, seniors: seniors, disabledYears: disabledYears,
        spouse: spouseDed, spouseLimit: spouseLimit, spouseActual: spouseActual, giftToSpouseBase: giftToSpouseBase, cohabit: cohabit, fin: finDed, finNet: finNet, requested: requested, limit: limit, applied: applied },
      funeralGeneral: n0(f.cost), funeralGrave: n0(f.grave), debtParts: { loan: n0(d.loan), deposit: n0(d.deposit), tax: n0(d.tax), other: n0(d.other) },
      appraisalFee: appraisalFee, taxBase: taxBase, rate: inheritRateOf(taxBase), calculatedTax: calculatedTax, surcharge: surcharge,
      giftCredit: giftCredit, giftCreditLimit: giftCreditLimit, giftTaxPaid: giftTaxPaid, reportCredit: reportCredit, payable: payable,
      byHeir: byHeir, net: net, taxShare: taxShare, legal: legal
    };
  }

  /* ---------- 취득세 (지방세법 11조·15조) ---------- */
  // 주택·건물·땅 2.8%(농지 2.3%) + 지방교육세 0.16%(농지 0.06%) + 농특세 0.2%(85㎡ 이하 주택 비과세)
  // 무주택 상속인이 상속으로 1주택이 되면 특례 0.8% + 교육세 0.16%, 농특세 없음
  function acqRates(a, special) {
    if (TYPES[a.type] && TYPES[a.type].farm) return { acq: 230, agr: 20, edu: 6 };          // 1/10000 단위
    if (isHouse(a) && special) return { acq: 80, agr: 0, edu: 16 };
    if (isHouse(a)) return { acq: 280, agr: a.small === false ? 20 : 0, edu: 16 };
    return { acq: 280, agr: 20, edu: 16 };
  }
  // 상속 취득세의 과세표준은 시가가 아니라 시가표준액(주택 공시가격·개별공시지가 등, 지방세법 10조의2②1호).
  // 공시가를 모르면 시가의 69%(2026 공동주택 현실화율 근사)로 추정하고 guessed 로 표시한다.
  const GONGSI_RATIO = 0.69;
  function standardPrice(a) { return n0(a.gongsi) || Math.round(n0(a.value) * GONGSI_RATIO); }
  function calcAcquisition(e, legal) {
    legal = legal || legalShares(e);
    const out = {};
    const hs = heirsOf(e);
    hs.forEach(function (h) {
      const mine = (e.assets || []).filter(function (a) { return isReal(a) && assetValue(a) > 0 && (sharesOf(e, a, legal)[h.id] || 0) > 0; });
      const myHouses = mine.filter(isHouse);
      // 특례는 무주택 상속인이 상속주택 1채만 받을 때 (여러 채면 가장 비싼 1채만)
      const pri = (!n0(h.houses) && myHouses.length) ? myHouses.slice().sort(function (x, y) { return assetValue(y) - assetValue(x); })[0] : null;
      const rows = mine.map(function (a) {
        const share = sharesOf(e, a, legal)[h.id];
        const v = standardPrice(a) * share;
        const special = !!pri && pri === a;
        const r = acqRates(a, special);
        const t = function (bp) { return Math.floor(v * bp / 10000); };
        return { asset: a.id, name: a.name || TYPES[a.type].label, share: share, value: v, guessed: !n0(a.gongsi), special: special, acq: t(r.acq), agr: t(r.agr), edu: t(r.edu), total: t(r.acq) + t(r.agr) + t(r.edu), rate: (r.acq + r.agr + r.edu) / 100 };
      });
      out[h.id] = { rows: rows, total: sum(rows, function (r) { return r.total; }), specialUsed: !!pri };
    });
    return out;
  }

  /* ---------- 재산세 (주택, 지방세법 110조~112조) ---------- */
  function propTaxHouse(gongsi, oneHouse) {
    gongsi = n0(gongsi);
    if (!gongsi) return { property: 0, dosi: 0, edu: 0, total: 0, base: 0 };
    let ratio = 0.6;
    if (oneHouse) ratio = gongsi <= 3e8 ? 0.43 : (gongsi <= 6e8 ? 0.44 : 0.45);
    const base = gongsi * ratio;
    let tax;
    if (oneHouse && gongsi <= 9e8) {
      if (base <= 6e7) tax = base * 0.0005;
      else if (base <= 1.5e8) tax = 3e4 + (base - 6e7) * 0.001;
      else if (base <= 3e8) tax = 1.2e5 + (base - 1.5e8) * 0.002;
      else tax = 4.2e5 + (base - 3e8) * 0.0035;
    } else {
      if (base <= 6e7) tax = base * 0.001;
      else if (base <= 1.5e8) tax = 6e4 + (base - 6e7) * 0.0015;
      else if (base <= 3e8) tax = 1.95e5 + (base - 1.5e8) * 0.0025;
      else tax = 5.7e5 + (base - 3e8) * 0.004;
    }
    const p = Math.floor(tax), dd = Math.floor(base * 0.0014), ed = Math.floor(tax * 0.2);
    return { property: p, dosi: dd, edu: ed, total: p + dd + ed, base: base, ratio: ratio };
  }
  function propStdTax(base) {
    base = n0(base);
    if (base <= 6e7) return base * .001;
    if (base <= 1.5e8) return 6e4 + (base - 6e7) * .0015;
    if (base <= 3e8) return 1.95e5 + (base - 1.5e8) * .0025;
    return 5.7e5 + (base - 3e8) * .004;
  }
  // 종부세에서 빼 줄 재산세 (종부세령 4조의3)
  function aggrPropCredit(propTaxSum, ctBase, houses) {
    houses = houses.filter(function (h) { return h.gongsi > 0; });
    const g = sum(houses, function (h) { return h.gongsi; }), b = sum(houses, function (h) { return h.base; });
    const den = propStdTax(b);
    if (!(ctBase > 0) || !(g > 0) || !(den > 0)) return 0;
    return Math.max(0, Math.min(propTaxSum, propTaxSum * (ctBase * (b / g) * .004) / den));
  }
  function comprehensiveRate(taxBase, heavy) {
    const t = taxBase;
    if (!heavy) {
      if (t <= 3e8) return t * .005; if (t <= 6e8) return t * .007 - 6e5; if (t <= 1.2e9) return t * .01 - 2.4e6;
      if (t <= 2.5e9) return t * .013 - 6e6; if (t <= 5e9) return t * .015 - 1.1e7; if (t <= 9.4e9) return t * .02 - 3.6e7; return t * .027 - 1.018e8;
    }
    if (t <= 3e8) return t * .005; if (t <= 6e8) return t * .007 - 6e5; if (t <= 1.2e9) return t * .01 - 2.4e6;
    if (t <= 2.5e9) return t * .02 - 1.44e7; if (t <= 5e9) return t * .03 - 3.94e7; if (t <= 9.4e9) return t * .04 - 8.94e7; return t * .05 - 1.834e8;
  }
  // houses: [{gongsi(내 지분 공시가), whole(주택 전체 공시가), share, base, propTax}]
  function comprehensive(houses, isOne, countForRate) {
    const g = sum(houses, function (h) { return h.gongsi; });
    if (!g) return { taxBase: 0, tax: 0, credit: 0, payable: 0, rural: 0, total: 0 };
    const ded = isOne ? 1.2e9 : 9e8;
    const taxBase = Math.max(0, (g - ded) * 0.6);
    const tax = comprehensiveRate(taxBase, countForRate >= 3);
    const propSum = sum(houses, function (h) { return h.propTax; });
    const credit = Math.min(tax, aggrPropCredit(propSum, taxBase, houses));
    const payable = floor10(Math.max(0, tax - credit));
    const rural = floor10(payable * 0.2);
    return { taxBase: taxBase, tax: tax, credit: credit, payable: payable, rural: rural, total: payable + rural };
  }

  /* ---------- 보유 기간 계획 ---------- */
  // sellPlan: soon(1년 안) · y3 · y5 · y10 · keep(계속 보유, 계산은 10년)
  const PLAN_YEARS = { soon: 1, y3: 3, y5: 5, y10: 10, keep: 10 };
  const HORIZON = 10;
  function holdYears(a) { return PLAN_YEARS[a.sellPlan] || HORIZON; }
  function sells(a) { return !!a.sellPlan && a.sellPlan !== 'keep'; }

  /* ---------- 상속인별 재산세·종부세 (10년) ---------- */
  // 규칙 요약
  //  - 재산세: 상속주택은 5년간 주택 수에서 빠진다(지방세령 110조의2). 공유 주택은 주택 전체 세액 × 지분.
  //    6년째부터는 기존 1주택의 1세대1주택 특례가 없어질 수 있다(공시가 합계를 넣은 경우만 계산).
  //  - 종부세: 상속주택은 5년간, 또는 지분 40% 이하, 또는 지분 공시가 6억(수도권 밖 3억) 이하이면
  //    1세대1주택 판정·중과 판정 주택 수에서 빠진다(종부세령 4조의2·4조의3). 공시가는 합산.
  function calcHolding(e, legal) {
    legal = legal || legalShares(e);
    const out = {};
    heirsOf(e).forEach(function (h) {
      const own = Math.floor(n0(h.houses)), ownG = n0(h.ownGongsi);
      const inh = (e.assets || []).filter(function (a) { return isHouse(a) && n0(a.gongsi || a.value) > 0 && (sharesOf(e, a, legal)[h.id] || 0) > 0; }).map(function (a) {
        const share = sharesOf(e, a, legal)[h.id];
        const whole = standardPrice(a);                                  // 공시가가 없으면 시가의 69%로 추정
        return { a: a, share: share, whole: whole, gongsi: whole * share, guessed: !n0(a.gongsi), hold: holdYears(a), smallShare: share <= 0.4 || whole * share <= (a.metro === false ? 3e8 : 6e8) };
      }).sort(function (x, y) { return y.gongsi - x.gongsi; });
      // 상속 전 종부세 (기존 주택만, 공시가 합계를 넣었을 때)
      const ownOnly = function (one) { if (!ownG) return { total: 0 }; const pt = propTaxHouse(ownG, one); return comprehensive([{ gongsi: ownG, base: pt.base, propTax: pt.property }], one, own); };
      const before = own ? ownOnly(own === 1) : { total: 0 };
      const years = [];
      for (let y = 1; y <= HORIZON; y++) {
        const held = inh.filter(function (x) { return x.hold >= y; });
        if (!held.length) { years.push({ y: y, prop: 0, ownPropUp: 0, comp: 0, compDelta: 0, held: 0 }); continue; }
        const counted = held.filter(function (x) { return !(y <= 5 || x.smallShare); });
        let cnt = own + counted.length; if (cnt === 0) cnt = 1;          // 상속주택만 있으면 그 집이 1주택
        const isOne = cnt === 1;
        // 재산세 (5년간 주택 수 제외 → 상속 전 무주택이면 가장 비싼 상속주택이 1세대1주택)
        const propRows = held.map(function (x, i) {
          const oneP = own === 0 && i === 0 && (held.length === 1 || y <= 5);
          const t = propTaxHouse(x.whole, oneP);
          return { x: x, t: t, mine: Math.floor(t.total * x.share), mineProp: Math.floor(t.property * x.share), base: t.base * x.share };
        });
        const prop = sum(propRows, function (r) { return r.mine; });
        let ownPropUp = 0;
        if (own === 1 && ownG && y > 5) ownPropUp = propTaxHouse(ownG, false).total - propTaxHouse(ownG, true).total;
        // 종부세
        const hs2 = propRows.map(function (r) { return { gongsi: r.x.gongsi, base: r.base, propTax: r.mineProp }; });
        if (ownG) { const pt = propTaxHouse(ownG, own === 1 && isOne); hs2.push({ gongsi: ownG, base: pt.base, propTax: pt.property }); }
        const c = comprehensive(hs2, isOne, cnt);
        years.push({ y: y, prop: prop, ownPropUp: ownPropUp, comp: c.total, compDelta: Math.max(0, c.total - before.total), held: held.length, isOne: isOne, cnt: cnt });
      }
      const y1 = years[0], y6 = years[5];
      out[h.id] = {
        own: own, ownG: ownG, houses: inh.length, guessed: inh.some(function (x) { return x.guessed; }),
        before: before.total, years: years,
        perYear15: y1 ? y1.prop + y1.compDelta + y1.ownPropUp : 0,
        perYear6: y6 ? y6.prop + y6.compDelta + y6.ownPropUp : 0,
        total: sum(years, function (r) { return r.prop + r.compDelta + r.ownPropUp; }),
        smallShare: inh.length ? inh.every(function (x) { return x.smallShare; }) : true
      };
    });
    return out;
  }

  /* ---------- 양도세 (팔 계획이 있는 부동산) ---------- */
  function transferRateTax(base) {
    if (base <= 1.4e7) return base * .06; if (base <= 5e7) return base * .15 - 1.26e6; if (base <= 8.8e7) return base * .24 - 5.76e6;
    if (base <= 1.5e8) return base * .35 - 1.544e7; if (base <= 3e8) return base * .38 - 1.994e7; if (base <= 5e8) return base * .40 - 2.594e7;
    if (base <= 1e9) return base * .42 - 3.594e7; return base * .45 - 6.594e7;
  }
  function calcTransfer(e, legal) {
    legal = legal || legalShares(e);
    const out = {};
    heirsOf(e).forEach(function (h) {
      const own = Math.floor(n0(h.houses));
      const mine = (e.assets || []).filter(function (a) { return isReal(a) && sells(a) && (sharesOf(e, a, legal)[h.id] || 0) > 0; });
      const myHouses = mine.filter(isHouse);
      const rows = mine.map(function (a) {
        const share = sharesOf(e, a, legal)[h.id];
        const price = n0(a.sellPrice) || n0(a.value) || n0(a.gongsi);
        const cost = assetValue(a);                    // 상속받을 때 평가한 금액이 취득가액
        const years = holdYears(a);
        const gainAll = Math.max(0, price - cost);
        // 상속 전 무주택이고 상속주택이 이것 하나면, 2년 이상 보유 후 1세대1주택 비과세(12억 초과분만 과세)
        const oneHouse = isHouse(a) && own === 0 && myHouses.length === 1 && years >= 2;
        let taxableAll = gainAll;
        if (oneHouse) taxableAll = price > 1.2e9 ? Math.floor(gainAll * (price - 1.2e9) / price) : 0;
        const gain = Math.floor(taxableAll * share);
        const ltRate = years >= 3 ? Math.min(0.3, 0.02 * years) : 0;   // 보유기간은 상속일부터
        const lt = Math.floor(gain * ltRate);
        const base = Math.max(0, gain - lt - 2.5e6);
        const tax = floor10(transferRateTax(base));
        const local = floor10(tax * 0.1);
        return { asset: a.id, name: a.name || TYPES[a.type].label, share: share, price: price, cost: cost, years: years, gain: Math.floor(gainAll * share), oneHouse: oneHouse, ltRate: ltRate, base: base, tax: tax, local: local, total: tax + local, basis: valueBasis(a) };
      });
      out[h.id] = { rows: rows, total: sum(rows, function (r) { return r.total; }) };
    });
    return out;
  }

  /* ---------- 신고·납부 날짜 ---------- */
  function endOfMonthPlus(dateStr, months) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || ''); if (!m) return '';
    const y = Number(m[1]), mo = Number(m[2]) - 1 + months;
    const d = new Date(Date.UTC(y, mo + 1, 0));         // 그 달 말일
    return d.toISOString().slice(0, 10);
  }
  function dates(e) {
    const d = (e.deceased || {}).date;
    if (!d) return null;
    const report = endOfMonthPlus(d, 6);                      // 상속개시일이 속한 달의 말일부터 6개월
    const split = (function () { if (!report) return ''; const m = /^(\d{4})-(\d{2})/.exec(report); return endOfMonthPlus(m[1] + '-' + m[2] + '-01', 9); })();  // 신고기한 다음 날부터 9개월
    const y = Number(d.slice(0, 4));
    const fiveYears = (y + 5) + d.slice(4);
    return { death: d, report: report, acquisition: report, spouseSplit: split, fiveYears: fiveYears };
  }

  /* ---------- 전체 ---------- */
  function calcAll(e, opt) {
    const legal = legalShares(e);
    const inh = calcInheritance(e, opt);
    const acq = calcAcquisition(e, legal);
    const hold = calcHolding(e, legal);
    const tr = calcTransfer(e, legal);
    const heirs = heirsOf(e).map(function (h) {
      return { id: h.id, name: h.name, rel: h.rel, received: inh.byHeir[h.id] || 0, net: inh.net[h.id] || 0, inheritTax: inh.taxShare[h.id] || 0,
        acquisition: acq[h.id].total, perYear15: hold[h.id].perYear15, perYear6: hold[h.id].perYear6, holding: hold[h.id].total, transfer: tr[h.id].total };
    });
    const acqTotal = sum(heirs, function (h) { return h.acquisition; });
    const holdTotal = sum(heirs, function (h) { return h.holding; });
    const trTotal = sum(heirs, function (h) { return h.transfer; });
    return {
      inheritance: inh, acquisition: acq, holding: hold, transfer: tr, heirs: heirs, dates: dates(e),
      now: inh.payable + acqTotal,                         // 6개월 안에 내는 세금
      total: inh.payable + acqTotal + holdTotal + trTotal,  // 10년(또는 팔 때까지) 합계
      parts: { inheritance: inh.payable, acquisition: acqTotal, holding: holdTotal, transfer: trTotal }
    };
  }

  root.EC = {
    R: R, TYPES: TYPES, isHouse: isHouse, isReal: isReal, isFin: isFin,
    inheritTax: inheritTax, funeralAllowed: funeralAllowed, finDeduction: finDeduction,
    legalShares: legalShares, sharesOf: sharesOf, assetValue: assetValue, valueBasis: valueBasis,
    calcInheritance: calcInheritance, calcAcquisition: calcAcquisition, calcHolding: calcHolding, calcTransfer: calcTransfer,
    propTaxHouse: propTaxHouse, standardPrice: standardPrice, GONGSI_RATIO: GONGSI_RATIO, comprehensive: comprehensive, transferRateTax: transferRateTax,
    dates: dates, calcAll: calcAll, PLAN_YEARS: PLAN_YEARS, HORIZON: HORIZON, holdYears: holdYears, sells: sells
  };
  if (typeof module === 'object' && module.exports) module.exports = root.EC;
})(typeof window !== 'undefined' ? window : globalThis);
