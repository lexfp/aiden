/* Storyline module (homescreen-only) - linear, checkpointed arcs
   Exposes window.Storyline.start() and .resume() for integration with G
*/
(function () {
    const KEY = 'hunters_storyline_ckpt_v1';
    const arcs = [
        { id: 'intro', title: 'Introduction Arc', mapId: 'arena', summary: 'Yuji becomes Sukuna\'s vessel. Joins Jujutsu High.' },
        { id: 'cursed_womb', title: 'Cursed Womb Arc', mapId: 'warehouse', summary: 'Special-grade curse in the detention center. Yuji loses control.' },
        { id: 'vs_mahito', title: 'Vs Mahito Arc', mapId: 'desert', summary: 'Junpei\'s tragedy. Mahito revealed as cruel experimenter.' },
        { id: 'kyoto_event', title: 'Kyoto Goodwill Event', mapId: 'neon', summary: 'Tokyo vs Kyoto; fights interrupted by Mahito.' },
        { id: 'death_paintings', title: 'Origin of Obedience', mapId: 'rooftop', summary: 'Death Paintings appear; human-curse hybrids.' },
        { id: 'shibuya', title: 'Shibuya Incident', mapId: 'rooftop', summary: 'Gojo sealed. Shibuya falls into chaos.' },
        { id: 'execution', title: 'Execution Arc', mapId: 'arena', summary: 'Yuji targeted. Yuta enters.' },
        { id: 'culling_arc', title: 'Culling Game (Story)', mapId: 'neon', summary: 'Players forced into deadly survival game.' },
        { id: 'final_phase', title: 'Final Phase', mapId: 'rooftop', summary: 'Sukuna vs everyone; Gojo returns.' }
    ];

    let state = { idx: 0 };

    function load() {
        try { const s = localStorage.getItem(KEY); if (s) state = JSON.parse(s); } catch (e) { console.warn('Storyline load failed', e); }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Storyline save failed', e); }
    }

    function createOverlay() {
        let o = document.getElementById('storyline-overlay');
        if (o) return o;
        o = document.createElement('div');
        o.id = 'storyline-overlay';
        Object.assign(o.style, { position: 'fixed', left: '8%', right: '8%', top: '8%', bottom: '8%', background: 'rgba(6,6,12,0.95)', color: '#fff', padding: '18px', zIndex: 99999, borderRadius: '8px', boxShadow: '0 6px 40px rgba(0,0,0,.6)', overflow: 'auto' });
        document.body.appendChild(o);
        return o;
    }

    function renderUI() {
        const o = createOverlay();
        const arc = arcs[state.idx] || { title: 'Complete', summary: 'You finished the Storyline.' };
        o.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h2 style="margin:0">Storyline: ${arc.title}</h2>
                <div>
                    <button id="story-close" style="margin-right:8px">Close</button>
                </div>
            </div>
            <p style="opacity:.9">${arc.summary}</p>
            <div style="margin-top:18px">
                <button id="story-play" class="btn btn-p">Play Arc</button>
                <button id="story-advance" style="margin-left:8px" class="btn">Mark Complete</button>
                <button id="story-reset" style="margin-left:8px" class="btn">Reset Progress</button>
            </div>
        `;
        o.querySelector('#story-close').onclick = () => { o.style.display = 'none'; };
        o.querySelector('#story-play').onclick = startArc;
        o.querySelector('#story-advance').onclick = () => { state.idx = Math.min(arcs.length, state.idx + 1); save(); renderUI(); };
        o.querySelector('#story-reset').onclick = () => { state.idx = 0; save(); renderUI(); };
    }

    function startArc() {
        const arc = arcs[state.idx];
        if (!arc) { alert('No more arcs.'); return; }
        if (!window.G) { alert('Game engine not loaded'); return; }
        window.G.showNotif('Starting: ' + arc.title);
        // Try to pick a sensible map for the arc
        try {
            const midx = (typeof MDEFS !== 'undefined') ? MDEFS.findIndex(m => m.id === arc.mapId) : -1;
            if (midx >= 0) window.G.selMap = midx; else window.G.selMap = window.G.selMap || 0;
            // Ensure valid defaults for character and difficulty so startMatch() doesn't read undefined
            if (!window.G.selChar) {
                if (typeof save !== 'undefined' && save.character) window.G.selChar = save.character;
                else window.G.selChar = 'soldier';
            }
            window.G.selMode = 'elimination';
            // DIFFS keys are: easy, medium, hard, extreme — choose medium as default for story arcs
            window.G.selDiff = 'medium';
            window.G.selBots = (typeof MDEFS !== 'undefined' && MDEFS[window.G.selMap]) ? (MDEFS[window.G.selMap].botCount || 6) : 6;
            // Kick off a normal match for the arc (game will re-check and load if needed)
            window.G.startMatch();
        } catch (e) {
            console.warn('Failed to start arc match', e);
            alert('Unable to start arc match.');
        }
    }

    function start() { load(); renderUI(); const o = document.getElementById('storyline-overlay'); if (o) o.style.display = 'block'; }
    function resume() { start(); }

    window.Storyline = { start, resume, _state: state, _arcs: arcs };
})();
