#!/usr/bin/env node

/**
 * Logging Control Utility
 * Quick script to toggle logging levels without manually editing .env
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

function updateEnvVariable(key, value) {
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found');
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  const regex = new RegExp(`^${key}=.*`, 'm');
  
  if (regex.test(envContent)) {
    // Update existing
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    // Add new
    envContent += `\n${key}=${value}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Updated ${key}=${value}`);
}

const action = process.argv[2];

switch (action) {
  case 'quiet':
    console.log('🔇 Setting quiet logging (errors only)');
    updateEnvVariable('CONSOLE_LOG_LEVEL', 'error');
    updateEnvVariable('LOG_LEVEL', 'error');
    break;
    
  case 'normal':
    console.log('📊 Setting normal logging (warnings and errors)');
    updateEnvVariable('CONSOLE_LOG_LEVEL', 'warn');
    updateEnvVariable('LOG_LEVEL', 'info');
    break;
    
  case 'verbose':
    console.log('🔊 Setting verbose logging (all messages)');
    updateEnvVariable('CONSOLE_LOG_LEVEL', 'debug');
    updateEnvVariable('LOG_LEVEL', 'debug');
    break;
    
  case 'debug':
    console.log('🐛 Setting debug mode (includes SQL queries)');
    updateEnvVariable('CONSOLE_LOG_LEVEL', 'debug');
    updateEnvVariable('LOG_LEVEL', 'debug');
    updateEnvVariable('NODE_ENV', 'debug');
    break;
    
  case 'status':
    if (!fs.existsSync(envPath)) {
      console.log('❌ .env file not found');
      break;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const currentEnv = {};
    
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        currentEnv[key.trim()] = value.trim().replace(/"/g, '');
      }
    });
    
    console.log('📊 Current logging settings:');
    console.log('CONSOLE_LOG_LEVEL:', currentEnv.CONSOLE_LOG_LEVEL || 'not set (defaults to "info")');
    console.log('LOG_LEVEL:', currentEnv.LOG_LEVEL || 'not set (defaults to "info")');
    console.log('NODE_ENV:', currentEnv.NODE_ENV || 'not set (defaults to "development")');
    break;
    
  default:
    console.log('🔧 Logging Control Utility');
    console.log('Usage: node scripts/logging-control.js [command]');
    console.log('');
    console.log('Commands:');
    console.log('  quiet   - Errors only (least noise)');
    console.log('  normal  - Warnings and errors (recommended)');
    console.log('  verbose - All messages');
    console.log('  debug   - All messages + SQL queries');
    console.log('  status  - Show current settings');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/logging-control.js quiet');
    console.log('  node scripts/logging-control.js normal');
    console.log('  node scripts/logging-control.js status');
    break;
}

if (action && action !== 'status') {
  console.log('');
  console.log('🔄 Remember to restart your backend server for changes to take effect:');
  console.log('   npm run dev');
}
