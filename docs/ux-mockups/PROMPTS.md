# Prompts finales — mockups tienda Speack3

Generados con Gemini (Nano Banana), cuenta Ultra, vía Chrome pilotado por CDP.
Paleta fija: fondo `#0F1115`, tarjetas `#1C1F26`, acento `#4FC3F7`, éxito
`#4CAF50`, texto `#F5F5F5` / `#9E9E9E`. Sin marcas ni logos reales de pago
(Nequi/Bre-B se muestran como "Billetera móvil A", genérico).

Cada mockup pasó por: 4 diseñadores en paralelo (uno por pantalla, cada uno
anclado al código real) → director de arte (armonización de paleta y
vocabulario, ver notas originales más abajo) → generación en Gemini →
revisión con visión → **una ronda de regeneración** para corregir defectos
reales encontrados en la primera pasada. Los prompts de abajo son los
**finales, ya corregidos** — los que realmente produjeron las imágenes en
`generated/`.

## 1. pasarela-vendedor.png (9:16)

**Prompt:**
Mobile screen, 9:16 portrait, dark Material Design 3, flat, no gradients or glassmorphism. The ENTIRE screen background including the top app bar is dark #0F1115 (do NOT render a white or light top bar, the whole screen is dark). Top bar: back arrow, title "Pedidos", bank icon, all in #F5F5F5 text on the #0F1115 background. Below, a horizontal pill tab bar, six stage tabs with rounded count badges: "En espera 2", "Confirmado 1", "Preparando 2" (selected, filled #4FC3F7 pill, dark text), "Listo", "En camino", "Entregado" as #9E9E9E outline pills. Below, a scrolling list of order cards on #1C1F26, 12px rounded corners, thin 1px border rgba(255,255,255,0.08). Card one: bold #F5F5F5 buyer name "Ana M.", items with emoji "🍓 x2 Fresas con crema · 🥤 x1 Limonada", #9E9E9E time chip "Hoy 3:00pm", bold total "$45.000" in #4FC3F7. Payment pill of two segments: left #9E9E9E outline segment "Efectivo $20.000 pendiente", right solid #4CAF50 segment "Billetera móvil A $25.000 pagado", generic wallet icons, no real logos. Small text button, receipt icon, "Ver comprobante" in #4FC3F7. Full-width filled #4FC3F7 button, check icon, bold dark text, "Confirmar -> Listo", 8px corners. Second card: buyer "Carlos R.", one item, filled #4CAF50 chip "Billetera móvil A pagado", one button "Marcar listo". Clean flat sans-serif type, generous padding.

**Qué resuelve:** convierte el menú desplegable de 7 opciones en tabs de
etapa con badge de cantidad (visión de conjunto instantánea) y un único botón
de acción primaria por tarjeta. El pago mixto se ve como píldora de dos
segmentos (gris pendiente / verde pagado) en vez de dos líneas de texto suelto.

**Qué se corrigió en la regeneración:** la primera pasada renderizó la barra
superior en blanco, rompiendo el tema oscuro. Se corrigió especificando
explícitamente que TODA la pantalla, incluida la barra superior, es `#0F1115`.

**Defecto menor aceptado (no bloqueante):** la tarjeta secundaria de ejemplo
("Carlos R.") muestra "1 item · Carrlos", un typo de relleno del modelo en
una tarjeta de ejemplo secundaria — no afecta la tarjeta principal ni la
legibilidad del patrón.

## 2. catalogo-carrito.png (9:16)

**Prompt:**
Mobile UI mockup, 9:16 portrait, dark checkout screen for a delivery app, background #0F1115, flat Material Design 3, no gradients or glassmorphism, thin 1px borders rgba(255,255,255,0.08), rounded corners 8-12px, clean sans-serif, text #F5F5F5, secondary text #9E9E9E, accent #4FC3F7, success #4CAF50. Top app bar reads "Confirmar pedido". Four numbered sections on card surfaces #1C1F26: SECTION 1 "Qué compras": exactly four product rows each with an emoji and its exact Spanish text label plus a quantity stepper: row 1 strawberry emoji and text "Fresa" with a #4CAF50 rounded badge chip "x2 = $100.000" beside it; row 2 coconut emoji and text "Coco"; row 3 battery emoji and text "Pila"; row 4 white square emoji and text "Cuadro". Every row must show its emoji AND its text label together, no row without a label. SECTION 2 "Cuándo": a row of exactly seven day-of-week pill chips with these exact Spanish abbreviations in order: "Lun" "Mar" "Mié" "Jue" "Vie" "Sáb" "Dom", plus below three time-slot chips "Mañana" "Tarde" "Noche" with "Tarde" filled #4FC3F7 dark text. SECTION 3 "Cómo lo recibes": two large toggle buttons "Recoger" and "Domicilio" side by side, "Domicilio" filled #4FC3F7, bordered info box below with pin icon showing "3.2 km · domicilio $12.000". SECTION 4 "Cómo pagas": horizontal split bar in two segments, #4CAF50 segment "Efectivo $40.000", #4FC3F7 segment "Billetera móvil A $20.000". Sticky bottom button "Confirmar pedido $100.000" filled #4FC3F7, bold dark text.

**Qué resuelve:** el checkout pasa de un diálogo con todo mezclado a 4
secciones numeradas y apiladas, una por decisión (qué, cuándo, cómo recibe,
cómo paga), así el usuario nunca ve más de un tipo de decisión a la vez. Los
4 productos reales del catálogo (Fresa, Coco, Pila, Cuadro) se muestran con
su emoji, como en el código.

**Qué se corrigió en la regeneración:** la primera pasada mezcló idiomas en
los chips de día ("Mon, Mar, Jue, Lug, Tue, Sab, Sun" — inglés/español/
italiano en la misma fila) y el cuarto producto ("Cuadro") apareció sin
etiqueta de texto, solo un ícono vacío. Se corrigió dando la lista exacta de
7 abreviaturas en español y exigiendo explícitamente que las 4 filas de
producto lleven emoji + texto juntos. Resultado: limpio.

## 3. seguimiento-comprador.png (9:16)

**Prompt:**
Mobile app screen, 9:16 portrait, dark Material Design 3, flat, no gradients or glassmorphism, background #0F1115. Top app bar, back arrow, title "Mis Pedidos"; tabs "Catálogo" / "Mis Pedidos", the latter active, underlined #4FC3F7. Below, two order cards on #1C1F26, 12px rounded corners, thin 1px border rgba(255,255,255,0.08). FIRST CARD, in progress, header chip text is exactly "En camino": items "Fresa x2 · Mango · Jugo natural" in #F5F5F5 and a small #4FC3F7 chip with the exact text "En camino" on #0F1115 with a thin border; below, a vertical timeline, thin rail, six icon rows: "En espera/Confirmado/Preparando/Listo" completed with solid #4FC3F7 icons and filled line, current step "En camino" bold #F5F5F5 with moped icon in #4FC3F7 and a small #4FC3F7-outlined pill "Ver ubicación" with map-pin icon, "Entregado" dimmed #9E9E9E hollow circle; footer: bold total "$48.000" in #4FC3F7, #9E9E9E-outlined chip "Efectivo pendiente", filled #4CAF50 chip "Billetera móvil A pagado". SECOND CARD, already delivered, its header chip text must be exactly "Entregado" (NOT "En camino") filled #4CAF50 with a checkmark: same card style, six timeline steps completed in #4CAF50 with green line and check, total "$32.000", #4CAF50 chip "Pagado", outlined #4FC3F7 button "Repetir pedido". Clean flat sans-serif, rounded 8-12px corners.

**Qué resuelve:** la línea de tiempo vertical de 6 pasos reemplaza un chip
binario "pendiente/pagado" que no puede representar un pago mixto; el botón
"Ver ubicación" aparece solo bajo el paso "En camino" como una foto puntual
del punto de partida del domicilio (no tracking en vivo). El pago mixto se
lee en el footer con dos chips separados.

**Qué se corrigió en la regeneración:** la tarjeta ya entregada mostraba el
chip "En camino" en vez de "Entregado" pese a tener los 6 pasos completos —
contradicción visual. Se corrigió forzando el texto exacto del chip para
cada tarjeta. Resultado: limpio.

## 4. centro-de-mando-vendedor.png (9:16)

**Prompt:**
Mobile UI mockup, 9:16 portrait, dark Material Design 3, flat, no gradients or glassmorphism, background #0F1115. Top app bar, back arrow, title "Mi tienda" in #F5F5F5. Below, two hero cards side by side on #1C1F26 surface, 12px rounded corners, thin 1px border rgba(255,255,255,0.08): left card has a big toggle switch ON in #4CAF50 with a solid #4CAF50 knob dot, bold "Tienda abierta" in #F5F5F5, caption "Los clientes pueden pedir" in #9E9E9E; right card matches, toggle ON in #4CAF50, bold "En línea", caption "Recibiendo pedidos". Below, a wide card for delivery origin: flat map thumbnail with grid streets and a #4FC3F7 pin marker, next to it exactly this text in white and nothing else, two short lines: "Chapinero, Bogotá" then below in smaller gray text "Punto de salida de domicilios" (do not invent any other address, street name or coordinate numbers), and a #4FC3F7-outlined button with GPS icon labeled "Usar mi ubicación actual". Below, small uppercase label "Administración" in #9E9E9E, then a two-column grid of EXACTLY five icon tiles and no more, on #1C1F26, 12px rounded corners, each with a circular #4FC3F7 badge icon and its exact Spanish label: "Vendedores" (people icon), "Cupos por franja" (calendar-clock icon), "Pedidos" (clipboard icon), "Datos de cobro" (bank icon), "Apoyar el desarrollo" (heart icon). Do not add a sixth tile. Clean flat sans-serif type, rounded 8-12px corners, generous spacing, hierarchy favoring the hero toggles.

**Qué resuelve:** separa los dos interruptores urgentes (tienda abierta / en
línea) en tarjetas hero grandes con estado codificado por color, y agrupa los
5 accesos secundarios bajo "Administración" en vez de una lista plana.

**Qué se corrigió en la regeneración — el defecto más grave de toda la
ronda:** la primera pasada imprimió literalmente el código hexadecimal
`#9E9E9E` como texto visible dentro de la imagen ("#9E9E9E°, a -97.7381°"),
junto con una dirección inventada ilegible ("Adreccio de entrega — 3103 Hual
Alxenado, 233") y un sexto tile alucinado ("Contitos") que no corresponde a
ninguna función real. Se corrigió dando el texto EXACTO a renderizar entre
comillas ("Chapinero, Bogotá" / "Punto de salida de domicilios"), quitando
toda mención de coordenadas numéricas, y exigiendo explícitamente "exactamente
cinco tiles, no un sexto". Resultado: limpio, sin fugas de código ni tiles
inventados.

---

**Nota para quien retome esto:** son mockups de dirección visual, no capturas
de la app real — sirven para acordar layout/paleta antes de construir la UI
de verdad en React Native. El vocabulario "Billetera móvil A" es un
placeholder deliberado: en la app real esos botones dicen "Nequi" / "Bre-B"
tal como ya está implementado en `ShopScreen.js` y `ShopAdminScreen.js`.
