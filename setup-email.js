#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setupEmail() {
  console.log('🚀 WEXP Email Service Setup\n');
  console.log('This script will help you configure email service for your WEXP backend.\n');

  const choice = await question(`Choose your email provider:
1. Gmail (Quick setup - recommended for testing)
2. Your domain email (requires manual configuration)
3. Skip setup

Enter your choice (1-3): `);

  if (choice === '3') {
    console.log('\n⏭️  Email setup skipped. You can configure it later.');
    rl.close();
    return;
  }

  if (choice === '1') {
    console.log('\n📧 Gmail Setup');
    console.log('To use Gmail, you need to:');
    console.log('1. Enable 2-factor authentication on your Google account');
    console.log('2. Generate an App Password at: https://myaccount.google.com/apppasswords');
    console.log('3. Use the 16-character app password (not your regular password)\n');

    const email = await question('Enter your Gmail address: ');
    const appPassword = await question('Enter your Gmail App Password (16 chars): ');

    // Read current .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envPath, 'utf8');
    } catch (error) {
      console.log('❌ Could not read .env file. Make sure it exists.');
      rl.close();
      return;
    }

    // Replace Gmail SMTP configuration
    envContent = envContent.replace(
      /SMTP_USER="your-gmail@gmail\.com"/,
      `SMTP_USER="${email}"`
    );
    envContent = envContent.replace(
      /SMTP_PASS="your-16-char-app-password"/,
      `SMTP_PASS="${appPassword}"`
    );
    envContent = envContent.replace(
      /FROM_EMAIL="your-gmail@gmail\.com"/,
      `FROM_EMAIL="${email}"`
    );

    try {
      fs.writeFileSync(envPath, envContent);
      console.log('\n✅ Gmail configuration saved to .env file!');
      
      // Test the configuration
      console.log('\n🧪 Testing email configuration...');
      
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: email,
          pass: appPassword
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      try {
        await new Promise((resolve, reject) => {
          transporter.verify((error, success) => {
            if (error) reject(error);
            else resolve(success);
          });
        });
        
        console.log('✅ Email configuration test successful!');
        console.log('\n🎉 Email service is now ready to use!');
        console.log('\nNext steps:');
        console.log('1. Start your server: npm run dev');
        console.log('2. Test sending emails through the API');
        console.log('3. Check EMAIL_TROUBLESHOOTING_GUIDE.md for more options');
        
      } catch (error) {
        console.log('❌ Email configuration test failed:', error.message);
        console.log('\nPlease check:');
        console.log('- Your Gmail address is correct');
        console.log('- You used an App Password (not regular password)');
        console.log('- 2-factor authentication is enabled on your Google account');
      }
      
    } catch (error) {
      console.log('❌ Could not save configuration:', error.message);
    }

  } else if (choice === '2') {
    console.log('\n🏢 Domain Email Setup');
    console.log('Your domain email (wexp@ufumbuzilabs.com) is currently not working.');
    console.log('Please check EMAIL_TROUBLESHOOTING_GUIDE.md for detailed instructions.');
    console.log('\nCommon steps:');
    console.log('1. Log into your Namecheap control panel');
    console.log('2. Verify email service is activated');
    console.log('3. Check MX records and SMTP settings');
    console.log('4. Ensure the email account exists and is active');
  }

  rl.close();
}

setupEmail().catch(console.error);
