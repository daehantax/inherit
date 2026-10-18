// 자동 저장 · 링크(#d=) 복원 · 간단 계산기 → 절세보고서 이어받기
const { open, expect } = require('./harness');
const fakeStorage = (w, init) => { const s = Object.assign({}, init || {}); Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }, configurable: true }); return s; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // 1. 간단 계산기: 입력하면 0.4초 뒤 저장 버튼 없이 저장
  let p = await open('cal_Inherit_simple.html'); const st = fakeStorage(p.w);
  p.set('houseValue', 1e9); await wait(500);
  const saved = JSON.parse(st['dh.cal-inherit-simple.v1'] || '{}');
  expect('입력 즉시 자동 저장', saved.houseValue, '1,000,000,000');
  // 2. 그 저장값으로 다시 열면 그대로 (자동 불러오기)
  p = await open('상속공제.html'); fakeStorage(p.w, { 'dh.inherit-deduction.v1': JSON.stringify({ childCount: '3' }) }); p.w.DH.load(true);
  expect('다시 열면 저장값 복원', p.d.getElementById('childCount').value, '3');
  // 3. 상담 시트 링크(#d=)로 열면 고객 입력값 그대로
  p = await open('cal_Inherit_simple.html'); p.set('houseValue', 7e8); p.set('childCount', 2);
  const link = p.w.DH.shareLink();
  expect('공유 링크에 #d=', /#d=[A-Za-z0-9_-]+$/.test(link) ? 1 : 0, 1);
  p = await open('cal_Inherit_simple.html', { hash: '#' + link.split('#')[1] });
  expect('링크로 열면 주택가격 복원', p.d.getElementById('houseValue').value, '700,000,000');
  expect('링크로 열면 자녀 수 복원', p.d.getElementById('childCount').value, '2');
  // 4. 간단 계산기 → 셀프 절세(Gold): 값이 칸 이름에 맞게 넘어가고 결과까지 계산
  p = await open('cal_Inherit_simple.html');
  p.set('houseValue', 1.5e9); p.set('financialValue', 2e8); p.set('otherValue', 1e8); p.set('debtValue', 2e8); p.set('childCount', 2);
  const carry = p.w.DH_carryRoyal().replace('inheritRoyal', 'inheritGold');
  const d = p.w.DH.decodeData(carry.split('#d=')[1]);
  expect('넘기는 값: 금융+그 밖의 재산 → otherProperty', d.otherProperty, '300,000,000');
  p = await open('inheritGold.html', { hash: '#' + carry.split('#')[1] }); fakeStorage(p.w);
  expect('Gold: 주택가격 이어받음', p.d.getElementById('houseValue').value, '1,500,000,000');
  expect('Gold: 자녀 수 이어받음', p.d.getElementById('childrensNumber').value, '2');
  // 과세가액 = 15 + 3 − 2 − 장례비 0.05 = 15.95억
  expect('Gold: 과세가액 바로 계산', p.num('taxableAmountValueCell'), 1595000000);
  // 5. 링크로 열 때 이전 고객 값이 남지 않음 (resetFields)
  p = await open('inheritGold.html'); p.set('buildingValue', 9e8);
  p.w.DH.resetFields();
  expect('reset 후 빈칸', p.d.getElementById('buildingValue').value, '');
  console.log(process.exitCode ? '\n실패한 검사가 있습니다.' : '\n모두 통과');
})();
