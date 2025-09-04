const nodemailer = require('nodemailer');

// Test different SMTP configurations for Namecheap/PrivateEmail
async function testEmailConnections() {
  console.log('🔍 Testing email configurations...\n');
  
  const configs = [
    {
      name: 'Namecheap PrivateEmail (Standard)',
      config: {
        host: 'mail.ufumbuzilabs.com',
        port: 587,
        secure: false,
        auth: {
          user: 'wexp@ufumbuzilabs.com',
          pass: '&l8[e&lQ{Ha?'
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Namecheap PrivateEmail (SSL)',
      config: {
        host: 'mail.ufumbuzilabs.com',
        port: 465,
        secure: true,
        auth: {
          user: 'wexp@ufumbuzilabs.com',
          pass: '&l8[e&lQ{Ha?'
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Alternative Namecheap server',
      config: {
        host: 'mail.privateemail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'wexp@ufumbuzilabs.com',
          pass: '&l8[e&lQ{Ha?'
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    }
  ];

  for (const { name, config } of configs) {
    console.log(`\n📧 Testing: ${name}`);
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   User: ${config.auth.user}`);
    console.log(`   Secure: ${config.secure}`);
    
    try {
      const transporter = nodemailer.createTransport({
        ...config,
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        debug: false,
        logger: false
      });

      console.log('   Status: Connecting...');
      
      const verified = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Connection timeout' });
        }, 15000);
        
        transporter.verify((error, success) => {
          clearTimeout(timeout);
          if (error) {
            resolve({ success: false, error: error.message, code: error.code });
          } else {
            resolve({ success: true });
          }
        });
      });

      if (verified.success) {
        console.log('   ✅ SUCCESS: SMTP connection verified!');
        
        // Try sending a test email
        console.log('   📤 Sending test email...');
        try {
          const info = await transporter.sendMail({
            from: '"WEXP Test" <wexp@ufumbuzilabs.com>',
            to: 'wexp@ufumbuzilabs.com',
            subject: 'SMTP Test - ' + new Date().toISOString(),
            html: '<h3>✅ Email service is working!</h3><p>This is a test email to confirm SMTP configuration.</p>',
            text: 'Email service is working! This is a test email to confirm SMTP configuration.'
          });
          console.log('   ✅ Email sent successfully!');
          console.log('   📧 Message ID:', info.messageId);
          break; // Stop testing other configs if this one works
        } catch (sendError) {
          console.log('   ❌ Email send failed:', sendError.message);
        }
      } else {
        console.log(`   ❌ FAILED: ${verified.error}`);
        if (verified.code) {
          console.log(`   🔍 Error code: ${verified.code}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
}

// Additional diagnostics
async function runDiagnostics() {
  console.log('\n🔍 Running additional diagnostics...\n');
  
  // Check if the domain resolves
  const dns = require('dns');
  const util = require('util');
  const lookup = util.promisify(dns.lookup);
  
  try {
    const result = await lookup('mail.ufumbuzilabs.com');
    console.log('✅ DNS Resolution: mail.ufumbuzilabs.com ->', result.address);
  } catch (error) {
    console.log('❌ DNS Resolution failed:', error.message);
  }
  
  // Check connectivity with telnet-like test
  const net = require('net');
  console.log('\n📡 Testing TCP connectivity...');
  
  const testTcpConnection = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);
      
      socket.connect(port, host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ success: true });
      });
      
      socket.on('error', (error) => {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      });
    });
  };
  
  const ports = [587, 465, 25];
  for (const port of ports) {
    const result = await testTcpConnection('mail.ufumbuzilabs.com', port);
    if (result.success) {
      console.log(`✅ Port ${port}: Reachable`);
    } else {
      console.log(`❌ Port ${port}: ${result.error}`);
    }
  }
}

// Run all tests
async function main() {
  console.log('🚀 WEXP Email Service Diagnostics\n');
  console.log('=' .repeat(50));
  
  await runDiagnostics();
  await testEmailConnections();
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Diagnostics complete!');
}

main().catch(console.error);
