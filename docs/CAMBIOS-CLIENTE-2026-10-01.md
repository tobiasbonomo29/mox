# Cambios solicitados por el cliente (octubre 2026)

Fuente: `Requerimientos_MOX_Shopify_parte2.pdf` y `SHOPIFY → Dar permiso de edicion a chanchi (2).pdf`.

## Hechos en el tema

| # | Pedido | Qué se hizo |
|---|---|---|
| 2 | Quitar "3 cuotas sin interés" y "10% pagando en transferencia"; poner 3 desplegables | Se quitaron las dos líneas de debajo del precio. En su lugar hay tres desplegables (`<details>`) con borde fino, esquinas redondeadas y un "+" circular. Los textos se cargan en **Configuración del tema → MOX · Información de compra**. |
| 4 | Agrandar los videos | Cada video pasó de 360 px a 435 px de ancho en una pantalla de 1920×1080 (bloque de 1392 px, 72,5 % del ancho), con 24 px de separación. |
| 5 | "Elegir" no funciona; cambiarlo por "Agregar" | Corregido y renombrado. El botón agrega un anteojo ("Llevando 1") al carrito. |
| 6 | "Kit de 3" → "Llevando 3" | Cambiado, y también la variante de 2. Ahora dice `Llevando 3: $79.900,00 c/u`. |
| 7 | Deslizar horizontal en celular | Faltaba el comparador ("Noche lado a lado"); se convirtió en carrusel con snap y la tarjeta siguiente asomada. |
| 8 | Certificados: de imágenes a PDF | Se quitó el selector de imagen. Cada certificado es nombre + URL del PDF. |

El punto 3 (secciones a pantalla completa) ya estaba implementado y se verificó: todas miden entre 824 y 868 px en una ventana de 900 px.

### Por qué el botón "Elegir" no hacía nada

`assets/quick-add.js` hacía `variantPicker.updateVariantPicker(...)` sin comprobar que existiera. Las fichas MÖX arman el kit con su propio bloque y no tienen `<variant-picker>`, así que lanzaba una excepción dentro del handler `async` y nunca llegaba a abrir el modal: el clic no producía ni efecto ni error visible.

Se agregó la guarda y, además, las tarjetas de productos con opción "Kit" ahora agregan directamente la variante de 1 unidad en vez de abrir un modal que no sirve para este modelo de compra. Para kits de 2 o 3 se entra a la ficha, que es donde se eligen los armazones.

## Pendiente: lo tiene que cargar MOX

- **Textos de los tres desplegables** (Medios de pago, Garantía 60 días, Envíos). El PDF dice que los pasa MOX. Hasta que estén cargados, los desplegables **no se muestran en la tienda**: el tema no inventa contenido. Se cargan en Configuración del tema → MOX · Información de compra.
- **PDFs de los certificados.** Subirlos en Contenido → Archivos y pegar la URL en Configuración del tema → MOX · Certificados.

## Pendiente: solo se puede hacer en el Admin de Shopify

El punto 1 (cambiar `sentitemox@gmail.com` por `somosmoxcontacto@gmail.com`) **no se puede resolver en el código**: el email no está escrito en ningún archivo del tema. El pie, la ficha y la sección de información lo toman de `shop.email`, el email de la tienda.

Se cambia en un solo lugar y se actualiza en todo el sitio:

1. **Configuración → General →** Correo electrónico de la tienda y correo del remitente.
2. **Configuración → Notificaciones →** remitente de las plantillas.
3. **Políticas** (envíos, cambios, privacidad) y la **página de contacto**: son contenido del Admin, hay que editarlas a mano.

## Tensión entre el punto 3 y el punto 4

No se pueden cumplir los dos al mismo tiempo en una pantalla de 1080 px de alto. Para que un video midiera los 472 × 839 px de la referencia, la sección necesitaría unos 1127 px y dejaría de entrar en una pantalla.

Se priorizó que la sección entre completa (punto 3) y que el video sea lo más grande posible dentro de ese límite. En monitores más altos (1440 px) el video llega al tope de 472 px. En celular pasa lo mismo: queda en 270 px (69 % del ancho) en vez del 85 % pedido, porque si no la sección no entra en una pantalla.

## Validación

- 15 pruebas de `mox-pricing` aprobadas.
- Theme Check: 27 avisos y 3 errores, todos preexistentes en archivos heredados. No se agregaron avisos nuevos.
- Verificado en el navegador sobre el tema de desarrollo: el botón "Agregar" suma `MAÑANA - Armazon marrón - Llevando 1` por $99.900 sin errores de JavaScript; la ficha ya no muestra cuotas ni transferencia; las etiquetas dicen "Llevando 3"; los tres carruseles de celular deslizan con snap.
