import { EquationBuilder, EquationElement } from '../core/equation-builder';
import { ContextManager } from '../core/context-manager';
import { DisplayRenderer } from './display-renderer';
import { LATEX_TO_UNICODE, getSymbolInfo, isSymbolDefaultItalic, hasMixedBrackets } from '../core/symbol-config';

export class InputHandler {
  private equationBuilder: EquationBuilder;
  private contextManager: ContextManager;
  private displayRenderer: DisplayRenderer;
  private displayElement: HTMLElement;
  private isDragging = false;
  private dragStartPosition = 0;
  public onSelectionChange?: () => void;
  private differentialStyle: "italic" | "roman" = "italic"; // Default to italic
  private isInlineStyle: boolean = false; // Default to display style

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
      if (e.ctrlKey && e.shiftKey) {
        // Ctrl+Shift+Left: Extend selection by whole structure
        this.contextManager.extendSelectionToStructure(-1);
      } else if (e.shiftKey) {
        // Shift+Left: Extend selection by character
        this.contextManager.extendSelection(-1);
      } else if (e.ctrlKey) {
        // Ctrl+Left: Move cursor over whole structure
        this.contextManager.clearSelection();
        this.moveOverStructure(-1);
      } else {
        // Left: Move cursor by character
        this.contextManager.clearSelection();
        this.contextManager.moveCursor(-1);
      }
      this.updateDisplay();
    } else if (key === "ArrowRight") {
      e.preventDefault();
      if (e.ctrlKey && e.shiftKey) {
        // Ctrl+Shift+Right: Extend selection by whole structure
        this.contextManager.extendSelectionToStructure(1);
      } else if (e.shiftKey) {
        // Shift+Right: Extend selection by character
        this.contextManager.extendSelection(1);
      } else if (e.ctrlKey) {
        // Ctrl+Right: Move cursor over whole structure
        this.contextManager.clearSelection();
        this.moveOverStructure(1);
      } else {
        // Right: Move cursor by character
        this.contextManager.clearSelection();
        this.contextManager.moveCursor(1);
      }
      this.updateDisplay();
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      if (e.ctrlKey && e.shiftKey) {
        // Ctrl+Shift+Up/Down: Select parent structure or current context
        if (key === "ArrowUp") {
          this.contextManager.selectParentStructure();
        } else {
          this.contextManager.selectCurrentContext();
        }
      } else if (!e.shiftKey) {
        this.contextManager.clearSelection();
        this.contextManager.navigateUpDown(key);
      } else {
        // With shift, maintain selection while navigating
        this.contextManager.navigateUpDown(key);
      }
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
    } else if (e.ctrlKey && e.shiftKey && key === ' ') {
      // Ctrl+Shift+Space: Select entire matrix when inside matrix cell
      e.preventDefault();
      this.selectEntireMatrix();
    } else if (e.ctrlKey && key === ' ') {
      // Ctrl+Space: Select structure at cursor
      e.preventDefault();
      if (this.contextManager.selectStructureAtCursor()) {
        this.updateDisplay();
      }
    }
  }

  private moveOverStructure(direction: number): void {
    const context = this.contextManager.getCurrentContext();
    if (!context) return;

    const currentPos = this.contextManager.getCursorPosition();
    
    if (direction > 0 && currentPos < context.array.length) {
      const element = context.array[currentPos];
      if (element && element.type !== 'text') {
        // Skip over entire structure
        this.contextManager.setCursorPosition(currentPos + 1);
      } else {
        // Regular character movement
        this.contextManager.moveCursor(1);
      }
    } else if (direction < 0 && currentPos > 0) {
      const element = context.array[currentPos - 1];
      if (element && element.type !== 'text') {
        // Skip over entire structure
        this.contextManager.setCursorPosition(currentPos - 1);
      } else {
        // Regular character movement
        this.contextManager.moveCursor(-1);
      }
    } else {
      // Regular movement at boundaries
      this.contextManager.moveCursor(direction);
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
        // Create text element with default styling
        const element = this.equationBuilder.createTextElement(sanitizedChar);
        
        // Apply default italic styling based on character type
        const shouldBeItalic = this.getDefaultItalicForSymbol(sanitizedChar, sanitizedChar);
        if (shouldBeItalic !== undefined) {
          element.italic = shouldBeItalic;
        }
        
        // Insert the element instead of just the text
        this.contextManager.insertElementAtCursor(element);
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
            contextPath.match(/\/cell_\d+_\d+$/) ||  // Matrix cell pattern
            contextPath.endsWith('/content') ||
            contextPath.endsWith('/lowerLimit') ||
            contextPath.endsWith('/upperLimit') ||
            contextPath.endsWith('/operand') ||
            contextPath.endsWith('/function') ||
            contextPath.endsWith('/variable') ||
            contextPath.endsWith('/order') ||
            contextPath.endsWith('/integrand') ||
            contextPath.endsWith('/differentialVariable')) {
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

  insertSymbol(symbol: string): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Convert LaTeX commands to Unicode symbols for display
    const unicodeSymbol = this.convertLatexToUnicode(symbol);
    
    // Create text element with default styling based on symbol type
    const element = this.equationBuilder.createTextElement(unicodeSymbol);
    
    // Apply default italic styling based on symbol configuration
    const shouldBeItalic = this.getDefaultItalicForSymbol(symbol, unicodeSymbol);
    if (shouldBeItalic !== undefined) {
      element.italic = shouldBeItalic;
    }
    
    // Insert the element instead of just the text
    this.contextManager.insertElementAtCursor(element);
    this.updateDisplay();
    this.focusHiddenInput();
  }

  private getDefaultItalicForSymbol(originalSymbol: string, unicodeSymbol: string): boolean | undefined {
    // Check if we have explicit configuration for this LaTeX symbol
    const symbolInfo = getSymbolInfo(originalSymbol);
    if (symbolInfo) {
      return symbolInfo.defaultItalic;
    }
    
    // Handle direct text input (English letters)
    if (originalSymbol === unicodeSymbol) {
      // English lowercase and uppercase letters are naturally italic
      if (/^[a-zA-Z]$/.test(unicodeSymbol)) {
        return undefined; // naturally italic
      }
      // Numbers should render normally without italic formatting
      if (/^[0-9]$/.test(unicodeSymbol)) {
        return undefined; // Let numbers render normally
      }
      // Basic operators should not be italic
      if (/^[+\-=<>(){}[\]|]$/.test(unicodeSymbol)) {
        return false;
      }
    }
    
    // No default - let normal rendering logic decide
    return undefined;
  }

  private convertLatexToUnicode(latex: string): string {
    return LATEX_TO_UNICODE[latex] || latex;
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

  insertDisplayFraction(): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const displayFraction = this.equationBuilder.createDisplayFractionElement();
    this.contextManager.insertElementAtCursor(displayFraction);

    // Move context into the new display fraction's numerator
    const numeratorPath = this.contextManager.getElementContextPath(displayFraction.id, "numerator");
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
    
    // Check if we're in a derivative function context and validate brackets
    const activeContextPath = this.contextManager.getActiveContextPath();
    if (activeContextPath && activeContextPath.includes('function')) {
      const context = this.contextManager.getContext(activeContextPath);
      if (context && context.parent?.type === 'derivative') {
        // Check if this creates mixed brackets
        const currentText = context.array.map((el: any) => el.value || '').join('');
        const newText = currentText + leftBracket + rightBracket;
        if (hasMixedBrackets(newText)) {
          this.contextManager.showMixedBracketsError();
          return;
        }
      }
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

    // Move context into the operand first for better UX
    const operandPath = this.contextManager.getElementContextPath(largeOperatorElement.id, "operand");
    this.contextManager.enterContextPath(operandPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }

  // Integral insertion methods
  insertIntegral(
    integralType: "single" | "double" | "triple" | "contour" = "single",
    displayMode: "inline" | "display" = "inline",
    hasLimits: boolean = false,
    limitMode: "default" | "nolimits" | "limits" = "default"
  ): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Create integral element with the current differential style
    const integralElement = this.equationBuilder.createIntegralElement(
      integralType,
      displayMode,
      this.differentialStyle === "roman" ? "roman" : "italic",
      hasLimits,
      limitMode
    );

    this.contextManager.insertElementAtCursor(integralElement);

    // Move context into the integrand (first input block)
    const integrandPath = this.contextManager.getElementContextPath(integralElement.id, "integrand");
    this.contextManager.enterContextPath(integrandPath, 0);

    this.updateDisplay();
    this.focusHiddenInput();
  }

  // Convenience methods for specific integral types
  insertSingleIntegral(displayMode: "inline" | "display" = "inline"): void {
    this.insertIntegral("single", displayMode, false);
  }

  insertDoubleIntegral(displayMode: "inline" | "display" = "inline"): void {
    this.insertIntegral("double", displayMode, false);
  }

  insertTripleIntegral(displayMode: "inline" | "display" = "inline"): void {
    this.insertIntegral("triple", displayMode, false);
  }

  insertContourIntegral(displayMode: "inline" | "display" = "inline"): void {
    this.insertIntegral("contour", displayMode, false);
  }

  insertDefiniteIntegral(
    integralType: "single" | "double" | "triple" | "contour" = "single",
    displayMode: "inline" | "display" = "inline",
    limitMode: "nolimits" | "limits" = "nolimits"
  ): void {
    this.insertIntegral(integralType, displayMode, true, limitMode);
  }

  // Legacy method - redirects to new implementation
  insertIndefiniteIntegral(displayMode: "inline" | "display" = "inline"): void {
    // Use the new integral method
    this.insertSingleIntegral(displayMode);
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

  private isMatrixCellPath(contextPath: string): boolean {
    return /\/cell_\d+_\d+$/.test(contextPath);
  }

  private getMatrixElementFromCellPath(cellPath: string): { matrixPath: string; matrixElement: any } | null {
    const match = cellPath.match(/^(.*?)\/cell_\d+_\d+$/);
    if (!match) return null;
    
    const matrixPath = match[1];
    
    // Find the matrix element by traversing the path
    const pathParts = matrixPath.split('/');
    let currentContext = this.equationBuilder.getEquation();
    
    // Skip 'root' if present
    let startIndex = pathParts[0] === 'root' ? 1 : 0;
    
    for (let i = startIndex; i < pathParts.length; i++) {
      const part = pathParts[i];
      const element = currentContext.find((el: any) => el.id === part);
      
      if (!element) return null;
      
      if (i === pathParts.length - 1) {
        // This should be the matrix element
        if (element.type === 'matrix') {
          return { matrixPath, matrixElement: element };
        }
      } else {
        // Navigate deeper into the structure
        const nextPart = pathParts[i + 1];
        currentContext = (element as any)[nextPart];
        if (!currentContext) return null;
      }
    }
    
    return null;
  }

  selectEntireMatrix(): void {
    const currentPath = this.contextManager.getActiveContextPath();
    if (!currentPath || !this.isMatrixCellPath(currentPath)) {
      return;
    }
    
    const matrixInfo = this.getMatrixElementFromCellPath(currentPath);
    if (!matrixInfo) return;
    
    // Use Ctrl+Space functionality to select the entire matrix structure
    if (this.contextManager.selectStructureAtCursor()) {
      this.updateDisplay();
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

    // Check if selection already has cancel formatting
    const isAlreadyCancelled = this.contextManager.isSelectionCancel();
    
    if (isAlreadyCancelled) {
      // Remove cancel formatting
      this.contextManager.removeWrapperFormattingFromSelection("cancel");
    } else {
      // Apply cancel formatting
      const success = this.contextManager.applyWrapperFormattingToSelection({ cancel: true });
      
      if (!success) {
        console.warn("Failed to apply cancel formatting");
      }
    }

    this.updateDisplay();
  }

  setUnderlineStyle(underlineType: "none" | "single" | "double"): void {
    if (!this.contextManager.hasSelection()) {
      return;
    }
    
    if (underlineType === "none") {
      // Remove underline wrapper formatting
      this.contextManager.removeWrapperFormattingFromSelection("underline");
    } else {
      // Check if selection already has the same underline style
      const currentUnderline = this.contextManager.isSelectionUnderlined();
      
      if (currentUnderline === underlineType) {
        // Toggle off if clicking the same style
        this.contextManager.removeWrapperFormattingFromSelection("underline");
      } else {
        // Apply new underline style (will replace any existing underline)
        this.contextManager.applyWrapperFormattingToSelection({
          underline: underlineType as "single" | "double",
        });
      }
    }

    this.updateDisplay();
  }

  getSelectionFormatting(): { bold?: boolean; italic?: boolean; underline?: string | boolean; cancel?: boolean; color?: string } | null {
    return this.contextManager.getSelectionFormatting();
  }

  setTextColor(color: string): void {
    if (!this.contextManager.hasSelection()) {
      return;
    }
    
    // If black is selected, remove color formatting (toggle off)
    if (color === "black" || color === "#000000") {
      this.contextManager.removeWrapperFormattingFromSelection("color");
    } else {
      // Use wrapper formatting for color to enable structural-level coloring
      this.contextManager.applyWrapperFormattingToSelection({ color: color });
    }
    
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

  setDifferentialStyle(style: "italic" | "roman"): void {
    this.differentialStyle = style;
  }

  setInlineStyle(isInline: boolean): void {
    this.isInlineStyle = isInline;
  }

  updateExistingEquationStyle(isInline: boolean): void {
    // This would update existing equations to reflect the new style
    // For now, new equations will use the selected style
    this.updateDisplay();
  }

  updateExistingDifferentialStyle(style: "italic" | "roman"): void {
    // Find all existing 'd' elements in the equation and update their style
    const equation = this.equationBuilder.getEquation();
    this.updateDifferentialStyleRecursive(equation, style);
    
    // Refresh the display to show the changes
    this.updateDisplay();
  }

  private updateDifferentialStyleRecursive(elements: EquationElement[], style: "italic" | "roman"): void {
    elements.forEach(element => {
      // Check if this is a 'd' text element
      if (element.type === "text" && element.value === "d") {
        if (style === "roman") {
          element.italic = false;
        } else {
          // Remove the italic property to use default behavior
          delete element.italic;
        }
      }
      
      // Recursively check child elements
      if (element.numerator) this.updateDifferentialStyleRecursive(element.numerator, style);
      if (element.denominator) this.updateDifferentialStyleRecursive(element.denominator, style);
      if (element.radicand) this.updateDifferentialStyleRecursive(element.radicand, style);
      if (element.index) this.updateDifferentialStyleRecursive(element.index, style);
      if (element.base) this.updateDifferentialStyleRecursive(element.base, style);
      if (element.superscript) this.updateDifferentialStyleRecursive(element.superscript, style);
      if (element.subscript) this.updateDifferentialStyleRecursive(element.subscript, style);
      if (element.content) this.updateDifferentialStyleRecursive(element.content, style);
      if (element.lowerLimit) this.updateDifferentialStyleRecursive(element.lowerLimit, style);
      if (element.upperLimit) this.updateDifferentialStyleRecursive(element.upperLimit, style);
      if (element.operand) this.updateDifferentialStyleRecursive(element.operand, style);
    });
  }

  insertDerivative(type: "first" | "second" | "nth", displayMode?: "display" | "inline"): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Create derivative element with appropriate order
    let order: number | EquationElement[];
    if (type === "first") {
      order = 1;
    } else if (type === "second") {
      order = 2;
    } else {
      // nth derivative
      order = [];
    }

    const derivative = this.equationBuilder.createDerivativeElement(
      order,
      displayMode === "inline" ? "inline" : "display"
    );

    // Insert the derivative element
    this.contextManager.insertElementAtCursor(derivative);

    // Move cursor to appropriate position for user input
    let targetPath: string;
    if (type === "nth") {
      // Move to the order input for nth derivative
      targetPath = this.contextManager.getElementContextPath(derivative.id, "order");
      this.contextManager.enterContextPath(targetPath, 0);
    } else {
      // Move to function input
      targetPath = this.contextManager.getElementContextPath(derivative.id, "function");
      this.contextManager.enterContextPath(targetPath, 0);
    }
    this.updateDisplay();
    this.equationBuilder.updateParenthesesScaling();
    this.focusHiddenInput();
  }

  insertDerivativeLongForm(type: "first" | "nth", displayMode?: "display" | "inline"): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Create derivative element with appropriate order and long form flag
    let order: number | EquationElement[];
    if (type === "first") {
      order = 1;
    } else {
      // nth derivative
      order = [];
    }

    const derivative = this.equationBuilder.createDerivativeElement(
      order,
      displayMode === "inline" ? "inline" : "display",
      true // isLongForm flag
    );

    // Insert the derivative element
    this.contextManager.insertElementAtCursor(derivative);

    // Move cursor to appropriate position for user input
    let targetPath: string;
    if (type === "nth") {
      // Move to the order input for nth derivative
      targetPath = this.contextManager.getElementContextPath(derivative.id, "order");
      this.contextManager.enterContextPath(targetPath, 0);
    } else {
      // Move to the variable input first (the d/dx part)
      targetPath = this.contextManager.getElementContextPath(derivative.id, "variable");
      this.contextManager.enterContextPath(targetPath, 0);
    }
    this.updateDisplay();
    this.equationBuilder.updateParenthesesScaling();
    this.focusHiddenInput();
  }

  getDifferentialStyleForLatex(): boolean {
    // Return true if roman style should use physics package, false for italic/standard LaTeX
    return this.differentialStyle === "roman";
  }

  createMatrix(rows: number, cols: number, matrixType: "parentheses" | "brackets" | "braces" | "bars" | "double-bars" | "none"): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    // Create matrix element with empty cells
    const matrixElement = this.equationBuilder.createMatrixElement(rows, cols, matrixType);

    // Get the current context path before insertion
    const currentContextPath = this.contextManager.getActiveContextPath() || "root";
    
    // Insert matrix into equation
    this.contextManager.insertElementAtCursor(matrixElement);

    // Navigate to first cell (top-left)
    const matrixPath = `${currentContextPath}/${matrixElement.id}`;
    this.contextManager.enterContextPath(`${matrixPath}/cell_0_0`, 0);

    this.updateDisplay();
    this.equationBuilder.updateParenthesesScaling();
    this.focusHiddenInput();
  }
}