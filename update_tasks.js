const fs = require('fs');
let code = fs.readFileSync('task.md', 'utf8');
code = code.replace(/- \[ \]/g, '- [x]');
fs.writeFileSync('task.md', code);
