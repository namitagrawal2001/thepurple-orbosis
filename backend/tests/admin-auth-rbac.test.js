import assert from 'node:assert/strict';

const testDatabase = process.env.DB_NAME || '';
if (
  process.env.NODE_ENV !== 'test' ||
  process.env.INTEGRATION_TEST_DATABASE !== testDatabase ||
  !/^thepurple_test_[a-z0-9_]+$/.test(testDatabase) ||
  process.env.DATABASE_URL ||
  !['localhost', '127.0.0.1'].includes(process.env.DB_HOST)
) {
  console.error(
    'Integration tests require NODE_ENV=test, a matching INTEGRATION_TEST_DATABASE named thepurple_test_*, a loopback DB_HOST, and no DATABASE_URL.'
  );
  process.exit(1);
}

const [
  { default: request },
  { createApp },
  { bootstrapSuperAdmin },
  { default: sequelize },
  { Product },
  { default: bulkImportService },
  { default: env },
  { default: mailService },
  { default: jwt },
] = await Promise.all([
  import('supertest'),
  import('../src/app.js'),
  import('../src/seeders/bootstrapAdmin.js'),
  import('../src/config/database.js'),
  import('../src/models/index.js'),
  import('../src/services/bulkImportService.js'),
  import('../src/config/env.js'),
  import('../src/services/mailService.js'),
  import('jsonwebtoken'),
]);

const welcomePasswords = new Map();
mailService.sendWelcomeAdminEmail = async ({ toEmail, temporaryPassword }) => {
  welcomePasswords.set(toEmail, temporaryPassword);
  return { sent: true };
};

async function runTests() {
  console.log('=== STARTING THEPURPLE ADMIN AUTH & RBAC TEST SUITE ===\n');

  const app = createApp();

  const livenessRes = await request(app).get('/api/v1/health/live');
  assert.strictEqual(livenessRes.status, 200, 'Liveness endpoint should respond while the process is running');
  assert.strictEqual(livenessRes.body.data.status, 'alive');

  const readinessRes = await request(app).get('/api/v1/health/ready');
  assert.strictEqual(readinessRes.status, 200, 'Readiness endpoint should require healthy dependencies');
  assert.strictEqual(readinessRes.body.data.status, 'ready');

  // 1. Test Super Admin Bootstrap
  console.log('[1/7] Testing Super Admin Bootstrap...');
  await sequelize.sync({ alter: false });
  const bootstrapAdmin = await bootstrapSuperAdmin();
  assert.ok(bootstrapAdmin, 'Super Admin should be bootstrapped');
  assert.strictEqual(bootstrapAdmin.role, 'SUPER_ADMIN', 'Bootstrapped admin role must be SUPER_ADMIN');
  console.log('✔ Super Admin bootstrap verified:', bootstrapAdmin.email, bootstrapAdmin.role);

  // 2. Test Super Admin Login
  console.log('\n[2/7] Testing Super Admin Login...');
  const superAdminLoginRes = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({
      email: env.ADMIN_INITIAL_EMAIL || 'superadmin@gmail.com',
      password: env.ADMIN_INITIAL_PASSWORD || '123456',
    });

  assert.strictEqual(superAdminLoginRes.status, 200, `Login should return 200, got: ${superAdminLoginRes.status} ${JSON.stringify(superAdminLoginRes.body)}`);
  assert.ok(superAdminLoginRes.body.data.token, 'Response must contain token');
  assert.strictEqual(superAdminLoginRes.body.data.admin.role, 'SUPER_ADMIN');
  const tokenWithoutSession = jwt.sign(
    { id: superAdminLoginRes.body.data.admin.id, type: 'admin' },
    env.JWT_SECRET
  );
  const missingSessionRes = await request(app)
    .get('/api/v1/admin/auth/me')
    .set('Authorization', `Bearer ${tokenWithoutSession}`);
  assert.strictEqual(missingSessionRes.status, 419, 'Admin tokens without a persisted session must be rejected');
  let superAdminToken = superAdminLoginRes.body.data.token;
  if (superAdminLoginRes.body.data.admin.mustChangePassword) {
    const blockedAdminAction = await request(app)
      .get('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${superAdminToken}`);
    assert.strictEqual(
      blockedAdminAction.status,
      403,
      'Admin API access must be blocked until the initial password is changed'
    );

    superAdminToken = await changeAdminPassword(
      app,
      superAdminToken,
      env.ADMIN_INITIAL_PASSWORD || '123456'
    );
    console.log('✔ Initial Super Admin password change required and completed.');
  }
  console.log('✔ Super Admin login succeeded. Token generated.');

  // 3. Test Super Admin creating Manager and Worker accounts
  console.log('\n[3/7] Testing Super Admin User Management (Creating Manager & Worker)...');
  const uniqueSuffix = Date.now().toString().slice(-4);
  const managerEmail = `manager_${uniqueSuffix}@thepurple.in`;
  const workerEmail = `worker_${uniqueSuffix}@thepurple.in`;

  // Create Manager
  const createManagerRes = await request(app)
    .post('/api/v1/admin/admins')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      name: 'Operations Manager',
      email: managerEmail,
      role: 'MANAGER',
    });

  assert.strictEqual(createManagerRes.status, 201, `Create Manager should return 201, got ${createManagerRes.status}`);
  const managerTempPassword = welcomePasswords.get(managerEmail);
  assert.ok(managerTempPassword, 'Temporary password should be auto-generated');
  assert.ok(!createManagerRes.body.data.debugTemporaryPassword, 'Temporary password must not be returned by the API');
  console.log('✔ Manager account created with temporary password.');

  // Create Worker
  const createWorkerRes = await request(app)
    .post('/api/v1/admin/admins')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      name: 'Catalog Worker',
      email: workerEmail,
      role: 'WORKER',
    });

  assert.strictEqual(createWorkerRes.status, 201, `Create Worker should return 201, got ${createWorkerRes.status}`);
  const workerTempPassword = welcomePasswords.get(workerEmail);
  assert.ok(workerTempPassword, 'Temporary password should be auto-generated');
  assert.ok(!createWorkerRes.body.data.debugTemporaryPassword, 'Temporary password must not be returned by the API');
  console.log('✔ Worker account created with temporary password.');

  // Manager Login
  const managerLoginRes = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ email: managerEmail, password: managerTempPassword });
  assert.strictEqual(managerLoginRes.status, 200);
  const managerToken = await changeAdminPassword(
    app,
    managerLoginRes.body.data.token,
    managerTempPassword
  );
  console.log('✔ Manager login with auto-generated temporary password succeeded.');

  // Worker Login
  const workerLoginRes = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({ email: workerEmail, password: workerTempPassword });
  assert.strictEqual(workerLoginRes.status, 200);
  const workerToken = await changeAdminPassword(
    app,
    workerLoginRes.body.data.token,
    workerTempPassword
  );
  console.log('✔ Worker login with auto-generated temporary password succeeded.');

  // 4. Test Role Permission Matrix Enforcements (Backend 403 checks)
  console.log('\n[4/7] Testing RBAC Permission Matrix & 403 Enforcements...');

  // Manager attempting to manage admins -> 403 Forbidden
  const managerAdminManageRes = await request(app)
    .get('/api/v1/admin/admins')
    .set('Authorization', `Bearer ${managerToken}`);
  assert.strictEqual(managerAdminManageRes.status, 403, `Manager GET /admins should be 403 Forbidden, got ${managerAdminManageRes.status}`);
  console.log('✔ Manager blocked from Admin Management (403 Forbidden).');

  // Worker attempting to manage admins -> 403 Forbidden
  const workerAdminManageRes = await request(app)
    .post('/api/v1/admin/admins')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({ name: 'Hacker', email: 'hack@hack.com', role: 'MANAGER' });
  assert.strictEqual(workerAdminManageRes.status, 403, `Worker POST /admins should be 403 Forbidden, got ${workerAdminManageRes.status}`);
  console.log('✔ Worker blocked from creating Admins (403 Forbidden).');

  // 5. Setup Category & Subcategory and Test Product CRUD
  console.log('\n[5/7] Testing Category & Product Management CRUD...');
  
  // Create Category
  const catSlug = `test-jewellery-${uniqueSuffix}`;
  const categoryRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      name: `Test Jewellery ${uniqueSuffix}`,
      slug: catSlug,
      description: 'Test category for automation',
    });
  assert.strictEqual(categoryRes.status, 201);
  const categoryId = categoryRes.body.data.category.id;

  // Create Subcategory
  const subcategoryRes = await request(app)
    .post('/api/v1/admin/subcategories')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      categoryId,
      name: `Necklaces ${uniqueSuffix}`,
      slug: `necklaces-${uniqueSuffix}`,
    });
  assert.strictEqual(subcategoryRes.status, 201);
  const subcategoryId = subcategoryRes.body.data.subcategory.id;
  console.log('✔ Category and Subcategory created.');

  // Test Worker creating a product -> Should succeed (201 Created)
  const productSku = `TP-TEST-${uniqueSuffix}`;
  const createProductRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${workerToken}`)
    .send({
      name: 'Royal Kundan Choker Necklace',
      sku: productSku,
      subcategoryId,
      price: 2999,
      salePrice: 1999,
      stock: 25,
      status: 'DRAFT',
      shortDescription: 'Exquisite Kundan choker',
      tags: ['kundan', 'necklace', 'choker'],
    });
  assert.strictEqual(createProductRes.status, 201, `Worker creating product should return 201, got ${createProductRes.status}`);
  const productId = createProductRes.body.data.product.id;
  console.log('✔ Worker successfully uploaded product (201 Created).');

  // Test Worker attempting to PUBLISH -> Should be blocked (403 Forbidden)
  const workerPublishRes = await request(app)
    .patch(`/api/v1/admin/products/${productId}/status`)
    .set('Authorization', `Bearer ${workerToken}`)
    .send({ status: 'PUBLISHED' });
  assert.strictEqual(workerPublishRes.status, 403, 'Worker publishing product should return 403 Forbidden');
  console.log('✔ Worker blocked from publishing product (403 Forbidden).');

  // Test Manager publishing the product -> Should succeed (200 OK)
  const managerPublishRes = await request(app)
    .patch(`/api/v1/admin/products/${productId}/status`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ status: 'PUBLISHED' });
  assert.strictEqual(managerPublishRes.status, 200, 'Manager publishing product should return 200 OK');
  console.log('✔ Manager successfully published product (200 OK).');

  // Test Worker attempting to DELETE -> Should be blocked (403 Forbidden)
  const workerDeleteRes = await request(app)
    .delete(`/api/v1/admin/products/${productId}`)
    .set('Authorization', `Bearer ${workerToken}`);
  assert.strictEqual(workerDeleteRes.status, 403, 'Worker deleting product should return 403 Forbidden');
  console.log('✔ Worker blocked from deleting product (403 Forbidden).');

  // Test Super Admin Soft-Deleting the product -> Should succeed (200 OK)
  const adminDeleteRes = await request(app)
    .delete(`/api/v1/admin/products/${productId}`)
    .set('Authorization', `Bearer ${superAdminToken}`);
  assert.strictEqual(adminDeleteRes.status, 200, 'Admin deleting product should return 200 OK');
  
  // Verify soft delete in database (deletedAt is not null)
  const deletedProduct = await Product.findByPk(productId, { paranoid: false });
  assert.ok(deletedProduct.deletedAt, 'Product must have deletedAt timestamp populated');
  console.log('✔ Soft-delete / Archive verified successfully without breaking database references.');

  // 6. Test Product Pricing & Constraint Validations
  console.log('\n[6/7] Testing Product Validation Rules...');

  // Selling Price > MRP -> Should reject (400 Bad Request)
  const invalidPriceRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      name: 'Invalid Price Item',
      sku: `TP-INV-${uniqueSuffix}`,
      subcategoryId,
      price: 1000,
      salePrice: 1500, // Invalid: salePrice > MRP
      stock: 10,
    });
  assert.strictEqual(invalidPriceRes.status, 400, 'Selling price > MRP should be rejected with 400');
  console.log('✔ Rejected invalid pricing: Selling Price > MRP.');

  // Duplicate SKU -> Should reject (400 Bad Request)
  const duplicateSkuRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send({
      name: 'Duplicate SKU Item',
      sku: productSku, // Already exists
      subcategoryId,
      price: 1000,
      salePrice: 800,
      stock: 10,
    });
  assert.strictEqual(duplicateSkuRes.status, 400, 'Duplicate SKU should be rejected with 400');
  console.log('✔ Rejected duplicate SKU.');

  // 7. Test Bulk Import Validation & Template Generation
  console.log('\n[7/7] Testing Bulk Product Import Validation...');
  const templateBuffer = await bulkImportService.generateTemplate();
  assert.ok(templateBuffer && templateBuffer.length > 0, 'Excel template buffer must be generated');
  console.log('✔ Generated sample Excel template buffer (size:', templateBuffer.length, 'bytes)');

  // Test validating rows with valid and invalid data
  const testRows = [
    {
      'Product Name*': 'Bulk Test Product 1',
      'SKU*': `TP-BLK-1-${uniqueSuffix}`,
      'Category*': `Test Jewellery ${uniqueSuffix}`,
      'Subcategory*': `Necklaces ${uniqueSuffix}`,
      'MRP*': 2000,
      'Selling Price*': 1500,
      'Stock Quantity*': 50,
      'Status (DRAFT/PUBLISHED/UNPUBLISHED)': 'PUBLISHED',
    },
    {
      'Product Name*': 'Bulk Test Invalid Price',
      'SKU*': `TP-BLK-2-${uniqueSuffix}`,
      'Category*': `Test Jewellery ${uniqueSuffix}`,
      'Subcategory*': `Necklaces ${uniqueSuffix}`,
      'MRP*': 1000,
      'Selling Price*': 1800, // Invalid: salePrice > MRP
      'Stock Quantity*': 10,
    },
    {
      'Product Name*': 'Bulk Test Invalid Category',
      'SKU*': `TP-BLK-3-${uniqueSuffix}`,
      'Category*': 'NonExistentCategory',
      'Subcategory*': 'NonExistentSubcategory',
      'MRP*': 1000,
      'Selling Price*': 900,
      'Stock Quantity*': 10,
    },
  ];

  const validationResult = await bulkImportService.validateRows(testRows);
  assert.strictEqual(validationResult.totalRows, 3, 'Total rows should be 3');
  assert.strictEqual(validationResult.validCount, 1, 'Valid count should be 1');
  assert.strictEqual(validationResult.errorCount, 2, 'Error count should be 2');
  console.log('✔ Bulk upload validator caught row-level errors:', validationResult.errors.map(e => `Row ${e.row}: ${e.messages[0]}`));

  console.log('\n======================================================');
  console.log('✨ ALL 7 TEST SUITES PASSED FLAWLESSLY! ✨');
  console.log('======================================================\n');
  process.exit(0);
}

async function changeAdminPassword(app, token, currentPassword) {
  const newPassword = `CI-Changed-${Date.now()}-Secure!`;
  const response = await request(app)
    .post('/api/v1/admin/auth/change-password')
    .set('Authorization', `Bearer ${token}`)
    .send({
      currentPassword,
      newPassword,
      confirmPassword: newPassword,
    });

  assert.strictEqual(
    response.status,
    200,
    `Initial password change should return 200, got: ${response.status}`
  );
  return response.body.data.token || token;
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed with Error:', err);
  process.exit(1);
});
