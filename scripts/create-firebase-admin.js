#!/usr/bin/env node
/**
 * Create admin user for ET SPARK in Firebase
 * Usage: node scripts/create-firebase-admin.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
// You may need to set GOOGLE_APPLICATION_CREDENTIALS environment variable
// or download a service account key from Firebase Console
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'abay-clone-project-36721',
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function createAdmin() {
  try {
    console.log('Creating admin user in Firebase...\n');

    const adminData = {
      phone: '+251972735128',
      email: 'admin@etspark.et',
      password: 'Admin@1234',
      fullName: 'ET SPARK Admin',
      role: 'ADMIN',
    };

    // Create user in Firebase Authentication
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminData.email);
      console.log('Admin user already exists in Firebase Auth');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: adminData.email,
          password: adminData.password,
          displayName: adminData.fullName,
        });
        console.log('✓ Created user in Firebase Authentication');
      } else {
        throw error;
      }
    }

    // Create/update user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      phone: adminData.phone,
      fullName: adminData.fullName,
      email: adminData.email,
      role: adminData.role,
      isVerified: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('✓ Created user document in Firestore');

    console.log('\n✅ Admin user setup complete!\n');
    console.log('Login Credentials:');
    console.log('─────────────────────');
    console.log('Email:    ' + adminData.email);
    console.log('Password: ' + adminData.password);
    console.log('─────────────────────\n');
    console.log('Admin Details:');
    console.log('─────────────────────');
    console.log('Name:     ' + adminData.fullName);
    console.log('Phone:    ' + adminData.phone);
    console.log('Role:     ' + adminData.role);
    console.log('UID:      ' + userRecord.uid);
    console.log('─────────────────────\n');

  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

createAdmin();
