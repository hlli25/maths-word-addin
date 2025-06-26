/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

// Global declarations to inform TypeScript about objects provided by other scripts
declare const MathJax: any;

// Define a custom interface for the MathLive <math-field> element
interface MathFieldElement extends HTMLElement {
  value: string;
}

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    // Wait for MathJax to be ready
    if (typeof MathJax !== 'undefined' && MathJax.startup) {
      MathJax.startup.promise.then(() => {
        run();
      }).catch((error: any) => {
        console.error("MathJax failed to load:", error);
        const statusDiv = document.getElementById("status") as HTMLDivElement;
        if (statusDiv) {
          statusDiv.textContent = "Error: Could not load MathJax.";
        }
      });
    }
  }
});

function run() {
  // Get references to all necessary DOM elements
  const mathEditor = document.getElementById("math-editor") as MathFieldElement;
  const insertButton = document.getElementById("insert-equation-button") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;

  // Check: ensure all critical elements are present
  if (!mathEditor || !insertButton || !statusDiv) {
    console.error("One or more critical elements are missing from the DOM. The add-in cannot start.");
    document.body.innerHTML = "<p>Error: Missing critical elements. Please reload.</p>";
    return;
  }

  // Set a default value for the editor for demonstration purposes
  insertButton.disabled = false;
  mathEditor.value = "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}";
  insertButton.addEventListener('click', () => insertEquation(mathEditor, insertButton, statusDiv));
}

// Main function to handle the process of inserting an equation
async function insertEquation(
  mathEditor: MathFieldElement,
  insertButton: HTMLButtonElement,
  statusDiv: HTMLDivElement
): Promise<void> {
  try {
    // Disable the button and update status to prevent multiple clicks
    insertButton.disabled = true;
    insertButton.querySelector('.ms-Button-label')!.textContent = 'Inserting...';
    statusDiv.textContent = "Getting LaTeX from editor...";

    // Get the LaTeX string from the math editor
    const latex: string = mathEditor.value;
    if (!latex.trim()) {
      statusDiv.textContent = "Editor is empty. Please enter a valid LaTeX expression.";
      resetButton(insertButton, statusDiv);
      return;
    }

    // Render LaTeX using MathJax to get a clean SVG element
    statusDiv.textContent = "Rendering LaTeX...";
    const svgElement: SVGElement = await renderLatexToSvg(latex);

    // Prepare SVG for Office
    statusDiv.textContent = "Preparing SVG for Office...";
    const svgString = prepareSvgForOffice(svgElement);

    // DEBUG: Log the final SVG string to the console to inspect it.
    console.log("--- SVG DATA FOR WORD ---");
    console.log(svgString);

    // Insert the prepared SVG XML into the Word document
    statusDiv.textContent = "Inserting SVG into Word...";
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      
      // Convert SVG string to base64
      const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
      
      // Insert as inline picture
      const picture = selection.insertInlinePictureFromBase64(
        base64Svg,
        Word.InsertLocation.replace
      );
      
      // Synchronize the document state
      await context.sync();
    });

    statusDiv.textContent = "Equation inserted successfully!";

  } catch (error) {
    const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
    console.error("An unexpected error occurred:", errorMessage);
    statusDiv.textContent = `Error: ${errorMessage}`;
  } finally {
    resetButton(insertButton, statusDiv);
  }
}

/* Renders a LaTeX string to an SVG element using MathJax
 * @param latex The LaTeX string to render
 * @returns A Promise that resolves to an SVGElement
 */
async function renderLatexToSvg(latex: string): Promise<SVGElement> {
  try {
    // Create a temporary container
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.fontSize = '20px'; // Base font size
    document.body.appendChild(tempDiv);
    
    // Set the LaTeX content
    tempDiv.innerHTML = `\\[${latex}\\]`;
    
    // Clear MathJax's cache
    MathJax.texReset();
    
    // Typeset the element
    await MathJax.typesetPromise([tempDiv]);
    
    // Get the SVG element
    const mjxContainer = tempDiv.querySelector('.MathJax, mjx-container');
    const svg = mjxContainer?.querySelector('svg');
    
    if (!svg) {
      throw new Error("Failed to find SVG in MathJax output");
    }
    
    // Clone the SVG to detach it from MathJax's management
    const svgClone = svg.cloneNode(true) as SVGElement;
    
    // Clean up
    document.body.removeChild(tempDiv);
    
    return svgClone;
  } catch (error) {
    console.error("MathJax rendering error:", error);
    throw new Error("Failed to convert LaTeX to SVG. Please check the syntax.");
  }
}

// Prepares SVG for Office and returns the SVG string
function prepareSvgForOffice(svg: SVGElement): string {
  // Clone to avoid modifying the original
  const svgClone = svg.cloneNode(true) as SVGElement;
  
  // Add the standard SVG namespace
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  
  // Remove MathJax-specific attributes
  svgClone.removeAttribute("focusable");
  svgClone.removeAttribute("aria-hidden");
  svgClone.removeAttribute("role");
  svgClone.removeAttribute("style");
  
  // Get current viewBox and dimensions
  const viewBox = svgClone.getAttribute("viewBox");
  if (!viewBox) {
    throw new Error("SVG missing viewBox attribute. Please ensure the LaTeX is valid.");
  }

    const [minX, minY, vbWidth, vbHeight] = viewBox.split(" ").map(parseFloat);
    
    // Calculate width and height
    const scaleFactor = 0.015;
    let width = Math.round(vbWidth * scaleFactor);
    let height = Math.round(vbHeight * scaleFactor);
    
    // Ensure minimum dimensions
    if (width < 30) {
      const scale = 30 / width;
      width = 30;
      height = Math.round(height * scale);
    }
    
    // Ensure maximum dimensions
    if (width > 100) {
      const scale = 100 / width;
      width = 100;
      height = Math.round(height * scale);
    }
  
  // Set proper dimensions
  svgClone.setAttribute("width", String(width));
  svgClone.setAttribute("height", String(height));
  
  // Fix thin rectangles (fraction bars, square root lines)
  const rects = svgClone.querySelectorAll("rect");
  rects.forEach((rect) => {
    // Skip background rectangles
    if (rect.getAttribute("fill") === "white" && rect.getAttribute("width") === "100%") {
      return;
    }
    
    const rectHeight = parseFloat(rect.getAttribute("height") || "0");
    const rectY = parseFloat(rect.getAttribute("y") || "0");
    
    // If it's a thin horizontal line (height less than 1% of viewBox height)
    if (rectHeight < vbHeight * 0.01 && rectHeight > 0) {
      // Calculate minimum visible height based on the scale
      const minVisibleHeight = vbHeight * 0.012; // 1.2% of viewBox height
      const newHeight = Math.max(rectHeight, minVisibleHeight);
      
      // Adjust the rectangle to center it
      const heightDiff = newHeight - rectHeight;
      const newY = rectY - heightDiff / 2;
      
      rect.setAttribute("height", String(newHeight));
      rect.setAttribute("y", String(newY));
    }
  });
  
  // Process path elements to ensure stroke widths are visible
  const paths = svgClone.querySelectorAll("path");
  paths.forEach((path) => {
    // Ensure fill color
    if (!path.getAttribute("fill") || path.getAttribute("fill") === "currentColor") {
      path.setAttribute("fill", "black");
    }
    
    // If the path has a stroke, ensure it's visible
    const strokeWidth = path.getAttribute("stroke-width");
    if (strokeWidth && parseFloat(strokeWidth) > 0) {
      // Set minimum stroke width
      const minStroke = vbHeight * 0.002; // 0.2% of viewBox height
      if (parseFloat(strokeWidth) < minStroke) {
        path.setAttribute("stroke-width", String(minStroke));
      }
    }
  });
  
  // Fix the stroke color for all elements
  const allElements = svgClone.querySelectorAll("*");
  allElements.forEach((element) => {
    if (element.getAttribute("stroke") === "currentColor") {
      element.setAttribute("stroke", "black");
    }
    if (element.getAttribute("fill") === "currentColor") {
      element.setAttribute("fill", "black");
    }
  });
  
  // Add a white background rectangle
  const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bgRect.setAttribute("x", String(minX));
  bgRect.setAttribute("y", String(minY));
  bgRect.setAttribute("width", String(vbWidth));
  bgRect.setAttribute("height", String(vbHeight));
  bgRect.setAttribute("fill", "white");
  svgClone.insertBefore(bgRect, svgClone.firstChild);
  
  // Get the defs element from MathJax (contains font definitions)
  const defs = svgClone.querySelector("defs");
  
  // Convert use elements to path elements
  const useElements = svgClone.querySelectorAll("use");
  useElements.forEach((useElement) => {
    const href = useElement.getAttribute("href") || useElement.getAttribute("xlink:href");
    if (href && defs) {
      const referencedId = href.replace("#", "");
      const referencedElement = defs.querySelector(`#${referencedId}`);
      
      if (referencedElement && referencedElement.tagName === "path") {
        const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        
        // Copy the path data
        const d = referencedElement.getAttribute("d");
        if (d) {
          newPath.setAttribute("d", d);
        }
        
        // Copy transform from use element
        const transform = useElement.getAttribute("transform");
        if (transform) {
          newPath.setAttribute("transform", transform);
        }
        
        // Set fill color
        newPath.setAttribute("fill", "black");
        
        // Copy data attributes
        Array.from(useElement.attributes).forEach(attr => {
          if (attr.name.startsWith("data-")) {
            newPath.setAttribute(attr.name, attr.value);
          }
        });
        
        // Replace use with path
        useElement.parentNode?.replaceChild(newPath, useElement);
      }
    }
  });
  
  // Create the final SVG string
  const svgString = new XMLSerializer().serializeToString(svgClone);
  
  // Add XML declaration
  return `<?xml version="1.0" encoding="UTF-8"?>${svgString}`;
}

// Resets the insert button to its initial state
function resetButton(insertButton: HTMLButtonElement, statusDiv: HTMLDivElement): void {
  insertButton.disabled = false;
  const buttonLabel = insertButton.querySelector('.ms-Button-label');
  if (buttonLabel) buttonLabel.textContent = 'Insert Equation';

  // Clear the status message after a few seconds if it is not an error
  setTimeout(() => {
    if (!statusDiv.textContent?.toLowerCase().includes("error")) {
      statusDiv.textContent = "";
    }
  }, 4000);
}