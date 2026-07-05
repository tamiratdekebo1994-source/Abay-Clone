#!/usr/bin/env node
/**
 * Create admin user for ET SPAR
 * Usage: node create-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('Creating admin user...');

    const passwordHash = await bcrypt.hash('Admin@123', 12);

    const admin = await prisma.user.upsert({
      where: { phone: '+251911111111' },
      update: {},
      create: {
        phone: '+251911111111',
        fullName: 'ET SPAR Admin',
        email: 'admin@etspar.et',
        role: 'ADMIN',
        status: 'VERIFIED',
        passwordHash,
        isVerified: true,
      },
    });

    console.log('\n✅ Admin user created successfully!\n');
    console.log('Login Credentials:');
    console.log('─────────────────────');
    console.log('Phone:    +251911111111');
    console.log('Password: Admin@123');
    console.log('─────────────────────\n');
    console.log('Admin Details:');
    console.log('─────────────────────');
    console.log('Name:     ' + admin.fullName);
    console.log('Email:    ' + admin.email);
    console.log('Role:     ' + admin.role);
    console.log('Status:   ' + admin.status);
    console.log('─────────────────────\n');

  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
