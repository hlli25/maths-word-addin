import { EquationBuilder } from '../core/equation-builder';
import { ContextManager } from '../core/context-manager';
import { DisplayRenderer } from './display-renderer';

export class InputHandler {
  private equationBuilder: EquationBuilder;
  private contextManager: ContextManager;
  private displayRenderer: DisplayRenderer;
  private displayElement: HTMLElement;
  private isDragging = false;
  private dragStartPosition = 0;

  constructor(
    equationBuilder: EquationBuilder,
    contextManager: ContextManager,
    displayRenderer: DisplayRenderer,
    displayElement: HTMLElement
  ) {
    this.equationBuilder = equationBuilder;
    this.contextManager = contextManager;
    this.displayRenderer = displayRenderer;
    this.displayElement = displayElement;
  }

  handleKeyPress(e: KeyboardEvent): void {
    const key = e.key;

    if (key === "Backspace") {
      e.preventDefault();
      this.handleBackspace();
    } else if (key === "Delete") {
      e.preventDefault();
      this.handleDelete();
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      if (e.shiftKey) {
        this.contextManager.extendSelection(-1);
      } else {
        this.contextManager.clearSelection();
        this.contextManager.moveCursor(-1);
      }
      this.updateDisplay();
    } else if (key === "ArrowRight") {
      e.preventDefault();
      if (e.shiftKey) {
        this.contextManager.extendSelection(1);
      } else {
        this.contextManager.clearSelection();
        this.contextManager.moveCursor(1);
      }
      this.updateDisplay();
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      if (!e.shiftKey) {
        this.contextManager.clearSelection();
      }
      this.contextManager.navigateUpDown(key);
      this.updateDisplay();
    } else if (key === "Tab") {
      e.preventDefault();
      if (!e.shiftKey) {
        this.contextManager.clearSelection();
      }
      this.contextManager.navigateUpDown(e.shiftKey ? "ArrowUp" : "ArrowDown");
      this.updateDisplay();
    } else if (e.ctrlKey && key.toLowerCase() === 'a') {
      e.preventDefault();
      this.selectAll();
    } else if (e.ctrlKey && key.toLowerCase() === 'b') {
      e.preventDefault();
      this.toggleBold();
    }
  }

  handleInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const char = input.value.slice(-1);
    input.value = "";

    if (this.contextManager.isActive() && char && /[0-9a-zA-Z+\-=().,]/.test(char)) {
      this.contextManager.insertTextAtCursor(char);
      this.updateDisplay();
    }
  }

  handleDisplayClick(e: MouseEvent): void {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    
    // Check if click is on scrollbar area more precisely
    const rect = this.displayElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Check if click is in the horizontal scrollbar area (bottom of the element)
    if (clickY > this.displayElement.clientHeight) {
      return; // Don't move cursor when clicking on horizontal scrollbar
    }
    
    // Check if click is in the vertical scrollbar area (right edge)  
    if (clickX > this.displayElement.clientWidth) {
      return; // Don't move cursor when clicking on vertical scrollbar
    }
    
    // Find the equation container, trying multiple approaches
    let equationContainer = target.closest(".equation-container") as HTMLElement;
    
    // If we didn't find a container directly, check if we clicked on a child element
    if (!equationContainer && target.classList.contains('equation-container')) {
      equationContainer = target;
    }
    
    // Don't clear selection if clicking on formatting buttons or tab panel
    const isFormattingClick = target.closest('.format-btn') || target.closest('.tab-panel');
    
    // Clear selection unless this is part of a drag operation or formatting click
    if (!this.isDragging && !isFormattingClick) {
      this.contextManager.clearSelection();
    }

    if (equationContainer) {
      const path = equationContainer.dataset.contextPath;
      
      if (path) {
        this.contextManager.enterContextPath(path);
        const context = this.contextManager.getContext(path);
        
        if (context) {
          const position = this.getClickPosition(e, equationContainer, context.array);
          this.contextManager.setCursorPosition(position);
          
          // Start drag selection
          this.isDragging = false; // Will be set to true on mousemove
          this.dragStartPosition = position;
        }
      } else {
        this.contextManager.enterRootContext();
        const position = this.getClickPosition(e, equationContainer, this.equationBuilder.getEquation());
        this.contextManager.setCursorPosition(position);
        this.dragStartPosition = position;
      }
    } else {
      this.contextManager.enterRootContext();
      this.dragStartPosition = 0;
      
      // Force set cursor position to end of equation when clicking on empty area
      const equation = this.equationBuilder.getEquation();
      this.contextManager.setCursorPosition(equation.length);
    }

    this.focusHiddenInput();
    this.updateDisplay();
  }

  handleDocumentClick(event: Event): void {
    const display = this.displayElement;
    const tabPanel = document.querySelector(".tab-panel");
    const target = event.target as HTMLElement;

    // Check if clicked element is a formatting button
    const isFormattingButton = target.closest('.format-btn') !== null;
    
    if (
      this.contextManager.isActive() &&
      display &&
      !display.contains(target) &&
      tabPanel &&
      !tabPanel.contains(target) &&
      !isFormattingButton  // Don't exit editing mode when clicking formatting buttons
    ) {
      this.contextManager.exitEditingMode();
      this.blurHiddenInput();
      this.updateDisplay();
    }
  }

  handleFontSizeChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const newSize = parseInt(input.value);
    
    if (!isNaN(newSize) && newSize >= 6 && newSize <= 72) {
      this.displayRenderer.setGlobalFontSize(newSize);
      this.updateDisplay();
    }
  }

  insertOperator(operator: string): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Convert LaTeX commands to Unicode symbols for display
    const unicodeSymbol = this.convertLatexToUnicode(operator);
    this.contextManager.insertTextAtCursor(unicodeSymbol);
    this.updateDisplay();
    this.focusHiddenInput();
  }

  private convertLatexToUnicode(latex: string): string {
    const latexToUnicodeMap: { [key: string]: string } = {
      "\\times": "×",
      "\\div": "÷",
      "\\pm": "±",
      "\\mp": "∓",
      "\\cdot": "·",
      "\\ast": "∗",
      "\\star": "⋆",
      "\\circ": "∘",
      "\\bullet": "•",
      "\\neq": "≠",
      "\\sim": "∼",
      "\\simeq": "≃",
      "\\approx": "≈",
      "\\equiv": "≡",
      "\\cong": "≅",
      "\\ncong": "≇",
      "\\propto": "∝",
      "\\leq": "≤",
      "\\geq": "≥",
      "\\nless": "≮",
      "\\ngtr": "≯",
      "\\nleq": "≰",
      "\\ngeq": "≱",
      "\\prec": "≺",
      "\\succ": "≻",
      "\\preceq": "⪯",
      "\\succeq": "⪰",
      "\\ll": "≪",
      "\\gg": "≫",
      "\\cap": "∩",
      "\\cup": "∪",
      "\\setminus": "∖",
      "\\in": "∈",
      "\\ni": "∋",
      "\\notin": "∉",
      "\\subset": "⊂",
      "\\supset": "⊃",
      "\\subseteq": "⊆",
      "\\supseteq": "⊇",
      "\\nsubseteq": "⊈",
      "\\nsupseteq": "⊉",
      "\\subsetneq": "⊊",
      "\\supsetneq": "⊋",
      "\\oplus": "⊕",
      "\\ominus": "⊖",
      "\\otimes": "⊗",
      "\\oslash": "⊘",
      "\\odot": "⊙",
      "\\triangleleft": "◁",
      "\\triangleright": "▷",
      "\\wr": "≀",
      "\\wedge": "∧",
      "\\vee": "∨",
      "\\vdash": "⊢",
      "\\models": "⊨",
      "\\top": "⊤",
      "\\bot": "⊥",
      "\\bowtie": "⋈",
      "\\diamond": "⋄",
      "\\asymp": "≍",
      "\\triangleq": "≜",
      "\\therefore": "∴",
      "\\because": "∵"
    };

    return latexToUnicodeMap[latex] || latex;
  }

  insertFraction(): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const fraction = this.equationBuilder.createFractionElement();
    this.contextManager.insertElementAtCursor(fraction);

    // Move context into the new fraction's numerator
    const numeratorPath = this.contextManager.getElementContextPath(fraction.id, "numerator");
    this.contextManager.enterContextPath(numeratorPath, 0);

    this.updateDisplay();
    this.equationBuilder.updateParenthesesScaling();
    this.focusHiddenInput();
  }

  insertBevelledFraction(): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const bevelledFraction = this.equationBuilder.createBevelledFractionElement();
    this.contextManager.insertElementAtCursor(bevelledFraction);

    // Move context into the new bevelled fraction's numerator
    const numeratorPath = this.contextManager.getElementContextPath(bevelledFraction.id, "numerator");
    this.contextManager.enterContextPath(numeratorPath, 0);

    this.updateDisplay();
    this.equationBuilder.updateParenthesesScaling();
  }

  insertSquareRoot(): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const sqrtElement = this.equationBuilder.createSquareRootElement();
    this.contextManager.insertElementAtCursor(sqrtElement);

    // Move context into the new sqrt's radicand
    const radicandPath = this.contextManager.getElementContextPath(sqrtElement.id, "radicand");
    this.contextManager.enterContextPath(radicandPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }

  insertNthRoot(): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const nthRootElement = this.equationBuilder.createNthRootElement();
    this.contextManager.insertElementAtCursor(nthRootElement);

    // Move context into the new nthroot's index
    const indexPath = this.contextManager.getElementContextPath(nthRootElement.id, "index");
    this.contextManager.enterContextPath(indexPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }

  insertScript(type: "superscript" | "subscript"): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const scriptElement = this.equationBuilder.createScriptElement(
      type === "superscript",
      type === "subscript"
    );
    this.contextManager.insertElementAtCursor(scriptElement);

    // Move context into the new script's base first
    const basePath = this.contextManager.getElementContextPath(scriptElement.id, "base");
    this.contextManager.enterContextPath(basePath, 0);

    this.updateDisplay();
  }

  insertSuperscriptSubscript(): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const scriptElement = this.equationBuilder.createScriptElement(true, true);
    this.contextManager.insertElementAtCursor(scriptElement);

    // Move context into the new script's base first
    const basePath = this.contextManager.getElementContextPath(scriptElement.id, "base");
    this.contextManager.enterContextPath(basePath, 0);

    this.updateDisplay();
  }

  insertBracket(leftSymbol: string, rightSymbol: string): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const bracketElement = this.equationBuilder.createBracketElement(leftSymbol, rightSymbol);
    this.contextManager.insertElementAtCursor(bracketElement);

    // Update bracket nesting depths
    this.equationBuilder.updateBracketNesting();

    // Move context into the new bracket's content
    const contentPath = this.contextManager.getElementContextPath(bracketElement.id, "content");
    this.contextManager.enterContextPath(contentPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }

  insertCustomBrackets(leftBracket: string, rightBracket: string): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Handle different bracket insertion scenarios
    if (!leftBracket && !rightBracket) {
      return; // Nothing to insert
    }

    // Always create a bracket element when at least one side is specified
    // Convert empty strings to "." for invisible brackets
    const leftSymbol = leftBracket || ".";
    const rightSymbol = rightBracket || ".";
    
    const bracketElement = this.equationBuilder.createBracketElement(leftSymbol, rightSymbol);
    this.contextManager.insertElementAtCursor(bracketElement);
    
    // Update bracket nesting depths
    this.equationBuilder.updateBracketNesting();
    
    // Move context into the new bracket's content
    const contentPath = this.contextManager.getElementContextPath(bracketElement.id, "content");
    this.contextManager.enterContextPath(contentPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }


  private updateDisplay(): void {
    this.displayRenderer.updateDisplay(this.displayElement, this.equationBuilder.getEquation());
    
    // Ensure the hidden input is focused if we are in an active context
    // Use setTimeout to ensure focus happens after DOM updates are complete
    if (this.contextManager.isActive()) {
      setTimeout(() => {
        this.focusHiddenInput();
        this.scrollCursorIntoView();
      }, 0);
    }
  }

  private focusHiddenInput(): void {
    const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
    if (hiddenInput) {
      hiddenInput.focus();
    }
  }

  private blurHiddenInput(): void {
    const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
    if (hiddenInput) {
      hiddenInput.blur();
    }
  }

  private scrollCursorIntoView(): void {
    const cursor = this.displayElement.querySelector('.cursor') as HTMLElement;
    if (cursor) {
      // Scroll the cursor into view horizontally
      cursor.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }

  handleMouseDown(e: MouseEvent): void {
    this.isDragging = false;
    this.handleDisplayClick(e);
  }

  handleMouseMove(e: MouseEvent): void {
    if (e.buttons === 1 && this.contextManager.isActive()) { // Left mouse button is down
      this.isDragging = true;
      const target = e.target as HTMLElement;
      const equationContainer = target.closest(".equation-container") as HTMLElement;
      
      if (equationContainer) {
        const path = equationContainer.dataset.contextPath;
        const currentPath = this.contextManager.getActiveContextPath();
        
        // Only allow selection within the same context
        if (path === currentPath) {
          const context = this.contextManager.getContext(path!);
          if (context) {
            const currentPosition = this.getClickPosition(e, equationContainer, context.array);
            
            this.contextManager.setSelection(this.dragStartPosition, currentPosition, path!);
            
            // Update cursor position to the end of selection for consistent state
            const selection = this.contextManager.getSelection();
            this.contextManager.setCursorPosition(selection.endPosition);
            
            this.updateDisplay();
          }
        }
      }
    }
  }

  handleMouseUp(e: MouseEvent): void {
    this.isDragging = false;
  }

  private getClickPosition(e: MouseEvent, container: HTMLElement, elements: any[]): number {
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Find all text elements within the container
    const textElements = container.querySelectorAll('.equation-element');
    
    if (textElements.length === 0) {
      return 0;
    }
    
    let closestPosition = 0;
    let minDistance = Infinity;
    
    // Check each element to find the closest one to the click
    textElements.forEach((element, index) => {
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Calculate element position relative to container
      const elementLeft = elementRect.left - containerRect.left;
      const elementRight = elementRect.right - containerRect.left;
      const elementCenter = elementLeft + (elementRect.width / 2);
      
      // Distance from click to element center
      const distanceToCenter = Math.abs(clickX - elementCenter);
      
      // Distance from click to element left edge (for cursor positioning)
      const distanceToLeft = Math.abs(clickX - elementLeft);
      const distanceToRight = Math.abs(clickX - elementRight);
      
      // Determine if click is closer to left or right side of this element
      if (distanceToLeft < minDistance) {
        minDistance = distanceToLeft;
        closestPosition = index; // Before this element
      }
      
      if (distanceToRight < minDistance) {
        minDistance = distanceToRight;
        closestPosition = index + 1; // After this element
      }
    });
    
    // Ensure position is within bounds
    return Math.max(0, Math.min(closestPosition, elements.length));
  }

  private selectAll(): void {
    if (!this.contextManager.isActive()) return;
    
    const context = this.contextManager.getCurrentContext();
    if (context) {
      this.contextManager.setSelection(0, context.array.length);
      this.updateDisplay();
    }
  }

  toggleBold(): void {
    if (!this.contextManager.hasSelection()) {
      return;
    }
    
    // Check if selected text is already bold to determine toggle action
    const isBold = this.contextManager.isSelectionBold();
    
    if (isBold) {
      this.contextManager.applyFormattingToSelection({ bold: false });
    } else {
      this.contextManager.applyFormattingToSelection({ bold: true });
    }
    
    this.contextManager.clearSelection(); // Clear selection after formatting
    this.updateDisplay();
  }

  private handleBackspace(): void {
    if (this.contextManager.hasSelection()) {
      this.contextManager.deleteSelection();
      this.equationBuilder.updateBracketNesting();
      this.updateDisplay();
      this.equationBuilder.updateParenthesesScaling();
    } else if (this.contextManager.handleBackspace()) {
      this.equationBuilder.updateBracketNesting();
      this.updateDisplay();
      this.equationBuilder.updateParenthesesScaling();
    }
  }

  private handleDelete(): void {
    if (this.contextManager.hasSelection()) {
      this.contextManager.deleteSelection();
      this.equationBuilder.updateBracketNesting();
      this.updateDisplay();
      this.equationBuilder.updateParenthesesScaling();
    } else if (this.contextManager.handleDelete()) {
      this.equationBuilder.updateBracketNesting();
      this.updateDisplay();
      this.equationBuilder.updateParenthesesScaling();
    }
  }
}