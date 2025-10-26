# Archive for R59

This archive contains the files and a summary of the steps used to add the `R59` railway diagram.

## Files

- `r59.svg`: The original, clean SVG data for the R59 diagram, extracted from the source HTML.

## Steps Taken

1.  **Extraction**: The `<svg id="R59">` element was extracted from the `Titti2 - Göteborg, Skandiahamnen, Sävenäs.htm` file using a Node.js script.
2.  **Layout Update**: The main `index.html` was updated to a two-column layout to display the `R59` and `R5A` diagrams side-by-side.
3.  **SVG Embedding**: Both the `r59.svg` and `R5A.svg` were embedded directly into the `index.html` file.
4.  **Script Update**: The JavaScript was updated to locate and process both SVGs on the page, applying the same color cleaning and interactivity logic to each.
