/* Prevent redundant DOM writes from creating self-triggering observer loops. */
(() => {
  if (window.__lifeloggerzBooksDomStability) return;
  window.__lifeloggerzBooksDomStability = true;

  const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  if (textContentDescriptor?.get && textContentDescriptor?.set) {
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: textContentDescriptor.configurable,
      enumerable: textContentDescriptor.enumerable,
      get: textContentDescriptor.get,
      set(value) {
        const next = value == null ? '' : String(value);
        if (textContentDescriptor.get.call(this) === next) return;
        textContentDescriptor.set.call(this, value);
      },
    });
  }

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function setAttribute(name, value) {
    const next = String(value);
    if (this.getAttribute(name) === next) return;
    nativeSetAttribute.call(this, name, value);
  };

  const nativeRemoveAttribute = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function removeAttribute(name) {
    if (!this.hasAttribute(name)) return;
    nativeRemoveAttribute.call(this, name);
  };

  const hiddenDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
  if (hiddenDescriptor?.get && hiddenDescriptor?.set) {
    Object.defineProperty(HTMLElement.prototype, 'hidden', {
      configurable: hiddenDescriptor.configurable,
      enumerable: hiddenDescriptor.enumerable,
      get: hiddenDescriptor.get,
      set(value) {
        const next = Boolean(value);
        if (hiddenDescriptor.get.call(this) === next) return;
        hiddenDescriptor.set.call(this, next);
      },
    });
  }
})();
