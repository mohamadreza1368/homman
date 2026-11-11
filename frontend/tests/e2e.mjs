import { spawn } from 'child_process';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = process.env.HOMMAN_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = process.env.HOMMAN_SCREENSHOT_DIR || path.join(__dirname, 'artifacts');

function findChromeBinary() {
  const candidates = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        const text = msg.params.args.map((a) => a.value || a.description).join(' ');
        this.consoleErrors.push(text);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.consoleErrors.push(msg.params.exceptionDetails?.text || 'Uncaught exception');
      }
    };
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJson(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async waitFor(fnExpr, timeoutMs = 45000, label = 'condition') {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ok = await this.evalJson(`Boolean(${fnExpr})`);
      if (ok) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
  }

  async screenshot(name) {
    if (!SCREENSHOT_DIR) return;
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SCREENSHOT_DIR, `${name}.png`);
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log(`[E2E] Saved screenshot: ${outPath}`);
  }

  close() {
    this.ws.close();
  }
}

async function runE2E() {
  const chromeBin = findChromeBinary();
  if (!chromeBin) {
    console.error('[E2E] No Chrome/Chromium/Edge binary found.');
    process.exit(1);
  }

  const port = 9245;
  const userDir = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'homman-e2e-'));
  const chrome = spawn(
    chromeBin,
    [
      '--headless=new',
      '--disable-gpu-sandbox',
      '--enable-webgl',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      '--window-size=1280,840',
      'about:blank',
    ],
    { stdio: 'pipe' }
  );

  try {
    // Poll DevTools HTTP endpoint
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        const page = list.find((t) => t.type === 'page') || list[0];
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(wsUrl, 'Failed connecting to Chrome DevTools WebSocket');

    const cdp = new CdpClient(wsUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: APP_URL });

    // 1. Disclaimer gate must appear before acceptance
    await cdp.waitFor(
      `document.querySelector('[data-testid="accept-disclaimer-btn"]') !== null`,
      15000,
      'Disclaimer Modal'
    );
    await cdp.screenshot('e2e_1_disclaimer');

    await cdp.evalJson(`document.querySelector('[data-testid="accept-disclaimer-btn"]').click()`);
    const storedDisclaimer = await cdp.evalJson(
      `localStorage.getItem('homman_educational_disclaimer_v1')`
    );
    assert.ok(storedDisclaimer && storedDisclaimer.includes('"accepted":true'), 'Disclaimer must persist in localStorage');
    console.log('[E2E] Step 1 passed: Disclaimer gate accepted & persisted');

    // 2. Wait for 3D Atlas to finish loading & confirm non-zero WebGL geometry
    await cdp.waitFor(
      `window.__viewer && (window.__viewer.atlasLoader?.isLoaded || window.__viewer.zAnatomyLoader?.isLoaded)`,
      45000,
      '3D Atlas completion'
    );

    // Give Three.js 2 frames to render full scene
    await new Promise((r) => setTimeout(r, 600));
    const perf = await cdp.evalJson(`window.__viewer.getPerformanceSnapshot()`);
    console.log('[E2E] Step 2 Render Snapshot:', perf);
    assert.ok(
      perf.meshCount > 0 || perf.triangles > 0,
      `Expected rendered meshes/triangles > 0, got ${JSON.stringify(perf)}`
    );
    await cdp.screenshot('e2e_2_body_loaded');

    // 3. Deterministic search -> select Heart (FMA7088) -> Details Card
    await cdp.evalJson(`
      (() => {
        const input = document.querySelector('[data-testid="anatomy-search-input"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Heart');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await cdp.waitFor(
      `document.querySelector('[data-testid="search-result-FMA7088"]') !== null`,
      5000,
      'Heart search result dropdown'
    );
    await cdp.evalJson(`document.querySelector('[data-testid="search-result-FMA7088"]').click()`);

    await cdp.waitFor(
      `document.querySelector('[data-testid="structure-fma-id"]')?.textContent?.trim() === 'FMA7088'`,
      5000,
      'StructureDetailsCard displaying FMA7088'
    );
    console.log('[E2E] Step 3 passed: Search -> Canonical FMA7088 selection');

    // 4. Open Pathology Educational Drawer & activate Conceptual Visual Preset
    await cdp.evalJson(`document.querySelector('[data-testid="open-pathology-btn"]').click()`);
    await cdp.waitFor(
      `document.querySelector('[data-testid="pathology-drawer"]') !== null`,
      5000,
      'PathologyDrawer open'
    );
    const bannerText = await cdp.evalJson(
      `document.querySelector('[data-testid="educational-warning-banner"]')?.textContent`
    );
    assert.ok(bannerText && bannerText.includes('نمایش مفهومی'), 'Educational warning banner missing');

    await cdp.waitFor(
      `document.querySelector('[data-testid="disorder-item-22298006"]') !== null`,
      5000,
      'Heart disorder list item'
    );
    await cdp.evalJson(`document.querySelector('[data-testid="disorder-item-22298006"]').click()`);
    await cdp.waitFor(
      `document.querySelector('[data-testid="educational-preset-details"]') !== null`,
      5000,
      'Educational preset details active'
    );
    await new Promise((r) => setTimeout(r, 300));
    await cdp.screenshot('e2e_3_heart_pathology');
    console.log('[E2E] Step 4 passed: Educational Pathology Drawer + visual preset');

    // 5. Isolate Heart & Exit Isolation
    await cdp.evalJson(`document.querySelector('[data-testid="drawer-isolate-btn"]').click()`);
    const isolatedState = await cdp.evalJson(
      `Boolean(window.__viewer.atlasLoader.isIsolated || window.__viewer.zAnatomyLoader.isIsolated)`
    );
    assert.equal(isolatedState, true, 'Isolation should be active');
    await new Promise((r) => setTimeout(r, 300));
    await cdp.screenshot('e2e_4_heart_isolated');

    await cdp.evalJson(`document.querySelector('[data-testid="drawer-isolate-btn"]').click()`);
    const restoredState = await cdp.evalJson(
      `Boolean(window.__viewer.atlasLoader.isIsolated || window.__viewer.zAnatomyLoader.isIsolated)`
    );
    assert.equal(restoredState, false, 'Isolation should clear cleanly');
    console.log('[E2E] Step 5 passed: Isolation & exit isolation verified');

    assert.equal(
      cdp.consoleErrors.length,
      0,
      `Console errors detected during E2E run: ${cdp.consoleErrors.join('; ')}`
    );

    cdp.close();
    console.log('[E2E ALL TESTS PASSED CLEANLY]');
  } finally {
    chrome.kill('SIGKILL');
    try {
      fs.rmSync(userDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup lock on Windows
    }
  }
}

runE2E().catch((err) => {
  console.error('[E2E FAILED]', err);
  process.exit(1);
});
