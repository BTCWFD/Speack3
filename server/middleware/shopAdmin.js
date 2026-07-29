// Speack3's product catalog is single-vendor: only the seller (Wilfredo) can
// create/edit products and manage orders. Identity is checked by email
// against SHOP_ADMIN_EMAIL rather than a stored role, since there is exactly
// one seller. Fails closed if the env var isn't set, same convention as
// resolveCorsOrigins() in server.js.
const shopAdmin = (req, res, next) => {
    const adminEmail = process.env.SHOP_ADMIN_EMAIL;

    if (!adminEmail) {
        return res.status(503).json({ error: 'Shop admin not configured (SHOP_ADMIN_EMAIL unset)' });
    }

    if (req.user?.email?.toLowerCase() !== adminEmail.toLowerCase()) {
        return res.status(403).json({ error: 'Only the shop admin can perform this action' });
    }

    next();
};

module.exports = shopAdmin;
