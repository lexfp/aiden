// Theme toggle — the initial theme is set by an inline script in <head> to avoid a flash.
(function () {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  function setIcon() {
    toggle.textContent = document.documentElement.dataset.theme === 'light' ? '\u{1F319}' : '☀️';
  }
  setIcon();

  toggle.addEventListener('click', function () {
    var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    setIcon();
  });
})();

// Hamburger menu (mobile)
(function () {
  var burger = document.getElementById('hamburger');
  var nav = document.getElementById('site-nav');
  if (!burger || !nav) return;
  burger.addEventListener('click', function () {
    nav.classList.toggle('menu-open');
  });
})();
