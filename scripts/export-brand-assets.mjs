import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const output = fileURLToPath(new URL("../public/brand/", import.meta.url));
await mkdir(output, { recursive: true });

// This reproduces the CSS lockup used by the landing-page logo at export size.
const base = `
  *{box-sizing:border-box}
  html,body{margin:0;width:100%;height:100%}
  body{font-family:Manrope,Arial,sans-serif;color:#203a32}
  .mark{display:inline-flex;align-items:center;justify-content:center;flex:none;
    background:#1d5542;color:#fbf9ed;font-family:Manrope,Arial,sans-serif;
    font-weight:800;line-height:1}
  .mark span{color:#c8dca6}
  .name{font-weight:800;letter-spacing:-.055em;line-height:1}
  .name span{font-weight:500}
  .byline{font-weight:700;letter-spacing:.02em;color:#678372}
`;
const mark = `<div class="mark" aria-hidden="true">k<span>k</span></div>`;
const name = `<div class="name">Kuliner<span>Kit</span></div>`;
const byline = `<div class="byline">by LRMobileID</div>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>${base}
    body{background:#f8f8f2;display:flex;align-items:center;justify-content:center}
    .profile{display:flex;align-items:center;flex-direction:column;margin-top:-20px}
    .mark{width:410px;height:410px;border-radius:111px;font-size:299px;letter-spacing:-66px;padding-right:66px}
    .name{font-size:91px;margin-top:65px}
    .byline{font-size:36px;margin-top:20px}
  </style><div class="profile">${mark}${name}${byline}</div>`);
  await page.screenshot({ path: `${output}kulinerkit-profil-1080.png` });

  await page.setContent(`<style>${base}
    body{background:#f8f8f2;display:grid;place-items:center}
    .mark{width:660px;height:660px;border-radius:178px;font-size:482px;letter-spacing:-107px;padding-right:107px}
  </style>${mark}`);
  await page.screenshot({ path: `${output}kulinerkit-ikon-1080.png` });

  await page.setViewportSize({ width: 1600, height: 460 });
  await page.setContent(`<style>${base}
    body{background:transparent;display:flex;align-items:center;padding:52px;gap:46px}
    .mark{width:340px;height:340px;border-radius:92px;font-size:248px;letter-spacing:-55px;padding-right:55px}
    .lockup{display:flex;flex-direction:column}
    .name{font-size:135px}
    .byline{font-size:49px;margin-top:25px}
  </style>${mark}<div class="lockup">${name}${byline}</div>`);
  await page.screenshot({ path: `${output}kulinerkit-logo-transparan.png`, omitBackground: true });
} finally {
  await browser.close();
}
