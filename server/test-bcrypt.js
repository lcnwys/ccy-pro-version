import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash('test', 10);
console.log('Hash:', hash);
console.log('OK');
