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
      key: 'free', file: 'inheritFree.html', label: '프리',
      title: '상속세 절세 보고서',
      desc: '상속재산·채무·사전증여를 넣으면 예상 상속세를 계산합니다. 절세 방법은 프리미엄·골드·로얄 보고서에서 확인하세요.',
      paidSteps: false,          // 13~19단계(절세 방법) 포함 여부
      qaMode: 'none'             // 'none' | 'question' | 'answer' | 'consult'
    },
    premium: {
      key: 'premium', file: 'inheritPremium.html', label: '프리미엄 (P)',
      title: '상속세 절세 보고서 (P)',
      desc: '예상 상속세와 함께 배우자·동거주택·금융재산 공제, 취득세·종부세·양도세·청약·기초연금 절세 방법을 직접 계산합니다.',
      paidSteps: true, qaMode: 'none'
    },
    gold: {
      key: 'gold', file: 'inheritGold.html', label: '골드 (G) · 서면상담',
      title: '상속세 절세 보고서 (G)',
      desc: '절세 보고서에 질문을 적어 이메일로 보내면 세무사가 서면으로 답변합니다.',
      paidSteps: true, qaMode: 'question'
    },
    goldAnswer: {
      key: 'goldAnswer', file: 'inheritGoldAnswer.html', label: '골드 (G) · 답변서',
      title: '상속세 절세 보고서 (G) 답변서',
      desc: '골드 보고서의 고객 질문에 세무사가 답변을 달아 인쇄하는 답변서입니다.',
      paidSteps: true, qaMode: 'answer'
    },
    royal: {
      key: 'royal', file: 'inheritRoyal.html', label: '로얄 (R) · 대면상담',
      title: '상속세 절세 보고서 (R)',
      desc: '절세 보고서를 바탕으로 여러 세무사·전문가가 대면으로 심층 상담합니다. 대면상담을 신청하세요.',
      paidSteps: true, qaMode: 'consult'
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TIERS;
  else root.REPORT_TIERS = TIERS;
})(typeof window !== 'undefined' ? window : this);
