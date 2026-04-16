import bcrypt from 'bcryptjs';

console.log('Testing bcryptjs...');

async function test() {
  try {
    const password = 'test123';
    const hash = await new Promise<string>((resolve, reject) => {
      bcrypt.hash(password, 10, (err, h) => {
        if (err) reject(err);
        else resolve(h);
      });
    });
    console.log('Hash:', hash.substring(0, 20) + '...');

    const result = await new Promise<boolean>((resolve, reject) => {
      bcrypt.compare(password, hash, (err, r) => {
        if (err) reject(err);
        else resolve(r);
      });
    });
    console.log('Compare:', result);
    console.log('SUCCESS!');
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  }
}

test();
