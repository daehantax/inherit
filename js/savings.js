/* ============================================================
   절세 포인트 엔진 (savings.js)
   규칙 하나 = { code, kind, teach, run(e, cur) → null | { title, body, mod(바꾼 상속 파일), note } }
   - kind 'save'  : 바꾼 상속 파일로 다시 계산해 줄어드는 금액(10년 합계 기준)을 보여 준다. 0 이하면 숨김.
   - kind 'check' : 금액 없이 "확인해 보세요" 목록에 보인다.
   금액은 같은 계산 함수(EC.calcAll)를 두 번 돌려 차이를 구하므로 계산과 어긋날 수 없다.
   새 규칙은 RULES 배열에 한 덩어리를 더하면 화면에 나타난다.
   ============================================================ */
(function (root) {
  'use strict';
  const EC = root.EC || (typeof require === 'function' ? require('./estate-calc.js') : null);
  const n0 = function (v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; };
  const clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  const kor = function (n) {
    n = Math.round(Number(n) || 0); if (!n) return '0원';
    const neg = n < 0; n = Math.abs(n);
    const eok = Math.floor(n / 1e8), man = Math.round((n % 1e8) / 1e4);
    let s = '';
    if (eok) s += eok.toLocaleString('ko-KR') + '억';
    if (man) s += (s ? ' ' : '') + man.toLocaleString('ko-KR') + '만';
    if (!s) s = n.toLocaleString('ko-KR');
    return (neg ? '-' : '') + s + '원';
  };
  const heirs = function (e) { return (e.heirs || []).filter(function (h) { return h && h.id; }); };
  const nameOf = function (e, id) { const h = heirs(e).find(function (x) { return x.id === id; }); return h ? (h.name || '상속인') : '상속인'; };
  const assetName = function (a) { return a.name || (EC.TYPES[a.type] || {}).label || '재산'; };

  // 모든 자산을 「배우자 s, 나머지는 법정비율」로 다시 나눈다
  function withSpouseShare(e, spId, s) {
    const m = clone(e), L = EC.legalShares(m);
    const rest = 1 - (L[spId] || 0);
    m.assets.forEach(function (a) {
      a.split = heirs(m).map(function (h) { return { heir: h.id, share: h.id === spId ? s : (rest > 0 ? (1 - s) * (L[h.id] || 0) / rest : 0) }; }).filter(function (x) { return x.share > 1e-9; });
    });
    return m;
  }
  function giveAssetTo(e, assetId, heirId) {
    const m = clone(e); const a = m.assets.find(function (x) { return x.id === assetId; });
    if (a) a.split = [{ heir: heirId, share: 1 }];
    return m;
  }

  const RULES = [
    /* ---------- 상속세 자체 ---------- */
    { code: 'S01', kind: 'save', teach: 'T02', run: function (e, cur) {
      const inh = cur.inheritance, sp = heirs(e).find(function (h) { return h.rel === 'spouse'; });
      if (!sp || inh.ded.spouseLimit <= EC.R.spouseMin || inh.ded.spouseActual >= inh.ded.spouseLimit - 1e6) return null;
      const netAll = Math.max(1, inh.totalProperty - inh.debts);
      const s = Math.min(1, inh.ded.spouseLimit / netAll);
      return { title: '배우자가 조금 더 받으면',
        body: '지금은 배우자가 ' + kor(inh.ded.spouseActual) + '을 받는 것으로 계산했습니다. ' + kor(inh.ded.spouseLimit) + '(전체의 ' + Math.round(s * 100) + '%)까지 받으면 그만큼 공제가 늘어납니다. 다만 배우자가 나중에 돌아가실 때 그 재산에 다시 상속세가 나옵니다. 배우자 몫은 신고기한 다음 날부터 9개월 안에 등기·명의이전까지 끝내야 인정됩니다.',
        mod: withSpouseShare(e, sp.id, s), action: '배우자 ' + Math.round(s * 100) + '%로 바꿔 다시 계산' };
    } },
    { code: 'S02', kind: 'save', teach: 'T06', run: function (e, cur) {
      const house = (e.assets || []).find(function (a) { return EC.isHouse(a) && a.lived; });
      const q = heirs(e).find(function (h) { return (h.rel === 'child' || (h.rel === 'grandchild' && h.substitute)) && !n0(h.houses) && n0(h.livedYears) >= 10; });
      if (!house || !q || (e.assets || []).filter(EC.isHouse).length !== 1) return null;
      if (cur.inheritance.ded.cohabit >= EC.R.cohabitMax || (EC.sharesOf(e, house)[q.id] || 0) >= 0.999) return null;
      return { title: '같이 살던 집은 같이 살던 자녀가 받으면',
        body: nameOf(e, q.id) + '님이 10년 넘게 함께 산 집을 받으면 집값(담보대출 뺀 금액)에서 최대 6억원이 더 공제됩니다(동거주택 상속공제). 받는 사람이 그동안 집이 없었어야 합니다.',
        mod: giveAssetTo(e, house.id, q.id), action: nameOf(e, q.id) + '님이 받는 것으로 다시 계산' };
    } },
    { code: 'S03', kind: 'save', teach: 'T05', run: function (e) {
      const a = (e.assets || []).find(function (x) { return EC.isReal(x) && EC.valueBasis(x) === 'gongsi' && EC.sells(x) && n0(x.sellPrice) > n0(x.gongsi); });
      if (!a) return null;
      const m = clone(e); const ma = m.assets.find(function (x) { return x.id === a.id; });
      ma.value = n0(a.sellPrice); ma.basis = 'appraisal';
      m.misc = m.misc || {}; m.misc.appraisalFee = n0(m.misc.appraisalFee) + 3e6;
      return { title: assetName(a) + '을 감정평가 받으면',
        body: '지금은 공시가격으로 평가했습니다. 그러면 지금 상속세는 적지만, 나중에 팔 때 "산 값"이 공시가격이 되어 양도세가 커집니다. 감정평가(약 300만원, 500만원까지 공제)를 받아 두면 지금 상속세는 조금 늘어도 팔 때 세금이 줄 수 있습니다. 계산은 감정가를 팔 예정 가격으로 가정했습니다.',
        mod: m, action: '감정평가 받은 것으로 다시 계산' };
    } },
    { code: 'S05', kind: 'save', teach: 'T12', run: function (e) {
      const f = e.funeral || {};
      if (!n0(f.cost) || n0(f.cost) >= EC.R.funeralMax) return null;
      const m = clone(e); m.funeral = Object.assign({}, f, { cost: EC.R.funeralMax });
      return { title: '장례비 영수증을 모두 모으면(최대)',
        body: '장례비는 영수증 없이 500만원, 영수증이 있으면 1,000만원까지 빠집니다. 지금 ' + kor(f.cost) + '을 넣으셨습니다. 식대·상조·묘지 등 쓴 돈이 더 있으면 영수증을 모으세요. 봉안시설·자연장지 비용은 500만원까지 따로 빠집니다.',
        mod: m, action: '장례비 1,000만원으로 다시 계산' };
    } },
    { code: 'S07', kind: 'save', teach: 'T03', run: function (e, cur) {
      if (!cur.inheritance.surcharge) return null;
      const m = clone(e);
      const gIds = heirs(m).filter(function (h) { return h.rel === 'grandchild' && !h.substitute; }).map(function (h) { return h.id; });
      const kids = heirs(m).filter(function (h) { return h.rel === 'child'; });
      if (!kids.length) return null;
      m.assets.forEach(function (a) {
        const s = EC.sharesOf(m, a); let moved = 0;
        gIds.forEach(function (g) { moved += s[g] || 0; s[g] = 0; });
        kids.forEach(function (k) { s[k.id] = (s[k.id] || 0) + moved / kids.length; });
        a.split = Object.keys(s).filter(function (id) { return s[id] > 1e-9; }).map(function (id) { return { heir: id, share: s[id] }; });
      });
      return { title: '손자녀 몫을 자녀가 받으면',
        body: '손자녀가 바로 받으면 그 몫의 상속세에 30%(미성년자가 20억 넘게 받으면 40%)가 더 붙습니다. 자녀가 받으면 이 할증은 없지만, 나중에 자녀가 손자녀에게 줄 때 증여세·상속세를 한 번 더 내야 합니다. 어느 쪽이 나은지는 금액에 따라 다릅니다.',
        mod: m, action: '자녀가 받는 것으로 다시 계산' };
    } },

    /* ---------- 연결 세금 ---------- */
    { code: 'L01', kind: 'save', teach: 'T19', run: function (e, cur) {
      const free = heirs(e).filter(function (h) { return !n0(h.houses); });
      if (!free.length) return null;
      let best = null;
      (e.assets || []).filter(EC.isHouse).forEach(function (a) {
        const s = EC.sharesOf(e, a);
        const owners = Object.keys(s).filter(function (id) { return s[id] > 0; });
        if (owners.length === 1 && free.some(function (f) { return f.id === owners[0]; })) return;   // 이미 무주택자가 전부 받음
        free.forEach(function (f) {
          const m = giveAssetTo(e, a.id, f.id); const t = EC.calcAll(m).parts.acquisition;
          if (!best || t < best.t) best = { t: t, m: m, a: a, f: f };
        });
      });
      if (!best || best.t >= cur.parts.acquisition) return null;
      return { title: assetName(best.a) + '은 집 없는 ' + nameOf(e, best.f.id) + '님이 받으면',
        body: '상속받은 집의 취득세는 보통 2.96%인데, 집 없는 사람이 받아 1주택이 되면 0.96%입니다(같은 세대 기준). 공시가격 기준으로 계산합니다.',
        mod: best.m, action: nameOf(e, best.f.id) + '님이 받는 것으로 다시 계산' };
    } },
    { code: 'L02', kind: 'save', teach: 'T20', run: function (e, cur) {
      // 집 있는 상속인이 큰 지분을 받아 6년째부터 종부세가 오르는 경우 → 40% 이하로 줄이고 나머지는 다른 상속인에게
      let target = null;
      heirs(e).forEach(function (h) {
        const hd = cur.holding[h.id]; if (!hd || !n0(h.houses) || hd.perYear6 <= hd.perYear15) return;
        (e.assets || []).filter(EC.isHouse).forEach(function (a) { const s = EC.sharesOf(e, a)[h.id] || 0; if (s > 0.4 && (!target || s > target.s)) target = { h: h, a: a, s: s }; });
      });
      if (!target) return null;
      const others = heirs(e).filter(function (h) { return h.id !== target.h.id && h.rel !== 'grandchild'; });
      if (!others.length) return null;
      const m = clone(e); const ma = m.assets.find(function (x) { return x.id === target.a.id; });
      const s = EC.sharesOf(e, target.a); const extra = s[target.h.id] - 0.4; s[target.h.id] = 0.4;
      others.forEach(function (o) { s[o.id] = (s[o.id] || 0) + extra / others.length; });
      ma.split = Object.keys(s).filter(function (id) { return s[id] > 1e-9; }).map(function (id) { return { heir: id, share: s[id] }; });
      return { title: nameOf(e, target.h.id) + '님 지분을 40% 이하로 하면',
        body: '집이 있는 분이 상속주택을 받으면 5년 동안은 종부세 주택 수에서 빠지지만, 6년째부터는 다주택으로 계산됩니다. 지분을 40% 이하(또는 지분 공시가격 6억원, 수도권 밖 3억원 이하)로 받으면 계속 빠집니다.',
        mod: m, action: '지분 40%로 바꿔 다시 계산' };
    } },

    /* ---------- 확인해 보세요 (금액 없음) ---------- */
    { code: 'C01', kind: 'check', teach: 'T08', run: function (e) {
      const fin = (e.assets || []).filter(EC.isFin).reduce(function (s, a) { return s + EC.assetValue(a); }, 0);
      if (!fin || n0((e.debts || {}).loan)) return null;
      return { title: '은행 대출이 정말 없나요?', body: '예금·주식이 있는데 대출을 넣지 않으셨습니다. 대출이 있으면 상속세가 줄어듭니다(예금·주식 공제는 대출을 뺀 금액 기준).' };
    } },
    { code: 'C02', kind: 'check', teach: 'T11', run: function (e) {
      const real = (e.assets || []).some(function (a) { return EC.isReal(a); });
      const d = e.debts || {};
      if (!real || n0(d.loan) || n0(d.deposit) || n0(d.other)) return null;
      return { title: '세입자 보증금, 빼먹지 않으셨나요?', body: '집이나 상가를 세놓았다면 돌려줄 보증금은 빚으로 빠집니다. 넣지 않으면 상속세를 더 냅니다.' };
    } },
    { code: 'C03', kind: 'check', teach: 'T24', run: function (e, cur) {
      if (cur.inheritance.payable <= EC.R.installmentMin) return null;
      return { title: '한 번에 내기 어렵다면', body: '상속세가 2,000만원을 넘으면 최대 10년에 나눠 낼 수 있습니다(연부연납, 담보 필요). 현금이 부족하면 부동산으로 낼 수도 있습니다(물납).' };
    } },
    { code: 'C04', kind: 'check', teach: 'T23', run: function (e) {
      const h = heirs(e).find(function (x) { return Math.floor(n0(x.houses)) === 1 && (e.assets || []).some(function (a) { return EC.isHouse(a) && (EC.sharesOf(e, a)[x.id] || 0) > 0; }); });
      if (!h) return null;
      return { title: nameOf(e, h.id) + '님, 원래 집을 먼저 파세요', body: '상속받은 집이 생겨도 원래 갖고 있던 집 1채를 먼저 팔면 1세대1주택 비과세(12억원까지)를 받을 수 있습니다. 상속받은 집을 먼저 팔면 세금이 나옵니다.' };
    } },
    { code: 'C05', kind: 'check', teach: 'T07', run: function (e) {
      if (!(e.assets || []).some(function (a) { return a.type === 'bunyang'; })) return null;
      return { title: '분양권은 누가 받느냐가 중요합니다', body: '분양권도 집 수에 들어갈 수 있고, 완공되면 받는 사람이 취득세(2.8%)를 냅니다. 이미 집이 있는 분이 받으면 나중에 팔 때 세금이 달라집니다. 세무사 확인을 권합니다.' };
    } },
    { code: 'C06', kind: 'check', teach: 'T21', run: function (e) {
      const d = (e.deceased || {}).date; if (!d) return null;
      const md = d.slice(5);
      if (md > '06-01') return null;
      return { title: '올해 재산세는 6월 1일 주인이 냅니다', body: '돌아가신 날이 6월 1일 전이고 그때까지 등기를 못 했다면 올해 재산세는 상속인 중 주된 상속인에게 나옵니다. 누가 낼지 미리 정해 두세요.' };
    } },
    { code: 'C07', kind: 'check', teach: 'T02', run: function (e, cur) {
      const d = cur.inheritance.ded;
      if (!heirs(e).some(function (h) { return h.rel === 'spouse'; }) || d.spouseActual <= d.spouseLimit + 1e6) return null;
      return { title: '배우자 몫이 공제 한도보다 많습니다', body: '배우자가 ' + kor(d.spouseActual) + '을 받지만 공제는 ' + kor(d.spouseLimit) + '까지입니다. 넘는 부분은 공제 없이 나중에 배우자 상속 때 다시 세금이 나옵니다. 자녀 몫을 늘리는 것도 검토해 보세요.' };
    } },
    { code: 'C08', kind: 'check', teach: 'T15', run: function (e) {
      return { title: '돌아가시기 전 큰 출금이 있었나요?', body: '돌아가시기 1년 안에 2억원, 2년 안에 5억원이 넘게 통장에서 나가거나 재산을 팔았다면 어디에 썼는지 설명해야 합니다. 설명 못 한 돈은 상속재산으로 봅니다.' };
    } },
  ];

  function evaluate(e, cur) {
    cur = cur || EC.calcAll(e);
    const save = [], check = [];
    RULES.forEach(function (rule) {
      let r = null; try { r = rule.run(e, cur); } catch (err) { r = null; }
      if (!r) return;
      const item = { code: rule.code, teach: rule.teach, title: r.title, body: r.body, action: r.action };
      if (rule.kind === 'save') {
        const nxt = EC.calcAll(r.mod);
        item.amount = cur.total - nxt.total;
        item.diff = {
          inheritance: nxt.parts.inheritance - cur.parts.inheritance, acquisition: nxt.parts.acquisition - cur.parts.acquisition,
          holding: nxt.parts.holding - cur.parts.holding, transfer: nxt.parts.transfer - cur.parts.transfer };
        item.mod = r.mod;
        if (item.amount >= 10000) save.push(item);
      } else check.push(item);
    });
    save.sort(function (x, y) { return y.amount - x.amount; });
    // 항목끼리 겹치므로(같은 재산을 두 번 옮김) 합계 대신 가장 큰 금액을 대표값으로 쓴다
    return { save: save.slice(0, 7), check: check, best: save.length ? save[0].amount : 0 };
  }

  root.SAVINGS = { RULES: RULES, evaluate: evaluate, kor: kor };
  if (typeof module === 'object' && module.exports) module.exports = root.SAVINGS;
})(typeof window !== 'undefined' ? window : globalThis);
