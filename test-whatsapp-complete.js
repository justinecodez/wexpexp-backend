/**
 * Complete WhatsApp Testing Script
 * Tests all WhatsApp functionality including text messages, images, and templates
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_PHONE = process.env.TEST_PHONE || '255712345678'; // Replace with your test number

// Get auth token (you'll need to login first)
let authToken = '';

async function login() {
    try {
        console.log('🔐 Logging in...');
        const response = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'test@example.com', // Replace with your test account
            password: 'testpassword123'
        });
        authToken = response.data.data.token;
        console.log('✅ Login successful');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        return false;
    }
}

async function testWhatsAppText() {
    console.log('\n📱 Testing WhatsApp Text Message...');
    try {
        const response = await axios.post(
            `${API_URL}/api/messaging/whatsapp/direct`,
            {
                to: TEST_PHONE,
                message: 'Hello from WEXP! This is a test message. 🎉'
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('✅ Text message sent successfully:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Text message failed:', error.response?.data || error.message);
        return false;
    }
}

async function testWhatsAppImage() {
    console.log('\n🖼️  Testing WhatsApp Image Message...');
    try {
        // Create a simple test image (base64)
        const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        
        const response = await axios.post(
            `${API_URL}/api/messaging/whatsapp/direct`,
            {
                to: TEST_PHONE,
                message: 'Here is your invitation card! 💌',
                mediaUrl: testImageBase64
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('✅ Image message sent successfully:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Image message failed:', error.response?.data || error.message);
        return false;
    }
}

async function testWhatsAppImageUrl() {
    console.log('\n🌐 Testing WhatsApp Image with URL...');
    try {
        const response = await axios.post(
            `${API_URL}/api/messaging/whatsapp/direct`,
            {
                to: TEST_PHONE,
                message: 'Image from URL',
                mediaUrl: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=800'
            },
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('✅ Image URL message sent successfully:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Image URL message failed:', error.response?.data || error.message);
        return false;
    }
}

async function checkWhatsAppConfig() {
    console.log('\n🔍 Checking WhatsApp Configuration...');
    const config = {
        WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN ? '✅ Set' : '❌ Missing',
        WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID ? '✅ Set' : '❌ Missing',
        WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ? '✅ Set' : '❌ Missing',
        WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v18.0 (default)'
    };
    
    console.table(config);
    
    const allConfigured = process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID;
    if (!allConfigured) {
        console.log('\n⚠️  WhatsApp is not fully configured!');
        console.log('Please set the following in your .env file:');
        console.log('- WHATSAPP_TOKEN (from Meta Business Suite)');
        console.log('- WHATSAPP_PHONE_ID (from Meta Business Suite)');
        console.log('- WHATSAPP_VERIFY_TOKEN (your custom webhook verification token)');
        return false;
    }
    
    console.log('✅ WhatsApp configuration looks good!');
    return true;
}

async function runAllTests() {
    console.log('🚀 Starting WhatsApp Complete Test Suite\n');
    console.log('='.repeat(60));
    
    // Check configuration
    const configOk = await checkWhatsAppConfig();
    if (!configOk) {
        console.log('\n❌ Tests aborted due to missing configuration');
        return;
    }
    
    // Login
    const loginOk = await login();
    if (!loginOk) {
        console.log('\n❌ Tests aborted due to login failure');
        return;
    }
    
    // Run tests
    const results = {
        text: await testWhatsAppText(),
        image: await testWhatsAppImage(),
        imageUrl: await testWhatsAppImageUrl()
    };
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary:');
    console.log('='.repeat(60));
    console.table(results);
    
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.values(results).length;
    
    console.log(`\n${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('✅ All tests passed! WhatsApp is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Check the logs above for details.');
    }
}

// Run tests
runAllTests().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});

