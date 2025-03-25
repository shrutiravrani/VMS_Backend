const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Serve static files from uploads directory
const uploadsPath = path.join(__dirname, 'uploads');
console.log('Uploads directory path:', uploadsPath);
app.use('/uploads', express.static(uploadsPath));

// Add a test route for uploads
app.get('/test-uploads', (req, res) => {
  const fs = require('fs');
  const files = fs.readdirSync(uploadsPath);
  res.json({ 
    uploadsPath,
    files,
    exists: fs.existsSync(uploadsPath)
  });
});

// ... rest of your routes and middleware ... 