// Cotizacion de domicilios en Bogota.
//
// LIMITACION IMPORTANTE: la distancia es en linea recta (haversine), no por
// calles. En Bogota el recorrido real suele ser ~1.3-1.4x la linea recta por la
// malla vial y los sentidos unicos, asi que el cobro se queda corto frente al
// trayecto que realmente hace el domiciliario. Se aplica ROAD_FACTOR para
// compensar de forma aproximada; para cobrar el recorrido exacto haria falta
// una API de rutas (Google Directions, Mapbox, OSRM), que es de pago o requiere
// alojar un servidor de rutas.
const COP_PER_KM = Number(process.env.DELIVERY_COP_PER_KM ?? 1800);

// Factor para acercar la linea recta al recorrido real por calles.
const ROAD_FACTOR = Number(process.env.DELIVERY_ROAD_FACTOR ?? 1.35);

// Se cobra al menos 1 km, para que un domicilio de 300 m no salga en 700 pesos
// (el domiciliario igual se desplaza, espera y entrega).
const MIN_BILLABLE_KM = Number(process.env.DELIVERY_MIN_KM ?? 1);

// Radio de cobertura desde la tienda.
const MAX_DELIVERY_KM = Number(process.env.DELIVERY_MAX_KM ?? 20);

// Caja aproximada de Bogota D.C. (incluye el area urbana y algo de borde).
// Sirve para atajar coordenadas obviamente equivocadas (otra ciudad, un 0/0 por
// un bug del GPS), no como limite legal del distrito.
const BOGOTA_BOUNDS = { minLat: 4.40, maxLat: 4.90, minLng: -74.30, maxLng: -73.95 };

const isInBogota = ({ lat, lng }) =>
    lat >= BOGOTA_BOUNDS.minLat && lat <= BOGOTA_BOUNDS.maxLat &&
    lng >= BOGOTA_BOUNDS.minLng && lng <= BOGOTA_BOUNDS.maxLng;

const isValidCoord = (p) =>
    p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;

// Distancia en km sobre la superficie terrestre entre dos coordenadas.
function haversineKm(a, b) {
    const R = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(h));
}

// Cotiza un domicilio desde la tienda hasta el destino.
// Devuelve { ok, feeCOP, km, billableKm } o { ok: false, error, reason }.
function quote(origin, destination) {
    if (!isValidCoord(origin)) {
        return { ok: false, reason: 'no_origin', error: 'La tienda no tiene ubicacion configurada' };
    }
    if (!isValidCoord(destination)) {
        return { ok: false, reason: 'bad_destination', error: 'Coordenadas de destino invalidas' };
    }
    if (!isInBogota(destination)) {
        return { ok: false, reason: 'out_of_city', error: 'Por ahora solo hacemos domicilios en Bogota' };
    }

    const straightKm = haversineKm(origin, destination);
    const routeKm = straightKm * ROAD_FACTOR;

    if (routeKm > MAX_DELIVERY_KM) {
        return {
            ok: false,
            reason: 'too_far',
            error: `Ese punto queda a ${routeKm.toFixed(1)} km, fuera del area de cobertura (${MAX_DELIVERY_KM} km)`
        };
    }

    const billableKm = Math.max(routeKm, MIN_BILLABLE_KM);
    // Redondeo a los 100 pesos mas cercanos: un precio de "8.437" se ve raro
    // y complica el pago en efectivo.
    const feeCOP = Math.round((billableKm * COP_PER_KM) / 100) * 100;

    return {
        ok: true,
        feeCOP,
        km: Number(routeKm.toFixed(2)),
        straightLineKm: Number(straightKm.toFixed(2)),
        billableKm: Number(billableKm.toFixed(2)),
        copPerKm: COP_PER_KM
    };
}

module.exports = {
    quote,
    haversineKm,
    isInBogota,
    isValidCoord,
    COP_PER_KM,
    MAX_DELIVERY_KM,
    BOGOTA_BOUNDS
};
