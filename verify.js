const fs = require('fs');
const path = require('path');

const cwd = 'D:/claude-program/ccy-pro-version';

// Check what files actually exist
const files = fs.readdirSync(cwd);
console.log('Files before cleanup:', files);

// Clean up temp files
const tempFiles = ['git-init.js', 'git-init.sh', 'git-init-node.js', 'git-init.bat', 'git-init.ps1', 'git-init.vbs', 'init-git.bat', 'run-git.cjs', 'do-git.js', 'git-output.txt', '.gitkeep'];

for (const file of tempFiles) {
  try {
    fs.unlinkSync(path.join(cwd, file));
    console.log('Removed:', file);
  } catch(e) {
    console.log('Failed to remove:', file);
  }
}

try {
  fs.rmSync(path.join(cwd, 'test-package'), { recursive: true, force: true });
  console.log('Removed test-package directory');
} catch(e) {}

// Get final list
const finalFiles = fs.readdirSync(cwd);
console.log('\nFiles after cleanup:', finalFiles);

// Verify project files
console.log('\nProject files verification:');
console.log('package.json:', fs.existsSync(path.join(cwd, 'package.json')));
console.log('tsconfig.json:', fs.existsSync(path.join(cwd, 'tsconfig.json')));
console.log('.env.example:', fs.existsSync(path.join(cwd, '.env.example')));
console.log('.gitignore:', fs.existsSync(path.join(cwd, '.gitignore')));
