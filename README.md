# 상속·증여 도구 (대한세무법인)

https://daehantax.github.io/inherit/

## 구성
- `index.html` 상속세 랜딩 · `gift.html` 상황별 증여세 랜딩 (계산은 property 레포)
- 계산기: `cal_Inherit_simple` `상속공제` `채무공과금` `inheritance-deduction-limit` `adquisitionTaxClaim` `상속으로인한재산세`
- 서식: `inherit-tax-report`(신고서 5단계) `상속세과세표준 자진납부` `spose-inherit-deduction` `finantial-asset-deduction` `co-habitation-deduction` `납부서`
- 절세보고서 5종: `_dev/report/template.html` 을 고치고 `node _dev/report/build.mjs` 로 생성 (직접 수정 금지)
- 공통: `css/dh.css` `js/dh.js` (디자인·세법 상수 `DH.RULES`) · 규칙 `_dev/PAGE-GUIDE.md`

## 상속 파일 플랫폼 (2026-10 추가)
계획서: [`_dev/PLAN-v3.md`](_dev/PLAN-v3.md) (상속세 플랫폼 계획서 v3 — 여정·입력·티칭·절세·결제·신고 대행·기술·진행 상황)

한 번 입력한 내용(상속 파일)을 모든 화면이 같이 씁니다.

| 화면·파일 | 하는 일 |
| --- | --- |
| `estate.html` + `js/estate-ui.js` | 1단계 입력 (A 가족 · B 집·땅 · C 예금 · D 빚·장례비 · E 미리 준 재산 · F 나누기) |
| `result.html` + `js/result-ui.js` | 2 세금 4종 · 3 줄이기 · 4 맡기기(셀프 신고서·검토·대행) · 5 그 다음 |
| `filing.html` + `js/filing-ui.js` + `js/filing.js` | **신고서 채우기** — 셀프·검토를 고른 뒤 자산·부채를 건별로(사람·소재지·예금/주식·채무·공과금·장례비). 주민번호·계좌번호는 `dh.estate.secret.v1`(이 기기만). 건별 합계 → 1단계 금액 동기화 |
| `efile.html` + `js/efile-ui.js` + `js/efile-map.js` | 세무사용 — 접수 링크로 열어 고객 입력 미리 채움 → 비밀 칸 → 전산매체 파일 · 신고서 서식 열기 |
| `js/estate.js` | 상속 파일 모양·저장(`dh.estate.v1`)·링크(`#e=`)·**가격과 입금 계좌(EST.PRICE, EST.FIRM)**·신고서 변환(`toReturn`) |
| `js/estate-calc.js` | 계산 엔진 (상속세 + 상속인별 취득세·재산세·종부세·양도세). 화면과 무관한 순수 함수 |
| `js/savings.js` | 절세 포인트 규칙. 규칙 하나를 배열에 더하면 화면에 나타남 |
| `js/teach.js` | 티칭 포인트 24개. **영상 주소는 여기 `video:` 칸에 넣으면 ▶ 버튼이 켜짐** |
| `js/euckr.js` · `js/efile.js` | 국세청 전자신고 파일(EUC-KR 고정길이) 생성 |
| `_dev/apps-script/Code.gs` | 접수 시트 스크립트 (탭: 상속 접수 / 상속 문의 / 신고 접수) |

검증: `for f in _dev/test/*.test.js; do node $f; done` · 전체 흐름(크로미움) `python3 _dev/test/flow-e2e.py`

자주 고칠 곳
- 가격: `js/estate.js` 의 `EST.PRICE` / 입금 계좌: `EST.FIRM.bank`
- 영상: `js/teach.js` 목록의 `video`, `t`(시작 초)
- 세율·공제: `js/estate-calc.js` 맨 위 `R` 과 `js/dh.js` 의 `DH.RULES` (둘 다 고칠 것)
- 단기재상속 세액공제(§30): `EC.shortCredit`(estate-calc.js) 와 `DH.shortCredit`(dh.js) 같은 산식. 쓰는 곳: 새 엔진·단순 계산기·20단계 보고서(_dev/report/template.html 8단계)·신고서 ㉜(도우미 「계산하기」)·전자신고 03레코드 18번

## 검사
```
cd _dev/test && npm i && for t in *.test.js; do node $t; done
```

## 세법 기준
2026년 10월 시행 상속세 및 증여세법. 공제·세율 개편 시 `js/dh.js` 의 `DH.RULES` 와 `js/report-engine.js` 상수를 수정.
