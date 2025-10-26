const fs = require('fs');
const path = require('path');

const htmlFilePath = path.join(__dirname, 'Titti2 - Göteborg, Skandiahamnen, Sävenäs.htm');
const outputSvgFilePath = path.join(__dirname, 'r59.svg');

fs.readFile(htmlFilePath, 'utf8', (err, htmlContent) => {
    if (err) {
        console.error('Error reading HTML file:', err);
        return;
    }

    const svgMatch = htmlContent.match(/<svg id="R59"[^>]*>[\s\S]*?<\/svg>/);

    if (svgMatch) {
        fs.writeFile(outputSvgFilePath, svgMatch[0], 'utf8', (writeErr) => {
            if (writeErr) {
                console.error('Error writing SVG file:', writeErr);
            } else {
                console.log('Successfully extracted and saved r59.svg');
            }
        });
    } else {
        console.error('Could not find SVG with id="R59" in the HTML file.');
    }
});
