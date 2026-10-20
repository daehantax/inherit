// 세무사 검토표 → 답변서: 엔진(RV) · 검토 화면(review.html) · 답변서 화면(answer.html)
const { open, expect } = require('./harness');
global.EC = require('../../js/estate-calc.js'); const EST = require('../../js/estate.js'); const FIL = require('../../js/filing.js'); global.SAVINGS = require('../../js/savings.js');
const RV = require('../../js/review-engine.js');
const H = (id, rel, x) => Object.assign({ id, rel, name: '' }, x);
const E = EST.normalize({ v: 1, deceased: { date: '2026-08-14' }, heirs: [H('s', 'spouse', { age: 72, houses: 0 }), H('c1', 'child', { age: 45, houses: 0, livedYears: 12 }), H('c2', 'child', { age: 41, houses: 1, ownGongsi: 5e8 }), H('g1', 'grandchild', { age: 20 })],
  assets: [{ id: 'a1', type: 'apt', name: '분당 아파트', value: 1.5e9, gongsi: 1.0e9, lived: true, sellPlan: 'y3', sellPrice: 1.6e9 }, { id: 'a2', type: 'land', name: '이천 땅', value: 4e8, gongsi: 2e8 }, { id: 'fin_deposit', type: 'deposit', value: 3e8 }],
  debts: { loan: 2e8, tax: 3e6 }, funeral: { cost: 8e6, grave: 3e6 }, gifts: [{ id: 'g', to: 'c1', year: 2022, value: 1e8, taxBase: 5e7, taxPaid: 5e6 }], priors: [], misc: {}, opened: ['T02', 'T06'], meta: {},
  filing: { deceased: { name: '홍길동', road: '성남시 분당구' }, filer: { heirId: 'c1' }, heirs: { c1: { name: '홍자녀' } }, assets: {}, fin: { deposit: [{ id: 'd1', bankCode: '004', value: 3e8 }], stock: [], insurance: [], retire: [], car: [], other: [] }, debts: [], charges: [], funeral: [] } });
(async () => {
  console.log('[1] 엔진');
  const M = RV.build(E, { no: 'F-20261021-01', customer: { name: '홍자녀', email: 'kid@example.com', question: '어머니 몫을 얼마로?' } });
  const all = EC.calcAll(E);
  expect('상속세 = 엔진', M.tax.payable, all.inheritance.payable);
  expect('상속인별 표 4명', M.tax.heirRows.length, 4);
  expect('상속세 내역 줄: 배우자·동거주택·금융·증여세액공제 포함', ['배우자 공제', '동거주택 공제', '금융재산 공제', '증여세액공제'].every(k => M.tax.inhKv.some(x => x.k.indexOf(k) >= 0)) ? 1 : 0, 1);
  expect('취득세 행(아파트·땅 × 상속인)', M.tax.acqRows.length, all.heirs.reduce((s, h) => s + all.acquisition[h.id].rows.length, 0));
  expect('재산세·종부세 10년 행', M.tax.holdRows.length > 0 && M.tax.holdRows[0].years.length === 10 ? 1 : 0, 1);
  expect('양도세 행(아파트 매도 계획)', M.tax.trRows.length > 0 ? 1 : 0, 1);
  expect('청약 판정: 배우자 지분→유주택, 자녀2 다주택', M.housing.find(h => h.id === 's').status + '/' + M.housing.find(h => h.id === 'c2').status, 'share/multi');
  expect('절세 포인트·확인 사항 있음', (M.savings.save.length + M.savings.check.length) > 0 ? 1 : 0, 1);
  expect('날짜 7개 안팎', M.dates.length >= 5 ? 1 : 0, 1);
  expect('열어 본 티칭 포인트', /T02/.test(M.opened[0]) ? 1 : 0, 1);   // 브라우저에서는 제목까지 붙음
  expect('신고서 채우기 요약·비운 칸', M.filing.fin + '/' + (M.filingMissing.length > 0 ? 1 : 0), '1/1');
  const S = RV.sections(M);
  expect('항목 11개', S.length, 11);
  expect('입력 항목에 사전증여·단기재상속·나누기 표시', /사전증여/.test(S[0].html) && /법정/.test(S[0].html) ? 1 : 0, 1);
  expect('양도세 항목에 1세대1주택·중과 열', /1세대1주택/.test(S.find(s => s.id === 'transfer').html) ? 1 : 0, 1);
  const A = RV.answerDraft(M, { items: { inheritance: { verdict: 'check', note: '배우자 등기 확인' } }, agent: '이석제' });
  expect('답변서 7개 문단 + 의견 반영', A.sections.length + '/' + (/서류 확인이 필요합니다/.test(A.sections[0].text) && /배우자 등기 확인/.test(A.sections[0].text) ? 1 : 0), '7/1');
  expect('답변서에 청약 판정 문장', /무주택|유주택/.test(A.sections[2].text) ? 1 : 0, 1);

  console.log('[2] 검토 화면 (링크로 열기)');
  const p = await open('review.html', { hash: '#e=' + EST.encode(E) });
  if (p.errors.length) { console.log('JS errors', p.errors); process.exitCode = 1; }
  expect('본문 열림', p.el('rvBody').hidden ? 0 : 1, 1);
  expect('항목 11개 그려짐', p.d.querySelectorAll('.rv-sec').length, 11);
  expect('답변서 문단 입력칸', p.d.querySelectorAll('[data-a^="sections."]').length, 14);
  p.d.querySelector('input[name="v_inheritance"][value="fix"]').click();
  p.d.querySelector('[data-note="inheritance"]').value = '배우자 몫을 30억 한도로'; p.d.querySelector('[data-note="inheritance"]').dispatchEvent(new p.w.Event('input', { bubbles: true }));
  const R = p.w.REVIEW_UI.collect();
  expect('판단·의견 수집', R.items.inheritance.verdict + '/' + R.items.inheritance.note, 'fix/배우자 몫을 30억 한도로');
  p.w.confirm = () => true; p.click('#rvDraft');
  expect('초안 다시 만들기에 의견 반영', /배우자 몫을 30억 한도로/.test(p.d.querySelector('[data-a="sections.0.text"]').value) ? 1 : 0, 1);
  p.set('rvAgent', 'k');
  expect('접수번호 없으면 시트 저장 막힘(안내)', (p.click('#rvSave'), /접수번호/.test(p.text('rvStatus')) ? 1 : 0), 1);
  // 시트 불러오기 (가짜 서버)
  p.w.fetch = async (url, opt) => {
    if (/\?load=/.test(url)) return { json: async () => ({ ok: true, no: 'F-20261021-01', file: { name: '홍자녀', phone: '010', email: 'kid@example.com', question: '질문', product: '세무사 검토', link: 'https://x/result.html#e=' + EST.encode(E) }, review: null, answer: null, status: '', answerLink: 'https://x/answer.html?no=F-20261021-01&t=ABC' }) };
    const body = JSON.parse(opt.body); return { json: async () => ({ ok: true, no: body.no, link: 'https://x/answer.html?no=' + body.no + '&t=ABC', status: body.action === 'send' ? '답변 발송' : '검토 중' }) };
  };
  p.set('rvNo', 'F-20261021-01'); p.set('rvAgent', 'k'); p.click('#rvLoad');
  await new Promise(r => setTimeout(r, 50));
  expect('시트에서 불러와 고객 정보 채움', p.d.querySelector('[data-m="name"]').value + '/' + p.d.querySelector('[data-m="question"]').value, '홍자녀/질문');
  p.click('#rvSave'); await new Promise(r => setTimeout(r, 50));
  expect('시트 저장 → 링크 표시', /answer.html\?no=F-20261021-01/.test(p.el('rvAnswerLink').textContent) ? 1 : 0, 1);
  p.click('#rvSend'); await new Promise(r => setTimeout(r, 50));
  expect('보내기 → 안내', /보냈습니다/.test(p.text('rvStatus')) ? 1 : 0, 1);

  console.log('[3] 답변서 화면');
  const q2 = await open('answer.html?no=F-20261021-01&t=ABC');
  q2.w.fetch = async () => ({ json: async () => ({ ok: true, answer: A, sent: '2026-10-21 09:00', updated: '2026-10-21 09:00' }) });
  q2.w.ANSWER_UI.reload(); await new Promise(r => setTimeout(r, 80));
  const txt = q2.el('anSheet').textContent;
  expect('답변서 본문: 제목·문단·전제', q2.el('anSheet').hidden ? 0 : (/상속세 검토 답변서/.test(txt) && /청약/.test(txt) && /이 답변의 전제/.test(txt) ? 1 : 0), 1);
  const bad = await open('answer.html');
  expect('주소 없으면 안내', bad.el('anEmpty').hidden ? 0 : 1, 1);
  console.log(process.exitCode ? '\n실패 있음' : '\n모두 통과');
})();
