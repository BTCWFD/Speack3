// Servicios que el admin puede habilitarle a un vendedor. Un vendedor solo
// puede operar los que tenga asignados: habilitar a alguien no le da acceso a
// todo, sino a lo que se le marque.
//
// Esta lista es el punto para adaptar la tienda a lo que realmente se ofrece:
// agregar, quitar o renombrar aqui se refleja en la app sin tocar mas codigo
// (la app pide GET /api/sellers/services para pintar las opciones).
const SERVICE_TYPES = [
    {
        id: 'catalogo',
        label: 'Vender del catalogo',
        description: 'Publicar y vender los productos de la tienda'
    },
    {
        id: 'domicilios',
        label: 'Hacer domicilios',
        description: 'Entregar pedidos en el area de cobertura'
    },
    {
        id: 'encargos',
        label: 'Pedidos por encargo',
        description: 'Atender pedidos especiales fuera del catalogo fijo'
    },
    {
        id: 'mayorista',
        label: 'Venta al por mayor',
        description: 'Atender pedidos de cantidad con precio de mayorista'
    }
];

const SERVICE_IDS = SERVICE_TYPES.map((s) => s.id);

const areValidServices = (services) =>
    Array.isArray(services) &&
    services.length > 0 &&
    services.every((s) => SERVICE_IDS.includes(s));

module.exports = { SERVICE_TYPES, SERVICE_IDS, areValidServices };
