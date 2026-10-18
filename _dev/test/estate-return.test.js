// 상속 파일 → 셀프 신고서(inherit-tax-report.html) 변환 검사: 신고서 페이지의 최종 납부세액 = 엔진 납부세액
const { open, expect, near } = require('./harness');
const EC = require('../../js/estate-calc.js'); global.EC = EC;
const EST = require('../../js/estate.js');
const H = (id, rel, o) => Object.assign({ id: id, rel: rel, name: id }, o || {});
const cases = {
  '사례A(배우자+자녀2, 아파트·예금, 빚)': { deceased: { date: '2026-08-14' }, heirs: [H('s', 'spouse', { age: 72 }), H('c1', 'child', { age: 45 }), H('c2', 'child', { age: 42 })],
    assets: [{ id: 'a1', type: 'apt', value: 1.5e9 }, { id: 'a2', type: 'deposit', value: 3e8 }], debts: { other: 2e8 }, funeral: { cost: 1.2e7 }, gifts: [], misc: {} },
  '동거주택+대출+장례·봉안+사전증여': { deceased: { date: '2026-05-02' }, heirs: [H('s', 'spouse', { age: 80 }), H('c1', 'child', { age: 50, houses: 0, livedYears: 15 }), H('c2', 'child', { age: 47, houses: 1 })],
    assets: [{ id: 'h', type: 'apt', value: 2.2e9, gongsi: 1.5e9, lived: true, secured: 3e8, split: [{ heir: 'c1', share: 0.6 }, { heir: 's', share: 0.4 }] }, { id: 'l', type: 'land', gongsi: 4e8 }, { id: 'd', type: 'deposit', value: 5e8 }],
    debts: { loan: 3e8, tax: 2e6 }, funeral: { cost: 1.5e7, grave: 6e6 }, gifts: [{ id: 'g', to: 'c2', year: 2020, value: 3e8, taxBase: 2.5e8, taxPaid: 4e7 }], misc: { appraisalFee: 4e6 } },
  '손자 유증(할증)': { deceased: { date: '2026-09-01' }, heirs: [H('c1', 'child', { age: 55 }), H('g', 'grandchild', { age: 25 })],
    assets: [{ id: 'o', type: 'shop', value: 3e9, split: [{ heir: 'c1', share: 0.7 }, { heir: 'g', share: 0.3 }] }], debts: {}, funeral: {}, gifts: [], misc: {} },
};
(async () => {
  for (const [name, e] of Object.entries(cases)) {
    const p = await open('inherit-tax-report.html');
    if (p.errors.length) { console.log('  JS errors: ' + p.errors.join(' | ')); process.exitCode = 1; }
    const data = EST.toReturn(e);
    p.w.DH.apply(data); p.w.DH_recalc();
    const inh = EC.calcInheritance(e);
    console.log(name);
    expect('  재산 행 수', p.d.querySelectorAll('#assetBody tr').length >= data.assets.length ? 1 : 0, 1);
    near('  신고서 과세가액(f29) = 엔진', p.num('f29'), inh.taxable, 1);
    near('  신고서 납부세액(t44) = 엔진', p.num('t44'), inh.payable, 2);
    const g = p.w.DH_guideHtml();
    expect('  입력 가이드: 재산 행 표 + 칸 번호 표', (g.match(/<table/g) || []).length >= 3 ? 1 : 0, 1);
    expect('  입력 가이드에 신고서 납부세액(㊹)', g.includes(p.text('t44')) ? 1 : 0, 1);
  }
  console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
})();
