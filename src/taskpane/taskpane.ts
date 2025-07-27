/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

// Global declarations
declare const MathJax: any;

// Equation element types
interface EquationElement {
  id: string;
  type: "text" | "fraction" | "sqrt" | "script";
  value?: string;
  // for fraction
  numerator?: EquationElement[];
  denominator?: EquationElement[];
  // for sqrt
  radicand?: EquationElement[];
  // for script
  base?: EquationElement[];
  superscript?: EquationElement[];
  subscript?: EquationElement[];
  scaleFactor?: number;
}

// Global variables for equation builder state
let equation: EquationElement[] = [];
let activeContextPath: string | null = null;
let cursorPosition = 0;
let elementIdCounter = 0;

// Selection tracking for equation loading
let lastSelectedImageId: string | null = null;

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    // Wait for MathJax to be ready before running the main logic
    if (typeof MathJax !== "undefined" && MathJax.startup) {
      MathJax.startup.promise
        .then(() => {
          run();
        })
        .catch((error: any) => {
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
  const tabNav = document.querySelector(".tab-nav") as HTMLDivElement;
  const tabContent = document.querySelector(".tab-content") as HTMLDivElement;

  // Check: ensure all critical elements are present
  if (
    !insertButton ||
    !clearButton ||
    !statusDiv ||
    !hiddenInput ||
    !equationDisplay ||
    !tabNav ||
    !tabContent
  ) {
    console.error("One or more critical elements are missing from the DOM.");
    return;
  }

  // Set up event listeners for primary actions
  insertButton.addEventListener("click", () => insertEquationToWord(statusDiv));
  clearButton.addEventListener("click", clearEquation);

  // Set up hidden input for keyboard handling
  hiddenInput.addEventListener("keydown", handleKeyPress);
  hiddenInput.addEventListener("input", handleInput);

  // Use event delegation for builder buttons within the tab content
  tabContent.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest("button.builder-btn");
    if (!button) return;

    if (button.classList.contains("fraction-btn")) {
      insertFraction();
    } else if (button.classList.contains("operator-btn")) {
      insertOperator(button.dataset.operator || "");
    } else if (button.classList.contains("sqrt-btn")) {
      insertSquareRoot();
    } else if (button.classList.contains("sup-btn")) {
      insertScript("superscript");
    } else if (button.classList.contains("sub-btn")) {
      insertScript("subscript");
    }
  });

  // Set up event listener for tab navigation
  tabNav.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest(".tab-btn");
    if (!button) return;

    const tabId = button.dataset.tab;
    if (!tabId) return;

    // Deactivate all tabs and panes
    tabNav.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));

    // Activate the clicked tab and its corresponding pane
    button.classList.add("active");
    const activePane = document.getElementById(tabId);
    if (activePane) {
      activePane.classList.add("active");
    }
  });

  // Handle clicks on the equation display to enter editing mode
  equationDisplay.addEventListener("click", handleDisplayClick);

  // Set up a click handler on the document to exit editing mode
  setupDocumentClickHandler();

  // Set up selection handler for equation images in Word
  setupEquationImageHandler();

  // Initialize display
  updateDisplay();
}

// Sets up a click handler on the document to exit editing mode when clicking outside the editor.
function setupDocumentClickHandler(): void {
  document.addEventListener("click", (event) => {
    const display = document.getElementById("equationDisplay");
    const tabPanel = document.querySelector(".tab-panel");
    const target = event.target as HTMLElement;

    // If we are editing and the click is outside the display and the button panel, exit editing mode
    if (
      activeContextPath &&
      display &&
      !display.contains(target) &&
      tabPanel &&
      !tabPanel.contains(target)
    ) {
      activeContextPath = null;
      const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
      if (hiddenInput) {
        hiddenInput.blur();
      }
      updateDisplay();
    }
  });
}

// Sets up event handler for detecting selection of equation images in Word
function setupEquationImageHandler(): void {
  // Set up event handler to detect selection changes in Word
  Office.context.document.addHandlerAsync(
    Office.EventType.DocumentSelectionChanged,
    handleSelectionChange
  );
}

// Handles selection changes to automatically load equation images for editing
async function handleSelectionChange(): Promise<void> {
  try {
    await Word.run(async (context) => {
      const selection = context.document.getSelection();
      selection.load("inlinePictures");
      await context.sync();

      // Check if selection contains an inline picture (equation image)
      if (selection.inlinePictures.items.length > 0) {
        const picture = selection.inlinePictures.items[0];
        picture.load("altTextDescription");
        await context.sync();

        const altText = picture.altTextDescription;
        
        if (altText && altText.trim()) {
          // Check if this is a LaTeX equation (basic validation)
          if (isValidLatex(altText)) {
            // Create a unique identifier for this image (using alt text as proxy)
            const imageId = altText;
            
            // Only load if this is a different equation than the last one
            if (lastSelectedImageId !== imageId) {
              const statusDiv = document.getElementById("status") as HTMLDivElement;
              if (statusDiv) {
                statusDiv.textContent = "Equation selected. Loading for editing...";
              }
              
              await loadEquationFromLatex(altText);
              lastSelectedImageId = imageId;
            }
          }
        }
      } else {
        // No image selected, reset tracking
        lastSelectedImageId = null;
      }
    });
  } catch (error) {
    console.log("Selection change handler error:", error);
  }
}

// Basic validation to check if the alt text looks like LaTeX
function isValidLatex(text: string): boolean {
  // Check for common LaTeX patterns
  return text.includes("\\") || text.includes("{") || text.includes("}");
}

// Converts LaTeX back to internal equation structure and loads it for editing
async function loadEquationFromLatex(latex: string): Promise<void> {
  try {
    const parsedEquation = parseLatexToEquation(latex);
    if (parsedEquation) {
      equation = parsedEquation;
      activeContextPath = "root";
      cursorPosition = equation.length;
      updateDisplay();
      
      // Focus the hidden input for editing
      const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
      if (hiddenInput) {
        hiddenInput.focus();
      }

      const statusDiv = document.getElementById("status") as HTMLDivElement;
      if (statusDiv) {
        statusDiv.textContent = "Equation loaded for editing!";
        setTimeout(() => {
          statusDiv.textContent = "";
        }, 3000);
      }
    }
  } catch (error) {
    console.error("Error loading equation from LaTeX:", error);
    const statusDiv = document.getElementById("status") as HTMLDivElement;
    if (statusDiv) {
      statusDiv.textContent = "Error loading equation for editing.";
      setTimeout(() => {
        statusDiv.textContent = "";
      }, 3000);
    }
  }
}

// Parses LaTeX back to internal equation structure
function parseLatexToEquation(latex: string): EquationElement[] {
  const result: EquationElement[] = [];
  let i = 0;

  while (i < latex.length) {
    if (latex.substr(i, 5) === "\\frac") {
      // Parse fraction: \frac{num}{den}
      i += 5;
      const numerator = parseLatexGroup(latex, i);
      i = numerator.endIndex;
      const denominator = parseLatexGroup(latex, i);
      i = denominator.endIndex;

      result.push({
        id: `element-${elementIdCounter++}`,
        type: "fraction",
        numerator: parseLatexToEquation(numerator.content),
        denominator: parseLatexToEquation(denominator.content)
      });
    } else if (latex.substr(i, 5) === "\\sqrt") {
      // Parse square root: \sqrt{content}
      i += 5;
      const radicand = parseLatexGroup(latex, i);
      i = radicand.endIndex;

      result.push({
        id: `element-${elementIdCounter++}`,
        type: "sqrt",
        radicand: parseLatexToEquation(radicand.content)
      });
    } else if (latex[i] === "^" || latex[i] === "_") {
      // Handle superscript/subscript
      const isSuper = latex[i] === "^";
      i++;
      
      // Get the base from the previous element or create one
      let baseElement: EquationElement;
      if (result.length > 0 && result[result.length - 1].type === "script") {
        baseElement = result.pop()!;
      } else if (result.length > 0) {
        const lastElement = result.pop()!;
        baseElement = {
          id: `element-${elementIdCounter++}`,
          type: "script",
          base: [lastElement],
          superscript: undefined,
          subscript: undefined
        };
      } else {
        baseElement = {
          id: `element-${elementIdCounter++}`,
          type: "script",
          base: [],
          superscript: undefined,
          subscript: undefined
        };
      }

      const scriptContent = parseLatexGroup(latex, i);
      i = scriptContent.endIndex;

      if (isSuper) {
        baseElement.superscript = parseLatexToEquation(scriptContent.content);
      } else {
        baseElement.subscript = parseLatexToEquation(scriptContent.content);
      }

      result.push(baseElement);
    } else if (latex[i] === "{") {
      // Parse group
      const group = parseLatexGroup(latex, i);
      i = group.endIndex;
      result.push(...parseLatexToEquation(group.content));
    } else if (latex[i] === " ") {
      // Skip spaces
      i++;
    } else if (latex.substr(i, 6) === "\\times") {
      result.push({
        id: `element-${elementIdCounter++}`,
        type: "text",
        value: "×"
      });
      i += 6;
    } else if (latex.substr(i, 4) === "\\div") {
      result.push({
        id: `element-${elementIdCounter++}`,
        type: "text",
        value: "÷"
      });
      i += 4;
    } else {
      // Regular character
      result.push({
        id: `element-${elementIdCounter++}`,
        type: "text",
        value: latex[i]
      });
      i++;
    }
  }

  return result;
}

// Helper function to parse a LaTeX group {...}
function parseLatexGroup(latex: string, startIndex: number): { content: string; endIndex: number } {
  if (latex[startIndex] !== "{") {
    // Single character
    return {
      content: latex[startIndex] || "",
      endIndex: startIndex + 1
    };
  }

  let braceCount = 0;
  let i = startIndex;
  
  while (i < latex.length) {
    if (latex[i] === "{") {
      braceCount++;
    } else if (latex[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        return {
          content: latex.substring(startIndex + 1, i),
          endIndex: i + 1
        };
      }
    }
    i++;
  }

  // Unclosed brace - return what we have
  return {
    content: latex.substring(startIndex + 1),
    endIndex: latex.length
  };
}

// Handles clicks on the equation display area to enable editing.
function handleDisplayClick(e: MouseEvent): void {
  e.stopPropagation();
  const target = e.target as HTMLElement;
  const equationContainer = target.closest(".equation-container") as HTMLElement;

  if (equationContainer) {
    const path = equationContainer.dataset.contextPath;
    if (path) {
      activeContextPath = path;
      const context = getContext(activeContextPath);
      if (context) {
        // A simple way to set cursor position: place it at the end of the clicked container.
        // A more complex implementation could calculate the index based on click coordinates.
        cursorPosition = context.array.length;
      }
    } else {
      // Clicked on the main display which doesn't have a path, so activate the root context.
      activeContextPath = "root";
      cursorPosition = equation.length;
    }
  } else {
    // Clicked on something else inside the display, default to root context
    activeContextPath = "root";
    cursorPosition = equation.length;
  }

  const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
  if (hiddenInput) {
    hiddenInput.focus();
  }
  updateDisplay();
}

// Recursively finds an element by its ID within a nested structure.
function findElementById(elements: EquationElement[], id: string): EquationElement | null {
  for (const el of elements) {
    if (el.id === id) return el;
    if (el.type === "fraction") {
      const found = findElementById(el.numerator!, id) || findElementById(el.denominator!, id);
      if (found) return found;
    }
    if (el.type === "sqrt") {
      const found = findElementById(el.radicand!, id);
      if (found) return found;
    }
    if (el.type === "script") {
      const found =
        findElementById(el.base || [], id) ||
        findElementById(el.superscript || [], id) ||
        findElementById(el.subscript || [], id);
      if (found) return found;
    }
  }
  return null;
}

// Finds the context (the array of elements) based on a path string.
function getContext(
  path: string
): { array: EquationElement[]; parent: EquationElement | null } | null {
  if (path === "root") {
    return { array: equation, parent: null };
  }
  const parts = path.split("/"); // e.g., ["root", "el1", "numerator"]
  const containerName = parts.pop()!;
  const elementId = parts.pop()!;

  const element = findElementById(equation, elementId);
  if (!element) return null;

  const array = element[containerName as keyof EquationElement] as EquationElement[] | undefined;
  return array ? { array, parent: element } : null;
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
  } else if (key === "ArrowUp" || key === "ArrowDown") {
    e.preventDefault();
    navigateUpDown(key);
  } else if (key === "Tab") {
    e.preventDefault();
    navigateUpDown(e.shiftKey ? "ArrowUp" : "ArrowDown");
  }
}

// Handles text input from the main hidden input.
function handleInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  const char = input.value.slice(-1);
  input.value = ""; // Clear the input

  if (activeContextPath && char && /[0-9a-zA-Z+\-=().,]/.test(char)) {
    insertTextAtCursor(char);
    updateDisplay();
  }
}

// Inserts a text or symbol element at the current cursor position.
function insertTextAtCursor(text: string): void {
  if (!activeContextPath) return;
  const context = getContext(activeContextPath);
  if (!context) return;

  const element: EquationElement = {
    id: `element-${elementIdCounter++}`,
    type: "text",
    value: text,
  };

  context.array.splice(cursorPosition, 0, element);
  cursorPosition++;

  updateAllParenthesesScaling();
}

// Inserts a mathematical operator into the equation.
function insertOperator(operator: string): void {
  if (!activeContextPath) {
    activeContextPath = "root";
    cursorPosition = equation.length;
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
  if (!activeContextPath) {
    activeContextPath = "root";
    cursorPosition = equation.length;
  }
  const context = getContext(activeContextPath);
  if (!context) return;

  const fraction: EquationElement = {
    id: `element-${elementIdCounter++}`,
    type: "fraction",
    numerator: [],
    denominator: [],
  };

  context.array.splice(cursorPosition, 0, fraction);
  cursorPosition++;

  // Move context into the new fraction's numerator
  activeContextPath = `${activeContextPath}/${fraction.id}/numerator`;
  cursorPosition = 0;

  updateDisplay();
  updateAllParenthesesScaling();
}

// Inserts a square root element into the equation.
function insertSquareRoot(): void {
  if (!activeContextPath) {
    activeContextPath = "root";
    cursorPosition = equation.length;
  }
  const context = getContext(activeContextPath);
  if (!context) return;

  const sqrtElement: EquationElement = {
    id: `element-${elementIdCounter++}`,
    type: "sqrt",
    radicand: [],
  };

  context.array.splice(cursorPosition, 0, sqrtElement);

  // Move context into the new sqrt's radicand
  activeContextPath = `${activeContextPath}/${sqrtElement.id}/radicand`;
  cursorPosition = 0;

  updateDisplay();
}

// Inserts a script element (superscript or subscript) into the equation.
function insertScript(type: "superscript" | "subscript"): void {
  if (!activeContextPath) {
    activeContextPath = "root";
    cursorPosition = equation.length;
  }
  const context = getContext(activeContextPath);
  if (!context) return;

  // Always create a new script element (don't extend existing ones)
  // Ensures superscript and subscript buttons create separate elements
  const scriptElement: EquationElement = {
    id: `element-${elementIdCounter++}`,
    type: "script",
    base: [],
    superscript: type === "superscript" ? [] : undefined,
    subscript: type === "subscript" ? [] : undefined,
  };

  context.array.splice(cursorPosition, 0, scriptElement);

  // Move context into the new script's base first, so user can see both blocks
  activeContextPath = `${activeContextPath}/${scriptElement.id}/base`;
  cursorPosition = 0;

  updateDisplay();
}

// Dynamically scales parentheses if they contain a fraction.
function updateAllParenthesesScaling(): void {
  function recurse(elements: EquationElement[]) {
    const parenStack: Array<{ element: EquationElement; index: number }> = [];
    const parenPairs: Array<{
      open: { element: EquationElement; index: number };
      close: { element: EquationElement; index: number };
      content: EquationElement[];
    }> = [];

    elements.forEach((el) => {
      if (el.type === "text" && /[()]/.test(el.value || "")) {
        el.scaleFactor = 1;
      } else if (el.type === "fraction") {
        recurse(el.numerator);
        recurse(el.denominator);
      } else if (el.type === "sqrt") {
        recurse(el.radicand!);
      } else if (el.type === "script") {
        recurse(el.base!);
        if (el.superscript) recurse(el.superscript);
        if (el.subscript) recurse(el.subscript);
      }
    });

    elements.forEach((element, index) => {
      if (element.type === "text" && element.value === "(") {
        parenStack.push({ element, index });
      } else if (element.type === "text" && element.value === ")") {
        if (parenStack.length > 0) {
          const opening = parenStack.pop()!;
          parenPairs.push({
            open: opening,
            close: { element, index },
            content: elements.slice(opening.index + 1, index),
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
  recurse(equation);
}

// Handles the 'Backspace' key press.
function handleBackspace(): void {
  if (!activeContextPath) return;
  const context = getContext(activeContextPath);
  if (!context) return;

  if (cursorPosition > 0) {
    context.array.splice(cursorPosition - 1, 1);
    cursorPosition--;
    updateDisplay();
    updateAllParenthesesScaling();
  } else if (activeContextPath !== "root") {
    // At the start of a sub-context, navigate out
    navigateOutOfContext("backward");
  }
}

// Handles the 'Delete' key press.
function handleDelete(): void {
  if (!activeContextPath) return;
  const context = getContext(activeContextPath);
  if (!context) return;

  if (cursorPosition < context.array.length) {
    context.array.splice(cursorPosition, 1);
    updateDisplay();
    updateAllParenthesesScaling();
  }
}

// Moves the main cursor left or right.
function moveCursor(direction: number): void {
  if (!activeContextPath) return;
  const context = getContext(activeContextPath);
  if (!context) return;

  const newPosition = cursorPosition + direction;
  if (newPosition >= 0 && newPosition <= context.array.length) {
    cursorPosition = newPosition;
    updateDisplay();
  } else if (activeContextPath !== "root") {
    // At the start/end of a sub-context, navigate out
    navigateOutOfContext(direction === 1 ? "forward" : "backward");
  }
}

// Renders the current equation state to the display div.
function updateDisplay(): void {
  const display = document.getElementById("equationDisplay");
  if (!display) return;

  if (activeContextPath === null && equation.length === 0) {
    display.innerHTML =
      '<span class="empty-state">Click here and start typing your equation</span>';
    display.classList.remove("active");
    return;
  }

  display.classList.toggle("active", activeContextPath !== null);
  display.innerHTML = buildEquationHtml(equation, "root");

  // After rendering, ensure all fraction bars are correctly sized
  setTimeout(() => updateAllFractionBars(), 0);
  // Also ensure the hidden input is focused if we are in an active context
  if (activeContextPath) {
    (document.getElementById("hiddenInput") as HTMLInputElement)?.focus();
  }
}

// Recursively builds the HTML for the equation.
function buildEquationHtml(elements: EquationElement[], contextPath: string): string {
  let html = "";
  const isActive = contextPath === activeContextPath;

  elements.forEach((element, index) => {
    if (isActive && index === cursorPosition) {
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
      const numeratorPath = `${contextPath}/${element.id}/numerator`;
      const denominatorPath = `${contextPath}/${element.id}/denominator`;
      html += `<span class="equation-element">
        <div class="fraction" id="${element.id}">
          <div class="equation-container numerator-container ${
            activeContextPath === numeratorPath ? "active-context" : ""
          }" data-context-path="${numeratorPath}">
            ${buildEquationHtml(element.numerator, numeratorPath)}
          </div>
          <div class="fraction-bar"></div>
          <div class="equation-container denominator-container ${
            activeContextPath === denominatorPath ? "active-context" : ""
          }" data-context-path="${denominatorPath}">
            ${buildEquationHtml(element.denominator, denominatorPath)}
          </div>
        </div>
      </span>`;
    } else if (element.type === "sqrt") {
      const radicandPath = `${contextPath}/${element.id}/radicand`;
      html += `<span class="equation-element">
        <div class="sqrt" id="${element.id}">
          <span class="sqrt-symbol">√</span>
          <div class="sqrt-radicand">
            <div class="equation-container ${
              activeContextPath === radicandPath ? "active-context" : ""
            }" data-context-path="${radicandPath}">
              ${buildEquationHtml(element.radicand!, radicandPath)}
            </div>
          </div>
        </div>
      </span>`;
    } else if (element.type === "script") {
      const basePath = `${contextPath}/${element.id}/base`;
      const supPath = `${contextPath}/${element.id}/superscript`;
      const subPath = `${contextPath}/${element.id}/subscript`;
      html += `<span class="equation-element">
        <div class="script-container" id="${element.id}">
          <div class="equation-container base-container ${activeContextPath === basePath ? "active-context" : ""}" data-context-path="${basePath}">${buildEquationHtml(element.base!, basePath)}</div>
          <div class="script-subsup">
            ${element.superscript !== undefined ? `<div class="equation-container superscript-container ${activeContextPath === supPath ? "active-context" : ""}" data-context-path="${supPath}">${buildEquationHtml(element.superscript, supPath)}</div>` : ""}
            ${element.subscript !== undefined ? `<div class="equation-container subscript-container ${activeContextPath === subPath ? "active-context" : ""}" data-context-path="${subPath}">${buildEquationHtml(element.subscript, subPath)}</div>` : ""}
          </div>
        </div></span>`;
    }
  });

  if (isActive && cursorPosition === elements.length) {
    html += '<span class="cursor"></span>';
  }

  // If the container is empty and active, show a placeholder cursor
  if (isActive && elements.length === 0 && html.indexOf("cursor") === -1) {
    html += '<span class="cursor"></span>';
  }

  return html;
}

// Navigates between numerator and denominator, or out of the fraction.
function navigateUpDown(key: "ArrowUp" | "ArrowDown") {
  if (!activeContextPath || activeContextPath === "root") return;

  const parts = activeContextPath.split("/"); // e.g., ["root", "el1", "numerator"]
  const currentPart = parts.pop()!;
  const elementId = parts[parts.length - 1];
  const parentPath = parts.slice(0, -1).join("/");

  const context = getContext(activeContextPath);
  if (!context || !context.parent) return;
  const parentElement = context.parent;

  if (parentElement.type === "fraction") {
    if (key === "ArrowDown" && currentPart === "numerator") {
      activeContextPath = `${parentPath}/${elementId}/denominator`;
      cursorPosition = 0;
    } else if (key === "ArrowUp" && currentPart === "denominator") {
      activeContextPath = `${parentPath}/${elementId}/numerator`;
      cursorPosition = 0;
    } else {
      navigateOutOfContext(key === "ArrowDown" ? "forward" : "backward");
    }
  } else if (parentElement.type === "script") {
    if (key === "ArrowDown") {
      if (currentPart === "base" && parentElement.superscript) {
        activeContextPath = `${parentPath}/${elementId}/superscript`;
        cursorPosition = 0;
      } else if (currentPart === "superscript" && parentElement.subscript) {
        activeContextPath = `${parentPath}/${elementId}/subscript`;
        cursorPosition = 0;
      } else {
        navigateOutOfContext("forward");
      }
    } else if (key === "ArrowUp") {
      if (currentPart === "subscript" && parentElement.superscript) {
        activeContextPath = `${parentPath}/${elementId}/superscript`;
        cursorPosition = 0;
      } else if (currentPart === "superscript" && parentElement.base) {
        activeContextPath = `${parentPath}/${elementId}/base`;
        cursorPosition = parentElement.base.length;
      } else {
        navigateOutOfContext("backward");
      }
    }
  } else {
    // For sqrt and other simple containers, just navigate out
    navigateOutOfContext(key === "ArrowDown" ? "forward" : "backward");
  }
  updateDisplay();
}

// Moves the cursor from a sub-context (like a numerator) to the parent context.
function navigateOutOfContext(direction: "forward" | "backward") {
  if (!activeContextPath || activeContextPath === "root") return;

  const parts = activeContextPath.split("/");
  parts.pop(); // remove part name (numerator/denominator)
  const elementId = parts.pop();
  const parentPath = parts.join("/");

  const parentContext = getContext(parentPath);
  if (!parentContext || !elementId) return;

  const elementIndex = parentContext.array.findIndex((el) => el.id === elementId);
  if (elementIndex === -1) return;

  activeContextPath = parentPath;
  cursorPosition = direction === "forward" ? elementIndex + 1 : elementIndex;
  updateDisplay();
}

// Adjusts the width of all fraction bars to match the wider of the numerator/denominator.
function updateAllFractionBars(): void {
  document.querySelectorAll(".fraction").forEach((fractionElement) => {
    const numerator = fractionElement.querySelector(".numerator-container") as HTMLElement;
    const denominator = fractionElement.querySelector(".denominator-container") as HTMLElement;
    const bar = fractionElement.querySelector(".fraction-bar") as HTMLElement;

    if (numerator && denominator && bar) {
      // scrollWidth is more reliable for content width than offsetWidth
      const numWidth = numerator.scrollWidth;
      const denWidth = denominator.scrollWidth;
      const maxWidth = Math.max(numWidth, denWidth, 20); // 20px minimum width

      bar.style.width = maxWidth + "px";
    }
  });
}

// Clears the equation editor state and display.
function clearEquation(): void {
  equation = [];
  cursorPosition = 0;
  activeContextPath = null;
  updateDisplay();
}

// Converts the internal equation representation to a LaTeX string.
function equationToLatex(): string {
  function toLatexRecursive(elements: EquationElement[]): string {
    let latex = "";
    elements.forEach((element) => {
      if (element.type === "text") {
        let value = element.value || "";
        if (value === "×") value = "\\times";
        if (value === "÷") value = "\\div";

        if (/[a-zA-Z]/.test(value)) {
          latex += value;
        } else if (/[+\-=\\times\\div]/.test(value)) {
          latex += ` ${value} `;
        } else {
          latex += value;
        }
      } else if (element.type === "fraction") {
        const num = toLatexRecursive(element.numerator);
        const den = toLatexRecursive(element.denominator);
        latex += `\\frac{${num || " "}}{${den || " "}}`;
      } else if (element.type === "sqrt") {
        const radicand = toLatexRecursive(element.radicand!);
        latex += `\\sqrt{${radicand || " "}}`;
      } else if (element.type === "script") {
        const base = toLatexRecursive(element.base!);
        latex += `{${base || " "}}`;
        if (element.superscript && element.subscript) {
          // Handle both superscript and subscript
          latex += `^{${toLatexRecursive(element.superscript) || " "}}_{${toLatexRecursive(element.subscript) || " "}}`;
        } else if (element.superscript) {
          latex += `^{${toLatexRecursive(element.superscript) || " "}}`;
        } else if (element.subscript) {
          latex += `_{${toLatexRecursive(element.subscript) || " "}}`;
        }
      }
    });
    return latex;
  }
  return toLatexRecursive(equation).trim();
}

// The main function to render, prepare, and insert the equation into the Word document.
async function insertEquationToWord(statusDiv: HTMLDivElement): Promise<void> {
  const insertButton = document.getElementById("insert-equation-button") as HTMLButtonElement;
  const fontSize = 12; // Default font size in points (pt)

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

    // Extract positioning information before processing
    const positionInfo = extractSvgPositionInfo(svgElement);
    console.log("SVG Position Info:", positionInfo);

    // Prepare the SVG for insertion into Office
    statusDiv.textContent = "Preparing for Word...";
    const { svgString, width, height, baselineOffsetPt } = prepareSvgForOffice(svgElement, fontSize, positionInfo);
    
    // Debug: Show positioning information
    console.log("Calculated baseline offset:", baselineOffsetPt, "pt");
    console.log("Has main fraction bar:", !!positionInfo.mainFractionBar);
    if (positionInfo.mainFractionBar) {
      console.log("Main fraction bar Y:", positionInfo.mainFractionBar.y);
    }

    // Insert the prepared SVG into the Word document
    statusDiv.textContent = "Inserting into Word...";
    await Word.run(async (context) => {
      const selection = context.document.getSelection();

      // Convert SVG string to base64
      const base64Svg = btoa(
        encodeURIComponent(svgString).replace(/%([0-9A-F]{2})/g, (match, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      );

      // Insert the image with positioning using OOXML
      const ooxml = createInlineImageWithPositionOoxml(base64Svg, width, height, baselineOffsetPt, latex);
      selection.insertOoxml(ooxml, Word.InsertLocation.replace);
      await context.sync();
    });

    statusDiv.textContent = `Equation inserted.`;

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
function prepareSvgForOffice(
  svg: SVGElement,
  targetPtSize: number,
  positionInfo?: {
    baseline: number;
    fractionBars: Array<{ y: number; width: number; height: number; x: number; isMain: boolean }>;
    mainFractionBar: { y: number; width: number; height: number; x: number } | null;
    totalHeight: number;
    totalWidth: number;
  }
): { svgString: string; width: number; height: number; baselineOffsetPt: number } {
  // Clone to avoid modifying the original
  const svgClone = svg.cloneNode(true) as SVGElement;

  // Add the standard SVG namespace
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // Extract baseline information from MathJax before removing style
  const originalStyle = svgClone.getAttribute("style") || "";
  let baselineOffset = 0;

  // Parse vertical-align from MathJax style (typically in ex units)
  const verticalAlignMatch = originalStyle.match(/vertical-align:\s*([-\d.]+)ex/);
  if (verticalAlignMatch) {
    baselineOffset = parseFloat(verticalAlignMatch[1]);
  }

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
  
  // Adjust the viewBox to account for baseline positioning
  let adjustedMinY = minY;
  let adjustedHeight = vbHeight;

  // Scale the SVG so that 1em in MathJax's internal units maps to the target font size in pixels
  // 1pt = 1/72 inch; 1 inch = 96 pixels (96 DPI)
  const targetPxSize = targetPtSize * (96 / 72);
  // MathJax's internal coordinate system is based on 1000 units per em
  const internalUnitsPerEm = 1000;
  const scale = targetPxSize / internalUnitsPerEm;

  const width = Math.round(vbWidth * scale);
  const height = Math.round(vbHeight * scale);

  // Calculate baseline adjustment for proper text alignment
  let baselineOffsetPt = 0;
  
  if (positionInfo) {
    // Convert MathJax's ex units to pixels, then to points
    // 1ex = 0.5em, 1em = targetPtSize points
    const baselineOffsetPx = positionInfo.baseline * 0.5 * targetPtSize * (96 / 72); // Convert pt to px
    
    if (positionInfo.mainFractionBar) {    
      // Use MathJax's baseline
      baselineOffsetPt = baselineOffsetPx * (72 / 96);
      
      // Debug information
      console.log("Fraction positioning (MathJax baseline method):");
      console.log("  Font size:", targetPtSize + "pt");
      console.log("  MathJax baseline (ex):", positionInfo.baseline);
      console.log("  MathJax baseline (pt):", baselineOffsetPt.toFixed(2));
      console.log("  Position half-points:", Math.round(baselineOffsetPt * 2));
      
      // Additional fraction bar info for reference
      const svgCenterY = minY + vbHeight / 2;
      const mainBarY = positionInfo.mainFractionBar.y;
      const fractionBarOffsetFromCenter = mainBarY + (positionInfo.mainFractionBar.height / 2) - svgCenterY;
      console.log("  [Reference] Fraction bar center Y:", mainBarY + (positionInfo.mainFractionBar.height / 2));
      console.log("  [Reference] SVG center Y:", svgCenterY);
      console.log("  [Reference] Bar offset from center (SVG units):", fractionBarOffsetFromCenter.toFixed(1));
    } else {
      // For simple equations: use MathJax's baseline
      baselineOffsetPt = baselineOffsetPx * (72 / 96); // Convert px to pt
    }
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
      const minVisibleHeight = vbHeight * 0.012; // 1.2% of viewBox height
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
  const finalSvgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${svgString}`;

  return { svgString: finalSvgString, width, height, baselineOffsetPt };
}

// Extracts positioning information from a MathJax-generated SVG
function extractSvgPositionInfo(svg: SVGElement): {
  baseline: number;
  fractionBars: Array<{ y: number; width: number; height: number; x: number; isMain: boolean }>;
  mainFractionBar: { y: number; width: number; height: number; x: number } | null;
  totalHeight: number;
  totalWidth: number;
} {
  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) {
    throw new Error("SVG missing viewBox attribute.");
  }
  
  const [minX, minY, vbWidth, vbHeight] = viewBox.split(" ").map(parseFloat);
  
  // Extract baseline from MathJax style
  const originalStyle = svg.getAttribute("style") || "";
  let baseline = 0;
  const verticalAlignMatch = originalStyle.match(/vertical-align:\s*([-\d.]+)ex/);
  if (verticalAlignMatch) {
    baseline = parseFloat(verticalAlignMatch[1]);
  }
  
  // Find all fraction bars (thin horizontal rectangles)
  const fractionBars: Array<{ y: number; width: number; height: number; x: number; isMain: boolean }> = [];
  const rects = svg.querySelectorAll("rect");
  
  rects.forEach((rect) => {
    const rectHeight = parseFloat(rect.getAttribute("height") || "0");
    const rectWidth = parseFloat(rect.getAttribute("width") || "0");
    const rectY = parseFloat(rect.getAttribute("y") || "0");
    const rectX = parseFloat(rect.getAttribute("x") || "0");
    
    // Identify fraction bars as thin horizontal rectangles
    // Fraction bars typically have very small height relative to the viewBox
    if (rectHeight < vbHeight * 0.05 && rectWidth > vbWidth * 0.1) {
      fractionBars.push({
        y: rectY,
        width: rectWidth,
        height: rectHeight,
        x: rectX,
        isMain: false // Will be determined later
      });
    }
  });
  
  // Identify the main fraction bar
  let mainFractionBar: { y: number; width: number; height: number; x: number } | null = null;
  
  if (fractionBars.length > 0) {
    // The main fraction bar is typically:
    // 1. The widest one (covers the most horizontal space)
    // 2. Positioned closest to the center vertically
    
    const centerY = minY + vbHeight / 2;
    
    // Sort by width (descending) and then by distance from center
    const sortedBars = [...fractionBars].sort((a, b) => {
      const widthDiff = b.width - a.width;
      if (Math.abs(widthDiff) > vbWidth * 0.1) { // Significant width difference
        return widthDiff;
      }
      // If widths are similar, prefer the one closer to center
      const aDistFromCenter = Math.abs(a.y - centerY);
      const bDistFromCenter = Math.abs(b.y - centerY);
      return aDistFromCenter - bDistFromCenter;
    });
    
    mainFractionBar = sortedBars[0];
    
    // Mark the main fraction bar
    const mainIndex = fractionBars.findIndex(bar => 
      bar.y === mainFractionBar!.y && 
      bar.width === mainFractionBar!.width && 
      bar.x === mainFractionBar!.x
    );
    if (mainIndex !== -1) {
      fractionBars[mainIndex].isMain = true;
    }
  }
  
  return {
    baseline,
    fractionBars,
    mainFractionBar,
    totalHeight: vbHeight,
    totalWidth: vbWidth
  };
}

// Creates OOXML for an inline image with position formatting applied from the start
function createInlineImageWithPositionOoxml(
  base64Svg: string,
  width: number, // in pixels
  height: number, // in pixels
  baselineOffsetPt: number = 0, // vertical offset in points for baseline alignment
  altText: string = "" // LaTeX formula as alt text for editing
): string {
  // 1 inch = 914400 EMUs
  // 1 inch = 96 pixels (96 DPI)
  // 1 pixel = 914400 / 96 = 9525 EMUs
  const widthInEmus = Math.round(width * 9525);
  const heightInEmus = Math.round(height * 9525);

  const imageId = "rId" + Math.random().toString(36).substring(2, 12);
  const documentRelsId = "rId1";
  const uniqueId = Math.floor(Math.random() * 1000000) + 1;

  // Convert points to half-points for Word's position property
  const positionHalfPt = Math.round(baselineOffsetPt * 2);

  // Create OOXML with inline image and position formatting
  const ooxml = `
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
  <pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="${documentRelsId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="${imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.svg"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/media/image1.svg" pkg:contentType="image/svg+xml">
    <pkg:binaryData>${base64Svg}</pkg:binaryData>
  </pkg:part>
  <pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
    <pkg:xmlData>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <w:body>
          <w:p>
            <w:r>
              ${positionHalfPt !== 0 ? `<w:rPr>
                <w:position w:val="${positionHalfPt}"/>
              </w:rPr>` : ''}
              <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                  <wp:extent cx="${widthInEmus}" cy="${heightInEmus}"/>
                  <wp:effectExtent l="0" t="0" r="0" b="0"/>
                  <wp:docPr id="${uniqueId}" name="Math Equation" descr="${altText}"/>
                  <wp:cNvGraphicFramePr/>
                  <a:graphic>
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:pic>
                        <pic:nvPicPr>
                          <pic:cNvPr id="${uniqueId}" name="Math Equation" descr="${altText}"/>
                          <pic:cNvPicPr/>
                        </pic:nvPicPr>
                        <pic:blipFill>
                          <a:blip r:embed="${imageId}"/>
                          <a:stretch>
                            <a:fillRect/>
                          </a:stretch>
                        </pic:blipFill>
                        <pic:spPr>
                          <a:xfrm>
                            <a:off x="0" y="0"/>
                            <a:ext cx="${widthInEmus}" cy="${heightInEmus}"/>
                          </a:xfrm>
                          <a:prstGeom prst="rect">
                            <a:avLst/>
                          </a:prstGeom>
                        </pic:spPr>
                      </pic:pic>
                    </a:graphicData>
                  </a:graphic>
                </wp:inline>
              </w:drawing>
            </w:r>
          </w:p>
        </w:body>
      </w:document>
    </pkg:xmlData>
  </pkg:part>
</pkg:package>`.trim();

  return ooxml;
}

