/* Two-stage visual-memory adornments for the About family portrait. */
(() => {
  const adornments = {
    dad: {
      file: 'dad-church-tower.svg',
      alt: 'Ruined church bell tower',
      corner: 'bottom-left',
      animation: 'rise',
      width: '29%',
      rotate: '-1deg',
      key: 'dad',
    },
    grandfather: {
      file: 'grandfather-hat.svg',
      alt: 'White cowboy hat',
      corner: 'top-left',
      animation: 'tip',
      width: '31%',
      rotate: '-4deg',
      key: 'grandfather',
    },
    grandmother: {
      file: 'grandmother-singer.svg',
      alt: 'Charro singer performing',
      corner: 'top-right',
      animation: 'swing',
      width: '34%',
      rotate: '1deg',
      key: 'grandmother',
    },
    uncle: {
      file: 'uncle-reader.svg',
      alt: 'Man reclining and reading',
      corner: 'bottom-right',
      animation: 'drift',
      width: '32%',
      rotate: '1deg',
      key: 'uncle',
    },
  };

  function adornmentUrl(file) {
    return new URL(`../images/about/cloud-adornments/${file}`, import.meta.url).href;
  }

  function setupFamilyPhoto(wrapper) {
    const bubble = wrapper.querySelector('.speech-bubble');
    if (!bubble || bubble.dataset.adornmentsReady === 'true') return;
    bubble.dataset.adornmentsReady = 'true';

    const img = document.createElement('img');
    img.className = 'cloud-adornment';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    img.draggable = false;
    bubble.append(img);

    let currentPerson = '';
    let revealFrame = 0;

    function clearAdornment() {
      currentPerson = '';
      bubble.removeAttribute('data-adornment');
      img.classList.remove('is-revealing');
      img.removeAttribute('src');
      img.removeAttribute('data-corner');
      img.removeAttribute('data-animation');
      img.style.removeProperty('--adornment-width');
      img.style.removeProperty('--adornment-final-rotate');
    }

    function syncAdornment() {
      const visible = bubble.getAttribute('data-visible') === '1';
      const person = bubble.getAttribute('data-person') || '';
      const config = adornments[person];

      if (!visible || !config) {
        if (!visible || currentPerson) clearAdornment();
        return;
      }

      if (currentPerson === person && img.classList.contains('is-revealing')) return;
      currentPerson = person;
      bubble.dataset.adornment = config.key;

      img.classList.remove('is-revealing');
      img.src = adornmentUrl(config.file);
      img.alt = config.alt;
      img.setAttribute('data-corner', config.corner);
      img.setAttribute('data-animation', config.animation);
      img.style.setProperty('--adornment-width', config.width);
      img.style.setProperty('--adornment-final-rotate', config.rotate);

      if (revealFrame) cancelAnimationFrame(revealFrame);
      // A frame boundary guarantees the secondary reveal restarts if users move
      // directly from one family member to another while the cloud is still open.
      revealFrame = requestAnimationFrame(() => {
        void img.offsetWidth;
        img.classList.add('is-revealing');
      });
    }

    const observer = new MutationObserver(syncAdornment);
    observer.observe(bubble, {
      attributes: true,
      attributeFilter: ['data-visible', 'data-person'],
    });

    syncAdornment();
  }

  function init() {
    document.querySelectorAll('[data-family-photo]').forEach(setupFamilyPhoto);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
