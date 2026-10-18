// 입력 화면(estate.html) 검사 — jsdom 으로 실제 클릭·입력
const { open, expect } = require('./harness');
(async () => {
  const p = await open('estate.html');
  console.log(p.errors.length ? '  JS errors: ' + p.errors.join(' | ') : '  (JS 오류 없음)'); if (p.errors.length) process.exitCode = 1;
  const E = () => p.w.ESTATE_UI.E;
  const ev = (el, t) => el.dispatchEvent(new p.w.Event(t, { bubbles: true }));
  const typeMoney = (path, man) => { const el = p.d.querySelector('[data-path="' + path + '"]'); if (!el) throw new Error('no ' + path); el.value = String(man); ev(el, 'input'); ev(el, 'change'); };
  const pick = (path, v) => { const el = p.d.querySelector('[data-path="' + path + '"]'); if (!el) throw new Error('no ' + path); el.value = v; ev(el, 'change'); };
  expect('처음 화면 A', p.d.querySelector('.es-screen.on').dataset.screen === 'A' ? 1 : 0, 1);
  expect('티칭 포인트 한 줄이 채워짐', p.d.querySelector('[data-teach="T01"]').textContent.includes('6개월') ? 1 : 0, 1);
  // 가족: 배우자 있음, 자녀 2
  p.radio('hasSpouse', 'yes'); p.click('[data-kids="1"]'); p.click('[data-kids="1"]');
  expect('상속인 3명', E().heirs.length, 3);
  expect('자녀 카드 2개 + 배우자 카드', p.d.querySelectorAll('#heirList .es-item').length, 3);
  const c1 = E().heirs.find(h => h.rel === 'child');
  pick('h.' + c1.id + '.houses', '1');
  expect('집 1채 고르면 공시가 칸 나타남', p.d.querySelectorAll('[data-path="h.' + c1.id + '.ownGongsi"]').length, 1);
  p.set('deathDate', '2026-08-14');
  expect('기한 표시', p.text('sumDeadline').includes('2027년 2월 28일') ? 1 : 0, 1);
  // 집·땅
  p.click('[data-go="B"]'); p.click('#addAsset');
  const a = E().assets[0];
  typeMoney('a.' + a.id + '.value', 150000);    // 15억 (만원 단위)
  expect('만원 입력 → 원으로 저장', E().assets[0].value, 1500000000);
  expect('한글 금액 표시', p.d.querySelector('[data-path="a.' + a.id + '.value"]').parentElement.querySelector('.kor').textContent, '15억원');
  // 예금
  p.click('[data-go="C"]'); typeMoney('a.fin_deposit.value', 30000);
  // 빚·장례비
  p.click('[data-go="D"]'); typeMoney('debts.other', 20000); typeMoney('funeral.cost', 1200);
  // 사례A 와 같은 숫자 → 법정비율이면 상속세 57,091,429 (≈ 5,709만원)
  expect('요약: 예상 상속세 5,709만원', p.text('sumTax'), '5,709만원');
  // 나누기: 아파트를 자녀1 전부
  p.click('[data-go="F"]');
  expect('나누기 행 2개(아파트, 예금 묶음)', p.d.querySelectorAll('.split-row').length, 2);
  const selEl = p.d.querySelector('[data-split-mode="' + a.id + '"]'); selEl.value = c1.id; ev(selEl, 'change');
  expect('아파트 split = 자녀1 100%', JSON.stringify(E().assets[0].split), JSON.stringify([{ heir: c1.id, share: 1 }]));
  expect('나누기 표에 합계 행', p.d.querySelectorAll('#splitTable tr.total').length, 1);
  const sel2 = p.d.querySelector('[data-split-mode="' + a.id + '"]'); sel2.value = 'custom'; ev(sel2, 'change');
  expect('직접 나누기 → % 칸 3개', p.d.querySelectorAll('[data-split-pct="' + a.id + '"]').length, 3);
  expect('다음 버튼 글자 = 세금 보기', p.text('btnNext'), '세금 보기 →');
  // 링크로 열기: 같은 상속 파일이 그대로
  const link = p.w.EST.link('estate.html', E());
  const q = await open('estate.html', { hash: link.slice(link.indexOf('#')) });
  if (q.errors.length) console.log('  링크 화면 JS errors: ' + q.errors.join(' | '));
  expect('링크로 연 화면: 상속인 3명', q.w.ESTATE_UI.E.heirs.length, 3);
  expect('링크로 연 화면: 같은 상속세', q.text('sumTax'), p.text('sumTax'));
  expect('인라인 onclick 없음', p.d.querySelectorAll('[onclick]').length, 0);
  console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
})();
