const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/subscription.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix all the escaped backslashes in the file
content = content.replace(/\\\\/g, '');

// Write the fixed content back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed subscription.service.ts');
