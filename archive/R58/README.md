# Archive for R58

This archive contains the files and a summary of the steps used to add the `R58` railway diagram.

## Files

- `R58.svg`: The original, clean SVG data for the R58 diagram, extracted from the source HTML.

## Steps Taken

1.  **Extraction**: The `add_diagram.js` script was used to find the `<svg id="R58">` element in the source HTML and create the standalone `diagrams/R58.html` file.
2.  **Integration**: The main `index.html` file was updated. The `diagramConfig` array was modified to include `R58.html` at the beginning of the sequence.
3.  **Layout Adjustment**: The widths of all three diagrams in the `diagramConfig` were adjusted to `33.33%` to ensure they fit together seamlessly on the page.
4.  **Archiving**: The raw `R58.svg` was extracted and saved here. The `add_diagram.js` script was moved to the `archive/scripts/` directory.
