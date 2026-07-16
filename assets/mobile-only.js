// Mobile-only gate. Include early in <head>:
//   <script src="assets/mobile-only.js"></script>
// Pages that include it are usable only on phones/tablets; desktop visitors
// see a full-screen notice instead of the page content.
(function () {
  'use strict';

  function isMobile() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
      return navigator.userAgentData.mobile;
    }
    if (/Android|iPhone|iPad|iPod|webOS|Mobile|Silk/i.test(navigator.userAgent)) return true;
    // iPadOS masquerades as desktop Safari — a Mac with touch is an iPad.
    if (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) return true;
    // Last resort: touch-first device.
    return matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  }

  if (isMobile()) return;

  // Hide the page immediately (before first paint) so nothing is usable.
  var style = document.createElement('style');
  style.textContent =
    'body > :not(.mobile-gate) { display: none !important; }' +
    '.mobile-gate {' +
    '  position: fixed; inset: 0; z-index: 99999;' +
    '  display: flex; flex-direction: column; align-items: center; justify-content: center;' +
    '  gap: 1rem; padding: 2rem; text-align: center;' +
    '  background: var(--bg, #0f1115); color: var(--text, #e8eaf0);' +
    '  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;' +
    '}' +
    '.mobile-gate .emoji { font-size: 4rem; }' +
    '.mobile-gate h1 { font-size: 1.6rem; margin: 0; }' +
    '.mobile-gate p { max-width: 34rem; margin: 0; color: var(--muted, #9aa3b2); line-height: 1.55; }' +
    '.mobile-gate a { color: var(--accent, #7c9cff); }';
  document.head.appendChild(style);

  function showGate() {
    var gate = document.createElement('div');
    gate.className = 'mobile-gate';
    gate.innerHTML =
      '<div class="emoji">📱</div>' +
      '<h1>This page is mobile-only</h1>' +
      '<p>Open this page on your phone or tablet to use it — it isn\'t available on desktop.</p>' +
      '<p><a href="index.html">← Back to the home page</a></p>';
    document.body.appendChild(gate);
  }

  if (document.body) showGate();
  else document.addEventListener('DOMContentLoaded', showGate);
})();
