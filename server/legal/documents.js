// Terminos y politica de privacidad que un vendedor debe aceptar.
//
// ⚠️ ESTE TEXTO NO ES ASESORIA LEGAL NI UN DOCUMENTO VALIDADO POR UN ABOGADO.
// Es un borrador de trabajo para que el mecanismo de aceptacion funcione y
// quede constancia de quien acepto que version. Antes de operar con vendedores
// reales, un abogado tiene que revisarlo: la tienda trata datos personales
// (nombre, correo, telefono, direccion y GEOLOCALIZACION de entrega), lo que en
// Colombia cae bajo la Ley 1581 de 2012 y el Decreto 1074 de 2015, con
// obligaciones concretas: autorizacion previa e informada del titular, aviso de
// privacidad, canal para ejercer derechos (conocer, actualizar, rectificar,
// suprimir) y, si se superan ciertos umbrales, registro de las bases de datos
// ante la SIC (RNBD). Publicar un texto asi sin revisar puede dejar a la tienda
// expuesta a sanciones.
//
// Al cambiar un texto hay que SUBIR la version: los vendedores que aceptaron
// una version anterior tendran que volver a aceptar antes de seguir operando.

const TERMS = {
    id: 'terms',
    version: 1,
    title: 'Terminos y condiciones para vendedores',
    updatedAt: '2026-07-29',
    body: `
1. Quien puede vender
Solo el administrador de la tienda habilita cuentas de vendedor. Ser usuario de
Speack3 no da derecho a vender. El administrador puede revocar el permiso en
cualquier momento, sin que ello genere indemnizacion.

2. Responsabilidad sobre el producto
El vendedor responde por lo que publica: que exista, que sea legal, que pueda
comercializarse y que corresponda a lo mostrado en el catalogo. El vendedor
declara que cuenta con los permisos, registros o licencias que su producto
requiera.

3. Prohibiciones
No se permite ofrecer bienes o servicios cuya venta este restringida o prohibida
por la ley colombiana, ni productos falsificados, robados, o que infrinjan
derechos de terceros. El incumplimiento implica la baja inmediata de la cuenta y,
si corresponde, el reporte a las autoridades.

4. Precios, promociones y domicilios
Los precios publicados incluyen los impuestos aplicables cuando la ley lo exija.
El costo del domicilio lo calcula la plataforma segun la distancia y se informa
al comprador antes de confirmar el pedido.

5. Cumplimiento del pedido
El vendedor se compromete a cumplir los pedidos que confirme, en la franja de
entrega acordada. Cancelar de forma reiterada pedidos ya confirmados es causal
de baja.

6. Pagos
Los pagos reportados por Nequi o Bre-B quedan pendientes hasta que el vendedor
confirme haber recibido el dinero. Los pagos en cripto se verifican en la
cadena. La plataforma no custodia el dinero de las ventas ni actua como
intermediario de pago.

7. Datos de los compradores
Los datos que el vendedor conoce por una venta (nombre, contacto, direccion y
ubicacion de entrega) se pueden usar UNICAMENTE para cumplir ese pedido. Queda
prohibido usarlos para publicidad, cederlos o venderlos a terceros. Ver la
politica de privacidad.

8. Suspension
El administrador puede suspender una cuenta de vendedor ante indicios de
incumplimiento de estos terminos, sin aviso previo.

9. Cambios
Estos terminos pueden cambiar. Al cambiar, el vendedor debera aceptar la nueva
version antes de poder seguir operando.
`.trim()
};

const PRIVACY = {
    id: 'privacy',
    version: 1,
    title: 'Politica de tratamiento de datos personales',
    updatedAt: '2026-07-29',
    body: `
Responsable del tratamiento
La tienda operada a traves de Speack3. Los datos se tratan conforme a la Ley 1581
de 2012 y sus decretos reglamentarios.

Que datos se recogen
- De todo usuario: nombre de usuario, correo electronico y fecha de registro.
- De quien hace un pedido: los productos pedidos, la hora de entrega solicitada
  y, si pide domicilio, la DIRECCION Y COORDENADAS del punto de entrega.
- De quien reporta un pago: la referencia del pago (numero de telefono Nequi,
  identificador Bre-B o hash de la transaccion).

Para que se usan
Unicamente para operar la tienda: procesar el pedido, calcular el domicilio,
coordinar la entrega y dejar constancia del pago. No se usan para publicidad ni
se comparten con terceros distintos de quien realiza la entrega, y a este solo
se le entrega lo necesario para llegar al destino.

La ubicacion
Las coordenadas de entrega son un dato sensible en la practica: revelan donde
vive o trabaja una persona. Solo se recogen si el comprador pide domicilio, solo
son visibles para el administrador y para el vendedor de ese pedido, y no se usan
para ningun otro fin.

Cuanto tiempo se conservan
Los pedidos se conservan mientras sean necesarios para atender reclamaciones y
cumplir obligaciones contables. Los datos de ubicacion pueden solicitarse
eliminados una vez entregado el pedido.

Derechos del titular
Todo titular puede conocer, actualizar y rectificar sus datos, solicitar prueba
de la autorizacion otorgada, ser informado del uso dado a sus datos, presentar
quejas ante la Superintendencia de Industria y Comercio y solicitar la supresion
de sus datos cuando no exista un deber legal de conservarlos. Para ejercerlos,
escribir al canal de contacto de la tienda.

Seguridad
Las contrasenas se almacenan cifradas (hash). El trafico viaja por HTTPS. El
acceso a los datos de pedidos esta restringido al administrador y al vendedor
correspondiente.

Vendedores
Un vendedor que acceda a datos de compradores queda obligado por esta politica y
responde por el uso indebido que haga de ellos.
`.trim()
};

const DOCUMENTS = { terms: TERMS, privacy: PRIVACY };

// Version que un vendedor debe tener aceptada para poder operar.
const REQUIRED_VERSIONS = {
    terms: TERMS.version,
    privacy: PRIVACY.version
};

module.exports = { DOCUMENTS, REQUIRED_VERSIONS, TERMS, PRIVACY };
