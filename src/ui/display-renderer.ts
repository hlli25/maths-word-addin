import { EquationElement } from '../core/equation-builder';
import { ContextManager } from '../core/context-manager';

export class DisplayRenderer {
  private contextManager: ContextManager;
  private globalFontSize: number = 12;

  constructor(contextManager: ContextManager) {
    this.contextManager = contextManager;
  }

  setGlobalFontSize(size: number): void {
    this.globalFontSize = size;
  }

  getGlobalFontSize(): number {
    return this.globalFontSize;
  }

  renderEquation(elements: EquationElement[]): string {
    const activeContextPath = this.contextManager.getActiveContextPath();
    
    if (activeContextPath === null && elements.length === 0) {
      return '<span class="empty-state">Click here and start typing your equation</span>';
    }

    return this.buildEquationHtml(elements, "root");
  }

  updateDisplay(displayElement: HTMLElement, elements: EquationElement[]): void {
    const activeContextPath = this.contextManager.getActiveContextPath();
    
    if (activeContextPath === null && elements.length === 0) {
      displayElement.innerHTML = '<span class="empty-state">Click here and start typing your equation</span>';
      displayElement.classList.remove("active");
      return;
    }

    displayElement.classList.toggle("active", activeContextPath !== null);
    
    // Wrap root content in a container with proper context path
    const rootContent = this.buildEquationHtml(elements, "root");
    displayElement.innerHTML = `<div class="equation-container root-container" data-context-path="root">${rootContent}</div>`;

    // After rendering, ensure all fraction bars are correctly sized
    setTimeout(() => this.updateAllFractionBars(), 0);
  }

  private buildEquationHtml(elements: EquationElement[], contextPath: string): string {
    let html = "";
    const activeContextPath = this.contextManager.getActiveContextPath();
    const cursorPosition = this.contextManager.getCursorPosition();
    const selection = this.contextManager.getSelection();
    const isActive = contextPath === activeContextPath;
    const hasSelection = selection.isActive && selection.contextPath === contextPath;

    elements.forEach((element, index) => {
      if (isActive && index === cursorPosition) {
        html += '<span class="cursor"></span>';
      }

      // Check if this element is in the selection
      const isSelected = hasSelection && index >= selection.startPosition && index < selection.endPosition;
      
      if (element.type === "text") {
        html += this.renderTextElement(element, isSelected);
      } else if (element.type === "fraction") {
        html += this.renderFractionElement(element, contextPath, activeContextPath);
      } else if (element.type === "bevelled-fraction") {
        html += this.renderBevelledFractionElement(element, contextPath, activeContextPath);
      } else if (element.type === "sqrt") {
        html += this.renderSqrtElement(element, contextPath, activeContextPath);
      } else if (element.type === "nthroot") {
        html += this.renderNthRootElement(element, contextPath, activeContextPath);
      } else if (element.type === "script") {
        html += this.renderScriptElement(element, contextPath, activeContextPath);
      } else if (element.type === "bracket") {
        html += this.renderBracketElement(element, contextPath, activeContextPath);
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

  private renderTextElement(element: EquationElement, isSelected: boolean = false): string {
    const isOperator = /[+\-×÷=]/.test(element.value || "");
    const isParenthesis = /[()]/.test(element.value || "");
    const isVariable = /[a-zA-Z]/.test(element.value || "");
    const displayFontSize = this.globalFontSize * 1.5;
    
    // Build CSS classes
    let classes = "equation-element";
    if (isSelected) classes += " selected";
    
    // Build inline styles
    let styles = `font-size: ${displayFontSize}px;`;
    
    // Apply text formatting
    if (element.bold) styles += " font-weight: bold;";
    // Variables are italic by default, but not when they are bold (matches LaTeX \mathbf behavior)
    if (element.italic || (isVariable && !element.bold)) styles += " font-style: italic;";
    if (element.color) styles += ` color: ${element.color};`;
    if (element.underline) {
      if (element.underline === "single") styles += " text-decoration: underline;";
      else if (element.underline === "double") styles += " text-decoration: underline; text-decoration-style: double;";
      else if (element.underline === "wave") styles += " text-decoration: underline wavy;";
    }
    if (element.strikethrough) styles += " text-decoration: line-through;";
    
    // Handle special element types
    if (isParenthesis && element.scaleFactor && element.scaleFactor > 1) {
      classes += " parenthesis scaled";
      styles += ` --scale-factor: ${element.scaleFactor};`;
    } else if (isOperator) {
      classes += " operator";
    } else {
      classes += " text-element";
    }

    return `<span class="${classes}" style="${styles}">${element.value}</span>`;
  }

  private renderFractionElement(element: EquationElement, contextPath: string, activeContextPath: string | null): string {
    const numeratorPath = `${contextPath}/${element.id}/numerator`;
    const denominatorPath = `${contextPath}/${element.id}/denominator`;
    
    return `<span class="equation-element">
      <div class="fraction" id="${element.id}">
        <div class="equation-container numerator-container ${
          activeContextPath === numeratorPath ? "active-context" : ""
        }" data-context-path="${numeratorPath}">
          ${this.buildEquationHtml(element.numerator!, numeratorPath)}
        </div>
        <div class="fraction-bar"></div>
        <div class="equation-container denominator-container ${
          activeContextPath === denominatorPath ? "active-context" : ""
        }" data-context-path="${denominatorPath}">
          ${this.buildEquationHtml(element.denominator!, denominatorPath)}
        </div>
      </div>
    </span>`;
  }

  private renderBevelledFractionElement(element: EquationElement, contextPath: string, activeContextPath: string | null): string {
    const numeratorPath = `${contextPath}/${element.id}/numerator`;
    const denominatorPath = `${contextPath}/${element.id}/denominator`;
    
    return `<span class="equation-element">
      <div class="bevelled-fraction" id="${element.id}">
        <div class="equation-container bevelled-numerator-container ${
          activeContextPath === numeratorPath ? "active-context" : ""
        }" data-context-path="${numeratorPath}">
          ${this.buildEquationHtml(element.numerator!, numeratorPath)}
        </div>
        <span class="bevelled-slash">/</span>
        <div class="equation-container bevelled-denominator-container ${
          activeContextPath === denominatorPath ? "active-context" : ""
        }" data-context-path="${denominatorPath}">
          ${this.buildEquationHtml(element.denominator!, denominatorPath)}
        </div>
      </div>
    </span>`;
  }

  private renderSqrtElement(element: EquationElement, contextPath: string, activeContextPath: string | null): string {
    const radicandPath = `${contextPath}/${element.id}/radicand`;
    
    return `<span class="equation-element">
      <div class="sqrt" id="${element.id}">
        <span class="sqrt-symbol">√</span>
        <div class="sqrt-radicand">
          <div class="equation-container ${
            activeContextPath === radicandPath ? "active-context" : ""
          }" data-context-path="${radicandPath}">
            ${this.buildEquationHtml(element.radicand!, radicandPath)}
          </div>
        </div>
      </div>
    </span>`;
  }

  private renderNthRootElement(element: EquationElement, contextPath: string, activeContextPath: string | null): string {
    const indexPath = `${contextPath}/${element.id}/index`;
    const radicandPath = `${contextPath}/${element.id}/radicand`;
    
    return `<span class="equation-element">
      <div class="nthroot" id="${element.id}">
        <div class="nthroot-index">
          <div class="equation-container ${
            activeContextPath === indexPath ? "active-context" : ""
          }" data-context-path="${indexPath}">
            ${this.buildEquationHtml(element.index!, indexPath)}
          </div>
        </div>
        <span class="nthroot-symbol">√</span>
        <div class="nthroot-radicand">
          <div class="equation-container ${
            activeContextPath === radicandPath ? "active-context" : ""
          }" data-context-path="${radicandPath}">
            ${this.buildEquationHtml(element.radicand!, radicandPath)}
          </div>
        </div>
      </div>
    </span>`;
  }

  private renderScriptElement(element: EquationElement, contextPath: string, activeContextPath: string | null): string {
    const basePath = `${contextPath}/${element.id}/base`;
    const supPath = `${contextPath}/${element.id}/superscript`;
    const subPath = `${contextPath}/${element.id}/subscript`;
    
    const isCombined = element.superscript !== undefined && element.subscript !== undefined;
    const containerClass = isCombined ? "script-container combined-script" : "script-container";
    const baseClass = isCombined ? "base-container combined-base" : "base-container";
    const scriptsClass = isCombined ? "script-subsup combined-scripts" : "script-subsup";
    const superClass = isCombined ? "superscript-container combined-superscript" : "superscript-container";
    const subClass = isCombined ? "subscript-container combined-subscript" : "subscript-container";
    
    return `<span class="equation-element">
      <div class="${containerClass}" id="${element.id}">
        <div class="equation-container ${baseClass} ${activeContextPath === basePath ? "active-context" : ""}" data-context-path="${basePath}">${this.buildEquationHtml(element.base!, basePath)}</div>
        <div class="${scriptsClass}">
          ${element.superscript !== undefined ? `<div class="equation-container ${superClass} ${activeContextPath === supPath ? "active-context" : ""}" data-context-path="${supPath}">${this.buildEquationHtml(element.superscript, supPath)}</div>` : ""}
          ${element.subscript !== undefined ? `<div class="equation-container ${subClass} ${activeContextPath === subPath ? "active-context" : ""}" data-context-path="${subPath}">${this.buildEquationHtml(element.subscript, subPath)}</div>` : ""}
        </div>
      </div>
    </span>`;
  }

  private renderBracketElement(element: EquationElement, contextPath: string, activeContextPath: string | null): string {
    const contentPath = `${contextPath}/${element.id}/content`;
    
    // Don't display "." invisible brackets in the visual editor
    const left = (element.leftBracketSymbol === "." || !element.leftBracketSymbol) ? "" : element.leftBracketSymbol;
    const right = (element.rightBracketSymbol === "." || !element.rightBracketSymbol) ? "" : element.rightBracketSymbol;
    
    return `<span class="equation-element">
      <div class="bracket-container" id="${element.id}">
        <span class="bracket-left">${left}</span>
        <div class="equation-container bracket-content-container ${
          activeContextPath === contentPath ? "active-context" : ""
        }" data-context-path="${contentPath}">
          ${this.buildEquationHtml(element.content!, contentPath)}
        </div>
        <span class="bracket-right">${right}</span>
      </div>
    </span>`;
  }


  private updateAllFractionBars(): void {
    document.querySelectorAll(".fraction").forEach((fractionElement) => {
      const numerator = fractionElement.querySelector(".numerator-container") as HTMLElement;
      const denominator = fractionElement.querySelector(".denominator-container") as HTMLElement;
      const bar = fractionElement.querySelector(".fraction-bar") as HTMLElement;

      if (numerator && denominator && bar) {
        const numWidth = numerator.scrollWidth;
        const denWidth = denominator.scrollWidth;
        const maxWidth = Math.max(numWidth, denWidth, 20);

        bar.style.width = maxWidth + "px";
      }
    });
  }
}