1. [chromium] › tests\e2e\browser-apis.chromium.e2e.spec.js:31:1 › notification toggle requests permission and flips state


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('#notify-toggle')
        - locator resolved to <button type="button" id="notify-toggle" data-i18n="settings.notificationsOff">Notifications: Off</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        71 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      52 |   await createEvent(page, { title: `Notify-${Date.now()}`, allDay: true });
      53 |
    > 54 |   await page.click("#notify-toggle");
         |              ^
      55 |   await expect(page.locator("#notify-toggle")).toContainText(/On/i);
      56 |   await expect.poll(() => page.evaluate(() => window.__notifyRequestCount)).toBe(1);
      57 |
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\browser-apis.chromium.e2e.spec.js:54:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\browser-apis.chromium.e2e--6f86e--permission-and-flips-state-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\browser-apis.chromium.e2e--6f86e--permission-and-flips-state-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\browser-apis.chromium.e2e--6f86e--permission-and-flips-state-chromium\error-context.md

2. [chromium] › tests\e2e\calendar.e2e.spec.js:91:1 › week start setting persists after reload ───


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('#weekstart-toggle')
        - locator resolved to <button type="button" id="weekstart-toggle" data-i18n="settings.weekStartsSunday">Week starts Sunday</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        81 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      91 | test("week start setting persists after reload", async ({ page }) => {
      92 |   await createEvent(page, { title: `WeekSeed-${Date.now()}`, allDay: true });
    > 93 |   await page.click("#weekstart-toggle");
         |              ^
      94 |   await expect(page.locator("#weekstart-toggle")).toContainText(/Monday/i);
      95 |
      96 |   await waitForPersist(page);
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\calendar.e2e.spec.js:93:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\calendar.e2e-week-start-setting-persists-after-reload-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\calendar.e2e-week-start-setting-persists-after-reload-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\calendar.e2e-week-start-setting-persists-after-reload-chromium\error-context.md

3. [chromium] › tests\e2e\calendar.e2e.spec.js:102:1 › language selection persists after reload ──


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('#language-btn')
        - locator resolved to <button type="button" id="language-btn" aria-expanded="false" aria-haspopup="listbox" class="dropdown-trigger" aria-label="Select language">…</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        81 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms
        - waiting for element to be visible, enabled and stable


      102 | test("language selection persists after reload", async ({ page }) => {
      103 |   await createEvent(page, { title: `LangSeed-${Date.now()}`, allDay: true });
    > 104 |   await page.click("#language-btn");
          |              ^
      105 |   await page.click('#language-list .dropdown-item[data-lang="it"]');
      106 |
      107 |   await expect(page.locator("html")).toHaveAttribute("lang", "it");
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\calendar.e2e.spec.js:104:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\calendar.e2e-language-selection-persists-after-reload-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\calendar.e2e-language-selection-persists-after-reload-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\calendar.e2e-language-selection-persists-after-reload-chromium\error-context.md

4. [chromium] › tests\e2e\calendar.e2e.spec.js:116:1 › view switching and timeline controls work ─


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('.view-toggle button[data-view="week"]')


      117 |   const grid = page.locator("#calendar-grid");
      118 |
    > 119 |   await page.click('.view-toggle button[data-view="week"]');
          |              ^
      120 |   await expect(grid).toHaveClass(/week-view/);
      121 |
      122 |   await page.click('.view-toggle button[data-view="day"]');
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\calendar.e2e.spec.js:119:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\calendar.e2e-view-switching-and-timeline-controls-work-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\calendar.e2e-view-switching-and-timeline-controls-work-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\calendar.e2e-view-switching-and-timeline-controls-work-chromium\error-context.md

5. [chromium] › tests\e2e\calendar.e2e.spec.js:144:1 › focus mode opens and closes with Escape ───


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('#focus-btn')
        - locator resolved to <button type="button" id="focus-btn" aria-pressed="false" data-i18n="btn.focus">Focus</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        82 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      143 |
      144 | test("focus mode opens and closes with Escape", async ({ page }) => {
    > 145 |   await page.click("#focus-btn");
          |              ^
      146 |   await expect(page.locator("#focus-overlay")).toHaveClass(/is-active/);
      147 |   await expect(page.locator("#focus-overlay")).toHaveAttribute("aria-hidden", "false");
      148 |
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\calendar.e2e.spec.js:145:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\calendar.e2e-focus-mode-opens-and-closes-with-Escape-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\calendar.e2e-focus-mode-opens-and-closes-with-Escape-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\calendar.e2e-focus-mode-opens-and-closes-with-Escape-chromium\error-context.md

6. [chromium] › tests\e2e\calendar.e2e.spec.js:181:1 › world planner supports zone add/remove and time format toggle


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('#world-planner-btn')
        - locator resolved to <button type="button" class="accent-btn" aria-label="Planner" id="world-planner-btn" data-i18n-aria-label="btn.worldPlanner">…</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        83 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      180 |
      181 | test("world planner supports zone add/remove and time format toggle", async ({ page }) => {
    > 182 |   await page.click("#world-planner-btn");
          |              ^
      183 |   await expect(page.locator("#world-planner-modal")).toBeVisible();
      184 |   await expect.poll(async () => await page.locator("#wp-grid .wp-row-header").count()).toBeGreaterThan(0);
      185 |
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\calendar.e2e.spec.js:182:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\calendar.e2e-world-planner-7a625-move-and-time-format-toggle-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\calendar.e2e-world-planner-7a625-move-and-time-format-toggle-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\calendar.e2e-world-planner-7a625-move-and-time-format-toggle-chromium\error-context.md

7. [chromium] › tests\e2e\calendar.e2e.spec.js:321:1 › app launcher modal opens and closes ───────


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('#app-launcher-btn')
        - locator resolved to <button type="button" id="app-launcher-btn" aria-expanded="false" class="menu-action-btn" aria-label="App Launcher" data-i18n-aria-label="launcher.ariaLabel">…</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        81 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      320 |
      321 | test("app launcher modal opens and closes", async ({ page }) => {
    > 322 |   await page.click("#app-launcher-btn");
          |              ^
      323 |   await expect(page.locator("#app-launcher-modal")).toBeVisible();
      324 |   await expect(page.locator("#app-launcher-iframe")).toHaveAttribute("src", /open-edit\.netlify\.app/);
      325 |
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\calendar.e2e.spec.js:322:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\calendar.e2e-app-launcher-modal-opens-and-closes-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\calendar.e2e-app-launcher-modal-opens-and-closes-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\calendar.e2e-app-launcher-modal-opens-and-closes-chromium\error-context.md

8. [chromium] › tests\e2e\views.e2e.spec.js:9:1 › agenda view lists created events ───────────────


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('button[data-view="agenda"]')
        - locator resolved to 2 elements. Proceeding with the first one: <button type="button" role="option" data-view="agenda" aria-selected="false" data-i18n="view.agenda" class="view-menu-option" data-view-menu-option="">Agenda</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        81 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      15 |
      16 |   // Switch to agenda view
    > 17 |   await page.click('button[data-view="agenda"]');
         |              ^
      18 |   await expect(page.locator("#calendar-grid")).toHaveClass(/agenda-view/);
      19 |
      20 |   // Both events should be visible in agenda
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\views.e2e.spec.js:17:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\views.e2e-agenda-view-lists-created-events-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\views.e2e-agenda-view-lists-created-events-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\views.e2e-agenda-view-lists-created-events-chromium\error-context.md

9. [chromium] › tests\e2e\views.e2e.spec.js:25:1 › day view renders time slots ───────────────────


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('button[data-view="day"]')
        - locator resolved to 2 elements. Proceeding with the first one: <button type="button" role="option" data-view="day" data-i18n="view.day" aria-selected="false" class="view-menu-option" data-view-menu-option="">Day</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        82 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      25 | test("day view renders time slots", async ({ page }) => {
      26 |   // Switch to day view
    > 27 |   await page.click('button[data-view="day"]');
         |              ^
      28 |   await expect(page.locator("#calendar-grid")).toHaveClass(/day-view/);
      29 |
      30 |   // Check that time slots exist (should have hour markers)
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\views.e2e.spec.js:27:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\views.e2e-day-view-renders-time-slots-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\views.e2e-day-view-renders-time-slots-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\views.e2e-day-view-renders-time-slots-chromium\error-context.md

10. [chromium] › tests\e2e\views.e2e.spec.js:35:1 › year view renders 12 month blocks ────────────


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('button[data-view="year"]')
        - locator resolved to 2 elements. Proceeding with the first one: <button type="button" role="option" data-view="year" data-i18n="view.year" aria-selected="false" class="view-menu-option" data-view-menu-option="">Year</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        83 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      35 | test("year view renders 12 month blocks", async ({ page }) => {
      36 |   // Switch to year view
    > 37 |   await page.click('button[data-view="year"]');
         |              ^
      38 |   await expect(page.locator("#calendar-grid")).toHaveClass(/year-view/);
      39 |
      40 |   // Year view should be visible
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\views.e2e.spec.js:37:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\views.e2e-year-view-renders-12-month-blocks-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\views.e2e-year-view-renders-12-month-blocks-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\views.e2e-year-view-renders-12-month-blocks-chromium\error-context.md

11. [chromium] › tests\e2e\views.e2e.spec.js:45:1 › focus mode displays event info and countdown ─


    Test timeout of 45000ms exceeded.

    Error: page.click: Test timeout of 45000ms exceeded.
    Call log:
      - waiting for locator('#focus-btn')
        - locator resolved to <button type="button" id="focus-btn" aria-pressed="false" data-i18n="btn.focus">Focus</button>
      - attempting click action
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
        - waiting 20ms
        2 × waiting for element to be visible, enabled and stable
          - element is not visible
        - retrying click action
          - waiting 100ms
        81 × waiting for element to be visible, enabled and stable
           - element is not visible
         - retrying click action
           - waiting 500ms


      55 |
      56 |   // Open focus mode
    > 57 |   await page.click("#focus-btn");
         |              ^
      58 |   await expect(page.locator("#focus-overlay")).toHaveClass(/is-active/);
      59 |
      60 |   // Focus overlay should be visible
        at C:\Users\hp\Documents\GitHub\hash\c\tests\e2e\views.e2e.spec.js:57:14

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\views.e2e-focus-mode-displays-event-info-and-countdown-chromium\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\views.e2e-focus-mode-displays-event-info-and-countdown-chromium\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\views.e2e-focus-mode-displays-event-info-and-countdown-chromium\error-context.md

11 failed
[chromium] › tests\e2e\browser-apis.chromium.e2e.spec.js:31:1 › notification toggle requests permission and flips state
[chromium] › tests\e2e\calendar.e2e.spec.js:91:1 › week start setting persists after reload ────
[chromium] › tests\e2e\calendar.e2e.spec.js:102:1 › language selection persists after reload ───
[chromium] › tests\e2e\calendar.e2e.spec.js:116:1 › view switching and timeline controls work ──
[chromium] › tests\e2e\calendar.e2e.spec.js:144:1 › focus mode opens and closes with Escape ────
[chromium] › tests\e2e\calendar.e2e.spec.js:181:1 › world planner supports zone add/remove and time format toggle
[chromium] › tests\e2e\calendar.e2e.spec.js:321:1 › app launcher modal opens and closes ────────
[chromium] › tests\e2e\views.e2e.spec.js:9:1 › agenda view lists created events ────────────────
[chromium] › tests\e2e\views.e2e.spec.js:25:1 › day view renders time slots ────────────────────
[chromium] › tests\e2e\views.e2e.spec.js:35:1 › year view renders 12 month blocks ──────────────
[chromium] › tests\e2e\views.e2e.spec.js:45:1 › focus mode displays event info and countdown ───
