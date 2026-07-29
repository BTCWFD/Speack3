const { registerUser } = require('./helpers');

const ADMIN_EMAIL = 'delivery-seller@speack3.test';
process.env.SHOP_ADMIN_EMAIL = ADMIN_EMAIL;

const request = require('supertest');
const { app } = require('../server');
const { quote, haversineKm } = require('../services/deliveryService');

// Chapinero, un punto real de referencia en Bogota.
const TIENDA = { lat: 4.6486, lng: -74.0628 };

describe('Cotizacion de domicilios', () => {
    describe('calculo puro', () => {
        it('cobra el minimo de 1 km cuando el destino esta muy cerca', () => {
            // ~200 m: por debajo del minimo facturable.
            const cerca = { lat: 4.6500, lng: -74.0640 };
            const r = quote(TIENDA, cerca);
            expect(r.ok).toBe(true);
            expect(r.billableKm).toBe(1);
            expect(r.feeCOP).toBe(1800);
        });

        it('cobra proporcional a la distancia', () => {
            // ~5.5 km al norte.
            const lejos = { lat: 4.6980, lng: -74.0450 };
            const r = quote(TIENDA, lejos);
            expect(r.ok).toBe(true);
            expect(r.km).toBeGreaterThan(5);
            // Tarifa = km facturables * 1800, redondeado a los 100 mas cercanos.
            expect(r.feeCOP).toBe(Math.round((r.billableKm * 1800) / 100) * 100);
        });

        it('rechaza destinos fuera de Bogota', () => {
            const medellin = { lat: 6.2442, lng: -75.5812 };
            const r = quote(TIENDA, medellin);
            expect(r.ok).toBe(false);
            expect(r.reason).toBe('out_of_city');
        });

        it('rechaza coordenadas invalidas', () => {
            expect(quote(TIENDA, { lat: 'x', lng: null }).ok).toBe(false);
            expect(quote(TIENDA, null).ok).toBe(false);
        });

        it('falla si la tienda no tiene ubicacion', () => {
            const r = quote(null, { lat: 4.65, lng: -74.06 });
            expect(r.ok).toBe(false);
            expect(r.reason).toBe('no_origin');
        });

        it('la distancia es simetrica y cero consigo misma', () => {
            const a = { lat: 4.65, lng: -74.06 };
            const b = { lat: 4.70, lng: -74.10 };
            expect(haversineKm(a, a)).toBe(0);
            expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
        });
    });

    describe('endpoints', () => {
        let admin;

        beforeAll(async () => {
            admin = await registerUser(app, { email: ADMIN_EMAIL });
        });

        it('solo el admin puede fijar la ubicacion de la tienda', async () => {
            const buyer = await registerUser(app);
            const res = await request(app)
                .put('/api/delivery/origin')
                .set('Authorization', `Bearer ${buyer.token}`)
                .send(TIENDA);
            expect(res.status).toBe(403);
        });

        it('rechaza una tienda ubicada fuera de Bogota', async () => {
            const res = await request(app)
                .put('/api/delivery/origin')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ lat: 6.2442, lng: -75.5812 });
            expect(res.status).toBe(400);
        });

        it('fija la ubicacion y cotiza contra ella', async () => {
            const set = await request(app)
                .put('/api/delivery/origin')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ ...TIENDA, address: 'Chapinero' });
            expect(set.status).toBe(200);

            const buyer = await registerUser(app);
            const res = await request(app)
                .post('/api/delivery/quote')
                .set('Authorization', `Bearer ${buyer.token}`)
                .send({ lat: 4.6980, lng: -74.0450 });

            expect(res.status).toBe(200);
            expect(res.body.quote.feeCOP).toBeGreaterThan(0);
            expect(res.body.quote.copPerKm).toBe(1800);
        });

        it('suma el domicilio al total del pedido y no acepta la tarifa del cliente', async () => {
            await request(app)
                .put('/api/delivery/origin')
                .set('Authorization', `Bearer ${admin.token}`)
                .send(TIENDA);

            const prod = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'Fresa domi', emoji: '🍓', priceCOP: 60000 });

            const buyer = await registerUser(app);
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${buyer.token}`)
                .send({
                    items: [{ productId: prod.body.product._id, qty: 1 }],
                    requestedDeliveryTime: new Date(Date.now() + 86400000).toISOString(),
                    destination: { lat: 4.6980, lng: -74.0450, address: 'Calle falsa 123', feeCOP: 1 }
                });

            expect(res.status).toBe(201);
            const order = res.body.order;
            expect(order.delivery.feeCOP).toBeGreaterThan(1);
            expect(order.totalCOP).toBe(60000 + order.delivery.feeCOP);
        });

        it('rechaza un pedido con destino fuera de Bogota', async () => {
            const prod = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'Fresa lejos', emoji: '🍓', priceCOP: 60000 });

            const buyer = await registerUser(app);
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${buyer.token}`)
                .send({
                    items: [{ productId: prod.body.product._id, qty: 1 }],
                    requestedDeliveryTime: new Date(Date.now() + 86400000).toISOString(),
                    destination: { lat: 6.2442, lng: -75.5812 }
                });

            expect(res.status).toBe(422);
            expect(res.body.reason).toBe('out_of_city');
        });

        it('un pedido sin destino sigue funcionando (recoger en tienda)', async () => {
            const prod = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${admin.token}`)
                .send({ name: 'Fresa recoger', emoji: '🍓', priceCOP: 60000 });

            const buyer = await registerUser(app);
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${buyer.token}`)
                .send({
                    items: [{ productId: prod.body.product._id, qty: 1 }],
                    requestedDeliveryTime: new Date(Date.now() + 86400000).toISOString()
                });

            expect(res.status).toBe(201);
            expect(res.body.order.totalCOP).toBe(60000);
            expect(res.body.order.delivery).toBeNull();
        });
    });
});
