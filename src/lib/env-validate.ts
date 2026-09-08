export function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'CONSOLE_SESSION_SECRET',
    'CONSOLE_ADMIN_EMAIL',
    'CONSOLE_ADMIN_PASSWORD_HASH',
    'CRON_SECRET',
    'RESEND_API_KEY',
    'NOTIFICATION_RECIPIENT',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach((key) => console.error('  - ' + key));
    process.exit(1);
  }

  console.log('All required environment variables are set.');
}
