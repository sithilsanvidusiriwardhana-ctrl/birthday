const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.goto(`file://${path.resolve(__dirname, 'index.html')}`);
  
  // Wait a bit to ensure fonts/CSS are loaded
  await new Promise(r => setTimeout(r, 1000));
  
  // Click cake to trigger the pop-up
  await page.evaluate(() => {
    document.getElementById('cake').click();
  });
  
  // Wait for the delay (0.5s) and the animation (1.2s)
  await new Promise(r => setTimeout(r, 2500));
  
  await page.screenshot({ path: path.join(__dirname, 'screenshot.png') });
  await browser.close();
  console.log("Screenshot saved!");
})();
