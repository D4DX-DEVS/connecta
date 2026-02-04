const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function createAdmin() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const adminEmail = '9656550933@connectplus.com';
    const adminMobile = '9656550933';

    // Check if admin already exists by email or mobile
    const existingAdmin = await User.findOne({
      $or: [{ email: adminEmail }, { mobile: adminMobile }]
    });

    if (existingAdmin) {
      console.log('\n⚠️  Admin user already exists!');
      existingAdmin.role = 'admin';
      existingAdmin.email = adminEmail;
      existingAdmin.mobile = adminMobile;
      await existingAdmin.save();
      console.log('✅ Admin role and credentials updated');
    } else {
      const admin = await User.create({
        name: 'Admin User',
        email: adminEmail,
        mobile: adminMobile,
        role: 'admin'
      });
      console.log('\n✅ Admin user created successfully!');
    }

    // Display admin credentials (passwordless)
    console.log('\n' + '='.repeat(50));
    console.log('📋 ADMIN CREDENTIALS (passwordless login)');
    console.log('='.repeat(50));
    console.log('Email: 9656550933@connectplus.com');
    console.log('Phone: 9656550933');
    console.log('Role:  admin');
    console.log('='.repeat(50));
    console.log('\n💡 Login with email OR phone (no password required)');
    console.log('🔗 Admin Dashboard: http://localhost:3000/admin');
    console.log('='.repeat(50) + '\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
