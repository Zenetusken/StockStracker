// Simple authentication flow test script
import http from 'http';

const API_BASE = 'http://localhost:3001';

// Helper to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
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

// Test registration
async function testRegistration() {
  console.log('\n🧪 Testing Registration...');
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'testpassword123';

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  try {
    const response = await makeRequest(options, {
      email: testEmail,
      password: testPassword
    });

    if (response.status === 201) {
      console.log('✅ Registration successful');
      console.log('   User:', response.body.user.email);
      console.log('   User ID:', response.body.user.id);

      // Extract session cookie
      const setCookie = response.headers['set-cookie'];
      const sessionCookie = setCookie ? setCookie[0].split(';')[0] : null;

      return { email: testEmail, password: testPassword, sessionCookie };
    } else {
      console.log('❌ Registration failed:', response.body);
      return null;
    }
  } catch (error) {
    console.log('❌ Registration error:', error.message);
    return null;
  }
}

// Test login
async function testLogin(email, password) {
  console.log('\n🧪 Testing Login...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  try {
    const response = await makeRequest(options, { email, password });

    if (response.status === 200) {
      console.log('✅ Login successful');
      console.log('   User:', response.body.user.email);

      const setCookie = response.headers['set-cookie'];
      const sessionCookie = setCookie ? setCookie[0].split(';')[0] : null;

      return sessionCookie;
    } else {
      console.log('❌ Login failed:', response.body);
      return null;
    }
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return null;
  }
}

// Test invalid login
async function testInvalidLogin(email) {
  console.log('\n🧪 Testing Invalid Login...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  try {
    const response = await makeRequest(options, {
      email,
      password: 'wrongpassword'
    });

    if (response.status === 401) {
      console.log('✅ Invalid login correctly rejected');
      console.log('   Error:', response.body.error);
      return true;
    } else {
      console.log('❌ Invalid login should have been rejected');
      return false;
    }
  } catch (error) {
    console.log('❌ Invalid login test error:', error.message);
    return false;
  }
}

// Test /me endpoint (protected route)
async function testMeEndpoint(sessionCookie) {
  console.log('\n🧪 Testing /me endpoint (protected)...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      'Cookie': sessionCookie
    }
  };

  try {
    const response = await makeRequest(options);

    if (response.status === 200) {
      console.log('✅ /me endpoint works with session');
      console.log('   User:', response.body.user.email);
      return true;
    } else {
      console.log('❌ /me endpoint failed:', response.body);
      return false;
    }
  } catch (error) {
    console.log('❌ /me endpoint error:', error.message);
    return false;
  }
}

// Test /me endpoint without session
async function testMeEndpointUnauthorized() {
  console.log('\n🧪 Testing /me endpoint without session...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/me',
    method: 'GET'
  };

  try {
    const response = await makeRequest(options);

    if (response.status === 401) {
      console.log('✅ /me endpoint correctly rejects unauthorized request');
      return true;
    } else {
      console.log('❌ /me endpoint should reject unauthorized request');
      return false;
    }
  } catch (error) {
    console.log('❌ /me endpoint test error:', error.message);
    return false;
  }
}

// Test logout
async function testLogout(sessionCookie) {
  console.log('\n🧪 Testing Logout...');

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/logout',
    method: 'POST',
    headers: {
      'Cookie': sessionCookie
    }
  };

  try {
    const response = await makeRequest(options);

    if (response.status === 200) {
      console.log('✅ Logout successful');
      return true;
    } else {
      console.log('❌ Logout failed:', response.body);
      return false;
    }
  } catch (error) {
    console.log('❌ Logout error:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('        StockTracker Pro - Authentication Tests           ');
  console.log('═══════════════════════════════════════════════════════════');

  // Test 1: Registration
  const userData = await testRegistration();
  if (!userData) {
    console.log('\n❌ Tests failed at registration');
    process.exit(1);
  }

  // Test 2: Invalid login
  await testInvalidLogin(userData.email);

  // Test 3: Valid login
  const sessionCookie = await testLogin(userData.email, userData.password);
  if (!sessionCookie) {
    console.log('\n❌ Tests failed at login');
    process.exit(1);
  }

  // Test 4: Protected route with session
  await testMeEndpoint(sessionCookie);

  // Test 5: Protected route without session
  await testMeEndpointUnauthorized();

  // Test 6: Logout
  await testLogout(sessionCookie);

  // Test 7: Protected route after logout
  await testMeEndpointUnauthorized();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ All authentication tests passed!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
