const { priceLine } = require('../services/pricingService');

const fresa = { priceCOP: 60000, bundleQty: 2, bundlePriceCOP: 100000 };
const sinPromo = { priceCOP: 40000 };

describe('Promociones por cantidad', () => {
    it('cobra precio unitario cuando no alcanza el combo', () => {
        expect(priceLine(fresa, 1)).toEqual({ subtotalCOP: 60000, bundlesApplied: 0, savedCOP: 0 });
    });

    it('aplica el combo exacto', () => {
        expect(priceLine(fresa, 2)).toEqual({ subtotalCOP: 100000, bundlesApplied: 1, savedCOP: 20000 });
    });

    it('mezcla combos completos con unidades sueltas', () => {
        // 5 fresas = 2 combos (200.000) + 1 suelta (60.000)
        expect(priceLine(fresa, 5)).toEqual({ subtotalCOP: 260000, bundlesApplied: 2, savedCOP: 40000 });
    });

    it('un producto sin promo se cobra siempre por unidad', () => {
        expect(priceLine(sinPromo, 4)).toEqual({ subtotalCOP: 160000, bundlesApplied: 0, savedCOP: 0 });
    });

    it('nunca cobra mas que el precio unitario si la promo esta mal configurada', () => {
        // "Promo" que sale mas cara que comprar suelto: se ignora.
        const malPuesta = { priceCOP: 10000, bundleQty: 2, bundlePriceCOP: 25000 };
        expect(priceLine(malPuesta, 2)).toEqual({ subtotalCOP: 20000, bundlesApplied: 0, savedCOP: 0 });
    });

    it('ignora una promo a medio configurar', () => {
        expect(priceLine({ priceCOP: 10000, bundleQty: 2 }, 2).subtotalCOP).toBe(20000);
        expect(priceLine({ priceCOP: 10000, bundlePriceCOP: 15000 }, 2).subtotalCOP).toBe(20000);
    });
});
