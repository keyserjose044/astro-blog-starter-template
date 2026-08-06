(() => {
  const panel = document.getElementById('family-where-panel');
  if (!panel) return;

  const dad = panel.querySelector('[aria-labelledby="family-roots-dad-title"]');
  const mom = panel.querySelector('[aria-labelledby="family-roots-mom-title"]');

  const mapMeta = [
    [dad, [
      ['Map of México locating Dad’s family roots in Aguascalientes.'],
      ['Map showing Aguascalientes within México.'],
      ['Map showing the municipality of Asientos within Aguascalientes.'],
      ['Local OpenStreetMap view centered on Amarillas de Esparza, Asientos, Aguascalientes.'],
    ]],
    [mom, [
      ['Map of México locating Mom’s family roots in Tamaulipas.'],
      ['Map showing Tamaulipas within México.'],
      ['Map showing the municipality of Matamoros within Tamaulipas.'],
      ['Local OpenStreetMap view centered on Colonia Progreso, Matamoros, Tamaulipas.'],
    ]],
  ];

  mapMeta.forEach(([branch, labels]) => {
    if (!branch) return;
    const slots = branch.querySelectorAll('.about-photo-map-slot');
    slots.forEach((slot, index) => {
      const label = labels[index]?.[0];
      if (!label) return;
      slot.setAttribute('aria-label', label);
      slot.removeAttribute('data-map-label');
      slot.classList.add('about-photo-map-slot--live');
    });
  });

  if (!panel.querySelector('.about-photo-map-credit')) {
    const credit = document.createElement('p');
    credit.className = 'about-photo-map-credit';
    credit.innerHTML = 'Map sources: <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> locator maps; local maps © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>. Matamoros locator map by MikSed, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.';
    panel.appendChild(credit);
  }
})();
