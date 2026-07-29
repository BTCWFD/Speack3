// Un pedido puede pagarse en dos partes: una en efectivo (se cobra al
// entregar) y el resto por Nequi/Bre-B/cripto. paymentStatus es el agregado de
// las dos partes, no de una sola, y es lo unico que ya lee el resto de la app
// (mobile, notificaciones) — por eso se calcula aqui una sola vez y no se
// repite la logica en cada endpoint.
//
// Para un pedido sin parte en efectivo (cashCOP === 0, el caso de siempre) la
// formula da exactamente electronicStatus tal cual, asi que el comportamiento
// anterior no cambia ni un bit.
function aggregatePaymentStatus({ cashCOP, cashCollected, electronicStatus, electronicCOP }) {
    const cashDone = cashCOP === 0 || cashCollected;
    const electronicDone = electronicCOP === 0 || electronicStatus === 'paid';

    if (cashDone && electronicDone) return 'paid';
    // Con algo en efectivo siempre hay una entrega pendiente de cobrar, asi
    // que nunca vuelve a "unpaid" una vez se declaro la parte en efectivo.
    if (cashCOP > 0 || electronicStatus !== 'unpaid') return 'pending';
    return 'unpaid';
}

module.exports = { aggregatePaymentStatus };
