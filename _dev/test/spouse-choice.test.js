const {open,expect}=require('./harness');
(async()=>{
  console.log('절세보고서 배우자 선택');
  for (const f of ['inheritGold.html','inheritFree.html','inheritPremium.html','inheritRoyal.html']){
    let p=await open(f);
    p.set('houseValue',1.5e9); p.set('otherProperty',3e8); p.set('debts',2e8); p.set('funeralExpense',1.2e7); if(p.d.getElementById('childrensNumber')) p.set('childrensNumber',2);
    // 배우자 있음(기본): 과세가액 15.9억 − 10억 = 5.9억 → 30%−6천만 = 1.17억 → ×0.97 = 113,490,000
    p.w.REPORT.calculateInheritanceTax();
    expect(f+' 배우자 있음 → 납부', p.num('payableTaxValueCell'), 113490000);
    expect(f+' 기본공제 표시', p.num('inheritanceDeduction'), 1e9);
    // 배우자 없음: 공제 5억 → 과표 10.9억 → 40% − 1.6억 = 2.76억 → ×0.97 = 267,720,000
    p.radio('hasSpouse','no');
    expect(f+' 배우자 없음 → 납부', p.num('payableTaxValueCell'), 267720000);
    expect(f+' 기본공제 5억', p.num('inheritanceDeduction'), 5e8);
    if (p.d.getElementById('btnSpouse')){ p.click('#btnSpouse'); expect(f+' 배우자공제 0', p.num('spouseInheritanceDeductionCell'), 0); }
    // 저장 → 다시 열어 불러오기 → 선택 유지
    const saved=p.w.DH.collect(); expect(f+' 저장 대상에 포함', saved.hasSpouse==='no'?1:0, 1);
    p.radio('hasSpouse','yes'); expect(f+' 다시 있음 → 납부', p.num('payableTaxValueCell'), 113490000);
    if (p.errors.length) { console.log('  JS errors', p.errors); process.exitCode=1; }
  }
})();
