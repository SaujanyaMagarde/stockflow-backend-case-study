const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initDB } = require('./database');
const apiRoutes = require('./routes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', apiRoutes);

// Initialize Database and Start Server
async function startServer() {
    await initDB();

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startServer();
