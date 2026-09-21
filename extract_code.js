const fs = require('fs');
const html = fs.readFileSync('C:/Users/FS-127/.gemini/antigravity-ide/brain/5f0934da-839f-45a0-892d-a539d31b17a9/.system_generated/steps/115/content.md', 'utf8');
const regex = /<pre[\s\S]*?><code[\s\S]*?>([\s\S]*?)<\/code><\/pre>/gi;
let match;
while ((match = regex.exec(html)) !== null) {
  let content = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  if (content.includes('import') && content.includes('Sarvam')) {
    console.log('--- CODE BLOCK ---');
    console.log(content);
  }
}
