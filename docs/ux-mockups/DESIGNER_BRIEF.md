# Brief de diseño — Tienda de Speack3

## Contexto
Speack3 es un chat cifrado de extremo a extremo (React Native + Paper, tema oscuro
por defecto, Material Design 3). Le agregamos una tienda de un solo vendedor
(catálogo, pedidos con hora de entrega, domicilios, pago mixto efectivo+Nequi/Bre-B,
cupos por franja). Toda la lógica ya existe y funciona (backend probado, 144 tests);
lo que falta es que se **vea** bien y sea fácil de usar — hoy son pantallas
funcionales de react-native-paper sin dirección de arte propia.

## Paleta (ANCLADA al código real, no inventar otra)
El tema es oscuro por defecto y el usuario puede elegir entre 6 acentos
(`src/context/ThemeContext.js`). El acento por defecto/observado en capturas reales
del dispositivo es el azul-violeta. Usar estos 4 hex fijos en TODOS los mockups:

- `#0F1115` — fondo de pantalla (near-black, no negro puro)
- `#1C1F26` — superficie de tarjetas/diálogos (un tono más claro que el fondo)
- `#4FC3F7` — acento primario (azul cian — botones, links, estado activo)
- `#4CAF50` — éxito/confirmado (verde — ya se usa para "Entregado" y "Pagado")
- Texto: blanco `#F5F5F5` para texto principal, gris `#9E9E9E` para texto secundario

No usar gradientes ni glassmorphism: Material 3 plano, bordes sutiles
(`rgba(255,255,255,0.08)`), esquinas redondeadas 8-12px.

## Problemas a resolver (por qué esto no es solo "hacerlo bonito")
1. **La pasarela del vendedor es una lista plana de tarjetas con un menú desplegable
   para cambiar de estado.** No transmite en qué punto del proceso está cada pedido
   de un vistazo. El vendedor pidió explícitamente "una pasarela donde va
   confirmando todos los procesos hasta llegar a entregado" — necesita ver de un
   vistazo cuántos pedidos hay en cada etapa (en espera → confirmado → preparando →
   listo → en camino → entregado) y mover uno de una etapa a la siguiente sin abrir
   menús.
2. **El checkout mezcla demasiadas decisiones en un solo diálogo** (día, hora,
   domicilio o recoger, ubicación GPS, notas) sin jerarquía visual.
3. **El catálogo es una grilla genérica de tarjetas** — con precios y promos reales
   (fresa x2, etc.) pero sin foto de producto real, solo emoji.
4. **El panel de vendedor (ajustes) es una lista de texto plano** (Switch, Switch,
   List.Item...) sin agrupar visualmente "lo urgente" (tienda abierta/cerrada) de
   "lo administrativo" (vendedores, cupos).

## Código real a anclar (cada diseñador debe leerlo antes de proponer nada)
- `mobile/src/screens/ShopScreen.js` — catálogo, carrito, checkout, mis pedidos
- `mobile/src/screens/ShopAdminScreen.js` — panel de pedidos del vendedor (la "pasarela")
- `mobile/src/screens/ShopSettingsScreen.js` — centro de mando (abrir/cerrar, en línea, ubicación)
- `mobile/src/screens/SellersScreen.js` — alta de vendedores
- `mobile/src/screens/DeliverySlotsScreen.js` — cupos por franja
- `mobile/src/components/OrderTimeline.js` — línea de tiempo del pedido (comprador)
- `mobile/src/components/DeliveryPicker.js` — selector de domicilio con GPS

## Entregables (uno por diseñador, en paralelo)
1. **`pasarela-vendedor.png`** (9:16, mobile) — el panel de pedidos del vendedor
   rediseñado como un tablero de columnas/etapas (estilo kanban compacto, NO kanban
   horizontal de escritorio: adaptado a una sola columna scrolleable con las etapas
   como secciones colapsables, o tabs con contador por etapa) para que sea "una UI
   más fácil": mover un pedido de etapa debe verse como UNA acción clara, no un
   menú de 7 opciones.
2. **`catalogo-carrito.png`** (9:16, mobile) — catálogo con las promos x2 visibles
   como badge, carrito/checkout con jerarquía clara: 1) qué compras, 2) cuándo
   (franja), 3) cómo lo recibes (recoger/domicilio), 4) cómo pagas (con el pago
   mixto efectivo+electrónico como un slider o split visual, no un input de texto).
3. **`seguimiento-comprador.png`** (9:16, mobile) — la vista del comprador: línea de
   tiempo del pedido con el paso "en camino" y el botón de ver ubicación,
   más el estado de pago mixto (parte efectivo / parte Nequi) claro.
4. **`centro-de-mando-vendedor.png`** (9:16, mobile) — ShopSettingsScreen rediseñada:
   los interruptores urgentes (tienda abierta, yo en línea) arriba y destacados,
   el resto (vendedores, cupos, cobro, aportes) como accesos agrupados.

## Qué NO hacer
- No inventar features nuevas en el mockup (nada de reseñas, nada de multi-vendedor).
- No usar marcas reales ni logos de pago (Nequi/Bre-B) — placeholders genéricos
  tipo "billetera móvil A/B", avisar si algún mockup los sugiere.
- No mostrar datos personales realistas (usar "Ana M.", "Carlos R.", nunca datos
  reales de este proyecto).

## Estado
- [ ] Fase 1: brief (este archivo)
- [x] Fase 2: 4 diseñadores en paralelo → prompts
- [x] Fase 3: director de arte (armoniza)
- [x] Fase 4: generación (Gemini web, cuenta Ultra)
- [x] Fase 5: revisión con visión (1 ronda de regeneración: corregido código
      hex filtrado como texto en el centro de mando, idiomas mezclados y
      producto sin etiqueta en el catálogo, chip contradictorio en
      seguimiento, y barra superior clara en la pasarela)
- [x] Fase 6: entrega en `docs/ux-mockups/generated/` — ver `index.html` y
      `../PROMPTS.md` para el detalle de cada mockup y qué se corrigió

## Resultado

Los 4 mockups quedaron en `docs/ux-mockups/generated/`:
`pasarela-vendedor.png`, `catalogo-carrito.png`, `seguimiento-comprador.png`,
`centro-de-mando-vendedor.png`. Son dirección visual, no código: falta
implementar estas pantallas en React Native reusando la lógica ya probada
(`ShopScreen.js`, `ShopAdminScreen.js`, `OrderTimeline.js`, endpoints de
`server/api/orders.js` y `server/api/shop.js`).
