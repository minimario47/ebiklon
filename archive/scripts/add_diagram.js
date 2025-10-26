#!/usr/bin/env node

// Usage: node add_diagram.js R58
// This will extract R58 from the source HTML and create diagrams/R58.html

const fs = require('fs');
const path = require('path');

const diagramId = process.argv[2];
if (!diagramId) {
    console.error('Usage: node add_diagram.js <DIAGRAM_ID>');
    console.error('Example: node add_diagram.js R58');
    process.exit(1);
}

const htmlFilePath = 'Titti2 - Göteborg, Skandiahamnen, Sävenäs.htm';
const outputPath = `diagrams/${diagramId}.html`;

// Read the source HTML file
fs.readFile(htmlFilePath, 'utf8', (err, htmlContent) => {
    if (err) {
        console.error('Error reading HTML file:', err);
        return;
    }

    // Extract the SVG for the specified diagram
    const svgPattern = new RegExp(`<svg id="${diagramId}"[^>]*>[\\s\\S]*?<\\/svg>`);
    const svgMatch = htmlContent.match(svgPattern);

    if (svgMatch) {
        const diagramHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { margin: 0; padding: 0; }
        svg { display: block; width: 100%; height: auto; }
    </style>
</head>
<body>
${svgMatch[0]}
</body>
</html>`;

        // Ensure diagrams directory exists
        if (!fs.existsSync('diagrams')) {
            fs.mkdirSync('diagrams');
        }

        fs.writeFile(outputPath, diagramHtml, 'utf8', (writeErr) => {
            if (writeErr) {
                console.error('Error writing diagram file:', writeErr);
            } else {
                console.log(`Successfully created ${outputPath}`);
                console.log(`To add this diagram to your index.html, add this to the diagramConfig array:`);
                console.log(`{ id: '${diagramId}', file: 'diagrams/${diagramId}.html', width: '50%' },`);
            }
        });
    } else {
        console.error(`Could not find SVG with id="${diagramId}" in the HTML file.`);
        console.log('Available diagrams might include: R58, R57, etc. Check the source HTML file.');
    }
});
