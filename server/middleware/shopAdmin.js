// Speack3's product catalog is single-vendor: only the seller can create/edit
// products and manage orders.
//
// The admin is pinned by user id (SHOP_ADMIN_USER_ID) rather than by email:
// registration is open, so whoever signs up with the admin address first would
// otherwise inherit the shop. An id is assigned by the server at registration
// and can't be claimed by signing up.
//
// SHOP_ADMIN_EMAIL is still honoured as a fallback so an existing deployment
// keeps working, but it's only safe while the admin account already exists —
// hence the startup warning in server.js. Fails closed if neither is set, same
// convention as resolveCorsOrigins().
const isShopAdmin = (user) => {
    const adminId = process.env.SHOP_ADMIN_USER_ID;
    if (adminId) {
        // req.user is the raw stored document, which carries _id; API responses
        // expose the same value as `id`. Accept either so callers don't have to
        // care which shape they're holding.
        const userId = user?._id ?? user?.id;
        return Boolean(userId) && String(userId) === String(adminId);
    }

    const adminEmail = process.env.SHOP_ADMIN_EMAIL;
    if (adminEmail) {
        return user?.email?.toLowerCase() === adminEmail.toLowerCase();
    }

    return false;
};

const isShopAdminConfigured = () =>
    Boolean(process.env.SHOP_ADMIN_USER_ID || process.env.SHOP_ADMIN_EMAIL);

const shopAdmin = (req, res, next) => {
    if (!isShopAdminConfigured()) {
        return res.status(503).json({
            error: 'Shop admin not configured (set SHOP_ADMIN_USER_ID)'
        });
    }

    if (!isShopAdmin(req.user)) {
        return res.status(403).json({ error: 'Only the shop admin can perform this action' });
    }

    next();
};

// Devuelve el usuario admin. Resuelve tanto por id como por el respaldo por
// correo, para que quien consulte "a quien se le paga" o "a quien se avisa" no
// tenga que repetir esa logica y romperse cuando el despliegue usa el respaldo.
const resolveAdminUser = async () => {
    // Se importa aqui dentro para no crear un ciclo: User -> config/database
    // se carga al arrancar, y este middleware lo cargan las rutas.
    const User = require('../models/User');

    const adminId = process.env.SHOP_ADMIN_USER_ID;
    if (adminId) {
        return await User.findById(adminId);
    }

    const adminEmail = process.env.SHOP_ADMIN_EMAIL;
    if (adminEmail) {
        return await User.findOne({ email: adminEmail.toLowerCase() });
    }

    return null;
};

module.exports = shopAdmin;
module.exports.isShopAdmin = isShopAdmin;
module.exports.isShopAdminConfigured = isShopAdminConfigured;
module.exports.resolveAdminUser = resolveAdminUser;
