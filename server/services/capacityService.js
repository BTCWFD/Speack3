const Order = require('../models/Order');
const DeliverySlot = require('../models/DeliverySlot');
const { toShopLocal } = require('../models/DeliverySlot');

// Un pedido cancelado libera su cupo; el resto (incluidos los que siguen en
// lista de espera) lo ocupa, porque la lista de espera existe justamente para
// que el vendedor decida, no para colar pedidos por encima del tope.
const OCCUPIES_CAPACITY = (order) => order.status !== 'cancelled';

// Cuantos pedidos ya ocupan esa franja EN ESA FECHA concreta.
async function countTaken(slot, date) {
    const { dateKey } = toShopLocal(date);
    const all = await Order.find({});

    return all.filter((order) => {
        if (!OCCUPIES_CAPACITY(order)) return false;
        const when = order.requestedDeliveryTime && new Date(order.requestedDeliveryTime);
        if (!when || Number.isNaN(when.getTime())) return false;

        const local = toShopLocal(when);
        return (
            local.dateKey === dateKey &&
            local.hour >= slot.startHour &&
            local.hour < slot.endHour
        );
    }).length;
}

// Decide si se puede aceptar una entrega en ese instante.
//
// Si el vendedor no ha configurado NINGUNA franja, no se restringe nada: la
// tienda funciona como antes de existir esta feature.
async function checkCapacity(requestedDeliveryTime) {
    const anyConfigured = await DeliverySlot.hasAnyActive();
    if (!anyConfigured) {
        return { ok: true, unrestricted: true };
    }

    const slot = await DeliverySlot.findSlotCovering(requestedDeliveryTime);
    if (!slot) {
        return {
            ok: false,
            reason: 'closed',
            error: 'No hay entregas disponibles en ese horario'
        };
    }

    const taken = await countTaken(slot, requestedDeliveryTime);
    if (taken >= slot.maxOrders) {
        return {
            ok: false,
            reason: 'full',
            error: 'Esa franja ya esta llena, elige otro horario',
            slot,
            taken
        };
    }

    return { ok: true, slot, taken, remaining: slot.maxOrders - taken };
}

// Disponibilidad de los proximos N dias, para que la app pinte las franjas
// libres en vez de dejar al cliente adivinar.
async function availability(days = 14, from = new Date()) {
    const slots = await DeliverySlot.find({ active: true });
    if (slots.length === 0) return [];

    const result = [];
    for (let i = 0; i < days; i += 1) {
        const day = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
        const { dayOfWeek, dateKey } = toShopLocal(day);

        for (const slot of slots.filter((s) => s.dayOfWeek === dayOfWeek)) {
            // Instante concreto dentro de la franja, para contar contra el dia
            // correcto (reconstruye el UTC que corresponde a esa hora local).
            const at = new Date(`${dateKey}T00:00:00.000Z`);
            at.setUTCHours(at.getUTCHours() + slot.startHour - DeliverySlot.SHOP_UTC_OFFSET);
            if (at <= new Date()) continue; // franja ya pasada

            const taken = await countTaken(slot, at);
            result.push({
                slotId: slot._id,
                date: dateKey,
                dayOfWeek: slot.dayOfWeek,
                startHour: slot.startHour,
                endHour: slot.endHour,
                maxOrders: slot.maxOrders,
                taken,
                remaining: Math.max(0, slot.maxOrders - taken),
                startsAt: at.toISOString()
            });
        }
    }

    return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

module.exports = { checkCapacity, availability, countTaken };
