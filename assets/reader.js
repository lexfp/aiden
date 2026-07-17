// Book reader: fetches a plain-text book (one paragraph per line) and renders
// it with a chapter table of contents. Heading lines are "Chapter N: Title",
// "Prologue", or "Epilogue"; the first line of the file is the book title.
(function () {
  const src = document.currentScript.dataset.book;
  const bookEl = document.getElementById('book');
  const tocEl = document.getElementById('toc');
  const HEADING = /^\s*(Chapter\s+\d+\s*:.*|Prologue|Epilogue)\s*$/;

  fetch(src)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(text => {
      const lines = text.split(/\r?\n/);
      bookEl.textContent = '';
      tocEl.innerHTML = '<h2>Chapters</h2>';

      const headings = [];
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (i === 0) return; // book title, already in the page header
        if (HEADING.test(line)) {
          const h = document.createElement('h2');
          h.textContent = trimmed;
          h.id = 'ch-' + (headings.length + 1);
          bookEl.appendChild(h);
          headings.push(h);
          const a = document.createElement('a');
          a.href = '#' + h.id;
          a.textContent = trimmed;
          tocEl.appendChild(a);
        } else {
          const p = document.createElement('p');
          p.textContent = trimmed;
          bookEl.appendChild(p);
        }
      });

      // Highlight the chapter currently in view.
      const links = tocEl.querySelectorAll('a');
      if ('IntersectionObserver' in window && headings.length) {
        const byId = {};
        links.forEach(a => { byId[a.hash.slice(1)] = a; });
        const observer = new IntersectionObserver(entries => {
          entries.forEach(e => {
            if (!e.isIntersecting) return;
            links.forEach(a => a.classList.remove('current'));
            const link = byId[e.target.id];
            if (link) link.classList.add('current');
          });
        }, { rootMargin: '0px 0px -80% 0px' });
        headings.forEach(h => observer.observe(h));
      }
    })
    .catch(() => {
      bookEl.innerHTML = '<p class="muted">Could not load the book. If you opened this page from disk, serve the site over HTTP (e.g. <code>python -m http.server</code>) so the text file can be fetched.</p>';
    });
})();
