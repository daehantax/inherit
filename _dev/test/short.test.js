// 단기재상속 세액공제(상증법 30조)가 모든 계산 화면에 들어갔는지 검사
const { open, expect } = require('./harness');
(async () => {
  // 1) 단순 계산기: 집 10억, 배우자 없음 → 86,330,000 (기존). 산출세액 89,000,000
  //    + 1년 이내, 전 산출 3천만·전 재산 6억·재상속분 3억 → 1,500만 공제 → 3% = (8,900만−1,500만)×3% = 2,220,000 → 71,780,000
  let p = await open('cal_Inherit_simple.html');
  p.set('houseValue', 1e9); p.radio('spouse', 'no');
  expect('단순 계산기 기본', p.num('r_pay'), 86330000);
  p.set('shortYears', '1'); p.set('shortPrevTax', 3e7); p.set('shortPrevEstate', 6e8); p.set('shortReinherit', 3e8);
  expect('단순 계산기: 단기재상속 1,500만', p.num('r_shortCredit'), 15000000);
  expect('단순 계산기: 납부', p.num('r_pay'), 71780000);
  p.set('shortYears', '7');   // 40% → 600만 → (8,900만−600만)×3% = 2,490,000 → 80,510,000
  expect('7년 이내 40%', p.num('r_pay'), 80510000);
  if (p.errors.length) { console.log(p.errors); process.exitCode = 1; }
  // 2) 20단계 보고서(골드): 사례A 10억 공제 → 113,490,000, 산출 1.17억. + 1년 이내 1,500만 → (1.17억−1,500만)×3% = 3,060,000 → 98,940,000
  p = await open('inheritGold.html');
  p.set('houseValue', 1.5e9); p.set('otherProperty', 3e8); p.set('debts', 2e8); p.set('funeralExpense', 1.2e7);
  p.set('shortYears', '1'); p.set('shortPrevTax', 3e7); p.set('shortPrevEstate', 6e8); p.set('shortReinherit', 3e8);
  p.click('#btnCalc');
  expect('20단계 보고서: 납부', p.num('payableTaxValueCell'), 98940000);
  expect('20단계 보고서: 세액공제 합계 = 1,500만 + 306만', p.num('taxDeductionValueCell'), 18060000);
  expect('20단계 보고서: 안내 문구', /단기재상속/.test(p.text('resultNote')) ? 1 : 0, 1);
  // 3) 신고서(제9호): ㉜ 한도 = ㉔ − ㉘ − ㉛
  p = await open('상속세과세표준 자진납부.html');
  expect('자진납부 계산서: ㉜ 옆 계산하기 버튼', p.d.querySelectorAll('#v32 + .dh-life-btn').length, 1);
  p = await open('inherit-tax-report.html');
  expect('신고서: ㉜ 옆 계산하기 버튼', p.d.querySelectorAll('#shortTermCredit + .dh-life-btn').length, 1);
  // 도우미 계산: 2년 이내 90%, 2억 × 4/10 × 90% = 7,200만
  p.click('#shortTermCredit + .dh-life-btn');
  p.set('dsYears', '2'); p.set('dsTax', 2e8); p.set('dsEstate', 1e9); p.set('dsRe', 4e8);
  expect('도우미 계산 7,200만', p.num('dsAmt'), 72000000);
  p.click('#dsApply');
  expect('도우미 → ㉜ 칸에 들어감', p.num('shortTermCredit'), 72000000);
  // 4) 새 플랫폼: 상속 파일에 그때의 상속 → 엔진 = 신고서 서식(㉜·㊹) = 전자신고(03#18·26) = 20단계 보고서
  global.EC = require('../../js/estate-calc.js'); const EST = require('../../js/estate.js');
  global.EUCKR = require('../../js/euckr.js'); global.EF_LAYOUT = require('../../js/efile-layout.js'); global.EF_CODES = require('../../js/efile-codes.js'); global.EF = require('../../js/efile.js');
  const EF = require('../../js/efile-map.js');
  const H = (id, rel, o) => Object.assign({ id: id, rel: rel, name: id }, o || {});
  const E = { v: 1, deceased: { date: '2026-08-14' }, heirs: [H('c1', 'child', { age: 50 }), H('c2', 'child', { age: 47 })],
    assets: [{ id: 'a', type: 'apt', value: 2e9, gongsi: 1.4e9 }, { id: 'fin_deposit', type: 'deposit', value: 5e8 }], debts: {}, funeral: { cost: 1e7 }, gifts: [], misc: {}, opened: [], meta: {},
    priors: [{ id: 'p1', who: '아버지', date: '2023-03-02', prevTax: 1.2e8, prevEstate: 1.8e9, reinherit: 9e8 }] };
  const inh = EC.calcInheritance(E);
  // 2023-03-02 → 2026-08-14: 4년 이내 70% → 1.2억 × 9/18 × 70% = 42,000,000
  expect('엔진: 4년 이내 70% → 4,200만', inh.shortTermCredit, 42000000);
  p = await open('inherit-tax-report.html');
  p.w.DH.apply(EST.toReturn(E)); p.w.DH_recalc();
  expect('신고서 ㉜ = 엔진', p.num('shortTermCredit'), 42000000);
  expect('신고서 ㊹ = 엔진 납부세액', p.num('t44'), inh.payable);
  const built = EF.build(E, {}); const rec03 = built.records.find(r => r.code === '03').values;
  expect('전자신고 03#18 단기세액공제', rec03[18], 42000000);
  expect('전자신고 03#26 납부할 세액 = 엔진', rec03[26], inh.payable);
  expect('전자신고 03#13 = 28+32+33', rec03[13], rec03[14] + rec03[18] + rec03[19]);
  // 20단계 보고서로 이어받기(toReport) 후 같은 공제
  const rep = EST.toReport(E);
  expect('20단계 넘김: 4년 이내', rep.shortYears, '4');
  const q = await open('estate.html', { hash: '#e=' + EST.encode(E) });
  q.click('[data-go="E"]');
  expect('입력 화면 E: 그때의 상속 카드', q.d.querySelectorAll('#priorList .es-item').length, 1);
  expect('입력 화면 E: 공제율 안내', /4년 이내 · 공제율 70%/.test(q.d.querySelector('.prior-out').textContent) ? 1 : 0, 1);
  const r = await open('result.html', { hash: '#e=' + EST.encode(E) });
  expect('결과 화면: 상속세 내역에 단기재상속 줄', /단기재상속 세액공제/.test(r.text('inhDetail')) ? 1 : 0, 1);
  console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
})();
