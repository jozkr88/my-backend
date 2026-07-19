// server.js
const express = require('express');
const app = express();
const port = 3000; // You can change this to any port you prefer

// Middleware
app.use(express.json()); // Parse JSON bodies

// Routes
app.get('/', (req, res) => {
  res.send('Hello from server.js!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
