import { JSDOM } from 'jsdom';

(async function(){
  try {
    const url = 'http://localhost:5173/profile';
    console.log('Loading URL', url);
    const dom = await JSDOM.fromURL(url, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });
    dom.window.console.log = (...args) => { console.log('PAGE LOG:', ...args); };
    dom.window.console.error = (...args) => { console.error('PAGE ERROR:', ...args); };
    dom.window.addEventListener('error', (e) => console.error('PAGE ERROR EVENT:', e && (e.error || e.message)));
    await new Promise(res => setTimeout(res, 4000));
    const root = dom.window.document.getElementById('root');
    console.log('root innerHTML length:', root ? root.innerHTML.length : 'no-root');
  } catch (e) {
    console.error('ERROR running jsdom dev:', e && (e.stack || e));
    process.exit(1);
  }
})();
