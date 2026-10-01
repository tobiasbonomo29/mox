/**
 * MOX · Componente de compra de la ficha de producto.
 *
 * Una sola fuente de estado ({ tier, units }) para todos los controles:
 * tarjetas de kit, selectores de cada anteojo, precio, resumen, botón
 * principal y barra de compra móvil. Los datos vienen del JSON que imprime
 * el bloque `mox-buy` con los productos reales del catálogo.
 */
import { formatMoney } from '@theme/money-formatting';
import { resolveKit, normalizeProduct, variantForTier } from '@theme/mox-pricing';
import { moxCart } from '@theme/mox-cart';

/**
 * Mensajes de error: clave del texto configurable (bloque "Compra MOX") y texto
 * por defecto. Marcadores: [n] número de anteojo, [modelo], [stock].
 */
const ERROR_TEXT = {
  'missing-selection': ['errMissing', 'Elegí un armazón para el anteojo [n].'],
  'unknown-product': ['errUnknown', 'El anteojo [n] no está disponible.'],
  'tier-unavailable': ['errTier', '[modelo] no tiene precio para este kit. Elegí otra combinación.'],
  'sold-out': ['errSoldOut', '[modelo] está agotado para este kit.'],
  'insufficient-stock': ['errStock', 'Solo quedan [stock] unidades de [modelo] para este kit.'],
};

class MoxBuy extends HTMLElement {
  /** @type {AbortController | null} */
  #abort = null;
  #busy = false;
  #state = { tier: 1, units: /** @type {Array<string|null>} */ ([]) };

  connectedCallback() {
    const dataEl = this.querySelector('script[data-mox-catalog]');
    if (!dataEl) return;

    let data;
    try {
      data = JSON.parse(dataEl.textContent || '{}');
    } catch (error) {
      console.error('[MOX] catálogo inválido', error);
      return;
    }

    this.moneyFormat = data.moneyFormat;
    this.currency = data.currency;
    this.lines = data.lines;
    this.current = data.current;
    this.ui = data.ui || {};
    this.catalog = {};
    this.meta = {};
    for (const raw of data.products) {
      this.catalog[raw.handle] = normalizeProduct(raw);
      this.meta[raw.handle] = raw;
    }

    const initialTier = Number(this.dataset.initialTier) || 1;
    this.#state = { tier: initialTier, units: Array(initialTier).fill(this.current) };

    this.#abort = new AbortController();
    const { signal } = this.#abort;

    this.addEventListener('change', this.#onChange, { signal });
    this.addEventListener('submit', this.#onSubmit, { signal });
    this.addEventListener('click', this.#onClick, { signal });

    this.#setupStickyBar(signal);
    this.render();
  }

  disconnectedCallback() {
    this.#abort?.abort();
    this.observer?.disconnect();
    document.body.classList.remove('mox-sticky-buy-visible');
  }

  /* ---------------- estado ---------------- */

  setTier(tier) {
    const units = this.#state.units.slice(0, tier);
    while (units.length < tier) units.push(this.current);
    this.#state = { tier, units };
    this.render();
    this.#syncUrl();
  }

  setUnit(index, handle) {
    const units = this.#state.units.slice();
    units[index] = handle;
    this.#state = { ...this.#state, units };
    this.render();
  }

  get resolution() {
    const units = this.#state.units.map((u) => (u && !u.startsWith('line:') ? u : null));
    return resolveKit({ tier: this.#state.tier, units, catalog: this.catalog });
  }

  /* ---------------- eventos ---------------- */

  #onChange = (event) => {
    const target = /** @type {HTMLInputElement | HTMLSelectElement} */ (event.target);

    if (target.matches('[data-mox-tier]')) {
      this.setTier(Number(target.value));
      if (Number(target.value) > 1 && this.ui.scrollToKit !== false) {
        const units = this.querySelector('[data-mox-units]');
        units?.querySelector('select')?.focus({ preventScroll: true });
        units?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      }
      return;
    }

    const unitEl = target.closest('[data-mox-unit]');
    if (!unitEl) return;
    const index = Number(unitEl.getAttribute('data-mox-unit'));

    if (target.matches('[data-mox-unit-line]')) {
      const line = this.lines.find((l) => String(l.index) === target.value);
      const currentHandle = this.#state.units[index];
      const frame = currentHandle ? this.meta[currentHandle]?.frameHandle : null;
      const candidate = line && frame ? `${line.handle}-armazon-${frame}` : null;
      // Si el armazón elegido no existe en la nueva línea, no se reemplaza por otro:
      // queda sin elegir y se pide al cliente que elija uno.
      this.setUnit(index, candidate && this.catalog[candidate] ? candidate : `line:${target.value}`);
      return;
    }

    if (target.matches('[data-mox-unit-frame]')) {
      this.setUnit(index, target.value || null);
    }
  };

  #onClick = (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest('[data-mox-sticky-submit]')) {
      event.preventDefault();
      this.#submit();
    }
  };

  #onSubmit = (event) => {
    event.preventDefault();
    this.#submit();
  };

  /* ---------------- render ---------------- */

  render() {
    const { tier, units } = this.#state;
    const realUnits = units.map((u) => (u && !u.startsWith('line:') ? u : null));
    const result = resolveKit({ tier, units: realUnits, catalog: this.catalog });

    // Tarjetas de kit
    this.querySelectorAll('[data-mox-tier]').forEach((input) => {
      const el = /** @type {HTMLInputElement} */ (input);
      el.checked = Number(el.value) === tier;
      el.closest('.mox-tier')?.classList.toggle('is-selected', el.checked);
    });

    this.#renderTierCards(tier, result);
    this.#renderUnits(tier, units);
    this.#renderPrice(tier, result);
    this.#renderSummary(tier, realUnits, result);
    this.#renderErrors(result);
    this.#renderButtons(result);
  }

  #money(cents) {
    return formatMoney(cents, this.moneyFormat, this.currency);
  }

  #nameOf(handle) {
    return this.meta[handle]?.display || handle;
  }

  /**
   * Texto configurable del bloque (Personalizar → Compra MOX) con marcadores
   * entre corchetes, p. ej. "Kit de [n] anteojos". Si está vacío usa el de fábrica.
   * @param {string} key
   * @param {string} fallback
   * @param {Record<string, string | number>} [vars]
   */
  #t(key, fallback, vars = {}) {
    const raw = this.ui[key] || fallback;
    return raw.replace(/\[(\w+)\]/g, (match, name) => (name in vars ? String(vars[name]) : match));
  }

  #renderTierCards(tier, result) {
    this.querySelectorAll('[data-mox-tier-card]').forEach((card) => {
      const cardTier = Number(card.getAttribute('data-mox-tier-card'));
      const totalEl = card.querySelector('[data-mox-tier-total]');
      if (!totalEl) return;
      if (cardTier === 1) {
        totalEl.textContent = '';
      } else if (cardTier === tier && result.unitPrices.length === tier) {
        totalEl.textContent = this.#t('tierTotal', 'Total [precio]', { precio: this.#money(result.total) });
      } else {
        const variant = variantForTier(this.catalog[this.current], cardTier);
        totalEl.textContent = variant ? this.#t('tierTotal', 'Total [precio]', { precio: this.#money(variant.price * cardTier) }) : '';
      }
    });
  }

  #renderUnits(tier, units) {
    const wrap = this.querySelector('[data-mox-units]');
    const template = /** @type {HTMLTemplateElement | null} */ (this.querySelector('template[data-mox-unit-template]'));
    if (!wrap || !template) return;

    wrap.hidden = tier < 2;
    if (tier < 2) {
      wrap.replaceChildren();
      return;
    }

    // Reutiliza los nodos existentes para no perder el foco del teclado.
    while (wrap.children.length > tier) wrap.lastElementChild?.remove();
    while (wrap.children.length < tier) {
      const node = /** @type {HTMLElement} */ (template.content.firstElementChild?.cloneNode(true));
      wrap.appendChild(node);
    }

    [...wrap.children].forEach((node, index) => {
      const el = /** @type {HTMLElement} */ (node);
      const value = units[index];
      const handle = value && !value.startsWith('line:') ? value : null;
      const lineIndex = handle ? this.meta[handle].lineIndex : Number((value || 'line:0').split(':')[1]);

      el.setAttribute('data-mox-unit', String(index));
      const legend = el.querySelector('[data-mox-unit-legend]');
      if (legend) legend.textContent = this.#t('unitLegend', 'Anteojo [n]', { n: index + 1 });

      const lineSelect = /** @type {HTMLSelectElement} */ (el.querySelector('[data-mox-unit-line]'));
      const frameSelect = /** @type {HTMLSelectElement} */ (el.querySelector('[data-mox-unit-frame]'));
      const lineId = `mox-unit-line-${this.dataset.blockId}-${index}`;
      const frameId = `mox-unit-frame-${this.dataset.blockId}-${index}`;
      lineSelect.id = lineId;
      frameSelect.id = frameId;
      el.querySelector('[data-mox-unit-line-label]')?.setAttribute('for', lineId);
      el.querySelector('[data-mox-unit-frame-label]')?.setAttribute('for', frameId);

      lineSelect.value = String(lineIndex);

      const line = this.lines.find((l) => l.index === lineIndex);
      const frames = Object.values(this.meta).filter((m) => m.lineIndex === lineIndex);
      const options = [];
      if (!handle) options.push(new Option(this.ui.chooseFrame ?? 'Elegí un armazón', '', true, true));
      for (const m of frames) {
        const variant = variantForTier(this.catalog[m.handle], tier);
        const label = variant
          ? variant.available
            ? m.frameName
            : `${m.frameName} · ${this.#t('soldOutShort', 'agotado')}`
          : `${m.frameName} · ${this.#t('notInKit', 'no disponible en este kit')}`;
        const option = new Option(label, m.handle, false, m.handle === handle);
        option.disabled = !variant || !variant.available;
        options.push(option);
      }
      frameSelect.replaceChildren(...options);

      const dot = /** @type {HTMLElement | null} */ (el.querySelector('[data-mox-unit-dot]'));
      if (dot && line) dot.style.setProperty('--mox-line-color', line.color);

      const img = /** @type {HTMLImageElement | null} */ (el.querySelector('[data-mox-unit-image]'));
      if (img) {
        const src = handle ? this.meta[handle].image : '';
        img.hidden = !src;
        if (src && img.getAttribute('src') !== src) {
          img.src = src;
          img.alt = this.#nameOf(handle);
        }
      }

      if (handle) frameSelect.removeAttribute('aria-invalid');
      else frameSelect.setAttribute('aria-invalid', 'true');

      const status = el.querySelector('[data-mox-unit-status]');
      if (status) {
        if (!handle) {
          // Sin armazón elegido el aviso se muestra como error (rojo) hasta que se elija uno.
          status.textContent = line ? this.#t('missingFrame', 'Falta elegir armazón.') : this.#t('chooseLine', 'Elegí una línea.');
          status.classList.add('is-warning');
        } else {
          const variant = variantForTier(this.catalog[handle], tier);
          status.textContent = variant
            ? this.#t('unitPrice', 'Llevando [n]: [precio] c/u', { n: tier, precio: this.#money(variant.price) })
            : this.#t('unavailable', 'No disponible en este kit');
          status.classList.toggle('is-warning', !variant || !variant.available);
        }
      }
    });
  }

  #renderPrice(tier, result) {
    const priceEl = this.querySelector('[data-mox-price]');
    const compareEl = /** @type {HTMLElement | null} */ (this.querySelector('[data-mox-compare]'));
    const unitEl = this.querySelector('[data-mox-unit-price]');
    const labelEl = this.querySelector('[data-mox-price-label]');

    // Si la selección está incompleta se muestra el precio de la ficha para ese nivel.
    const fallback = variantForTier(this.catalog[this.current], tier);
    const complete = result.unitPrices.length === tier;
    const total = complete ? result.total : fallback ? fallback.price * tier : 0;
    const compare = complete ? result.compareTotal : fallback && fallback.compareAtPrice > fallback.price ? fallback.compareAtPrice * tier : total;

    if (priceEl) priceEl.textContent = this.#money(total);
    if (labelEl) {
      labelEl.textContent = tier > 1 ? `${this.#t('priceLabelKit', 'Precio llevando')} ${tier}` : this.#t('priceLabel', 'Precio');
    }
    // El envío gratis es desde 2 anteojos.
    for (const el of this.querySelectorAll('[data-mox-ship]')) {
      /** @type {HTMLElement} */ (el).hidden = (el.getAttribute('data-mox-ship') === 'kit') !== tier > 1;
    }
    if (compareEl) {
      compareEl.hidden = !(compare > total);
      compareEl.textContent = compare > total ? this.#money(compare) : '';
    }
    if (unitEl) {
      const prices = result.unitPrices.length === tier ? result.unitPrices : fallback ? [fallback.price] : [];
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      unitEl.hidden = tier < 2 || !prices.length;
      unitEl.textContent =
        min === max
          ? this.#t('unitPrice', 'Llevando [n]: [precio] c/u', { n: tier, precio: this.#money(min) })
          : this.#t('unitPriceFrom', 'Llevando [n]: desde [precio] c/u', { n: tier, precio: this.#money(min) });
    }

    const stickyPrice = this.querySelector('[data-mox-sticky-price]');
    if (stickyPrice) stickyPrice.textContent = this.#money(total);
    const stickyLabel = this.querySelector('[data-mox-sticky-label]');
    if (stickyLabel) stickyLabel.textContent = tier > 1 ? this.#t('stickyKit', 'Kit de [n] anteojos', { n: tier }) : this.#nameOf(this.current);
  }

  #renderSummary(tier, units, result) {
    const list = this.querySelector('[data-mox-summary]');
    if (!list) return;
    const counts = new Map();
    units.forEach((h) => {
      const key = h || '';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const rows = [];
    for (const [handle, qty] of counts) {
      const li = document.createElement('li');
      if (!handle) {
        li.textContent = this.#t('summaryMissing', '[n] × armazón sin elegir', { n: qty });
      } else {
        const variant = variantForTier(this.catalog[handle], tier);
        const name = document.createElement('span');
        name.textContent = `${qty} × ${this.#nameOf(handle)}`;
        const price = document.createElement('span');
        price.textContent = variant ? this.#money(variant.price * qty) : '—';
        li.append(name, price);
      }
      rows.push(li);
    }
    list.replaceChildren(...rows);
    const wrap = this.querySelector('[data-mox-summary-wrap]');
    if (wrap) /** @type {HTMLElement} */ (wrap).hidden = tier < 2;
  }

  #renderErrors(result) {
    const box = /** @type {HTMLElement | null} */ (this.querySelector('[data-mox-errors]'));
    if (!box) return;
    const messages = result.errors
      .filter((e) => e.code !== 'units-mismatch' && e.code !== 'missing-selection')
      .map((e) => {
        const [key, fallback] = ERROR_TEXT[e.code] || ['errGeneric', 'Revisá tu selección.'];
        return this.#t(key, fallback, { n: e.unit, modelo: this.#nameOf(e.handle), stock: e.available });
      });
    box.textContent = messages.join(' ');
    box.hidden = messages.length === 0;
  }

  #renderButtons(result) {
    const ready = result.ok;
    this.querySelectorAll('[data-mox-submit], [data-mox-sticky-submit]').forEach((btn) => {
      const button = /** @type {HTMLButtonElement} */ (btn);
      if (this.#busy) return;
      button.disabled = !ready;
      const text = button.querySelector('[data-mox-submit-text]') || button;
      if (!ready && result.errors.some((e) => e.code === 'missing-selection')) {
        text.textContent = this.#t('chooseAll', 'Elegí todos los armazones');
      } else if (!ready && result.errors.some((e) => e.code === 'sold-out')) {
        text.textContent = this.#t('soldOut', 'Agotado');
      } else {
        text.textContent = button.dataset.labelAdd || 'Agregar al carrito';
      }
    });
    // El formulario nativo (sin JS) usa la variante del nivel 1 de esta ficha.
    const idInput = /** @type {HTMLInputElement | null} */ (this.querySelector('input[name="id"]'));
    const first = result.items[0];
    if (idInput && first && this.#state.tier === 1) idInput.value = String(first.id);
  }

  #syncUrl() {
    const variant = variantForTier(this.catalog[this.current], this.#state.tier);
    if (!variant || !window.history?.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.set('variant', String(variant.id));
    window.history.replaceState(window.history.state, '', url.toString());
  }

  /* ---------------- barra móvil ---------------- */

  #setupStickyBar(signal) {
    const bar = this.querySelector('[data-mox-sticky]');
    const anchor = this.querySelector('[data-mox-submit]');
    if (!bar || !anchor || !('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      ([entry]) => {
        const below = entry.boundingClientRect.top > 0;
        const show = !entry.isIntersecting && !below;
        bar.toggleAttribute('data-visible', show);
        bar.setAttribute('aria-hidden', String(!show));
        bar.querySelectorAll('button, a').forEach((el) => {
          if (show) el.removeAttribute('tabindex');
          else el.setAttribute('tabindex', '-1');
        });
        document.body.classList.toggle('mox-sticky-buy-visible', show);
      },
      { threshold: 0 }
    );
    this.observer.observe(anchor);

    // Mientras el formulario de compra está en pantalla, el botón flotante de
    // WhatsApp se oculta en móvil para no tapar precios ni controles.
    const form = this.querySelector('.mox-buy__form');
    if (form) {
      this.formObserver = new IntersectionObserver(([entry]) => {
        document.body.classList.toggle('mox-buy-in-view', entry.isIntersecting);
      });
      this.formObserver.observe(form);
    }
    signal.addEventListener('abort', () => {
      this.observer?.disconnect();
      this.formObserver?.disconnect();
      document.body.classList.remove('mox-buy-in-view');
    });
  }

  /* ---------------- agregar al carrito ---------------- */

  async #submit() {
    if (this.#busy) return;
    const result = this.resolution;
    if (!result.ok) {
      this.render();
      this.#announce(this.#t('reviewSelection', 'Revisá la selección antes de agregar.'));
      return;
    }

    this.#setBusy(true);
    const tier = this.#state.tier;
    const kitId = tier > 1 ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` : null;
    const items = result.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      properties: kitId ? { _moxKit: kitId, _moxKitSize: String(tier) } : {},
    }));

    try {
      const outcome = await moxCart.addKit(items, kitId, 'mox-buy');
      if (!outcome.ok) {
        this.#announce(outcome.message, true);
      } else {
        this.#announce(
          tier > 1
            ? this.#t('announceKit', 'Kit de [n] anteojos agregado al carrito.', { n: tier })
            : this.#t('announceSingle', 'Agregado al carrito.')
        );
        this.#flashAdded();
      }
    } finally {
      this.#setBusy(false);
      this.render();
    }
  }

  #setBusy(busy) {
    this.#busy = busy;
    this.toggleAttribute('data-busy', busy);
    this.querySelectorAll('[data-mox-submit], [data-mox-sticky-submit]').forEach((btn) => {
      const button = /** @type {HTMLButtonElement} */ (btn);
      button.disabled = busy;
      button.setAttribute('aria-busy', String(busy));
      const text = button.querySelector('[data-mox-submit-text]') || button;
      if (busy) text.textContent = this.#t('adding', 'Agregando…');
    });
  }

  #flashAdded() {
    const buttons = this.querySelectorAll('[data-mox-submit], [data-mox-sticky-submit]');
    buttons.forEach((btn) => {
      const text = btn.querySelector('[data-mox-submit-text]') || btn;
      text.textContent = this.#t('added', 'Agregado');
    });
    setTimeout(() => this.render(), 1600);
  }

  #announce(message, isError = false) {
    const live = this.querySelector('[data-mox-live]');
    const box = /** @type {HTMLElement | null} */ (this.querySelector('[data-mox-errors]'));
    if (live) {
      live.textContent = '';
      requestAnimationFrame(() => (live.textContent = message));
    }
    if (isError && box) {
      box.textContent = message;
      box.hidden = false;
    }
  }
}

if (!customElements.get('mox-buy')) customElements.define('mox-buy', MoxBuy);
