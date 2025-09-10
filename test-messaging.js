const axios = require('axios');

// Test messaging functionality
async function testMessaging() {
  const BASE_URL = 'http://localhost:3000';
  
  console.log('🧪 Testing messaging functionality...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing messaging health check...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/api/messaging/health`, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE' // You'll need to get a valid token
        }
      });
      console.log('✅ Health check response:', healthResponse.data);
    } catch (error) {
      console.log('❌ Health check failed:', error.response?.data || error.message);
    }
    
    // Test 2: Phone validation
    console.log('\n2. Testing phone validation...');
    try {
      const phoneValidation = await axios.post(`${BASE_URL}/api/messaging/validate/phone`, {
        phone: '255658123881'
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
        }
      });
      console.log('✅ Phone validation response:', phoneValidation.data);
    } catch (error) {
      console.log('❌ Phone validation failed:', error.response?.data || error.message);
    }
    
    // Test 3: Send SMS
    console.log('\n3. Testing SMS sending...');
    try {
      const smsResponse = await axios.post(`${BASE_URL}/api/messaging/sms/send`, {
        to: '255658123881', // Test phone number
        message: 'Hello from WEXP! This is a test message from your event platform.'
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
        }
      });
      console.log('✅ SMS send response:', smsResponse.data);
    } catch (error) {
      console.log('❌ SMS send failed:', error.response?.data || error.message);
    }
    
    // Test 4: Send verification code
    console.log('\n4. Testing verification code...');
    try {
      const verificationResponse = await axios.post(`${BASE_URL}/api/messaging/verification`, {
        contact: '255658123881',
        method: 'sms'
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
        }
      });
      console.log('✅ Verification code response:', verificationResponse.data);
    } catch (error) {
      console.log('❌ Verification code failed:', error.response?.data || error.message);
    }
    
    // Test 5: Send welcome notification
    console.log('\n5. Testing welcome notification...');
    try {
      const welcomeResponse = await axios.post(`${BASE_URL}/api/messaging/welcome`, {
        name: 'Test User',
        phone: '255658123881',
        email: 'test@example.com'
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
        }
      });
      console.log('✅ Welcome notification response:', welcomeResponse.data);
    } catch (error) {
      console.log('❌ Welcome notification failed:', error.response?.data || error.message);
    }
    
    // Test 6: Get available templates
    console.log('\n6. Testing template listing...');
    try {
      const templatesResponse = await axios.get(`${BASE_URL}/api/messaging/templates`, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
        }
      });
      console.log('✅ Templates response:', templatesResponse.data);
    } catch (error) {
      console.log('❌ Templates listing failed:', error.response?.data || error.message);
    }
    
    // Test 7: Send event notification
    console.log('\n7. Testing event notification...');
    try {
      const eventNotificationResponse = await axios.post(`${BASE_URL}/api/messaging/event/notify`, {
        eventData: {
          title: 'Test Event',
          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          location: 'Dar es Salaam, Tanzania',
          organizerName: 'WEXP Team'
        },
        recipients: [
          { phone: '255658123881', name: 'Test User' }
        ],
        notificationType: 'invitation'
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
        }
      });
      console.log('✅ Event notification response:', eventNotificationResponse.data);
    } catch (error) {
      console.log('❌ Event notification failed:', error.response?.data || error.message);
    }
    
    // Test 8: Send template message
    console.log('\n8. Testing template message...');
    try {
      const templateResponse = await axios.post(`${BASE_URL}/api/messaging/template/send`, {
        templateType: 'welcome',
        templateData: {
          name: 'Test User'
        },
        recipient: '255658123881',
        method: 'sms'
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE'
        }
      });
      console.log('✅ Template message response:', templateResponse.data);
    } catch (error) {
      console.log('❌ Template message failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ General test error:', error.message);
  }
  
  console.log('\n🏁 Messaging tests completed!');
  console.log('\n📝 Note: To run these tests successfully, you need to:');
  console.log('1. Replace YOUR_TEST_TOKEN_HERE with a valid JWT token');
  console.log('2. Make sure your server is running on localhost:3000');
  console.log('3. Ensure your messaging service credentials are properly configured');
}

// Direct SMS service test (without API)
async function testSMSServiceDirect() {
  console.log('🔧 Direct SMS service test...\n');
  
  // This would require importing your SMS service directly
  // For now, we'll just show how to do a curl test
  console.log('To test SMS service directly with curl:');
  console.log(`
curl --location 'https://messaging-service.co.tz/api/sms/v1/text/single' \\
--header 'Authorization: Basic anVzdGluZWNvZGV6OllUajVCTTh3dGFUSkhBQA==' \\
--header 'Content-Type: application/json' \\
--header 'Accept: application/json' \\
--data '{
    "from": "Wexp Card",
    "to": ["255658123881"],
    "text": "Test message from WEXP platform",
    "reference": "test_${Date.now()}"
}'
  `);
}

// Run tests
if (require.main === module) {
  console.log('🚀 WEXP Messaging System Test Suite\n');
  console.log('====================================\n');
  
  testMessaging().then(() => {
    console.log('\n--------------------\n');
    testSMSServiceDirect();
  });
}
