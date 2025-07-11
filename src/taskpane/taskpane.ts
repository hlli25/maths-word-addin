/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

// Global declarations
declare const MathJax: any;

// Equation element types
interface EquationElement {
  id: string;
  type: "text" | "fraction";
  value?: string;
  numerator?: string;
  denominator?: string;
  scaleFactor?: number;
}

// Global variables for equation builder state
let equation: EquationElement[] = [];
let cursorPosition = 0;
let isEditing = false;
let elementIdCounter = 0;

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    // Wait for MathJax to be ready before running the main logic
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
    } else {
      console.error("MathJax is not defined.");
      const statusDiv = document.getElementById("status") as HTMLDivElement;
      if (statusDiv) {
        statusDiv.textContent = "Error: Could not load MathJax.";
      }
    }
  }
});

// Initializes the add-in, sets up event listeners.
function run(): void {
  // Get references to DOM elements
  const insertButton = document.getElementById("insert-equation-button") as HTMLButtonElement;
  const clearButton = document.getElementById("clear-equation-button") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLDivElement;
  const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
  const equationDisplay = document.getElementById("equationDisplay") as HTMLDivElement;
  const buttonPanel = document.querySelector(".button-panel") as HTMLDivElement;

  // Check: ensure all critical elements are present
  if (!insertButton || !clearButton || !statusDiv || !hiddenInput || !equationDisplay || !buttonPanel) {
    console.error("One or more critical elements are missing from the DOM.");
    return;
  }

  // Set up event listeners for primary actions
  insertButton.addEventListener("click", () => insertEquationToWord(statusDiv));
  clearButton.addEventListener("click", clearEquation);

  // Set up hidden input for keyboard handling
  hiddenInput.addEventListener("keydown", handleKeyPress);
  hiddenInput.addEventListener("input", handleInput);

  // Use event delegation for builder buttons
  buttonPanel.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;

    if (button.classList.contains("fraction-btn")) {
      insertFraction();
    } else if (button.classList.contains("operator-btn")) {
      insertOperator(button.dataset.operator || "");
    }
  });

  // Handle clicks on the equation display to enter editing mode
  equationDisplay.addEventListener("click", handleDisplayClick);

  // Use event delegation for dynamic fraction inputs
  equationDisplay.addEventListener("input", handleFractionEvent);
  equationDisplay.addEventListener("keydown", handleFractionEvent);
  equationDisplay.addEventListener("focusin", handleFractionEvent);
  equationDisplay.addEventListener("focusout", handleFractionEvent);

  // Set up a click handler on the document to exit editing mode
  setupDocumentClickHandler();

  // Initialize display
  updateDisplay();
}

// Sets up a click handler on the document to exit editing mode when clicking outside the editor.
function setupDocumentClickHandler(): void {
  document.addEventListener("click", (event) => {
    const display = document.getElementById("equationDisplay");
    const buttonPanel = document.querySelector(".button-panel");
    const target = event.target as HTMLElement;

    // If we are editing and the click is outside the display and the button panel, exit editing mode.
    if (isEditing && display && !display.contains(target) && buttonPanel && !buttonPanel.contains(target)) {
      isEditing = false;
      display.classList.remove("active");
      const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
      if (hiddenInput) {
        hiddenInput.blur();
      }
      updateDisplay();
    }
  });
}

// Handles clicks on the equation display area to enable editing.
function handleDisplayClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  // Don't re-trigger if clicking on a fraction input.
  if (target.matches(".fraction-input")) {
    return;
  }

  if (!isEditing) {
    isEditing = true;
    const display = document.getElementById("equationDisplay");
    const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;

    if (display) {
      display.classList.add("active");
      updateDisplay(); // Show the cursor
    }

    if (hiddenInput) {
      hiddenInput.focus();
    }
  }
}

// Handles keyboard events for the main hidden input.
function handleKeyPress(e: KeyboardEvent): void {
  const key = e.key;

  if (key === "Backspace") {
    e.preventDefault();
    handleBackspace();
  } else if (key === "Delete") {
    e.preventDefault();
    handleDelete();
  } else if (key === "ArrowLeft") {
    e.preventDefault();
    moveCursor(-1);
  } else if (key === "ArrowRight") {
    e.preventDefault();
    moveCursor(1);
  }
}

// Handles text input from the main hidden input.
function handleInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  const char = input.value.slice(-1);
  input.value = ""; // Clear the input

  if (char && /[0-9a-zA-Z+\-=().,]/.test(char)) {
    insertTextAtCursor(char);
    updateDisplay();
  }
}

// Inserts a text or symbol element at the current cursor position.
function insertTextAtCursor(text: string): void {
  const element: EquationElement = {
    id: `element-${elementIdCounter++}`,
    type: "text",
    value: text,
  };

  equation.splice(cursorPosition, 0, element);
  cursorPosition++;

  updateParenthesesScaling();
}

// Inserts a mathematical operator into the equation.
function insertOperator(operator: string): void {
  if (!isEditing) {
    handleDisplayClick(new MouseEvent("click"));
  }

  insertTextAtCursor(operator);
  updateDisplay();

  const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
  if (hiddenInput) {
    hiddenInput.focus();
  }
}

// Inserts a fraction element into the equation.
function insertFraction(): void {
  if (!isEditing) {
    handleDisplayClick(new MouseEvent("click"));
  }

  const fraction: EquationElement = {
    id: `element-${elementIdCounter++}`,
    type: "fraction",
    numerator: "",
    denominator: "",
  };

  equation.splice(cursorPosition, 0, fraction);
  cursorPosition++;

  updateDisplay();
  updateParenthesesScaling();

  // Focus on the numerator input after it's rendered.
  setTimeout(() => {
    const fractionEl = document.querySelector(`#${fraction.id} .numerator`) as HTMLInputElement;
    if (fractionEl) {
      fractionEl.focus();
    }
  }, 50);
}

// Dynamically scales parentheses if they contain a fraction.
function updateParenthesesScaling(): void {
  const parenStack: Array<{ element: EquationElement; index: number }> = [];
  const parenPairs: Array<{
    open: { element: EquationElement; index: number };
    close: { element: EquationElement; index: number };
    content: EquationElement[];
  }> = [];

  // Reset all scale factors
  equation.forEach((el) => {
    if (el.type === "text" && /[()]/.test(el.value || "")) {
      el.scaleFactor = 1;
    }
  });

  equation.forEach((element, index) => {
    if (element.type === "text" && element.value === "(") {
      parenStack.push({ element, index });
    } else if (element.type === "text" && element.value === ")") {
      if (parenStack.length > 0) {
        const opening = parenStack.pop()!;
        parenPairs.push({
          open: opening,
          close: { element, index },
          content: equation.slice(opening.index + 1, index),
        });
      }
    }
  });

  parenPairs.forEach((pair) => {
    const hasFraction = pair.content.some((el) => el.type === "fraction");
    const scaleFactor = hasFraction ? 1.5 : 1;

    pair.open.element.scaleFactor = scaleFactor;
    pair.close.element.scaleFactor = scaleFactor;
  });
}

// Handles the 'Backspace' key press.
function handleBackspace(): void {
  if (cursorPosition > 0) {
    equation.splice(cursorPosition - 1, 1);
    cursorPosition--;
    updateDisplay();
    updateParenthesesScaling();
  }
}

// Handles the 'Delete' key press.
function handleDelete(): void {
  if (cursorPosition < equation.length) {
    equation.splice(cursorPosition, 1);
    updateDisplay();
    updateParenthesesScaling();
  }
}

// Moves the main cursor left or right.
function moveCursor(direction: number): void {
  cursorPosition = Math.max(0, Math.min(equation.length, cursorPosition + direction));
  updateDisplay();
}

// Determines the CSS size class for a fraction input based on its content length.
function getSizeClass(value: string): string {
  const length = value.toString().trim().length;
  if (length <= 2) return "size-small";
  if (length <= 4) return "size-medium";
  return "";
}

// Renders the current equation state to the display div.
function updateDisplay(): void {
  const display = document.getElementById("equationDisplay");
  if (!display) return;

  if (!isEditing && equation.length === 0) {
    display.innerHTML = '<span class="empty-state">Click here and start typing your equation</span>';
    return;
  }

  let html = "";

  equation.forEach((element, index) => {
    if (isEditing && index === cursorPosition) {
      html += '<span class="cursor"></span>';
    }

    if (element.type === "text") {
      const isOperator = /[+\-×÷=]/.test(element.value || "");
      const isParenthesis = /[()]/.test(element.value || "");
      const isVariable = /[a-zA-Z]/.test(element.value || "");

      if (isParenthesis && element.scaleFactor && element.scaleFactor > 1) {
        html += `<span class="equation-element parenthesis scaled" style="--scale-factor: ${element.scaleFactor}">${element.value}</span>`;
      } else if (isOperator) {
        html += `<span class="equation-element operator">${element.value}</span>`;
      } else if (isVariable) {
        html += `<span class="equation-element text-element" style="font-style: italic;">${element.value}</span>`;
      } else {
        html += `<span class="equation-element text-element">${element.value}</span>`;
      }
    } else if (element.type === "fraction") {
      html += `<span class="equation-element">
        <div class="fraction" id="${element.id}" data-element-id="${element.id}">
          <input type="text" 
                 class="fraction-input numerator ${getSizeClass(element.numerator || "")}" 
                 value="${element.numerator || ""}"
                 placeholder="□"
                 data-part="numerator">
          <div class="fraction-bar"></div>
          <input type="text" 
                 class="fraction-input denominator ${getSizeClass(element.denominator || "")}" 
                 value="${element.denominator || ""}"
                 placeholder="□"
                 data-part="denominator">
        </div>
      </span>`;
    }
  });

  if (isEditing && cursorPosition === equation.length) {
    html += '<span class="cursor"></span>';
  }

  display.innerHTML = html || "";

  // Update all fraction bars to match content width
  setTimeout(() => updateAllFractionBars(), 0);
}

// Event handler for all events on fraction inputs, using event delegation.
function handleFractionEvent(e: Event): void {
  const target = e.target as HTMLInputElement;
  if (!target.matches(".fraction-input")) return;

  const fractionDiv = target.closest(".fraction") as HTMLElement;
  const id = fractionDiv.dataset.elementId;
  const part = target.dataset.part as "numerator" | "denominator";

  if (!id || !part) return;

  switch (e.type) {
    case "input":
      updateFractionValue(id, part, target);
      break;
    case "keydown":
      handleFractionKeyPress(e as KeyboardEvent, id, part);
      break;
    case "focusin":
      pauseMainInput();
      break;
    case "focusout":
      resumeMainInput();
      break;
  }
}

// Updates the value of a fraction's numerator or denominator in the equation state.
function updateFractionValue(id: string, part: "numerator" | "denominator", input: HTMLInputElement): void {
  const fraction = equation.find((el) => el.id === id);
  if (fraction && fraction.type === "fraction") {
    fraction[part] = input.value;

    // Update size class for dynamic padding/font-size
    input.className = `fraction-input  ${getSizeClass(input.value)}`;

    // Update fraction bar width
    updateAllFractionBars();
  }
}

// Handles key presses within fraction inputs, e.g., for Tab navigation.
function handleFractionKeyPress(event: KeyboardEvent, id: string, part: "numerator" | "denominator"): void {
  const input = event.target as HTMLInputElement;
  const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
  const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
  const isEmpty = input.value.length === 0;

  const fractionElement = document.getElementById(id);
  if (!fractionElement) return;

  const index = equation.findIndex((el) => el.id === id);
  if (index === -1) return;

  const focusMainInput = (newCursorPosition: number) => {
    cursorPosition = newCursorPosition;
    const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
    if (hiddenInput) {
      hiddenInput.focus();
    }
    updateDisplay();
  };

  switch (event.key) {
    case "Tab":
      event.preventDefault();
      if (part === "numerator" && !event.shiftKey) {
        (fractionElement.querySelector(".denominator") as HTMLInputElement)?.focus();
      } else if (part === "denominator" && event.shiftKey) {
        (fractionElement.querySelector(".numerator") as HTMLInputElement)?.focus();
      } else if (part === "denominator" && !event.shiftKey) {
        focusMainInput(index + 1);
      }
      break;

    case "ArrowLeft":
      if (atStart) {
        event.preventDefault();
        focusMainInput(index);
      }
      break;

    case "ArrowRight":
      if (atEnd) {
        event.preventDefault();
        focusMainInput(index + 1);
      }
      break;

    case "Backspace":
      if (isEmpty && part === "numerator") {
        event.preventDefault();
        equation.splice(index, 1);
        focusMainInput(index);
        updateParenthesesScaling();
      }
      break;
  }
}

// Temporarily blurs the main hidden input when a fraction input is focused.
function pauseMainInput(): void {
  const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
  if (hiddenInput) {
    hiddenInput.blur();
  }
}

// Resumes focus on the main hidden input when a fraction input is blurred.
function resumeMainInput(): void {
  setTimeout(() => {
    if (isEditing && !document.activeElement?.classList.contains("fraction-input")) {
      const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
      if (hiddenInput) {
        hiddenInput.focus();
      }
    }
  }, 100);
}

// Adjusts the width of all fraction bars to match the wider of the numerator/denominator.
function updateAllFractionBars(): void {
  document.querySelectorAll(".fraction").forEach((fractionElement) => {
    const numerator = fractionElement.querySelector(".numerator") as HTMLElement;
    const denominator = fractionElement.querySelector(".denominator") as HTMLElement;
    const bar = fractionElement.querySelector(".fraction-bar") as HTMLElement;

    if (numerator && denominator && bar) {
      const numWidth = numerator.offsetWidth;
      const denWidth = denominator.offsetWidth;
      const maxWidth = Math.max(numWidth, denWidth, 20); // 20px minimum width

      bar.style.width = maxWidth + "px";
    }
  });
}

// Clears the equation editor state and display.
function clearEquation(): void {
  equation = [];
  cursorPosition = 0;
  isEditing = false;
  const display = document.getElementById("equationDisplay");
  if (display) {
    display.classList.remove("active");
  }
  updateDisplay();
}

// Converts the internal equation representation to a LaTeX string.
function equationToLatex(): string {
  let latex = "";

  equation.forEach((element) => {
    if (element.type === "text") {
      // Convert special operators to LaTeX commands
      let value = element.value || "";
      if (/[a-zA-Z]/.test(value)) {
        // Variables in math mode
        latex += value;
      } else if (/[+\-×÷=]/.test(value)) {
        // Operators with spacing
        latex += ` ${value} `;
      } else {
        latex += value;
      }
    } else if (element.type === "fraction") {
      const num = element.numerator || " "; // Use a space if empty for better rendering
      const den = element.denominator || " "; // Use a space if empty
      latex += `\\frac{${num}}{${den}}`;
    }
  });

  return latex.trim();
}

// The main function to render, prepare, and insert the equation into the Word document.
async function insertEquationToWord(statusDiv: HTMLDivElement): Promise<void> {
  const insertButton = document.getElementById("insert-equation-button") as HTMLButtonElement;

  if (equation.length === 0) {
    statusDiv.textContent = "Please create an equation first.";
    return;
  }

  try {
    // Disable the button and update status during processing
    insertButton.disabled = true;
    insertButton.querySelector(".ms-Button-label")!.textContent = "Inserting...";
    statusDiv.textContent = "Converting to LaTeX...";

    // Convert equation to LaTeX
    const latex = equationToLatex();
    if (!latex) {
      throw new Error("Equation is empty or invalid.");
    }
    console.log("LaTeX:", latex);

    // Render LaTeX using MathJax to get an SVG
    statusDiv.textContent = "Rendering equation...";
    const svgElement = await renderLatexToSvg(latex);

    // Prepare the SVG for insertion into Office
    statusDiv.textContent = "Preparing for Word...";
    const svgString = prepareSvgForOffice(svgElement);

    // Insert the prepared SVG into the Word document
    statusDiv.textContent = "Inserting into Word...";
    await Word.run(async (context) => {
      const selection = context.document.getSelection();

      // Convert SVG string to base64. Using a robust method that handles UTF-8.
      const base64Svg = btoa(
        encodeURIComponent(svgString).replace(/%([0-9A-F]{2})/g, (match, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      );

      // Insert as an inline picture
      selection.insertInlinePictureFromBase64(base64Svg, Word.InsertLocation.replace);

      await context.sync();
    });

    statusDiv.textContent = "Equation inserted successfully!";

    // Clear the equation after successful insertion
    clearEquation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Error inserting equation:", error);
    statusDiv.textContent = `Error: ${errorMessage}`;
  } finally {
    // Reset button state
    insertButton.disabled = false;
    insertButton.querySelector(".ms-Button-label")!.textContent = "Insert Equation";

    // Clear status message after a delay
    setTimeout(() => {
      if (!statusDiv.textContent?.includes("Error")) {
        statusDiv.textContent = "";
      }
    }, 3000);
  }
}

// Renders a LaTeX string to an SVG element using MathJax.
async function renderLatexToSvg(latex: string): Promise<SVGElement> {
  try {
    // Create a temporary, hidden container for rendering
    const tempDiv = document.getElementById("mathjax-renderer") as HTMLDivElement;
    if (!tempDiv) {
      throw new Error("MathJax renderer element not found.");
    }

    // Set the LaTeX content for MathJax to process
    tempDiv.innerHTML = `\\[${latex}\\]`;

    // Reset and typeset the new content
    MathJax.texReset();
    await MathJax.typesetPromise([tempDiv]);

    // Get the SVG element from the output
    const mjxContainer = tempDiv.querySelector("mjx-container");
    const svg = mjxContainer?.querySelector("svg");

    if (!svg) {
      throw new Error("Failed to find SVG in MathJax output.");
    }

    // Clone the SVG to detach it from the temporary div
    const svgClone = svg.cloneNode(true) as SVGElement;

    // Clean up the temporary container
    tempDiv.innerHTML = "";

    return svgClone;
  } catch (error) {
    console.error("MathJax rendering error:", error);
    throw new Error("Failed to convert equation to image. Please check the syntax.");
  }
}

// Cleans and modifies a MathJax-generated SVG to ensure compatibility with Word.
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
    throw new Error("SVG missing viewBox attribute.");
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

  // Fix thin rectangles (like fraction bars) which can render poorly
  const rects = svgClone.querySelectorAll("rect");
  rects.forEach((rect) => {
    const rectHeight = parseFloat(rect.getAttribute("height") || "0");
    const rectY = parseFloat(rect.getAttribute("y") || "0");

    if (rectHeight < vbHeight * 0.01 && rectHeight > 0) {
      const minVisibleHeight = vbHeight * 0.012;  // 1.2% of viewBox height
      const newHeight = Math.max(rectHeight, minVisibleHeight);

      const heightDiff = newHeight - rectHeight;
      const newY = rectY - heightDiff / 2;

      rect.setAttribute("height", String(newHeight));
      rect.setAttribute("y", String(newY));
    }
  });

  // Ensure all elements have a fill/stroke color, as 'currentColor' may not work in Word
  const allElements = svgClone.querySelectorAll("*");
  allElements.forEach((element) => {
    if (element.getAttribute("stroke") === "currentColor") {
      element.setAttribute("stroke", "black");
    }
    if (element.getAttribute("fill") === "currentColor") {
      element.setAttribute("fill", "black");
    }
  });

  // Add a white background to ensure visibility on dark backgrounds
  const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bgRect.setAttribute("x", String(minX));
  bgRect.setAttribute("y", String(minY));
  bgRect.setAttribute("width", String(vbWidth));
  bgRect.setAttribute("height", String(vbHeight));
  bgRect.setAttribute("fill", "white");
  svgClone.insertBefore(bgRect, svgClone.firstChild);

  // Convert <use> elements to <path> elements for better compatibility
  const defs = svgClone.querySelector("defs");
  const useElements = svgClone.querySelectorAll("use");
  useElements.forEach((useElement) => {
    const href = useElement.getAttribute("href") || useElement.getAttribute("xlink:href");
    if (href && defs) {
      const referencedId = href.replace("#", "");
      const referencedElement = defs.querySelector(`#${referencedId}`);

      if (referencedElement && referencedElement.tagName === "path") {
        const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        newPath.setAttribute("d", referencedElement.getAttribute("d") || "");
        if (useElement.hasAttribute("transform")) {
          newPath.setAttribute("transform", useElement.getAttribute("transform")!);
        }
        newPath.setAttribute("fill", "black");
        useElement.parentNode?.replaceChild(newPath, useElement);
      }
    }
  });

  // Create the final SVG string
  const svgString = new XMLSerializer().serializeToString(svgClone);

  // Add XML declaration for a standalone SVG file
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${svgString}`;
}