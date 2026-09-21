// Pruebas de la lógica de kits y precios de MÖX.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTier,
  tierForQuantity,
  resolveKit,
  discountPercent,
  installments,
  applyPercent,
  planRebalance,
  normalizeProduct,
} from '../assets/mox-pricing.js';

// Datos tomados del catálogo real (precios en centavos).
const raw = (handle, values, prices, stock = [10, 10, 10]) => ({
  handle,
  title: handle,
  options: ['Kit'],
  variants: values.map((value, i) => ({
    id: Number(`${handle.length}${i + 1}${handle.charCodeAt(0)}`),
    options: [value],
    available: stock[i] > 0,
    price: prices[i],
    compare_at_price: 12490000,
    inventoryLimit: stock[i],
  })),
});

const catalog = Object.fromEntries(
  [
    raw('noche-armazon-marron', ['1 anteojo', 'Llevando 2', 'Llevando 3'], [9990000, 8490000, 7490000], [7, 7, 7]),
    raw('noche-armazon-negro', ['Llevando 1', 'Llevando 2', 'Llevando 3'], [9990000, 8490000, 7990000], [7, 7, 7]),
    raw('manana-armazon-transparente', ['Llevando 1', 'Llevando 2', 'Llevando 3'], [9990000, 8490000, 7990000], [10, 10, 10]),
    raw('tarde-armazon-azul', ['Llevando 1', 'Llevando 2', 'Llevando 3'], [9990000, 8490000, 7990000], [3, 1, 0]),
  ].map((p) => [p.handle, normalizeProduct(p)])
);

test('parseTier reconoce los valores reales de la opción Kit', () => {
  assert.equal(parseTier('Llevando 1'), 1);
  assert.equal(parseTier('1 anteojo'), 1);
  assert.equal(parseTier('Llevando 3'), 3);
  assert.equal(parseTier('Default Title'), null);
  assert.equal(parseTier('Llevando 9'), null);
});

test('Noche marrón con "1 anteojo" tiene nivel 1 (antes quedaba sin tarjeta)', () => {
  const r = resolveKit({ tier: 1, units: ['noche-armazon-marron'], catalog });
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].handle, 'noche-armazon-marron');
  assert.equal(r.total, 9990000);
});

test('kit de 2 del mismo producto: una línea con cantidad 2 y total exacto', () => {
  const r = resolveKit({ tier: 2, units: ['noche-armazon-marron', 'noche-armazon-marron'], catalog });
  assert.equal(r.ok, true);
  assert.deepEqual(r.items.map((i) => [i.handle, i.quantity]), [['noche-armazon-marron', 2]]);
  assert.equal(r.total, 2 * 8490000);
  assert.equal(r.compareTotal, 2 * 12490000);
});

test('kit mixto de 3: cada unidad usa el precio de su propio producto', () => {
  const r = resolveKit({
    tier: 3,
    units: ['noche-armazon-marron', 'noche-armazon-negro', 'manana-armazon-transparente'],
    catalog,
  });
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 3);
  assert.equal(r.total, 7490000 + 7990000 + 7990000);
  assert.deepEqual(r.unitPrices, [7490000, 7990000, 7990000]);
});

test('una unidad sin armazón elegido bloquea el kit', () => {
  const r = resolveKit({ tier: 2, units: ['noche-armazon-marron', null], catalog });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'missing-selection' && e.unit === 2));
});

test('combinación inexistente no se reemplaza por otra', () => {
  const r = resolveKit({ tier: 1, units: ['tarde-armazon-marron'], catalog });
  assert.equal(r.ok, false);
  assert.equal(r.items.length, 0);
  assert.ok(r.errors.some((e) => e.code === 'unknown-product'));
});

test('variante agotada y stock insuficiente se informan', () => {
  const soldOut = resolveKit({ tier: 3, units: ['tarde-armazon-azul', 'noche-armazon-negro', 'noche-armazon-negro'], catalog });
  assert.equal(soldOut.ok, false);
  assert.ok(soldOut.errors.some((e) => e.code === 'sold-out' && e.handle === 'tarde-armazon-azul'));

  const short = resolveKit({ tier: 2, units: ['tarde-armazon-azul', 'tarde-armazon-azul'], catalog });
  assert.equal(short.ok, false);
  assert.ok(short.errors.some((e) => e.code === 'insufficient-stock' && e.available === 1));
});

test('descuento solo si el precio anterior es mayor, sobre la misma base', () => {
  assert.equal(discountPercent(9990000, 12490000), 20);
  assert.equal(discountPercent(9990000, 9990000), 0);
  assert.equal(discountPercent(9990000, null), 0);
  // El 40% que mostraba la ficha salía de mezclar el precio de "Llevando 3" con el anterior.
  assert.notEqual(discountPercent(9990000, 12490000), discountPercent(7490000, 12490000));
});

test('cuotas en centavos suman exactamente el total', () => {
  const list = installments(9990000, 3);
  assert.deepEqual(list, [3330000, 3330000, 3330000]);
  const odd = installments(1000001, 3);
  assert.equal(odd.reduce((a, b) => a + b, 0), 1000001);
});

test('descuento por medio de pago en centavos sin errores de coma flotante', () => {
  assert.equal(applyPercent(9990000, 20), 7992000);
  assert.equal(applyPercent(8490000 * 2, 20), 13584000);
});

test('tierForQuantity limita al nivel máximo', () => {
  assert.equal(tierForQuantity(0), 1);
  assert.equal(tierForQuantity(2), 2);
  assert.equal(tierForQuantity(5), 3);
});

const cartLine = (key, handle, tierIndex, quantity, kit) => ({
  key,
  handle,
  quantity,
  variant_id: catalog[handle].variants[tierIndex - 1].id,
  properties: kit ? { _moxKit: kit, _moxKitSize: '2' } : {},
});

test('quitar una unidad de un kit de 2 pasa la restante al precio de 1', () => {
  const plan = planRebalance([cartLine('a', 'noche-armazon-marron', 2, 1, 'k1')], catalog);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].toVariant, catalog['noche-armazon-marron'].variants[0].id);
  assert.equal(plan[0].toTier, 1);
  assert.equal(plan[0].properties._moxKit, 'k1');
  assert.equal(plan[0].properties._moxKitSize, '1');
});

test('sumar una unidad a un kit de 2 pasa todo el kit al nivel 3', () => {
  const plan = planRebalance(
    [cartLine('a', 'noche-armazon-marron', 2, 2, 'k1'), cartLine('b', 'manana-armazon-transparente', 2, 1, 'k1')],
    catalog
  );
  assert.equal(plan.length, 2);
  assert.ok(plan.every((p) => p.toTier === 3 && p.kitSize === 3));
});

test('kits distintos no se mezclan y un kit consistente no cambia', () => {
  const plan = planRebalance(
    [
      cartLine('a', 'noche-armazon-marron', 2, 2, 'k1'),
      cartLine('b', 'noche-armazon-negro', 1, 1, null),
      cartLine('c', 'manana-armazon-transparente', 2, 1, 'k2'),
    ],
    catalog
  );
  assert.deepEqual(plan.map((p) => p.key), ['c']);
  assert.equal(plan[0].toTier, 1);
});

test('líneas de otros productos se ignoran', () => {
  assert.deepEqual(planRebalance([{ key: 'x', handle: 'gift-card', quantity: 3, variant_id: 1 }], catalog), []);
});
