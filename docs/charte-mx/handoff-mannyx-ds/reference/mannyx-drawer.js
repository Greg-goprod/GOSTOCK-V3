/* Mannyx — Drawer, primitive de base du design system.
   Un seul composant pour tous les panneaux latéraux de l'app, quelle que soit la
   page : la structure est décrite en configuration (blocs typés), pas en HTML.
   Dépend de mannyx-icons.js (icon()) et des tokens de couleur du design system.

   Drawer.open({ title, meta, band, blocks:[...], footer:{...} })
   Presets prêts à l'emploi : Drawer.presets.<nom> */
(function (global) {
  var TONE = {
    warning: { bg: 'var(--band)',   fg: 'var(--bandText)', line: 'var(--band)' },
    danger:  { bg: 'var(--danger)', fg: '#fff',            line: 'var(--danger)' },
    success: { bg: 'var(--green)',  fg: '#fff',            line: 'var(--green)' },
    info:    { bg: 'var(--cyan)',   fg: '#fff',            line: 'var(--cyan)' },
    accent:  { bg: 'var(--accent)', fg: '#fff',            line: 'var(--accent)' },
    neutral: { bg: 'var(--surface2)', fg: 'var(--text2)',  line: 'var(--border)' }
  };
  var SIZES = { sm: 360, md: 420, lg: 520, xl: 680 };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function tone(t) { return TONE[t] || TONE.neutral; }
  function ic(name, opts) { return global.icon ? global.icon(name, opts) : ''; }

  /* ── CSS injecté une seule fois ─────────────────────────────────────── */
  var CSS = [
    '.mx-dr-scrim{position:fixed;inset:0;background:var(--scrimOverlay);backdrop-filter:blur(3px);z-index:5000;opacity:0;transition:opacity .25s}',
    '.mx-dr-scrim.is-open{opacity:1}',
    '.mx-dr{position:fixed;top:0;height:100vh;max-width:100vw;background:var(--surface);color:var(--text);display:flex;flex-direction:column;z-index:5001;font-family:var(--font-ui);transition:transform .32s cubic-bezier(.22,1,.36,1)}',
    '.mx-dr[data-side="right"]{right:0;box-shadow:-28px 0 64px rgba(0,0,0,.45);transform:translateX(100%)}',
    '.mx-dr[data-side="left"]{left:0;box-shadow:28px 0 64px rgba(0,0,0,.45);transform:translateX(-100%)}',
    '.mx-dr.is-open{transform:translateX(0)}',
    '.mx-dr-head{flex-shrink:0;padding:24px 24px 16px;display:flex;flex-direction:column;gap:10px}',
    '.mx-dr-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
    '.mx-dr-eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--text3)}',
    '.mx-dr-title{font-family:var(--font-display);font-size:26px;font-weight:700;letter-spacing:-.02em;color:var(--text);display:flex;align-items:center;gap:10px}',
    '.mx-dr-title .mx-icon{color:var(--accent);flex-shrink:0}',
    '.mx-dr-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:600;color:var(--text3);letter-spacing:.01em}',
    '.mx-dr-meta .sep{opacity:.4}',
    '.mx-dr-head-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}',
    '.mx-dr-icon-btn{all:unset;width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--text3);cursor:pointer;transition:background .15s,color .15s}',
    '.mx-dr-icon-btn:hover{background:var(--surface2);color:var(--text)}',
    '.mx-dr-band{flex-shrink:0;padding:8px 24px;display:flex;align-items:center;gap:10px}',
    '.mx-dr-band .lbl{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}',
    '.mx-dr-band .dot{width:3px;height:3px;border-radius:999px;background:currentColor;opacity:.6}',
    '.mx-dr-band .mx-icon{margin-right:2px}',
    '.mx-dr-body{flex-grow:1;overflow-y:auto;padding:20px 24px 8px;display:flex;flex-direction:column;gap:24px}',
    '.mx-dr-sec{display:flex;flex-direction:column;gap:14px}',
    '.mx-dr-sec[data-accent]{padding-left:14px;border-left:3px solid var(--_line)}',
    '.mx-dr-sec-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.mx-dr-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text3)}',
    '.mx-dr-badge{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.04em;background:var(--_bg);color:var(--_fg)}',
    '.mx-dr-field{display:flex;flex-direction:column;gap:6px}',
    '.mx-dr-field-label{font-size:12.5px;color:var(--text2);font-weight:600}',
    '.mx-dr-field input,.mx-dr-field select,.mx-dr-field textarea{box-sizing:border-box;width:100%;background:var(--inputBg);border:1.5px solid var(--inputBorder);border-radius:6px;padding:10px 12px;font-size:13.5px;font-weight:600;color:var(--text);font-family:var(--font-ui);appearance:none;outline:none;transition:border-color .15s,box-shadow .15s}',
    '.mx-dr-field input[data-mono],.mx-dr-field textarea[data-mono]{font-family:var(--font-mono);font-variant-numeric:tabular-nums}',
    '.mx-dr-field input:focus,.mx-dr-field select:focus,.mx-dr-field textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.18)}',
    '.mx-dr-field textarea{resize:vertical;min-height:72px;line-height:1.5}',
    '.mx-dr-field select{padding-right:32px;cursor:pointer}',
    '.mx-dr-grid{display:grid;gap:12px}',
    '.mx-dr-sel{position:relative}',
    '.mx-dr-sel>.mx-icon{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--text3);pointer-events:none}',
    '.mx-dr-stat{display:flex;flex-direction:column;gap:12px}',
    '.mx-dr-stat-label{font-size:11.5px;color:var(--text3);font-weight:600}',
    '.mx-dr-stat-value{font-family:var(--font-display);font-variant-numeric:tabular-nums;font-size:29px;font-weight:700;letter-spacing:-.02em;color:var(--text)}',
    '.mx-dr-stat-meta{display:flex;align-items:center;gap:10px;font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:12.5px;font-weight:600;color:var(--text2);letter-spacing:.04em}',
    '.mx-dr-stat-meta .sep{opacity:.4}',
    '.mx-dr-note{display:flex;align-items:flex-start;gap:8px;padding-top:6px;border-top:1.5px solid var(--border);margin-top:4px}',
    '.mx-dr-note .mx-icon{color:var(--_line);flex-shrink:0;margin-top:3px}',
    '.mx-dr-note p{font-size:12.5px;line-height:1.5;color:var(--_line);font-weight:600;margin:0}',
    '.mx-dr-note[data-plain]{border-top:none;padding-top:0;margin-top:0}',
    '.mx-dr-muted{background:var(--mutedBox);border:1.5px solid var(--border);border-radius:8px;padding:14px;font-size:13px;font-weight:600;color:var(--text2)}',
    '.mx-dr-kv{display:flex;flex-direction:column}',
    '.mx-dr-kv-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1.5px solid var(--border)}',
    '.mx-dr-kv-row:last-child{border-bottom:none}',
    '.mx-dr-kv-row dt{font-size:12px;color:var(--text3);font-weight:600;margin:0}',
    '.mx-dr-kv-row dd{font-size:13px;color:var(--text);font-weight:700;margin:0;text-align:right;font-variant-numeric:tabular-nums}',
    '.mx-dr-empty{border:1.5px dashed var(--dashed);border-radius:10px;padding:20px 18px;display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center}',
    '.mx-dr-empty .mx-icon{color:var(--text3);margin-bottom:2px}',
    '.mx-dr-empty strong{font-size:13.5px;font-weight:700;color:var(--text2)}',
    '.mx-dr-empty span{font-size:12px;line-height:1.5;color:var(--text3);font-weight:500}',
    '.mx-dr-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}',
    '.mx-dr-toggle-row .lbl{font-size:13.5px;color:var(--text);font-weight:600}',
    '.mx-dr-switch{width:38px;height:22px;border-radius:999px;background:var(--toggleOff);flex-shrink:0;position:relative;display:inline-block;transition:background .2s}',
    '.mx-dr-switch i{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:999px;background:#fff;transition:left .2s var(--ease-spring);box-shadow:0 1px 3px rgba(0,0,0,.25)}',
    '.mx-dr-switch.is-on{background:var(--accent)}',
    '.mx-dr-switch.is-on i{left:18px}',
    '.mx-dr-help{font-size:11.5px;line-height:1.55;color:var(--text3);font-weight:500;margin:0}',
    '.mx-dr-list{display:flex;flex-direction:column;gap:8px}',
    '.mx-dr-list-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1.5px solid var(--border);border-radius:6px}',
    '.mx-dr-list-item .mx-icon{color:var(--_line);flex-shrink:0}',
    '.mx-dr-list-item .t{font-size:13px;font-weight:700;color:var(--text)}',
    '.mx-dr-list-item .s{font-size:11.5px;color:var(--text3);font-weight:500;margin-top:1px}',
    '.mx-dr-steps{display:flex;align-items:flex-start;gap:0}',
    '.mx-dr-step{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}',
    '.mx-dr-step-dot{width:26px;height:26px;border-radius:999px;border:2px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--text3)}',
    '.mx-dr-step[data-state="done"] .mx-dr-step-dot{background:rgba(var(--accent-rgb),.14);border-color:var(--accent);color:var(--accent)}',
    '.mx-dr-step[data-state="active"] .mx-dr-step-dot{background:var(--accent);border-color:var(--accent);color:#fff}',
    '.mx-dr-step-lbl{font-size:9.5px;font-weight:600;color:var(--text3);white-space:nowrap}',
    '.mx-dr-step[data-state] .mx-dr-step-lbl{color:var(--accent)}',
    '.mx-dr-step-line{flex:1;height:2px;background:var(--border);margin-top:12px;min-width:12px}',
    '.mx-dr-step-line[data-done]{background:var(--accent)}',
    '.mx-dr-divider{height:1.5px;background:var(--border);margin:0}',
    '.mx-dr-foot{flex-shrink:0;padding:16px 24px 22px;border-top:1.5px solid var(--border);display:flex;gap:10px}',
    '.mx-dr-btn{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:8px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:var(--font-ui);transition:transform .15s var(--ease-spring),opacity .15s,border-color .15s,color .15s}',
    '.mx-dr-btn[data-variant="primary"]{flex-grow:1;background:var(--accent);color:#fff;font-size:14px;padding:12px}',
    '.mx-dr-btn[data-variant="danger"]{flex-grow:1;background:var(--danger);color:#fff;font-size:14px;padding:12px}',
    '.mx-dr-btn[data-variant="ghost"]{border:1.5px solid var(--inputBorder);color:var(--text2)}',
    '.mx-dr-btn[data-variant="ghost"]:hover{border-color:var(--accent);color:var(--accent)}',
    '.mx-dr-btn:hover:not([disabled]){transform:translateY(-2px)}',
    '.mx-dr-btn[disabled]{opacity:.45;cursor:not-allowed}',
    '.mx-dr-theme{display:flex;gap:4px;background:var(--surface2);border:1.5px solid var(--border);border-radius:6px;padding:3px}',
    '.mx-dr-theme button{all:unset;cursor:pointer;font-family:var(--font-ui);font-size:11px;font-weight:700;padding:4px 10px;border-radius:3px;color:var(--text3);display:flex;align-items:center;gap:4px}',
    '.mx-dr-theme button.is-active{background:var(--accent);color:#fff}',
    '@media (max-width:520px){.mx-dr{width:100vw !important}}'
  ].join('');

  function ensureCSS() {
    if (document.getElementById('mx-drawer-css')) return;
    var s = document.createElement('style');
    s.id = 'mx-drawer-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── Rendu des blocs ────────────────────────────────────────────────── */
  function renderField(f) {
    var mono = f.mono ? ' data-mono' : '';
    var name = f.name ? ' data-field="' + esc(f.name) + '"' : '';
    var inner;
    if (f.kind === 'select') {
      inner = '<div class="mx-dr-sel"><select' + name + '>' +
        (f.options || []).map(function (o) {
          var val = typeof o === 'string' ? o : o.value;
          var lbl = typeof o === 'string' ? o : o.label;
          return '<option' + (f.value === val ? ' selected' : '') + '>' + esc(lbl) + '</option>';
        }).join('') + '</select>' + ic('chevron-down', { size: 14 }) + '</div>';
    } else if (f.kind === 'textarea') {
      inner = '<textarea' + name + mono + ' rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(f.value || '') + '</textarea>';
    } else {
      inner = '<input type="' + (f.kind === 'date' ? 'date' : 'text') + '"' + name + mono +
        ' value="' + esc(f.value || '') + '" placeholder="' + esc(f.placeholder || '') + '">';
    }
    return '<label class="mx-dr-field">' +
      (f.label ? '<span class="mx-dr-field-label">' + esc(f.label) + '</span>' : '') + inner + '</label>';
  }

  var RENDER = {
    section: function (b) {
      var t = tone(b.tone || 'warning');
      return '<div class="mx-dr-sec"' + (b.accent ? ' data-accent' : '') +
        ' style="--_line:' + t.line + '">' +
        (b.label || b.badge
          ? '<div class="mx-dr-sec-head">' +
            (b.label ? '<span class="mx-dr-label">' + esc(b.label) + '</span>' : '') +
            (b.badge ? '<span class="mx-dr-badge" style="--_bg:' + t.bg + ';--_fg:' + t.fg + '">' + esc(b.badge) + '</span>' : '') +
            '</div>'
          : '') +
        (b.children || []).map(renderBlock).join('') + '</div>';
    },
    fields: function (b) {
      return '<div class="mx-dr-grid" style="grid-template-columns:repeat(' + (b.cols || 1) + ',minmax(0,1fr))">' +
        (b.items || []).map(renderField).join('') + '</div>';
    },
    stat: function (b) {
      var t = b.note ? tone(b.note.tone || 'danger') : tone('neutral');
      return '<div class="mx-dr-stat">' +
        '<div style="display:flex;flex-direction:column;gap:2px">' +
          (b.label ? '<span class="mx-dr-stat-label">' + esc(b.label) + '</span>' : '') +
          '<span class="mx-dr-stat-value">' + esc(b.value) + '</span>' +
        '</div>' +
        (b.meta && b.meta.length
          ? '<div class="mx-dr-stat-meta">' + b.meta.map(esc).join('<span class="sep">/</span>') + '</div>'
          : '') +
        (b.note
          ? '<div class="mx-dr-note" style="--_line:' + t.line + '">' +
            ic(b.note.icon || 'alert-triangle', { size: 15 }) + '<p>' + esc(b.note.text) + '</p></div>'
          : '') +
        '</div>';
    },
    kv: function (b) {
      return '<dl class="mx-dr-kv">' + (b.items || []).map(function (r) {
        return '<div class="mx-dr-kv-row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      }).join('') + '</dl>';
    },
    note: function (b) {
      var t = tone(b.tone || 'danger');
      return '<div class="mx-dr-note" data-plain style="--_line:' + t.line + '">' +
        ic(b.icon || 'circle-alert', { size: 15 }) + '<p>' + esc(b.text) + '</p></div>';
    },
    muted: function (b) { return '<div class="mx-dr-muted">' + esc(b.text) + '</div>'; },
    empty: function (b) {
      return '<div class="mx-dr-empty">' + (b.icon ? ic(b.icon, { size: 22 }) : '') +
        '<strong>' + esc(b.title) + '</strong>' +
        (b.text ? '<span>' + esc(b.text) + '</span>' : '') + '</div>';
    },
    toggles: function (b) {
      return (b.items || []).map(function (t) {
        return '<div class="mx-dr-toggle-row" data-toggle="' + esc(t.name || '') + '">' +
          '<span class="lbl">' + esc(t.label) + '</span>' +
          '<span class="mx-dr-switch' + (t.on ? ' is-on' : '') + '"><i></i></span></div>';
      }).join('') + (b.help ? '<p class="mx-dr-help">' + esc(b.help) + '</p>' : '');
    },
    list: function (b) {
      return '<div class="mx-dr-list">' + (b.items || []).map(function (it) {
        var t = tone(it.tone || 'accent');
        return '<div class="mx-dr-list-item" style="--_line:' + t.line + '">' +
          (it.icon ? ic(it.icon, { size: 16 }) : '') +
          '<div style="flex:1;min-width:0"><div class="t">' + esc(it.title) + '</div>' +
          (it.sub ? '<div class="s">' + esc(it.sub) + '</div>' : '') + '</div>' +
          (it.badge ? '<span class="mx-dr-badge" style="--_bg:' + t.bg + ';--_fg:' + t.fg + '">' + esc(it.badge) + '</span>' : '') +
          '</div>';
      }).join('') + '</div>';
    },
    steps: function (b) {
      var items = b.items || [];
      return '<div class="mx-dr-steps">' + items.map(function (s, i) {
        var dot = s.state === 'done' ? ic('check', { size: 13 }) : String(i + 1);
        return '<div class="mx-dr-step"' + (s.state ? ' data-state="' + s.state + '"' : '') + '>' +
          '<div class="mx-dr-step-dot">' + dot + '</div>' +
          '<div class="mx-dr-step-lbl">' + esc(s.label) + '</div></div>' +
          (i < items.length - 1 ? '<div class="mx-dr-step-line"' + (s.state === 'done' ? ' data-done' : '') + '></div>' : '');
      }).join('') + '</div>';
    },
    divider: function () { return '<div class="mx-dr-divider"></div>'; },
    html: function (b) { return b.html || ''; }
  };

  function renderBlock(b) {
    if (!b || !b.type) return '';
    var fn = RENDER[b.type];
    return fn ? fn(b) : '';
  }

  /* ── Instance ───────────────────────────────────────────────────────── */
  var current = null;

  function open(cfg) {
    cfg = cfg || {};
    ensureCSS();
    close(true);

    var theme = cfg.theme || 'dark';
    var width = typeof cfg.size === 'number' ? cfg.size : (SIZES[cfg.size] || SIZES.md);
    var side = cfg.side === 'left' ? 'left' : 'right';
    var bandTone = cfg.band ? tone(cfg.band.tone || 'warning') : null;

    var scrim = document.createElement('div');
    scrim.className = 'mx-dr-scrim';
    if (cfg.dismissible !== false) scrim.addEventListener('click', function () { close(); });

    var el = document.createElement('aside');
    el.className = 'mx-dr' + (theme === 'inherit' ? '' : ' scope-' + theme);
    el.setAttribute('data-side', side);
    el.style.width = width + 'px';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', cfg.title || 'Panneau');

    var head =
      '<div class="mx-dr-head"><div class="mx-dr-head-row"><div style="min-width:0">' +
        (cfg.eyebrow ? '<div class="mx-dr-eyebrow">' + esc(cfg.eyebrow) + '</div>' : '') +
        '<div class="mx-dr-title">' + (cfg.titleIcon ? ic(cfg.titleIcon, { size: 22 }) : '') + esc(cfg.title || '') + '</div>' +
      '</div><div class="mx-dr-head-actions">' +
        (cfg.themeToggle
          ? '<div class="mx-dr-theme">' +
            '<button type="button" data-theme="dark" class="' + (theme === 'dark' ? 'is-active' : '') + '">' + ic('moon', { size: 12 }) + 'Dark</button>' +
            '<button type="button" data-theme="light" class="' + (theme === 'light' ? 'is-active' : '') + '">' + ic('sun', { size: 12 }) + 'Light</button>' +
            '</div>'
          : '') +
        (cfg.headerActions || []).map(function (a, i) {
          return '<button type="button" class="mx-dr-icon-btn" data-head-action="' + i + '" title="' + esc(a.label || '') + '">' + ic(a.icon, { size: 16 }) + '</button>';
        }).join('') +
        '<button type="button" class="mx-dr-icon-btn" data-close title="Fermer">' + ic('x', { size: 16 }) + '</button>' +
      '</div></div>' +
      (cfg.meta && cfg.meta.length
        ? '<div class="mx-dr-meta">' + cfg.meta.map(esc).join('<span class="sep">·</span>') + '</div>'
        : '') +
      '</div>';

    var band = cfg.band
      ? '<div class="mx-dr-band" style="background:' + bandTone.bg + ';color:' + bandTone.fg + '">' +
        (cfg.band.icon ? ic(cfg.band.icon, { size: 13 }) : '') +
        (cfg.band.labels || []).map(function (l) { return '<span class="lbl">' + esc(l) + '</span>'; })
          .join('<span class="dot"></span>') + '</div>'
      : '';

    var foot = '';
    if (cfg.footer) {
      var btns = [];
      if (cfg.footer.primary) {
        var p = cfg.footer.primary;
        btns.push('<button type="button" class="mx-dr-btn" data-variant="' + (p.variant || 'primary') + '" data-primary' +
          (p.disabled ? ' disabled' : '') + '>' + (p.icon ? ic(p.icon, { size: 16 }) : '') + esc(p.label) + '</button>');
      }
      (cfg.footer.secondary || []).forEach(function (s, i) {
        btns.push('<button type="button" class="mx-dr-btn" data-variant="ghost" data-secondary="' + i + '">' +
          (s.icon ? ic(s.icon, { size: 16 }) : '') + esc(s.label) + '</button>');
      });
      foot = '<div class="mx-dr-foot">' + btns.join('') + '</div>';
    }

    el.innerHTML = head + band +
      '<div class="mx-dr-body">' + (cfg.blocks || []).map(renderBlock).join('') + '</div>' + foot;

    document.body.append(scrim, el);
    requestAnimationFrame(function () { scrim.classList.add('is-open'); el.classList.add('is-open'); });

    /* état + portillon de validation */
    function state() {
      var s = { toggles: {}, fields: {} };
      el.querySelectorAll('[data-toggle]').forEach(function (r) {
        s.toggles[r.getAttribute('data-toggle')] = r.querySelector('.mx-dr-switch').classList.contains('is-on');
      });
      el.querySelectorAll('[data-field]').forEach(function (f) {
        s.fields[f.getAttribute('data-field')] = f.value;
      });
      return s;
    }
    function refresh() {
      var btn = el.querySelector('[data-primary]');
      if (!btn || !cfg.footer || !cfg.footer.primary || typeof cfg.footer.primary.gate !== 'function') return;
      btn.disabled = !cfg.footer.primary.gate(state());
    }

    el.querySelectorAll('[data-toggle]').forEach(function (row) {
      row.addEventListener('click', function () {
        row.querySelector('.mx-dr-switch').classList.toggle('is-on');
        refresh();
        if (cfg.onChange) cfg.onChange(state());
      });
    });
    el.querySelectorAll('[data-field]').forEach(function (f) {
      f.addEventListener('input', function () { refresh(); if (cfg.onChange) cfg.onChange(state()); });
    });
    el.querySelector('[data-close]').addEventListener('click', function () { close(); });
    el.querySelectorAll('[data-theme]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-theme');
        el.classList.remove('scope-dark', 'scope-light');
        el.classList.add('scope-' + t);
        el.querySelectorAll('[data-theme]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      });
    });
    (cfg.headerActions || []).forEach(function (a, i) {
      var b = el.querySelector('[data-head-action="' + i + '"]');
      if (b && a.onClick) b.addEventListener('click', function () { a.onClick(state(), api); });
    });
    if (cfg.footer) {
      var pb = el.querySelector('[data-primary]');
      if (pb && cfg.footer.primary.onClick) pb.addEventListener('click', function () { cfg.footer.primary.onClick(state(), api); });
      (cfg.footer.secondary || []).forEach(function (s, i) {
        var sb = el.querySelector('[data-secondary="' + i + '"]');
        if (sb && s.onClick) sb.addEventListener('click', function () { s.onClick(state(), api); });
      });
    }
    refresh();

    var first = el.querySelector('.mx-dr-body input,.mx-dr-body select,.mx-dr-body textarea');
    if (first && cfg.autofocus !== false) first.focus();

    var api = { el: el, state: state, refresh: refresh, close: close };
    current = { scrim: scrim, el: el, cfg: cfg };
    return api;
  }

  function close(immediate) {
    if (!current) return;
    var scrim = current.scrim, el = current.el, cfg = current.cfg;
    current = null;
    if (immediate) { scrim.remove(); el.remove(); return; }
    scrim.classList.remove('is-open');
    el.classList.remove('is-open');
    setTimeout(function () { scrim.remove(); el.remove(); if (cfg.onClose) cfg.onClose(); }, 320);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current && current.cfg.dismissible !== false) close();
  });

  var Drawer = { open: open, close: close, renderBlock: renderBlock, SIZES: SIZES, TONES: Object.keys(TONE) };

  /* ── Presets — démonstrations d'architectures différentes ──────────── */
  Drawer.presets = {
    /* Finalisation de deal (spec "Éditorial mono") */
    deal: function (over) {
      return Object.assign({
        theme: 'dark', size: 'md', themeToggle: true,
        title: 'ORELSAN', meta: ['21 / 08 / 2027'],
        band: { tone: 'warning', labels: ['Brouillon', 'À traiter'] },
        blocks: [
          { type: 'section', label: 'Paramètres fiscaux', badge: 'À CONFIRMER', accent: true, tone: 'warning', children: [
            { type: 'fields', cols: 1, items: [
              { kind: 'text', name: 'rate', mono: true, label: 'Taux de change (CHF pour 1 unité devise du deal)', placeholder: 'ex. 0.9328' }
            ] },
            { type: 'fields', cols: 2, items: [
              { kind: 'text', name: 'people', mono: true, label: 'Personnes', value: '1' },
              { kind: 'text', name: 'days', mono: true, label: 'Jours', value: '1' }
            ] },
            { type: 'fields', cols: 2, items: [
              { kind: 'select', name: 'taxStatus', label: 'Statut fiscal', options: ['Étranger imposable', 'Résident', 'Exonéré'] },
              { kind: 'select', name: 'category', label: 'Catégorie', options: ['Artiste', 'Technicien', 'Prestataire'] }
            ] }
          ] },
          { type: 'section', label: 'Cachet & calcul', children: [
            { type: 'stat', label: 'Cachet (offre)', value: '400 000,00 EUR', meta: ['MODE BRUT', 'DEVISE EUR'],
              note: { tone: 'danger', icon: 'alert-triangle', text: "Rate-card de l'édition non configuré : configurez le rate-card (edition_tax_config) pour calculer les prestations en nature." } }
          ] },
          { type: 'section', label: 'Grand livre', children: [{ type: 'muted', text: 'Aucun acompte versé.' }] },
          { type: 'empty', icon: 'folder-open', title: 'Refacturations : en attente de la source production',
            text: 'Location, prestations et merchandising seront alimentés automatiquement quand la source « prod » existera.' },
          { type: 'divider' },
          { type: 'section', label: 'Finalisation', children: [
            { type: 'toggles', items: [
              { name: 'fiscal', label: "J'ai vérifié les paramètres fiscaux" },
              { name: 'refac', label: 'Pas de refacturations en attente' }
            ], help: "Pour finaliser : saisir le taux de change, confirmer les paramètres fiscaux, lever l'interrupteur refacturations, accepter la clause de responsabilité dans la configuration de l'édition (roue dentée) avant de finaliser." }
          ] }
        ],
        footer: {
          primary: { label: 'Finaliser', gate: function (s) { return !!(s.fields.rate || '').trim() && s.toggles.fiscal && s.toggles.refac; } },
          secondary: [{ label: 'Générer le PDF', icon: 'file-down' }]
        }
      }, over || {});
    },

    /* Fiche artiste — lecture, KV + liste + étapes */
    artist: function (over) {
      return Object.assign({
        theme: 'inherit', size: 'md', titleIcon: 'music',
        eyebrow: 'Fiche artiste', title: 'David Guetta',
        meta: ['12 / 08 / 2026', 'Mainstage', '22:30'],
        band: { tone: 'success', icon: 'circle-check', labels: ['Contrat signé'] },
        blocks: [
          { type: 'stat', label: 'Cachet', value: '270 000 EUR', meta: ['MODE NET', 'DEVISE EUR'] },
          { type: 'section', label: 'Avancement', children: [
            { type: 'steps', items: [
              { label: 'Offre', state: 'done' }, { label: 'Validation', state: 'done' },
              { label: 'Contrat', state: 'done' }, { label: 'Signature', state: 'active' }, { label: 'Paiement' }
            ] }
          ] },
          { type: 'section', label: 'Détails', children: [
            { type: 'kv', items: [['Scène', 'Mainstage'], ['Durée du set', '90 min'], ['Loge', 'VIP A'], ['Touring party', '11 personnes']] }
          ] },
          { type: 'section', label: 'Contacts', children: [
            { type: 'list', items: [
              { icon: 'user', title: 'Marc Dupont', sub: 'marc@agency.com', badge: 'AGENT', tone: 'accent' },
              { icon: 'users', title: 'Sophie Ernst', sub: 'Ingénieure son', badge: 'TECH', tone: 'info' }
            ] }
          ] },
          { type: 'section', label: 'Notes', children: [
            { type: 'fields', cols: 1, items: [{ kind: 'textarea', name: 'notes', label: '', value: 'Rider technique à valider avant le 15 juin. Transport depuis GVA. Soundcheck 18h00.' }] }
          ] }
        ],
        footer: { primary: { label: 'Enregistrer', icon: 'check' }, secondary: [{ label: 'PDF', icon: 'file-down' }] }
      }, over || {});
    },

    /* Confirmation destructive — drawer court, sans corps de formulaire */
    confirm: function (over) {
      return Object.assign({
        theme: 'inherit', size: 'sm', titleIcon: 'alert-triangle',
        eyebrow: 'Action irréversible', title: 'Supprimer le deal',
        band: { tone: 'danger', icon: 'alert-triangle', labels: ['Danger'] },
        blocks: [
          { type: 'note', tone: 'danger', icon: 'circle-alert',
            text: 'Toutes les offres, contrats et paiements rattachés à ce deal seront définitivement supprimés.' },
          { type: 'kv', items: [['Deal', 'ORELSAN'], ['Édition', 'VENOGE 2027'], ['Montant engagé', '400 000 EUR']] },
          { type: 'toggles', items: [{ name: 'ack', label: "Je comprends que l'action est définitive" }] }
        ],
        footer: {
          primary: { label: 'Supprimer', icon: 'trash', variant: 'danger', gate: function (s) { return !!s.toggles.ack; } },
          secondary: [{ label: 'Annuler', onClick: function () { Drawer.close(); } }]
        }
      }, over || {});
    },

    /* Filtres — drawer à gauche, large, formulaire dense */
    filters: function (over) {
      return Object.assign({
        theme: 'inherit', size: 'lg', side: 'left', titleIcon: 'filter',
        eyebrow: 'Vue lineup', title: 'Filtres',
        blocks: [
          { type: 'section', label: 'Période', children: [
            { type: 'fields', cols: 2, items: [
              { kind: 'date', name: 'from', label: 'Du', value: '2026-08-11' },
              { kind: 'date', name: 'to', label: 'Au', value: '2026-08-15' }
            ] }
          ] },
          { type: 'section', label: 'Critères', children: [
            { type: 'fields', cols: 3, items: [
              { kind: 'select', name: 'stage', label: 'Scène', options: ['Toutes', 'Mainstage', 'Riverstage'] },
              { kind: 'select', name: 'status', label: 'Statut', options: ['Tous', 'Signé', 'En attente', 'Refusé'] },
              { kind: 'select', name: 'currency', label: 'Devise', options: ['Toutes', 'EUR', 'CHF'] }
            ] },
            { type: 'fields', cols: 2, items: [
              { kind: 'text', name: 'min', mono: true, label: 'Cachet min.', placeholder: '0' },
              { kind: 'text', name: 'max', mono: true, label: 'Cachet max.', placeholder: '999 999' }
            ] }
          ] },
          { type: 'section', label: 'Options', children: [
            { type: 'toggles', items: [
              { name: 'onlyGaps', label: 'Uniquement les contrats manquants' },
              { name: 'withRefac', label: 'Inclure les refacturations', on: true }
            ] }
          ] }
        ],
        footer: { primary: { label: 'Appliquer', icon: 'check' }, secondary: [{ label: 'Réinitialiser', icon: 'x' }] }
      }, over || {});
    }
  };

  global.Drawer = Drawer;
})(window);
