const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'services', 'subscription.service.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replace all escaped backslashes followed by 'n' with actual newlines
content = content.replace(/\\\\n/g, '\n');

// Also fix any other potential escape sequences
content = content.replace(/\\\\t/g, '\t');
content = content.replace(/\\\\r/g, '\r');
content = content.replace(/\\\\"/g, '"');
content = content.replace(/\\\\'/g, "'");

// Write the fixed content back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed all escape sequences in subscription.service.ts');

// Verify the fix by checking line 128
const lines = content.split('\n');
if (lines.length > 127) {
    console.log(`Line 128: ${lines[127].substring(0, 100)}`);
}
