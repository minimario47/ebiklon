const fs = require('fs');

// Read the current index.html
const indexContent = fs.readFileSync('index.html', 'utf8');

// Extract R59 SVG (first SVG in the file)
const r59Match = indexContent.match(/<svg id="R59"[^>]*>[\s\S]*?<\/svg>/);
if (r59Match) {
    const r59Html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; padding: 0; }
        svg { display: block; width: 100%; height: auto; }
    </style>
</head>
<body>
${r59Match[0]}
</body>
</html>`;
    fs.writeFileSync('diagrams/R59.html', r59Html);
    console.log('Created diagrams/R59.html');
}

// Extract R5A SVG (second SVG in the file)
const r5aMatch = indexContent.match(/<svg id="R5A"[^>]*>[\s\S]*?<\/svg>/);
if (r5aMatch) {
    const r5aHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; padding: 0; }
        svg { display: block; width: 100%; height: auto; }
    </style>
</head>
<body>
${r5aMatch[0]}
</body>
</html>`;
    fs.writeFileSync('diagrams/R5A.html', r5aHtml);
    console.log('Created diagrams/R5A.html');
}
