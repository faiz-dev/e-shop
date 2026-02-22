const { DataSource } = require('typeorm');

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'toko_amplop',
});

ds.initialize().then(async () => {
  await ds.query("UPDATE users SET role = 'admin' WHERE email = 'admin@tokomplop.com'");
  const result = await ds.query("SELECT id, name, email, role FROM users WHERE email = 'admin@tokomplop.com'");
  console.log('✅ Admin account updated:', result);
  await ds.destroy();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
