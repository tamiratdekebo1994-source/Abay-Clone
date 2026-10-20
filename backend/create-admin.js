#!/usr/bin/env node
/**
 * Create admin user for ET SPARK
 * Usage: node create-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('Creating admin user...');

    if (!process.env.ADMIN_PASSWORD) {
      throw new Error('Set ADMIN_PASSWORD in your environment before running this script');
    }

    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

    const admin = await prisma.user.upsert({
      where: { phone: '+251972735128' },
      update: {},
      create: {
        phone: '+251972735128',
        fullName: 'ET SPARK Admin',
        email: 'admin@etspar.et',
        role: 'ADMIN',
        passwordHash,
        isVerified: true,
      },
    });

    console.log('\n✅ Admin user created successfully!\n');
    console.log('Login Credentials:');
    console.log('─────────────────────');
    console.log('Phone:    +251972735128');
    console.log('Password: (the ADMIN_PASSWORD you set)');
    console.log('─────────────────────\n');
    console.log('Admin Details:');
    console.log('─────────────────────');
    console.log('Name:     ' + admin.fullName);
    console.log('Email:    ' + admin.email);
    console.log('Role:     ' + admin.role);
    console.log('─────────────────────\n');

  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
