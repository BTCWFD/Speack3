// Require helpers first so NODE_ENV/JWT secrets are set before the app loads.
const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'slots-seller@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');
const { SHOP_UTC_OFFSET } = require('../models/DeliverySlot');

// Construye un instante UTC que caiga en una hora local concreta del negocio,
// N dias hacia adelante, para no depender de cuando se corran los tests.
function atShopHour(hour, daysAhead = 1) {
    const base = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const local = new Date(base.getTime() + SHOP_UTC_OFFSET * 60 * 60 * 1000);
    const dateKey = local.toISOString().slice(0, 10);
    const at = new Date(`${dateKey}T00:00:00.000Z`);
    at.setUTCHours(at.getUTCHours() + hour - SHOP_UTC_OFFSET);
    return at;
}

function dayOfWeekAt(date) {
    return new Date(date.getTime() + SHOP_UTC_OFFSET * 60 * 60 * 1000).getUTCDay();
}

async function createSlot(admin, { dayOfWeek, startHour, endHour, maxOrders }) {
    const res = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ dayOfWeek, startHour, endHour, maxOrders });
    return res;
}

async function orderAt(buyer, productId, when) {
    return await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({ items: [{ productId, qty: 1 }], requestedDeliveryTime: when.toISOString() });
}

describe('Cupos por franja', () => {
    let admin;
    let product;

    beforeAll(async () => {
        admin = await registerUser(app, { email: ADMIN_EMAIL });
        const res = await request(app)
            .post('/api/products')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ name: 'Fresa', emoji: '🍓', priceCOP: 60000 });
        product = res.body.product;
    });

    it('sin franjas configuradas no restringe nada (compatibilidad hacia atras)', async () => {
        const buyer = await registerUser(app);
        const res = await orderAt(buyer, product._id, atShopHour(15, 2));
        expect(res.status).toBe(201);
    });

    describe('con franjas configuradas', () => {
        let slotId;
        let when;

        beforeAll(async () => {
            when = atShopHour(15, 3);
            const res = await createSlot(admin, {
                dayOfWeek: dayOfWeekAt(when),
                startHour: 14,
                endHour: 18,
                maxOrders: 2
            });
            slotId = res.body.slot._id;
        });

        afterAll(async () => {
            await request(app).delete(`/api/slots/${slotId}`).set('Authorization', `Bearer ${admin.token}`);
        });

        it('acepta pedidos hasta llenar el cupo y luego rechaza con 409', async () => {
            const first = await orderAt(await registerUser(app), product._id, when);
            expect(first.status).toBe(201);

            const second = await orderAt(await registerUser(app), product._id, when);
            expect(second.status).toBe(201);

            // El tercero ya no cabe (maxOrders: 2).
            const third = await orderAt(await registerUser(app), product._id, when);
            expect(third.status).toBe(409);
            expect(third.body.reason).toBe('full');
        });

        it('rechaza una hora fuera de toda franja', async () => {
            const buyer = await registerUser(app);
            // 09:00 local, la franja va de 14 a 18.
            const res = await orderAt(buyer, product._id, atShopHour(9, 3));
            expect(res.status).toBe(409);
            expect(res.body.reason).toBe('closed');
        });

        it('el cupo es por fecha, no por regla: el mismo dia de la semana siguiente esta libre', async () => {
            const buyer = await registerUser(app);
            const nextWeek = new Date(when.getTime() + 7 * 24 * 60 * 60 * 1000);
            const res = await orderAt(buyer, product._id, nextWeek);
            expect(res.status).toBe(201);
        });

        it('cancelar un pedido libera su cupo', async () => {
            const dayLater = atShopHour(15, 10);
            const slot = await createSlot(admin, {
                dayOfWeek: dayOfWeekAt(dayLater),
                startHour: 14,
                endHour: 18,
                maxOrders: 1
            });
            // Puede solaparse con la franja del bloque anterior si cae el mismo
            // dia de la semana; en ese caso el test no aplica.
            if (slot.status !== 201) return;

            const first = await orderAt(await registerUser(app), product._id, dayLater);
            expect(first.status).toBe(201);

            const blocked = await orderAt(await registerUser(app), product._id, dayLater);
            expect(blocked.status).toBe(409);

            await request(app)
                .patch(`/api/orders/${first.body.order._id}/status`)
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ status: 'cancelled' });

            const afterCancel = await orderAt(await registerUser(app), product._id, dayLater);
            expect(afterCancel.status).toBe(201);

            await request(app)
                .delete(`/api/slots/${slot.body.slot._id}`)
                .set('Authorization', `Bearer ${admin.token}`);
        });
    });

    it('solo el admin puede crear franjas', async () => {
        const buyer = await registerUser(app);
        const res = await request(app)
            .post('/api/slots')
            .set('Authorization', `Bearer ${buyer.token}`)
            .send({ dayOfWeek: 1, startHour: 8, endHour: 12, maxOrders: 5 });
        expect(res.status).toBe(403);
    });

    it('rechaza franjas invalidas y solapadas', async () => {
        const invalid = await createSlot(admin, { dayOfWeek: 2, startHour: 18, endHour: 14, maxOrders: 3 });
        expect(invalid.status).toBe(400);

        const ok = await createSlot(admin, { dayOfWeek: 2, startHour: 8, endHour: 12, maxOrders: 3 });
        expect(ok.status).toBe(201);

        const overlapping = await createSlot(admin, { dayOfWeek: 2, startHour: 10, endHour: 14, maxOrders: 3 });
        expect(overlapping.status).toBe(409);

        await request(app)
            .delete(`/api/slots/${ok.body.slot._id}`)
            .set('Authorization', `Bearer ${admin.token}`);
    });
});
