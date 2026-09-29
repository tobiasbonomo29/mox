/**
 * MOX · Operaciones de carrito compartidas.
 *
 * - Cola única: ninguna operación de kit se superpone con otra (doble clic,
 *   recálculos concurrentes).
 * - addKit: agrega todas las líneas de un kit en una sola solicitud. Si Shopify
 *   agrega solo una parte (p. ej. por stock), la quita y lo explica.
 * - Recálculo: cuando cambia la cantidad de anteojos de un kit, cada línea pasa
 *   a la variante del nivel que corresponde (el precio lo define Shopify por
 *   variante). Se dispara con los eventos `cart:update` del tema y al cargar la
 *   página; no hay sondeo periódico.
 */
import { CartAddEvent, CartUpdateEvent, ThemeEvents } from '@theme/events';
import { normalizeProduct, planRebalance } from '@theme/mox-pricing';

const SOURCE = 'mox-cart';
const NOTICE_KEY = 'mox-kit-notice';

/**
 * Textos editables (Configuración del tema → MOX · Textos), impresos por
 * layout/theme.liquid en window.moxTexts. Si falta uno se usa el de fábrica.
 * @param {string} key
 * @param {string} fallback
 * @param {Record<string, string | number>} [vars]
 */
function text(key, fallback, vars = {}) {
  const raw = (window.moxTexts && window.moxTexts[key]) || fallback;
  return raw.replace(/[(w+)]/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

function root() {
  return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
}

function sectionIds() {
  const ids = new Set();
  document.querySelectorAll('cart-items-component').forEach((el) => {
    const id = /** @type {HTMLElement} */ (el).dataset.sectionId;
    if (id) ids.add(id);
  });
  return [...ids];
}

async function postJSON(path, body) {
  const response = await fetch(root() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }
  return { ok: response.ok, status: response.status, data };
}

async function getCart() {
  const response = await fetch(root() + 'cart.js', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`cart.js ${response.status}`);
  return response.json();
}

function countFromSections(sections) {
  if (!sections) return null;
  for (const html of Object.values(sections)) {
    if (typeof html !== 'string') continue;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const node = doc.querySelector('[ref="cartItemCount"]');
    if (node) return parseInt(node.textContent || '0', 10) || 0;
  }
  return null;
}

let queue = Promise.resolve();
/** Ejecuta las operaciones de a una. */
function exclusive(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

const productCache = new Map();
function fetchProduct(handle) {
  if (!productCache.has(handle)) {
    productCache.set(
      handle,
      fetch(`${root()}products/${encodeURIComponent(handle)}.js`, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then(normalizeProduct)
        .catch(() => null)
    );
  }
  return productCache.get(handle);
}

function isMoxHandle(handle) {
  return typeof handle === 'string' && handle.includes('-armazon-');
}

function publishNotice(message) {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch (error) {
    /* almacenamiento no disponible */
  }
  document.dispatchEvent(new CustomEvent('mox:kit-notice', { detail: { message } }));
}

export function takeNotice() {
  try {
    const message = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return message;
  } catch (error) {
    return null;
  }
}

/**
 * Avisa al tema (carrito, contador, cajón) con las secciones ya renderizadas.
 * `silent` evita que el cajón se abra solo: el tema lo abre con cualquier
 * `cart:update` cuando "abrir automáticamente" está activo.
 */
function dispatchUpdate(cart, sections, { added = false, silent = false } = {}) {
  const itemCount = cart && typeof cart.item_count === 'number' ? cart.item_count : countFromSections(sections) ?? 0;
  const EventClass = added ? CartAddEvent : CartUpdateEvent;
  const drawers = silent ? [...document.querySelectorAll('cart-drawer-component[auto-open]')] : [];
  drawers.forEach((d) => d.removeAttribute('auto-open'));
  try {
    document.dispatchEvent(new EventClass(cart || {}, SOURCE, { source: SOURCE, itemCount, sections: sections || undefined }));
  } finally {
    drawers.forEach((d) => d.setAttribute('auto-open', ''));
  }
}

async function rebalanceNow() {
  const cart = await getCart();
  const moxItems = cart.items.filter((item) => isMoxHandle(item.handle));
  if (!moxItems.length) return { changed: false };

  const handles = [...new Set(moxItems.map((i) => i.handle))];
  const products = await Promise.all(handles.map(fetchProduct));
  const catalog = {};
  handles.forEach((h, i) => {
    if (products[i]) catalog[h] = products[i];
  });

  const plan = planRebalance(cart.items, catalog);
  if (!plan.length) return { changed: false };

  const sections = sectionIds();
  const add = await postJSON('cart/add.js', {
    items: plan.map((p) => ({ id: p.toVariant, quantity: p.quantity, properties: p.properties })),
  });
  if (!add.ok) {
    publishNotice(text('cartNoStock', 'No pudimos actualizar el precio de tu kit porque una de las variantes no tiene stock. Revisá las cantidades antes de pagar.'));
    return { changed: false, error: add.data };
  }

  const updates = {};
  plan.forEach((p) => (updates[p.key] = 0));
  const update = await postJSON('cart/update.js', { updates, sections: sections.join(',') });
  if (!update.ok) {
    publishNotice(text('cartFailed', 'No pudimos terminar de actualizar tu kit. Recargá la página para ver el precio correcto.'));
    return { changed: true, error: update.data };
  }

  const sizes = [...new Set(plan.map((p) => p.kitSize))];
  const message =
    sizes.length === 1
      ? sizes[0] === 1
        ? text('cartKitOne', 'Tu kit ahora tiene 1 anteojo: actualizamos el precio por unidad.')
        : text('cartKitMany', 'Tu kit ahora tiene [n] anteojos: actualizamos el precio por unidad.', { n: sizes[0] })
      : text('cartKits', 'Actualizamos el precio por unidad de tus kits según la cantidad de anteojos.');
  publishNotice(message);
  dispatchUpdate(update.data, update.data && update.data.sections, { silent: true });
  return { changed: true };
}

export const moxCart = {
  /**
   * Agrega las líneas de un kit. Todo o nada.
   * @param {Array<{ id: number, quantity: number, properties: Record<string, string> }>} items
   * @param {string | null} kitId
   */
  addKit(items, kitId) {
    return exclusive(async () => {
      const sections = sectionIds();
      let result;
      try {
        result = await postJSON('cart/add.js', { items, sections: sections.join(','), sections_url: window.location.pathname });
      } catch (error) {
        return { ok: false, message: text('cartOffline', 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.') };
      }

      if (!result.ok) {
        const description = (result.data && (result.data.description || result.data.message)) || text('cartAddFailed', 'No pudimos agregar el producto.');
        // Si Shopify agregó parte del kit, se quita para no dejarlo incompleto.
        if (kitId) {
          try {
            const cart = await getCart();
            const partial = cart.items.filter((i) => i.properties && i.properties._moxKit === kitId);
            if (partial.length) {
              const updates = {};
              partial.forEach((i) => (updates[i.key] = 0));
              const cleanup = await postJSON('cart/update.js', { updates, sections: sections.join(',') });
              dispatchUpdate(cleanup.data, cleanup.data && cleanup.data.sections, { silent: true });
              return { ok: false, message: `${description} ${text('cartPartial', 'No agregamos el kit incompleto: elegí otra combinación.')}` };
            }
          } catch (error) {
            /* sigue con el mensaje original */
          }
        }
        return { ok: false, message: description };
      }

      dispatchUpdate(null, result.data && result.data.sections, { added: true });
      // Una unidad suelta puede sumarse a una línea igual ya existente: se ajusta su nivel.
      if (!kitId) await rebalanceNow().catch((error) => console.error('[MOX] recálculo de kit', error));
      return { ok: true };
    });
  },

  /** Recalcula los kits del carrito (se puede llamar varias veces; se ejecuta de a una). */
  rebalance() {
    return exclusive(() => rebalanceNow().catch((error) => console.error('[MOX] recálculo de kit', error)));
  },
};

/* ---------- conexión con los eventos del tema ---------- */
if (!window.__moxCartBound) {
  window.__moxCartBound = true;

  document.addEventListener(ThemeEvents.cartUpdate, (event) => {
    const detail = /** @type {CustomEvent} */ (event).detail || {};
    if (detail.data && detail.data.source === SOURCE) return;
    if (detail.data && detail.data.didError) return;
    moxCart.rebalance();
  });

  const start = () => {
    if (document.body && document.body.dataset.cartCount && document.body.dataset.cartCount !== '0') moxCart.rebalance();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
