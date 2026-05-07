const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // ── Test driver user (phone matches Firebase test number) ─────────────────
  const driver = await prisma.user.upsert({
    where: { phone: '+251911000000' },
    update: {},
    create: {
      phone: '+251911000000',
      fullName: 'Test Driver',
      role: 'DRIVER',
      passwordHash: '',
      isVerified: true,
      isActive: true,
      driver: {
        create: {
          licenseNumber: 'DL-TEST-001',
          licenseExpiry: new Date('2027-01-01'),
          vehicleType: 'MOTORCYCLE',
          vehiclePlate: 'AA-TEST-001',
          vehicleModel: 'Honda CB150',
          vehicleColor: 'Red',
          vehicleYear: 2022,
          city: 'Addis Ababa',
          status: 'OFFLINE',
          wallet: { create: {} },
        },
      },
    },
  });

  // ── Test store user ────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { phone: '+251922000001' },
    update: {},
    create: {
      phone: '+251922000001',
      fullName: 'Test Store Owner',
      role: 'STORE',
      passwordHash: '',
      isVerified: true,
      isActive: true,
      store: {
        create: {
          storeName: 'Test Store',
          storeType: 'Restaurant',
          address: 'Bole, Addis Ababa',
          city: 'Addis Ababa',
          lat: 9.0054,
          lng: 38.7636,
          phone: '+251922000001',
        },
      },
    },
  });

  console.log('Seed complete. Test accounts:');
  console.log('  Driver : +251911000000  OTP: 123456');
  console.log('  Store  : +251922000001  OTP: 123456');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
