const fs = require('fs');
const path = require('path');

const cwd = 'D:/claude-program/ccy-pro-version';
const tempFiles = ['git-init.js', 'git-init.sh', 'git-init-node.js', 'git-init.bat', 'git-init.ps1', 'git-init.vbs', 'init-git.bat', 'run-git.cjs', 'do-git.js', 'git-output.txt', '.gitkeep', 'verify.js'];

for (const file of tempFiles) {
  try { fs.unlinkSync(path.join(cwd, file)); } catch(e) {}
}

try { fs.rmSync(path.join(cwd, 'test-package'), { recursive: true, force: true }); } catch(e) {}

console.log('Cleanup done');
