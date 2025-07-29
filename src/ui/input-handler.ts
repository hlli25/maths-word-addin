import { EquationBuilder } from '../core/equation-builder';
import { ContextManager } from '../core/context-manager';
import { DisplayRenderer } from './display-renderer';

export class InputHandler {
  private equationBuilder: EquationBuilder;
  private contextManager: ContextManager;
  private displayRenderer: DisplayRenderer;
  private displayElement: HTMLElement;

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
      this.contextManager.moveCursor(-1);
      this.updateDisplay();
    } else if (key === "ArrowRight") {
      e.preventDefault();
      this.contextManager.moveCursor(1);
      this.updateDisplay();
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      this.contextManager.navigateUpDown(key);
      this.updateDisplay();
    } else if (key === "Tab") {
      e.preventDefault();
      this.contextManager.navigateUpDown(e.shiftKey ? "ArrowUp" : "ArrowDown");
      this.updateDisplay();
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
    const equationContainer = target.closest(".equation-container") as HTMLElement;

    if (equationContainer) {
      const path = equationContainer.dataset.contextPath;
      if (path) {
        this.contextManager.enterContextPath(path);
        const context = this.contextManager.getContext(path);
        if (context) {
          this.contextManager.setCursorPosition(context.array.length);
        }
      } else {
        this.contextManager.enterRootContext();
      }
    } else {
      this.contextManager.enterRootContext();
    }

    this.focusHiddenInput();
    this.updateDisplay();
  }

  handleDocumentClick(event: Event): void {
    const display = this.displayElement;
    const tabPanel = document.querySelector(".tab-panel");
    const target = event.target as HTMLElement;

    if (
      this.contextManager.isActive() &&
      display &&
      !display.contains(target) &&
      tabPanel &&
      !tabPanel.contains(target)
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

    this.contextManager.insertTextAtCursor(operator);
    this.updateDisplay();
    this.focusHiddenInput();
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

  insertBracket(bracketType: "parentheses" | "square" | "curly" | "floor" | "ceiling" | "vertical" | "double-vertical"): void {
    if (!this.contextManager.isActive()) {
      this.contextManager.enterRootContext();
    }

    const bracketElement = this.equationBuilder.createBracketElement(bracketType);
    this.contextManager.insertElementAtCursor(bracketElement);

    // Move context into the new bracket's content
    const contentPath = this.contextManager.getElementContextPath(bracketElement.id, "content");
    this.contextManager.enterContextPath(contentPath, 0);

    this.updateDisplay();
  }

  private handleBackspace(): void {
    if (this.contextManager.handleBackspace()) {
      this.updateDisplay();
      this.equationBuilder.updateParenthesesScaling();
    }
  }

  private handleDelete(): void {
    if (this.contextManager.handleDelete()) {
      this.updateDisplay();
      this.equationBuilder.updateParenthesesScaling();
    }
  }

  private updateDisplay(): void {
    this.displayRenderer.updateDisplay(this.displayElement, this.equationBuilder.getEquation());
    
    // Ensure the hidden input is focused if we are in an active context
    if (this.contextManager.isActive()) {
      this.focusHiddenInput();
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
}