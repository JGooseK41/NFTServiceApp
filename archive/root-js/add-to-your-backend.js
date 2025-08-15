// Example: How to add Energy.Store routes to your existing backend
// Add this to your main server file (e.g., server.js or app.js)

const express = require('express');
const cors = require('cors');
const app = express();

// Your existing middleware
app.use(cors({
    origin: [
        'https://theblockservice.com',
        'https://www.theblockservice.com',
        'http://localhost:3000'
    ],
    credentials: true
}));
app.use(express.json());

// Your existing routes here...
// app.get('/your-existing-routes', ...);

// Add Energy.Store proxy routes
const energyStoreRoutes = require('./energy-store-routes');
energyStoreRoutes(app);

// Your existing server start code...
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});