import bcrypt from 'bcryptjs';

console.log('Testing bcryptjs...');

const password = 'test123';
const salt = 10;

// Test callback-based hash
bcrypt.hash(password, salt, (err, hash) => {
  if (err) {
    console.error('Hash error:', err);
    process.exit(1);
  }
  console.log('Hash success:', hash.substring(0, 20) + '...');

  // Test callback-based compare
  bcrypt.compare(password, hash, (err, result) => {
    if (err) {
      console.error('Compare error:', err);
      process.exit(1);
    }
    console.log('Compare result:', result);
    if (result) {
      console.log('SUCCESS: bcryptjs works!');
      process.exit(0);
    } else {
      console.error('FAILED: Password mismatch');
      process.exit(1);
    }
  });
});

console.log('Waiting for async operations...');
