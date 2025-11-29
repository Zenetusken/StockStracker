const API_BASE = 'http://localhost:3001';

async function setupTestUser() {
  try {
    // Try to register a new user
    console.log('Attempting to register test user...');
    const registerResponse = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testuser123@example.com',
        password: 'password123'
      })
    });

    if (registerResponse.ok) {
      const data = await registerResponse.json();
      console.log('✓ User registered successfully:', data);
      console.log('\nTest credentials:');
      console.log('Email: testuser123@example.com');
      console.log('Password: password123');
    } else {
      const error = await registerResponse.text();
      console.log('Registration failed (user may already exist):', error);
      console.log('\nTrying to login with existing credentials...');

      // Try to login
      const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testuser123@example.com',
          password: 'password123'
        })
      });

      if (loginResponse.ok) {
        console.log('✓ Login successful with existing user');
      } else {
        console.log('× Login failed - user may not exist with these credentials');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

setupTestUser();
