const { DataSource } = require('typeorm');

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'toko_amplop',
});

const categories = [
  { name: 'Amplop Nikah', description: 'Amplop undangan dan sumbangan pernikahan' },
  { name: 'Amplop Lebaran', description: 'Amplop angpao untuk hari raya Idul Fitri' },
  { name: 'Amplop Imlek', description: 'Amplop angpao merah untuk Tahun Baru Imlek' },
  { name: 'Amplop Custom', description: 'Amplop dengan desain custom sesuai pesanan' },
  { name: 'Amplop Ulang Tahun', description: 'Amplop hadiah untuk ucapan ulang tahun' },
];

const products = [
  {
    name: 'Amplop Nikah Elegant Gold',
    description: 'Amplop pernikahan premium dengan aksen emas dan emboss bunga. Kertas tebal 150gsm.',
    imageUrl: 'https://placehold.co/400x400?text=Nikah+Gold',
    categoryIndex: 0,
    variants: [
      { name: 'Paket 50 pcs', price: 75000, stock: 200 },
      { name: 'Paket 100 pcs', price: 130000, stock: 150 },
      { name: 'Paket 200 pcs', price: 240000, stock: 80 },
    ],
  },
  {
    name: 'Amplop Nikah Floral Pink',
    description: 'Amplop pernikahan dengan motif bunga pink pastel. Cocok untuk tema garden party.',
    imageUrl: 'https://placehold.co/400x400?text=Nikah+Pink',
    categoryIndex: 0,
    variants: [
      { name: 'Paket 50 pcs', price: 65000, stock: 180 },
      { name: 'Paket 100 pcs', price: 115000, stock: 120 },
    ],
  },
  {
    name: 'Amplop Lebaran Hijau Classic',
    description: 'Amplop lebaran hijau klasik dengan tulisan kaligrafi. Desain timeless untuk segala usia.',
    imageUrl: 'https://placehold.co/400x400?text=Lebaran+Hijau',
    categoryIndex: 1,
    variants: [
      { name: 'Paket 25 pcs', price: 35000, stock: 300 },
      { name: 'Paket 50 pcs', price: 60000, stock: 250 },
      { name: 'Paket 100 pcs', price: 100000, stock: 150 },
    ],
  },
  {
    name: 'Amplop Lebaran Modern Tosca',
    description: 'Amplop lebaran warna tosca dengan desain geometris modern. Ukuran besar muat uang tanpa dilipat.',
    imageUrl: 'https://placehold.co/400x400?text=Lebaran+Tosca',
    categoryIndex: 1,
    variants: [
      { name: 'Paket 25 pcs', price: 40000, stock: 200 },
      { name: 'Paket 50 pcs', price: 70000, stock: 180 },
    ],
  },
  {
    name: 'Amplop Imlek Dragon Red',
    description: 'Amplop angpao merah dengan motif naga emas. Kertas glossy premium untuk kesan mewah.',
    imageUrl: 'https://placehold.co/400x400?text=Imlek+Dragon',
    categoryIndex: 2,
    variants: [
      { name: 'Paket 10 pcs', price: 25000, stock: 400 },
      { name: 'Paket 25 pcs', price: 55000, stock: 250 },
      { name: 'Paket 50 pcs', price: 95000, stock: 150 },
    ],
  },
  {
    name: 'Amplop Imlek Prosperity Gold',
    description: 'Amplop angpao gold metalik dengan emboss karakter Fu. Dilengkapi seal sticker.',
    imageUrl: 'https://placehold.co/400x400?text=Imlek+Gold',
    categoryIndex: 2,
    variants: [
      { name: 'Paket 10 pcs', price: 30000, stock: 300 },
      { name: 'Paket 25 pcs', price: 65000, stock: 200 },
    ],
  },
  {
    name: 'Amplop Custom Foto Personal',
    description: 'Amplop dengan foto custom Anda. Upload desain sendiri, kami cetak dengan kualitas terbaik.',
    imageUrl: 'https://placehold.co/400x400?text=Custom+Foto',
    categoryIndex: 3,
    variants: [
      { name: 'Paket 25 pcs', price: 85000, stock: 100 },
      { name: 'Paket 50 pcs', price: 150000, stock: 80 },
      { name: 'Paket 100 pcs', price: 270000, stock: 50 },
    ],
  },
  {
    name: 'Amplop Custom Logo Perusahaan',
    description: 'Amplop dengan branding logo perusahaan. Cocok untuk corporate gift dan bonus karyawan.',
    imageUrl: 'https://placehold.co/400x400?text=Custom+Logo',
    categoryIndex: 3,
    variants: [
      { name: 'Paket 100 pcs', price: 200000, stock: 60 },
      { name: 'Paket 250 pcs', price: 450000, stock: 40 },
    ],
  },
  {
    name: 'Amplop Ulang Tahun Colorful',
    description: 'Amplop ulang tahun warna-warni dengan balon dan confetti. Tersedia berbagai warna cerah.',
    imageUrl: 'https://placehold.co/400x400?text=Ultah+Colorful',
    categoryIndex: 4,
    variants: [
      { name: 'Paket 10 pcs', price: 20000, stock: 500 },
      { name: 'Paket 25 pcs', price: 45000, stock: 300 },
      { name: 'Paket 50 pcs', price: 80000, stock: 200 },
    ],
  },
  {
    name: 'Amplop Ulang Tahun Premium Velvet',
    description: 'Amplop ulang tahun dengan bahan velvet lembut. Finishing mewah dengan pita satin.',
    imageUrl: 'https://placehold.co/400x400?text=Ultah+Velvet',
    categoryIndex: 4,
    variants: [
      { name: 'Satuan', price: 15000, stock: 500 },
      { name: 'Paket 5 pcs', price: 65000, stock: 200 },
    ],
  },
];

async function seed() {
  await ds.initialize();
  console.log('✅ Connected to database\n');

  // 1. Seed categories
  const savedCategories = [];
  for (const cat of categories) {
    const existing = await ds.query(
      'SELECT id FROM categories WHERE name = $1',
      [cat.name],
    );
    if (existing.length > 0) {
      savedCategories.push(existing[0]);
      console.log(`   Category "${cat.name}" already exists`);
    } else {
      const result = await ds.query(
        'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id',
        [cat.name, cat.description],
      );
      savedCategories.push(result[0]);
      console.log(`✅ Category "${cat.name}" created`);
    }
  }

  console.log('');

  // 2. Seed products + variants
  for (const product of products) {
    const existing = await ds.query(
      'SELECT id FROM products WHERE name = $1',
      [product.name],
    );

    if (existing.length > 0) {
      console.log(`   Product "${product.name}" already exists, skipping`);
      continue;
    }

    // Insert product
    const result = await ds.query(
      `INSERT INTO products (name, description, image_url, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [product.name, product.description, product.imageUrl],
    );
    const productId = result[0].id;

    // Link category
    const categoryId = savedCategories[product.categoryIndex].id;
    await ds.query(
      'INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)',
      [productId, categoryId],
    );

    // Insert variants
    for (const variant of product.variants) {
      await ds.query(
        `INSERT INTO product_variants (name, price, stock, product_id)
         VALUES ($1, $2, $3, $4)`,
        [variant.name, variant.price, variant.stock, productId],
      );
    }

    console.log(
      `✅ Product "${product.name}" created with ${product.variants.length} variants`,
    );
  }

  console.log('\n🎉 Seeding complete!');
  await ds.destroy();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err.message);
  process.exit(1);
});
