const API_BASE = 'http://localhost:3001';

async function testLogin() {
  try {
    console.log('Testing login...');
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testuser123@example.com',
        password: 'password123'
      })
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', data);

    if (response.ok) {
      console.log('✓ Login successful!');
    } else {
      console.log('× Login failed:', data.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();
