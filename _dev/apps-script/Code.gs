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
const INHERIT_HEADERS = ['접수일시', '이름', '휴대폰', '페이지', '계산 요약', '유입경로', '연락여부', '메모', '다시 보기'];

/* ── 「계산 후 세무사 문의」(33만원) 접수 ──────────────────────────────── */
const ROYAL_SHEET = '상속 문의';
const ROYAL_TO = 'sjlee@taxdh.net';          // 문의 메일을 받을 주소 (쉼표로 여러 명 가능)
const ROYAL_FEE = '33만원(부가세 포함)';
const ROYAL_HEADERS = ['접수번호', '접수일시', '이름', '휴대폰', '이메일', '답변방식', '통화가능시간', '예상상속세', '배우자', '질문', '계산요약', '보고서 열기', '상태', '입금확인', '메모', '입력값JSON'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const s = v => String(v == null ? '' : v).slice(0, 500).replace(/^[=+\-@]/, "'$&"); // 수식 주입 방지
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (d.form === 'inherit-royal') return royalIntake(ss, d);   // ── 계산 후 세무사 문의 (33만원)

    if (d.form === 'inherit') {                       // ── 상속·증여 랜딩 접수
      let sh = ss.getSheetByName(INHERIT_SHEET);
      if (!sh) {
        sh = ss.insertSheet(INHERIT_SHEET);
        sh.appendRow(INHERIT_HEADERS);
        sh.getRange(1, 1, 1, INHERIT_HEADERS.length).setFontWeight('bold').setBackground('#f8eded');
        sh.setFrozenRows(1);
        sh.setColumnWidths(1, 1, 150); sh.setColumnWidth(3, 120); sh.setColumnWidth(4, 180); sh.setColumnWidth(5, 420);
      }
      if (sh.getRange(1, 9).getValue() === '') sh.getRange(1, 9).setValue('다시 보기').setFontWeight('bold').setBackground('#f8eded');
      const link = String(d.link || '').replace(/"/g, '');
      sh.appendRow([new Date(), s(d.name), "'" + s(d.phone), s(d.page), s(d.summary), s(d.source), '', '',
                    link ? '=HYPERLINK("' + link + '";"입력 내용 보기")' : '']);
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

/** 「계산 후 세무사 문의」 접수: 시트 한 줄 + 세무사 메일 + 고객 확인 메일, 접수번호를 돌려준다 */
function royalIntake(ss, d) {
  const long = v => String(v == null ? '' : v).slice(0, 45000).replace(/^[=+\-@]/, "'$&");
  const s = v => String(v == null ? '' : v).slice(0, 500).replace(/^[=+\-@]/, "'$&");
  let sh = ss.getSheetByName(ROYAL_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ROYAL_SHEET);
    sh.appendRow(ROYAL_HEADERS);
    sh.getRange(1, 1, 1, ROYAL_HEADERS.length).setFontWeight('bold').setBackground('#f8eded');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 130); sh.setColumnWidth(2, 140); sh.setColumnWidth(10, 420); sh.setColumnWidth(11, 420); sh.setColumnWidth(12, 160); sh.setColumnWidth(16, 80);
  }
  // 접수번호: R-YYYYMMDD-NN (그날 몇 번째인지)
  const now = new Date();
  const ymd = Utilities.formatDate(now, 'Asia/Seoul', 'yyyyMMdd');
  const last = sh.getLastRow();
  let seq = 1;
  if (last > 1) {
    const col = sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
    seq = col.filter(x => x.indexOf('R-' + ymd + '-') === 0).length + 1;
  }
  const no = 'R-' + ymd + '-' + ('0' + seq).slice(-2);
  const link = String(d.link || '');
  sh.appendRow([no, now, s(d.name), "'" + s(d.phone), s(d.email), s(d.mode), s(d.when), Number(d.payable) || 0, s(d.spouse),
                long(d.question), long(d.summary), link ? '=HYPERLINK("' + link.replace(/"/g, '') + '";"보고서 열기")' : '', '접수', '', '', long(JSON.stringify(d.data || {}))]);

  // 세무사에게: 정형 본문
  const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
  const subject = '[상속 문의 ' + no + '] ' + s(d.name) + ' · 예상 상속세 ' + won(d.payable) + ' · ' + s(d.mode);
  const body = [
    '■ 고객', '이름 ' + s(d.name) + ' / ' + s(d.phone) + ' / ' + s(d.email),
    '원하는 답변: ' + s(d.mode) + (d.when ? ' (통화 가능: ' + s(d.when) + ')' : ''),
    '접수: ' + Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') + ' / 접수번호 ' + no,
    '보고서 열기(고객 입력값·질문 그대로): ' + link, '',
    '■ 고객 질문', String(d.question || ''), '',
    '■ 계산 결과', String(d.summary || ''), '',
    '■ 입력값 전체', String(d.inputs || ''), '',
    '시트: ' + ss.getUrl() + '  탭 「' + ROYAL_SHEET + '」'
  ].join('\n');
  try { MailApp.sendEmail({ to: ROYAL_TO, subject: subject, body: body, name: '대한세무법인 상속 문의 접수', replyTo: s(d.email) || undefined }); } catch (e) { }

  // 고객에게: 접수 확인
  if (d.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email))) {
    const cbody = [
      s(d.name) + '님, 대한세무법인입니다. 세무사 문의가 접수되었습니다.', '',
      '접수번호: ' + no,
      '보내주신 질문:', String(d.question || ''), '',
      '진행 순서',
      '1. 담당 세무사가 ' + s(d.phone) + '로 전화드려 질문 범위를 확인합니다.',
      '2. 상담료 ' + ROYAL_FEE + ' 입금 계좌를 안내드립니다. 입금 전에는 비용이 발생하지 않으며, 답변서 발송 전 취소 시 전액 환불됩니다.',
      '3. 입금 확인 후 영업일 2일 안에 이 주소로 서면 답변서를 보내고 전화 상담을 진행합니다.',
      '4. 상속세 신고를 맡기시면 상담료 33만원을 수수료에서 전액 차감합니다.', '',
      '보고서 다시 열기: ' + link.replace('inheritGoldAnswer.html', 'inheritRoyal.html'), '',
      '대한세무법인 · 031-783-8877 · ' + ROYAL_TO
    ].join('\n');
    try { MailApp.sendEmail({ to: String(d.email), subject: '[대한세무법인] 세무사 문의 접수 확인 (' + no + ')', body: cbody, name: '대한세무법인', replyTo: ROYAL_TO }); } catch (e) { }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true, no: no })).setMimeType(ContentService.MimeType.JSON);
}

/** 편집기에서 한 번 실행 — 「상속 문의」 탭·메일 확인용 */
function testRoyal() {
  const out = doPost({ postData: { contents: JSON.stringify({
    form: 'inherit-royal', name: '테스트', phone: '010-0000-0000', email: ROYAL_TO, mode: '서면+전화', when: '평일 오후',
    question: '동거주택공제를 받을 수 있나요?', summary: '[입력 요약]\n예상 납부세액: 262,700,250원', inputs: '1 / 10 배우자 · 주택가격\n  주택가격: 12억', payable: 262700250, spouse: '없음',
    link: 'https://daehantax.github.io/inherit/inheritGoldAnswer.html#d=e30', data: { houseValue: '1,200,000,000' }, source: 'inherit/inheritRoyal.html', at: new Date().toISOString()
  }) } });
  Logger.log(out.getContent());
}
