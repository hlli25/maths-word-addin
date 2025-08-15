import { EquationElement, EquationBuilder } from "./equation-builder";
import { LatexConverter } from "./latex-converter";
import { hasMixedBrackets } from "./centralized-config";

export interface ContextInfo {
  array: EquationElement[];
  parent: EquationElement | null;
}

export interface SelectionState {
  startPosition: number;
  endPosition: number;
  contextPath: string;
  isActive: boolean;
}

export class ContextManager {
  private activeContextPath: string | null = null;
  private cursorPosition = 0;
  private equationBuilder: EquationBuilder;
  private latexConverter: LatexConverter;
  private selection: SelectionState = {
    startPosition: 0,
    endPosition: 0,
    contextPath: "",
    isActive: false,
  };

  constructor(equationBuilder: EquationBuilder, latexConverter: LatexConverter) {
    this.equationBuilder = equationBuilder;
    this.latexConverter = latexConverter;
  }

  getActiveContextPath(): string | null {
    return this.activeContextPath;
  }

  setActiveContextPath(path: string | null): void {
    this.activeContextPath = path;
  }

  getCursorPosition(): number {
    return this.cursorPosition;
  }

  setCursorPosition(position: number): void {
    this.cursorPosition = position;
  }

  isActive(): boolean {
    return this.activeContextPath !== null;
  }

  exitEditingMode(): void {
    this.activeContextPath = null;
  }

  enterRootContext(): void {
    this.activeContextPath = "root";
    this.cursorPosition = this.equationBuilder.getEquation().length;
  }

  enterContextPath(path: string, position: number = 0): void {
    this.activeContextPath = path;
    this.cursorPosition = position;
  }

  getContext(path: string): ContextInfo | null {
    if (path === "root") {
      return { array: this.equationBuilder.getEquation(), parent: null };
    }
    const parts = path.split("/");
    const containerName = parts.pop()!;
    const elementId = parts.pop()!;

    const element = this.equationBuilder.findElementById(
      this.equationBuilder.getEquation(),
      elementId
    );
    if (!element) return null;

    // Handle derivative element containers
    if (element.type === "derivative") {
      if (containerName === "function") {
        return { array: element.function || [], parent: element };
      } else if (containerName === "variable") {
        return { array: element.variable || [], parent: element };
      } else if (containerName === "order" && Array.isArray(element.order)) {
        return { array: element.order, parent: element };
      }
      return null;
    }

    // Handle integral element containers
    if (element.type === "integral") {
      if (containerName === "integrand") {
        return { array: element.integrand || [], parent: element };
      } else if (containerName === "differentialVariable") {
        return { array: element.differentialVariable || [], parent: element };
      } else if (containerName === "lowerLimit") {
        return { array: element.lowerLimit || [], parent: element };
      } else if (containerName === "upperLimit") {
        return { array: element.upperLimit || [], parent: element };
      }
      return null;
    }

    // Handle matrix, stack, and cases element containers
    if (element.type === "matrix" || element.type === "stack" || element.type === "cases") {
      // Parse cell container name: "cell_row_col"
      const cellMatch = containerName.match(/^cell_(\d+)_(\d+)$/);
      if (cellMatch && element.cells) {
        const cellKey = containerName; // Use the full container name as the key (e.g., "cell_0_0")
        if (element.cells[cellKey]) {
          return { array: element.cells[cellKey], parent: element };
        }
      }
      return null;
    }

    // Handle accent element containers
    if (element.type === "accent") {
      if (containerName === "accentBase") {
        return { array: element.accentBase || [], parent: element };
      } else if (containerName === "accentLabel") {
        return { array: element.accentLabel || [], parent: element };
      }
      return null;
    }

    // Handle function element containers
    if (element.type === "function") {
      if (containerName === "functionArgument") {
        return { array: element.functionArgument || [], parent: element };
      } else if (containerName === "functionBase") {
        return { array: element.functionBase || [], parent: element };
      } else if (containerName === "functionConstraint") {
        return { array: element.functionConstraint || [], parent: element };
      } else if (containerName === "functionName") {
        return { array: element.functionName || [], parent: element };
      }
      return null;
    }

    // Handle other element types
    const array = element[containerName as keyof EquationElement] as EquationElement[] | undefined;
    return array ? { array, parent: element } : null;
  }

  getCurrentContext(): ContextInfo | null {
    if (!this.activeContextPath) return null;
    return this.getContext(this.activeContextPath);
  }

  moveCursor(direction: number): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    const newPosition = this.cursorPosition + direction;
    if (newPosition >= 0 && newPosition <= context.array.length) {
      this.cursorPosition = newPosition;
      return true;
    } else if (this.activeContextPath !== "root") {
      // Check if we're in a matrix cell and can navigate horizontally
      if (this.navigateMatrixHorizontal(direction)) {
        return true;
      }
      this.navigateOutOfContext(direction === 1 ? "forward" : "backward");
      return true;
    }
    return false;
  }

  navigateUpDown(key: "ArrowUp" | "ArrowDown" | "Tab"): void {
    const direction = key === "ArrowUp" ? "ArrowUp" : "ArrowDown";

    if (!this.activeContextPath || this.activeContextPath === "root") return;

    const parts = this.activeContextPath.split("/");
    const currentPart = parts.pop()!;
    const elementId = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");

    const context = this.getContext(this.activeContextPath);
    if (!context || !context.parent) return;
    const parentElement = context.parent;

    if (parentElement.type === "fraction") {
      if (direction === "ArrowDown" && currentPart === "numerator") {
        this.activeContextPath = `${parentPath}/${elementId}/denominator`;
        this.cursorPosition = 0;
      } else if (direction === "ArrowUp" && currentPart === "denominator") {
        this.activeContextPath = `${parentPath}/${elementId}/numerator`;
        this.cursorPosition = 0;
      } else {
        this.navigateOutOfContext(direction === "ArrowDown" ? "forward" : "backward");
      }
    } else if (parentElement.type === "integral") {
      // Navigation for integral elements
      if (direction === "ArrowDown") {
        if ("isDefinite" in parentElement && parentElement.isDefinite && currentPart === "upperLimit") {
          this.activeContextPath = `${parentPath}/${elementId}/lowerLimit`;
          this.cursorPosition = 0;
        } else if ("isDefinite" in parentElement && parentElement.isDefinite && currentPart === "lowerLimit") {
          this.activeContextPath = `${parentPath}/${elementId}/integrand`;
          this.cursorPosition = 0;
        } else if (currentPart === "integrand") {
          this.activeContextPath = `${parentPath}/${elementId}/differentialVariable`;
          this.cursorPosition = 0;
        } else {
          this.navigateOutOfContext("forward");
        }
      } else if (direction === "ArrowUp") {
        if (currentPart === "differentialVariable") {
          this.activeContextPath = `${parentPath}/${elementId}/integrand`;
          this.cursorPosition = 0;
        } else if (currentPart === "integrand" && "isDefinite" in parentElement && parentElement.isDefinite) {
          this.activeContextPath = `${parentPath}/${elementId}/lowerLimit`;
          this.cursorPosition = 0;
        } else if ("isDefinite" in parentElement && parentElement.isDefinite && currentPart === "lowerLimit") {
          this.activeContextPath = `${parentPath}/${elementId}/upperLimit`;
          this.cursorPosition = 0;
        } else {
          this.navigateOutOfContext("backward");
        }
      } else {
        this.navigateOutOfContext(direction === "ArrowDown" ? "forward" : "backward");
      }
    } else if (parentElement.type === "derivative") {
      if (direction === "ArrowDown") {
        if (currentPart === "function") {
          this.activeContextPath = `${parentPath}/${elementId}/variable`;
          this.cursorPosition = 0;
        } else if (currentPart === "order") {
          this.activeContextPath = `${parentPath}/${elementId}/function`;
          this.cursorPosition = 0;
        } else {
          this.navigateOutOfContext("forward");
        }
      } else if (direction === "ArrowUp") {
        if (currentPart === "variable") {
          this.activeContextPath = `${parentPath}/${elementId}/function`;
          this.cursorPosition = 0;
        } else if (currentPart === "function") {
          if (Array.isArray(parentElement.order)) {
            this.activeContextPath = `${parentPath}/${elementId}/order`;
            this.cursorPosition = 0;
          } else {
            this.navigateOutOfContext("backward");
          }
        } else {
          this.navigateOutOfContext("backward");
        }
      } else {
        this.navigateOutOfContext(direction === "ArrowDown" ? "forward" : "backward");
      }
    } else if (parentElement.type === "script") {
      if (direction === "ArrowDown") {
        if (currentPart === "base" && parentElement.superscript) {
          this.activeContextPath = `${parentPath}/${elementId}/superscript`;
          this.cursorPosition = 0;
        } else if (currentPart === "superscript" && parentElement.subscript) {
          this.activeContextPath = `${parentPath}/${elementId}/subscript`;
          this.cursorPosition = 0;
        } else {
          this.navigateOutOfContext("forward");
        }
      } else if (direction === "ArrowUp") {
        if (currentPart === "subscript" && parentElement.superscript) {
          this.activeContextPath = `${parentPath}/${elementId}/superscript`;
          this.cursorPosition = 0;
        } else if (currentPart === "superscript" && parentElement.base) {
          this.activeContextPath = `${parentPath}/${elementId}/base`;
          this.cursorPosition = parentElement.base.length;
        } else {
          this.navigateOutOfContext("backward");
        }
      }
    } else if (parentElement.type === "large-operator") {
      if (direction === "ArrowDown") {
        if (currentPart === "lowerLimit" && parentElement.upperLimit) {
          this.activeContextPath = `${parentPath}/${elementId}/upperLimit`;
          this.cursorPosition = 0;
        } else if (currentPart === "upperLimit" && parentElement.operand) {
          this.activeContextPath = `${parentPath}/${elementId}/operand`;
          this.cursorPosition = 0;
        } else {
          this.navigateOutOfContext("forward");
        }
      } else if (direction === "ArrowUp") {
        if (currentPart === "operand" && parentElement.upperLimit) {
          this.activeContextPath = `${parentPath}/${elementId}/upperLimit`;
          this.cursorPosition = 0;
        } else if (currentPart === "upperLimit" && parentElement.lowerLimit) {
          this.activeContextPath = `${parentPath}/${elementId}/lowerLimit`;
          this.cursorPosition = parentElement.lowerLimit.length;
        } else {
          this.navigateOutOfContext("backward");
        }
      }
    } else if (
      parentElement.type === "matrix" ||
      parentElement.type === "stack" ||
      parentElement.type === "cases"
    ) {
      // Handle matrix, stack, and cases cell navigation
      const cellMatch = currentPart.match(/^cell_(\d+)_(\d+)$/);
      if (cellMatch && parentElement.rows && parentElement.cols) {
        const currentRow = parseInt(cellMatch[1]);
        const currentCol = parseInt(cellMatch[2]);

        if (direction === "ArrowDown") {
          // Move to next row, same column
          if (currentRow < parentElement.rows - 1) {
            this.activeContextPath = `${parentPath}/${elementId}/cell_${currentRow + 1}_${currentCol}`;
            this.cursorPosition = 0;
          } else {
            this.navigateOutOfContext("forward");
          }
        } else if (direction === "ArrowUp") {
          // Move to previous row, same column
          if (currentRow > 0) {
            this.activeContextPath = `${parentPath}/${elementId}/cell_${currentRow - 1}_${currentCol}`;
            this.cursorPosition = 0;
          } else {
            this.navigateOutOfContext("backward");
          }
        }
      }
    } else if (parentElement.type === "function") {
      // Navigation for function elements
      const isUserDefinedFunction = ["function", "functionsub", "functionlim"].includes(
        parentElement.functionType || ""
      );

      if (direction === "ArrowDown") {
        if (isUserDefinedFunction && currentPart === "functionName") {
          // Navigate from function name to next available field
          if (parentElement.functionConstraint) {
            this.activeContextPath = `${parentPath}/${elementId}/functionConstraint`;
            this.cursorPosition = 0;
          } else if (parentElement.functionBase) {
            this.activeContextPath = `${parentPath}/${elementId}/functionBase`;
            this.cursorPosition = 0;
          } else {
            this.activeContextPath = `${parentPath}/${elementId}/functionArgument`;
            this.cursorPosition = 0;
          }
        } else if (currentPart === "functionConstraint" && parentElement.functionBase) {
          this.activeContextPath = `${parentPath}/${elementId}/functionBase`;
          this.cursorPosition = 0;
        } else if (
          (currentPart === "functionConstraint" && !parentElement.functionBase) ||
          currentPart === "functionBase"
        ) {
          this.activeContextPath = `${parentPath}/${elementId}/functionArgument`;
          this.cursorPosition = 0;
        } else {
          this.navigateOutOfContext("forward");
        }
      } else if (direction === "ArrowUp") {
        if (currentPart === "functionArgument" && parentElement.functionBase) {
          this.activeContextPath = `${parentPath}/${elementId}/functionBase`;
          this.cursorPosition = 0;
        } else if (
          currentPart === "functionArgument" &&
          !parentElement.functionBase &&
          parentElement.functionConstraint
        ) {
          this.activeContextPath = `${parentPath}/${elementId}/functionConstraint`;
          this.cursorPosition = 0;
        } else if (
          currentPart === "functionArgument" &&
          !parentElement.functionBase &&
          !parentElement.functionConstraint &&
          isUserDefinedFunction
        ) {
          this.activeContextPath = `${parentPath}/${elementId}/functionName`;
          this.cursorPosition = 0;
        } else if (currentPart === "functionBase" && parentElement.functionConstraint) {
          this.activeContextPath = `${parentPath}/${elementId}/functionConstraint`;
          this.cursorPosition = 0;
        } else if (
          currentPart === "functionBase" &&
          !parentElement.functionConstraint &&
          isUserDefinedFunction
        ) {
          this.activeContextPath = `${parentPath}/${elementId}/functionName`;
          this.cursorPosition = 0;
        } else if (currentPart === "functionConstraint" && isUserDefinedFunction) {
          this.activeContextPath = `${parentPath}/${elementId}/functionName`;
          this.cursorPosition = 0;
        } else {
          this.navigateOutOfContext("backward");
        }
      }
    } else {
      this.navigateOutOfContext(direction === "ArrowDown" ? "forward" : "backward");
    }
  }

  private navigateMatrixHorizontal(direction: number): boolean {
    if (!this.activeContextPath || this.activeContextPath === "root") return false;

    const parts = this.activeContextPath.split("/");
    const currentPart = parts.pop()!;
    const elementId = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");

    const context = this.getContext(this.activeContextPath);
    if (
      !context ||
      !context.parent ||
      (context.parent.type !== "matrix" &&
        context.parent.type !== "stack" &&
        context.parent.type !== "cases")
    )
      return false;

    // Parse cell container name: "cell_row_col"
    const cellMatch = currentPart.match(/^cell_(\d+)_(\d+)$/);
    if (!cellMatch || !context.parent.rows || !context.parent.cols) return false;

    const currentRow = parseInt(cellMatch[1]);
    const currentCol = parseInt(cellMatch[2]);

    if (direction === 1) {
      // Move right to next column
      if (currentCol < context.parent.cols - 1) {
        this.activeContextPath = `${parentPath}/${elementId}/cell_${currentRow}_${currentCol + 1}`;
        this.cursorPosition = 0;
        return true;
      }
    } else if (direction === -1) {
      // Move left to previous column
      if (currentCol > 0) {
        this.activeContextPath = `${parentPath}/${elementId}/cell_${currentRow}_${currentCol - 1}`;
        this.cursorPosition = 0;
        return true;
      }
    }

    return false;
  }

  navigateOutOfContext(direction: "forward" | "backward"): void {
    if (!this.activeContextPath || this.activeContextPath === "root") return;

    const parts = this.activeContextPath.split("/");
    parts.pop(); // remove part name (numerator/denominator)
    const elementId = parts.pop();
    const parentPath = parts.join("/");

    const parentContext = this.getContext(parentPath);
    if (!parentContext || !elementId) return;

    const elementIndex = parentContext.array.findIndex((el) => el.id === elementId);
    if (elementIndex === -1) return;

    this.activeContextPath = parentPath;
    this.cursorPosition = direction === "forward" ? elementIndex + 1 : elementIndex;
  }

  handleBackspace(): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    if (this.cursorPosition > 0) {
      this.equationBuilder.removeElement(context.array, this.cursorPosition - 1);
      this.cursorPosition--;
      return true;
    } else if (this.activeContextPath !== "root") {
      this.navigateOutOfContext("backward");
      return true;
    }
    return false;
  }

  handleDelete(): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    if (this.cursorPosition < context.array.length) {
      this.equationBuilder.removeElement(context.array, this.cursorPosition);
      return true;
    }
    return false;
  }

  insertTextAtCursor(text: string): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    try {
      // Check if we're in a derivative function context
      if (this.activeContextPath.includes("function") && context.parent?.type === "derivative") {
        const currentContent = this.getContextText(context.array);
        const newContent =
          currentContent.slice(0, this.cursorPosition) +
          text +
          currentContent.slice(this.cursorPosition);

        // Check for mixed brackets
        if (hasMixedBrackets(newContent)) {
          this.showMixedBracketsError();
          return false;
        }
      }

      const element = this.equationBuilder.createTextElement(text);
      this.equationBuilder.insertElement(element, context.array, this.cursorPosition);
      this.cursorPosition++;
      return true;
    } catch (error) {
      return false;
    }
  }

  private getContextText(elements: EquationElement[]): string {
    return elements.map((el) => el.value || "").join("");
  }

  showMixedBracketsError(): void {
    const errorDiv = document.createElement("div");
    errorDiv.textContent = "Mixed brackets are not supported for derivatives.";
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #f44336;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-family: Arial, sans-serif;
    `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 3000);
  }

  insertElementAtCursor(element: EquationElement): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    this.equationBuilder.insertElement(element, context.array, this.cursorPosition);
    this.cursorPosition++;
    return true;
  }

  // Selection management methods
  getSelection(): SelectionState {
    return { ...this.selection };
  }

  setSelection(startPosition: number, endPosition: number, contextPath?: string): void {
    const finalContextPath = contextPath || this.activeContextPath || "root";

    this.selection = {
      startPosition: Math.min(startPosition, endPosition),
      endPosition: Math.max(startPosition, endPosition),
      contextPath: finalContextPath,
      isActive: true,
    };
  }

  clearSelection(): void {
    this.selection.isActive = false;
  }

  hasSelection(): boolean {
    return this.selection.isActive && this.selection.startPosition !== this.selection.endPosition;
  }

  // Select entire structure at cursor position
  selectStructureAtCursor(): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    // Find the element at or before cursor position
    if (this.cursorPosition > 0 && this.cursorPosition <= context.array.length) {
      const element = context.array[this.cursorPosition - 1];
      if (element && element.type !== "text") {
        // Select the entire structure
        this.setSelection(this.cursorPosition - 1, this.cursorPosition);
        return true;
      }
    }
    return false;
  }

  // Select entire current context (e.g., entire numerator, denominator, etc.)
  selectCurrentContext(): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    this.setSelection(0, context.array.length);
    return true;
  }

  // Select parent structure containing current context
  selectParentStructure(): boolean {
    if (!this.activeContextPath || this.activeContextPath === "root") return false;

    const parts = this.activeContextPath.split("/");
    parts.pop(); // remove part name (numerator/denominator/etc.)
    const elementId = parts.pop();
    const parentPath = parts.join("/");

    const parentContext = this.getContext(parentPath);
    if (!parentContext || !elementId) return false;

    const elementIndex = parentContext.array.findIndex((el) => el.id === elementId);
    if (elementIndex === -1) return false;

    // Move to parent context and select the structure
    this.activeContextPath = parentPath;
    this.setSelection(elementIndex, elementIndex + 1);
    this.cursorPosition = elementIndex + 1;
    return true;
  }

  // Extend selection to include whole structures
  extendSelectionToStructure(direction: number): void {
    if (!this.activeContextPath) return;
    const context = this.getContext(this.activeContextPath);
    if (!context) return;

    if (!this.selection.isActive) {
      // Start new selection
      if (direction > 0 && this.cursorPosition < context.array.length) {
        const element = context.array[this.cursorPosition];
        if (element && element.type !== "text") {
          // Select entire structure forward
          this.setSelection(this.cursorPosition, this.cursorPosition + 1);
          this.cursorPosition = this.cursorPosition + 1;
        } else {
          // Regular character selection
          this.extendSelection(direction);
        }
      } else if (direction < 0 && this.cursorPosition > 0) {
        const element = context.array[this.cursorPosition - 1];
        if (element && element.type !== "text") {
          // Select entire structure backward
          this.setSelection(this.cursorPosition - 1, this.cursorPosition);
          this.cursorPosition = this.cursorPosition - 1;
        } else {
          // Regular character selection
          this.extendSelection(direction);
        }
      }
    } else {
      // Extend existing selection
      let newPosition = this.cursorPosition;

      if (direction > 0 && this.cursorPosition < context.array.length) {
        const element = context.array[this.cursorPosition];
        newPosition =
          element && element.type !== "text"
            ? this.cursorPosition + 1
            : this.cursorPosition + direction;
      } else if (direction < 0 && this.cursorPosition > 0) {
        const checkPos = Math.max(0, this.cursorPosition + direction);
        const element = context.array[checkPos];
        newPosition =
          element && element.type !== "text" ? checkPos : this.cursorPosition + direction;
      }

      // Update selection boundaries
      if (this.cursorPosition === this.selection.endPosition) {
        this.selection.endPosition = Math.max(0, Math.min(context.array.length, newPosition));
      } else if (this.cursorPosition === this.selection.startPosition) {
        this.selection.startPosition = Math.max(0, Math.min(context.array.length, newPosition));
      }

      this.cursorPosition = newPosition;

      // Normalize selection
      if (this.selection.startPosition > this.selection.endPosition) {
        const temp = this.selection.startPosition;
        this.selection.startPosition = this.selection.endPosition;
        this.selection.endPosition = temp;
      }

      if (this.selection.startPosition === this.selection.endPosition) {
        this.clearSelection();
      }
    }
  }

  extendSelection(direction: number): void {
    if (!this.selection.isActive) {
      // Start new selection from cursor position
      const newStart = this.cursorPosition;
      const newEnd = this.cursorPosition + direction;
      this.setSelection(newStart, newEnd);

      // Update cursor to the moving end of selection
      this.cursorPosition = newEnd;
    } else {
      // The cursor position determines which end of the selection to extend
      if (this.cursorPosition === this.selection.endPosition) {
        // Cursor is at end, extend end position
        this.selection.endPosition = Math.max(0, this.selection.endPosition + direction);
        this.cursorPosition = this.selection.endPosition;
      } else if (this.cursorPosition === this.selection.startPosition) {
        // Cursor is at start, extend start position
        this.selection.startPosition = Math.max(0, this.selection.startPosition + direction);
        this.cursorPosition = this.selection.startPosition;
      } else {
        // Cursor position is inconsistent, fix it by extending from current position
        if (direction > 0) {
          this.selection.endPosition = Math.max(0, this.cursorPosition + direction);
          this.cursorPosition = this.selection.endPosition;
        } else {
          this.selection.startPosition = Math.max(0, this.cursorPosition + direction);
          this.cursorPosition = this.selection.startPosition;
        }
      }

      // Ensure start <= end and normalize selection
      if (this.selection.startPosition > this.selection.endPosition) {
        const temp = this.selection.startPosition;
        this.selection.startPosition = this.selection.endPosition;
        this.selection.endPosition = temp;
      }

      // If selection becomes empty, clear it
      if (this.selection.startPosition === this.selection.endPosition) {
        this.clearSelection();
      }
    }
  }

  deleteSelection(): boolean {
    if (!this.hasSelection() || !this.activeContextPath) return false;

    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    // Delete elements in selection range
    const deleteCount = this.selection.endPosition - this.selection.startPosition;
    context.array.splice(this.selection.startPosition, deleteCount);

    // Move cursor to start of deleted selection
    this.cursorPosition = this.selection.startPosition;
    this.clearSelection();

    return true;
  }

  extractSelection(): EquationElement[] {
    if (!this.hasSelection() || !this.activeContextPath) return [];

    const context = this.getContext(this.activeContextPath);
    if (!context) return [];

    // Extract elements in selection range
    const extractedElements = context.array.splice(
      this.selection.startPosition,
      this.selection.endPosition - this.selection.startPosition
    );

    // Move cursor to start of extracted selection
    this.cursorPosition = this.selection.startPosition;
    this.clearSelection();

    return extractedElements;
  }

  getSelectionFormatting(): {
    bold?: boolean;
    italic?: boolean;
    underline?: string | boolean;
    cancel?: boolean;
    color?: string;
  } | null {
    if (!this.hasSelection() || !this.activeContextPath) {
      return null;
    }

    const context = this.getContext(this.activeContextPath);
    if (!context) {
      return null;
    }

    // Collect formatting from all selected text elements
    const formattingCounts = {
      bold: { true: 0, false: 0 },
      italic: { true: 0, false: 0 },
      underline: {} as Record<string, number>,
      cancel: { true: 0, false: 0 },
      color: {} as Record<string, number>,
    };

    let totalTextElements = 0;

    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];

        if (element.type === "text") {
          totalTextElements++;

          // Count bold
          const bold = element.bold || false;
          formattingCounts.bold[bold as any]++;

          // Count italic
          const italic = element.italic || false;
          formattingCounts.italic[italic as any]++;

          // Count underline
          let underline = "none";
          if (element.wrappers?.underline) {
            underline = element.wrappers.underline.type;
          } else if (element.underline) {
            underline = element.underline;
          }
          formattingCounts.underline[underline] = (formattingCounts.underline[underline] || 0) + 1;

          // Count cancel
          let cancel = false;
          if (element.wrappers?.cancel) {
            cancel = true;
          } else if (element.cancel) {
            cancel = element.cancel;
          }
          formattingCounts.cancel[cancel as any]++;

          // Count color
          let color = "default";
          if (element.wrappers?.color) {
            color = element.wrappers.color.value;
          } else if (element.color) {
            color = element.color;
          }
          formattingCounts.color[color] = (formattingCounts.color[color] || 0) + 1;
        }
      }
    }

    if (totalTextElements === 0) return null;

    // Determine consistent formatting
    const result: any = {};

    // Bold: consistent if all elements have same value
    if (formattingCounts.bold.true === totalTextElements) result.bold = true;
    else if (formattingCounts.bold.false === totalTextElements) result.bold = false;

    // Italic: consistent if all elements have same value
    if (formattingCounts.italic.true === totalTextElements) result.italic = true;
    else if (formattingCounts.italic.false === totalTextElements) result.italic = false;

    // Underline: consistent if all elements have same value
    const underlineTypes = Object.keys(formattingCounts.underline);
    if (
      underlineTypes.length === 1 &&
      formattingCounts.underline[underlineTypes[0]] === totalTextElements
    ) {
      result.underline = underlineTypes[0];
    }

    // Cancel: consistent if all elements have same value
    if (formattingCounts.cancel.true === totalTextElements) result.cancel = true;
    else if (formattingCounts.cancel.false === totalTextElements) result.cancel = false;

    // Color: consistent if all elements have same value
    const colorTypes = Object.keys(formattingCounts.color);
    if (colorTypes.length === 1 && formattingCounts.color[colorTypes[0]] === totalTextElements) {
      result.color = colorTypes[0] === "default" ? undefined : colorTypes[0];
    }

    return result;
  }

  removeWrapperFormattingFromSelection(
    wrapperType: "cancel" | "underline" | "color" | "textMode"
  ): boolean {
    if (!this.hasSelection() || !this.activeContextPath) {
      return false;
    }

    // Use the selection's context path, not the active context path
    const selectionContextPath = this.selection.contextPath || this.activeContextPath;
    const context = this.getContext(selectionContextPath);
    if (!context) {
      return false;
    }

    // Remove specific wrapper type from selected elements using new multi-wrapper system
    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];

        if (element.wrappers) {
          // Remove the specific wrapper type
          delete element.wrappers[wrapperType];

          // Remove from order array
          if (element.wrapperOrder) {
            element.wrapperOrder = element.wrapperOrder.filter((w) => w !== wrapperType);
          }

          // Clean up empty wrappers object and order array
          if (Object.keys(element.wrappers).length === 0) {
            delete element.wrappers;
            delete element.wrapperOrder;
          }
        }
      }
    }

    // Clear selection after removing wrapper formatting
    this.clearSelection();

    return true;
  }

  applyWrapperFormattingToSelection(formatting: {
    cancel?: boolean;
    underline?: "single" | "double";
    color?: string;
    textMode?: boolean;
  }): boolean {
    if (!this.hasSelection() || !this.activeContextPath) {
      return false;
    }

    // Use the selection's context path, not the active context path
    const selectionContextPath = this.selection.contextPath || this.activeContextPath;

    const context = this.getContext(selectionContextPath);

    if (!context) {
      return false;
    }

    // Generate shared wrapper IDs for this selection - all selected elements
    // should share the same wrapper ID for continuous formatting
    const sharedWrapperIds = {
      cancel: this.equationBuilder.generateElementId(),
      underline: this.equationBuilder.generateElementId(),
      color: this.equationBuilder.generateElementId(),
      textMode: this.equationBuilder.generateElementId(),
    };

    // Apply wrapper formatting to selected elements using new multi-wrapper system
    let elementsProcessed = 0;

    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];
        elementsProcessed++;

        // Initialize wrappers object if it doesn't exist
        if (!element.wrappers) {
          element.wrappers = {};
        }

        // Apply each wrapper type independently with order tracking
        if (formatting.cancel !== undefined) {
          if (formatting.cancel) {
            // Always use new ID to override any existing formatting
            element.wrappers.cancel = { id: sharedWrapperIds.cancel };
            // If cancel doesn't exist, add it to order tracking
            if (!element.wrapperOrder || !element.wrapperOrder.includes("cancel")) {
              element.wrapperOrder = element.wrapperOrder || [];
              element.wrapperOrder.push("cancel");
            }
            // Keep existing order position if already present
          } else {
            delete element.wrappers.cancel;
            // Remove from order array
            if (element.wrapperOrder) {
              element.wrapperOrder = element.wrapperOrder.filter((w) => w !== "cancel");
            }
          }
        }

        if (formatting.underline !== undefined) {
          if (formatting.underline) {
            // If underline doesn't exist, add it and track order
            if (!element.wrappers.underline) {
              element.wrappers.underline = {
                id: sharedWrapperIds.underline,
                type: formatting.underline,
              };
              element.wrapperOrder = element.wrapperOrder || [];
              element.wrapperOrder.push("underline");
            } else {
              // If underline already exists, update with new ID and type to override
              element.wrappers.underline = {
                id: sharedWrapperIds.underline,
                type: formatting.underline,
              };
              // Keep existing order position
            }
          } else {
            delete element.wrappers.underline;
            // Remove from order array
            if (element.wrapperOrder) {
              element.wrapperOrder = element.wrapperOrder.filter((w) => w !== "underline");
            }
          }
        }

        if (formatting.color !== undefined) {
          if (formatting.color) {
            // Always use new ID to override any existing formatting
            element.wrappers.color = {
              id: sharedWrapperIds.color,
              value: formatting.color,
            };
            // If color doesn't exist, add it to order tracking
            if (!element.wrapperOrder || !element.wrapperOrder.includes("color")) {
              element.wrapperOrder = element.wrapperOrder || [];
              element.wrapperOrder.push("color");
            }
            // Keep existing order position if already present
          } else {
            delete element.wrappers.color;
            // Remove from order array
            if (element.wrapperOrder) {
              element.wrapperOrder = element.wrapperOrder.filter((w) => w !== "color");
            }
          }
        }

        if (formatting.textMode !== undefined) {
          if (formatting.textMode) {
            // Apply text mode wrapper
            element.wrappers.textMode = {
              id: sharedWrapperIds.textMode,
            };
            // If textMode doesn't exist, add it to order tracking
            if (!element.wrapperOrder || !element.wrapperOrder.includes("textMode")) {
              element.wrapperOrder = element.wrapperOrder || [];
              element.wrapperOrder.push("textMode");
            }
            // Keep existing order position if already present
          } else {
            delete element.wrappers.textMode;
            // Remove from order array
            if (element.wrapperOrder) {
              element.wrapperOrder = element.wrapperOrder.filter((w) => w !== "textMode");
            }
          }
        }

        // Clean up empty wrappers object and order array
        if (Object.keys(element.wrappers).length === 0) {
          delete element.wrappers;
          delete element.wrapperOrder;
        }
      }
    }

    // Clear selection after applying wrapper formatting
    this.clearSelection();

    return true;
  }

  applyFormattingToSelection(
    formatting: Partial<Pick<EquationElement, "bold" | "italic" | "underline" | "cancel" | "color">>
  ): boolean {
    if (!this.hasSelection() || !this.activeContextPath) {
      return false;
    }

    // Use the selection's context path, not the active context path
    const selectionContextPath = this.selection.contextPath || this.activeContextPath;
    const context = this.getContext(selectionContextPath);
    if (!context) {
      return false;
    }

    // Apply formatting to all elements in selection
    let elementsModified = 0;
    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];

        if (element.type === "text") {
          // For text elements, apply all formatting normally
          const isOperator = /[+\-×÷=<>≤≥≠]/.test(element.value || "");

          if (isOperator && formatting.bold !== undefined) {
            // Skip bold for operators, but allow other formatting
            const filteredFormatting = { ...formatting };
            delete filteredFormatting.bold;
            this.applyFormattingToElement(element, filteredFormatting);
          } else {
            this.applyFormattingToElement(element, formatting);
          }
          elementsModified++;
        } else {
          // For structures (fraction, sqrt, etc.), handle formatting differently
          if (element.type === "matrix") {
            // For matrices, handle different formatting types appropriately
            if (formatting.bold !== undefined || formatting.italic !== undefined) {
              // Bold and italic should apply to all matrix entries, not the structure
              const entryFormatting = {
                bold: formatting.bold,
                italic: formatting.italic,
              };
              this.applyFormattingToStructureContents(element, entryFormatting);
              elementsModified++;
            }

            // Other formatting (underline, color, cancel) can apply to the matrix structure
            const structureFormatting = { ...formatting };
            delete structureFormatting.bold;
            delete structureFormatting.italic;

            if (Object.keys(structureFormatting).length > 0) {
              this.applyFormattingToElement(element, structureFormatting);
              elementsModified++;
            }
          } else {
            // For other structures, handle formatting differently
            if (formatting.underline !== undefined) {
              // For underline, apply only to the structure itself
              this.applyStructureUnderline(element, formatting.underline);
              elementsModified++;
            }

            // For other formatting (bold, italic, color), apply recursively to all text within
            const recursiveFormatting = { ...formatting };
            delete recursiveFormatting.underline;

            if (Object.keys(recursiveFormatting).length > 0) {
              this.applyFormattingToStructureContents(element, recursiveFormatting);
              elementsModified++;
            }
          }
        }
      }
    }

    if (elementsModified > 0) {
      return true;
    }

    return false;
  }

  private applyFormattingToElement(element: EquationElement, formatting: any): void {
    // Apply formatting properties (including false values for explicit roman/off states)
    Object.keys(formatting).forEach((key) => {
      if (formatting[key] !== undefined) {
        (element as any)[key] = formatting[key];
      }
    });
  }

  isSelectionBold(): boolean {
    if (!this.hasSelection() || !this.activeContextPath) return false;

    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    // Check if all selected text elements are bold
    let hasTextElements = false;
    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];
        if (element.type === "text") {
          hasTextElements = true;
          // If any text element is not bold, selection is not fully bold
          if (!element.bold) {
            return false;
          }
        }
      }
    }

    // Return true only if we found text elements and all are bold
    return hasTextElements;
  }

  isSelectionItalic(): boolean {
    if (!this.hasSelection() || !this.activeContextPath) return false;

    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    // Check if all selected text elements are italic
    let hasTextElements = false;
    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];
        if (element.type === "text") {
          hasTextElements = true;
          // Check if element is explicitly italic
          if (element.italic === true) {
            continue;
          }
          // Check if element is naturally italic when not explicitly set
          if (element.italic === undefined) {
            // English letters are naturally italic in LaTeX math mode
            if (/^[a-zA-Z]$/.test(element.value || "")) {
              continue;
            }
          }
          // Element is not italic
          return false;
        }
      }
    }

    return hasTextElements;
  }

  isSelectionCancel(): boolean {
    if (!this.hasSelection() || !this.activeContextPath) return false;

    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    // Check if all selected elements have cancel wrapper (multi-wrapper system)
    let hasElements = false;
    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];
        hasElements = true;
        // Check new wrapper system
        if (element.wrappers?.cancel) {
          continue; // This element has cancel
        }
        return false; // This element doesn't have cancel
      }
    }

    return hasElements;
  }

  isSelectionUnderlined(): "single" | "double" | false {
    if (!this.hasSelection() || !this.activeContextPath) return false;

    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    // Check if all selected elements have underline wrapper (multi-wrapper system)
    let hasElements = false;
    let underlineStyle: "single" | "double" | undefined;

    for (let i = this.selection.startPosition; i < this.selection.endPosition; i++) {
      if (i < context.array.length) {
        const element = context.array[i];
        hasElements = true;

        let elementUnderlineStyle: "single" | "double" | undefined;

        // Check new wrapper system
        if (element.wrappers?.underline) {
          elementUnderlineStyle = element.wrappers.underline.type;
        } else {
          return false; // This element doesn't have underline
        }

        // Check consistency of underline style
        if (!underlineStyle) {
          underlineStyle = elementUnderlineStyle;
        } else if (underlineStyle !== elementUnderlineStyle) {
          return false; // Mixed styles
        }
      }
    }

    return hasElements && underlineStyle ? underlineStyle : false;
  }

  getElementContextPath(elementId: string, containerName: string): string {
    if (this.activeContextPath === "root") {
      return `root/${elementId}/${containerName}`;
    }
    return `${this.activeContextPath}/${elementId}/${containerName}`;
  }

  private applyStructureUnderline(element: EquationElement, underline?: "single" | "double"): void {
    // Apply underline to the structure element itself
    if (underline !== undefined) {
      element.underline = underline;
    }
  }

  private applyFormattingToStructureContents(
    element: EquationElement,
    formatting: Partial<Pick<EquationElement, "bold" | "italic" | "cancel" | "color">>
  ): void {
    // Recursively apply formatting to all text elements within the structure
    const applyToArray = (array?: EquationElement[]) => {
      if (!array) return;
      array.forEach((el) => {
        if (el.type === "text") {
          const isOperator = /[+\-×÷=<>≤≥≠]/.test(el.value || "");
          if (isOperator && formatting.bold !== undefined) {
            const filteredFormatting = { ...formatting };
            delete filteredFormatting.bold;
            this.applyFormattingToElement(el, filteredFormatting);
          } else {
            this.applyFormattingToElement(el, formatting);
          }
        } else {
          // Recursively apply to nested structures
          this.applyFormattingToStructureContents(el, formatting);
        }
      });
    };

    // Apply to all nested arrays in the structure
    applyToArray(element.numerator);
    applyToArray(element.denominator);
    applyToArray(element.radicand);
    applyToArray(element.index);
    applyToArray(element.base);
    applyToArray(element.superscript);
    applyToArray(element.subscript);
    applyToArray(element.content);
    applyToArray(element.upperLimit);
    applyToArray(element.lowerLimit);
    applyToArray(element.operand);
    applyToArray(element.function);
    applyToArray(element.variable);
    if (Array.isArray(element.order)) {
      applyToArray(element.order);
    }
    applyToArray(element.integrand);
    applyToArray(element.differentialVariable);
    applyToArray(element.functionArgument);
    applyToArray(element.functionBase);
    applyToArray(element.functionConstraint);
    applyToArray(element.functionName);

    // Apply to matrix cells
    if (element.cells && typeof element.cells === "object") {
      Object.keys(element.cells).forEach((cellKey) => {
        if (cellKey.startsWith("cell_")) {
          applyToArray(element.cells[cellKey]);
        }
      });
    }
  }
}
