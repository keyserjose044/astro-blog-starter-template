(() => {
  const section = document.querySelector('[data-jose-constellation]');
  if (!section || section.dataset.joseEnhancementsInitialized === 'true') return;
  section.dataset.joseEnhancementsInitialized = 'true';

  const stage = section.querySelector('[data-jose-stage]');
  const poolScript = section.querySelector('[data-jose-pool]');
  const nodes = Array.from(section.querySelectorAll('[data-jose-node]'));
  const outerNodes = nodes.filter((node) => node.dataset.ring === 'outer');
  const lines = Array.from(section.querySelectorAll('[data-from][data-to]'));
  const actionButtons = section.querySelector('.jose-action-buttons');
  const shuffleButton = section.querySelector('[data-jose-shuffle]');
  const replayButton = section.querySelector('[data-jose-replay]');
  const inspectorInfo = section.querySelector('[data-jose-card-info]');
  const inspector = section.querySelector('[data-jose-inspector]');
  const centerCaption = section.querySelector('.jose-center-caption');
  const slider = section.querySelector('[data-jose-slider]');

  if (!stage || !poolScript || !nodes.length || !outerNodes.length || !actionButtons || !shuffleButton || !inspectorInfo || !inspector || !centerCaption || !slider) return;

  let pool = [];
  try {
    pool = JSON.parse(poolScript.textContent || '[]');
  } catch {
    pool = [];
  }
  if (!pool.length) return;

  const byId = new Map(pool.map((person) => [person.id, person]));
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const initialInnerIds = nodes
    .filter((node) => node.dataset.ring === 'inner')
    .map((node) => node.dataset.personId);
  const initialOuterIds = outerNodes.map((node) => node.dataset.personId);

  const style = document.createElement('style');
  style.textContent = `
    .jose-mode-bar{display:flex;flex-wrap:wrap;justify-content:center;gap:.4rem;max-width:960px;margin:0 auto .75rem;padding:.55rem .65rem;border:1px solid #dde4e0;border-radius:14px;background:rgba(255,255,255,.78)}
    .jose-mode-label{display:flex;align-items:center;margin-right:.15rem;color:var(--as-muted,#5c626c);font-size:.61rem;font-weight:850;letter-spacing:.07em;text-transform:uppercase}
    .jose-mode-button{min-height:32px;padding:.34rem .55rem;border:1px solid #d4dbd7;border-radius:999px;background:#fff;color:var(--as-green-dark,#174433);font:inherit;font-size:.64rem;font-weight:850;cursor:pointer}
    .jose-mode-button:hover{background:var(--as-green-soft,#eaf3ee)}
    .jose-mode-button[aria-pressed="true"]{border-color:var(--as-green,#245c46);background:var(--as-green,#245c46);color:#fff}
    .jose-mode-button:focus-visible{outline:3px solid #f0b84b;outline-offset:2px}
    .jose-stage.has-network-focus .jose-node:not(.is-active):not(.is-neighbor){opacity:.28!important}
    .jose-stage.has-network-focus .jose-node.is-neighbor{opacity:1!important}
    .jose-stage.has-network-focus .jose-lines line:not(.is-active-edge){opacity:.1!important}
    .jose-stage.has-network-focus .jose-lines line.is-active-edge{opacity:.92!important;stroke-width:2.05!important}
    .jose-node:hover .jose-node-float,.jose-node:focus .jose-node-float,.jose-node.is-active .jose-node-float,.jose-node.is-pinned .jose-node-float{animation-play-state:paused!important}
    .jose-node.is-mode-hidden{opacity:0!important;pointer-events:none!important}
    .jose-lines line.is-mode-hidden-edge{opacity:0!important}
    .jose-inspector-why{margin:.38rem 0 0!important;padding-top:.35rem;border-top:1px solid #edf0ee;color:var(--as-muted,#5c626c)!important;font-size:.7rem!important;line-height:1.4!important}
    .jose-inspector-why strong{display:inline!important;color:var(--as-green-dark,#174433)!important;font-size:inherit!important}
    .jose-surprise{border-color:#dccaa6!important;background:#fff9e8!important;color:#6f4d27!important}
    .jose-slider-milestones{position:relative;height:18px;margin-top:-1px;color:var(--as-muted,#5c626c);font-size:.52rem;font-weight:750;line-height:1}
    .jose-slider-milestone{position:absolute;top:3px;transform:translateX(-50%);white-space:nowrap}
    .jose-slider-milestone::before{position:absolute;top:-5px;left:50%;width:1px;height:4px;background:#bdc9c2;content:''}
    .jose-slider-milestone:first-child{transform:none}
    .jose-slider-milestone:first-child::before{left:0}
    .jose-slider-milestone:last-child{transform:translateX(-100%)}
    .jose-slider-milestone:last-child::before{left:100%}
    @media(max-width:760px){.jose-mode-bar{justify-content:flex-start}.jose-mode-label{width:100%;margin-bottom:.1rem}.jose-slider-milestone{font-size:.47rem}}
  `;
  section.appendChild(style);

  const modeBar = document.createElement('div');
  modeBar.className = 'jose-mode-bar';
  modeBar.setAttribute('aria-label', 'Choose a José constellation mode');

  const modeLabel = document.createElement('span');
  modeLabel.className = 'jose-mode-label';
  modeLabel.textContent = 'Constellation mode';
  modeBar.appendChild(modeLabel);

  const modes = [
    { id: 'featured', label: 'Featured', caption: 'the José at the center', match: null },
    { id: 'mexico', label: 'México', caption: 'José in México', match: (person) => normalize(person.country).includes('mexico') },
    { id: 'music', label: 'Music', caption: 'José in music', match: (person) => person.type === 'Music' },
    { id: 'literature', label: 'Literature', caption: 'José in literature', match: (person) => person.type === 'Literature' },
    { id: 'history', label: 'History', caption: 'José in history', match: (person) => person.type === 'History & politics' },
    { id: 'sports', label: 'Sports', caption: 'José in sport', match: (person) => person.type === 'Sports' },
    { id: 'name-family', label: 'Name family', caption: 'José across languages', match: (person) => person.type === 'Name family' },
    { id: 'random', label: 'Random', caption: 'another José universe', match: () => true },
  ];

  const modeButtons = new Map();
  modes.forEach((mode, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jose-mode-button';
    button.dataset.joseMode = mode.id;
    button.textContent = mode.label;
    button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
    modeButtons.set(mode.id, button);
    modeBar.appendChild(button);
  });

  const badge = section.querySelector('.jose-prototype-badge');
  if (badge) badge.insertAdjacentElement('afterend', modeBar);
  else stage.insertAdjacentElement('beforebegin', modeBar);

  const whyLine = document.createElement('p');
  whyLine.className = 'jose-inspector-why';
  whyLine.innerHTML = '<strong>Why this one?</strong> <span data-jose-card-why>The constellation is curated for variety across culture, place, history, and the wider Joseph name family.</span>';
  inspectorInfo.insertAdjacentElement('afterend', whyLine);
  const whyText = whyLine.querySelector('[data-jose-card-why]');

  const surpriseButton = document.createElement('button');
  surpriseButton.type = 'button';
  surpriseButton.className = 'jose-control-button jose-surprise';
  surpriseButton.dataset.joseSurprise = '';
  surpriseButton.textContent = '✦ Surprise me';
  surpriseButton.setAttribute('aria-label', 'Choose a random José from the archive');
  actionButtons.appendChild(surpriseButton);

  const milestoneWrap = document.createElement('div');
  milestoneWrap.className = 'jose-slider-milestones';
  milestoneWrap.setAttribute('aria-hidden', 'true');
  [
    { label: 'Signature', left: 0 },
    { label: 'Inner ring', left: 38 },
    { label: 'Outer ring', left: 72 },
    { label: 'Full web', left: 100 },
  ].forEach((milestone) => {
    const span = document.createElement('span');
    span.className = 'jose-slider-milestone';
    span.style.left = `${milestone.left}%`;
    span.textContent = milestone.label;
    milestoneWrap.appendChild(span);
  });
  slider.insertAdjacentElement('afterend', milestoneWrap);

  const explicitWhys = {
    'jose-jose': 'The doubled stage name makes José José an almost unavoidable anchor for a constellation built around the name itself.',
    napoleon: 'He adds another immediately recognizable Mexican musical José and connects the name to the romantic-song tradition.',
    jimenez: 'He gives the Mexican branch one of its strongest songwriting figures and ties José to ranchera culture.',
    cuervo: 'It is a useful oddball: José appears here not as a person but as a name that became a globally recognizable brand.',
    marti: 'He gives the constellation a major literary and historical José from Cuba rather than letting the project become mostly musicians.',
    rizal: 'He pushes the name far beyond the Spanish-speaking world while preserving its Hispanic colonial history.',
    capablanca: 'He adds chess and Cuba to the constellation, broadening the kinds of achievement represented by the name.',
    'san-martin': 'He gives the historical branch a major independence-era José from South America.',
    morelos: 'He makes the Mexican historical branch impossible to miss and balances the many artistic Josés.',
    orozco: 'He anchors Mexican muralism in the visual-arts branch of the constellation.',
    posada: 'His calaveras give the visual side of the constellation a distinctly Mexican graphic tradition.',
    joseph: 'Joseph shows the English branch of the same name family and makes the linguistic idea explicit.',
    yusuf: 'Yusuf shows how the same ancient name travels into Arabic and Islamic traditions.',
    giuseppe: 'Giuseppe makes the Italian branch visible and helps turn the constellation into a map of the name across languages.',
  };

  const whyFor = (person) => {
    if (!person) return 'This entry helps widen the constellation beyond a single country, era, or profession.';
    if (explicitWhys[person.id]) return explicitWhys[person.id];
    if (person.type === 'Name family') return `It shows another linguistic branch of the Joseph/José name family through ${person.country}.`;
    if (normalize(person.country).includes('mexico')) return `It strengthens the Mexican branch of the constellation through ${person.type.toLowerCase()}.`;
    if (person.type === 'Music') return `It expands one of the richest José clusters—music—through ${person.country}.`;
    if (person.type === 'Literature') return `It shows how widely José appears in literature beyond any one national tradition.`;
    if (person.type === 'Sports') return `It keeps the constellation from becoming only writers, artists, and historical figures by adding sport.`;
    if (person.type === 'History & politics') return `It adds historical breadth and connects José to public life in ${person.country}.`;
    if (person.type === 'Ideas & science') return `It extends the constellation into ideas, education, or science rather than culture alone.`;
    if (person.type === 'Art & film') return `It adds another visual or performing-arts route through which the name José appears.`;
    return `It broadens the constellation through ${person.type.toLowerCase()} and ${person.country}.`;
  };

  const personForNode = (node) => byId.get(node?.dataset.personId);

  const populateNode = (node, person) => {
    if (!node || !person) return;
    const orb = node.querySelector('.jose-node-orb');
    const label = node.querySelector('.jose-node-label');
    node.dataset.personId = person.id;
    node.dataset.joseTitle = person.label;
    node.dataset.joseType = person.type;
    node.dataset.joseCountry = person.country;
    node.dataset.joseInfo = person.info;
    node.setAttribute('aria-label', `Learn about ${person.label}`);
    if (orb) orb.textContent = person.icon;
    if (label) label.textContent = person.label;
  };

  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const clearNetworkFocus = () => {
    stage.classList.remove('has-network-focus');
    nodes.forEach((node) => node.classList.remove('is-neighbor'));
  };

  const focusNetwork = (node) => {
    if (!node) return;
    const slotId = node.dataset.joseNode;
    const neighborIds = new Set();
    lines.forEach((line) => {
      if (line.dataset.from === slotId) neighborIds.add(line.dataset.to);
      if (line.dataset.to === slotId) neighborIds.add(line.dataset.from);
    });
    nodes.forEach((candidate) => candidate.classList.toggle('is-neighbor', neighborIds.has(candidate.dataset.joseNode)));
    stage.classList.add('has-network-focus');
  };

  const syncInspectorWhy = (node) => {
    if (!whyText) return;
    whyText.textContent = whyFor(personForNode(node));
  };

  const visibleNodeForPerson = (personId) => nodes.find((node) => node.dataset.personId === personId);

  const syncDirectoryButtons = () => {
    const visibleIds = new Set(nodes.map((node) => node.dataset.personId));
    section.querySelectorAll('[data-feature-person]').forEach((button) => {
      const visible = visibleIds.has(button.dataset.featurePerson);
      button.dataset.visible = String(visible);
      button.textContent = visible ? 'View above ↑' : 'Put in ring ↑';
    });
  };

  const hideModeOverflow = (visibleOuterCount) => {
    outerNodes.forEach((node, index) => node.classList.toggle('is-mode-hidden', index >= visibleOuterCount));
    const hiddenSlots = new Set(outerNodes.filter((node) => node.classList.contains('is-mode-hidden')).map((node) => node.dataset.joseNode));
    lines.forEach((line) => {
      line.classList.toggle('is-mode-hidden-edge', hiddenSlots.has(line.dataset.from) || hiddenSlots.has(line.dataset.to));
    });
  };

  const setActiveMode = (modeId) => {
    modeButtons.forEach((button, id) => button.setAttribute('aria-pressed', id === modeId ? 'true' : 'false'));
  };

  const restoreFeatured = () => {
    const featuredIds = [...initialInnerIds, ...initialOuterIds];
    nodes.forEach((node, index) => {
      const person = byId.get(featuredIds[index]);
      if (person) populateNode(node, person);
    });
    hideModeOverflow(outerNodes.length);
  };

  const applyMode = (mode) => {
    if (!mode) return;
    clearNetworkFocus();
    nodes.forEach((node) => node.classList.remove('is-active', 'is-pinned'));
    setActiveMode(mode.id);
    centerCaption.textContent = mode.caption;

    if (mode.id === 'featured') {
      restoreFeatured();
      syncDirectoryButtons();
      return;
    }

    const innerVisibleIds = new Set(nodes.filter((node) => node.dataset.ring === 'inner').map((node) => node.dataset.personId));
    let matches = mode.id === 'random' ? shuffle(pool) : pool.filter(mode.match || (() => true));
    matches = shuffle(matches.filter((person) => !innerVisibleIds.has(person.id)));
    const selection = matches.slice(0, outerNodes.length);
    selection.forEach((person, index) => populateNode(outerNodes[index], person));
    hideModeOverflow(selection.length);
    syncDirectoryButtons();
  };

  const selectNode = (node) => {
    if (!node) return;
    node.click();
    syncInspectorWhy(node);
    focusNetwork(node);
  };

  modes.forEach((mode) => {
    modeButtons.get(mode.id)?.addEventListener('click', () => applyMode(mode));
  });

  nodes.forEach((node) => {
    node.addEventListener('mouseenter', () => {
      syncInspectorWhy(node);
      focusNetwork(node);
    });
    node.addEventListener('focus', () => {
      syncInspectorWhy(node);
      focusNetwork(node);
    });
    node.addEventListener('click', () => {
      window.setTimeout(() => {
        const pinned = stage.querySelector('.jose-node.is-pinned');
        if (pinned) {
          syncInspectorWhy(pinned);
          focusNetwork(pinned);
        } else {
          clearNetworkFocus();
        }
      }, 0);
    });
    node.addEventListener('mouseleave', () => {
      window.setTimeout(() => {
        const pinned = stage.querySelector('.jose-node.is-pinned');
        if (pinned) focusNetwork(pinned);
        else clearNetworkFocus();
      }, 0);
    });
    node.addEventListener('blur', () => {
      window.setTimeout(() => {
        const pinned = stage.querySelector('.jose-node.is-pinned');
        if (pinned) focusNetwork(pinned);
        else clearNetworkFocus();
      }, 0);
    });
  });

  inspector.querySelector('[data-jose-card-close]')?.addEventListener('click', () => {
    clearNetworkFocus();
    if (whyText) whyText.textContent = 'The constellation is curated for variety across culture, place, history, and the wider Joseph name family.';
  });

  // Replace the component's full-cast shuffle with a calmer discovery shuffle:
  // the inner ring remains recognizable while the outer ring rotates.
  shuffleButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    setActiveMode('featured');
    centerCaption.textContent = 'the José at the center';
    clearNetworkFocus();
    hideModeOverflow(outerNodes.length);

    const innerIds = new Set(nodes.filter((node) => node.dataset.ring === 'inner').map((node) => node.dataset.personId));
    const candidates = shuffle(pool.filter((person) => !innerIds.has(person.id)));
    candidates.slice(0, outerNodes.length).forEach((person, index) => populateNode(outerNodes[index], person));
    syncDirectoryButtons();

    stage.classList.add('is-shuffling');
    window.setTimeout(() => stage.classList.remove('is-shuffling'), reduceMotion ? 0 : 220);
  }, true);

  surpriseButton.addEventListener('click', () => {
    const person = pool[Math.floor(Math.random() * pool.length)];
    if (!person) return;
    let node = visibleNodeForPerson(person.id);
    if (!node) {
      const candidates = outerNodes.filter((candidate) => !candidate.classList.contains('is-mode-hidden'));
      node = candidates[Math.floor(Math.random() * Math.max(candidates.length, 1))] || outerNodes[0];
      populateNode(node, person);
      node.classList.remove('is-mode-hidden');
      lines.forEach((line) => {
        if (line.dataset.from === node.dataset.joseNode || line.dataset.to === node.dataset.joseNode) line.classList.remove('is-mode-hidden-edge');
      });
      syncDirectoryButtons();
    }
    if (Number(slider.value) < 96) {
      slider.value = '100';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const existingPinned = stage.querySelector('.jose-node.is-pinned');
    if (existingPinned && existingPinned !== node) existingPinned.click();
    selectNode(node);
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => node.focus({ preventScroll: true }), reduceMotion ? 0 : 320);
  });

  replayButton?.addEventListener('click', () => clearNetworkFocus());

  syncDirectoryButtons();
})();
