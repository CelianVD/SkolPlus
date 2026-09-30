(() => {
  'use strict';

  // Ne s'active que sur une page Skolengo (balise <meta name="generator" content="Skolengo">)
  const generatorMeta = document.querySelector('meta[name="generator"]');
  if (!generatorMeta || !/skolengo/i.test(generatorMeta.content)) return;

  const STORAGE_KEY = 'skolengoExtSettings';
  const DEFAULT_TARGETS = [
    '.header',
    '.header__set',
    '.header__set1',
    '.header__set2',
    'div.bar',
    'nav.menu',
    'ul.user',
    '.services-shortcut',
    '.services-shortcut__item--current',
    '.services-shortcut__item--current .services-shortcut__link',
    '.menu-donut',
    'button.burger.js-trigger-menu',
  ];
  const DEFAULT_HOVER_TARGETS = [
    '.services-shortcut__link',
    '.services-shortcut__button',
    '.services-list__group-name',
    '.services-sublist__item a',
    '.services-sublist2__deco a',
  ];
  const DEFAULTS = {
    hiddenTitles: [],
    layout: { left: [], right: [] },
    headerColor: '',
    headerTargets: [...DEFAULT_TARGETS],
    hoverColor: '',
    hoverTargets: [...DEFAULT_HOVER_TARGETS],
  };

  let settings = { ...DEFAULTS };
  let editMode = false;
  let picking = false;
  let pickingKey = 'headerTargets'; // 'headerTargets' | 'hoverTargets'
  let draggedEl = null;
  let armedHandleEl = null;
  let blocks = [];
  let columnEls = {};

  // --- Stockage (compatible browser.* et chrome.*) --------------------------
  function storageSet(obj) {
    if (typeof browser !== 'undefined' && browser.storage) return browser.storage.local.set(obj);
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
  }
  function storageGet(key) {
    if (typeof browser !== 'undefined' && browser.storage) return browser.storage.local.get(key);
    return new Promise((resolve) => chrome.storage.local.get(key, resolve));
  }
  function save() {
    storageSet({ [STORAGE_KEY]: settings });
  }

  // --- Détection des blocs et des colonnes -----------------------------------
  function getColumnEls() {
    return {
      left: document.querySelector('main .container > .row > [class*="col--md-5"]'),
      right: document.querySelector('main .container > .row > [class*="col--md-7"]'),
    };
  }

  // On part de chaque titre (h2/h3) et on remonte jusqu'au premier ancêtre qui
  // est un enfant DIRECT de la colonne : c'est le vrai conteneur du bloc,
  // quelle que soit la profondeur d'imbrication (elle varie selon les blocs).
  function detectBlocks() {
    const found = [];
    Object.entries(columnEls).forEach(([key, colEl]) => {
      if (!colEl) return;
      const headings = colEl.querySelectorAll('h2, h3');
      headings.forEach((heading) => {
        const title = heading.textContent.trim();
        if (!title) return;
        let node = heading.parentElement;
        let wrapper = null;
        while (node && node !== colEl) {
          if (node.parentElement === colEl) {
            wrapper = node;
            break;
          }
          node = node.parentElement;
        }
        if (!wrapper) return;
        if (found.some((b) => b.el === wrapper)) return;
        found.push({ el: wrapper, title, column: key });
      });
    });
    return found;
  }

  // --- Ordre / colonnes --------------------------------------------------------
  function applyLayout() {
    const layout = settings.layout || { left: [], right: [] };
    ['left', 'right'].forEach((key) => {
      const colEl = columnEls[key];
      if (!colEl) return;
      const placed = new Set();
      (layout[key] || []).forEach((t) => {
        const b = blocks.find((x) => x.title === t);
        if (b) {
          colEl.appendChild(b.el);
          placed.add(b.title);
        }
      });
      blocks
        .filter((b) => b.column === key && !placed.has(b.title))
        .forEach((b) => {
          colEl.appendChild(b.el);
          placed.add(b.title);
        });
    });
  }

  function snapshotLayout() {
    const layout = { left: [], right: [] };
    Object.entries(columnEls).forEach(([key, colEl]) => {
      if (!colEl) return;
      Array.from(colEl.children).forEach((child) => {
        const match = blocks.find((b) => b.el === child);
        if (match) layout[key].push(match.title);
      });
    });
    settings.layout = layout;
    save();
  }

  // --- Visibilité (masquer / afficher) -----------------------------------------
  // Le thème Skolengo force `display: flex !important` sur les .row : on doit
  // poser notre display avec !important nous aussi pour gagner.
  function applyVisibilityForBlock(b) {
    if (settings.hiddenTitles.includes(b.title)) {
      b.el.style.setProperty('display', 'none', 'important');
    } else {
      b.el.style.removeProperty('display');
    }
  }
  function applyVisibility() {
    blocks.forEach(applyVisibilityForBlock);
  }
  function toggleHidden(b) {
    const idx = settings.hiddenTitles.indexOf(b.title);
    if (idx === -1) settings.hiddenTitles.push(b.title);
    else settings.hiddenTitles.splice(idx, 1);
    const hidden = settings.hiddenTitles.includes(b.title);
    b.el.classList.toggle('skolengo-ext-hidden-editing', hidden);
    const btn = b.el.querySelector('.skolengo-ext-hidebtn');
    if (btn) btn.textContent = hidden ? '🚫' : '👁';
    save();
    if (!editMode) applyVisibilityForBlock(b);
  }

  // --- Réordonner avec les flèches (utile pour les blocs longs) ----------------
  function moveBlock(b, direction) {
    const colEl = columnEls[b.column];
    if (!colEl) return;
    const siblings = Array.from(colEl.children).filter((c) => blocks.some((x) => x.el === c));
    const idx = siblings.indexOf(b.el);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    if (direction === 'up') colEl.insertBefore(b.el, other);
    else colEl.insertBefore(other, b.el);
    snapshotLayout();
  }

  // --- Couleurs ------------------------------------------------------------------
  function applyColors() {
    let style = document.getElementById('skolengo-ext-colors');
    if (!style) {
      style = document.createElement('style');
      style.id = 'skolengo-ext-colors';
      document.head.appendChild(style);
    }
    if (!settings.headerColor || !settings.headerTargets.length) {
      style.textContent = '';
      return;
    }
    const selector = settings.headerTargets.join(', ');
    style.textContent = `${selector} { background: ${settings.headerColor} !important; background-image: none !important; }`;
  }

  function applyHoverColor() {
    let style = document.getElementById('skolengo-ext-hover-colors');
    if (!style) {
      style = document.createElement('style');
      style.id = 'skolengo-ext-hover-colors';
      document.head.appendChild(style);
    }
    if (!settings.hoverColor || !settings.hoverTargets.length) {
      style.textContent = '';
      return;
    }
    const selector = settings.hoverTargets.map((s) => `${s}:hover`).join(', ');
    style.textContent = `${selector} { background: ${settings.hoverColor} !important; background-image: none !important; }`;
  }

  function buildSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const cleanClasses = (node) => Array.from(node.classList).filter((c) => !c.startsWith('skolengo-ext'));
    const own = cleanClasses(el);
    if (own.length) {
      const sel = el.tagName.toLowerCase() + '.' + own.map((c) => CSS.escape(c)).join('.');
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    let node = el;
    const parts = [];
    for (let i = 0; i < 6 && node && node !== document.body && node.parentElement; i += 1) {
      let part = node.tagName.toLowerCase();
      const classes = cleanClasses(node);
      if (classes.length) part += '.' + classes.map((c) => CSS.escape(c)).join('.');
      const parent = node.parentElement;
      const sameTagSiblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (sameTagSiblings.length > 1) part += `:nth-of-type(${sameTagSiblings.indexOf(node) + 1})`;
      parts.unshift(part);
      const candidate = parts.join(' > ');
      if (document.querySelectorAll(candidate).length === 1) return candidate;
      node = parent;
    }
    return parts.join(' > ');
  }

  function onPickHover(e) {
    const prev = document.querySelector('.skolengo-ext-picking-hover');
    if (prev) prev.classList.remove('skolengo-ext-picking-hover');
    if (e.target.closest('#skolengo-ext-panel, #skolengo-ext-toggle, #skolengo-ext-editswitch')) return;
    e.target.classList.add('skolengo-ext-picking-hover');
  }
  function onPickClick(e) {
    if (e.target.closest('#skolengo-ext-panel, #skolengo-ext-toggle, #skolengo-ext-editswitch')) return;
    e.preventDefault();
    e.stopPropagation();
    const sel = buildSelector(e.target);
    if (!settings[pickingKey].includes(sel)) {
      settings[pickingKey].push(sel);
      save();
      if (pickingKey === 'hoverTargets') applyHoverColor();
      else applyColors();
      if (typeof window.__skolengoRenderTargets === 'function') window.__skolengoRenderTargets(pickingKey);
    }
    stopPicking();
  }
  function startPicking(key) {
    pickingKey = key;
    picking = true;
    document.body.classList.add('skolengo-ext-picking');
    document.addEventListener('mouseover', onPickHover, true);
    document.addEventListener('click', onPickClick, true);
  }
  function stopPicking() {
    picking = false;
    document.body.classList.remove('skolengo-ext-picking');
    document.removeEventListener('mouseover', onPickHover, true);
    document.removeEventListener('click', onPickClick, true);
    const prev = document.querySelector('.skolengo-ext-picking-hover');
    if (prev) prev.classList.remove('skolengo-ext-picking-hover');
  }

  // --- Mode édition + glisser-déposer --------------------------------------------
  function prepareBlockForEdit(b) {
    b.el.style.position = 'relative';
    b.el.setAttribute('draggable', 'true');
    if (!b.el.querySelector(':scope > .skolengo-ext-block-toolbar')) {
      const toolbar = document.createElement('div');
      toolbar.className = 'skolengo-ext-block-toolbar';
      const hidden = settings.hiddenTitles.includes(b.title);
      toolbar.innerHTML = `
        <button type="button" class="skolengo-ext-movebtn" data-dir="up" title="Monter d'un cran">▲</button>
        <button type="button" class="skolengo-ext-movebtn" data-dir="down" title="Descendre d'un cran">▼</button>
        <span class="skolengo-ext-handle" title="Glisser pour déplacer">⠿</span>
        <button type="button" class="skolengo-ext-hidebtn" title="Afficher / masquer ce bloc">${hidden ? '🚫' : '👁'}</button>
      `;
      b.el.prepend(toolbar);

      toolbar.querySelector('.skolengo-ext-hidebtn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleHidden(b);
      });
      toolbar.querySelectorAll('.skolengo-ext-movebtn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          moveBlock(b, btn.dataset.dir);
        });
      });
      // Le drag HTML5 natif dispatche dragstart avec target = l'élément
      // draggable (le bloc), pas l'élément réellement cliqué (la poignée).
      // On "arme" donc le drag au mousedown sur la poignée, et dragstart
      // vérifie juste que le bloc est armé.
      toolbar.querySelector('.skolengo-ext-handle').addEventListener('mousedown', () => {
        armedHandleEl = b.el;
      });
    }
    b.el.classList.toggle('skolengo-ext-hidden-editing', settings.hiddenTitles.includes(b.title));
    b.el.style.removeProperty('display'); // toujours visible pendant l'édition, même si "masqué"
    wireDragEvents(b);
  }

  function cleanupBlockEdit(b) {
    b.el.removeAttribute('draggable');
    b.el.style.removeProperty('position');
    const toolbar = b.el.querySelector(':scope > .skolengo-ext-block-toolbar');
    if (toolbar) toolbar.remove();
    b.el.classList.remove('skolengo-ext-hidden-editing');
    delete b.el.dataset.skolengoDndWired;
    applyVisibilityForBlock(b);
  }

  function setEditMode(on) {
    editMode = on;
    document.body.classList.toggle('skolengo-ext-editing', on);
    blocks.forEach((b) => (on ? prepareBlockForEdit(b) : cleanupBlockEdit(b)));
    if (on) wireColumnDropzones();
    else snapshotLayout();
  }

  function wireDragEvents(b) {
    const el = b.el;
    if (el.dataset.skolengoDndWired) return;
    el.dataset.skolengoDndWired = '1';

    el.addEventListener('dragstart', (e) => {
      if (armedHandleEl !== el) {
        e.preventDefault();
        return;
      }
      draggedEl = el;
      el.classList.add('skolengo-ext-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', b.title);
      } catch (err) {
        /* ignore */
      }
    });

    el.addEventListener('dragover', (e) => {
      if (!draggedEl || draggedEl === el) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const before = e.clientY - rect.top < rect.height / 2;
      const parent = el.parentElement;
      if (before) parent.insertBefore(draggedEl, el);
      else parent.insertBefore(draggedEl, el.nextSibling);
    });

    el.addEventListener('drop', (e) => e.preventDefault());

    el.addEventListener('dragend', () => {
      el.classList.remove('skolengo-ext-dragging');
      draggedEl = null;
      armedHandleEl = null;
      snapshotLayout();
    });
  }

  function wireColumnDropzones() {
    Object.values(columnEls).forEach((colEl) => {
      if (!colEl || colEl.dataset.skolengoDndWired) return;
      colEl.dataset.skolengoDndWired = '1';
      colEl.addEventListener('dragover', (e) => {
        if (!draggedEl) return;
        e.preventDefault();
        if (e.target === colEl) colEl.appendChild(draggedEl);
      });
      colEl.addEventListener('drop', (e) => e.preventDefault());
    });
    if (!wireColumnDropzones.mouseupWired) {
      wireColumnDropzones.mouseupWired = true;
      document.addEventListener('mouseup', () => {
        armedHandleEl = null;
      });
    }
  }

  // --- Rafraîchissements Ajax (widgets aria-live de Skolengo) --------------------
  // Certaines cartes (ex. "Évaluations") sont remplacées dynamiquement par le
  // site après le chargement initial, ce qui peut invalider notre câblage. On
  // observe donc les colonnes et on redétecte/recâble automatiquement.
  function refresh() {
    const fresh = detectBlocks();
    const changed =
      fresh.length !== blocks.length ||
      fresh.some((f) => {
        const prev = blocks.find((b) => b.title === f.title);
        return !prev || prev.el !== f.el;
      });

    blocks = fresh;
    applyLayout();
    applyVisibility();
    if (editMode) blocks.forEach(prepareBlockForEdit);

    if (changed) {
      // eslint-disable-next-line no-console
      console.debug('[Skolengo Amélioré] blocs détectés :', blocks.map((b) => `${b.title} (${b.column})`));
    }
  }

  let refreshTimer = null;
  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 400);
  }

  function watchForAsyncUpdates() {
    const observer = new MutationObserver(() => scheduleRefresh());
    Object.values(columnEls).forEach((colEl) => {
      if (colEl) observer.observe(colEl, { childList: true, subtree: true });
    });
  }

  // --- Interface -------------------------------------------------------------------
  // Interrupteur "Édition" intégré nativement dans la barre du haut (à droite,
  // à côté de l'icône cookies / aide). Repli en pastille flottante si cette
  // zone n'existe pas sur une page donnée.
  function mountEditSwitch() {
    const host = document.querySelector('.header__set2');
    const editSwitch = document.createElement('button');
    editSwitch.id = 'skolengo-ext-editswitch';
    editSwitch.type = 'button';
    editSwitch.setAttribute('aria-pressed', 'false');
    editSwitch.title = "Activer / désactiver le mode édition de l'accueil";
    editSwitch.innerHTML = '<span class="skolengo-ext-dot" aria-hidden="true"></span>Édition';
    editSwitch.className = host ? 'btn btn--naked text--white skolengo-ext-headerbtn' : 'skolengo-ext-headerbtn skolengo-ext-headerbtn--floating';

    if (host) {
      host.insertBefore(editSwitch, host.firstChild);
    } else {
      document.body.appendChild(editSwitch);
    }

    editSwitch.addEventListener('click', () => {
      const next = editSwitch.getAttribute('aria-pressed') !== 'true';
      editSwitch.setAttribute('aria-pressed', String(next));
      setEditMode(next);
    });
  }

  function buildSettingsPanel() {
    const host = document.querySelector('.header__set2');
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'skolengo-ext-toggle';
    toggleBtn.type = 'button';
    toggleBtn.title = 'Réglages Skolengo Amélioré';

    if (host) {
      toggleBtn.className = 'btn btn--naked text--white skolengo-ext-headerbtn';
      toggleBtn.innerHTML = '<span class="icon icon--prefs-menu icon--md" aria-hidden="true"></span><span class="visually-hidden">Réglages Skolengo Amélioré</span>';
      host.insertBefore(toggleBtn, host.firstChild);
    } else {
      toggleBtn.className = 'skolengo-ext-gearbtn--floating';
      toggleBtn.textContent = '⚙️';
      document.body.appendChild(toggleBtn);
    }

    const panel = document.createElement('div');
    panel.id = 'skolengo-ext-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <h2>Personnaliser Skolengo</h2>
      <section>
        <h3>Couleur de la barre du haut</h3>
        <label>Couleur <input type="color" id="skolengo-ext-headercolor" value="#1c1c1c"></label>
        <button type="button" id="skolengo-ext-pick">🎯 Cibler une zone non colorée</button>
        <ul id="skolengo-ext-targetlist"></ul>
        <button type="button" id="skolengo-ext-resetcolor">Réinitialiser la couleur</button>
      </section>
      <section>
        <h3>Couleur au survol (menu de gauche)</h3>
        <label>Couleur <input type="color" id="skolengo-ext-hovercolor" value="#1c1c1c"></label>
        <button type="button" id="skolengo-ext-pick-hover">🎯 Cibler un onglet non coloré</button>
        <ul id="skolengo-ext-hovertargetlist"></ul>
        <button type="button" id="skolengo-ext-resethover">Réinitialiser la couleur au survol</button>
      </section>
      <p class="skolengo-ext-hint">Le bouton « Édition » est intégré dans la barre du haut, à droite. Active-le pour glisser-déposer un bloc (poignée ⠿), le monter/descendre d'un cran (▲▼) ou le masquer (👁).</p>
    `;
    document.body.appendChild(panel);

    toggleBtn.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
    });

    const headerColorInput = panel.querySelector('#skolengo-ext-headercolor');
    if (settings.headerColor) headerColorInput.value = settings.headerColor;
    headerColorInput.addEventListener('input', () => {
      settings.headerColor = headerColorInput.value;
      save();
      applyColors();
    });

    const hoverColorInput = panel.querySelector('#skolengo-ext-hovercolor');
    if (settings.hoverColor) hoverColorInput.value = settings.hoverColor;
    hoverColorInput.addEventListener('input', () => {
      settings.hoverColor = hoverColorInput.value;
      save();
      applyHoverColor();
    });

    function makeTargetListRenderer(listEl, settingsKey, onChangeApply) {
      return function render() {
        listEl.innerHTML = '';
        settings[settingsKey].forEach((sel) => {
          const li = document.createElement('li');
          const code = document.createElement('code');
          code.textContent = sel;
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.textContent = '✕';
          removeBtn.title = 'Retirer cette zone';
          removeBtn.addEventListener('click', () => {
            settings[settingsKey] = settings[settingsKey].filter((s) => s !== sel);
            save();
            onChangeApply();
            render();
          });
          li.appendChild(code);
          li.appendChild(removeBtn);
          listEl.appendChild(li);
        });
      };
    }

    const renderHeaderTargetList = makeTargetListRenderer(
      panel.querySelector('#skolengo-ext-targetlist'),
      'headerTargets',
      applyColors
    );
    const renderHoverTargetList = makeTargetListRenderer(
      panel.querySelector('#skolengo-ext-hovertargetlist'),
      'hoverTargets',
      applyHoverColor
    );
    renderHeaderTargetList();
    renderHoverTargetList();
    window.__skolengoRenderTargets = (key) => {
      if (key === 'hoverTargets') renderHoverTargetList();
      else renderHeaderTargetList();
    };

    panel.querySelector('#skolengo-ext-pick').addEventListener('click', () => {
      panel.hidden = true;
      startPicking('headerTargets');
    });
    panel.querySelector('#skolengo-ext-pick-hover').addEventListener('click', () => {
      panel.hidden = true;
      startPicking('hoverTargets');
    });

    panel.querySelector('#skolengo-ext-resetcolor').addEventListener('click', () => {
      settings.headerColor = '';
      settings.headerTargets = [...DEFAULT_TARGETS];
      headerColorInput.value = '#1c1c1c';
      save();
      applyColors();
      renderHeaderTargetList();
    });
    panel.querySelector('#skolengo-ext-resethover').addEventListener('click', () => {
      settings.hoverColor = '';
      settings.hoverTargets = [...DEFAULT_HOVER_TARGETS];
      hoverColorInput.value = '#1c1c1c';
      save();
      applyHoverColor();
      renderHoverTargetList();
    });
  }

  // --- Démarrage -----------------------------------------------------------------------
  storageGet(STORAGE_KEY).then((res) => {
    const stored = (res && res[STORAGE_KEY]) || {};
    settings = {
      ...DEFAULTS,
      ...stored,
      layout: { left: [], right: [], ...(stored.layout || {}) },
      headerTargets: stored.headerTargets && stored.headerTargets.length ? stored.headerTargets : [...DEFAULT_TARGETS],
      hoverTargets: stored.hoverTargets && stored.hoverTargets.length ? stored.hoverTargets : [...DEFAULT_HOVER_TARGETS],
    };

    columnEls = getColumnEls();
    blocks = detectBlocks();
    // eslint-disable-next-line no-console
    console.debug('[Skolengo Amélioré] blocs détectés :', blocks.map((b) => `${b.title} (${b.column})`));

    applyLayout();
    applyVisibility();
    applyColors();
    applyHoverColor();
    mountEditSwitch();
    buildSettingsPanel();
    watchForAsyncUpdates();
  });
})();
