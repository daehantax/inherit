// 전자신고 파일 화면(efile.html): 링크로 불러오기 → 칸 채우기 → 검사 → 내려받기 버튼
const { open, expect } = require('./harness');
global.EC = require('../../js/estate-calc.js'); const EST = require('../../js/estate.js');
const H = (id, rel, o) => Object.assign({ id: id, rel: rel, name: id }, o || {});
const E = { v: 1, deceased: { date: '2026-08-14' }, heirs: [H('s', 'spouse', { age: 72 }), H('c1', 'child', { age: 45 })],
  assets: [{ id: 'a1', type: 'apt', name: '아파트', value: 1.5e9, gongsi: 1e9 }, { id: 'fin_deposit', type: 'deposit', value: 3e8 }], debts: {}, funeral: { cost: 8e6 }, gifts: [], misc: {}, opened: [], meta: {} };
(async () => {
  const p = await open('efile.html', { hash: '#e=' + EST.encode(E) });
  if (p.errors.length) { console.log('JS errors', p.errors); process.exitCode = 1; }
  expect('주소의 상속 파일 불러옴', p.el('efForm').hidden ? 0 : 1, 1);
  p.click('#efBuild');
  expect('빈 칸이면 다운로드 막힘', p.el('efDownload').disabled ? 1 : 0, 1);
  const fill = (path, v) => { const el = p.d.querySelector('[data-s="' + path + '"]'); el.value = v; el.dispatchEvent(new p.w.Event('input', { bubbles: true })); };
  [['agent.userId', 'daehan'], ['agent.name', '이석제'], ['agent.mgmtNo', 'T12345'], ['agent.phone', '0317838877'], ['agent.bizNo', '1234567890'],
   ['filer.phone', '01011112222'], ['filer.email', 'a@b.kr'], ['filer.address', '성남시 분당구'], ['deceased.name', '홍길동'], ['deceased.ssn', '4001011234567'], ['deceased.bjd', '4113510300'], ['deceased.bjdName', '경기 성남분당 정자'],
   ['heirs.s.name', '김배우'], ['heirs.s.ssn', '4501012234567'], ['heirs.c1.name', '홍자녀'], ['heirs.c1.ssn', '8001011234567'],
   ['assets.a1.bjd', '4113510300'], ['assets.a1.bjdName', '경기 성남분당 정자'], ['assets.a1.area', '84.97'], ['assets.a1.bunji', '10']].forEach(x => fill(x[0], x[1]));
  p.click('#efBuild');
  console.log('  결과:', p.el('efResult').textContent.slice(0, 160));
  expect('칸을 채우면 검사 통과 → 다운로드 가능', p.el('efDownload').disabled ? 0 : 1, 1);
  console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
})();
