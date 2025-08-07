/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

// Core modules
import { EquationBuilder } from '../core/equation-builder';
import { LatexConverter } from '../core/latex-converter';
import { ContextManager } from '../core/context-manager';
import { FontMeasurementService } from '../core/font-measurement';

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
  private fontMeasurementService: FontMeasurementService;
  private currentColor: string = "#000000";
  private currentUnderlineStyle: string = "single";

  constructor() {
    this.equationBuilder = new EquationBuilder();
    this.latexConverter = new LatexConverter();
    this.latexConverter.setEquationBuilder(this.equationBuilder);
    this.contextManager = new ContextManager(this.equationBuilder);
    this.displayRenderer = new DisplayRenderer(this.contextManager);
    this.mathJaxService = new MathJaxService();
    this.officeService = new OfficeService(this.equationBuilder, this.latexConverter);
    this.svgProcessor = new SvgProcessor();
    this.fontMeasurementService = new FontMeasurementService();
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

    // Set up selection change callback
    this.inputHandler.onSelectionChange = () => this.updateFormattingUIBasedOnSelection();

    this.tabController = new TabController(elements.tabNav, elements.tabContent);

    // Set up event listeners
    this.setupEventListeners(elements);

    // Set up Office integration
    this.officeService.setEquationLoadedCallback((latex: string) => this.handleEquationLoaded(latex));
    this.officeService.setupEquationImageHandler();

    // Initialize display
    this.displayRenderer.updateDisplay(elements.equationDisplay, this.equationBuilder.getEquation());
    
    // Initialize color previews
    this.updateColorPreview(this.currentColor);
    this.updateHexColorPreview(this.currentColor);
    elements.hexInput.value = this.currentColor;
    
    // Measure and set font scaling for inline-limits operators
    try {
      await this.fontMeasurementService.measureAndSetScaleRatios();
      console.log('Font measurement completed');
    } catch (error) {
      console.error('Font measurement failed:', error);
    }
    
    // Expose debug functions to window for console testing
    (window as any).testMathJaxColors = () => this.mathJaxService.testColorRendering();
    (window as any).remeasureFont = () => this.fontMeasurementService.measureAndSetScaleRatios();
    (window as any).getCurrentFontRatios = () => this.fontMeasurementService.getCurrentRatios();
    (window as any).getSumRatio = () => this.fontMeasurementService.getCurrentRatio('sum');
  }

  private getDOMElements() {
    const insertButton = document.getElementById("insert-equation-button") as HTMLButtonElement;
    const clearButton = document.getElementById("clear-equation-button") as HTMLButtonElement;
    const statusDiv = document.getElementById("status") as HTMLDivElement;
    const hiddenInput = document.getElementById("hiddenInput") as HTMLInputElement;
    const equationDisplay = document.getElementById("equationDisplay") as HTMLDivElement;
    const tabNav = document.querySelector(".tab-nav") as HTMLDivElement;
    const tabContent = document.querySelector(".tab-content") as HTMLDivElement;
    
    // Font and formatting controls
    const fontSizeInput = document.getElementById("fontSizeInput") as HTMLInputElement;
    const fontSizeDropdownBtn = document.getElementById("fontSizeDropdownBtn") as HTMLButtonElement;
    const fontSizeDropdown = document.getElementById("fontSizeDropdown") as HTMLDivElement;
    const boldBtn = document.getElementById("boldBtn") as HTMLButtonElement;
    const italicBtn = document.getElementById("italicBtn") as HTMLButtonElement;
    const underlineBtn = document.getElementById("underlineBtn") as HTMLButtonElement;
    const underlineDropdownBtn = document.getElementById("underlineDropdownBtn") as HTMLButtonElement;
    const cancelBtn = document.getElementById("cancelBtn") as HTMLButtonElement;
    const colorBtn = document.getElementById("colorBtn") as HTMLButtonElement;
    const colorDropdownBtn = document.getElementById("colorDropdownBtn") as HTMLButtonElement;
    const underlineDropdown = document.getElementById("underlineDropdown") as HTMLDivElement;
    const colorPanel = document.getElementById("colorPanel") as HTMLDivElement;
    const colorPreview = document.getElementById("colorPreview") as HTMLDivElement;
    const hexInput = document.getElementById("hexInput") as HTMLInputElement;
    const hexColorPreview = document.getElementById("hexColorPreview") as HTMLDivElement;
    const colorOkBtn = document.getElementById("colorOkBtn") as HTMLButtonElement;
    const colorCancelBtn = document.getElementById("colorCancelBtn") as HTMLButtonElement;

    if (!insertButton || !clearButton || !statusDiv || !hiddenInput || 
        !equationDisplay || !tabNav || !tabContent ||
        !fontSizeInput || !fontSizeDropdownBtn || !fontSizeDropdown || !boldBtn || !italicBtn ||
        !underlineBtn || !underlineDropdownBtn || !cancelBtn || !colorBtn || !colorDropdownBtn || !underlineDropdown ||
        !colorPanel || !colorPreview || !hexInput || !hexColorPreview || !colorOkBtn || !colorCancelBtn) {
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
      fontSizeInput,
      fontSizeDropdownBtn,
      fontSizeDropdown,
      boldBtn,
      italicBtn,
      underlineBtn,
      underlineDropdownBtn,
      cancelBtn,
      colorBtn,
      colorDropdownBtn,
      underlineDropdown,
      colorPanel,
      colorPreview,
      hexInput,
      hexColorPreview,
      colorOkBtn,
      colorCancelBtn
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
    elements.fontSizeDropdownBtn.addEventListener("click", (e) => this.handleFontSizeDropdownClick(e));
    elements.fontSizeDropdown.addEventListener("click", (e) => this.handleFontSizeOptionClick(e));
    
    // Format button handlers
    elements.boldBtn.addEventListener("click", () => this.inputHandler.toggleBold());
    elements.italicBtn.addEventListener("click", () => this.inputHandler.toggleItalic());
    elements.underlineBtn.addEventListener("click", () => this.handleUnderlineApply());
    elements.underlineDropdownBtn.addEventListener("click", (e) => this.handleUnderlineDropdownClick(e));
    elements.cancelBtn.addEventListener("click", () => this.inputHandler.toggleCancel());
    elements.colorBtn.addEventListener("click", () => this.handleColorApply());
    elements.colorDropdownBtn.addEventListener("click", (e) => this.handleColorDropdownClick(e));
    
    // Color panel handlers
    elements.colorPanel.addEventListener("click", (e) => this.handleColorPanelClick(e));
    elements.colorOkBtn.addEventListener("click", () => this.handleColorOk());
    elements.colorCancelBtn.addEventListener("click", () => this.handleColorCancel());
    elements.hexInput.addEventListener("input", (e) => this.handleHexInputChange(e));
    
    // Underline dropdown handlers
    elements.underlineDropdown.addEventListener("click", (e) => this.handleUnderlineOptionClick(e));
    
    // Close dropdowns when clicking outside
    document.addEventListener("click", (e) => this.handleOutsideClick(e, elements));

    // Builder buttons (using event delegation)
    elements.tabContent.addEventListener("click", (e) => this.handleBuilderButtonClick(e));

    // Format buttons (using event delegation)
    document.addEventListener("click", (e) => this.handleFormatButtonClick(e));

    // Display click handling
    elements.equationDisplay.addEventListener("mousedown", (e) => this.inputHandler.handleMouseDown(e));
    elements.equationDisplay.addEventListener("mousemove", (e) => this.inputHandler.handleMouseMove(e));
    elements.equationDisplay.addEventListener("mouseup", (e) => this.inputHandler.handleMouseUp(e));

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
    } else if (button.classList.contains("bracket-preset-btn")) {
      const bracketType = (button as HTMLElement).dataset.bracket || "";
      this.handlePresetBracketInsertion(bracketType);
    } else if (button.classList.contains("custom-bracket-btn")) {
      this.handleCustomBracketInsertion();
    } else if (button.classList.contains("sum-nolimit-btn")) {
      this.inputHandler.insertLargeOperator("∑", "inline", "nolimits");
    } else if (button.classList.contains("sum-limit-btn")) {
      this.inputHandler.insertLargeOperator("∑", "inline", "limits");
    } else if (button.classList.contains("sum-display-nolimit-btn")) {
      this.inputHandler.insertLargeOperator("∑", "display", "nolimits");
    } else if (button.classList.contains("sum-display-limit-btn")) {
      this.inputHandler.insertLargeOperator("∑", "display", "limits");
    }
  }

  private handleFormatButtonClick(e: Event): void {
    const target = e.target as HTMLElement;
    const button = target.closest("button.format-btn");
    if (!button) return;

    // Format button handling is done through specific event listeners
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

  private handlePresetBracketInsertion(bracketType: string): void {
    let leftBracket = "";
    let rightBracket = "";
    
    switch(bracketType) {
      case "()":
        leftBracket = "(";
        rightBracket = ")";
        break;
      case "[]":
        leftBracket = "[";
        rightBracket = "]";
        break;
      case "{}":
        leftBracket = "{";
        rightBracket = "}";
        break;
      case "⌊⌋":
        leftBracket = "⌊";
        rightBracket = "⌋";
        break;
      case "⌈⌉":
        leftBracket = "⌈";
        rightBracket = "⌉";
        break;
      case "||":
        leftBracket = "|";
        rightBracket = "|";
        break;
      case "‖‖":
        leftBracket = "‖";
        rightBracket = "‖";
        break;
      case "⟨⟩":
        leftBracket = "⟨";
        rightBracket = "⟩";
        break;
    }
    
    if (leftBracket || rightBracket) {
      this.inputHandler.insertCustomBrackets(leftBracket, rightBracket);
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


  private handleFontSizeDropdownClick(e: Event): void {
    e.stopPropagation();
    const dropdown = document.getElementById("fontSizeDropdown") as HTMLDivElement;
    const isVisible = dropdown.classList.contains("show");
    
    // Close all other dropdowns
    this.closeAllDropdowns();
    
    if (!isVisible) {
      dropdown.classList.add("show");
      
      // Highlight current size in dropdown
      const currentSize = document.getElementById("fontSizeInput") as HTMLInputElement;
      const currentValue = currentSize.value;
      
      document.querySelectorAll(".font-size-option").forEach(option => {
        option.classList.remove("selected");
        if (option.getAttribute("data-size") === currentValue) {
          option.classList.add("selected");
        }
      });
    }
  }

  private handleFontSizeOptionClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("font-size-option")) return;
    
    const fontSize = target.getAttribute("data-size");
    if (fontSize) {
      const fontSizeInput = document.getElementById("fontSizeInput") as HTMLInputElement;
      fontSizeInput.value = fontSize;
      
      // Trigger the input event to update the display
      const event = new Event("input", { bubbles: true });
      fontSizeInput.dispatchEvent(event);
      
      // Update selection display
      document.querySelectorAll(".font-size-option").forEach(opt => opt.classList.remove("selected"));
      target.classList.add("selected");
    }
    
    this.closeAllDropdowns();
  }

  private handleUnderlineApply(): void {
    // Check if all selected text is underlined with the same style
    const formatting = this.inputHandler.getSelectionFormatting();
    
    if (formatting && formatting.underline && formatting.underline !== 'none') {
      // All selected text is underlined - remove underlines
      this.inputHandler.setUnderlineStyle('none');
      this.updateUnderlineUI('none');
    } else {
      // Apply the current underline style
      this.inputHandler.setUnderlineStyle(this.currentUnderlineStyle);
      this.updateUnderlineUI(this.currentUnderlineStyle);
    }
  }

  private handleUnderlineDropdownClick(e: Event): void {
    e.stopPropagation();
    const underlineDropdown = document.getElementById("underlineDropdown") as HTMLDivElement;
    const isVisible = underlineDropdown.classList.contains("show");
    
    // Close all other dropdowns
    this.closeAllDropdowns();
    
    if (!isVisible) {
      underlineDropdown.classList.add("show");
    }
  }

  private handleUnderlineOptionClick(e: Event): void {
    e.stopPropagation();
    e.preventDefault();
    
    const target = e.target as HTMLElement;
    const optionElement = target.closest('.underline-option') as HTMLElement;
    if (!optionElement) return;
    
    const underlineType = optionElement.dataset.underline;
    if (underlineType) {
      // Update current underline style and apply immediately
      this.currentUnderlineStyle = underlineType;
      this.inputHandler.setUnderlineStyle(underlineType);
      
      // Update UI
      this.updateUnderlineUI(underlineType);
      
      // Auto-close the dropdown
      this.closeAllDropdowns();
    }
  }

  private updateUnderlineUI(underlineType: string): void {
    const button = document.getElementById("underlineBtn") as HTMLButtonElement;
    
    // Update button active state
    if (underlineType === "none") {
      button.classList.remove("active");
    } else {
      button.classList.add("active");
    }
    
    // Update dropdown selection
    document.querySelectorAll(".underline-option").forEach(opt => opt.classList.remove("selected"));
    const selectedOption = document.querySelector(`[data-underline="${underlineType}"]`);
    if (selectedOption) {
      selectedOption.classList.add("selected");
    }
  }

  private updateFormattingUIBasedOnSelection(): void {
    const formatting = this.inputHandler.getSelectionFormatting();
    
    if (formatting) {
      // Update underline UI based on selection
      if (formatting.underline !== undefined) {
        const underlineType = formatting.underline === true ? 'single' : 
                             formatting.underline === false ? 'none' : 
                             formatting.underline;
        
        this.updateUnderlineUI(underlineType);
        this.currentUnderlineStyle = underlineType === 'none' ? 'single' : underlineType;
      } else {
        // Mixed underline types - show none selected
        this.updateUnderlineUI('none');
      }
    }
  }

  private handleColorApply(): void {
    // Apply the current color directly to selected text
    this.inputHandler.setTextColor(this.currentColor);
  }

  private handleColorDropdownClick(e: Event): void {
    e.stopPropagation();
    const colorPanel = document.getElementById("colorPanel") as HTMLDivElement;
    const isVisible = colorPanel.classList.contains("show");
    
    // Close all other dropdowns
    this.closeAllDropdowns();
    
    if (!isVisible) {
      colorPanel.classList.add("show");
    }
  }

  private handleColorPanelClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.classList.contains("color-square")) {
      const color = target.dataset.color;
      if (color) {
        // Update current color and apply immediately
        this.currentColor = color;
        this.updateColorPreview(color);
        this.inputHandler.setTextColor(color);
        
        // Update hex input (but don't trigger onChange)
        const hexInput = document.getElementById("hexInput") as HTMLInputElement;
        hexInput.value = color;
        this.updateHexColorPreview(color);
        
        // Update selection display
        document.querySelectorAll(".color-square").forEach(sq => sq.classList.remove("selected"));
        target.classList.add("selected");
        
        // Auto-close the panel
        this.closeAllDropdowns();
      }
    }
  }

  private handleColorOk(): void {
    const hexInput = document.getElementById("hexInput") as HTMLInputElement;
    let color = hexInput.value.trim();
    
    // Validate hex color
    if (!color.startsWith("#")) {
      color = "#" + color;
    }
    
    if (this.isValidHexColor(color)) {
      this.selectColor(color);
      this.closeAllDropdowns();
    } else {
      // Show error or reset to valid color
      hexInput.style.borderColor = "#ff0000";
      setTimeout(() => {
        hexInput.style.borderColor = "";
      }, 2000);
    }
  }

  private handleColorCancel(): void {
    // Reset hex input to current color
    const colorPreview = document.getElementById("colorPreview") as HTMLDivElement;
    const currentColor = colorPreview.style.backgroundColor || "#000000";
    const hexInput = document.getElementById("hexInput") as HTMLInputElement;
    
    // Convert RGB to hex if needed
    if (currentColor.startsWith("rgb")) {
      hexInput.value = this.rgbToHex(currentColor);
    } else {
      hexInput.value = currentColor;
    }
    
    this.closeAllDropdowns();
  }

  private handleHexInputChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    let color = input.value.trim();
    
    if (!color.startsWith("#") && color.length > 0) {
      color = "#" + color;
      input.value = color;
    }
    
    if (this.isValidHexColor(color) && color.length === 7) {
      // Update hex color preview in real-time
      this.updateHexColorPreview(color);
      
      // Remove selection from color squares
      document.querySelectorAll(".color-square").forEach(sq => sq.classList.remove("selected"));
    }
  }

  private handleOutsideClick(e: Event, elements: ReturnType<MathAddinApp['getDOMElements']>): void {
    if (!elements) return;
    
    const target = e.target as HTMLElement;
    
    // Check if click is outside font size dropdown
    if (!elements.fontSizeDropdownBtn.contains(target) && !elements.fontSizeDropdown.contains(target)) {
      elements.fontSizeDropdown.classList.remove("show");
    }
    
    // Check if click is outside underline dropdown
    if (!elements.underlineBtn.contains(target) && !elements.underlineDropdownBtn.contains(target) && !elements.underlineDropdown.contains(target)) {
      elements.underlineDropdown.classList.remove("show");
    }
    
    // Check if click is outside color panel
    if (!elements.colorBtn.contains(target) && !elements.colorDropdownBtn.contains(target) && !elements.colorPanel.contains(target)) {
      elements.colorPanel.classList.remove("show");
    }
  }

  private updateColorPreview(color: string): void {
    const colorPreview = document.getElementById("colorPreview") as HTMLDivElement;
    colorPreview.style.backgroundColor = color;
  }

  private updateHexColorPreview(color: string): void {
    const hexColorPreview = document.getElementById("hexColorPreview") as HTMLDivElement;
    if (hexColorPreview) {
      hexColorPreview.style.backgroundColor = color;
    }
  }

  private selectColor(color: string): void {
    // Update current color and previews
    this.currentColor = color;
    this.updateColorPreview(color);
    this.updateHexColorPreview(color);
    
    // Apply color to selected text/equation
    this.inputHandler.setTextColor(color);
  }

  private closeAllDropdowns(): void {
    const fontSizeDropdown = document.getElementById("fontSizeDropdown") as HTMLDivElement;
    const underlineDropdown = document.getElementById("underlineDropdown") as HTMLDivElement;
    const colorPanel = document.getElementById("colorPanel") as HTMLDivElement;
    
    if (fontSizeDropdown) {
      fontSizeDropdown.classList.remove("show");
    }
    if (underlineDropdown) {
      underlineDropdown.classList.remove("show");
    }
    if (colorPanel) {
      colorPanel.classList.remove("show");
    }
  }

  private isValidHexColor(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  private rgbToHex(rgb: string): string {
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return "#000000";
    
    const r = parseInt(result[0]);
    const g = parseInt(result[1]);
    const b = parseInt(result[2]);
    
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  private async handleEquationLoaded(latex: string): Promise<void> {
    try {
      // Convert LaTeX back to equation structure
      const elements = this.latexConverter.parseFromLatex(latex);
      
      // Clear current equation and load the parsed elements
      this.equationBuilder.clear();
      this.equationBuilder.setEquation(elements);
      
      // Update bracket nesting depths after loading from LaTeX
      this.equationBuilder.updateBracketNesting();
      
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
    } catch (error) {
      console.error("Error loading equation from LaTeX:", error);
      const statusDiv = document.getElementById("status") as HTMLDivElement;
      if (statusDiv) {
        statusDiv.textContent = "Error: Could not load equation for editing.";
        setTimeout(() => {
          statusDiv.textContent = "";
        }, 3000);
      }
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