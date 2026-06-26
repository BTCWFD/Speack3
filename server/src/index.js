const express = require('express');
const cors = require('cors');

const aiRoutes = require('./routes/ai.routes');
const paymentRoutes = require('./routes/payments.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Registering routes
app.use('/api/ai', aiRoutes);
app.use('/api/payments', paymentRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
