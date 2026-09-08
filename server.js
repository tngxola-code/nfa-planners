const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());

const ADMIN_USER = {
  email: process.env.CONSOLE_AUTH_EMAIL,
  hash: process.env.CONSOLE_AUTH_HASH,
};

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || email !== ADMIN_USER.email) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = await bcrypt.compare(password, ADMIN_USER.hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { email: ADMIN_USER.email },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '1h' }
  );

  res.json({ message: 'Login successful', token, user: { email: ADMIN_USER.email } });
});

app.get('/api/console', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    res.json({ message: `Welcome ${decoded.email} to the console!` });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
