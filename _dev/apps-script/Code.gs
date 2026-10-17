/**
 * 대한세무법인 접수 스크립트 — 「체납 자가진단 접수명단」 스프레드시트에 연결
 *
 *  · 체납 자가진단(daehantax.com/check)  →  탭 「접수명단」      (기존 그대로)
 *  · 상속·증여 랜딩(daehantax.github.io/inherit)  →  탭 「상속 접수」 (추가)
 *
 * 적용 방법: 구글 시트 > 확장 프로그램 > Apps Script > 이 코드로 전체 교체 > 저장 >
 *            배포 > 배포 관리 > 연필(수정) > 버전 "새 버전" > 배포.  (웹 앱 주소는 그대로 유지됨)
 */
const SHEET_NAME = '접수명단';
const INHERIT_SHEET = '상속 접수';
const NOTIFY_EMAIL = '';   // 접수 알림 메일 주소 (비워두면 안 보냄). 예: 'sjlee@taxdh.net'

const HEADERS = ['접수일시', '이름', '휴대폰', '체납세목', '체납총액',
                 '최초체납연도', '사업상태', '현재상황', '판정유형', '유입경로', '연락여부'];
const INHERIT_HEADERS = ['접수일시', '이름', '휴대폰', '페이지', '계산 요약', '유입경로', '연락여부', '메모'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const s = v => String(v == null ? '' : v).slice(0, 500).replace(/^[=+\-@]/, "'$&"); // 수식 주입 방지
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (d.form === 'inherit') {                       // ── 상속·증여 랜딩 접수
      let sh = ss.getSheetByName(INHERIT_SHEET);
      if (!sh) {
        sh = ss.insertSheet(INHERIT_SHEET);
        sh.appendRow(INHERIT_HEADERS);
        sh.getRange(1, 1, 1, INHERIT_HEADERS.length).setFontWeight('bold').setBackground('#f8eded');
        sh.setFrozenRows(1);
        sh.setColumnWidths(1, 1, 150); sh.setColumnWidth(3, 120); sh.setColumnWidth(4, 180); sh.setColumnWidth(5, 420);
      }
      sh.appendRow([new Date(), s(d.name), "'" + s(d.phone), s(d.page), s(d.summary), s(d.source), '', '']);
      if (NOTIFY_EMAIL) {
        MailApp.sendEmail(NOTIFY_EMAIL, '[상속 상담] 신규 접수 - ' + s(d.name),
          '이름: ' + s(d.name) + '\n휴대폰: ' + s(d.phone) + '\n페이지: ' + s(d.page) +
          '\n계산 요약: ' + s(d.summary) + '\n유입: ' + s(d.source));
      }
      return ContentService.createTextOutput('OK');
    }

    // ── 체납 자가진단 접수 (기존)
    let sh = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f3e5ea');
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date(), s(d.name), "'" + s(d.phone), s(d.tax), s(d.amount), s(d.year),
                  s(d.biz), s(d.status), s(d.result), s(d.source), '']);
    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, '[체납진단] 신규 접수 - ' + s(d.name),
        '이름: ' + s(d.name) + '\n휴대폰: ' + s(d.phone) + '\n판정: ' + s(d.result) +
        '\n상황: ' + s(d.status) + '\n총액: ' + s(d.amount) + '\n유입: ' + s(d.source));
    }
    return ContentService.createTextOutput('OK');
  } catch (err) {
    return ContentService.createTextOutput('ERROR: ' + err);
  } finally {
    lock.releaseLock();
  }
}

/** 편집기에서 한 번 실행 — 「상속 접수」 탭 생성 확인용 */
function testInherit() {
  doPost({ postData: { contents: JSON.stringify({
    form: 'inherit', name: '테스트', phone: '010-0000-0000', page: '단순한 상속세 계산기',
    summary: '예상 상속세 86,330,000원 (과세가액 10억, 공제 5억, 배우자 없음, 자녀 1명)', source: 'inherit/cal_Inherit_simple.html'
  }) } });
}
