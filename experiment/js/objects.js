/* objects.js: novel objects (viewBox 0 0 200 200) and recolorable incidental objects (viewBox 0 0 40 40).
 * obj_bosa, obj_daxa, obj_tefo, obj_gimu are the lab's original illustrations (copied verbatim).
 * The other 8 were drawn to match their style. */
SRL.objects = (function () {
  const deg = (a) => (a * Math.PI) / 180;
  const f2 = (x) => x.toFixed(2);

  function wavyDisc(cx, cy, r, amp, lobes) {
    let d = '';
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * 2 * Math.PI, rr = r + amp * Math.cos(lobes * a);
      d += (i === 0 ? 'M' : 'L') + f2(cx + rr * Math.cos(a)) + ' ' + f2(cy + rr * Math.sin(a)) + ' ';
    }
    return d + 'Z';
  }

  const NOVEL = {
    obj_bosa: () => `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M78 174 C 90 142, 93 112, 104 84 C 112 64, 120 52, 130 38" stroke="#8B3DC2" stroke-width="28"></path>
<path d="M104 84 C 92 68, 82 58, 68 46" stroke="#8B3DC2" stroke-width="22"></path>
<path d="M114 64 C 134 58, 150 54, 168 52" stroke="#8B3DC2" stroke-width="20"></path>
<path d="M88 132 C 80 128, 74 124, 66 118" stroke="#8B3DC2" stroke-width="16"></path>
<path d="M82 160 C 92 130, 96 106, 106 86" stroke="#B57BE0" stroke-width="3" opacity="0.7"></path>
<path d="M92 166 C 100 138, 104 112, 114 90" stroke="#B57BE0" stroke-width="3" opacity="0.6"></path>
<path d="M98 96 C 90 82, 84 72, 74 60" stroke="#B57BE0" stroke-width="3" opacity="0.6"></path>
</g>
<circle cx="130" cy="38" r="15" fill="#F7B57E"></circle>
<circle cx="68" cy="46" r="13" fill="#F7B57E"></circle>
<circle cx="168" cy="52" r="12" fill="#F7B57E"></circle>
<circle cx="66" cy="118" r="10" fill="#F7B57E"></circle>
<circle cx="78" cy="174" r="15" fill="#F7B57E"></circle>`,
    obj_daxa: () => `<circle cx="100" cy="100" r="66" fill="#F2622E"></circle>
<circle cx="100" cy="100" r="72" fill="none" stroke="#F2622E" stroke-width="12" stroke-dasharray="2 3"></circle>
<path d="M44 66 A66 66 0 0 1 82 37" fill="none" stroke="#9FD3DB" stroke-width="16"></path>
<path d="M150 146 A66 66 0 0 1 112 165" fill="none" stroke="#9FD3DB" stroke-width="16"></path>
<circle cx="100" cy="100" r="40" fill="#9FD3DB"></circle>
<circle cx="100" cy="100" r="44" fill="none" stroke="#9FD3DB" stroke-width="8" stroke-dasharray="2 2.5"></circle>
<circle cx="100" cy="100" r="21" fill="#3B2B2B"></circle>
<circle cx="100" cy="100" r="24" fill="none" stroke="#7FB9C3" stroke-width="5" stroke-dasharray="1.5 2"></circle>`,
    obj_tefo: () => `<path d="M62 62 A38 32 0 0 1 138 62 Z" fill="#D62B2B"></path>
<rect x="58" y="58" width="84" height="22" rx="4" fill="#4A4A50"></rect>
<circle cx="100" cy="69" r="6" fill="#D62B2B"></circle>
<path d="M64 80 C 80 98, 80 112, 64 128 L 136 128 C 120 112, 120 98, 136 80 Z" fill="#E3EDF2" stroke="#9FB0B9" stroke-width="2"></path>
<circle cx="92" cy="114" r="4" fill="#8A5A3C"></circle>
<circle cx="104" cy="118" r="4" fill="#8A5A3C"></circle>
<circle cx="112" cy="110" r="3.5" fill="#8A5A3C"></circle>
<path d="M84 88 C 90 100, 90 108, 86 118" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.8"></path>
<rect x="52" y="126" width="96" height="22" rx="4" fill="#4A4A50"></rect>
<circle cx="122" cy="137" r="6" fill="#D62B2B"></circle>
<path d="M52 146 A48 40 0 0 0 148 146 Z" fill="#D62B2B"></path>`,
    obj_gimu: () => {
      const arm = (rot, y, h, capY, capW, capH, rx, col, x = 88, w = 24, capX = 82, crx = 5) =>
        `<g transform="rotate(${rot} 100 100)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${col}" fill-opacity="0.9"></rect><rect x="${capX}" y="${capY}" width="${capW}" height="${capH}" rx="${crx}" fill="${col}"></rect></g>`;
      return arm(35, 26, 74, 22, 36, 16, 6, '#3FB4E0') + arm(215, 26, 74, 22, 36, 16, 6, '#3FB4E0') +
        arm(125, 30, 70, 26, 40, 18, 6, '#FF7A2A', 88, 24, 80, 9) + arm(305, 30, 70, 26, 40, 18, 6, '#FF7A2A', 88, 24, 80, 9) +
        arm(80, 34, 66, 30, 32, 14, 6, '#8EDB4A', 89, 22, 84, 4) + arm(260, 34, 66, 30, 32, 14, 6, '#8EDB4A', 89, 22, 84, 4) +
        `<circle cx="100" cy="100" r="16" fill="#DFF3FA" stroke="#9CCFE0" stroke-width="2"></circle>`;
    },
    obj_fiku: () => `<circle cx="80" cy="160" r="10" fill="#1F6F68"/><circle cx="128" cy="160" r="10" fill="#1F6F68"/>
<path d="M92 62 C 86 46, 78 38, 66 35" stroke="#1F6F68" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="63" cy="34" r="8" fill="#E8505B"/>
<path d="M120 60 C 124 42, 134 32, 148 28" stroke="#1F6F68" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="151" cy="27" r="10" fill="#E8505B"/>
<path d="M58 118 C 40 80, 80 44, 120 58 C 160 72, 170 122, 140 148 C 114 170, 72 156, 58 118 Z" fill="#2BA59A"/>
<path d="M86 108 a22 22 0 1 0 44 0 a16 16 0 1 0 -32 0 a10 10 0 1 0 20 0" fill="none" stroke="#F4D35E" stroke-width="7" stroke-linecap="round"/>`,
    obj_lufi: () => `<g stroke-linecap="round"><path d="M100 100 L100 38" stroke="#C2368C" stroke-width="22"/><path d="M100 100 L148 132" stroke="#C2368C" stroke-width="22"/><path d="M100 100 L46 128" stroke="#C2368C" stroke-width="22"/></g>
<circle cx="100" cy="34" r="15" fill="#5B3A87"/><circle cx="152" cy="135" r="11" fill="#5B3A87"/><circle cx="42" cy="130" r="13" fill="#5B3A87"/>
<polygon points="100,72 124,86 124,114 100,128 76,114 76,86" fill="#FFC145"/><circle cx="100" cy="100" r="9" fill="#FFF3D6"/>`,
    obj_mavo: () => `<rect x="94" y="96" width="12" height="62" rx="5" fill="#4A4A55"/><ellipse cx="100" cy="162" rx="40" ry="10" fill="#6CC24A"/>
<path d="M32 118 A70 70 0 0 1 168 118 A70 56 0 0 0 32 118 Z" fill="#5B8DEF"/>
<circle cx="34" cy="122" r="12" fill="#F28C28"/><circle cx="166" cy="122" r="12" fill="#F28C28"/>
<circle cx="66" cy="74" r="7" fill="#2D4E9A"/><circle cx="100" cy="60" r="7" fill="#2D4E9A"/><circle cx="134" cy="74" r="7" fill="#2D4E9A"/>`,
    obj_zibu: () => `<path d="M50 92 H130 V162 H50 Z" fill="#C5D94A"/><path d="M50 92 L80 68 H160 L130 92 Z" fill="#DCEB7A"/><path d="M130 92 L160 68 V138 L130 162 Z" fill="#9FB536"/>
<path d="M118 80 C 116 54, 128 34, 156 30 C 146 42, 140 58, 140 80 Z" fill="#8F6BB8"/>
<circle cx="70" cy="114" r="7" fill="#6B4E2E"/><circle cx="96" cy="136" r="7" fill="#6B4E2E"/><circle cx="112" cy="110" r="7" fill="#6B4E2E"/>`,
    obj_hosi: () => `<path d="M100 128 l-9 8 l18 8 l-18 8 l18 8 l-9 8" fill="none" stroke="#0081A7" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
<ellipse cx="100" cy="174" rx="32" ry="7" fill="#00AFB9"/>
<g transform="rotate(-14 100 104)"><rect x="38" y="80" width="124" height="48" rx="24" fill="#F07167"/>
<circle cx="64" cy="80" r="10" fill="#FED9B7"/><circle cx="88" cy="76" r="10" fill="#FED9B7"/><circle cx="112" cy="76" r="10" fill="#FED9B7"/><circle cx="136" cy="80" r="10" fill="#FED9B7"/>
<rect x="56" y="98" width="88" height="10" rx="5" fill="#C94F48"/></g>`,
    obj_pemo: () => `<path d="M100 120 L60 172 M100 120 L140 172 M100 120 L100 178" stroke="#FFB300" stroke-width="9" stroke-linecap="round"/>
<circle cx="60" cy="172" r="7" fill="#E07A00"/><circle cx="140" cy="172" r="7" fill="#E07A00"/><circle cx="100" cy="178" r="7" fill="#E07A00"/>
<rect x="91" y="34" width="18" height="16" rx="4" fill="#4A2F7A"/>
<circle cx="100" cy="88" r="44" fill="#7E57C2"/>
<ellipse cx="100" cy="94" rx="51" ry="11" fill="none" stroke="#FFB300" stroke-width="7"/>
<circle cx="84" cy="72" r="9" fill="#D8C8F5"/>`,
    obj_keku: () => `<g transform="rotate(24 100 100)"><path d="M88 28 L112 28 L104 62 L134 96 L104 130 L112 172 L88 172 L96 130 L66 96 L96 62 Z" fill="#00A6A6"/>
<circle cx="134" cy="96" r="12" fill="#F49D37"/><circle cx="66" cy="96" r="9" fill="#F49D37"/><circle cx="100" cy="26" r="10" fill="#F49D37"/>
<rect x="84" y="166" width="32" height="14" rx="7" fill="#0B4F4F"/>
<circle cx="100" cy="96" r="10" fill="#0B4F4F"/><circle cx="100" cy="60" r="5" fill="#0B4F4F"/><circle cx="100" cy="132" r="5" fill="#0B4F4F"/></g>`,
    obj_vuno: () => `<g transform="translate(100 100) rotate(-18) scale(1 0.72) translate(-100 -100)"><path d="${wavyDisc(100, 100, 68, 7, 7)}" fill="#E84855"/>
<rect x="72" y="72" width="56" height="56" rx="8" fill="#3185FC" transform="rotate(45 100 100)"/></g>
<circle cx="100" cy="100" r="12" fill="#FFF07C"/><rect x="92" y="138" width="16" height="30" rx="5" fill="#4A4A55"/><rect x="70" y="164" width="60" height="10" rx="5" fill="#3185FC"/>`
  };

  const N_DARK = '#5A5550', N_LIGHT = '#F3EEE4';
  const INCIDENTAL = {
    mug: (c) => `<g fill="${c}" stroke="${c}"><path d="M28 15 Q37 15 37 22 Q37 29 28 29" fill="none" stroke-width="4"></path><path d="M7 10 H29 V31 Q29 36 24 36 H12 Q7 36 7 31 Z"></path></g>`,
    vase: (c) => `<g fill="${c}" stroke="${c}"><path d="M14 4 H26 V9 Q26 12 29 15 Q34 20 33 27 Q32 35 25 37 H15 Q8 35 7 27 Q6 20 11 15 Q14 12 14 9 Z"></path></g>`,
    lamp: (c) => `<path d="M12 5 H28 L33 20 H7 Z" fill="${c}"/><rect x="18.8" y="20" width="2.4" height="12" fill="${N_DARK}"/><rect x="12" y="31" width="16" height="5" rx="2" fill="${N_DARK}"/>`,
    book: (c) => `<rect x="12" y="4" width="17" height="32" rx="1.5" fill="${c}"/><rect x="26.5" y="5" width="2.5" height="30" fill="${N_LIGHT}"/><rect x="14.5" y="9" width="9" height="2" fill="#FFFFFF" opacity="0.55"/><rect x="14.5" y="29" width="9" height="2" fill="#FFFFFF" opacity="0.55"/>`,
    clock: (c) => `<rect x="11" y="32" width="4" height="5" rx="1" fill="${N_DARK}"/><rect x="25" y="32" width="4" height="5" rx="1" fill="${N_DARK}"/><circle cx="20" cy="20" r="15" fill="${c}"/><circle cx="20" cy="20" r="11" fill="#F7F3EA"/><path d="M20 20 V12.5 M20 20 L25.5 22.5" stroke="#333333" stroke-width="1.8" stroke-linecap="round"/><circle cx="20" cy="20" r="1.4" fill="#333333"/>`,
    teapot: (c) => `<path d="M10 23 L3 13 L6 12.5 L12.5 19.5 Z" fill="${c}"/><path d="M31 18 Q38 20 36 26 Q35 30 30 30" fill="none" stroke="${c}" stroke-width="3"/><ellipse cx="20" cy="24" rx="12" ry="10" fill="${c}"/><path d="M12.5 15.5 Q20 9 27.5 15.5 Z" fill="${c}"/><circle cx="20" cy="10.5" r="2" fill="${c}"/><rect x="12" y="32" width="16" height="3.5" rx="1.5" fill="${c}"/>`,
    bowl: (c) => `<path d="M4 17 H36 Q35 32 20 33 Q5 32 4 17 Z" fill="${c}"/><ellipse cx="20" cy="17" rx="16" ry="2.6" fill="${c}"/><ellipse cx="20" cy="17" rx="14.5" ry="1.6" fill="#000000" opacity="0.18"/><rect x="14" y="32" width="12" height="3.5" rx="1.5" fill="${c}"/>`,
    candle: (c) => `<ellipse cx="20" cy="35" rx="10" ry="2.6" fill="#8D99AE"/><rect x="15" y="13" width="10" height="22" rx="1.5" fill="${c}"/><path d="M20 13 V10" stroke="#333333" stroke-width="1"/><path d="M20 3 Q24 8 20 10.5 Q16 8 20 3 Z" fill="#FFD166"/>`,
    frame: (c) => `<path d="M14 31 L11 37 M26 31 L29 37" stroke="${N_DARK}" stroke-width="1.6"/><rect x="6" y="5" width="28" height="27" rx="1.5" fill="${c}"/><rect x="10" y="9" width="20" height="19" fill="#DDE7EE"/><path d="M10 28 L17 19 L22 24 L25 21 L30 28 Z" fill="#9BB0BF"/><circle cx="25" cy="14" r="2" fill="${N_LIGHT}"/>`,
    jar: (c) => `<rect x="10" y="13" width="20" height="23" rx="5" fill="${c}"/><rect x="11.5" y="7" width="17" height="7" rx="1.5" fill="${N_DARK}"/><rect x="13" y="20" width="14" height="8" rx="1" fill="${N_LIGHT}" opacity="0.85"/>`,
    watering_can: (c) => `<path d="M14 14 Q19 4 25 14" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M28 18 Q36 22 28 30" fill="none" stroke="${c}" stroke-width="2.6"/><path d="M11 30 L3 15 L5.5 14 L13.5 26 Z" fill="${c}"/><rect x="0.5" y="11.5" width="6" height="3.2" rx="1" transform="rotate(-25 3.5 13)" fill="${c}"/><rect x="10" y="14" width="18" height="21" rx="3" fill="${c}"/>`,
    bottle: (c) => `<path d="M16 5 H24 V10 Q30 14 30 20 V34 Q30 37 27 37 H13 Q10 37 10 34 V20 Q10 14 16 10 Z" fill="${c}"/><rect x="15.5" y="2" width="9" height="4.5" rx="1" fill="${N_DARK}"/><rect x="13" y="20" width="2.4" height="12" rx="1.2" fill="#FFFFFF" opacity="0.35"/>`
  };

  function novelSvg(id, attrs) {
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" ${attrs || ''}>${NOVEL[id]()}</svg>`;
  }
  function novelInner(id) { return NOVEL[id](); }
  function incidentalSvg(type, color, attrs) {
    return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" ${attrs || ''}>${INCIDENTAL[type](color)}</svg>`;
  }
  function incidentalInner(type, color) { return INCIDENTAL[type](color); }

  return { NOVEL_IDS: Object.keys(NOVEL), INCIDENTAL_TYPES: Object.keys(INCIDENTAL), novelSvg, novelInner, incidentalSvg, incidentalInner };
})();
