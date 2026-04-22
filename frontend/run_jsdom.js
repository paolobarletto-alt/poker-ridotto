import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async function(){
  try {
    const assetsDir = path.join(__dirname, 'dist', 'assets');
    const files = fs.readdirSync(assetsDir);
    const indexFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
    if (!indexFile) {
      console.error('Index bundle not found in', assetsDir);
      process.exit(2);
    }
    const indexPath = path.join(assetsDir, indexFile);
    console.log('Using bundle:', indexFile);
    const html = `<!doctype html><html><head></head><body><div id="root"></div><script src="file://${indexPath}"></script></body></html>`;
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });

    dom.window.console.log = (...args) => { console.log('PAGE LOG:', ...args); };
    dom.window.console.error = (...args) => { console.error('PAGE ERROR:', ...args); };

    dom.window.addEventListener('error', (e) => {
      console.error('PAGE ERROR EVENT:', e && (e.error || e.message));
    });

    // wait for scripts to run
    await new Promise(res => setTimeout(res, 4000));
    const root = dom.window.document.getElementById('root');
    console.log('root innerHTML length:', root ? root.innerHTML.length : 'no-root');
  } catch (e) {
    console.error('ERROR running jsdom:', e.stack || e);
    process.exit(1);
  }
})();
