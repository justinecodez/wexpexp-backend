/**
 * Test WhatsApp Webhook Verification Endpoint
 * This script tests if your webhook verification endpoint is working correctly
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'a9f396107eaff1d638396c0510147aaef235e1631303ea85c4e7a5c6fea87c2d';

async function testWebhookVerification() {
    console.log('🧪 Testing WhatsApp Webhook Verification Endpoint\n');
    console.log('='.repeat(60));
    
    // Test 1: Check if endpoint is accessible
    console.log('\n1️⃣ Testing endpoint accessibility...');
    try {
        const testUrl = `${API_URL}/webhooks/whatsapp`;
        console.log(`   URL: ${testUrl}`);
        
        const response = await axios.get(testUrl, {
            params: {
                'hub.mode': 'subscribe',
                'hub.challenge': 'test_challenge_12345',
                'hub.verify_token': VERIFY_TOKEN
            },
            timeout: 5000
        });
        
        console.log(`   ✅ Endpoint is accessible`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${response.data}`);
        
        if (response.data === 'test_challenge_12345') {
            console.log('   ✅ Challenge returned correctly - Verification should work!');
        } else {
            console.log('   ⚠️  Challenge mismatch - Check your verifyWebhook handler');
        }
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('   ❌ Server is not running or not accessible');
            console.log(`   Make sure your backend is running on ${API_URL}`);
        } else if (error.response) {
            console.log(`   ❌ Server returned error: ${error.response.status}`);
            console.log(`   Response: ${error.response.data}`);
        } else {
            console.log(`   ❌ Error: ${error.message}`);
        }
        return;
    }
    
    // Test 2: Test with wrong token
    console.log('\n2️⃣ Testing with wrong verify token...');
    try {
        const response = await axios.get(`${API_URL}/webhooks/whatsapp`, {
            params: {
                'hub.mode': 'subscribe',
                'hub.challenge': 'test_challenge_12345',
                'hub.verify_token': 'wrong_token'
            },
            validateStatus: () => true // Don't throw on 403
        });
        
        if (response.status === 403) {
            console.log('   ✅ Correctly rejected wrong token (403)');
        } else {
            console.log(`   ⚠️  Expected 403, got ${response.status}`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }
    
    // Test 3: Test with wrong mode
    console.log('\n3️⃣ Testing with wrong mode...');
    try {
        const response = await axios.get(`${API_URL}/webhooks/whatsapp`, {
            params: {
                'hub.mode': 'unsubscribe',
                'hub.challenge': 'test_challenge_12345',
                'hub.verify_token': VERIFY_TOKEN
            },
            validateStatus: () => true
        });
        
        if (response.status === 403) {
            console.log('   ✅ Correctly rejected wrong mode (403)');
        } else {
            console.log(`   ⚠️  Expected 403, got ${response.status}`);
        }
    } catch (error) {
        console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   Verify Token: ${VERIFY_TOKEN.substring(0, 20)}...`);
    console.log(`   Webhook URL: ${API_URL}/webhooks/whatsapp`);
    console.log('\n💡 Next Steps:');
    console.log('   1. If endpoint is accessible locally, use ngrok for public access');
    console.log('   2. Use the SAME verify token in Meta Business Suite');
    console.log('   3. Use the PUBLIC URL (ngrok or your domain) in Meta');
    console.log('   4. Make sure your server is running and accessible');
}

// Run tests
testWebhookVerification().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});

