# 상속·증여 도구 (대한세무법인)

https://daehantax.github.io/inherit/

## 구성
- `index.html` 상속세 랜딩 · `gift.html` 상황별 증여세 랜딩 (계산은 property 레포)
- 계산기: `cal_Inherit_simple` `상속공제` `채무공과금` `inheritance-deduction-limit` `adquisitionTaxClaim` `상속으로인한재산세`
- 서식: `inherit-tax-report`(신고서 5단계) `상속세과세표준 자진납부` `spose-inherit-deduction` `finantial-asset-deduction` `co-habitation-deduction` `납부서`
- 절세보고서 5종: `_dev/report/template.html` 을 고치고 `node _dev/report/build.mjs` 로 생성 (직접 수정 금지)
- 공통: `css/dh.css` `js/dh.js` (디자인·세법 상수 `DH.RULES`) · 규칙 `_dev/PAGE-GUIDE.md`

## 검사
```
cd _dev/test && npm i && for t in *.test.js; do node $t; done
```

## 세법 기준
2026년 10월 시행 상속세 및 증여세법. 공제·세율 개편 시 `js/dh.js` 의 `DH.RULES` 와 `js/report-engine.js` 상수를 수정.
