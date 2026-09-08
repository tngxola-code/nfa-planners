const bcrypt = require('bcryptjs');
require('dotenv').config();

const password = process.env.CONSOLE_AUTH_PASSWORD || 'password123';
bcrypt.hash(password, 12).then(hash => {
  console.log('CONSOLE_AUTH_HASH=' + hash);
  console.log('Add this to your .env file');
});
