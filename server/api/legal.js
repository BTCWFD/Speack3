const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { DOCUMENTS, REQUIRED_VERSIONS } = require('../legal/documents');

// @route   GET /api/legal
// @desc    Versiones vigentes, para saber si hay que volver a aceptar
// @access  Publico (hay que poder leerlos ANTES de registrarse)
router.get('/', (req, res) => {
    res.json({
        documents: Object.values(DOCUMENTS).map(({ id, version, title, updatedAt }) => ({
            id, version, title, updatedAt
        })),
        requiredVersions: REQUIRED_VERSIONS
    });
});

// @route   GET /api/legal/:id
// @desc    Texto completo de un documento (terms | privacy)
// @access  Publico
router.get('/:id', (req, res) => {
    const doc = DOCUMENTS[req.params.id];
    if (!doc) {
        return res.status(404).json({ error: 'Documento no encontrado' });
    }
    res.json({ document: doc });
});

// @route   POST /api/legal/accept
// @desc    Dejar constancia de que este usuario acepto una version concreta.
//          Se guarda la version aceptada y cuando, para poder demostrar QUE
//          texto acepto y no solo que "acepto algo".
// @access  Private
router.post('/accept', [
    auth,
    body('accept').isArray({ min: 1 }).withMessage('accept debe ser una lista de documentos'),
    body('accept.*.id').isString().notEmpty(),
    body('accept.*.version').isInt({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const legalAccepted = { ...(req.user.legalAccepted || {}) };

        for (const { id, version } of req.body.accept) {
            const doc = DOCUMENTS[id];
            if (!doc) {
                return res.status(400).json({ error: `Documento desconocido: ${id}` });
            }
            // Aceptar una version que ya no es la vigente no sirve de nada y
            // dejaria una constancia enganosa.
            if (version !== doc.version) {
                return res.status(409).json({
                    error: `La version vigente de "${id}" es la ${doc.version}, no la ${version}`,
                    currentVersion: doc.version
                });
            }
            legalAccepted[id] = { version: doc.version, acceptedAt: new Date() };
        }

        const updated = await User.findByIdAndUpdate(req.userId, { legalAccepted });
        res.json({ message: 'Aceptacion registrada', legalAccepted: updated.legalAccepted });
    } catch (error) {
        console.error('Legal accept error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
