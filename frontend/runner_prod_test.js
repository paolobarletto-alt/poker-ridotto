const { JSDOM } = require('jsdom');
const fs = require('fs');
(async () => {
  try {
    const bundlePath = process.argv[2];
    if (!bundlePath) { console.error('No bundle path provided'); process.exit(2); }
    console.log('Using bundle:', bundlePath);
    const html = `<!doctype html><html><head></head><body><div id="root"></div><script src="file://${bundlePath}"></script></body></html>`;
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost/' });

    dom.window.console.log = (...args) => { console.log('PAGE LOG:', ...args); };
    dom.window.console.error = (...args) => { console.error('PAGE ERROR:', ...args); };

    dom.window.addEventListener('error', (e) => {
      try {
        console.error('PAGE ERROR EVENT:', e && (e.error || e.message));
        if (e && e.error && e.error.stack) console.error('STACK:', e.error.stack);
      } catch (err) { console.error('Error logging PAGE error event:', err); }
    });

    // wait for scripts to run
    await new Promise(res => setTimeout(res, 4000));
    const root = dom.window.document.getElementById('root');
    console.log('root innerHTML length:', root ? root.innerHTML.length : 'no-root');
  } catch (e) {
    console.error('ERROR running jsdom:', e && (e.stack || e));
    process.exit(1);
  }
})();
