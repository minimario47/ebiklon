# Archive for R5K

This archive contains the files and a summary of the steps used to add the `R5K` railway diagram.

## Files

- `R5K.svg`: The original, clean SVG data for the R5K diagram, extracted from the source HTML.

## Steps Taken

1.  **Extraction**: The `add_diagram.js` script was used to find the `<svg id="R5K">` element in the source HTML and create the standalone `diagrams/R5K.html` file.
2.  **Layout Restructuring**: The main `index.html` was updated to support a more complex layout. A column was added to allow `R5A` and `R5K` to be stacked vertically.
3.  **Integration**: The `diagramConfig` array in the script was updated to include `R5K` and to use a new parent-based system for placing diagrams into the correct containers in the new layout.
4.  **Archiving**: The raw `R5K.svg` was extracted from its HTML file and saved here.
