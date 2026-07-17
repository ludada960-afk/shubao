import { chromium } from 'playwright';

async function main() {
  // Connect to the shared Chrome
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const pages = browser.contexts()[0].pages();

  if (pages.length === 0) {
    console.log('No pages found');
    await browser.close();
    return;
  }

  const page = pages[0];
  console.log('Current URL:', page.url());

  // Wait for page to load
  await page.waitForLoadState('networkidle').catch(() => {});

  // Get all visible text
  const text = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('--- Page content ---');
  console.log(text);

  await browser.close();
}

main().catch(e => console.error(e));
