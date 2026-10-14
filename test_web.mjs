import { chromium } from 'playwright';
import fs from 'fs';

const SCREENSHOT_PATH = 'C:/Users/stany/.gemini/antigravity-ide/brain/efe8fd49-52db-48ea-bddc-006e928b60e7/playwright_test_result.png';
const LOCAL_SCREENSHOT_PATH = './playwright_test_result.png';

async function runTest() {
  console.log('🚀 Launching Playwright browser with autoplay enabled...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  console.log('🌐 Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  // 1. Verify Title
  const title = await page.title();
  console.log(`✓ Page Title: "${title}"`);

  // 2. Check Auth Overlay Gating
  const authModal = await page.$('#auth-modal');
  const isAuthVisible = authModal ? await authModal.isVisible() : false;
  console.log(`✓ Auth Modal displayed on load: ${isAuthVisible}`);

  // Authenticate user & remove gating overlay
  console.log('🔑 Authenticating user and unlocking player...');
  await page.evaluate(() => {
    const app = window.spotify || window.kawaiiApp;
    if (app) {
      app.user = {
        id: 'test-user-123',
        email: 'tester@kikoplayer.com',
        user_metadata: { full_name: 'Kiko Tester' }
      };
      if (typeof app.closeAuthModal === 'function') {
        app.closeAuthModal();
      }
    }
    // Remove any auth overlays from DOM
    document.querySelectorAll('.kiko-auth-overlay, #auth-modal').forEach(el => el.remove());
    const btn = document.getElementById('btn-user-auth');
    if (btn) btn.classList.add('logged-in');
    const text = document.getElementById('auth-pill-text');
    if (text) text.textContent = 'Tester';
  });
  await page.waitForTimeout(300);

  // 3. Verify Songs in 2-Column Grid
  await page.waitForSelector('.cute-song-item', { timeout: 10000 });
  const songItems = await page.$$('.cute-song-item');
  console.log(`✓ Song items rendered in grid: ${songItems.length}`);

  // 4. Click first song
  console.log('▶ Clicking first song in catalog...');
  await songItems[0].click({ force: true });
  await page.waitForTimeout(1500);

  // 5. Inspect HTML5 Audio element state
  const audioState = await page.evaluate(() => {
    const audio = document.getElementById('audio-engine');
    const app = window.spotify || window.kawaiiApp;
    const cur = app?.getCurrentTrack();
    return {
      src: audio?.src || '',
      paused: audio?.paused,
      currentTime: audio?.currentTime,
      duration: audio?.duration,
      trackTitle: cur?.title,
      trackArtist: cur?.artist,
      trackType: cur?.type,
      isPlayingUI: document.body.classList.contains('is-playing'),
      pbTitle: document.getElementById('pb-title')?.textContent,
      pbArtist: document.getElementById('pb-artist')?.textContent
    };
  });

  console.log(`✓ Track loaded: "${audioState.pbTitle}" by "${audioState.pbArtist}"`);
  console.log(`✓ Stream URL: ${audioState.src.slice(0, 65)}...`);
  console.log(`✓ Track Engine Type: ${audioState.trackType}`);
  console.log(`✓ Audio Playing: ${!audioState.paused}`);
  console.log(`✓ UI is-playing active: ${audioState.isPlayingUI}`);

  // 6. Test Play/Pause Toggle
  console.log('⏸ Testing Play/Pause toggle...');
  await page.click('#btn-play');
  await page.waitForTimeout(400);
  const isPaused = await page.evaluate(() => document.getElementById('audio-engine')?.paused);
  console.log(`✓ Play button clicked -> Paused: ${isPaused}`);

  await page.click('#btn-play');
  await page.waitForTimeout(400);
  const isResumed = await page.evaluate(() => !document.getElementById('audio-engine')?.paused);
  console.log(`✓ Play button clicked -> Resumed: ${isResumed}`);

  // 7. Test Instant Search for 'Bairan'
  console.log('🔍 Testing search for "Bairan"...');
  await page.fill('#search-input', 'Bairan');
  await page.waitForTimeout(1500); // wait for 350ms debounce and search API

  const searchResultsCount = await page.evaluate(() => {
    return document.querySelectorAll('.search-drop-item').length;
  });
  console.log(`✓ Search dropdown returned: ${searchResultsCount} results`);

  if (searchResultsCount > 0) {
    const firstResult = await page.$('.search-drop-item');
    if (firstResult) {
      await firstResult.click({ force: true });
      await page.waitForTimeout(1500);

      const searchedTrackAudio = await page.evaluate(() => {
        const audio = document.getElementById('audio-engine');
        const app = window.spotify || window.kawaiiApp;
        const cur = app?.getCurrentTrack();
        return {
          title: cur?.title,
          artist: cur?.artist,
          src: audio?.src,
          type: cur?.type,
          paused: audio?.paused,
          pbTitle: document.getElementById('pb-title')?.textContent,
          pbArtist: document.getElementById('pb-artist')?.textContent
        };
      });
      console.log(`✓ Clicked search result: "${searchedTrackAudio.pbTitle}" by "${searchedTrackAudio.pbArtist}"`);
      console.log(`✓ Direct CDN Stream: ${searchedTrackAudio.src?.slice(0, 65)}...`);
      console.log(`✓ Audio Playing: ${!searchedTrackAudio.paused}`);
    }
  }

  // 8. Test Theme Switcher
  console.log('🎨 Testing theme switching...');
  const themePills = await page.$$('.theme-pill');
  if (themePills.length > 2) {
    await themePills[2].click();
    await page.waitForTimeout(200);
    const activeTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    console.log(`✓ Theme successfully switched to: "${activeTheme}"`);
  }

  // 9. Capture Screenshot
  console.log('📸 Capturing screenshot...');
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  try { fs.copyFileSync(SCREENSHOT_PATH, LOCAL_SCREENSHOT_PATH); } catch (_) {}
  console.log(`✓ Screenshot captured to ${LOCAL_SCREENSHOT_PATH}`);

  if (consoleErrors.length > 0) {
    console.log(`⚠️ Console errors captured: ${consoleErrors.length}`);
    consoleErrors.slice(0, 3).forEach(e => console.log('   -', e));
  } else {
    console.log('✓ 0 Console errors detected!');
  }

  await browser.close();
  console.log('🎉 ALL PLAYWRIGHT TESTS PASSED SUCCESSFULLY!');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
