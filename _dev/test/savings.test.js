// 절세 포인트 엔진(js/savings.js) 검사 — 규칙마다 뜨는 경우·안 뜨는 경우, 금액 = 두 계산의 차이
const EC = require('../../js/estate-calc.js'); global.EC = EC;
const S = require('../../js/savings.js');
const { expect } = require('./harness');
const H = (id, rel, o) => Object.assign({ id: id, rel: rel, name: id }, o || {});
const codes = r => r.save.map(x => x.code).concat(r.check.map(x => x.code));
const has = (r, c) => codes(r).indexOf(c) >= 0 ? 1 : 0;

// 기본 사례: 배우자 + 자녀 2(장남 1주택·공시 5억, 차남 무주택 12년 동거), 아파트(시가 12억·공시 8억, 동거, 장남이 전부), 예금 6억
const base = () => ({ deceased: { date: '2026-03-10' },
  heirs: [H('s', 'spouse', { age: 74 }), H('c1', 'child', { age: 48, houses: 1, ownGongsi: 5e8 }), H('c2', 'child', { age: 44, houses: 0, livedYears: 12 })],
  assets: [{ id: 'h', type: 'apt', value: 1.2e9, gongsi: 8e8, lived: true, split: [{ heir: 'c1', share: 1 }] }, { id: 'd', type: 'deposit', value: 6e8 }],
  debts: {}, funeral: { cost: 7e6 } });
let e = base(), cur = EC.calcAll(e), r = S.evaluate(e, cur);
console.log('  뜬 항목:', codes(r).join(', '));
expect('S01 배우자 더 받기 뜸', has(r, 'S01'), 1);
expect('S02 동거주택(차남) 뜸', has(r, 'S02'), 1);
expect('S05 장례비 뜸', has(r, 'S05'), 1);
expect('L01 무주택자가 받으면 취득세 줄어듦 뜸', has(r, 'L01'), 1);
expect('C01 대출 확인 뜸', has(r, 'C01'), 1);
expect('C04 장남 원래 집 먼저 팔기 뜸', has(r, 'C04'), 1);
expect('C06 6월 1일 전 사망 → 재산세 안내', has(r, 'C06'), 1);
r.save.forEach(x => { const nxt = EC.calcAll(x.mod); expect('  ' + x.code + ' 금액 = 현재 − 바꾼 뒤', x.amount, cur.total - nxt.total); expect('  ' + x.code + ' 금액 > 0', x.amount > 0 ? 1 : 0, 1); });
expect('정렬: 금액 큰 순서', r.save.every((x, i) => i === 0 || r.save[i - 1].amount >= x.amount) ? 1 : 0, 1);
expect('대표값 = 가장 큰 금액', r.best, r.save[0].amount);
// S02 를 적용하면 동거주택공제가 생긴다
const s02 = r.save.find(x => x.code === 'S02');
expect('S02 적용 후 동거주택공제 6억', EC.calcInheritance(s02.mod).ded.cohabit, 600000000);
expect('원본 상속 파일은 바뀌지 않음', JSON.stringify(e) === JSON.stringify(base()) ? 1 : 0, 1);

// 안 뜨는 경우
e = base(); e.heirs[2].livedYears = 5; r = S.evaluate(e);
expect('동거 5년이면 S02 없음', has(r, 'S02'), 0);
e = base(); e.funeral = { cost: 1.2e7 }; r = S.evaluate(e);
expect('장례비 1천만 이상이면 S05 없음', has(r, 'S05'), 0);
e = base(); e.debts = { loan: 1e8 }; r = S.evaluate(e);
expect('대출 넣었으면 C01 없음', has(r, 'C01'), 0);

// S03 감정평가: 공시가만 넣고 3년 뒤 15억에 팔 계획
e = base(); Object.assign(e.assets[0], { value: 0, sellPlan: 'y3', sellPrice: 1.5e9 }); r = S.evaluate(e);
const s03 = r.save.find(x => x.code === 'S03');
console.log('  S03:', s03 ? S.kor(s03.amount) + ' (상속세 ' + S.kor(s03.diff.inheritance) + ', 양도세 ' + S.kor(s03.diff.transfer) + ')' : '없음');
expect('S03 감정평가 뜸(팔 계획 + 공시가 평가)', s03 ? 1 : 0, 1);
if (s03) expect('S03: 양도세는 줄고 상속세는 늘어남', (s03.diff.transfer < 0 && s03.diff.inheritance >= 0) ? 1 : 0, 1);

// S07 손자녀 할증
e = { heirs: [H('c1', 'child', { age: 50 }), H('g', 'grandchild', { age: 20 })], assets: [{ id: 'o', type: 'other', value: 3e9, split: [{ heir: 'c1', share: 0.7 }, { heir: 'g', share: 0.3 }] }] };
r = S.evaluate(e);
expect('S07 손자녀 할증 뜸', has(r, 'S07'), 1);
console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
