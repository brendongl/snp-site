#!/usr/bin/env node
/**
 * Test script for the HTTP bridge running locally
 * This simulates what the Switch homebrew would do
 */

const axios = require('axios');

// HTTP bridge endpoint (no HTTPS!)
const BRIDGE_URL = 'http://localhost:3001/webhook';

async function sendTestWebhook() {
  const testPayload = {
    serial: "XKK10006076602",
    hos_version: "20.4.0",
    ams_version: "1.9.4",
    action: "Launch",
    title_id: "01007EF00011E000",
    title_version: "1.3.0",
    title_name: "The Legend of Zelda: Breath of the Wild",
    controller_count: 1
  };

  console.log('\n============================================================');
  console.log('Testing HTTP Bridge for Nintendo Switch Webhook');
  console.log('============================================================');
  console.log('Sending to:', BRIDGE_URL);
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  console.log('============================================================\n');

  try {
    const response = await axios.post(BRIDGE_URL, testPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('[SUCCESS] Response from bridge:');
    console.log('Status:', response.status);
    console.log('Data:', response.data);

    // Send exit event after 2 seconds
    setTimeout(async () => {
      testPayload.action = 'Exit';
      console.log('\nSending Exit event...');
      try {
        await axios.post(BRIDGE_URL, testPayload, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('[SUCCESS] Exit event sent');
      } catch (error) {
        console.error('[ERROR] Exit event failed:', error.message);
      }
    }, 2000);

  } catch (error) {
    console.error('[ERROR] Request failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Message:', error.response.statusText);
    } else {
      console.error('Message:', error.message);
    }
    console.log('\n[TIP] Make sure:');
    console.log('1. The HTTP bridge is running: node server.js');
    console.log('2. The bridge is configured to forward to the right URL');
    console.log('3. The target server (local or production) is accessible');
  }
}

// Run the test
sendTestWebhook();