/**
 * MOX · Lógica pura de kits y precios (sin DOM).
 *
 * Modelo de datos real del catálogo:
 * - Cada combinación línea + armazón es un producto propio, con handle
 *   `{línea}-armazon-{armazón}` (ej. `noche-armazon-marron`).
 * - Cada producto tiene una opción "Kit" con un valor por nivel
 *   ("Llevando 1", "Llevando 2", "Llevando 3"; algún producto usa "1 anteojo").
 *   El precio de esa variante es el precio POR UNIDAD cuando se llevan N juntos.
 * - Un kit de N anteojos agrega N líneas reales, cada una con la variante de
 *   nivel N de su propio producto. Shopify cobra exactamente esos precios.
 *
 * Todos los importes están en centavos (unidades menores), como los entrega
 * Shopify en Liquid y en la Ajax API. Nunca se opera con decimales.
 */

/** Nivel máximo de kit que se reconoce. */
export const MAX_TIER = 3;

/**
 * Extrae el nivel (cantidad de anteojos) de un valor de la opción Kit.
 * Acepta "Llevando 2", "1 anteojo", "Kit x3", "3". Devuelve null si no hay número.
 * @param {string} value
 * @returns {number | null}
 */
export function parseTier(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return n >= 1 && n <= MAX_TIER ? n : null;
}

/**
 * Busca la variante de un nivel dentro de un producto normalizado.
 * @param {{ variants: Array<{ id: number, tier: number | null }> }} product
 * @param {number} tier
 */
export function variantForTier(product, tier) {
  if (!product || !Array.isArray(product.variants)) return null;
  return product.variants.find((v) => v.tier === tier) || null;
}

/**
 * Niveles que ofrece un producto, ordenados.
 * @param {{ variants: Array<{ tier: number | null }> }} product
 * @returns {number[]}
 */
export function tiersOf(product) {
  if (!product || !Array.isArray(product.variants)) return [];
  const set = new Set(product.variants.map((v) => v.tier).filter((t) => t !== null));
  return [...set].sort((a, b) => a - b);
}

/**
 * Nivel que corresponde a una cantidad de anteojos comprados juntos.
 * Más de MAX_TIER unidades usan el precio del nivel máximo.
 * @param {number} quantity
 */
export function tierForQuantity(quantity) {
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(Math.floor(quantity), MAX_TIER);
}

/**
 * Resuelve el pedido de un kit.
 *
 * @param {object} args
 * @param {number} args.tier - Nivel elegido (1, 2 o 3).
 * @param {Array<string | null>} args.units - Handle del producto elegido para cada anteojo (null = sin elegir).
 * @param {Record<string, any>} args.catalog - Productos normalizados por handle.
 * @returns {{
 *   ok: boolean,
 *   items: Array<{ id: number, quantity: number, handle: string, price: number, compareAtPrice: number | null }>,
 *   total: number,
 *   compareTotal: number,
 *   unitPrices: number[],
 *   errors: Array<{ unit: number, code: string, handle?: string }>
 * }}
 */
export function resolveKit({ tier, units, catalog }) {
  const errors = [];
  const lines = [];

  if (!Array.isArray(units) || units.length !== tier) {
    errors.push({ unit: 0, code: 'units-mismatch' });
  }

  (units || []).forEach((handle, index) => {
    if (!handle) {
      errors.push({ unit: index + 1, code: 'missing-selection' });
      return;
    }
    const product = catalog[handle];
    if (!product) {
      errors.push({ unit: index + 1, code: 'unknown-product', handle });
      return;
    }
    const variant = variantForTier(product, tier);
    if (!variant) {
      errors.push({ unit: index + 1, code: 'tier-unavailable', handle });
      return;
    }
    if (!variant.available) {
      errors.push({ unit: index + 1, code: 'sold-out', handle });
      return;
    }
    lines.push({ unit: index + 1, handle, variant });
  });

  // Stock: varias unidades del mismo producto piden la misma variante.
  const demand = new Map();
  for (const line of lines) {
    demand.set(line.variant.id, (demand.get(line.variant.id) || 0) + 1);
  }
  for (const line of lines) {
    const limit = line.variant.inventoryLimit;
    if (typeof limit === 'number' && demand.get(line.variant.id) > limit) {
      if (!errors.some((e) => e.code === 'insufficient-stock' && e.handle === line.handle)) {
        errors.push({ unit: line.unit, code: 'insufficient-stock', handle: line.handle, available: limit });
      }
    }
  }

  // Agrupa unidades iguales en una sola línea con cantidad.
  const grouped = new Map();
  for (const line of lines) {
    const current = grouped.get(line.variant.id);
    if (current) {
      current.quantity += 1;
    } else {
      grouped.set(line.variant.id, {
        id: line.variant.id,
        quantity: 1,
        handle: line.handle,
        price: line.variant.price,
        compareAtPrice: line.variant.compareAtPrice ?? null,
      });
    }
  }

  const items = [...grouped.values()];
  const unitPrices = lines.map((l) => l.variant.price);
  const total = unitPrices.reduce((sum, p) => sum + p, 0);
  const compareTotal = lines.reduce((sum, l) => {
    const compare = l.variant.compareAtPrice;
    return sum + (typeof compare === 'number' && compare > l.variant.price ? compare : l.variant.price);
  }, 0);

  return { ok: errors.length === 0 && lines.length === tier, items, total, compareTotal, unitPrices, errors };
}

/**
 * Porcentaje de descuento entero, solo si el precio anterior es mayor.
 * Se calcula sobre la misma base (mismo producto y variante); nunca se suman porcentajes.
 * @param {number} price
 * @param {number | null | undefined} compareAtPrice
 */
export function discountPercent(price, compareAtPrice) {
  if (typeof compareAtPrice !== 'number' || !(compareAtPrice > price) || compareAtPrice <= 0) return 0;
  return Math.round(((compareAtPrice - price) * 100) / compareAtPrice);
}

/**
 * Divide un total en cuotas iguales, en centavos. La última cuota absorbe el
 * redondeo para que la suma sea exacta. Se aplica sobre el total a cobrar,
 * nunca sobre un precio con descuento por otro medio de pago.
 * @param {number} total
 * @param {number} count
 */
export function installments(total, count) {
  if (!(count >= 1) || !Number.isFinite(total)) return [];
  const base = Math.floor(total / count);
  const list = Array.from({ length: count }, () => base);
  list[count - 1] = total - base * (count - 1);
  return list;
}

/**
 * Precio con descuento porcentual, redondeado a centavos.
 * @param {number} total
 * @param {number} percent
 */
export function applyPercent(total, percent) {
  if (!(percent > 0)) return total;
  return total - Math.round((total * percent) / 100);
}

/**
 * Plan de recálculo de kits en el carrito.
 *
 * Las líneas de un mismo kit comparten la propiedad `_moxKit`. El nivel de
 * cada línea tiene que corresponder a la cantidad TOTAL de anteojos que quedan
 * en su kit. Las líneas sin `_moxKit` se consideran un kit propio.
 *
 * @param {Array<{ key: string, variant_id: number, handle: string, quantity: number, properties?: Record<string, string> | null, options_with_values?: Array<{ name: string, value: string }>, variant_options?: string[] }>} items
 * @param {Record<string, any>} catalog - Productos normalizados por handle (solo los de MOX).
 * @returns {Array<{ key: string, fromVariant: number, toVariant: number, quantity: number, properties: Record<string, string>, fromTier: number, toTier: number, kitSize: number }>}
 */
export function planRebalance(items, catalog) {
  const groups = new Map();

  items.forEach((item) => {
    const product = catalog[item.handle];
    if (!product) return;
    const groupId = (item.properties && item.properties._moxKit) || `line:${item.key}`;
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId).push({ item, product });
  });

  const plan = [];
  for (const members of groups.values()) {
    const kitSize = members.reduce((sum, m) => sum + m.item.quantity, 0);
    const targetTier = tierForQuantity(kitSize);

    for (const { item, product } of members) {
      const current = product.variants.find((v) => v.id === item.variant_id);
      const currentTier = current ? current.tier : null;
      if (currentTier === targetTier) continue;

      const target = variantForTier(product, targetTier);
      if (!target) continue;

      plan.push({
        key: item.key,
        fromVariant: item.variant_id,
        toVariant: target.id,
        quantity: item.quantity,
        properties: { ...(item.properties || {}), _moxKitSize: String(kitSize) },
        fromTier: currentTier ?? 0,
        toTier: targetTier,
        kitSize,
      });
    }
  }
  return plan;
}

/**
 * Normaliza un producto de /products/{handle}.js o del JSON que imprime el tema.
 * @param {any} raw
 */
export function normalizeProduct(raw) {
  if (!raw) return null;
  const kitIndex = Array.isArray(raw.options)
    ? raw.options.findIndex((o) => (typeof o === 'string' ? o : o.name) === 'Kit')
    : -1;

  return {
    handle: raw.handle,
    title: raw.title,
    variants: (raw.variants || []).map((v) => {
      const value = kitIndex > -1 ? (v.options ? v.options[kitIndex] : v[`option${kitIndex + 1}`]) : v.title;
      // Producto sin opción "Kit" y con una sola variante: se vende como 1 unidad.
      const singleDefault = kitIndex === -1 && (raw.variants || []).length === 1;
      const tracked = v.inventory_management === 'shopify' && v.inventory_policy === 'deny';
      return {
        id: v.id,
        tier: singleDefault ? 1 : parseTier(value),
        available: !!v.available,
        price: typeof v.price === 'number' ? v.price : Math.round(parseFloat(v.price) * 100),
        compareAtPrice:
          v.compare_at_price == null
            ? null
            : typeof v.compare_at_price === 'number'
              ? v.compare_at_price
              : Math.round(parseFloat(v.compare_at_price) * 100),
        inventoryLimit: typeof v.inventoryLimit === 'number' ? v.inventoryLimit : tracked && typeof v.inventory_quantity === 'number' ? v.inventory_quantity : undefined,
      };
    }),
  };
}
