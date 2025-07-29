/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

// Core modules
import { EquationBuilder } from '../core/equation-builder';
import { LatexConverter } from '../core/latex-converter';
import { ContextManager } from '../core/context-manager';

// UI modules
import { DisplayRenderer } from '../ui/display-renderer';
import { InputHandler } from '../ui/input-handler';
import { TabController } from '../ui/tab-controller';

// Integration modules
import { MathJaxService } from '../integration/mathjax-service';
import { OfficeService } from '../integration/office-service';
import { SvgProcessor } from '../integration/svg-processor';

// Application state
class MathAddinApp {
  private equationBuilder: EquationBuilder;
  private latexConverter: LatexConverter;
  private contextManager: ContextManager;
  private displayRenderer: DisplayRenderer;
  private inputHandler: InputHandler;
  private tabController: TabController;
  private mathJaxService: MathJaxService;
  private officeService: OfficeService;
  private svgProcessor: SvgProcessor;

  constructor() {
    this.equationBuilder = new EquationBuilder();
    this.latexConverter = new LatexConverter();
    this.latexConverter.setEquationBuilder(this.equationBuilder);
    this.contextManager = new ContextManager(this.equationBuilder);
    this.displayRenderer = new DisplayRenderer(this.contextManager);
    this.mathJaxService = new MathJaxService();
    this.officeService = new OfficeService(this.equationBuilder, this.latexConverter);
    this.svgProcessor = new SvgProcessor();
  }

  async initialize(): Promise<void> {
    // Wait for MathJax to be ready
    await this.mathJaxService.waitForMathJaxReady();

    // Get DOM elements
    const elements = this.getDOMElements();
    if (!elements) {
      console.error("One or more critical elements are missing from the DOM.");
      return;
    }

    // Initialize UI modules
    this.inputHandler = new InputHandler(
      this.equationBuilder,
      this.contextManager,
      this.displayRenderer,
      elements.equationDisplay
    );

    this.tabController = new TabController(elements.tabNav, elements.tabContent);

    // Set up event listeners
    this.setupEventListeners(elements);

    // Set up Office integration
    this.officeService.setEquationLoadedCallback((latex: string) => this.handleEquationLoaded(latex));
    this.officeService.setupEquationImageHandler();

    // Initialize display
    this.displayRenderer.updateDisplay(elements.equationDisplay, this.equationBuilder.getEquation());
  }

  private getDOMElements() {
    const insertButton = document.getElementById("insert-equation-button") as HTMLButtonElement;
    const clearButton = document.getElementById("clear-equation-button") as HTMLButtonElement;
    const statusDiv = document.getElementById("status") as HTMLDivElement;
    const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
    const equationDisplay = document.getElementById("equationDisplay") as HTMLDivElement;
    const tabNav = document.querySelector(".tab-nav") as HTMLDivElement;
    const tabContent = document.querySelector(".tab-content") as HTMLDivElement;
    const fontSizeInput = document.getElementById("fontSizeInput") as HTMLInputElement;

    if (!insertButton || !clearButton || !statusDiv || !hiddenInput || 
        !equationDisplay || !tabNav || !tabContent || !fontSizeInput) {
      return null;
    }

    return {
      insertButton,
      clearButton,
      statusDiv,
      hiddenInput,
      equationDisplay,
      tabNav,
      tabContent,
      fontSizeInput
    };
  }

  private setupEventListeners(elements: ReturnType<MathAddinApp['getDOMElements']>) {
    if (!elements) return;

    // Primary action buttons
    elements.insertButton.addEventListener("click", () => this.handleInsertEquation(elements.statusDiv));
    elements.clearButton.addEventListener("click", () => this.handleClearEquation());

    // Input handling
    elements.hiddenInput.addEventListener("keydown", (e) => this.inputHandler.handleKeyPress(e));
    elements.hiddenInput.addEventListener("input", (e) => this.inputHandler.handleInput(e));

    // Font size handling
    elements.fontSizeInput.addEventListener("input", (e) => this.inputHandler.handleFontSizeChange(e));

    // Builder buttons (using event delegation)
    elements.tabContent.addEventListener("click", (e) => this.handleBuilderButtonClick(e));

    // Display click handling
    elements.equationDisplay.addEventListener("click", (e) => this.inputHandler.handleDisplayClick(e));

    // Document click handling for exiting edit mode
    document.addEventListener("click", (e) => this.inputHandler.handleDocumentClick(e));
  }

  private handleBuilderButtonClick(e: Event): void {
    const target = e.target as HTMLElement;
    const button = target.closest("button.builder-btn");
    if (!button) return;

    if (button.classList.contains("fraction-btn")) {
      this.inputHandler.insertFraction();
    } else if (button.classList.contains("bevelled-fraction-btn")) {
      this.inputHandler.insertBevelledFraction();
    } else if (button.classList.contains("operator-btn")) {
      const operator = (button as HTMLElement).dataset.operator || "";
      this.inputHandler.insertOperator(operator);
    } else if (button.classList.contains("sqrt-btn")) {
      this.inputHandler.insertSquareRoot();
    } else if (button.classList.contains("nthroot-btn")) {
      this.inputHandler.insertNthRoot();
    } else if (button.classList.contains("sup-btn")) {
      this.inputHandler.insertScript("superscript");
    } else if (button.classList.contains("sub-btn")) {
      this.inputHandler.insertScript("subscript");
    } else if (button.classList.contains("sup-sub-btn")) {
      this.inputHandler.insertSuperscriptSubscript();
    } else if (button.classList.contains("custom-bracket-btn")) {
      this.handleCustomBracketInsertion();
    }
  }

  private handleClearEquation(): void {
    this.equationBuilder.clear();
    this.contextManager.exitEditingMode();
    this.contextManager.setCursorPosition(0);
    
    const equationDisplay = document.getElementById("equationDisplay") as HTMLDivElement;
    if (equationDisplay) {
      this.displayRenderer.updateDisplay(equationDisplay, this.equationBuilder.getEquation());
    }
  }

  private handleCustomBracketInsertion(): void {
    const leftSelect = document.getElementById("leftBracketSelect") as HTMLSelectElement;
    const rightSelect = document.getElementById("rightBracketSelect") as HTMLSelectElement;
    
    if (!leftSelect || !rightSelect) {
      console.error("Bracket select elements not found");
      return;
    }

    const leftBracket = leftSelect.value;
    const rightBracket = rightSelect.value;

    this.inputHandler.insertCustomBrackets(leftBracket, rightBracket);
  }

  private async handleEquationLoaded(latex: string): Promise<void> {
    // Enter editing mode
    this.contextManager.enterRootContext();
    
    // Update the display
    const equationDisplay = document.getElementById("equationDisplay") as HTMLDivElement;
    if (equationDisplay) {
      this.displayRenderer.updateDisplay(equationDisplay, this.equationBuilder.getEquation());
    }
    
    // Focus the hidden input for editing
    const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
    if (hiddenInput) {
      hiddenInput.focus();
    }

    // Show status feedback
    const statusDiv = document.getElementById("status") as HTMLDivElement;
    if (statusDiv) {
      statusDiv.textContent = "Equation loaded for editing!";
      setTimeout(() => {
        statusDiv.textContent = "";
      }, 3000);
    }
  }

  private async handleInsertEquation(statusDiv: HTMLDivElement): Promise<void> {
    const insertButton = document.getElementById("insert-equation-button") as HTMLButtonElement;
    const fontSize = this.displayRenderer.getGlobalFontSize();

    if (this.equationBuilder.isEmpty()) {
      statusDiv.textContent = "Please create an equation first.";
      return;
    }

    try {
      // Update UI state
      insertButton.disabled = true;
      insertButton.querySelector(".ms-Button-label")!.textContent = "Inserting...";
      statusDiv.textContent = "Converting to LaTeX...";

      // Convert equation to LaTeX
      const latex = this.latexConverter.convertToLatex(this.equationBuilder.getEquation());
      if (!latex) {
        throw new Error("Equation is empty or invalid.");
      }
      console.log("LaTeX:", latex);

      // Render LaTeX using MathJax
      statusDiv.textContent = "Rendering equation...";
      const svgElement = await this.mathJaxService.renderLatexToSvg(latex);

      // Extract positioning information
      const positionInfo = this.mathJaxService.extractSvgPositionInfo(svgElement);
      console.log("SVG Position Info:", positionInfo);

      // Prepare SVG for Office
      statusDiv.textContent = "Preparing for Word...";
      const { svgString, width, height, baselineOffsetPt } = this.svgProcessor.prepareSvgForOffice(
        svgElement, 
        fontSize, 
        positionInfo
      );
      
      console.log("Calculated baseline offset:", baselineOffsetPt, "pt");

      // Insert into Word
      statusDiv.textContent = "Inserting into Word...";
      await this.officeService.insertEquationToWord(svgString, width, height, baselineOffsetPt, latex);


      statusDiv.textContent = "Equation inserted.";

      // Clear equation after successful insertion
      this.handleClearEquation();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      console.error("Error inserting equation:", error);
      statusDiv.textContent = `Error: ${errorMessage}`;
    } finally {
      // Reset button state
      insertButton.disabled = false;
      insertButton.querySelector(".ms-Button-label")!.textContent = "Insert Equation";

      // Clear status message after delay
      setTimeout(() => {
        if (!statusDiv.textContent?.includes("Error")) {
          statusDiv.textContent = "";
        }
      }, 3000);
    }
  }
}

// Global app instance
let app: MathAddinApp;

Office.onReady((info) => {
  if (info.host === Office.HostType.Word) {
    app = new MathAddinApp();
    
    app.initialize()
      .then(() => {
        console.log("Math Add-in initialized successfully");
      })
      .catch((error) => {
        console.error("Math Add-in initialization failed:", error);
        const statusDiv = document.getElementById("status") as HTMLDivElement;
        if (statusDiv) {
          statusDiv.textContent = "Error: Could not initialize the add-in.";
        }
      });
  }
});