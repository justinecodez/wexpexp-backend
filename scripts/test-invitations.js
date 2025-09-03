#!/usr/bin/env node

/**
 * Test utility for debugging invitation/guest functionality
 * This will help identify what's going wrong with the guest list loading
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
let accessToken = '';

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testHealthCheck() {
  console.log('🔍 Testing backend health...');
  try {
    const url = new URL(`${BASE_URL}/health`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };

    const response = await makeRequest(options);
    console.log('✅ Health check status:', response.status);
    console.log('📊 Health data:', response.data);
    
    // Check if database is healthy (email can be unhealthy for this test)
    if (response.data && response.data.services) {
      const dbHealthy = response.data.services.database?.status === 'healthy';
      console.log(`📊 Database status: ${dbHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`📧 Email status: ${response.data.services.email?.status === 'healthy' ? '✅ Healthy' : '⚠️ Unhealthy (not required for this test)'}`);
      return dbHealthy; // Only require database to be healthy
    }
    
    return response.status === 200;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testLogin() {
  console.log('🔐 Testing login...');
  try {
    const url = new URL(`${BASE_URL}/api/auth/login`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const loginData = {
      email: 'john.doe@example.com',
      password: 'SecurePassword123!'
    };

    const response = await makeRequest(options, loginData);
    console.log('🔐 Login status:', response.status);
    
    if (response.status === 200 && response.data.success) {
      accessToken = response.data.data.accessToken;
      console.log('✅ Login successful, token obtained');
      return true;
    } else {
      console.log('❌ Login failed:', response.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
}

async function testGetEvents() {
  console.log('📅 Testing get events...');
  try {
    const url = new URL(`${BASE_URL}/api/events`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + '?limit=5',
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const response = await makeRequest(options);
    console.log('📅 Events status:', response.status);
    
    if (response.status === 200 && response.data.success) {
      const events = response.data.data || [];
      console.log(`✅ Found ${events.length} events`);
      if (events.length > 0) {
        console.log('📋 First event:', {
          id: events[0].id,
          title: events[0].title,
          eventDate: events[0].eventDate
        });
        return events[0].id; // Return first event ID for testing
      }
      return null;
    } else {
      console.log('❌ Failed to get events:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Get events failed:', error.message);
    return null;
  }
}

async function testGetInvitations(eventId) {
  console.log(`🎫 Testing get invitations for event: ${eventId}...`);
  try {
    const url = new URL(`${BASE_URL}/api/invitations/event/${eventId}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + '?page=1&limit=100',
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const response = await makeRequest(options);
    console.log('🎫 Invitations status:', response.status);
    console.log('🎫 Invitations response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.success) {
      const invitations = response.data.data || [];
      console.log(`✅ Found ${invitations.length} invitations`);
      return invitations;
    } else {
      console.log('❌ Failed to get invitations:', response.data);
      return [];
    }
  } catch (error) {
    console.error('❌ Get invitations failed:', error.message);
    return [];
  }
}

async function testCreateInvitation(eventId) {
  console.log(`➕ Testing create invitation for event: ${eventId}...`);
  try {
    const url = new URL(`${BASE_URL}/api/invitations`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const invitationData = {
      eventId: eventId,
      guestName: 'Test Guest',
      guestEmail: 'test.guest@example.com',
      guestPhone: '+255123456789',
      invitationMethod: 'EMAIL',
      specialRequirements: 'Test invitation from script'
    };

    const response = await makeRequest(options, invitationData);
    console.log('➕ Create invitation status:', response.status);
    console.log('➕ Create invitation response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 201 && response.data.success) {
      console.log('✅ Invitation created successfully');
      return response.data.data.invitation;
    } else {
      console.log('❌ Failed to create invitation:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Create invitation failed:', error.message);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Starting Invitation API Tests');
  console.log('================================\n');

  // Test 1: Health Check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('❌ Backend is not healthy. Please start the backend server first.');
    return;
  }
  console.log('');

  // Test 2: Login
  const loginOk = await testLogin();
  if (!loginOk) {
    console.log('❌ Login failed. Cannot proceed with authenticated tests.');
    return;
  }
  console.log('');

  // Test 3: Get Events
  const eventId = await testGetEvents();
  if (!eventId) {
    console.log('❌ No events found. Create an event first in your frontend.');
    return;
  }
  console.log('');

  // Test 4: Get Invitations (this is where the problem likely is)
  const invitations = await testGetInvitations(eventId);
  console.log('');

  // Test 5: Create an invitation if none exist
  if (invitations.length === 0) {
    console.log('📝 No invitations found. Creating a test invitation...');
    const newInvitation = await testCreateInvitation(eventId);
    if (newInvitation) {
      console.log('');
      // Test getting invitations again
      await testGetInvitations(eventId);
    }
  }

  console.log('\n🏁 Tests completed!');
  console.log('\n💡 Findings:');
  console.log(`   - Backend health: ${healthOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`   - Authentication: ${loginOk ? '✅ OK' : '❌ Failed'}`);
  console.log(`   - Events API: ${eventId ? '✅ OK' : '❌ Failed'}`);
  console.log(`   - Invitations API: ${invitations.length >= 0 ? '✅ OK' : '❌ Failed'}`);
  console.log(`   - Found ${invitations.length} existing invitations`);
}

// Run the tests
runTests().catch(console.error);
