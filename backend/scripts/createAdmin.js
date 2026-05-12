/**
 * Create or update an admin user with phone + password.
 *
 * Usage:
 *   node scripts/createAdmin.js <phone> "<Full Name>" <password>
 *
 * Examples:
 *   node scripts/createAdmin.js +251911234567 "Tamirat Admin" "MyPass123!"
 *   node scripts/createAdmin.js 0911234567 "Tamirat Admin" "MyPass123!"
 *
 * The script accepts phone with or without the +251 prefix.
 * Run from the backend/ directory (needs .env with DATABASE_URL).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [, , rawPhone, fullName, password] = process.argv;

  if (!rawPhone || !fullName || !password) {
    console.error('Usage: node scripts/createAdmin.js <phone> "<Full Name>" <password>');
    console.error('Example: node scripts/createAdmin.js +251911234567 "Admin Name" "Pass123!"');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  // Normalize phone to +251XXXXXXXXX
  let phone = rawPhone.trim();
  if (phone.startsWith('0')) {
    phone = '+251' + phone.slice(1);
  } else if (!phone.startsWith('+')) {
    phone = '+251' + phone;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      fullName: fullName.trim(),
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      isActive: true,
    },
    update: {
      fullName: fullName.trim(),
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    select: { id: true, phone: true, fullName: true, role: true, createdAt: true },
  });

  console.log('\n✅ Admin user ready:');
  console.log('   Phone   :', user.phone);
  console.log('   Name    :', user.fullName);
  console.log('   Role    :', user.role);
  console.log('   Created :', user.createdAt.toISOString());
  console.log('\nYou can now sign in via "Admin Sign In" in the app with:');
  console.log('   Phone   :', user.phone);
  console.log('   Password:', password);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
