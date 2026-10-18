/* ============================================================
   상속세 절세 보고서 등급표 (report-tiers.js)
   - 브라우저: window.REPORT_TIERS, 현재 페이지 등급은 body[data-tier]
   - 빌드(_dev/report/build.mjs)도 이 표를 읽어 제목·설명을 넣는다.
   - 어떤 블록이 어느 등급에 들어가는지는 템플릿의 data-tier 속성이 결정하고,
     여기에는 JS 가 알아야 할 동작 차이만 적는다.
   ============================================================ */
(function (root) {
  'use strict';
  var TIERS = {
    free: {
      key: 'free', file: 'inheritFree.html', label: '1단계 · 무료',
      title: '상속세 간단 계산',
      desc: '상속재산·채무·사전증여를 넣으면 예상 상속세가 나옵니다. 절세 방법은 「계산 후 셀프 절세」에서 이어집니다.',
      paidSteps: false, qaMode: 'none', next: 'gold'
    },
    gold: {
      key: 'gold', file: 'inheritGold.html', label: '2단계 · 무료',
      title: '계산 후 셀프 절세',
      desc: '예상 상속세와 함께 배우자·동거주택·금융재산 공제, 취득세·종부세·양도세·청약·기초연금 절세 방법을 직접 계산합니다.',
      paidSteps: true, qaMode: 'none', next: 'royal'
    },
    royal: {
      key: 'royal', file: 'inheritRoyal.html', label: '3단계 · 33만원(부가세 포함)',
      title: '계산 후 세무사 문의',
      desc: '입력한 내용과 질문을 보내면 담당 세무사가 서면 답변서와 전화 상담으로 답합니다.',
      paidSteps: true, qaMode: 'consult', fee: 330000
    },
    goldAnswer: {
      key: 'goldAnswer', file: 'inheritGoldAnswer.html', label: '답변서 (사무실용)',
      title: '세무사 문의 답변서',
      desc: '고객이 보낸 질문에 세무사가 답변을 달아 인쇄하는 답변서입니다.',
      paidSteps: true, qaMode: 'answer'
    },
    premium: {                                   // 옛 주소 → 2단계로 자동 이동 (링크 호환용)
      key: 'premium', file: 'inheritPremium.html', redirect: 'inheritGold.html', label: '', title: '계산 후 셀프 절세', desc: '', paidSteps: true, qaMode: 'none'
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TIERS;
  else root.REPORT_TIERS = TIERS;
})(typeof window !== 'undefined' ? window : this);
