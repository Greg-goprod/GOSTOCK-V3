/* Mannyx — registre d'icônes Lucide (https://lucide.dev, licence ISC).
   Aucune icône émoji dans le design system : tout passe par icon('nom').
   Géométrie Lucide d'origine : viewBox 24, stroke 2, caps/joins arrondis. */
(function (global) {
  var P = {
    // actions
    check:          ['<path d="M20 6 9 17l-5-5"/>'],
    x:              ['<path d="M18 6 6 18"/>', '<path d="m6 6 12 12"/>'],
    plus:           ['<path d="M5 12h14"/>', '<path d="M12 5v14"/>'],
    minus:          ['<path d="M5 12h14"/>'],
    pencil:         ['<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>', '<path d="m15 5 4 4"/>'],
    copy:           ['<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>', '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'],
    trash:          ['<path d="M3 6h18"/>', '<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>', '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', '<path d="M10 11v6"/>', '<path d="M14 11v6"/>'],
    upload:         ['<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>', '<path d="M17 8l-5-5-5 5"/>', '<path d="M12 3v12"/>'],
    download:       ['<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>', '<path d="m7 10 5 5 5-5"/>', '<path d="M12 15V3"/>'],
    share:          ['<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>', '<path d="m16 6-4-4-4 4"/>', '<path d="M12 2v13"/>'],
    settings:       ['<path d="M20 7h-9"/>', '<path d="M14 17H5"/>', '<circle cx="17" cy="17" r="3"/>', '<circle cx="7" cy="7" r="3"/>'],
    search:         ['<circle cx="11" cy="11" r="8"/>', '<path d="m21 21-4.3-4.3"/>'],
    filter:         ['<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'],
    // navigation
    'chevron-down':  ['<path d="m6 9 6 6 6-6"/>'],
    'chevron-up':    ['<path d="m18 15-6-6-6 6"/>'],
    'chevron-left':  ['<path d="m15 18-6-6 6-6"/>'],
    'chevron-right': ['<path d="m9 18 6-6-6-6"/>'],
    'arrow-right':   ['<path d="M5 12h14"/>', '<path d="m12 5 7 7-7 7"/>'],
    'arrow-left':    ['<path d="M19 12H5"/>', '<path d="m12 19-7-7 7-7"/>'],
    'arrow-up-right':['<path d="M7 7h10v10"/>', '<path d="M7 17 17 7"/>'],
    'external-link': ['<path d="M15 3h6v6"/>', '<path d="M10 14 21 3"/>', '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'],
    'panel-right':   ['<rect width="18" height="18" x="3" y="3" rx="2"/>', '<path d="M15 3v18"/>'],
    'more-horizontal':['<circle cx="12" cy="12" r="1"/>', '<circle cx="19" cy="12" r="1"/>', '<circle cx="5" cy="12" r="1"/>'],
    'grip-vertical': ['<circle cx="9" cy="12" r="1"/>', '<circle cx="9" cy="5" r="1"/>', '<circle cx="9" cy="19" r="1"/>', '<circle cx="15" cy="12" r="1"/>', '<circle cx="15" cy="5" r="1"/>', '<circle cx="15" cy="19" r="1"/>'],
    // statut
    'alert-triangle':['<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>', '<path d="M12 9v4"/>', '<path d="M12 17h.01"/>'],
    'circle-check':  ['<circle cx="12" cy="12" r="10"/>', '<path d="m9 12 2 2 4-4"/>'],
    'circle-x':      ['<circle cx="12" cy="12" r="10"/>', '<path d="m15 9-6 6"/>', '<path d="m9 9 6 6"/>'],
    'circle-alert':  ['<circle cx="12" cy="12" r="10"/>', '<path d="M12 8v4"/>', '<path d="M12 16h.01"/>'],
    info:           ['<circle cx="12" cy="12" r="10"/>', '<path d="M12 16v-4"/>', '<path d="M12 8h.01"/>'],
    loader:         ['<path d="M21 12a9 9 0 1 1-6.219-8.56"/>'],
    // objets métier
    'file-text':    ['<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>', '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>', '<path d="M10 9H8"/>', '<path d="M16 13H8"/>', '<path d="M16 17H8"/>'],
    'file-down':    ['<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>', '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>', '<path d="M12 18v-6"/>', '<path d="m9 15 3 3 3-3"/>'],
    image:          ['<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>', '<circle cx="9" cy="9" r="2"/>', '<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'],
    'folder-open':  ['<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>'],
    'clipboard-list':['<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>', '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>', '<path d="M12 11h4"/>', '<path d="M12 16h4"/>', '<path d="M8 11h.01"/>', '<path d="M8 16h.01"/>'],
    user:           ['<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>', '<circle cx="12" cy="7" r="4"/>'],
    users:          ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>', '<circle cx="9" cy="7" r="4"/>', '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>', '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
    music:          ['<path d="M9 18V5l12-2v13"/>', '<circle cx="6" cy="18" r="3"/>', '<circle cx="18" cy="16" r="3"/>'],
    calendar:       ['<rect width="18" height="18" x="3" y="4" rx="2"/>', '<path d="M8 2v4"/>', '<path d="M16 2v4"/>', '<path d="M3 10h18"/>'],
    clock:          ['<circle cx="12" cy="12" r="10"/>', '<path d="M12 6v6l4 2"/>'],
    ticket:         ['<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>', '<path d="M13 5v14"/>'],
    mail:           ['<rect width="20" height="16" x="2" y="4" rx="2"/>', '<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'],
    'banknote':     ['<rect width="20" height="12" x="2" y="6" rx="2"/>', '<circle cx="12" cy="12" r="2"/>', '<path d="M6 12h.01M18 12h.01"/>'],
    'layout-grid':  ['<rect width="7" height="7" x="3" y="3" rx="1"/>', '<rect width="7" height="7" x="14" y="3" rx="1"/>', '<rect width="7" height="7" x="14" y="14" rx="1"/>', '<rect width="7" height="7" x="3" y="14" rx="1"/>'],
    list:           ['<path d="M3 12h.01"/>', '<path d="M3 18h.01"/>', '<path d="M3 6h.01"/>', '<path d="M8 12h13"/>', '<path d="M8 18h13"/>', '<path d="M8 6h13"/>'],
    sun:            ['<circle cx="12" cy="12" r="4"/>', '<path d="M12 2v2"/>', '<path d="M12 20v2"/>', '<path d="m4.93 4.93 1.41 1.41"/>', '<path d="m17.66 17.66 1.41 1.41"/>', '<path d="M2 12h2"/>', '<path d="M20 12h2"/>', '<path d="m6.34 17.66-1.41 1.41"/>', '<path d="m19.07 4.93-1.41 1.41"/>'],
    moon:           ['<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>']
  };

  function icon(name, opts) {
    opts = opts || {};
    var body = P[name];
    if (!body) { body = P.info; }
    var size = opts.size || 16;
    var sw = opts.stroke || 2;
    return '<svg class="mx-icon' + (opts.cls ? ' ' + opts.cls : '') + '" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body.join('') + '</svg>';
  }

  icon.names = Object.keys(P);
  icon.has = function (n) { return !!P[n]; };

  /* Hydrate le HTML statique : <i data-icon="pencil" data-size="14"></i> */
  icon.hydrate = function (root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      var name = el.getAttribute('data-icon');
      el.outerHTML = icon(name, {
        size: +el.getAttribute('data-size') || 16,
        stroke: +el.getAttribute('data-stroke') || 2,
        cls: el.getAttribute('data-cls') || ''
      });
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { icon.hydrate(); });
  } else { icon.hydrate(); }
  global.icon = icon;
  global.MannyxIcons = icon;
})(window);
