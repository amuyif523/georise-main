const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'test_output_2.txt');

try {
  const content = fs.readFileSync(filePath, 'utf8'); // Try utf8 first
  console.log(content.slice(-2000));
} catch (err) {
  console.error('Error reading file:', err);
}
