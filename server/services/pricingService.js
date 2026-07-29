// Precio de una linea del pedido, aplicando la promocion por cantidad si el
// producto tiene una configurada (p.ej. "2 fresas por 100.000" en vez de
// 60.000 c/u).
//
// Se cobran tantos combos completos como quepan y el resto a precio unitario:
// 5 unidades con promo de 2 = 2 combos + 1 suelta. Nunca puede salir mas caro
// que el precio unitario puro, porque el vendedor podria configurar una
// "promo" peor por error; en ese caso se cobra lo mas barato para el cliente.
function priceLine(product, qty) {
    const unitTotal = product.priceCOP * qty;

    const hasPromo =
        Number.isInteger(product.bundleQty) &&
        product.bundleQty > 1 &&
        Number.isInteger(product.bundlePriceCOP) &&
        product.bundlePriceCOP >= 0;

    if (!hasPromo) {
        return { subtotalCOP: unitTotal, bundlesApplied: 0, savedCOP: 0 };
    }

    const bundles = Math.floor(qty / product.bundleQty);
    const loose = qty % product.bundleQty;
    const promoTotal = bundles * product.bundlePriceCOP + loose * product.priceCOP;

    if (promoTotal >= unitTotal) {
        return { subtotalCOP: unitTotal, bundlesApplied: 0, savedCOP: 0 };
    }

    return {
        subtotalCOP: promoTotal,
        bundlesApplied: bundles,
        savedCOP: unitTotal - promoTotal
    };
}

module.exports = { priceLine };
