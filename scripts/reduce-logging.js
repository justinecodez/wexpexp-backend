#!/usr/bin/env node

/**
 * Script to help reduce backend logging noise
 * Run this script to see current settings and apply recommended configurations
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Backend Logging Configuration Helper');
console.log('=====================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

console.log(`📁 Environment file: ${envExists ? 'Found' : 'Not found'} at ${envPath}`);

if (envExists) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const currentEnv = {};
  
  // Parse current .env values
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      currentEnv[key.trim()] = value.trim();
    }
  });
  
  console.log('\n📊 Current logging-related settings:');
  console.log('LOG_LEVEL:', currentEnv.LOG_LEVEL || 'not set (defaults to "info")');
  console.log('CONSOLE_LOG_LEVEL:', currentEnv.CONSOLE_LOG_LEVEL || 'not set (defaults to "info")');
  console.log('NODE_ENV:', currentEnv.NODE_ENV || 'not set (defaults to "development")');
}

console.log('\n🎯 Recommended settings to reduce log noise:');
console.log('');
console.log('Add these to your .env file:');
console.log('');
console.log('# Reduce console logging verbosity');
console.log('CONSOLE_LOG_LEVEL=warn');
console.log('LOG_LEVEL=info');
console.log('');
console.log('# For even quieter logs (errors only):');
console.log('# CONSOLE_LOG_LEVEL=error');
console.log('# LOG_LEVEL=error');
console.log('');
console.log('# For debugging (verbose logs):');
console.log('# CONSOLE_LOG_LEVEL=debug');
console.log('# LOG_LEVEL=debug');
console.log('# NODE_ENV=debug');

console.log('\n🚀 What these changes will do:');
console.log('1. ✅ Disable excessive TypeORM query logging');
console.log('2. ✅ Only show warnings and errors in console by default');
console.log('3. ✅ Keep full logs in files for debugging');
console.log('4. ✅ Enable query result caching to reduce duplicate queries');

console.log('\n🔄 After making changes:');
console.log('1. Restart your backend server');
console.log('2. Check the console - should see much fewer logs');
console.log('3. Check logs/all.log for complete logging if needed');

console.log('\n💡 Quick commands:');
console.log('# To apply recommended settings automatically:');
console.log('echo "CONSOLE_LOG_LEVEL=warn" >> .env');
console.log('echo "LOG_LEVEL=info" >> .env');

console.log('\n# To temporarily enable debug logging:');
console.log('CONSOLE_LOG_LEVEL=debug npm run dev');
