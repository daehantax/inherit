// 상속 파일 계산 엔진(js/estate-calc.js) 검사 — Node 에서 바로 실행 (jsdom 불필요)
// 실행: node _dev/test/estate-calc.test.js   손계산은 각 사례 주석에 적었다.
const EC = require('../../js/estate-calc.js');
const { expect, near } = require('./harness');
const H = (id, rel, o) => Object.assign({ id: id, rel: rel, name: id }, o || {});

/* ---------- 1. 법정상속분 ---------- */
let e = { heirs: [H('s', 'spouse'), H('c1', 'child'), H('c2', 'child')] };
let L = EC.legalShares(e);
near('배우자+자녀2: 배우자 3/7', L.s * 7, 3, 1e-9); near('자녀 2/7', L.c1 * 7, 2, 1e-9);
e = { heirs: [H('s', 'spouse'), H('c1', 'child'), H('g1', 'grandchild', { substitute: true }), H('g2', 'grandchild', { substitute: true })] };
L = EC.legalShares(e);
near('대습 손자녀 2명은 한 몫을 반씩: 손자녀 1/7', L.g1 * 7, 1, 1e-9); near('자녀 2/7', L.c1 * 7, 2, 1e-9); near('배우자 3/7', L.s * 7, 3, 1e-9);
e = { heirs: [H('s', 'spouse'), H('p1', 'parent'), H('p2', 'parent')] };
L = EC.legalShares(e);
near('자녀 없음: 배우자 1.5/3.5', L.s * 3.5, 1.5, 1e-9);
e = { heirs: [H('s', 'spouse'), H('c1', 'child'), H('g', 'grandchild')] };
expect('대습 아닌 손자녀는 법정상속분 0', EC.legalShares(e).g, 0);

/* ---------- 2. 사례 A (기존 셀프 절세 테스트와 같은 숫자) ---------- */
// 아파트 15억 + 예금 3억, 채무 2억(금융기관 아님), 장례비 1,200만 → 1천만 인정. 배우자 + 자녀 2, 법정비율로 나눔
// 과세가액 15.9억 · 배우자 한도 (18−2)억×3/7 = 685,714,285 · 금융 3억×20% = 6천만 · 일괄 5억
// 합계 1,245,714,285 → 과표 344,285,715 → 58,857,143 → 신고공제 1,765,714 → 57,091,429
const caseA = () => ({
  deceased: { date: '2026-08-14' },
  heirs: [H('s', 'spouse', { age: 72 }), H('c1', 'child', { age: 45 }), H('c2', 'child', { age: 42 })],
  assets: [{ id: 'a1', type: 'apt', value: 1.5e9 }, { id: 'a2', type: 'deposit', value: 3e8 }],
  debts: { other: 2e8 }, funeral: { cost: 1.2e7 }
});
let r = EC.calcInheritance(caseA());
expect('사례A 과세가액', r.taxable, 1590000000);
expect('사례A 배우자공제 = 한도', r.ded.spouse, 685714285);
expect('사례A 금융재산공제', r.ded.fin, 60000000);
expect('사례A 일괄공제', r.ded.lumpOrPersonal, 500000000);
expect('사례A 공제 합계', r.ded.applied, 1245714285);
expect('사례A 납부세액', r.payable, 57091429);
expect('사례A 상속인별 부담 합 = 납부세액', Math.round(r.taxShare.s + r.taxShare.c1 + r.taxShare.c2), 57091429);

// 같은 재산, 채무가 금융기관 대출이면 금융재산공제는 (3억−2억)=1억 → 2천만
let a = caseA(); a.debts = { loan: 2e8 };
expect('사례A′ 대출은 금융채무: 금융재산공제 2천만', EC.calcInheritance(a).ded.fin, 20000000);

/* ---------- 3. 사례 E: 종합한도 (기존 테스트와 같음) ---------- */
// 예금 1억 + 자녀증여 3억(과표 2.5억). 과세가액 3.95억 ≤ 5억 → 사전증여 차감 없음 → 과표 0
e = { heirs: [H('s', 'spouse'), H('c1', 'child', { age: 40 })], assets: [{ id: 'd', type: 'deposit', value: 1e8 }], gifts: [{ to: 'c1', value: 3e8, taxBase: 2.5e8 }] };
r = EC.calcInheritance(e);
expect('사례E 과세가액', r.taxable, 395000000); expect('사례E 적용 공제(한도)', r.ded.applied, 395000000); expect('사례E 납부 0', r.payable, 0);
e.assets[0].value = 3e8; r = EC.calcInheritance(e);
expect('사례E′ 과세가액 5.95억 → 한도 3.45억', r.ded.applied, 345000000);
expect('사례E′ 납부세액', r.payable, 38800000);

/* ---------- 4. 증여세액공제 한도 (기존 테스트, 배우자공제 5억으로 고정) ---------- */
// 재산 12억, 자녀증여 3억(과표 2.5억, 증여세 4천만). 공제 10억 → 과표 4.95억 → 산출 8,900만
// 증여세액공제 한도 8,900만×2.5/4.95 = 44,949,494 → 4천만 인정 → 신고공제 147만 → 47,530,000
e = { heirs: [H('s', 'spouse'), H('c1', 'child', { age: 40 })], assets: [{ id: 'o', type: 'other', value: 1.2e9 }], gifts: [{ to: 'c1', value: 3e8, taxBase: 2.5e8, taxPaid: 4e7 }] };
r = EC.calcInheritance(e, { spouseActual: 5e8 });
expect('증여세액공제 4천만 전액', r.giftCredit, 40000000); expect('납부 47,530,000', r.payable, 47530000);
// 실제 법정비율로 나누면 배우자 7.2억 받음 → 배우자공제 7.2억 → 공제 12.2억(한도 12.45억 이내) → 과표 2.75억
r = EC.calcInheritance(e);
expect('법정비율이면 배우자공제 7.2억', r.ded.spouse, 720000000); expect('과표 2.75억', r.taxBase, 275000000);

/* ---------- 5. 동거주택·배우자 단독상속·세대생략 ---------- */
// 아파트 8억(동거, 담보대출 2억) 무주택·12년 동거 자녀가 전부 받음 → (8−2)억 = 6억 공제
e = { heirs: [H('c1', 'child', { houses: 0, livedYears: 12 }), H('c2', 'child', { houses: 1 })],
  assets: [{ id: 'h', type: 'apt', value: 8e8, lived: true, secured: 2e8, split: [{ heir: 'c1', share: 1 }] }], debts: { loan: 2e8 } };
expect('동거주택공제 6억', EC.calcInheritance(e).ded.cohabit, 600000000);
e.assets[0].split = [{ heir: 'c1', share: 0.5 }, { heir: 'c2', share: 0.5 }];
expect('반만 받으면 3억', EC.calcInheritance(e).ded.cohabit, 300000000);
e.assets.push({ id: 'h2', type: 'house', value: 3e8 });
expect('돌아가신 분이 2주택이면 0', EC.calcInheritance(e).ded.cohabit, 0);
// 배우자 단독상속(다른 상속인 없음): 일괄공제 불가 → 기초 2억 + 인적공제
e = { heirs: [H('s', 'spouse', { age: 70 })], assets: [{ id: 'd', type: 'other', value: 2e9 }] };
r = EC.calcInheritance(e);
expect('배우자 단독: 일괄공제 대신 기초 2억(배우자는 연로자공제 제외)', r.ded.lumpOrPersonal, 200000000);
// 손자(대습 아님, 15세)가 4억 받음: 할증 30%, 종합한도에서 4억 차감
e = { heirs: [H('c1', 'child', { age: 45 }), H('g', 'grandchild', { age: 15 })],
  assets: [{ id: 'o', type: 'other', value: 2e9, split: [{ heir: 'c1', share: 0.8 }, { heir: 'g', share: 0.2 }] }] };
r = EC.calcInheritance(e);
// 과세가액 20억 − 장례 500만 = 19.95억, 한도 19.95−4 = 15.95억, 공제: 일괄 5억 vs 기초2억+자녀1×5천만+미성년(19−15)×1천만 = 2.9억 → 5억
// (손자는 자녀공제 대상 아님, 미성년자공제는 받음) → 과표 14.95억 → 14.95억×40% − 1.6억 = 4.38억 → 할증 4.38억 × 0.2 × 30% = 26,280,000
expect('세대생략 할증', r.surcharge, 26280000);
expect('종합한도 = 과세가액 − 손자 몫', r.ded.limit, 1595000000);

/* ---------- 6. 취득세 ---------- */
// 아파트 시가 10억·공시가 7억. 취득세는 공시가 기준(지방세법 10조의2)
// 1주택 자녀가 받으면 7억×(2.8%+0.16%) = 20,720,000 / 무주택 자녀가 받으면 특례 7억×(0.8%+0.16%) = 6,720,000
const caseB = (who) => ({ deceased: { date: '2026-08-14' },
  heirs: [H('s', 'spouse', { age: 70 }), H('c1', 'child', { houses: 1, ownGongsi: 5e8 }), H('c2', 'child', { houses: 0 })],
  assets: [{ id: 'h', type: 'apt', value: 1e9, gongsi: 7e8, split: [{ heir: who, share: 1 }] }] });
let acq = EC.calcAcquisition(caseB('c1'));
expect('1주택 자녀 취득세(공시가 기준)', acq.c1.total, 20720000);
acq = EC.calcAcquisition(caseB('c2'));
expect('무주택 자녀 특례 취득세', acq.c2.total, 6720000);
let b = caseB('c1'); b.assets[0].small = false;
expect('85㎡ 초과면 농특세 0.2% 추가', EC.calcAcquisition(b).c1.total, 22120000);
b = caseB('c1'); b.assets = [{ id: 'f', type: 'farm', value: 1e8, split: [{ heir: 'c1', share: 1 }] }];
expect('농지(공시가 모름 → 시가 1억×69%) × 2.56%', EC.calcAcquisition(b).c1.total, 1766400);
b.assets[0].gongsi = 5e7; expect('농지 공시지가 5천만 × 2.56%', EC.calcAcquisition(b).c1.total, 1280000);

/* ---------- 7. 재산세·종부세 (1주택 자녀가 공시가 7억 아파트를 전부 받음, 기존 집 공시가 5억) ---------- */
// 1~5년: 상속주택은 주택 수 제외 → 1세대1주택 12억 공제 → 종부세 0. 재산세(상속주택, 일반) 공시 7억×60% = 4.2억
//        → 57만 + 1.2억×0.4% = 1,050,000, 도시 588,000, 교육 210,000 = 1,848,000
// 6년째: 2주택 → 9억 공제, 과표 (12−9)억×60% = 1.8억 → 90만 − 재산세공제 311,040 = 588,960 → 588,960 + 농특 117,790 = 706,750
//        기존 집 1세대1주택 특례 상실: 1,104,000 − 620,000 = 484,000 → 6년째 합계 3,038,750
let hold = EC.calcHolding(caseB('c1'));
expect('1~5년 매년', hold.c1.perYear15, 1848000);
expect('6년째부터 매년', hold.c1.perYear6, 3038750);
expect('10년 합계 = 5×1,848,000 + 5×3,038,750', hold.c1.total, 5 * 1848000 + 5 * 3038750);
// 지분 40% 이하로 나누면 6년째에도 주택 수 제외(종부세) → 종부세 1세대1주택 유지
b = caseB('c1'); b.assets[0].split = [{ heir: 'c1', share: 0.4 }, { heir: 'c2', share: 0.6 }];
hold = EC.calcHolding(b);
expect('지분 40%: 6년째 종부세 증가 0', hold.c1.years[5].compDelta, 0);

/* ---------- 8. 양도세 (팔 계획) ---------- */
// 무주택 자녀가 10억(시가 평가) 아파트를 받아 3년 뒤 13억에 판다: 1세대1주택, 12억 초과분만 과세
// 과세차익 3억×1억/13억 = 23,076,923 → 장기보유 6% 1,384,615 → 기본공제 250만 → 과표 19,192,308
// → ×15% − 126만 = 1,618,846 → 1,618,840 + 지방 161,880 = 1,780,720
b = caseB('c2'); Object.assign(b.assets[0], { sellPlan: 'y3', sellPrice: 1.3e9 });
let tr = EC.calcTransfer(b);
expect('시가 평가 후 양도세', tr.c2.total, 1780720);
// 같은 집을 공시가(7억)로 신고했다면 취득가액 7억 → 과세차익 6억×1억/13억 = 46,153,846 → 장기 2,769,230 → 과표 40,884,616
// → 4,872,692 → 4,872,690 + 487,260 = 5,359,950
b.assets[0].value = 0; tr = EC.calcTransfer(b);
expect('공시가 평가 후 양도세 (더 많음)', tr.c2.total, 5359950);

/* ---------- 9. 날짜 ---------- */
let dt = EC.dates({ deceased: { date: '2026-08-14' } });
expect('신고기한 2027-02-28', dt.report === '2027-02-28' ? 1 : 0, 1);
expect('배우자 분할기한 2027-11-30', dt.spouseSplit === '2027-11-30' ? 1 : 0, 1);
dt = EC.dates({ deceased: { date: '2026-01-31' } });
expect('1월 사망 → 7월 31일', dt.report === '2026-07-31' ? 1 : 0, 1);

/* ---------- 10. 전체 합계 ---------- */
const all = EC.calcAll(caseA());
expect('calcAll: 지금 내는 세금 = 상속세 + 취득세', all.now, all.parts.inheritance + all.parts.acquisition);
expect('calcAll: 상속인 3명', all.heirs.length, 3);
console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
