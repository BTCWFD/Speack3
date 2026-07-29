const { deliverySlots } = require('../config/database');

// Franjas de entrega recurrentes por dia de la semana. El vendedor define
// "los viernes de 14 a 18, maximo 10 pedidos" una sola vez y aplica todas las
// semanas; el cupo se cuenta contra la FECHA concreta del pedido, no contra la
// regla, para que cada viernes tenga sus propios 10 cupos.
//
// dayOfWeek: 0=domingo .. 6=sabado (igual que Date.getDay())
// startHour/endHour: hora local del negocio, 0-24, tramo [start, end)
// maxOrders: cuantos pedidos caben en esa franja
//
// La hora local se calcula con un desfase fijo (SHOP_UTC_OFFSET, por defecto
// -5 = Colombia). Es correcto mientras el negocio este en una zona sin horario
// de verano; si algun dia se opera desde una zona con DST hay que cambiarlo por
// una libreria de zonas horarias de verdad.
const SHOP_UTC_OFFSET = Number(process.env.SHOP_UTC_OFFSET ?? -5);

// Convierte un instante UTC a los "campos de reloj" del negocio.
const toShopLocal = (date) => {
    const shifted = new Date(date.getTime() + SHOP_UTC_OFFSET * 60 * 60 * 1000);
    return {
        dayOfWeek: shifted.getUTCDay(),
        hour: shifted.getUTCHours(),
        // Clave de dia local (YYYY-MM-DD) para agrupar pedidos por fecha.
        dateKey: shifted.toISOString().slice(0, 10)
    };
};

class DeliverySlotModel {
    async create(data) {
        data.createdAt = new Date();
        data.active = data.active !== false;
        return await deliverySlots.insert(data);
    }

    async findById(id) {
        return await deliverySlots.findOne({ _id: id });
    }

    async find(query = {}) {
        return await deliverySlots.find(query);
    }

    async findByIdAndUpdate(id, update) {
        await deliverySlots.update({ _id: id }, { $set: { ...update, updatedAt: new Date() } });
        return await this.findById(id);
    }

    async deleteById(id) {
        return await deliverySlots.remove({ _id: id });
    }

    // Franja activa que cubre ese instante, o null si ninguna lo cubre.
    async findSlotCovering(date) {
        const { dayOfWeek, hour } = toShopLocal(date);
        const slots = await this.find({ active: true, dayOfWeek });
        return slots.find((s) => hour >= s.startHour && hour < s.endHour) || null;
    }

    async hasAnyActive() {
        const slots = await this.find({ active: true });
        return slots.length > 0;
    }
}

module.exports = new DeliverySlotModel();
module.exports.toShopLocal = toShopLocal;
module.exports.SHOP_UTC_OFFSET = SHOP_UTC_OFFSET;
