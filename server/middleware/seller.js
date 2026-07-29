const { REQUIRED_VERSIONS } = require('../legal/documents');
const { isShopAdmin } = require('./shopAdmin');

// Un vendedor solo puede operar si (a) el admin lo habilito y (b) tiene
// aceptada la version VIGENTE de los terminos y de la politica de privacidad.
// Si se publica una version nueva, deja de poder vender hasta que la acepte:
// esa es justamente la razon de versionar los documentos.
const hasAcceptedCurrent = (user) => {
    const accepted = user?.legalAccepted || {};
    return Object.entries(REQUIRED_VERSIONS).every(
        ([doc, version]) => accepted[doc]?.version >= version
    );
};

const isActiveSeller = (user) => user?.role === 'seller' && user?.sellerActive !== false;

// Deja pasar al admin (que siempre puede operar su propia tienda) y a los
// vendedores habilitados que estan al dia con los documentos.
const seller = (req, res, next) => {
    if (isShopAdmin(req.user)) {
        return next();
    }

    if (!isActiveSeller(req.user)) {
        return res.status(403).json({
            error: 'Tu cuenta no esta habilitada como vendedor',
            reason: 'not_a_seller'
        });
    }

    if (!hasAcceptedCurrent(req.user)) {
        return res.status(451).json({
            error: 'Debes aceptar los terminos y la politica de privacidad vigentes para vender',
            reason: 'legal_acceptance_required',
            required: REQUIRED_VERSIONS
        });
    }

    next();
};

module.exports = seller;
module.exports.hasAcceptedCurrent = hasAcceptedCurrent;
module.exports.isActiveSeller = isActiveSeller;
