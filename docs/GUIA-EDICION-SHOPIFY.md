# Cómo editar la tienda MOX

Abrí Tienda online → Temas → Personalizar en el tema publicado «MOX 2026 - Actualizado». Esta entrega se publicó el 28 de septiembre de 2026. El tema anterior se conserva en la biblioteca.

Editor: https://a9pxrx-1g.myshopify.com/admin/themes/189836591409/editor

## Contenido y diseño

| Qué querés cambiar | Dónde editarlo |
| --- | --- |
| Foto principal, foto de celular, título, texto y botones | Página de inicio → Portada MOX |
| Encuadre de la portada | Portada MOX → Encuadre horizontal / vertical. Son deslizadores, no hace falta CSS. |
| Nombres, colores, cristales, descripciones, imágenes y colecciones de Mañana, Tarde y Noche | Configuración del tema → MOX. Se actualizan en las distintas páginas. |
| Videos por línea | Página de inicio → Líneas MOX → Video Mañana / Tarde / Noche. Activá Tarjetas de video vertical. Sin video, se muestra la foto. |
| Texto de la guía y etiquetas de las tarjetas | Cómo elegir → Líneas MOX |
| Información institucional | Sobre nosotros → Página MOX y Editorial MOX |
| Productos destacados, cantidad y enlace de las tarjetas | Página de inicio → Productos MOX |
| Preguntas frecuentes | Preguntas MOX → cada bloque de pregunta. Podés agregar, quitar y reordenar. |
| Etiquetas y textos del comparador | Comparador MOX |
| Colores de fondo, tarjetas, textos y bordes redondeados | Configuración del tema → MOX · Diseño |
| Tipografía, logo y colores del tema base | Apartados Tipografía, Logo y Colores en Configuración del tema |
| Menús y sus enlaces | Contenido → Menús; después seleccioná el menú en Encabezado o Pie MOX. |
| Newsletter, mensajes de suscripción, redes y horarios | Pie MOX |
| Envíos, cambios y mensajes de cuotas o transferencia | Configuración del tema → MOX |
| Textos de la información de compra | Info de compra MOX |

Seleccioná la página desde el desplegable superior del editor. Las secciones del contenido se pueden agregar, ocultar y reordenar. Guardá para conservar los cambios del tema que estás editando.

## Productos y kits

- **Fotos, descripción, precios y stock:** Productos → elegí el producto. La grilla muestra las fotos cargadas, en dos columnas en computadora. Para ver cuatro fotos, cargá cuatro imágenes. La segunda imagen se usa al pasar el cursor por la tarjeta.
- **Galería:** en el personalizador, Productos → Producto predeterminado → galería multimedia. Podés elegir grilla o carrusel, columnas, proporción, zoom y controles.
- **Textos de compra:** Productos → Producto predeterminado → Compra MOX. Ahí se editan Llevando 1/2/3, aclaraciones, mensaje de armazón pendiente, botón, resumen y contacto. También se puede desactivar el desplazamiento automático al kit.
- **Especificaciones:** los datos por producto se toman de los metacampos `custom.medidas`, `custom.materiales`, `custom.tecnologia` y `custom.incluye`. En Detalles de producto MOX también hay campos de contenido alternativo que admiten fuentes dinámicas. El contenido alternativo se comparte entre los productos de esa plantilla y aparece cuando falta el metacampo.
- **Variantes de kit:** sus precios siguen viniendo de Shopify. Conservá los números 1, 2 y 3 en las variantes de la opción Kit. Los rótulos visibles se cambian en Compra MOX y no requieren renombrar variantes.
- **Relación entre línea y armazón:** el sistema existente depende de los identificadores de producto `{línea}-armazon-{armazón}`. Para editar contenido cotidiano, no cambies esos identificadores ni el prefijo de cada línea.

## Datos que se gestionan fuera del personalizador

Las políticas se editan en Configuración → Políticas. Las condiciones reales de cobro se gestionan en Configuración → Pagos o en el proveedor correspondiente: cambiar el texto de cuotas o transferencia no configura el checkout. Los permisos de personas se gestionan en Configuración → Usuarios. El destino del botón flotante de WhatsApp se administra desde su app.

Los controles añadidos usan los campos nativos de Shopify: https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings

## Estado de comprobación

Se comprobaron los esquemas y las referencias del código. El cambio de imagen se verificó en navegador con los componentes reales del tema y fotografías de prueba: segunda imagen al entrar, primera al salir, producto con una sola imagen y tarjetas MOX. Se corrigió la superposición del enlace que impedía el hover en Comprar. El efecto se activa o desactiva en Configuración del tema → Tarjetas de producto → Mostrar segunda imagen al pasar el cursor.

Publicado en el tema 189836591409. La tienda mantiene su contraseña de acceso: la revisión visual completa con contenido real sigue pendiente de esa contraseña.
