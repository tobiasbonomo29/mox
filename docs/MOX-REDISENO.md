# MÖX · Rediseño del tema (Horizon 3.4.0)

Tema de trabajo: carpeta local sincronizada con el **tema de desarrollo no publicado** `189615604017` (`shopify theme dev`). El tema publicado ("Rebel") **no se modificó**. Para publicar: revisar la vista previa y ejecutar `shopify theme push` sobre un tema nuevo o sobre "Rebel" cuando se apruebe.

## Cómo funciona la compra (fuente única de estado)

- Cada combinación línea + armazón es un producto propio con handle `{línea}-armazon-{armazón}`.
- Cada producto tiene la opción **Kit** con 3 variantes. El precio de cada variante es el **precio por unidad** cuando se llevan 1, 2 o 3 anteojos juntos.
- Un kit de N anteojos agrega N líneas reales al carrito, cada una con la variante de nivel N de su propio producto y las propiedades ocultas `_moxKit` (id del kit) y `_moxKitSize`. **Shopify cobra exactamente esos precios**: no hay descuentos simulados en el frontend.
- Si en el carrito cambia la cantidad de anteojos de un kit, cada línea pasa a la variante del nivel que corresponde a la cantidad final (máx. 3) y se muestra un aviso. Se dispara con los eventos `cart:update` del tema y al cargar la página (no hay sondeo periódico).

Archivos principales:

| Archivo | Función |
|---|---|
| `blocks/mox-buy.liquid` + `assets/mox-buy.js` | Ficha: H1, precio, armazones, kit, selectores por anteojo, resumen, botón y barra móvil. |
| `assets/mox-pricing.js` | Lógica pura de kits, stock, descuentos y cuotas en centavos. Probada en `tests/`. |
| `assets/mox-cart.js` | Agregar kits (todo o nada, sin duplicados) y recálculo en el carrito. |
| `assets/mox-ui.js` | WhatsApp, aviso de kit y sección activa del menú. |
| `assets/mox.css` | Tokens de marca y componentes. |
| `snippets/mox-product-meta.liquid` | Deriva línea y armazón del handle. |
| `sections/mox-*.liquid` | Portada, líneas, comparador, productos, editorial, info de compra, preguntas, detalles, encabezado de colección, páginas y pie. |

Pruebas de la lógica: `node --test tests/mox-pricing.test.mjs`.

## Cambios hechos en el Admin (autorizados)

No se borró ni modificó nada existente.

- Colecciones inteligentes publicadas en la Tienda online: **Mañana** (`/collections/manana`, título contiene "MAÑANA"), **Tarde** y **Noche**.
- Página **Cómo elegir** (`/pages/como-elegir`, plantilla `page.como-elegir`).
- Menús **MÖX principal** (`mox-principal`) y **MÖX pie** (`mox-pie`). El menú `main-menu` original sigue existiendo, pero el tema ya no lo usa.

## Configuración administrativa pendiente

1. **Variante de Noche · Armazón marrón.** Su primera variante se llama `1 anteojo` (en los demás productos es `Llevando 1`) y su "Llevando 3" cuesta $74.900 (en los demás, $79.900). El tema ya maneja ambos casos, pero conviene unificarlos. Pasos: Productos → NOCHE - Armazon marrón → Variantes. Renombrá la variante a `Llevando 1` y confirmá el precio de "Llevando 3".
2. **Stock por variante.** El inventario está cargado por variante de kit: por ejemplo, Tarde azul tiene 3 unidades en "Llevando 1", 3 en "Llevando 2" y 3 en "Llevando 3". Si el stock es físico y compartido, conviene revisarlo. El recálculo de kits necesita stock en la variante de destino.
3. **Descripciones y especificaciones.** Todas las descripciones de producto están vacías. Cargalas en cada producto. Para las especificaciones, creá en Configuración → Datos personalizados → Productos estas definiciones de metafield (texto de varias líneas): `custom.medidas`, `custom.materiales`, `custom.tecnologia` y `custom.incluye`. La sección "Detalles" muestra solo lo que tenga contenido.
4. **Textos alternativos de imágenes.** Ninguna imagen de producto tiene texto alternativo. Productos → cada imagen → "Agregar texto alternativo".
5. **Políticas.** Las páginas "Términos del servicio" y "Política de reembolso" dicen **"CozyCorner"** (texto de plantilla) y la de reembolso promete una garantía de 30 días. Por eso el pie ya no las enlaza. Pasos: Configuración → Políticas, redactá o generá la política de reembolso, los términos y la política de envío. El pie las mostrará automáticamente al publicarlas.
6. **Cambios y devoluciones.** La ficha anterior decía "Probalo sin riesgo por 60 días", lo que contradice la página de reembolso. Cuando la política esté definida, cargá un texto breve en Personalizar → Configuración del tema → MÖX → "Cambios y devoluciones".
7. **Cuotas y descuento por medio de pago.** La ficha anterior anunciaba "3 cuotas sin interés" y "20% pagando en efectivo". No pude verificar ninguna de las dos reglas en Shopify, así que quedaron desactivadas. Si existen en tu medio de pago, activalas en Configuración del tema → MÖX. Las cuotas se calculan sobre el total que cobra Shopify.
8. **Redes sociales y WhatsApp.** Las redes del pie apuntaban a cuentas de Shopify y se quitaron. Cargá las cuentas reales en Personalizar → Pie MÖX → Redes. Si querés un enlace de WhatsApp en el pie, cargalo ahí también. El botón flotante lo sigue manejando la app Moose WhatsApp.
9. **Colección "Coleccion".** Su regla es `precio comparado = 124900`: si cambia el precio anterior, los productos salen de la colección. Conviene cambiarla a "título contiene ARMAZON" o usar las colecciones nuevas. Además, "Blue Blockers" solo contiene un borrador ("Proteccion Noche", handle `gorra-negra-deportiva`), por eso no se destaca.
10. **Página Sobre nosotros.** No tiene contenido. El tema muestra información real de las líneas; para contar la historia de la marca, cargá el texto en Tienda online → Páginas → Sobre nosotros.
11. **App de preguntas/ayuda.** En el HTML aparece contenido de ejemplo en inglés de una app de ayuda ("Exchange process… This is a sample article"). Revisá esa app o desinstalala.
12. **Menú del editor.** Si en algún momento se restablece la cabecera, elegí el menú "MÖX principal" en Personalizar → Encabezado → Menú.

## Información comercial faltante

- Historia, origen y equipo de la marca (no se inventó).
- Medidas, materiales, peso y contenido de la caja de cada armazón.
- Detalle técnico del filtrado: el comparador muestra solo el color del cristal, el momento del día y el "nivel 1/2/3", según la frase publicada "Tres niveles de filtrado para distintos momentos del día". **Confirmá el orden de los niveles** (Configuración del tema → MÖX → Nivel de filtrado, o dejalo vacío para ocultar la fila).
- Plazos de entrega, horario de atención y política de cambios.
- Fotografías reales de producto y de uso: las actuales parecen generadas por IA (archivos "ChatGPT_Image…"). Para el hero, conviene cargar además un recorte vertical para celular.

## Cambios de septiembre 2026

Publicado el 29/09/2026 como **"MOX 2026 - Septiembre"** (#189870178609). El anterior (#189836591409) quedó sin publicar como respaldo: para volver atrás, publicalo desde Tienda online → Temas.

Base: el tema publicado **"MOX 2026 - Actualizado"** (#189836591409), que tenía cambios posteriores al repositorio y se trajo al repo antes de empezar. "Rebel" ya no es el tema publicado.

| Pedido | Qué se hizo |
|---|---|
| "Falta elegir armazón" en rojo | El aviso y el borde del selector de armazón se muestran en rojo (`aria-invalid`) hasta que se elija uno. |
| Texto sobre el precio | "Precio llevando 2" / "Precio llevando 3" (con 1: "Precio"). Editable en el bloque Compra MOX. |
| Secciones a pantalla completa | Cada sección MOX ocupa al menos el alto de la pantalla (portada sin tope de 760 px). Se desactiva en MOX · Diseño. |
| Videos en la segunda sección | Carrusel de videos 9:16 con reproducción automática, sin sonido, en bucle y `playsinline`, con "Ver Mañana/Tarde/Noche →" y "Deslizá para ver más →". Sin video se muestra la foto de la línea. Los videos se cargan en Personalizar → Líneas MOX. |
| Envío gratis desde 2 | La ficha muestra "Envío gratis llevando 2 o más" con 1 anteojo, y el texto de envío gratis y la etiqueta "Envío gratis" con 2 y 3. También se corrigieron las preguntas frecuentes y el acordeón "Detalles". |
| Certificados | Bloque debajo de "Agregar al carrito" y sección "Certificados MOX" en Cómo elegir. Se cargan en Configuración del tema → MOX · Certificados. Sin certificados cargados no se muestra nada. |
| Tarjetas estilo NoMercy | Sección "Cristales MOX" (portada y Cómo elegir): borde y etiqueta del color del cristal, usos, luz azul (%), corte (nm), barra de espectro 380–700 nm e informe de laboratorio. Los datos se cargan en Configuración del tema → MOX → cada línea ("Tarjeta de cristal · …"). Lo vacío no se muestra. |

Pendiente de MOX o del Admin:

- **Acceso de chanchi con permisos completos.** Configuración → Usuarios → Agregar usuarios. Tiene que agregarlo el propietario de la tienda con todos los permisos. Si es colaborador de una agencia, tiene que pedir acceso desde su Partner Dashboard y el propietario lo aprueba con todos los permisos. Si ya tiene cuenta y no puede editar algunas cosas, el propietario tiene que abrir su usuario en Configuración → Usuarios y marcar todos los permisos. Algunas funciones solo las puede usar el propietario, por ejemplo transferir la tienda o ver ciertos datos de facturación.
- **Descuento de envío gratis.** Editar el descuento automático "MOX - descuentos" (o crear uno de envío gratis) con requisito mínimo **2 artículos**. Sin esto, Shopify sigue cobrando igual que antes, aunque el tema ya diga lo correcto.
- **Datos de las tarjetas de cristal:** uso, usos, % de luz azul, nm de corte e informe (PDF en Contenido → Archivos).
- **Certificados:** imágenes, nombres y documentos.
- **Videos** de cada línea (9:16).
- **Texto debajo del precio (punto 4):** el cliente todavía no definió qué cambiar.

## Limitaciones conocidas

- "Pantalla completa" garantiza el alto mínimo. Las secciones con mucho contenido (grilla de productos, comparador y preguntas frecuentes en celular, ficha de producto) siguen siendo más altas que la pantalla.

- El precio por kit depende de variantes y del recálculo desde el tema. Un cambio hecho fuera del tema, como una API externa o una app, se corrige recién en la próxima carga de una página de la tienda. Para una regla que no dependa del navegador, la opción robusta es una función de descuento de Shopify o bundles nativos.
- Dos unidades del mismo producto agregadas por separado se unen en una línea con cantidad 2 y pasan al precio de "Llevando 2". Dos productos distintos agregados por separado no forman un kit.
- Las métricas de rendimiento se midieron con el servidor local de desarrollo y son orientativas. Conviene medir en producción con PageSpeed Insights después de publicar.
- Los bloques anteriores (`mox-kits`, `product-info-custom`, `mox-etiquetas`, `mox-info-acordeon`, `mox-videos`, `before-after`, etc.) siguen en el repositorio pero las plantillas ya no los usan. Theme Check marca en ellos 27 avisos preexistentes (3 errores). Se pueden borrar una vez aprobado el rediseño.
