/**
 * MÖX · Ajustes de interfaz globales.
 * - WhatsApp (botón de app): lo sube sobre la barra de compra móvil y lo oculta
 *   mientras hay un panel abierto (carrito, menú, búsqueda). No cambia su destino.
 * - Aviso de recálculo de kit en el carrito.
 * - Sección activa en la navegación principal.
 */
import { ThemeEvents } from '@theme/events';
import { takeNotice } from '@theme/mox-cart';

/* ---------- WhatsApp ---------- */

function findWhatsAppButton() {
  const links = document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com"], [class*="whatsapp" i], [id*="whatsapp" i]');
  for (const node of links) {
    let el = /** @type {HTMLElement | null} */ (node);
    while (el && el !== document.body) {
      const style = getComputedStyle(el);
      if (style.position === 'fixed') return el;
      el = el.parentElement;
    }
  }
  return null;
}

function manageWhatsApp() {
  if (!document.body.classList.contains('mox-wa-managed')) return;
  let tries = 0;
  const mark = () => {
    const target = findWhatsAppButton();
    if (target) {
      target.classList.add('mox-wa-target');
      return true;
    }
    return false;
  };
  if (mark()) return;
  const observer = new MutationObserver(() => {
    tries += 1;
    if (mark() || tries > 200) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
}

/* ---------- Paneles abiertos ---------- */

function syncPanelState() {
  const open = document.querySelector(
    'dialog[open], .menu-drawer-container[open], details.menu-drawer-container[open], header-drawer details[open]'
  );
  document.body.classList.toggle('mox-panel-open', !!open);
}

function watchPanels() {
  const observer = new MutationObserver(syncPanelState);
  observer.observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
  syncPanelState();
}

/* ---------- Aviso de kit ---------- */

function showKitNotice(message) {
  const text = message || takeNotice();
  if (!text) return;
  document.querySelectorAll('[data-mox-kit-notice]').forEach((el) => {
    el.textContent = text;
    /** @type {HTMLElement} */ (el).hidden = false;
  });
}

/* ---------- Navegación activa ---------- */

function markActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const isProduct = document.querySelector('main[data-template^="product"]');
  const links = document.querySelectorAll('header-component a[href], header-drawer a[href], .menu-drawer a[href]');
  links.forEach((link) => {
    const a = /** @type {HTMLAnchorElement} */ (link);
    if (a.origin !== window.location.origin) return;
    const href = a.pathname.replace(/\/$/, '') || '/';
    if (href === '/') return;
    const matches = href === path || (isProduct && href.endsWith('/collections/all'));
    if (matches && !a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
}

function start() {
  manageWhatsApp();
  watchPanels();
  markActiveNav();
  showKitNotice();
}

document.addEventListener('mox:kit-notice', (event) => {
  // Se muestra después de que el tema reemplaza el carrito.
  requestAnimationFrame(() => requestAnimationFrame(() => showKitNotice(/** @type {CustomEvent} */ (event).detail.message)));
});

document.addEventListener(ThemeEvents.cartUpdate, () => {
  requestAnimationFrame(() => requestAnimationFrame(() => showKitNotice()));
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
