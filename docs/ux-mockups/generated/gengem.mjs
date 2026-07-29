// Genera una imagen en Gemini web (cuenta ya logueada) y la descarga.
// Uso: node gengem.mjs <promptfile.txt> <salida.png> [timeoutMin]
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const [promptFile, outPath, timeoutMin = '4'] = process.argv.slice(2);
const prompt = readFileSync(promptFile, 'utf8').replace(/\s+/g, ' ').trim();

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('gemini.google')) || (await ctx.newPage());

try {
  // Chat nuevo para cada generación
  await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // nº de imágenes grandes ya presentes (para detectar la nueva)
  const bigImgs = () => page.evaluate(() =>
    [...document.querySelectorAll('img')].filter(i => i.naturalWidth >= 500 && i.naturalHeight >= 300).length
  );
  const before = await bigImgs();

  // Foco en el editor y envío
  const editor = page.locator('div.ql-editor[contenteditable="true"], div[contenteditable="true"][role="textbox"]').first();
  await editor.click({ timeout: 15000 });
  await page.keyboard.insertText(prompt);
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  console.log('Prompt enviado, esperando imagen...');

  const deadline = Date.now() + Number(timeoutMin) * 60000;
  let dataUrl = null;
  while (Date.now() < deadline) {
    await page.waitForTimeout(6000);
    dataUrl = await page.evaluate(async (beforeCount) => {
      const imgs = [...document.querySelectorAll('img')].filter(i => i.naturalWidth >= 500 && i.naturalHeight >= 300);
      if (imgs.length <= beforeCount) return null;
      const img = imgs[imgs.length - 1];
      try {
        const res = await fetch(img.src, { credentials: 'include' });
        const blob = await res.blob();
        return await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
      } catch (e) {
        // fallback: canvas
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        try { return c.toDataURL('image/png'); } catch { return null; }
      }
    }, before);
    if (dataUrl && dataUrl.length > 100000) break; // >~75KB reales
    dataUrl = null;
  }

  if (!dataUrl) {
    await page.screenshot({ path: 'shot.png' });
    const txt = await page.evaluate(() => document.body.innerText.slice(-600));
    console.error('SIN IMAGEN. Último texto de la página:\n' + txt);
    process.exit(1);
  }
  const b64 = dataUrl.split(',')[1];
  writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log(`OK ${outPath} (${Math.round(b64.length * 0.75 / 1024)} KB)`);
} finally {
  await browser.close();
}
