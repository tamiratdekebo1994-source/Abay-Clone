const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '\n⚠  WARNING: Running seed in production.\n' +
      '   Change the admin password immediately after seeding:\n' +
      '   UPDATE "User" SET "passwordHash" = crypt(\'<new-password>\', gen_salt(\'bf\')) WHERE phone = \'+251911000000\';\n'
    );
  }

  // Create admin user
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.upsert({
    where: { phone: '+251911000000' },
    update: {},
    create: {
      phone: '+251911000000',
      email: 'admin@fetno.et',
      passwordHash: adminHash,
      fullName: 'Fetno Admin',
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('Admin created:', admin.email);

  // Create demo store
  const storeHash = await bcrypt.hash('Store@1234', 12);
  const storeUser = await prisma.user.upsert({
    where: { phone: '+251922000001' },
    update: {},
    create: {
      phone: '+251922000001',
      email: 'demo.store@fetno.et',
      passwordHash: storeHash,
      fullName: 'Demo Store Owner',
      role: 'STORE',
      isVerified: true,
    },
  });

  await prisma.store.upsert({
    where: { userId: storeUser.id },
    update: {},
    create: {
      userId: storeUser.id,
      storeName: 'Merkato Supermarket',
      storeType: 'GROCERY',
      address: 'Merkato, Addis Ababa',
      city: 'Addis Ababa',
      subcity: 'Addis Ketema',
      lat: 9.0121,
      lng: 38.7468,
      phone: '+251922000001',
      isVerified: true,
    },
  });
  console.log('Demo store created');

  // Create demo driver
  const driverHash = await bcrypt.hash('Driver@1234', 12);
  const driverUser = await prisma.user.upsert({
    where: { phone: '+251933000002' },
    update: {},
    create: {
      phone: '+251933000002',
      email: 'demo.driver@fetno.et',
      passwordHash: driverHash,
      fullName: 'Abebe Girma',
      role: 'DRIVER',
      isVerified: true,
    },
  });

  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      licenseNumber: 'ETH-001234',
      licenseExpiry: new Date('2026-12-31'),
      vehicleType: 'MOTORCYCLE',
      vehiclePlate: 'AA-12345',
      vehicleModel: 'Hero Honda',
      vehicleColor: 'Red',
      vehicleYear: 2020,
      city: 'Addis Ababa',
      status: 'OFFLINE',
      rating: 4.8,
      totalDeliveries: 152,
      totalEarnings: 45600,
    },
  });
  console.log('Demo driver created');

  // Create pricing zones
  const zones = [
    { name: 'Addis Ababa', nameAm: 'አዲስ አበባ', city: 'Addis Ababa', baseFeeETB: 50, perKmFeeETB: 15 },
    { name: 'Bahir Dar', nameAm: 'ባህር ዳር', city: 'Bahir Dar', baseFeeETB: 45, perKmFeeETB: 12 },
    { name: 'Hawassa', nameAm: 'ሃዋሳ', city: 'Hawassa', baseFeeETB: 45, perKmFeeETB: 12 },
    { name: 'Mekelle', nameAm: 'መቀሌ', city: 'Mekelle', baseFeeETB: 45, perKmFeeETB: 12 },
    { name: 'Dire Dawa', nameAm: 'ድሬዳዋ', city: 'Dire Dawa', baseFeeETB: 40, perKmFeeETB: 10 },
  ];

  for (const zone of zones) {
    await prisma.zone.upsert({
      where: { id: zone.name.replace(' ', '_').toLowerCase() },
      update: {},
      create: zone,
    }).catch(() => prisma.zone.create({ data: zone }));
  }
  console.log('Pricing zones created');

  console.log('\n=== Seed Complete ===');
  console.log('Admin:  +251911000000 / Admin@1234');
  console.log('Store:  +251922000001 / Store@1234');
  console.log('Driver: +251933000002 / Driver@1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
