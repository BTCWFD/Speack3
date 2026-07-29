const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const seller = require('../middleware/seller');
const shopAdmin = require('../middleware/shopAdmin');
const { resolveAdminUser } = require('../middleware/shopAdmin');
const Donation = require('../models/Donation');
const User = require('../models/User');
const web3PaymentService = require('../services/web3PaymentService');

const VALID_METHODS = ['nequi', 'crypto', 'breb'];

// Sugerencias, no una tarifa. El vendedor puede aportar cualquier monto.
const SUGGESTED_COP = [10000, 20000, 50000];

// @route   GET /api/donations/info
// @desc    A donde aportar y cuanto se sugiere. Solo para vendedores: es a
//          ellos a quienes se les ofrece apoyar el desarrollo.
// @access  Private (vendedor o admin)
router.get('/info', [auth, seller], async (req, res) => {
    try {
        const admin = await resolveAdminUser();
        const payout = admin?.payout || {};

        res.json({
            // Se deja explicito en la respuesta para que la app no lo presente
            // como algo obligatorio.
            voluntary: true,
            message: 'Aportar es voluntario y no cambia en nada tu cuenta de vendedor.',
            suggestedCOP: SUGGESTED_COP,
            payTo: (payout.nequi || payout.breb)
                ? { username: admin.username, nequi: payout.nequi || null, breb: payout.breb || null }
                : null,
            myDonations: await Donation.findByUser(req.userId)
        });
    } catch (error) {
        console.error('Donation info error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/donations
// @desc    Reportar un aporte. Igual que con los pedidos, nequi/breb quedan
//          reportados hasta que el admin confirme que llegaron; cripto se
//          verifica en la cadena.
// @access  Private (vendedor o admin)
router.post('/', [
    auth,
    seller,
    body('amountCOP').isInt({ min: 1 }).withMessage('El monto debe ser un entero positivo'),
    body('method').isIn(VALID_METHODS).withMessage(`method debe ser uno de ${VALID_METHODS.join(', ')}`)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amountCOP, method, txHash, reference } = req.body;

        if (method === 'crypto') {
            if (!txHash) {
                return res.status(400).json({ error: 'txHash requerido para aportes en cripto' });
            }
            let confirmed = false;
            try {
                confirmed = await web3PaymentService.verifyTransaction(txHash);
            } catch (chainError) {
                console.error('Donation chain verification error:', chainError);
                return res.status(502).json({ error: 'No se pudo verificar la transaccion, intenta de nuevo' });
            }
            if (!confirmed) {
                return res.status(400).json({ error: 'La transaccion no aparece confirmada en la cadena' });
            }

            const donation = await Donation.create({
                userId: req.userId,
                username: req.user.username,
                amountCOP,
                method,
                reference: txHash
            });
            const verified = await Donation.findByIdAndUpdate(donation._id, {
                status: 'confirmed',
                confirmedAt: new Date()
            });
            return res.status(201).json({ message: 'Aporte verificado. ¡Gracias!', donation: verified });
        }

        const donation = await Donation.create({
            userId: req.userId,
            username: req.user.username,
            amountCOP,
            method,
            reference: reference || ''
        });

        res.status(201).json({
            message: 'Aporte reportado. ¡Gracias! Queda pendiente de confirmar.',
            donation
        });
    } catch (error) {
        console.error('Create donation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/donations/mine
// @access  Private (vendedor o admin)
router.get('/mine', [auth, seller], async (req, res) => {
    try {
        res.json({ donations: await Donation.findByUser(req.userId) });
    } catch (error) {
        console.error('My donations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /api/donations
// @desc    Todos los aportes y el total confirmado
// @access  Private (shop admin only)
router.get('/', [auth, shopAdmin], async (req, res) => {
    try {
        res.json({
            donations: await Donation.findAll(),
            confirmedTotalCOP: await Donation.confirmedTotal()
        });
    } catch (error) {
        console.error('List donations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PATCH /api/donations/:id
// @desc    Confirmar o rechazar un aporte reportado
// @access  Private (shop admin only)
router.patch('/:id', [
    auth,
    shopAdmin,
    body('status').isIn(['confirmed', 'rejected']).withMessage('status debe ser confirmed o rejected')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const donation = await Donation.findById(req.params.id);
        if (!donation) {
            return res.status(404).json({ error: 'Aporte no encontrado' });
        }

        const updated = await Donation.findByIdAndUpdate(req.params.id, {
            status: req.body.status,
            ...(req.body.status === 'confirmed' ? { confirmedAt: new Date() } : {})
        });

        res.json({ message: 'Aporte actualizado', donation: updated });
    } catch (error) {
        console.error('Update donation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
