/* ============================================================
   세무사 검토표 엔진 (review-engine.js)
   상속 파일(E) → 검토표 모델(RV.build) → 항목 목록(RV.sections) → 고객 답변서 초안(RV.answerDraft)
   화면과 무관한 순수 함수. result.html 이 보여 주는 모든 계산 내역을 세무사용으로 다시 모은다.
   ============================================================ */
(function (root) {
  'use strict';
  const EC = root.EC || require('./estate-calc.js');
  const EST = root.EST || require('./estate.js');
  const FIL = root.FIL || require('./filing.js');
  const SAVINGS = root.SAVINGS || require('./savings.js');
  const TEACH = root.TEACH || (function () { try { return require('./teach.js'); } catch (e) { return null; } })();
  const RV = {};
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const n0 = function (v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; };
  const kor = SAVINGS.kor;
  const won = function (n) { return (Math.round(Number(n) || 0)).toLocaleString('ko-KR') + '원'; };
  const dash = function (n) { return n ? kor(n) : '—'; };
  const pct = function (x) { return Math.round(x * 1000) / 10 + '%'; };
  const fmtDate = function (s) { if (!s) return ''; const p = s.split('-'); return p[0] + '년 ' + Number(p[1]) + '월 ' + Number(p[2]) + '일'; };
  const PLAN = { keep: '계속 보유', soon: '1년 안에 매도', y3: '3년쯤 뒤 매도', y5: '5년쯤 뒤 매도', y10: '10년쯤 뒤 매도' };
  const BASIS = { appraisal: '감정가', market: '시세(매매사례)', gongsi: '공시가격', value: '입력 금액', none: '없음' };
  RV.kor = kor; RV.won = won; RV.esc = esc;

  function heirName(e, id) {
    const h = e.heirs.find(function (x) { return x.id === id; }); if (!h) return '';
    const f = e.filing && e.filing.heirs && e.filing.heirs[id];
    if (f && f.name) return f.name;
    const i = e.heirs.filter(function (x) { return x.rel === h.rel; }).indexOf(h) + 1;
    return EST.heirLabel(h, i);
  }
  RV.heirName = heirName;

  /* ---------- 청약(주택 공급) 무주택 판정 ---------- */
  // 주택공급에 관한 규칙 §53 기준의 보수적 판정. 상속으로 받은 주택(지분 포함)은 원칙적으로 주택 소유로 본다.
  // 예외: ① 소형·저가주택(전용 60㎡ 이하, 공시가 수도권 1.6억·그 밖 1억 이하) 1호는 민영 일반공급에서 무주택 간주
  //       ② 상속 공유지분은 부적격 통보 후 3개월 안에 처분하면 무주택 인정(사후 구제)
  RV.housing = function (e) {
    const legal = EC.legalShares(e);
    const houses = (e.assets || []).filter(function (a) { return EC.isHouse(a) && EC.assetValue(a) > 0; });
    return e.heirs.map(function (h) {
      const own = n0(h.houses);
      const got = houses.map(function (a) { const s = EC.sharesOf(e, a, legal)[h.id] || 0; return { a: a, share: s }; }).filter(function (x) { return x.share > 0; });
      const smallCheap = got.length === 1 && own === 0 && got[0].a.small !== false && EC.standardPrice(got[0].a) * got[0].share <= (got[0].a.metro === false ? 1e8 : 1.6e8);
      let status, text;
      if (own === 0 && !got.length) { status = 'none'; text = '상속으로 받는 주택이 없어 무주택이 유지됩니다. 청약 무주택 기간도 그대로 이어집니다.'; }
      else if (own === 0 && smallCheap) { status = 'small'; text = '받는 주택이 1호이고 소형·저가주택(전용 60㎡ 이하, 공시가 지분 ' + kor(EC.standardPrice(got[0].a) * got[0].share) + ') 요건에 해당할 수 있어 민영주택 일반공급에서는 무주택으로 볼 여지가 있습니다. 전용면적·공시가격을 서류로 확인하세요(공공분양·특별공급은 다름).'; }
      else if (own === 0 && got.length === 1 && got[0].share < 1) { status = 'share'; text = '상속으로 주택 지분 ' + pct(got[0].share) + '을 받습니다. 청약에서는 지분도 주택 소유로 보므로 무주택 자격을 잃습니다. 다만 청약 후 부적격 통보를 받은 날부터 3개월 안에 지분을 처분하면 무주택으로 인정받을 수 있고, 처음부터 다른 상속인이 받도록 나누면 무주택이 유지됩니다.'; }
      else if (own === 0) { status = 'one'; text = '상속으로 주택 ' + got.length + '채를 받아 유주택자가 됩니다. 청약 무주택 요건을 잃습니다(생애최초·신혼 등 특별공급도 대부분 무주택 기준). 청약이 중요하면 다른 상속인이 받도록 나누는 것을 검토하세요.'; }
      else { status = 'multi'; text = '이미 주택 ' + own + '채가 있고 상속으로 ' + (got.length ? got.length + '채(지분 포함)를 더 받아' : '받는 주택은 없어') + ' 청약 무주택 요건과는 관계가 없습니다.' + (got.length ? ' 다주택이 되어 재산세·종부세·양도세 중과 쪽을 봐야 합니다.' : ''); }
      return { id: h.id, name: heirName(e, h.id), own: own, got: got.map(function (x) { return { name: x.a.name || EC.TYPES[x.a.type].label, share: x.share }; }), status: status, text: text };
    });
  };

  /* ---------- 검토표 모델 ---------- */
  RV.build = function (e, meta) {
    meta = meta || {};
    const all = EC.calcAll(e), inh = all.inheritance, d = inh.ded, p = all.parts;
    const sv = SAVINGS.evaluate(e, all);
    const legal = EC.legalShares(e);
    const f = FIL.get(e);
    const name = function (id) { return heirName(e, id); };
    const REL = EST.REL;

    // 1. 입력 요약
    const family = e.heirs.map(function (h, i) {
      return { id: h.id, name: name(h.id), rel: REL[h.rel] + (h.rel === 'grandchild' && h.substitute ? '(대습)' : ''), age: h.age, houses: h.houses, ownGongsi: h.ownGongsi, livedYears: h.livedYears, disabledYears: h.disabledYears, legal: legal[h.id] || 0 };
    });
    const assets = (e.assets || []).filter(function (a) { return EC.assetValue(a) > 0 || n0(a.value) || n0(a.gongsi); }).map(function (a) {
      const s = EC.sharesOf(e, a, legal);
      const items = FIL.FIN_TYPES.indexOf(a.type) >= 0 ? f.fin[a.type] : [];
      return { id: a.id, name: a.name || EC.TYPES[a.type].label, type: EC.TYPES[a.type].label, value: EC.assetValue(a), input: n0(a.value), gongsi: n0(a.gongsi), basis: BASIS[EC.valueBasis(a)] || '', lived: !!a.lived, secured: n0(a.secured), small: a.small !== false, metro: a.metro !== false,
        sellPlan: PLAN[a.sellPlan] || '', sellPrice: n0(a.sellPrice), premiumByOther: !!a.premiumByOther,
        split: e.heirs.map(function (h) { return { name: name(h.id), share: s[h.id] || 0 }; }).filter(function (x) { return x.share > 0; }),
        custom: !!(a.split && a.split.length), items: items.map(function (it) { return { label: it.name || it.company || FIL.BANK_NAME(it.bankCode) || it.desc || '', value: FIL.finItemValue(a.type, it), qty: it.qty, unitPrice: it.unitPrice, listed: it.listed }; }),
        addr: FIL.addrText(f.assets[a.id]), area: (f.assets[a.id] || {}).area, sharePct: (f.assets[a.id] || {}).sharePct };
    });
    const dbt = e.debts || {}, fu = e.funeral || {};
    const gifts = (e.gifts || []).map(function (g) { return { to: g.to === 'other' || !g.to ? '가족 외' : name(g.to), year: g.year, value: n0(g.value), taxBase: n0(g.taxBase), taxPaid: n0(g.taxPaid) }; });
    const priors = (e.priors || []).map(function (q) { return { who: q.who, date: q.date, prevTax: n0(q.prevTax), prevEstate: n0(q.prevEstate), reinherit: n0(q.reinherit), years: EC.shortYears(q.date, e.deceased.date) }; });

    // 2. 세금 — 상속인별 표
    const heirRows = all.heirs.map(function (h) {
      const hd = all.holding[h.id]; const held = hd.years.filter(function (y) { return y.held > 0; }).length;
      let yearly = hd.houses ? kor(hd.years[0].prop + hd.years[0].compDelta + hd.years[0].ownPropUp) + (held < 6 ? ' (' + held + '년 뒤 매도까지)' : (h.perYear6 !== h.perYear15 ? ' → 6년째부터 ' + kor(h.perYear6) : '')) : '—';
      return { name: name(h.id), received: h.received, net: h.net, inheritTax: h.inheritTax, acquisition: h.acquisition, yearly: yearly, holding: h.holding, transfer: h.transfer };
    });
    // 상속세 내역 (result.html 「상속세 계산 내역」과 같은 줄)
    const inhKv = [];
    const kv = function (k, v, sub) { inhKv.push({ k: k, v: v, sub: sub || '' }); };
    kv('물려받는 재산', won(inh.totalProperty));
    kv('− 빚·공과금', won(inh.debts), '대출 ' + kor(inh.debtParts.loan) + ' · 보증금 ' + kor(inh.debtParts.deposit) + ' · 세금 ' + kor(inh.debtParts.tax) + ' · 기타 ' + kor(inh.debtParts.other));
    kv('− 장례비(인정액)', won(inh.funeral), '입력 ' + kor(inh.funeralGeneral) + (inh.funeralGrave ? ' + 봉안 ' + kor(inh.funeralGrave) : '') + ' · 500만~1,000만 + 봉안 500만');
    kv('+ 미리 준 재산', won(inh.priorGifts), inh.giftBaseGuessed ? '과세표준은 증여공제를 빼서 추정' : '');
    kv('= 과세가액', won(inh.taxable));
    kv('− 기본·가족 공제', won(d.lumpOrPersonal), d.spouseOnly ? '배우자 단독: 일괄공제 불가' : (d.lumpOrPersonal === EC.R.lumpSum ? '일괄공제 5억' : '기초 2억 + 가족 공제 ' + kor(d.personal)) + ' · 자녀 ' + d.children + '명 · 미성년 ' + d.minorYears + '년 · 65세 이상 ' + d.seniors + '명 · 장애인 ' + d.disabledYears + '년');
    if (e.heirs.some(function (h) { return h.rel === 'spouse'; })) kv('− 배우자 공제', won(d.spouse), '실제 받는 ' + kor(d.spouseActual) + ' · 한도 ' + kor(d.spouseLimit) + (d.giftToSpouseBase ? ' · 배우자 사전증여 과세표준 ' + kor(d.giftToSpouseBase) : ''));
    if (d.cohabit) kv('− 동거주택 공제', won(d.cohabit));
    if (d.fin) kv('− 금융재산 공제', won(d.fin), '순금융재산 ' + kor(d.finNet));
    if (d.applied < d.requested) kv('공제 종합한도 적용', won(d.applied), '공제 합계 ' + kor(d.requested) + ' → 한도 ' + kor(d.limit));
    if (inh.appraisalFee) kv('− 감정평가 수수료', won(inh.appraisalFee));
    kv('= 과세표준', won(inh.taxBase));
    kv('× 세율', inh.taxBase ? (inh.rate.rate * 100) + '% − 누진공제 ' + kor(inh.rate.ded) : '—');
    kv('= 산출세액', won(inh.calculatedTax));
    if (inh.surcharge) kv('+ 세대생략 할증', won(inh.surcharge), inh.skipBig ? '미성년 손자녀 20억 초과분 40%' : '30%');
    if (inh.giftCredit) kv('− 증여세액공제', won(inh.giftCredit), inh.giftCreditLimit && inh.giftCredit >= inh.giftCreditLimit ? '한도 적용' : '');
    if (inh.shortTermCredit) kv('− 단기재상속 세액공제', won(inh.shortTermCredit), inh.shortRows.map(function (r) { return r.years + '년 이내 ' + Math.round(r.rate * 100) + '%'; }).join(', ') + (inh.shortRaw > inh.shortTermCredit ? ' · 한도 적용' : ''));
    kv('− 신고세액공제 3%', won(inh.reportCredit));
    kv('= 낼 상속세', won(inh.payable));
    // 취득세
    const acqRows = [];
    all.heirs.forEach(function (h) { all.acquisition[h.id].rows.forEach(function (r) { acqRows.push({ heir: name(h.id), name: r.name, share: r.share, value: r.value, guessed: r.guessed, special: r.special, rate: r.rate, total: r.total }); }); });
    // 재산세·종부세
    const holdRows = all.heirs.filter(function (h) { return all.holding[h.id].houses; }).map(function (h) {
      const hd = all.holding[h.id];
      return { heir: name(h.id), own: hd.own, ownG: hd.ownG, guessed: hd.guessed, total: hd.total, years: hd.years.map(function (y) { return { y: y.y, prop: y.prop, comp: y.compDelta, ownUp: y.ownPropUp, total: y.prop + y.compDelta + y.ownPropUp, isOne: y.isOne, cnt: y.cnt }; }) };
    });
    // 양도세
    const trRows = [];
    all.heirs.forEach(function (h) { all.transfer[h.id].rows.forEach(function (r) { trRows.push({ heir: name(h.id), name: r.name, share: r.share, price: r.price, cost: r.cost, years: r.years, gain: r.gain, oneHouse: r.oneHouse, heavyRisk: r.heavyRisk, basis: BASIS[r.basis] || '', ltRate: r.ltRate, total: r.total }); });
    });
    // 청약
    const housing = RV.housing(e);
    // 날짜
    const dt = all.dates; const dates = [];
    if (dt) {
      dates.push({ date: dt.report, what: '상속세 신고·납부', note: '홈택스 또는 피상속인 주소지 세무서. 기한 안에 신고하면 3% 공제.' });
      if (p.acquisition) dates.push({ date: dt.acquisition, what: '취득세 신고·납부', note: '부동산 소재지 시·군·구청(위택스). 상속 등기와 함께.' });
      if (e.heirs.some(function (h) { return h.rel === 'spouse'; })) dates.push({ date: dt.spouseSplit, what: '배우자 몫 등기·명의이전 마감', note: '이 날까지 끝내야 배우자 공제가 인정됩니다.' });
      if (e.assets.some(EC.isHouse)) {
        const y = Number(dt.death.slice(0, 4)) + (dt.death.slice(5) > '06-01' ? 1 : 0);
        dates.push({ date: y + '-07-16', what: '재산세 (7월·9월)', note: y + '년 6월 1일 소유자에게 부과.' });
        dates.push({ date: y + '-12-01', what: '종부세 (12월 1~15일)', note: '공시가격 합계가 기준을 넘는 경우만.' });
        dates.push({ date: dt.fiveYears, what: '상속주택 5년 특례 끝', note: '이 날이 지나면 상속주택이 재산세·종부세 주택 수에 들어갈 수 있습니다.' });
      }
      e.assets.filter(function (a) { return EC.isReal(a) && EC.sells(a); }).forEach(function (a) { const y = Number(dt.death.slice(0, 4)) + EC.holdYears(a); dates.push({ date: y + dt.death.slice(4), what: (a.name || EC.TYPES[a.type].label) + ' 매도 예정', note: '매도 전 양도세 재확인.' }); });
      dates.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
    }
    const opened = (e.opened || []).map(function (id) { const t = TEACH && TEACH.find ? TEACH.find(id) : null; return t ? id + ' ' + t.title : id; });
    return {
      no: meta.no || '', customer: Object.assign({ name: '', phone: '', email: '', question: '', product: '' }, meta.customer || {}), builtAt: new Date().toISOString(),
      deceased: { date: e.deceased.date || '', name: f.deceased.name || '', addr: FIL.addrText(f.deceased), filer: f.filer.heirId ? name(f.filer.heirId) : '' },
      family: family, assets: assets, debts: { loan: n0(dbt.loan), deposit: n0(dbt.deposit), tax: n0(dbt.tax), other: n0(dbt.other), rows: f.debts, charges: f.charges }, funeral: { cost: n0(fu.cost), grave: n0(fu.grave), rows: f.funeral }, gifts: gifts, priors: priors, appraisalFee: n0((e.misc || {}).appraisalFee),
      filing: FIL.count(e), filingMissing: FIL.missing(e), missing: EST.missing(e),
      tax: { now: all.now, total: all.total, parts: p, heirRows: heirRows, inhKv: inhKv, acqRows: acqRows, holdRows: holdRows, trRows: trRows, taxable: inh.taxable, taxBase: inh.taxBase, payable: inh.payable, totalProperty: inh.totalProperty },
      housing: housing, savings: { save: sv.save.map(function (x) { return { code: x.code, title: x.title, body: x.body, amount: x.amount, diff: x.diff, action: x.action }; }), check: sv.check.map(function (x) { return { code: x.code, title: x.title, body: x.body }; }), best: sv.best },
      dates: dates, docs: EST.docs(e), opened: opened, overLimit: FIL.overLimit(e, inh),
      assumptions: ['2026년 10월 시행 세법 기준(국회 제출 개정안 미반영)', '빚은 받은 재산 비율로 나눔(실제는 협의)', '대습 손자녀는 한 몫을 나눔', '공시가격을 모르면 시세의 69%로 추정', '주택은 85㎡ 이하로 보아 농특세 제외(입력에서 표시한 경우 제외)', '2차 상속·상속포기·비상장주식·가업·영농 공제 미반영', '재산세·종부세는 고령자·장기보유 공제와 세부담 상한 미반영, 양도세는 다주택 중과·필요경비 미반영']
    };
  };

  /* ---------- 항목 목록 (검토표 편집기) ---------- */
  const T = function (rows, head, cells) {
    return '<div class="table-scroll"><table class="mini"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + cells(r).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  };
  RV.sections = function (m) {
    const S = [];
    const add = function (id, title, html, hint) { S.push({ id: id, title: title, html: html, hint: hint || '' }); };
    add('input', '입력 내용 (가족·재산·빚)',
      '<p><b>상속개시일</b> ' + (m.deceased.date ? fmtDate(m.deceased.date) : '(없음)') + (m.deceased.name ? ' · 피상속인 ' + esc(m.deceased.name) : '') + (m.deceased.addr ? ' · ' + esc(m.deceased.addr) : '') + (m.deceased.filer ? ' · 신고인 ' + esc(m.deceased.filer) : '') + '</p>' +
      T(m.family, ['상속인', '관계', '나이', '법정지분', '현재 주택', '그 집 공시가', '동거 햇수', '장애인 기대여명'], function (h) { return [esc(h.name), h.rel, h.age || '', pct(h.legal), h.houses === undefined || h.houses === '' ? '(미입력)' : h.houses + '채', h.ownGongsi ? kor(h.ownGongsi) : '', h.livedYears ? h.livedYears + '년' : '', h.disabledYears ? h.disabledYears + '년' : '']; }) +
      T(m.assets, ['재산', '종류', '평가액', '평가 기준', '입력 시세', '공시가격', '나누기', '계획·기타'], function (a) { return [esc(a.name) + (a.addr ? '<br><small>' + esc(a.addr) + (a.area ? ' · ' + esc(a.area) + '㎡' : '') + (a.sharePct && Number(a.sharePct) < 100 ? ' · 지분 ' + esc(a.sharePct) + '%' : '') + '</small>' : '') + (a.items.length ? '<br><small>' + a.items.map(function (it) { return esc(it.label) + ' ' + kor(it.value); }).join(' / ') + '</small>' : ''), a.type, kor(a.value), a.basis, a.input ? kor(a.input) : '', a.gongsi ? kor(a.gongsi) : '', a.split.map(function (x) { return esc(x.name) + ' ' + pct(x.share); }).join(', ') + (a.custom ? ' <small>(협의)</small>' : ' <small>(법정)</small>'), [a.lived ? '동거주택' : '', a.secured ? '담보대출 ' + kor(a.secured) : '', a.small ? '' : '85㎡ 초과', a.metro ? '' : '수도권 밖', a.sellPlan ? a.sellPlan + (a.sellPrice ? ' ' + kor(a.sellPrice) : '') : '', a.premiumByOther ? '보험료 타인 납입(제외)' : ''].filter(Boolean).join(' · ')]; }) +
      '<p><b>빚</b> 대출 ' + kor(m.debts.loan) + ' · 보증금 ' + kor(m.debts.deposit) + ' · 세금·공과금 ' + kor(m.debts.tax) + ' · 기타 ' + kor(m.debts.other) + (m.debts.rows.length ? '<br><small>' + m.debts.rows.map(function (r) { return esc(r.kind) + ' ' + esc(r.creditor || '') + ' ' + kor(r.amount) + (r.from ? ' (' + r.from + '~' + (r.to || '') + ')' : ''); }).join(' / ') + '</small>' : '') + '</p>' +
      '<p><b>장례비</b> ' + kor(m.funeral.cost) + (m.funeral.grave ? ' + 봉안 ' + kor(m.funeral.grave) : '') + (m.funeral.rows.length ? '<br><small>' + m.funeral.rows.map(function (r) { return esc(r.payee || '') + ' ' + kor(r.amount); }).join(' / ') + '</small>' : '') + (m.appraisalFee ? ' · 감정평가 수수료 ' + kor(m.appraisalFee) : '') + '</p>' +
      (m.gifts.length ? '<p><b>사전증여</b> ' + m.gifts.map(function (g) { return esc(g.to) + ' ' + (g.year || '') + '년 ' + kor(g.value) + (g.taxPaid ? ' (증여세 ' + kor(g.taxPaid) + ')' : ''); }).join(' / ') + '</p>' : '') +
      (m.priors.length ? '<p><b>단기재상속</b> ' + m.priors.map(function (q) { return esc(q.who || '') + ' ' + (q.date || '') + ' · 그때 산출세액 ' + kor(q.prevTax) + ' · 재산 ' + kor(q.prevEstate) + ' · 다시 상속 ' + kor(q.reinherit) + (q.years ? ' · ' + q.years + '년 이내' : ''); }).join(' / ') + '</p>' : '') +
      (m.missing.length ? '<p class="bad"><b>고객이 비운 칸(계산용)</b> ' + m.missing.map(function (x) { return esc(x.text); }).join(' / ') + '</p>' : '') +
      (m.filing.total ? '<p><b>신고서 채우기</b> 사람 ' + m.filing.people + ' · 부동산 주소 ' + m.filing.realAddr + '/' + m.filing.realTotal + ' · 금융 ' + m.filing.fin + '건 · 채무 ' + m.filing.debts + '건 · 공과금 ' + m.filing.charges + '건 · 장례 ' + m.filing.funeral + '건' + (m.filingMissing.length ? '<br><small class="bad">비운 칸: ' + m.filingMissing.map(function (x) { return esc(x.text); }).join(', ') + '</small>' : '') + '</p>' : '<p class="bad">신고서 채우기(건별 입력)를 하지 않았습니다.</p>'),
      '평가 기준(시세/공시가/감정)과 나누기(법정/협의)가 고객 의도와 맞는지 확인');
    add('inheritance', '상속세 계산 (' + won(m.tax.payable) + ')',
      '<div class="kvs">' + m.tax.inhKv.map(function (x) { return '<div class="kv"><span>' + esc(x.k) + (x.sub ? ' <small>' + esc(x.sub) + '</small>' : '') + '</span><b>' + esc(x.v) + '</b></div>'; }).join('') + '</div>' +
      T(m.tax.heirRows, ['상속인', '받는 재산', '순재산(빚 뺀)', '상속세 몫', '취득세', '집 세금(매년)', '양도세'], function (h) { return [esc(h.name), dash(h.received), dash(h.net), dash(h.inheritTax), dash(h.acquisition), h.yearly, dash(h.transfer)]; }),
      '배우자공제 한도·실제 분할, 동거주택 요건, 금융재산 순액, 세대생략, 증여세액공제, 단기재상속 확인');
    add('acquisition', '취득세 (' + won(m.tax.parts.acquisition) + ')',
      m.tax.acqRows.length ? T(m.tax.acqRows, ['상속인', '재산', '지분', '과세표준(공시가)', '세율', '취득세 등'], function (r) { return [esc(r.heir), esc(r.name) + (r.special ? ' <small>무주택 1가구 특례 0.8%</small>' : ''), pct(r.share), kor(r.value) + (r.guessed ? ' <small>시세×69% 추정</small>' : ''), r.rate.toFixed(2) + '%', kor(r.total)]; }) + '<p><small>상속 취득세는 공시가격 기준, 상속개시일이 속한 달의 말일부터 6개월. 85㎡ 이하 주택 농특세 없음.</small></p>' : '<p>상속받는 부동산이 없습니다.</p>',
      '무주택 특례(주된 상속인 세대 무주택·1채) 적용 여부, 공시가격 실제 조회');
    add('holding', '재산세·종부세 10년 (' + won(m.tax.parts.holding) + ')',
      m.tax.holdRows.length ? m.tax.holdRows.map(function (h) { return '<p><b>' + esc(h.heir) + '</b> <small>원래 집 ' + h.own + '채' + (h.ownG ? ' · 공시가 ' + kor(h.ownG) : h.own ? ' · 공시가 미입력(종부세 계산 못 함)' : '') + (h.guessed ? ' · 상속주택 공시가 추정' : '') + '</small></p>' + T(h.years.filter(function (y) { return y.total > 0 || y.y === 1; }), ['해', '1세대1주택', '주택 수', '재산세(내 몫)', '종부세 늘어남', '원래 집 재산세 늘어남', '합계'], function (y) { return [y.y + '년째', y.isOne ? '예' : '아니오', y.cnt || '', dash(y.prop), dash(y.comp), dash(y.ownUp), dash(y.total)]; }) + '<p><small>10년 합계 ' + kor(h.total) + (h.years.some(function (y) { return y.total === 0 && y.y > 1; }) ? ' · 금액이 없는 해(매도 뒤)는 생략' : '') + '</small></p>'; }).join('') + '<p><small>상속주택은 5년간 1세대1주택 판정에서 제외(종부세는 지분 40% 이하 또는 지분 공시가 6억·수도권 밖 3억 이하면 계속 제외). 고령자·장기보유 세액공제·세부담 상한 미반영.</small></p>' : '<p>상속받는 집이 없습니다.</p>',
      '5년 특례·소수지분 예외, 원래 집 공시가, 세부담 상한');
    add('transfer', '양도세 (' + won(m.tax.parts.transfer) + ')',
      m.tax.trRows.length ? T(m.tax.trRows, ['파는 사람', '재산', '보유', '1세대1주택', '중과 위험', '팔 값(지분)', '취득가(상속 평가액)', '양도차익', '장기보유', '양도세+지방세'], function (r) { return [esc(r.heir), esc(r.name), r.years + '년', r.oneHouse ? '비과세(12억 초과분 과세)' : '아니오', r.heavyRisk ? '<b class="bad">다주택 중과 가능</b>' : '', kor(r.price * r.share), kor(r.cost * r.share) + ' <small>' + esc(r.basis) + '</small>', dash(r.gain), r.ltRate ? Math.round(r.ltRate * 100) + '%' : '', dash(r.total)]; }) + '<p><small>취득가 = 상속 평가액. 보유기간은 상속일부터(세율은 피상속인 기간 합산). 다주택 중과·비사업용 토지·2년 거주 요건·필요경비 미반영.</small></p>' : '<p>매도 계획을 넣은 부동산이 없습니다. 1세대1주택 비과세 여부는 아래 청약·주택 수 판정과 함께 보세요.</p>',
      '1세대1주택 비과세(2년 보유·조정지역 거주), 상속주택 특례(소득세법 시행령 155조②), 중과 여부, 공시가 평가 시 취득가 불리');
    add('housing', '청약 자격·주택 수 판정',
      T(m.housing, ['상속인', '현재 주택', '상속으로 받는 집', '판정', '설명'], function (h) { return [esc(h.name), h.own + '채', h.got.map(function (g) { return esc(g.name) + ' ' + pct(g.share); }).join(', ') || '없음', { none: '무주택 유지', small: '소형·저가 예외 가능', share: '지분 → 유주택', one: '유주택', multi: '다주택' }[h.status], esc(h.text)]; }) + '<p><small>주택공급에 관한 규칙 제53조 기준의 보수적 판정입니다. 공공분양·특별공급은 기준이 다르고, 소형·저가주택 예외는 전용면적·공시가격 서류로 확인해야 합니다.</small></p>',
      '청약을 앞둔 상속인이 있으면 지분 조정·처분 시점 조언');
    add('savings', '절세 포인트 (' + (m.savings.save.length ? '최대 ' + kor(m.savings.best) : '없음') + ')',
      (m.savings.save.length ? m.savings.save.map(function (x, i) { const parts = [['inheritance', '상속세'], ['acquisition', '취득세'], ['holding', '10년 집 세금'], ['transfer', '양도세']].filter(function (q) { return Math.abs(x.diff[q[0]]) >= 10000; }).map(function (q) { const v = x.diff[q[0]]; return q[1] + ' ' + (v < 0 ? '−' : '+') + kor(Math.abs(v)); }).join(' · '); return '<p><b>' + (i + 1) + '. ' + esc(x.title) + '</b> <span class="ok">약 ' + kor(x.amount) + '↓</span><br>' + esc(x.body) + (parts ? '<br><small>' + esc(parts) + '</small>' : '') + '</p>'; }).join('') : '<p>금액이 줄어드는 항목을 찾지 못했습니다.</p>') +
      (m.savings.check.length ? '<p><b>확인 사항</b></p>' + m.savings.check.map(function (x) { return '<p>· <b>' + esc(x.title) + '</b> ' + esc(x.body) + '</p>'; }).join('') : ''),
      '각 포인트가 실제 적용되는지(요건·서류) 판단해 답변서에 「적용/불가/조건부」로');
    add('dates', '일정',
      m.dates.length ? T(m.dates, ['날짜', '할 일', '비고'], function (x) { return [fmtDate(x.date), esc(x.what), esc(x.note)]; }) : '<p>상속개시일이 없어 날짜를 계산하지 못했습니다.</p>', '');
    add('docs', '준비 서류', '<ul>' + m.docs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>', '고객에게 요청할 서류. 필요 없는 것은 지우세요');
    add('customer', '고객 질문·열어 본 티칭 포인트',
      '<p><b>고객 질문</b> ' + (m.customer.question ? esc(m.customer.question) : '(없음 — 시트 「질문」 열 확인)') + '</p><p><b>열어 본 티칭 포인트</b> ' + (m.opened.length ? m.opened.map(esc).join(', ') : '없음') + '</p>' + (m.overLimit ? '<p class="bad">총 상속재산 15억원 초과 — 검토 상품 범위 밖. 맡기기로 안내.</p>' : ''), '');
    add('assumptions', '이 계산의 전제', '<ul>' + m.assumptions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>', '고객 사례에 맞지 않는 전제가 있으면 답변서에 표시');
    return S;
  };

  /* ---------- 답변서 초안 ---------- */
  const VERDICT = { ok: '확인했습니다', fix: '고쳤습니다', check: '서류 확인이 필요합니다' };
  RV.answerDraft = function (m, review) {
    review = review || {}; const items = review.items || {};
    const note = function (id) { const it = items[id] || {}; return (it.note || '').trim(); };
    const line = function (id, text) { const it = items[id] || {}; return (it.verdict ? '[' + VERDICT[it.verdict] + '] ' : '') + text + (note(id) ? '\n세무사 의견: ' + note(id) : ''); };
    const p = m.tax.parts;
    const secs = [];
    secs.push({ title: '1. 세금은 이렇게 계산됩니다', text: line('inheritance',
      '상속재산 ' + kor(m.tax.totalProperty) + '에서 빚·장례비를 빼고 공제를 적용한 과세표준은 ' + kor(m.tax.taxBase) + ', 낼 상속세는 ' + kor(m.tax.payable) + '입니다.\n' +
      '6개월 안에 내는 세금은 상속세 ' + kor(p.inheritance) + ' + 취득세 ' + kor(p.acquisition) + ' = ' + kor(m.tax.now) + '입니다.\n' +
      m.tax.heirRows.map(function (h) { return '· ' + h.name + ': 받는 재산 ' + kor(h.received) + ' / 상속세 몫 ' + kor(h.inheritTax) + ' / 취득세 ' + kor(h.acquisition) + (h.transfer ? ' / 팔 때 양도세 ' + kor(h.transfer) : ''); }).join('\n')) });
    secs.push({ title: '2. 앞으로 낼 세금', text: line('holding', (m.tax.holdRows.length ? '상속받은 집 때문에 늘어나는 재산세·종부세는 10년 합계 약 ' + kor(p.holding) + '입니다. ' + m.tax.holdRows.map(function (h) { return h.heir + ' 첫해 ' + kor(h.years[0].total) + (h.years[5] ? ', 6년째 ' + kor(h.years[5].total) : ''); }).join(' / ') : '상속받는 집이 없어 재산세·종부세 변화는 없습니다.')) + '\n' + line('transfer', (m.tax.trRows.length ? '팔 계획을 넣은 부동산의 양도세는 약 ' + kor(p.transfer) + '입니다. ' + m.tax.trRows.map(function (r) { return r.heir + ' ' + r.name + ' ' + r.years + '년 보유 → ' + (r.oneHouse ? '1세대1주택 비과세(12억 초과분만)' : kor(r.total)) + (r.heavyRisk ? ' ※ 다주택 중과 가능' : ''); }).join(' / ') : '매도 계획이 없어 양도세는 계산하지 않았습니다. 팔 생각이 생기면 그 전에 꼭 확인하세요.')) });
    secs.push({ title: '3. 청약·주택 수', text: line('housing', m.housing.map(function (h) { return '· ' + h.name + ': ' + h.text; }).join('\n')) });
    secs.push({ title: '4. 줄일 수 있는 것', text: line('savings', m.savings.save.length ? m.savings.save.map(function (x, i) { return (i + 1) + '. ' + x.title + ' — 약 ' + kor(x.amount) + ' 절감. ' + x.body; }).join('\n') : '지금 입력으로는 추가로 줄일 항목이 없습니다.') + (m.savings.check.length ? '\n\n확인하실 것:\n' + m.savings.check.map(function (x) { return '· ' + x.title + ': ' + x.body; }).join('\n') : '') });
    secs.push({ title: '5. 입력에서 고치거나 보탤 것', text: line('input', (m.missing.length ? '계산을 더 정확히 하려면: ' + m.missing.map(function (x) { return x.text; }).join(' / ') : '계산에 필요한 칸은 모두 채워져 있습니다.') + (m.filingMissing.length ? '\n신고서용으로 더 적을 것: ' + m.filingMissing.map(function (x) { return x.text; }).join(', ') : '')) });
    secs.push({ title: '6. 일정', text: line('dates', m.dates.map(function (x) { return '· ' + fmtDate(x.date) + ' ' + x.what + ' — ' + x.note; }).join('\n')) });
    secs.push({ title: '7. 준비하실 서류', text: line('docs', m.docs.map(function (x) { return '· ' + x; }).join('\n')) });
    return {
      title: '상속세 검토 답변서', no: m.no, to: m.customer.name || '고객', date: new Date().toISOString().slice(0, 10),
      greeting: (m.customer.name || '고객') + '님, 보내 주신 내용을 검토했습니다. 아래는 입력하신 내용을 기준으로 한 검토 결과이며, 서류로 확인이 필요한 항목은 따로 표시했습니다.',
      conclusion: '',
      sections: secs,
      todo: ['서류를 보내 주시면 숫자를 확정하겠습니다.', '통화 가능한 시간을 알려 주세요(30분).'],
      closing: '궁금한 점은 이 답변서를 받은 메일로 회신하시거나 031-783-8877로 연락 주세요.\n대한세무법인 · ' + (review.agent || '담당 세무사') + ' · sjlee@taxdh.net',
      assumptions: m.assumptions
    };
  };

  root.RV = RV;
  if (typeof module === 'object' && module.exports) module.exports = RV;
})(typeof window !== 'undefined' ? window : globalThis);
