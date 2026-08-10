(() => {
  const map = document.querySelector('.about-capability-map');
  if (!map || map.dataset.capabilityMapInitialized === 'true') return;
  map.dataset.capabilityMapInitialized = 'true';

  const keys = Array.from(map.querySelectorAll('.about-capability-key span'));
  const lanes = Array.from(map.querySelectorAll('.about-capability-lane[data-lane]'));
  const laneIds = ['do', 'more', 'learn'];
  const mobileQuery = window.matchMedia('(max-width: 900px)');

  const richerMoreMeta = {
    'Swimming': ['Current: occasional', 'Want: more often'],
    'Sports': ['Current: occasional', 'Want: more often'],
    'Films': ['Current: occasional', 'Want: make room'],
    'Social outings': ['Current: some', 'Want: more'],
    'Travel & day trips': ['Current: occasional', 'Want: more often'],
    'Outdoors & hiking': ['Current: occasional', 'Want: more often'],
  };

  const addLearnDates = () => {
    const learnLane = map.querySelector('.about-capability-lane[data-lane="learn"]');
    if (!learnLane) return;
    learnLane.querySelectorAll('.about-capability-item').forEach((item) => {
      const meta = item.querySelector('.about-capability-meta');
      if (!meta || meta.querySelector('[data-added-date]')) return;
      const added = document.createElement('span');
      added.dataset.addedDate = 'true';
      added.className = 'about-capability-added';
      added.textContent = 'Added Aug 2026';
      meta.appendChild(added);
    });
  };

  const enrichMoreLane = () => {
    const moreLane = map.querySelector('.about-capability-lane[data-lane="more"]');
    if (!moreLane) return;
    moreLane.querySelectorAll('.about-capability-item').forEach((item) => {
      const title = item.querySelector('strong')?.textContent?.trim();
      const meta = item.querySelector('.about-capability-meta');
      const values = title ? richerMoreMeta[title] : null;
      if (!meta || !values) return;
      meta.replaceChildren(...values.map((value, index) => {
        const tag = document.createElement('span');
        tag.textContent = value;
        if (index === 1) tag.className = 'about-capability-want';
        return tag;
      }));
    });
  };

  const decorateKeys = () => {
    keys.forEach((key, index) => {
      const lane = lanes.find((candidate) => candidate.dataset.lane === laneIds[index]);
      if (!lane) return;
      const count = lane.querySelectorAll('.about-capability-item').length;
      const firstLine = key.innerHTML.split('<br>')[0].replace(/<[^>]*>/g, '').trim();
      const secondLine = key.innerHTML.split('<br>')[1]?.replace(/<[^>]*>/g, '').trim() || '';
      key.innerHTML = `<strong>${firstLine} <b aria-hidden="true">· ${count}</b></strong><small>${secondLine}</small>`;
      key.setAttribute('role', 'button');
      key.setAttribute('tabindex', '0');
      key.setAttribute('aria-controls', `capability-lane-${laneIds[index]}`);
      lane.id = `capability-lane-${laneIds[index]}`;
    });
  };

  let activeLane = mobileQuery.matches ? 'do' : null;

  const applyState = () => {
    const isMobile = mobileQuery.matches;
    map.classList.toggle('is-tabbed', isMobile);
    map.classList.toggle('is-focused', !isMobile && Boolean(activeLane));

    lanes.forEach((lane) => {
      const selected = !activeLane || lane.dataset.lane === activeLane;
      lane.classList.toggle('is-active', selected);
      lane.classList.toggle('is-muted', !isMobile && Boolean(activeLane) && !selected);
      lane.hidden = isMobile && !selected;
    });

    keys.forEach((key, index) => {
      const id = laneIds[index];
      const selected = id === activeLane;
      key.classList.toggle('is-active', selected);
      key.setAttribute('aria-pressed', String(selected));
    });
  };

  const activate = (id) => {
    if (!laneIds.includes(id)) return;
    if (!mobileQuery.matches && activeLane === id) activeLane = null;
    else activeLane = id;
    applyState();

    if (mobileQuery.matches) {
      const lane = lanes.find((candidate) => candidate.dataset.lane === activeLane);
      lane?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  decorateKeys();
  enrichMoreLane();
  addLearnDates();
  applyState();

  keys.forEach((key, index) => {
    const id = laneIds[index];
    key.addEventListener('click', () => activate(id));
    key.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activate(id);
    });
  });

  const handleViewportChange = () => {
    if (mobileQuery.matches && !activeLane) activeLane = 'do';
    if (!mobileQuery.matches && activeLane === 'do') activeLane = null;
    applyState();
  };

  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', handleViewportChange);
  else if (typeof mobileQuery.addListener === 'function') mobileQuery.addListener(handleViewportChange);
})();
