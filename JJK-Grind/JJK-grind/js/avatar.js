// ═══════════════════ AVATAR ═══════════════════
const AC = { hairColor: 0x111133, hairStyle: 0, skinColor: 0xeebb99, outfitColor: 0x111122, eyeColor: 0x8844ff };
const HAIR_C = [0x111133, 0xffffff, 0xcccccc, 0xffdd44, 0xcc2200, 0x0055ff, 0x440066, 0x00aaaa, 0xff44aa];
const SKIN_C = [0xffddc0, 0xeebb99, 0xc88855, 0x8b5533, 0xffccaa, 0xf0d5b0];
const OUTFIT_C = [0x111122, 0xffffff, 0xcc0022, 0x001166, 0x004422, 0x332200, 0x440066, 0x222222, 0xaa6600];
const EYE_C = [0x8844ff, 0x2288ff, 0xff2244, 0x22cc88, 0xffaa00, 0xffffff, 0xff44cc];
const HAIR_S = ['Spiky', 'Long', 'Short', 'Wild'];

function setupAvatarScreen() {
  function mkSw(cid, cols, key, cb) {
    const c = document.getElementById(cid);
    cols.forEach((col, i) => {
      const s = document.createElement('div'); s.className = 'avsw' + (i === 0 ? ' on' : '');
      s.style.background = '#' + col.toString(16).padStart(6, '0');
      s.onclick = () => { c.querySelectorAll('.avsw').forEach(x => x.classList.remove('on')); s.classList.add('on'); AC[key] = col; cb(); };
      c.appendChild(s);
    });
  }
  mkSw('av-hair-c', HAIR_C, 'hairColor', refreshAv); mkSw('av-skin-c', SKIN_C, 'skinColor', refreshAv);
  mkSw('av-outfit-c', OUTFIT_C, 'outfitColor', refreshAv); mkSw('av-eye-c', EYE_C, 'eyeColor', refreshAv);
  const sc = document.getElementById('av-hair-s');
  HAIR_S.forEach((nm, i) => { const b = document.createElement('button'); b.className = 'avsty' + (i === 0 ? ' on' : ''); b.textContent = nm; b.onclick = () => { sc.querySelectorAll('.avsty').forEach(x => x.classList.remove('on')); b.classList.add('on'); AC.hairStyle = i; refreshAv(); }; sc.appendChild(b); });
  refreshAv();
}
function refreshAv() {
  const h = '#' + AC.hairColor.toString(16).padStart(6, '0');
  const s = '#' + AC.skinColor.toString(16).padStart(6, '0');
  const o = '#' + AC.outfitColor.toString(16).padStart(6, '0');
  const e = '#' + AC.eyeColor.toString(16).padStart(6, '0');
  document.getElementById('avp-hair').style.background = h;
  document.getElementById('avp-head').style.background = s;
  document.getElementById('avp-body').style.background = o;
  document.getElementById('avp-la').style.background = o;
  document.getElementById('avp-ra').style.background = o;
  document.getElementById('avp-ll').style.background = '#0a0a1a';
  document.getElementById('avp-rl').style.background = '#0a0a1a';
  document.getElementById('avp-el').style.background = e;
  document.getElementById('avp-er').style.background = e;
}
