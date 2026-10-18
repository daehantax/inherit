// 장애인 기대여명 찾기 (dh.js) — 2024년 완전생명표, 1년 미만 올림
const { open, expect } = require('./harness');
(async () => {
  for (const f of ['cal_Inherit_simple.html', '상속공제.html', 'inherit-tax-report.html', 'inheritGold.html', 'inheritRoyal.html']) {
    const p = await open(f);
    expect(f + ': 기대여명 찾기 버튼', p.d.querySelectorAll('#disabledYears + .dh-life-btn').length, 1);
  }
  const p = await open('상속공제.html'); const DH = p.w.DH;
  expect('남 0세 80.8 → 81년', DH.lifeYears('m', 0), 81);
  expect('여 50세 37.8 → 38년', DH.lifeYears('f', 50), 38);
  expect('남 51세 31.6 → 32년', DH.lifeYears('m', 51), 32);
  expect('남 52세 30.7 → 31년', DH.lifeYears('m', 52), 31);
  expect('남 100세 이상 1.9 → 2년', DH.lifeYears('m', 105), 2);
  expect('표 길이 101 (0~100세)', DH.LIFE_TABLE.m.length + DH.LIFE_TABLE.f.length, 202);
  // 도우미: 남 52(30.7→31) + 여 50(37.8→38) = 69년 → 입력칸에 69
  p.d.querySelector('#disabledYears + .dh-life-btn').click();
  const box = p.d.getElementById('dhLife'); const fire = (el, t) => el.dispatchEvent(new p.w.Event(t, { bubbles: true }));
  let tr = box.querySelector('tbody tr'); tr.querySelector('.lf-age').value = 52; fire(tr.querySelector('.lf-age'), 'input');
  box.querySelector('#dhLifeAdd').click();
  tr = box.querySelectorAll('tbody tr')[1]; tr.querySelector('.lf-sex').value = 'f'; tr.querySelector('.lf-age').value = 50; fire(tr.querySelector('.lf-age'), 'input');
  expect('도우미 합계 표시', box.querySelector('#dhLifeYears').textContent, '69년');
  box.querySelector('#dhLifeApply').click();
  expect('입력칸에 69 들어감', p.d.getElementById('disabledYears').value, '69');
  console.log(process.exitCode ? '\n실패한 검사가 있습니다.' : '\n모두 통과');
})();
