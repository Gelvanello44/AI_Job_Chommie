/**
 * Yoco Webhook Registration Script
 * Run this script to register your webhook endpoint with Yoco
 */

const https = require('https');
const readline = require('readline');

// Your Yoco API key from .env
const YOCO_SECRET_KEY = 'sk_test_1423326f9aZ1Gpn292141818c26c';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function registerWebhook() {
  console.log(' Yoco Webhook Registration Tool');
  console.log('==================================');
  
  // Get the public URL from user
  console.log('\n You need a public URL for Yoco to send webhooks to.');
  console.log('Options:');
  console.log('1. Use ngrok: Download from https://ngrok.com/download');
  console.log('2. Deploy to production server');
  console.log('3. Use other tunneling service');
  
  const publicUrl = await askQuestion('\n Enter your public URL (e.g., https://your-ngrok-url.ngrok.io): ');
  
  if (!publicUrl.startsWith('https://')) {
    console.log(' Error: URL must start with https://');
    rl.close();
    return;
  }
  
  const webhookUrl = `${publicUrl}/api/v1/webhooks/yoco`;
  console.log(`\n Webhook URL will be: ${webhookUrl}`);
  
  const confirm = await askQuestion(' Continue with registration? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log(' Registration cancelled');
    rl.close();
    return;
  }
  
  // Prepare the registration payload
  const payload = JSON.stringify({
    name: 'AI Job Chommie Webhook',
    url: webhookUrl
  });
  
  const options = {
    hostname: 'payments.yoco.com',
    port: 443,
    path: '/api/webhooks',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  console.log('\n Registering webhook with Yoco...');
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log(' Webhook registered successfully!');
          console.log('\n Registration Details:');
          console.log(`   ID: ${response.id || 'N/A'}`);
          console.log(`   Name: ${response.name || 'N/A'}`);
          console.log(`   URL: ${response.url || 'N/A'}`);
          console.log(`   Status: ${response.status || 'Active'}`);
          
          if (response.secret) {
            console.log('\n IMPORTANT: Webhook Secret (SAVE THIS!)');
            console.log(`   Secret: ${response.secret}`);
            console.log('\n  UPDATE YOUR .ENV FILE:');
            console.log(`   YOCO_WEBHOOK_SECRET=${response.secret}`);
          }
          
          console.log('\n Next steps:');
          console.log('1. Update YOCO_WEBHOOK_SECRET in your .env file');
          console.log('2. Restart your server');
          console.log('3. Test the webhook with a payment');
          
        } else {
          console.log(' Registration failed');
          console.log(`Status: ${res.statusCode}`);
          console.log(`Response: ${data}`);
        }
      } catch (error) {
        console.log(' Error parsing response:', error.message);
        console.log('Raw response:', data);
      }
      
      rl.close();
    });
  });
  
  req.on('error', (error) => {
    console.log(' Request error:', error.message);
    rl.close();
  });
  
  req.write(payload);
  req.end();
}

// Function to list existing webhooks
async function listWebhooks() {
  const options = {
    hostname: 'payments.yoco.com',
    port: 443,
    path: '/api/webhooks',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  console.log(' Fetching existing webhooks...');
  
  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        if (res.statusCode === 200) {
          console.log(' Existing webhooks:');
          if (Array.isArray(response) && response.length > 0) {
            response.forEach((webhook, index) => {
              console.log(`\n${index + 1}. ${webhook.name || 'Unnamed'}`);
              console.log(`   ID: ${webhook.id}`);
              console.log(`   URL: ${webhook.url}`);
              console.log(`   Status: ${webhook.status || 'Unknown'}`);
            });
          } else {
            console.log('No webhooks registered yet.');
          }
        } else {
          console.log(' Failed to fetch webhooks');
          console.log(`Status: ${res.statusCode}`);
          console.log(`Response: ${data}`);
        }
      } catch (error) {
        console.log(' Error parsing response:', error.message);
        console.log('Raw response:', data);
      }
      
      rl.close();
    });
  });
  
  req.on('error', (error) => {
    console.log(' Request error:', error.message);
    rl.close();
  });
  
  req.end();
}

// Main menu
async function main() {
  const action = await askQuestion('Choose action:\n1. Register new webhook\n2. List existing webhooks\nEnter choice (1 or 2): ');
  
  if (action === '1') {
    await registerWebhook();
  } else if (action === '2') {
    await listWebhooks();
  } else {
    console.log(' Invalid choice');
    rl.close();
  }
}

main().catch(error => {
  console.log(' Unexpected error:', error.message);
  rl.close();
});
