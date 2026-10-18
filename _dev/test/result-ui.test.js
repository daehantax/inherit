// 결과 화면(result.html) 검사 — 링크(#e=)로 상속 파일을 넣고 화면 숫자 = 엔진 숫자인지
const { open, expect } = require('./harness');
const EC = require('../../js/estate-calc.js'); global.EC = EC;
const EST = require('../../js/estate.js');
const S = require('../../js/savings.js');
const H = (id, rel, o) => Object.assign({ id: id, rel: rel, name: id }, o || {});
const E = { v: 1, deceased: { date: '2026-03-10' },
  heirs: [H('s', 'spouse', { name: '어머니', age: 74, houses: 0 }), H('c1', 'child', { name: '첫째', age: 48, houses: 1, ownGongsi: 5e8 }), H('c2', 'child', { name: '둘째', age: 44, houses: 0, livedYears: 12 })],
  assets: [{ id: 'h', type: 'apt', name: '분당 아파트', value: 1.2e9, gongsi: 8e8, lived: true, sellPlan: 'y3', sellPrice: 1.4e9, split: [{ heir: 'c1', share: 1 }] }, { id: 'fin_deposit', type: 'deposit', value: 6e8 }],
  debts: {}, funeral: { cost: 7e6 }, gifts: [], misc: {}, opened: [], meta: {} };
(async () => {
  const hash = '#e=' + EST.encode(E);
  const p = await open('result.html', { hash });
  console.log(p.errors.length ? '  JS errors: ' + p.errors.join(' | ') : '  (JS 오류 없음)'); if (p.errors.length) process.exitCode = 1;
  const all = EC.calcAll(E), sv = S.evaluate(E, all);
  expect('빈 화면 아님', p.el('rsEmpty').hidden ? 1 : 0, 1);
  expect('6개월 안에 낼 세금 = 엔진', p.text('bigNow'), S.kor(all.now));
  expect('가족별 표: 3명 + 합계', p.d.querySelectorAll('#heirTable tbody tr').length, 4);
  expect('절세 카드 수 = 엔진', p.d.querySelectorAll('#saveList .sv').length, sv.save.length);
  expect('확인 목록 수 = 엔진', p.d.querySelectorAll('#checkList .sv-check').length, sv.check.length);
  expect('첫 카드 금액', p.d.querySelector('#saveList .sv .amt').textContent.includes(S.kor(sv.save[0].amount)) ? 1 : 0, 1);
  expect('상속세 내역 마지막 줄 = 낼 상속세', p.d.querySelector('#inhDetail .kv.total b').textContent, all.inheritance.payable.toLocaleString('ko-KR') + '원');
  expect('양도세 내역 행 1개(분당 아파트)', p.d.querySelectorAll('#trDetail tbody tr').length, 1);
  expect('20단계 링크에 #d=', p.el('btnGold').getAttribute('href').startsWith('inheritGold.html#d=') ? 1 : 0, 1);
  expect('상품 카드 3개(상속세 있음)', p.d.querySelectorAll('#products .pd').length, 3);
  expect('추천 배지 1개', p.d.querySelectorAll('#products .badge').length, 1);
  expect('달력 항목 있음', p.d.querySelectorAll('#calList li').length >= 5 ? 1 : 0, 1);
  // 절세 적용 → 다시 계산 → 되돌리기
  const before = p.text('bigNow');
  p.click('[data-apply="0"]');
  expect('적용 후 되돌리기 줄', p.el('undoBar').hidden ? 0 : 1, 1);
  const afterTotal = EC.calcAll(p.w.RESULT_UI.E).total;
  expect('적용 후 10년 합계 = 원래 − 카드 금액', afterTotal, all.total - sv.save[0].amount);
  p.click('#btnUndo');
  expect('되돌리면 원래 숫자', p.text('bigNow'), before);
  // 상품 고르기
  p.click('[data-pick="review"]');
  expect('검토 고르면 버튼 글자', p.text('askSend'), '세무사 검토 신청하기');
  // 신청: 연락처 없으면 막힘
  p.d.getElementById('askForm').dispatchEvent(new p.w.Event('submit', { cancelable: true }));
  expect('휴대폰 없으면 안내', p.el('askMsg').textContent.includes('휴대폰') ? 1 : 0, 1);
  // 열쇠 코드: 형식이 틀리면 안내, 맞으면 서버 확인(가짜 fetch) 후 「신고서 열기」 버튼
  p.el('keyNo').value = 'F-1'; p.click('#keyOpen');
  expect('접수번호 형식 안내', p.text('keyMsg').includes('접수번호') ? 1 : 0, 1);
  p.w.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  p.el('keyNo').value = 'F-20261018-01'; p.el('keyCode').value = 'a1b2c3d4'; p.click('#keyOpen');
  await new Promise(r => setTimeout(r, 30));
  expect('열쇠 코드 확인 → 신고서 열기 버튼', p.el('keyOk').hidden ? 0 : 1, 1);
  p.w.fetch = async () => ({ ok: true, json: async () => ({ ok: false }) });
  // 상속세 0원 사례: 신고 대행 카드 숨김
  const small = JSON.parse(JSON.stringify(E)); small.assets = [{ id: 'fin_deposit', type: 'deposit', value: 3e8 }];
  const q = await open('result.html', { hash: '#e=' + EST.encode(small) });
  expect('상속세 0원 → 상품 2개(대행 없음)', q.d.querySelectorAll('#products .pd').length, 2);
  expect('상속세 0원 안내 문구', q.el('offerLine').textContent.includes('0원') ? 1 : 0, 1);
  // 빈 상속 파일
  const r = await open('result.html');
  expect('입력 없으면 안내 카드', r.el('rsEmpty').hidden ? 0 : 1, 1);
  console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
})();
