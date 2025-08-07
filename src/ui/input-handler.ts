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
  public onSelectionChange?: () => void;

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

    if (this.contextManager.isActive() && char) {
      // Convert + and - to proper mathematical operator symbols
      let processedChar = char;
      if (char === '+') {
        processedChar = '+'; // Keep as regular plus but ensure it's treated as operator
      } else if (char === '-') {
        processedChar = '−'; // Proper minus sign (U+2212), not hyphen-minus
      }
      
      // Sanitize the character before inserting
      const sanitizedChar = this.sanitizeInputChar(processedChar);
      if (sanitizedChar) {
        this.contextManager.insertTextAtCursor(sanitizedChar);
        this.updateDisplay();
      }
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
    
    // Find an element with a context path, starting from the clicked element
    let contextElement: HTMLElement | null = null;
    
    // Strategy: Find the most appropriate context level for editing
    // We want to find the container that represents an editable context (root, numerator, denominator, etc.)
    
    // Start with the clicked target and traverse up to find the right context level
    let currentElement: HTMLElement | null = target;
    
    while (currentElement) {
      const contextPath = currentElement.dataset.contextPath;
      
      if (contextPath) {
        // Check if this is an appropriate editing context level
        if (contextPath === 'root' || 
            contextPath.endsWith('/numerator') || 
            contextPath.endsWith('/denominator') ||
            contextPath.endsWith('/radicand') ||
            contextPath.endsWith('/index') ||
            contextPath.endsWith('/base') ||
            contextPath.endsWith('/superscript') ||
            contextPath.endsWith('/subscript') ||
            contextPath.endsWith('/content') ||
            contextPath.endsWith('/lowerLimit') ||
            contextPath.endsWith('/upperLimit') ||
            contextPath.endsWith('/operand')) {
          contextElement = currentElement;
          break;
        }
      }
      
      // Move up to parent element
      currentElement = currentElement.parentElement;
    }
    
    // If we still don't have one, look for the main equation container
    if (!contextElement) {
      contextElement = target.closest(".equation-container") as HTMLElement;
      if (!contextElement && target.classList.contains('equation-container')) {
        contextElement = target;
      }
    }
    
    
    // Don't clear selection if clicking on formatting buttons, dropdowns, or tab panel
    const isFormattingClick = target.closest('.format-btn') || 
                             target.closest('.tab-panel') ||
                             target.closest('.underline-dropdown-container') ||
                             target.closest('.underline-dropdown') ||
                             target.closest('.color-dropdown-container') ||
                             target.closest('.color-panel') ||
                             target.closest('.font-size-container') ||
                             target.closest('.font-size-dropdown');
    
    // Clear selection unless this is part of a drag operation or formatting click
    // Don't clear selection immediately on mouse down - wait to see if it's a drag
    if (!isFormattingClick) {
      // Only clear selection if this is not a mouse down event that could start a drag
      // We'll clear it in handleMouseUp if no dragging occurred
      if (this.isDragging === false && e.type !== 'mousedown') {
        this.contextManager.clearSelection();
        // Notify that selection changed
        if (this.onSelectionChange) {
          this.onSelectionChange();
        }
      }
    }

    if (contextElement) {
      const path = contextElement.dataset.contextPath;
      
      if (path) {
        // Enter the appropriate context
        if (path === "root") {
          this.contextManager.enterRootContext();
        } else {
          this.contextManager.enterContextPath(path);
        }
        
        // Get the context and calculate position
        const context = this.contextManager.getContext(path);
        if (context) {
          const position = this.getClickPosition(e, contextElement, context.array);
          this.contextManager.setCursorPosition(position);
          this.dragStartPosition = position;
        }
      } else {
        // No path found, default to root
        this.contextManager.enterRootContext();
        const position = this.getClickPosition(e, contextElement, this.equationBuilder.getEquation());
        this.contextManager.setCursorPosition(position);
        this.dragStartPosition = position;
      }
    } else {
      // No context element found - default to root context and try to position smartly
      this.contextManager.enterRootContext();
      const equation = this.equationBuilder.getEquation();
      
      if (equation.length === 0) {
        // Empty equation, position at start
        this.contextManager.setCursorPosition(0);
        this.dragStartPosition = 0;
      } else {
        // Try to use the general click position logic for the main container
        const mainContainer = this.displayElement.querySelector('[data-context-path="root"]') as HTMLElement;
        if (mainContainer) {
          const position = this.getClickPosition(e, mainContainer, equation);
          this.contextManager.setCursorPosition(position);
          this.dragStartPosition = position;
        } else {
          // Fallback to end of equation
          this.contextManager.setCursorPosition(equation.length);
          this.dragStartPosition = equation.length;
        }
      }
    }

    this.focusHiddenInput();
    this.updateDisplay();
  }

  handleDocumentClick(event: Event): void {
    const display = this.displayElement;
    const tabPanel = document.querySelector(".tab-panel");
    const target = event.target as HTMLElement;

    // Check if clicked element is a formatting button or dropdown
    const isFormattingClick = target.closest('.format-btn') || 
                             target.closest('.underline-dropdown-container') ||
                             target.closest('.underline-dropdown') ||
                             target.closest('.color-dropdown-container') ||
                             target.closest('.color-panel') ||
                             target.closest('.font-size-container') ||
                             target.closest('.font-size-dropdown');
    
    if (
      this.contextManager.isActive() &&
      display &&
      !display.contains(target) &&
      tabPanel &&
      !tabPanel.contains(target) &&
      !isFormattingClick  // Don't exit editing mode when clicking formatting buttons
    ) {
      this.contextManager.exitEditingMode();
      this.blurHiddenInput();
      this.updateDisplay();
    }
  }

  handleFontSizeChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const newSize = parseInt(input.value);
    
    if (!isNaN(newSize) && newSize >= 6 && newSize <= 144) {
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
      "\\plus": "+",
      "\\minus": "−",
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
      "\\because": "∵",
      "\\sum": "∑"
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

    const bracketElement = this.equationBuilder.createBracketElement(leftBracket, rightBracket);
    this.contextManager.insertElementAtCursor(bracketElement);
    
    // Update bracket nesting depths
    this.equationBuilder.updateBracketNesting();
    
    // Move context into the new bracket's content
    const contentPath = this.contextManager.getElementContextPath(bracketElement.id, "content");
    this.contextManager.enterContextPath(contentPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }

  insertSummation(): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Create the summation script element with both subscript and superscript
    const summationElement = this.equationBuilder.createScriptElement(true, true);
    
    // Set the base to the summation symbol
    const sumSymbol = this.equationBuilder.createTextElement("∑");
    summationElement.base = [sumSymbol];
    
    this.contextManager.insertElementAtCursor(summationElement);

    // Move context into the subscript first (lower limit)
    const subscriptPath = this.contextManager.getElementContextPath(summationElement.id, "subscript");
    this.contextManager.enterContextPath(subscriptPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }

  insertLargeOperator(
    operator: string, 
    displayMode: "inline" | "display" = "inline", 
    limitMode: "default" | "nolimits" | "limits" = "default"
  ): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const largeOperatorElement = this.equationBuilder.createLargeOperatorElement(operator, displayMode, limitMode);
    this.contextManager.insertElementAtCursor(largeOperatorElement);

    // Move context into the lower limit first
    const lowerLimitPath = this.contextManager.getElementContextPath(largeOperatorElement.id, "lowerLimit");
    this.contextManager.enterContextPath(lowerLimitPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }


  private updateDisplay(): void {
    // Recalculate bracket nesting depths before rendering to ensure visual sizing is correct
    this.equationBuilder.updateBracketNesting();
    
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
      
      // Find an element with a context path, starting from the clicked element
      let contextElement = target.closest('[data-context-path]') as HTMLElement;
      
      // If we didn't find a context element, look for the main equation container
      if (!contextElement) {
        contextElement = target.closest(".equation-container") as HTMLElement;
      }
      
      if (contextElement) {
        const path = contextElement.dataset.contextPath;
        const currentPath = this.contextManager.getActiveContextPath();
        
        // Only allow selection within the same context
        if (path === currentPath) {
          const context = this.contextManager.getContext(path!);
          if (context) {
            const currentPosition = this.getClickPosition(e, contextElement, context.array);
            
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
    // If we weren't dragging, clear any existing selection (this was a simple click)
    if (!this.isDragging) {
      // Don't clear selection if clicking on formatting buttons
      const target = e.target as HTMLElement;
      const isFormattingClick = target.closest('.format-btn') || 
                               target.closest('.tab-panel') ||
                               target.closest('.underline-dropdown-container') ||
                               target.closest('.underline-dropdown') ||
                               target.closest('.color-dropdown-container') ||
                               target.closest('.color-panel') ||
                               target.closest('.font-size-container') ||
                               target.closest('.font-size-dropdown');
      
      if (!isFormattingClick) {
        this.contextManager.clearSelection();
      }
    }
    
    this.isDragging = false;
    
    // Notify that selection may have changed
    if (this.onSelectionChange) {
      this.onSelectionChange();
    }
  }

  private getClickPosition(e: MouseEvent, container: HTMLElement, elements: any[]): number {
    // If no elements, return position 0
    if (elements.length === 0) {
      return 0;
    }
    
    const clickX = e.clientX;
    const containerRect = container.getBoundingClientRect();
    const containerPath = container.dataset.contextPath;
    
    // For character-level positioning, we need to look at ALL visible elements in the container
    // regardless of their exact context path, but prioritize those that match our context
    const allVisibleElements = Array.from(container.querySelectorAll('mi, mo, mn, mfrac, msqrt, msup, msub, msubsup, mroot')).filter(el => {
      const element = el as HTMLElement;
      return !element.classList.contains('cursor') && element.dataset.position !== undefined;
    });
    
    if (allVisibleElements.length === 0) {
      // No visible elements, determine position based on click location
      const relativeX = clickX - containerRect.left;
      return relativeX < containerRect.width / 2 ? 0 : elements.length;
    }
    
    // Sort elements by their visual position (left to right)
    allVisibleElements.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.left - bRect.left;
    });
    
    // Get the rightmost element to check if we're clicking far to the right
    const lastElement = allVisibleElements[allVisibleElements.length - 1] as HTMLElement;
    const lastElementRect = lastElement.getBoundingClientRect();
    
    // If clicking far to the right of the last element (beyond its right edge + some margin),
    // position at the end of the equation
    if (clickX > lastElementRect.right + 10) {
      return elements.length;
    }
    
    // Find the closest insertion point based on visual position
    for (let i = 0; i < allVisibleElements.length; i++) {
      const element = allVisibleElements[i] as HTMLElement;
      const elementRect = element.getBoundingClientRect();
      
      // For fine-grained positioning, check both left edge and center
      const elementLeft = elementRect.left;
      const elementCenter = elementRect.left + elementRect.width / 2;
      const elementRight = elementRect.right;
      
      // If click is very close to the left edge, position before this element
      if (clickX <= elementLeft + 2) {
        const position = parseInt(element.dataset.position || '0', 10);
        return Math.max(0, Math.min(position, elements.length));
      }
      
      // If click is before the center, position before this element
      if (clickX < elementCenter) {
        const position = parseInt(element.dataset.position || '0', 10);
        return Math.max(0, Math.min(position, elements.length));
      }
      
      // If this is the last element and click is after its center, position after it
      if (i === allVisibleElements.length - 1 && clickX >= elementCenter) {
        const position = parseInt(element.dataset.position || '0', 10);
        return Math.max(0, Math.min(position + 1, elements.length));
      }
    }
    
    // If we get here, click was after all elements
    return elements.length;
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

  toggleItalic(): void {
    if (!this.contextManager.hasSelection()) {
      return;
    }
    
    // Check if selected text is already italic to determine toggle action
    const isItalic = this.contextManager.isSelectionItalic();
    
    if (isItalic) {
      this.contextManager.applyFormattingToSelection({ italic: false });
    } else {
      this.contextManager.applyFormattingToSelection({ italic: true });
    }
    
    this.contextManager.clearSelection(); // Clear selection after formatting
    this.updateDisplay();
  }

  toggleCancel(): void {
    if (!this.contextManager.hasSelection()) {
      return;
    }
    
    // Check if selected text is already cancel to determine toggle action
    const isCancel = this.contextManager.isSelectionCancel();
    
    if (isCancel) {
      this.contextManager.applyFormattingToSelection({ cancel: false });
    } else {
      this.contextManager.applyFormattingToSelection({ cancel: true });
    }
    
    this.contextManager.clearSelection(); // Clear selection after formatting
    this.updateDisplay();
  }

  setUnderlineStyle(underlineType: string): void {
    if (!this.contextManager.hasSelection()) {
      return;
    }
    
    if (underlineType === "none") {
      this.contextManager.applyFormattingToSelection({ underline: false, underlineStyle: null });
    } else {
      this.contextManager.applyFormattingToSelection({ underline: true, underlineStyle: underlineType });
    }
    
    this.contextManager.clearSelection(); // Clear selection after formatting
    this.updateDisplay();
  }

  getSelectionFormatting(): { bold?: boolean; italic?: boolean; underline?: string | boolean; cancel?: boolean; color?: string } | null {
    return this.contextManager.getSelectionFormatting();
  }

  setTextColor(color: string): void {
    if (!this.contextManager.hasSelection()) {
      return;
    }
    
    this.contextManager.applyFormattingToSelection({ color: color });
    
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

  private sanitizeInputChar(char: string): string {
    // Only block control characters and backslash
    const charCode = char.charCodeAt(0);
    
    // Block control characters (0-31, 127)
    if (charCode < 32 || charCode === 127) {
      return '';
    }
    
    // Block backslash ('\') due to issues in MathJax
    if (char === '\\') {
      return '';
    }
    
    // Allow all other characters including $ % ^ _ ~ # & { }
    // The LaTeX converter will handle proper escaping when converting to LaTeX
    return char;
  }
}