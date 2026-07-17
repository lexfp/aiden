// Book reader: fetches one or more plain-text books (one paragraph per line)
// and renders them in order with a combined chapter table of contents.
// Heading lines are "Chapter N: Title", "Prologue", or "Epilogue"; the first
// non-blank line of each file is that book's title.
(function () {
  const sources = document.currentScript.dataset.books.split(',').map(s => s.trim());
  const bookEl = document.getElementById('book');
  const tocEl = document.getElementById('toc');
  const HEADING = /^\s*(Chapter\s+\d+\s*:.*|Prologue|Epilogue)\s*$/;

  Promise.all(sources.map(src =>
    fetch(src).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
  ))
    .then(texts => {
      bookEl.textContent = '';
      tocEl.innerHTML = '<h2>Contents</h2>';
      const headings = [];

      texts.forEach((text, bookIdx) => {
        let seenTitle = false;
        text.split(/\r?\n/).forEach(line => {
          const trimmed = line.trim();
          if (!trimmed) return;

          if (!seenTitle) {
            // First non-blank line of the file is the book's title.
            seenTitle = true;
            const h = document.createElement('h2');
            h.className = 'book-title';
            h.id = 'book-' + (bookIdx + 1);
            h.textContent = 'Book ' + (bookIdx + 1) + ': ' + trimmed;
            bookEl.appendChild(h);
            headings.push(h);
            const a = document.createElement('a');
            a.className = 'toc-book';
            a.href = '#' + h.id;
            a.textContent = h.textContent;
            tocEl.appendChild(a);
            return;
          }

          if (HEADING.test(line)) {
            const h = document.createElement('h3');
            h.id = 'b' + (bookIdx + 1) + '-ch-' + (headings.length + 1);
            h.textContent = trimmed;
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
      bookEl.innerHTML = '<p class="muted">Could not load the books. If you opened this page from disk, serve the site over HTTP (e.g. <code>python -m http.server</code>) so the text files can be fetched.</p>';
    });
})();
