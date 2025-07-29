import { EquationElement, EquationBuilder } from './equation-builder';

export interface ContextInfo {
  array: EquationElement[];
  parent: EquationElement | null;
}

export class ContextManager {
  private activeContextPath: string | null = null;
  private cursorPosition = 0;
  private equationBuilder: EquationBuilder;

  constructor(equationBuilder: EquationBuilder) {
    this.equationBuilder = equationBuilder;
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

    const element = this.equationBuilder.findElementById(this.equationBuilder.getEquation(), elementId);
    if (!element) return null;

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
    } else {
      this.navigateOutOfContext(direction === "ArrowDown" ? "forward" : "backward");
    }
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

    const element = this.equationBuilder.createTextElement(text);
    this.equationBuilder.insertElement(element, context.array, this.cursorPosition);
    this.cursorPosition++;
    return true;
  }

  insertElementAtCursor(element: EquationElement): boolean {
    if (!this.activeContextPath) return false;
    const context = this.getContext(this.activeContextPath);
    if (!context) return false;

    this.equationBuilder.insertElement(element, context.array, this.cursorPosition);
    this.cursorPosition++;
    return true;
  }

  getElementContextPath(elementId: string, containerName: string): string {
    if (this.activeContextPath === "root") {
      return `root/${elementId}/${containerName}`;
    }
    return `${this.activeContextPath}/${elementId}/${containerName}`;
  }
}