const bcrypt = require('bcryptjs');
require('dotenv').config();

const [,, hash, password] = process.argv;

// Fallback to env vars if not passed as arguments
const finalHash = hash || process.env.CONSOLE_AUTH_HASH;
const finalPassword = password || process.env.CONSOLE_AUTH_PASSWORD;

if (!finalHash || !finalPassword) {
  console.error('Usage: node verify.js <hash> <password>');
  console.error('Or set CONSOLE_AUTH_HASH and CONSOLE_AUTH_PASSWORD in .env');
  process.exit(1);
}

bcrypt.compare(finalPassword, finalHash).then(ok => {
  console.log(ok ? '✓ password matches hash' : '✗ password does not match hash');
  process.exit(ok ? 0 : 1);
});
