const axios = require('axios');

// Test the messaging service configuration
async function testSMSConfig() {
  console.log('🧪 Testing SMS Service Configuration\n');
  
  const config = {
    username: 'justinecodez',
    password: 'YTj5BM8wtaTJHA@',
    apiUrl: 'https://messaging-service.co.tz/api/sms/v1/text/single',
    defaultFrom: 'Wexp Card'
  };
  
  console.log('Configuration:');
  console.log(`- Username: ${config.username}`);
  console.log(`- API URL: ${config.apiUrl}`);
  console.log(`- Default From: ${config.defaultFrom}`);
  console.log('- Password: [HIDDEN]\n');
  
  try {
    const authToken = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    console.log('✅ Auth token generated successfully\n');
    
    console.log('🚀 Testing API connectivity...');
    
    const testPayload = {
      from: config.defaultFrom,
      to: ['255658123881'], // Test number
      text: 'Hello from WEXP! This is a test message to verify the SMS service is working correctly.',
      reference: `test_${Date.now()}`
    };
    
    console.log('Sending test message...');
    console.log(`To: ${testPayload.to.join(', ')}`);
    console.log(`From: ${testPayload.from}`);
    console.log(`Text: ${testPayload.text}`);
    console.log(`Reference: ${testPayload.reference}\n`);
    
    const response = await axios.post(
      config.apiUrl,
      testPayload,
      {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ SMS API Response:');
    console.log(`Status: ${response.status}`);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 || response.status === 201) {
      console.log('\n🎉 SUCCESS! SMS service is working correctly!');
      console.log('Your messaging system is ready to use.');
    } else {
      console.log('\n⚠️  Unexpected response status. Please check the API documentation.');
    }
    
  } catch (error) {
    console.log('❌ Error testing SMS service:');
    
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n💡 This might be an authentication issue. Please verify:');
        console.log('1. Username is correct: justinecodez');
        console.log('2. Password is correct: YTj5BM8wtaTJHA@');
        console.log('3. The account has sufficient credits');
      } else if (error.response.status === 400) {
        console.log('\n💡 This might be a request format issue. Please check:');
        console.log('1. Phone number format is correct');
        console.log('2. Message content is valid');
        console.log('3. All required fields are provided');
      }
    } else if (error.request) {
      console.log('Network error - could not reach the API');
      console.log('Please check your internet connection');
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test phone number validation
function testPhoneValidation() {
  console.log('\n📱 Testing Phone Number Validation\n');
  
  const testNumbers = [
    '255658123881',
    '+255658123881', 
    '0658123881',
    '658123881',
    '255757714834',
    'invalid-number'
  ];
  
  testNumbers.forEach(phone => {
    const cleaned = phone.replace(/[\s-+()]/g, '');
    const patterns = [
      /^255[67]\d{8}$/, // International format
      /^0[67]\d{8}$/,   // Local format
      /^[67]\d{8}$/     // Without country code
    ];
    
    let isValid = false;
    let formatted = cleaned;
    
    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        isValid = true;
        if (formatted.startsWith('0')) {
          formatted = '255' + formatted.substring(1);
        } else if (formatted.length === 9 && /^[67]/.test(formatted)) {
          formatted = '255' + formatted;
        }
        break;
      }
    }
    
    console.log(`${phone.padEnd(15)} -> ${isValid ? '✅ Valid' : '❌ Invalid'} ${isValid ? `(${formatted})` : ''}`);
  });
}

// Run tests
console.log('🚀 WEXP SMS Service Test Suite\n');
console.log('===============================\n');

testPhoneValidation();

console.log('\n' + '='.repeat(50) + '\n');

testSMSConfig().then(() => {
  console.log('\n📝 Test completed!');
  console.log('\nIf the test was successful, you can now:');
  console.log('1. Start your WEXP server: npm run dev');
  console.log('2. Use the messaging APIs in your application');
  console.log('3. Send SMS messages to your users');
}).catch(error => {
  console.error('Test failed:', error.message);
});
