#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

console.log('🚀 WEXP Messaging System Setup\n');
console.log('==============================\n');

async function setupMessaging() {
  try {
    // Check if required environment variables exist
    const envPath = path.join(__dirname, '..', '.env');
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    
    console.log('1. Checking environment configuration...');
    
    if (!fs.existsSync(envPath)) {
      console.log('   ⚠️  .env file not found. Creating from .env.example...');
      
      if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('   ✅ .env file created successfully');
      } else {
        console.log('   ❌ .env.example file not found. Please create .env manually.');
        return;
      }
    } else {
      console.log('   ✅ .env file exists');
    }
    
    // Check if messaging configuration exists in .env
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasMessagingConfig = envContent.includes('MESSAGING_SERVICE_USERNAME');
    
    if (!hasMessagingConfig) {
      console.log('   ⚠️  Messaging configuration not found in .env. Adding...');
      
      const messagingConfig = `

# SMS Configuration (messaging-service.co.tz)
SMS_PROVIDER=messaging-service
MESSAGING_SERVICE_USERNAME=justinecodez
MESSAGING_SERVICE_PASSWORD=YTj5BM8wtaTJHA@
MESSAGING_SERVICE_API_URL=https://messaging-service.co.tz/api/sms/v1/text/single
MESSAGING_SERVICE_DEFAULT_FROM=Wexp Card
`;
      
      fs.appendFileSync(envPath, messagingConfig);
      console.log('   ✅ Messaging configuration added to .env');
    } else {
      console.log('   ✅ Messaging configuration already exists in .env');
    }
    
    // Install required dependencies
    console.log('\n2. Installing required dependencies...');
    
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const requiredDeps = {
      'axios': '^1.6.0',
      'date-fns': '^3.0.0'
    };
    
    const missingDeps = [];
    
    for (const [dep, version] of Object.entries(requiredDeps)) {
      if (!packageJson.dependencies[dep]) {
        missingDeps.push(`${dep}@${version}`);
      } else {
        console.log(`   ✅ ${dep} already installed`);
      }
    }
    
    if (missingDeps.length > 0) {
      console.log(`   📦 Installing missing dependencies: ${missingDeps.join(', ')}`);
      
      try {
        const { stdout, stderr } = await execPromise(`npm install ${missingDeps.join(' ')}`);
        console.log('   ✅ Dependencies installed successfully');
        
        if (stderr && !stderr.includes('WARN')) {
          console.log('   ⚠️  Installation warnings:', stderr);
        }
      } catch (error) {
        console.log('   ❌ Failed to install dependencies:', error.message);
        console.log('   Please run manually: npm install ' + missingDeps.join(' '));
      }
    } else {
      console.log('   ✅ All required dependencies are already installed');
    }
    
    // Test API connectivity
    console.log('\n3. Testing messaging service connectivity...');
    
    try {
      const axios = require('axios');
      
      const testResponse = await axios.post(
        'https://messaging-service.co.tz/api/sms/v1/text/single',
        {
          from: 'Wexp Card',
          to: ['255000000000'], // Test number
          text: 'Connection test',
          reference: 'setup_test_' + Date.now()
        },
        {
          headers: {
            'Authorization': 'Basic anVzdGluZWNvZGV6OllUajVCTTh3dGFUSkhBQA==',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true // Don't throw on HTTP errors
        }
      );
      
      if (testResponse.status < 500) {
        console.log('   ✅ Messaging service is reachable');
        console.log(`   📡 Response status: ${testResponse.status}`);
      } else {
        console.log('   ⚠️  Messaging service returned server error');
        console.log(`   📡 Response status: ${testResponse.status}`);
      }
      
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log('   ⚠️  Cannot test connectivity - axios not available');
        console.log('   Please run npm install first, then test manually');
      } else {
        console.log('   ❌ Connectivity test failed:', error.message);
      }
    }
    
    // Validate project structure
    console.log('\n4. Validating project structure...');
    
    const requiredFiles = [
      'src/services/smsService.ts',
      'src/utils/messageTemplates.ts',
      'src/controllers/messagingController.ts',
      'src/routes/messagingRoutes.ts'
    ];
    
    const missingFiles = [];
    
    for (const filePath of requiredFiles) {
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        console.log(`   ✅ ${filePath}`);
      } else {
        console.log(`   ❌ ${filePath} - MISSING`);
        missingFiles.push(filePath);
      }
    }
    
    if (missingFiles.length > 0) {
      console.log('\n   ⚠️  Some required files are missing. Please ensure all messaging files are properly deployed.');
    } else {
      console.log('\n   ✅ All required files are present');
    }
    
    // Generate summary report
    console.log('\n5. Setup Summary');
    console.log('================');
    
    console.log('📋 Configuration:');
    console.log('   • SMS Provider: messaging-service.co.tz');
    console.log('   • Username: justinecodez');
    console.log('   • Default Sender: Wexp Card');
    
    console.log('\n📡 API Endpoints:');
    console.log('   • Health Check: GET /api/messaging/health');
    console.log('   • Send SMS: POST /api/messaging/sms/send');
    console.log('   • Send Email: POST /api/messaging/email/send');
    console.log('   • Templates: GET /api/messaging/templates');
    
    console.log('\n🧪 Testing:');
    console.log('   • Run: node test-messaging.js');
    console.log('   • Manual test: curl with provided examples');
    
    console.log('\n📚 Documentation:');
    console.log('   • Implementation guide: MESSAGING_IMPLEMENTATION.md');
    console.log('   • API docs: http://localhost:3000/api/docs');
    
    console.log('\n✅ Messaging system setup completed successfully!');
    console.log('\n🚀 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Test the health endpoint: GET /api/messaging/health');
    console.log('3. Run the test suite: node test-messaging.js');
    console.log('4. Check the documentation in MESSAGING_IMPLEMENTATION.md');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\nPlease check the error above and try again.');
    console.log('For manual setup, refer to MESSAGING_IMPLEMENTATION.md');
  }
}

// Run setup if called directly
if (require.main === module) {
  setupMessaging();
}

module.exports = { setupMessaging };
