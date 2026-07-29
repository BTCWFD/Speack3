const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const shopAdmin = require('../middleware/shopAdmin');
const { isShopAdmin } = require('../middleware/shopAdmin');
const Product = require('../models/Product');

// @route   GET /api/products
// @desc    List the catalog (active products only, unless ?all=1 for the admin)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const showAll = req.query.all === '1' && isShopAdmin(req.user);
        const products = await Product.find(showAll ? {} : { active: true });

        res.json({ products });
    } catch (error) {
        console.error('List products error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   POST /api/products
// @desc    Add a product to the catalog
// @access  Private (shop admin only)
router.post('/', [
    auth,
    shopAdmin,
    body('name').trim().isLength({ min: 1, max: 50 }).withMessage('Product name required (1-50 chars)'),
    body('emoji').trim().isLength({ min: 1, max: 8 }).withMessage('Emoji required'),
    body('priceCOP').isInt({ min: 0 }).withMessage('priceCOP must be a non-negative integer')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, emoji, priceCOP, description } = req.body;
        const product = await Product.create({ name, emoji, priceCOP, description });

        res.status(201).json({ message: 'Product created', product });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   PUT /api/products/:id
// @desc    Update a product (price, name, active flag...)
// @access  Private (shop admin only)
router.put('/:id', [auth, shopAdmin], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const { name, emoji, priceCOP, description, active } = req.body;
        const update = {};
        if (name !== undefined) update.name = name;
        if (emoji !== undefined) update.emoji = emoji;
        if (priceCOP !== undefined) update.priceCOP = priceCOP;
        if (description !== undefined) update.description = description;
        if (active !== undefined) update.active = active;

        const updated = await Product.findByIdAndUpdate(req.params.id, update);
        res.json({ message: 'Product updated', product: updated });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// @route   DELETE /api/products/:id
// @desc    Remove a product from the catalog
// @access  Private (shop admin only)
router.delete('/:id', [auth, shopAdmin], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await Product.deleteOne({ _id: req.params.id });
        res.json({ message: 'Product deleted' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
