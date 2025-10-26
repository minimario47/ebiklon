const fs = require('fs');
const path = require('path');

// All diagrams that need to be extracted
const diagramIds = ['R51', 'R52S', 'R53', 'R5B', 'R5CS', 'R5D', 'R5E', 'R5F', 'R5G', 'R5H'];

const htmlFilePath = path.join(__dirname, 'Titti2 - Göteborg, Skandiahamnen, Sävenäs.htm');

// Ensure diagrams directory exists
if (!fs.existsSync(path.join(__dirname, 'diagrams'))) {
    fs.mkdirSync(path.join(__dirname, 'diagrams'));
}

// Read the HTML file once
fs.readFile(htmlFilePath, 'utf8', (err, htmlContent) => {
    if (err) {
        console.error('Error reading HTML file:', err);
        return;
    }

    diagramIds.forEach(diagramId => {
        const outputHtmlFilePath = path.join(__dirname, 'diagrams', `${diagramId}.html`);
        const outputSvgFilePath = path.join(__dirname, 'archive', diagramId, `${diagramId}.svg`);

        // Ensure archive directory for the diagram exists
        if (!fs.existsSync(path.join(__dirname, 'archive', diagramId))) {
            fs.mkdirSync(path.join(__dirname, 'archive', diagramId), { recursive: true });
        }

        const svgMatch = htmlContent.match(new RegExp(`<svg id="${diagramId}"[^>]*>[\\s\\S]*?<\\/svg>`, 'i'));

        if (svgMatch) {
            let svgContent = svgMatch[0];
            
            // Remove fixed width and height, add preserveAspectRatio="none"
            svgContent = svgContent.replace(
                /(<svg[^>]*)\s+width="[^"]*"\s+height="[^"]*"([^>]*>)/,
                '$1 preserveAspectRatio="none"$2'
            );

            const diagramHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${diagramId} Diagram</title>
    <style>
        body { margin: 0; padding: 0; }
        svg { display: block; width: 100%; height: 100%; }
    </style>
</head>
<body>
    ${svgContent}
</body>
</html>`;

            fs.writeFile(outputHtmlFilePath, diagramHtmlContent, 'utf8', (writeErr) => {
                if (writeErr) {
                    console.error(`Error writing ${diagramId}.html:`, writeErr);
                } else {
                    console.log(`Successfully created diagrams/${diagramId}.html`);
                    // Also save the raw SVG to archive
                    fs.writeFile(outputSvgFilePath, svgContent, 'utf8', (archiveWriteErr) => {
                        if (archiveWriteErr) {
                            console.error(`Error archiving ${diagramId}.svg:`, archiveWriteErr);
                        } else {
                            console.log(`Successfully archived ${diagramId}.svg`);
                        }
                    });
                }
            });
        } else {
            console.error(`Could not find SVG with id="${diagramId}" in the HTML file.`);
        }
    });
});
