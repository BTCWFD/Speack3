// Seeds (or updates) the initial catalog. Safe to re-run: matches products by
// name and updates the price instead of duplicating.
//
// Uso (desde server/, con las mismas env vars que usa el server — p.ej.
// MONGODB_URI si se quiere sembrar directamente en Atlas):
//   node scripts/seed-products.js
require('dotenv').config();
const db = require('../config/database');
const Product = require('../models/Product');

const CATALOG = [
    { name: 'Fresa', emoji: '🍓', priceCOP: 60000 },
    { name: 'Coco', emoji: '🥥', priceCOP: 40000 },
    { name: 'Pila', emoji: '🔋', priceCOP: 40000 },
    { name: 'Cuadro', emoji: '⬜', priceCOP: 50000 }
];

(async () => {
    await db.connect();

    for (const item of CATALOG) {
        const existing = await Product.find({ name: item.name });
        if (existing.length > 0) {
            await Product.findByIdAndUpdate(existing[0]._id, item);
            console.log(`Actualizado: ${item.emoji} ${item.name} - $${item.priceCOP.toLocaleString('es-CO')} COP`);
        } else {
            await Product.create(item);
            console.log(`Creado: ${item.emoji} ${item.name} - $${item.priceCOP.toLocaleString('es-CO')} COP`);
        }
    }

    console.log('Listo.');
    process.exit(0);
})().catch((err) => {
    console.error('Error sembrando el catalogo:', err.message);
    process.exit(1);
});
