const axios = require('axios');

// Simple test to verify communication endpoints are working
async function testCommunicationEndpoints() {
  const baseURL = 'http://localhost:3000/api';
  
  console.log('🔍 Testing communication endpoints...\n');
  
  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get(`${baseURL.replace('/api', '')}/health`);
    console.log('✅ Server health:', healthResponse.data.success ? 'OK' : 'FAILED');
    console.log('   Database:', healthResponse.data.services?.database?.status || 'unknown');
    console.log('   Email:', healthResponse.data.services?.email?.status || 'unknown');
    
    // Test 2: Check communication routes
    console.log('\n2️⃣ Testing communication routes...');
    
    // Test email status endpoint (should work without auth for testing)
    try {
      const emailStatusResponse = await axios.get(`${baseURL}/communications/email-status`, {
        timeout: 5000
      });
      console.log('✅ Email status endpoint: ACCESSIBLE');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️ Email status endpoint: REQUIRES AUTH (normal)');
      } else if (error.response?.status === 404) {
        console.log('❌ Email status endpoint: NOT FOUND');
      } else {
        console.log('❌ Email status endpoint: ERROR -', error.message);
      }
    }
    
    // Test bulk send endpoint structure
    console.log('\n3️⃣ Testing bulk send endpoint structure...');
    try {
      const bulkSendResponse = await axios.post(`${baseURL}/communications/send-bulk`, {
        eventId: 'test-event',
        recipients: [
          { id: '1', name: 'Test User', email: 'test@example.com' }
        ],
        channels: ['email'],
        subject: 'Test Subject',
        message: 'Test message'
      }, {
        timeout: 5000,
        headers: {
          'Authorization': 'Bearer test-token' // Will fail auth, but should not be 404
        }
      });
      console.log('✅ Bulk send endpoint: ACCESSIBLE');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Bulk send endpoint: FOUND (requires auth - normal)');
      } else if (error.response?.status === 404) {
        console.log('❌ Bulk send endpoint: NOT FOUND - Route not registered properly!');
      } else if (error.response?.status === 403) {
        console.log('✅ Bulk send endpoint: FOUND (requires admin - normal)');
      } else {
        console.log('✅ Bulk send endpoint: FOUND (error:', error.response?.status || error.code, ')');
      }
    }
    
    console.log('\n🔍 Test completed!');
    console.log('\n💡 If bulk send endpoint shows 404, check:');
    console.log('   - Backend server is running on port 3000');
    console.log('   - Communication routes are properly registered');
    console.log('   - No typos in route definitions');
    
  } catch (error) {
    console.error('❌ Failed to connect to server:', error.message);
    console.log('\n💡 Make sure your backend server is running on http://localhost:3000');
  }
}

// Run the test
testCommunicationEndpoints();
