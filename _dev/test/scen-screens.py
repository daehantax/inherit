import asyncio, os
from playwright.async_api import async_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        pg=await b.new_page(viewport={'width':1280,'height':900}); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+ROOT+'/_scen-local.html?s=3', wait_until='load'); await pg.wait_for_timeout(500)
        sel=await pg.eval_on_selector('#scenario','e=>e.value'); print('selected',sel)
        await pg.click('#runBtn'); await pg.wait_for_timeout(800)
        print('status:',await pg.inner_text('#status'))
        await pg.screenshot(path=ROOT+'/_dev/print/screen/scenarios.png', full_page=True)
        html=await pg.eval_on_selector('#report','f=>f.srcdoc'); open(ROOT+'/_dev/print/screen/scen-report.html','w').write(html)
        print('errors',errs)
        await b.close()
asyncio.run(main())
