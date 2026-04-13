/**
 * OmniSense Clinical — Spotlight Walkthrough Engine
 *
 * Password gate + spotlight-step tour (dims page, highlights one element at a time,
 * tooltip with narrative text, prev/next/skip) + bottom page-nav bar.
 *
 * Per-page config via TOUR_CONFIG + TOUR_STEPS (array of { target, title, body, position }).
 */

(function () {
  'use strict';

  // ===== PASSWORD =====
  var PASS_KEY = 'omnisense_demo_auth';
  var PASS_CODE = 'AsterDemo2026';

  function isAuthed() { return sessionStorage.getItem(PASS_KEY) === 'true'; }

  function showPasswordGate(cb) {
    var gate = document.createElement('div');
    gate.className = 'password-gate';
    gate.innerHTML =
      '<div class="password-card">' +
        '<div class="password-logo">OmniSense<span> Clinical</span></div>' +
        '<h1>Demo access</h1>' +
        '<p>Enter the access code shared with you to view the guided demo.</p>' +
        '<input class="password-input" type="password" placeholder="Access code" id="pw-input" autocomplete="off"/>' +
        '<button class="password-submit" id="pw-submit">Enter</button>' +
        '<div class="password-error" id="pw-error">Incorrect code. Please try again.</div>' +
      '</div>';
    document.body.appendChild(gate);
    var input = document.getElementById('pw-input');
    var error = document.getElementById('pw-error');
    function tryAuth() {
      if (input.value === PASS_CODE) {
        sessionStorage.setItem(PASS_KEY, 'true');
        gate.remove();
        cb();
      } else {
        error.style.display = 'block';
        input.value = '';
        input.focus();
      }
    }
    document.getElementById('pw-submit').addEventListener('click', tryAuth);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryAuth(); });
    input.focus();
  }

  // ===== PAGE MAP =====
  var PAGE_MAP = [
    { url: '01-briefing-landing.html',      title: 'Briefing landing' },
    { url: '02-briefing-shift-start.html',  title: 'Shift briefing' },
    { url: '03-briefing-drilldown.html',    title: 'Drill-down' },
    { url: '11-patients-tab.html',          title: 'Patients' },
    { url: '04-patient-drawer-pillai.html', title: 'Pillai drawer' },
    { url: '05-patient-drawer-fatima.html', title: 'Fatima drawer' },
    { url: '06-patient-drawer-rao.html',    title: 'Rao pre-op' },
    { url: '09-journey-pillai.html',        title: 'Journey timeline' },
    { url: '07-rounds-tab-fallback.html',   title: 'Rounds' },
    { url: '10-knowledge-tab.html',         title: 'Knowledge' }
  ];

  function getPageIndex() {
    var f = location.pathname.split('/').pop();
    for (var i = 0; i < PAGE_MAP.length; i++) {
      if (PAGE_MAP[i].url === f) return i;
    }
    return 0;
  }

  // ===== BOTTOM NAV BAR =====
  function buildNavBar() {
    var idx = getPageIndex();
    var cfg = (typeof TOUR_CONFIG !== 'undefined') ? TOUR_CONFIG : {};
    var total = PAGE_MAP.length - 1; // exclude index
    var pageNum = idx; // index.html = 0
    var desc = cfg.pageDesc || '';

    document.body.classList.add('tour-active');
    var bar = document.createElement('div');
    bar.className = 'tour-bar';

    var dots = '';
    for (var i = 1; i <= total; i++) {
      var dc = 'tour-bar-dot';
      if (i === pageNum) dc += ' active';
      else if (i < pageNum) dc += ' visited';
      dots += '<div class="' + dc + '"></div>';
    }

    var prevUrl = idx > 0 ? PAGE_MAP[idx - 1].url : null;
    var nextUrl = idx < PAGE_MAP.length - 1 ? PAGE_MAP[idx + 1].url : null;

    bar.innerHTML =
      '<div class="tour-bar-step">' + pageNum + '</div>' +
      '<span class="tour-bar-of">/ ' + total + '</span>' +
      '<span class="tour-bar-title">' + PAGE_MAP[idx].title + '</span>' +
      '<span class="tour-bar-desc">' + desc + '</span>' +
      '<div class="tour-bar-dots">' + dots + '</div>' +
      '<div class="tour-bar-nav">' +
        '<button class="tour-bar-btn tour-bar-prev' + (prevUrl ? '' : ' tour-bar-disabled') + '" id="tb-prev">\u2190 Prev</button>' +
        '<button class="tour-bar-btn tour-bar-next" id="tb-next">' + (nextUrl ? 'Next \u2192' : 'Done') + '</button>' +
      '</div>';

    // Start disabled — enabled after spotlight tour finishes
    bar.style.opacity = '0.3';
    bar.style.pointerEvents = 'none';

    document.body.appendChild(bar);
    document.getElementById('tb-prev').addEventListener('click', function () { if (prevUrl) location.href = prevUrl; });
    document.getElementById('tb-next').addEventListener('click', function () { location.href = nextUrl || 'index.html'; });

    // Keyboard nav also gated by tour completion
    document.addEventListener('keydown', function (e) {
      if (bar.style.pointerEvents === 'none') return;
      if (e.key === 'ArrowRight' && nextUrl) location.href = nextUrl;
      if (e.key === 'ArrowLeft' && prevUrl) location.href = prevUrl;
    });
  }

  // ===== SPOTLIGHT ENGINE =====
  var currentStep = 0;
  var steps = [];
  var ring = null;
  var tooltip = null;

  function createSpotlightElements() {
    ring = document.createElement('div');
    ring.className = 'spotlight-target-ring';
    ring.style.display = 'none';
    document.body.appendChild(ring);

    tooltip = document.createElement('div');
    tooltip.className = 'spotlight-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
  }

  function positionSpotlight(step) {
    // Run onLeave for the previous step
    if (currentStep > 0 && steps[currentStep - 1] && steps[currentStep - 1].onLeave) {
      steps[currentStep - 1].onLeave();
    }
    // Also handle going backwards
    if (currentStep < steps.length - 1 && steps[currentStep + 1] && steps[currentStep + 1].onLeave) {
      steps[currentStep + 1].onLeave();
    }

    // Run onEnter for this step
    if (step.onEnter) step.onEnter();

    var el = document.querySelector(step.target);
    if (!el) { nextStep(); return; }

    // Scroll target into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(function () {
      var rect = el.getBoundingClientRect();
      var pad = 8;

      // Position the ring (cut-out highlight)
      ring.style.display = 'block';
      ring.style.top = (rect.top - pad) + 'px';
      ring.style.left = (rect.left - pad) + 'px';
      ring.style.width = (rect.width + pad * 2) + 'px';
      ring.style.height = (rect.height + pad * 2) + 'px';

      // Build tooltip content
      var totalSteps = steps.length;
      var dots = '';
      for (var i = 0; i < totalSteps; i++) {
        var dc = 'spotlight-tooltip-dot';
        if (i === currentStep) dc += ' active';
        else if (i < currentStep) dc += ' visited';
        dots += '<div class="' + dc + '"></div>';
      }

      tooltip.innerHTML =
        '<div class="spotlight-tooltip-header">' +
          '<span class="spotlight-tooltip-step">' + (currentStep + 1) + '</span>' +
          '<span class="spotlight-tooltip-title">' + step.title + '</span>' +
        '</div>' +
        '<div class="spotlight-tooltip-body">' + step.body + '</div>' +
        '<div class="spotlight-tooltip-nav">' +
          '<div class="spotlight-tooltip-dots">' + dots + '</div>' +
          (currentStep > 0 ? '<button class="spot-btn spot-btn-prev" id="spot-prev">\u2190</button>' : '') +
          '<button class="spot-btn spot-btn-next" id="spot-next">' +
            (currentStep < totalSteps - 1 ? 'Next \u2192' : 'Finish \u2713') +
          '</button>' +
        '</div>';

      // Position tooltip relative to target
      var pos = step.position || 'bottom';
      tooltip.className = 'spotlight-tooltip arrow-' + (pos === 'bottom' ? 'top' : pos === 'top' ? 'bottom' : pos === 'right' ? 'left' : 'right');
      tooltip.style.display = 'block';

      // Calculate position
      var tw = 380; // max-width
      var th = tooltip.offsetHeight;
      var gap = 16;
      var tx, ty;

      if (pos === 'bottom') {
        tx = rect.left;
        ty = rect.bottom + gap;
      } else if (pos === 'top') {
        tx = rect.left;
        ty = rect.top - th - gap;
      } else if (pos === 'right') {
        tx = rect.right + gap;
        ty = rect.top;
      } else { // left
        tx = rect.left - tw - gap;
        ty = rect.top;
        // Auto-flip to right if left goes off-screen
        if (tx < 10) {
          tx = rect.right + gap;
          pos = 'right';
          tooltip.className = 'spotlight-tooltip arrow-left';
        }
      }

      // Keep on screen
      if (tx + tw > window.innerWidth - 20) tx = window.innerWidth - tw - 20;
      if (tx < 10) tx = 10;
      if (ty + th > window.innerHeight - 70) ty = window.innerHeight - th - 70;
      if (ty < 10) ty = 10;

      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';

      // Wire buttons
      var prevBtn = document.getElementById('spot-prev');
      if (prevBtn) prevBtn.addEventListener('click', prevStep);
      document.getElementById('spot-next').addEventListener('click', nextStep);
    }, 350); // wait for scroll
  }

  function nextStep() {
    currentStep++;
    if (currentStep >= steps.length) {
      endTour();
      return;
    }
    positionSpotlight(steps[currentStep]);
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      positionSpotlight(steps[currentStep]);
    }
  }

  function endTour() {
    // Clean up any active step's onLeave
    if (steps[currentStep] && steps[currentStep].onLeave) steps[currentStep].onLeave();
    if (ring) ring.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
    // Enable the bottom nav bar
    var bar = document.querySelector('.tour-bar');
    if (bar) {
      bar.style.opacity = '1';
      bar.style.pointerEvents = 'auto';
    }
  }

  function startSpotlightTour() {
    steps = (typeof TOUR_STEPS !== 'undefined') ? TOUR_STEPS : [];
    if (steps.length === 0) {
      // No steps on this page, enable nav bar immediately
      endTour();
      return;
    }

    createSpotlightElements();
    currentStep = 0;
    positionSpotlight(steps[0]);

    // ESC to end tour
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') endTour();
    });

    // Click on overlay ring to advance
    ring.style.pointerEvents = 'auto';
    ring.style.cursor = 'pointer';
    ring.addEventListener('click', function (e) {
      e.stopPropagation();
      nextStep();
    });
  }

  // ===== INIT =====
  function init() {
    buildNavBar();
    // Small delay so page renders first
    setTimeout(startSpotlightTour, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!isAuthed()) showPasswordGate(init);
      else init();
    });
  } else {
    if (!isAuthed()) showPasswordGate(init);
    else init();
  }
})();
