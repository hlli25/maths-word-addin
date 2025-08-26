import { EquationElement, EquationBuilder } from "./equation-builder";
import {
  UNICODE_TO_LATEX,
  LATEX_TO_UNICODE,
  SYMBOL_CONFIG,
  getLatexCommandLength,
  LARGE_OPERATORS,
  BRACKET_PAIRS,
  INTEGRAL_COMMANDS,
  BUILTIN_FUNCTION_COMMANDS,
} from "./centralized-config";

// Configuration for formatting commands
interface FormattingCommand {
  command: string;
  length: number;
  applyFormatting: (element: EquationElement) => void;
}

// Configuration for derivative commands
interface DerivativeCommand {
  command: string;
  length: number;
  displayMode: "inline" | "display";
  isLongForm: boolean;
}

export class LatexConverter {
  private equationBuilder: EquationBuilder | null = null;
  private inputHandler: any = null; // Will be properly typed later

  // Formatting commands configuration
  private readonly FORMATTING_COMMANDS: FormattingCommand[] = [
    {
      command: "\\boldsymbol",
      length: 11,
      applyFormatting: (el) => {
        el.bold = true;
        el.italic = true;
      },
    },
    {
      command: "\\mathbf",
      length: 7,
      applyFormatting: (el) => {
        el.bold = true;
      },
    },
    {
      command: "\\mathit",
      length: 7,
      applyFormatting: (el) => {
        el.italic = true;
      },
    },
    {
      command: "\\mathrm",
      length: 7,
      applyFormatting: (el) => {
        el.italic = false;
      },
    },
    {
      command: "\\textbf",
      length: 7,
      applyFormatting: (el) => {
        el.bold = true;
      },
    },
    {
      command: "\\textit",
      length: 7,
      applyFormatting: (el) => {
        el.italic = true;
      },
    },
  ];

  // Derivative commands configuration
  private readonly DERIVATIVE_COMMANDS: DerivativeCommand[] = [
    { command: "\\derivdfrac", length: 11, displayMode: "display", isLongForm: false },
    { command: "\\derivfrac", length: 10, displayMode: "inline", isLongForm: false },
    { command: "\\derivldfrac", length: 12, displayMode: "display", isLongForm: true },
    { command: "\\derivlfrac", length: 11, displayMode: "inline", isLongForm: true },
  ];

  setEquationBuilder(equationBuilder: EquationBuilder): void {
    this.equationBuilder = equationBuilder;
  }

  setInputHandler(inputHandler: any): void {
    this.inputHandler = inputHandler;
  }

  // Helper method to generate element ID
  private generateElementId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Helper method to parse group and convert to equation
  private parseGroupAndContent(
    latex: string,
    index: number
  ): { elements: EquationElement[]; endIndex: number } {
    const group = this.parseLatexGroup(latex, index);
    return {
      elements: this.parseLatexToEquation(group.content),
      endIndex: group.endIndex,
    };
  }

  // Helper method to skip whitespace
  private skipWhitespace(latex: string, index: number): number {
    while (index < latex.length && latex[index] === " ") index++;
    return index;
  }

  convertToLatex(elements: EquationElement[]): string {
    const maxDepth = this.findMaxNestingDepth(elements);
    return this.toLatexRecursive(elements, maxDepth).trim();
  }

  parseFromLatex(latex: string): EquationElement[] {
    return this.parseLatexToEquation(latex);
  }

  private haveSameWrappers(element1: EquationElement, element2: EquationElement): boolean {
    if (element1.wrappers || element2.wrappers) {
      // Both must have wrappers object or both must not have it
      if (!element1.wrappers && !element2.wrappers) {
        return true;
      }
      if (!element1.wrappers || !element2.wrappers) {
        return false;
      }

      // Compare each wrapper type
      const checkWrapper = (type: "underline" | "cancel" | "color" | "textMode") => {
        const w1 = element1.wrappers![type];
        const w2 = element2.wrappers![type];

        if (!w1 && !w2) return true;
        if (!w1 || !w2) return false;

        if (type === "underline") {
          return (w1 as any).type === (w2 as any).type;
        } else if (type === "color") {
          return (w1 as any).value === (w2 as any).value;
        } else {
          return true; // cancel and textMode
        }
      };
      
      return checkWrapper('underline') && checkWrapper('cancel') && checkWrapper('color') && checkWrapper('textMode');
    }

    return true;
  }

  private findMaxNestingDepth(elements: EquationElement[]): number {
    const findMaxDepthRecursive = (elements: EquationElement[]): number => {
      let localMax = 0;

      elements.forEach((element) => {
        if (element.type === "bracket") {
          localMax = Math.max(localMax, element.nestingDepth || 0);
          localMax = Math.max(localMax, findMaxDepthRecursive(element.content || []));
        } else {
          // Recursively check all array properties of the element
          const childArrays = [
            element.numerator,
            element.denominator, // fraction, bevelled-fraction
            element.radicand,
            element.index, // sqrt, nthroot
            element.base,
            element.superscript,
            element.subscript, // script
            element.content, // bracket (already handled above)
            element.lowerLimit,
            element.upperLimit,
            element.operand, // large-operator
          ].filter(Boolean);

          childArrays.forEach((childArray) => {
            localMax = Math.max(localMax, findMaxDepthRecursive(childArray));
          });
        }
      });

      return localMax;
    };

    return findMaxDepthRecursive(elements);
  }

  private toLatexRecursive(elements: EquationElement[], maxDepth: number = 0, inOperatorName: boolean = false): string {
    let latex = "";

    // Temporarily disable wrapper formatting to debug the scope issue
    const hasUniformFormatting = null; // this.checkUniformFormatting(elements);

    // If uniform formatting is detected, create a clean copy of elements without the wrapper formatting
    let processedElements = elements;
    if (hasUniformFormatting) {
      processedElements = this.removeUniformFormattingFromElements(elements, hasUniformFormatting);
    }

    // Process elements, handling multi-wrapper system
    for (let i = 0; i < processedElements.length; i++) {
      const element = processedElements[i];

      // Check if this element has multi-wrapper formatting
      if (element.wrappers && Object.keys(element.wrappers).length > 0) {
        // Find all consecutive elements with the same wrapper combination
        const groupElements: EquationElement[] = [];
        let j = i;

        while (
          j < processedElements.length &&
          this.haveSameWrappers(element, processedElements[j])
        ) {
          groupElements.push(processedElements[j]);
          j++;
        }

        // Generate LaTeX for the grouped elements (without wrapper metadata)
        const cleanGroupElements = groupElements.map((el) => {
          const cleanEl = { ...el };
          delete cleanEl.wrappers;
          return cleanEl;
        });

        const groupContent = this.toLatexRecursive(cleanGroupElements, maxDepth, inOperatorName);

        // Apply wrapper formatting in user-defined order (innermost to outermost)
        let wrappedContent = groupContent;

        // Use user's application order if available, otherwise fall back to default order
        const wrapperOrder = element.wrapperOrder || ["underline", "cancel", "color", "textMode"];

        // Apply wrappers in the order they were applied by the user
        for (const wrapperType of wrapperOrder) {
          if (wrapperType === "underline" && element.wrappers.underline) {
            if (element.wrappers.underline.type === "double") {
              wrappedContent = `\\underline{\\underline{${wrappedContent}}}`;
            } else {
              wrappedContent = `\\underline{${wrappedContent}}`;
            }
          } else if (wrapperType === "cancel" && element.wrappers.cancel) {
            wrappedContent = `\\cancel{${wrappedContent}}`;
          } else if (wrapperType === "color" && element.wrappers.color) {
            wrappedContent = `\\textcolor{${element.wrappers.color.value}}{${wrappedContent}}`;
          } else if (wrapperType === "textMode" && element.wrappers.textMode) {
            wrappedContent = `\\text{${wrappedContent}}`;
          }
        }

        latex += wrappedContent;

        // Skip the processed elements
        i = j - 1;
        continue;
      }

      if (element.type === "text") {
        // Check if element is in text mode
        const isTextMode =
          element.textMode === true || (element.wrappers && element.wrappers.textMode);

        // Look ahead to group consecutive text elements with same formatting
        let groupedText = "";
        let j = i;
        let currentFormatting = {
          bold: element.bold,
          italic: element.italic,
          color: element.color,
          underline: element.underline,
          cancel: element.cancel,
          wrappers: element.wrappers, // Include wrappers in formatting comparison
          textMode: element.textMode,
        };

        while (
          j < processedElements.length &&
          processedElements[j].type === "text" &&
          this.hasEqualFormatting(processedElements[j], currentFormatting)
        ) {
          let value = processedElements[j].value || "";

          // In text mode, preserve spaces and don't convert to LaTeX symbols
          if (!isTextMode) {
            // Convert Unicode symbols to LaTeX commands
            const latexCommand = UNICODE_TO_LATEX[value];
            if (latexCommand) {
              value = latexCommand;
              
              // Add space after LaTeX commands that end with letters
              // to prevent issues like \leqx when followed by letters
              const nextIdx = j + 1;
              if (nextIdx < processedElements.length && 
                  processedElements[nextIdx].type === "text" &&
                  /^[a-zA-Z]/.test(processedElements[nextIdx].value || "") &&
                  /\\[a-zA-Z]+$/.test(value)) {
                value = value + " ";
              }
            }

            // Escape LaTeX special characters that could break parsing
            value = this.escapeLatexSpecialChars(value);

            // Add spacing for operators
            if (/^[+\-=×÷]$/.test(value)) {
              groupedText += ` ${value} `;
            } else {
              groupedText += value;
            }
          } else {
            // In text mode, preserve the text as-is but still escape special chars
            value = this.escapeLatexSpecialChars(value);
            groupedText += value;
          }
          j++;
        }

        // Apply formatting to the grouped text (formatting should already be cleaned if uniform formatting detected)
        let formattedText = groupedText;
        formattedText = this.applyFormattingToLatex(formattedText, currentFormatting, inOperatorName);

        // If in text mode, wrap the entire group in \text{}
        if (isTextMode) {
          formattedText = `\\text{${formattedText}}`;
        }

        latex += formattedText;
        i = j - 1; // Skip the elements which have been already processed
      } else if (element.type === "fraction") {
        const num = this.toLatexRecursive(element.numerator!, maxDepth, inOperatorName);
        const den = this.toLatexRecursive(element.denominator!, maxDepth, inOperatorName);

        if (element.displayMode === "display") {
          latex += `\\dfrac{${num || " "}}{${den || " "}}`;
        } else {
          latex += `{\\textstyle \\frac{${num || " "}}{${den || " "}}}`;
        }
      } else if (element.type === "bevelled-fraction") {
        const num = this.toLatexRecursive(element.numerator!, maxDepth, inOperatorName);
        const den = this.toLatexRecursive(element.denominator!, maxDepth, inOperatorName);
        latex += `{${num || " "}}/{${den || " "}}`;
      } else if (element.type === "sqrt") {
        const radicand = this.toLatexRecursive(element.radicand!, maxDepth, inOperatorName);
        latex += `\\sqrt{${radicand || " "}}`;
      } else if (element.type === "nthroot") {
        const index = this.toLatexRecursive(element.index!, maxDepth, inOperatorName);
        const radicand = this.toLatexRecursive(element.radicand!, maxDepth, inOperatorName);
        latex += `\\sqrt[${index || " "}]{${radicand || " "}}`;
      } else if (element.type === "script") {
        const base = this.toLatexRecursive(element.base!, maxDepth, inOperatorName);
        latex += `{${base || " "}}`;
        if (element.superscript && element.subscript) {
          latex += `^{${this.toLatexRecursive(element.superscript, maxDepth, inOperatorName) || " "}}_{${this.toLatexRecursive(element.subscript, maxDepth, inOperatorName) || " "}}`;
        } else if (element.superscript) {
          latex += `^{${this.toLatexRecursive(element.superscript, maxDepth, inOperatorName) || " "}}`;
        } else if (element.subscript) {
          latex += `_{${this.toLatexRecursive(element.subscript, maxDepth, inOperatorName) || " "}}`;
        }
      } else if (element.type === "bracket") {
        const content = this.toLatexRecursive(element.content!, maxDepth, inOperatorName);
        const { latexLeft, latexRight } = this.getBracketLatexSymbols(
          element.leftBracketSymbol!,
          element.rightBracketSymbol!
        );
        let bracketLatex = `${latexLeft}${content || " "}${latexRight}`;
        
        // Add superscript and subscript support for brackets (evaluation brackets)
        if (element.superscript && element.subscript) {
          const superscriptLatex = this.toLatexRecursive(element.superscript, maxDepth, inOperatorName);
          const subscriptLatex = this.toLatexRecursive(element.subscript, maxDepth, inOperatorName);
          bracketLatex += `^{${superscriptLatex || " "}}_{${subscriptLatex || " "}}`;
        } else if (element.superscript) {
          const superscriptLatex = this.toLatexRecursive(element.superscript, maxDepth, inOperatorName);
          bracketLatex += `^{${superscriptLatex || " "}}`;
        } else if (element.subscript) {
          const subscriptLatex = this.toLatexRecursive(element.subscript, maxDepth, inOperatorName);
          bracketLatex += `_{${subscriptLatex || " "}}`;
        }
        
        latex += bracketLatex;
      } else if (element.type === "large-operator") {
        const operatorSymbol = this.convertOperatorToLatex(element.operator!);
        const lowerLimit = this.toLatexRecursive(element.lowerLimit!, maxDepth, inOperatorName);
        const upperLimit = this.toLatexRecursive(element.upperLimit!, maxDepth, inOperatorName);
        const operand = this.toLatexRecursive(element.operand!, maxDepth, inOperatorName);

        // Check if this is marked as an indefinite integral
        const isIndefiniteIntegral = (element as any).isIndefiniteIntegral === true;

        let operatorLatex = operatorSymbol;

        if (element.limitMode === "nolimits") {
          operatorLatex += "\\nolimits";
        } else if (element.limitMode === "limits") {
          operatorLatex += "\\limits";
        }

        // Wrap operand in braces for predictable parsing
        const wrappedOperand = operand ? ` {${operand}}` : " {}";

        let finalLatex = "";
        if (isIndefiniteIntegral) {
          // Simple indefinite integral: no limits at all
          finalLatex = `${operatorLatex}${wrappedOperand}`;
        } else {
          // Definite integral or other operators: always include limit structure
          finalLatex = `${operatorLatex}_{${lowerLimit || ""}}^{${upperLimit || ""}}${wrappedOperand}`;
        }

        if (element.displayMode === "display") {
          latex += `{\\displaystyle ${finalLatex}}`;
        } else {
          latex += `{\\textstyle ${finalLatex}}`;
        }
      } else if (element.type === "integral") {
        // Custom integral format with integrand and differential variable blocks
        const integrandLatex = this.toLatexRecursive(element.integrand!, maxDepth, inOperatorName);
        const variableLatex = this.toLatexRecursive(element.differentialVariable!, maxDepth, inOperatorName);

        // Determine the command based on integral type, style, and whether it has limits
        let integralCommand = "";
        const useRomanD = element.integralStyle === "roman";
        
        // Auto-detect if integral is definite: either isDefinite property is true OR it has limits
        const hasLowerLimit = element.lowerLimit && element.lowerLimit.length > 0;
        const hasUpperLimit = element.upperLimit && element.upperLimit.length > 0;
        const hasLimits = hasLowerLimit || hasUpperLimit;
        const isDefinite = ("isDefinite" in element && element.isDefinite) || hasLimits;

        // Check if this is a single-limit integral (subscript or lower only)
        const hasOnlyLowerLimit = hasLowerLimit && !hasUpperLimit;
        const hasOnlyUpperLimit = hasUpperLimit && !hasLowerLimit;

        switch (element.integralType) {
          case "double":
            if (hasOnlyLowerLimit) {
              // 3-parameter subscript/lower limit variants
              if (element.limitMode === "limits") {
                integralCommand = useRomanD ? "\\iintdlower" : "\\iintilower";
              } else {
                integralCommand = useRomanD ? "\\iintdsub" : "\\iintisub";
              }
            } else if (isDefinite) {
              // 4-parameter definite integrals
              if (element.limitMode === "limits") {
                integralCommand = useRomanD ? "\\iintdlim" : "\\iintilim";
              } else {
                integralCommand = useRomanD ? "\\iintdnolim" : "\\iintinolim";
              }
            } else {
              // 2-parameter indefinite
              integralCommand = useRomanD ? "\\iintd" : "\\iinti";
            }
            break;
          case "triple":
            if (hasOnlyLowerLimit) {
              // 3-parameter subscript/lower limit variants
              if (element.limitMode === "limits") {
                integralCommand = useRomanD ? "\\iiintdlower" : "\\iiintilower";
              } else {
                integralCommand = useRomanD ? "\\iiintdsub" : "\\iiintisub";
              }
            } else if (isDefinite) {
              // 4-parameter definite integrals
              if (element.limitMode === "limits") {
                integralCommand = useRomanD ? "\\iiintdlim" : "\\iiintilim";
              } else {
                integralCommand = useRomanD ? "\\iiintdnolim" : "\\iiintinolim";
              }
            } else {
              // 2-parameter indefinite
              integralCommand = useRomanD ? "\\iiintd" : "\\iiinti";
            }
            break;
          case "contour":
            // Contour integrals don't use limits positioning - only subscript for path or sub/superscript
            if (hasOnlyLowerLimit) {
              // 3-parameter subscript variant for path-only contours
              integralCommand = useRomanD ? "\\ointdsub" : "\\ointisub";
            } else if (isDefinite) {
              // 4-parameter variants for contours with both limits
              integralCommand = useRomanD ? "\\ointdnolim" : "\\ointinolim";
            } else {
              // 2-parameter indefinite
              integralCommand = useRomanD ? "\\ointd" : "\\ointi";
            }
            break;
          case "single":
          default:
            if (hasOnlyLowerLimit) {
              // 3-parameter subscript/lower limit variants
              if (element.limitMode === "limits") {
                // For single integral, there's no intilower/intdlower command, use standard format
                integralCommand = useRomanD ? "\\intdlim" : "\\intilim";
              } else {
                integralCommand = useRomanD ? "\\intdsub" : "\\intisub";
              }
            } else if (isDefinite) {
              if (element.limitMode === "limits") {
                integralCommand = useRomanD ? "\\intdlim" : "\\intilim";
              } else {
                integralCommand = useRomanD ? "\\intdnolim" : "\\intinolim";
              }
            } else {
              integralCommand = useRomanD ? "\\intd" : "\\inti";
            }
            break;
        }

        // Build the integral LaTeX command
        let finalLatex = "";
        
        // Handle different parameter counts based on integral command type
        if (integralCommand.includes("sub") || integralCommand.includes("lower")) {
          // 3-parameter variants: \ointisub{integrand}{variable}{path} or \iintisub{integrand}{variable}{region}
          const limitLatex = hasLowerLimit ? this.toLatexRecursive(element.lowerLimit, maxDepth, inOperatorName) : " ";
          finalLatex = `${integralCommand}{${integrandLatex || " "}}{${variableLatex || " "}}{${limitLatex}}`;
        } else if (hasLowerLimit && hasUpperLimit) {
          // 4-parameter definite integrals: \intinolim{integrand}{variable}{lower}{upper}
          const lowerLatex = this.toLatexRecursive(element.lowerLimit, maxDepth, inOperatorName);
          const upperLatex = this.toLatexRecursive(element.upperLimit, maxDepth, inOperatorName);
          finalLatex = `${integralCommand}{${integrandLatex || " "}}{${variableLatex || " "}}{${lowerLatex || " "}}{${upperLatex || " "}}`;
        } else {
          // 2-parameter indefinite integrals: \inti{integrand}{variable}
          finalLatex = `${integralCommand}{${integrandLatex || " "}}{${variableLatex || " "}}`;
        }

        // Apply appropriate styling based on display mode
        if (element.displayMode === "display") {
          // For display mode: add \displaystyle wrapper for all integral commands
          finalLatex = `{\\displaystyle ${finalLatex}}`;
          latex += finalLatex;
        } else {
          // For inline mode: wrap with \textstyle for proper inline rendering
          latex += `{\\textstyle ${finalLatex}}`;
        }
      } else if (element.type === "derivative") {
        const functionLatex = this.toLatexRecursive(element.function!, maxDepth, inOperatorName);
        const variableLatex = this.toLatexRecursive(element.variable!, maxDepth, inOperatorName);

        // Determine differential symbol: ∂ for partial derivatives, d for regular derivatives
        const isPartial = element.isPartial === true;
        const differentialSymbol = isPartial ? "\\partial" : "d";

        // Check if this is long form derivative
        if (element.isLongForm) {
          // Long form: \dv[n]{x}(\grande{f}) or \dv{x}(\grande{f}) for regular derivatives
          // Long form: \pdv[n]{x}(\grande{f}) or \pdv{x}(\grande{f}) for partial derivatives
          // The function part is wrapped with \grande and can have optional brackets
          // For partial derivatives, ALWAYS use physics package since we need \pdv
          const usePhysicsPackage = isPartial || this.shouldUsePhysicsPackageForDerivative();

          if (usePhysicsPackage) {
            // Use \pdv for partial derivatives, \dv for regular derivatives
            const dvCommandBase = isPartial ? "\\pdv" : "\\dv";
            let dvCommand = "";
            if (typeof element.order === "number") {
              if (element.order === 1) {
                dvCommand = `${dvCommandBase}{${variableLatex || "x"}}`;
              } else {
                dvCommand = `${dvCommandBase}[${element.order}]{${variableLatex || "x"}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth, inOperatorName);
              dvCommand = `${dvCommandBase}[${orderLatex || "n"}]{${variableLatex || "x"}}`;
            }

            // Add the function part with \grande
            // If function starts with brackets, put \grande inside them
            let functionPart = functionLatex || "";

            // Check if functionPart starts and ends with any bracket pair
            let bracketFound = false;
            for (const pair of BRACKET_PAIRS) {
              if (functionPart.startsWith(pair.left) && functionPart.endsWith(pair.right)) {
                // Put \grande inside the brackets
                const innerContent = functionPart.slice(pair.left.length, -pair.right.length);
                functionPart = `${pair.left}\\grande{${innerContent}}${pair.right}`;
                bracketFound = true;
                break;
              }
            }

            if (!bracketFound) {
              if (functionPart) {
                // No brackets or other format, just add \grande
                functionPart = `\\grande{${functionPart}}`;
              } else {
                // Empty function
                functionPart = `\\grande{ }`;
              }
            }

            // Debug logging for long form partial derivatives export
            if (isPartial) {
              console.log("Long form export debug:", {
                dvCommand,
                functionPart,
                displayMode: element.displayMode,
                variableLatex,
                order: element.order
              });
            }

            // Combine the parts with style wrapper
            if (element.displayMode === "display") {
              latex += `{\\displaystyle ${dvCommand}${functionPart}}`;
            } else {
              latex += `{\\textstyle ${dvCommand}${functionPart}}`;
            }
          } else {
            // For non-physics package, use custom long form commands
            // For partial derivatives, always use \partial regardless of differential style
            const diffSymbol = isPartial ? "\\partial" : "d";
            let numerator = "";
            let denominator = "";

            if (typeof element.order === "number") {
              if (element.order === 1) {
                numerator = diffSymbol;
                denominator = `${diffSymbol}${variableLatex || "x"}`;
              } else {
                numerator = `${diffSymbol}^{${element.order}}`;
                denominator = `${diffSymbol}${variableLatex || "x"}^{${element.order}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth, inOperatorName);
              numerator = `${diffSymbol}^{${orderLatex || "n"}}`;
              denominator = `${diffSymbol}${variableLatex || "x"}^{${orderLatex || "n"}}`;
            }

            // Use custom long form commands for italic d
            if (element.displayMode === "display") {
              latex += `\\derivldfrac{${numerator}}{${denominator}}{${functionLatex || " "}}`;
            } else {
              latex += `\\derivlfrac{${numerator}}{${denominator}}{${functionLatex || " "}}`;
            }
          }
        } else {
          // Standard form derivative handling
          // For partial derivatives, ALWAYS use physics package (\pdv) regardless of differential style
          // For regular derivatives, check if we should use physics package based on differential style
          const usePhysicsPackage = isPartial || this.shouldUsePhysicsPackageForDerivative();

          if (usePhysicsPackage) {
            // Use physics package \dv or \pdv command (always renders with roman 'd' or '∂' based on italicdiff setting)
            const dvCommandBase = isPartial ? "\\pdv" : "\\dv";
            let dvCommand = "";
            if (typeof element.order === "number") {
              if (element.order === 1) {
                dvCommand = `${dvCommandBase}{${functionLatex || " "}}{${variableLatex || " "}}`;
              } else {
                dvCommand = `${dvCommandBase}[${element.order}]{${functionLatex || " "}}{${variableLatex || " "}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth, inOperatorName);
              dvCommand = `${dvCommandBase}[${orderLatex || "n"}]{${functionLatex || " "}}{${variableLatex || " "}}`;
            }

            // Debug logging for partial derivatives export
            if (isPartial) {
              console.log("Export debug:", {
                functionLatex,
                variableLatex,
                dvCommand,
                displayMode: element.displayMode,
                isLongForm: element.isLongForm,
                order: element.order
              });
            }

            // Add style wrapper for both display and inline modes
            if (element.displayMode === "display") {
              latex += `{\\displaystyle ${dvCommand}}`;
            } else {
              latex += `{\\textstyle ${dvCommand}}`;
            }
          } else {
            // Use custom derivative commands for standard LaTeX
            // For partial derivatives, use \partial regardless of differential style
            const diffSymbol = isPartial ? "\\partial" : "d";
            let numerator = "";
            let denominator = "";

            if (typeof element.order === "number") {
              if (element.order === 1) {
                numerator = `${diffSymbol}${functionLatex || " "}`;
                denominator = `${diffSymbol}${variableLatex || " "}`;
              } else {
                numerator = `${diffSymbol}^{${element.order}}${functionLatex || " "}`;
                denominator = `${diffSymbol}${variableLatex || " "}^{${element.order}}`;
              }
            } else {
              // nth order with custom expression
              const orderLatex = this.toLatexRecursive(element.order!, maxDepth, inOperatorName);
              numerator = `${diffSymbol}^{${orderLatex || "n"}}${functionLatex || " "}`;
              denominator = `${diffSymbol}${variableLatex || " "}^{${orderLatex || "n"}}`;
            }

            // Use custom \derivfrac or \derivdfrac command instead of \frac/\dfrac
            if (element.displayMode === "display") {
              latex += `\\derivdfrac{${numerator}}{${denominator}}`;
            } else {
              latex += `\\derivfrac{${numerator}}{${denominator}}`;
            }
          }
        }
      } else if (element.type === "matrix") {
        const matrixLatex = this.matrixToLatex(element, maxDepth, inOperatorName);
        latex += matrixLatex;
      } else if (element.type === "stack") {
        const stackLatex = this.stackToLatex(element, maxDepth, inOperatorName);
        latex += stackLatex;
      } else if (element.type === "cases") {
        const casesLatex = this.casesToLatex(element, maxDepth, inOperatorName);
        latex += casesLatex;
      } else if (element.type === "accent") {
        const accentLatex = this.accentToLatex(element, maxDepth, inOperatorName);
        latex += accentLatex;
      } else if (element.type === "function") {
        const functionLatex = this.functionToLatex(element, maxDepth, inOperatorName);
        latex += functionLatex;
      }
    }

    // Apply uniform formatting as a wrapper if detected
    if (hasUniformFormatting && latex.trim()) {
      latex = this.applyFormattingToLatex(latex, hasUniformFormatting, inOperatorName);
    }

    return latex;
  }

  private matrixToLatex(element: EquationElement, maxDepth: number, inOperatorName: boolean = false): string {
    const { rows, cols, cells, matrixType } = element;

    if (!rows || !cols || !cells) {
      return "";
    }

    // Build the matrix content from the cells object
    const matrixRows: string[] = [];
    for (let row = 0; row < rows; row++) {
      const cellsInRow: string[] = [];
      for (let col = 0; col < cols; col++) {
        const cellKey = `cell_${row}_${col}`;
        const cellElements = cells[cellKey] || [];
        const cellContent = this.toLatexRecursive(cellElements, maxDepth, inOperatorName).trim();
        cellsInRow.push(cellContent || ""); // Empty cells are empty
      }
      matrixRows.push(cellsInRow.join(" & "));
    }
    const matrixContent = matrixRows.join(" \\\\ ");

    // Wrap with appropriate LaTeX environment based on matrix type
    let matrixLatex = "";
    switch (matrixType) {
      case "parentheses":
        matrixLatex = `\\begin{pmatrix}${matrixContent}\\end{pmatrix}`;
        break;
      case "brackets":
        matrixLatex = `\\begin{bmatrix}${matrixContent}\\end{bmatrix}`;
        break;
      case "braces":
        matrixLatex = `\\begin{Bmatrix}${matrixContent}\\end{Bmatrix}`;
        break;
      case "bars":
        matrixLatex = `\\begin{vmatrix}${matrixContent}\\end{vmatrix}`;
        break;
      case "double-bars":
        matrixLatex = `\\begin{Vmatrix}${matrixContent}\\end{Vmatrix}`;
        break;
      case "none":
        matrixLatex = `\\begin{matrix}${matrixContent}\\end{matrix}`;
        break;
      default:
        matrixLatex = `\\begin{pmatrix}${matrixContent}\\end{pmatrix}`;
        break;
    }

    // Apply formatting to the entire matrix structure (excluding bold/italic which should apply to entries)
    const matrixFormatting = { ...element };
    delete matrixFormatting.bold;
    delete matrixFormatting.italic;

    return this.applyFormattingToLatex(matrixLatex, matrixFormatting, false);
  }

  private stackToLatex(element: EquationElement, maxDepth: number, inOperatorName: boolean = false): string {
    const { rows, cols, cells } = element;

    if (!rows || !cols || !cells) {
      return "\\text{Invalid Stack}";
    }

    // Build the stack content from the cells object
    const stackRows: string[] = [];
    for (let row = 0; row < rows; row++) {
      const cellsInRow: string[] = [];
      for (let col = 0; col < cols; col++) {
        const cellKey = `cell_${row}_${col}`;
        const cellElements = cells[cellKey] || [];
        const cellLatex = this.toLatexRecursive(cellElements, maxDepth - 1).trim();
        cellsInRow.push(cellLatex);
      }
      stackRows.push(cellsInRow.join(" & "));
    }
    const stackContent = stackRows.join(" \\\\ ");

    // Use array environment for plain stacks
    let stackLatex = `\\begin{array}{${"c".repeat(cols)}}${stackContent}\\end{array}`;

    // Apply formatting to the entire stack structure
    const stackFormatting = { ...element };
    delete stackFormatting.bold;
    delete stackFormatting.italic;

    return this.applyFormattingToLatex(stackLatex, stackFormatting, false);
  }

  private casesToLatex(element: EquationElement, maxDepth: number, inOperatorName: boolean = false): string {
    const { rows, cols, cells } = element;

    if (!rows || !cols || !cells) {
      return "\\text{Invalid Cases}";
    }

    // Build the cases content from the cells object
    const casesRows: string[] = [];
    for (let row = 0; row < rows; row++) {
      const cellsInRow: string[] = [];
      for (let col = 0; col < cols; col++) {
        const cellKey = `cell_${row}_${col}`;
        const cellElements = cells[cellKey] || [];
        const cellLatex = this.toLatexRecursive(cellElements, maxDepth - 1).trim();
        cellsInRow.push(cellLatex);
      }
      casesRows.push(cellsInRow.join(" & "));
    }
    const casesContent = casesRows.join(" \\\\ ");

    // Use cases environment for piecewise functions
    let casesLatex = `\\begin{cases}${casesContent}\\end{cases}`;

    // Apply formatting to the entire cases structure
    const casesFormatting = { ...element };
    delete casesFormatting.bold;
    delete casesFormatting.italic;

    return this.applyFormattingToLatex(casesLatex, casesFormatting, false);
  }

  private accentToLatex(element: EquationElement, maxDepth: number, inOperatorName: boolean = false): string {
    const baseLatex = this.toLatexRecursive(element.accentBase || [], maxDepth, inOperatorName);

    switch (element.accentType) {
      case "hat":
        return `\\hat{${baseLatex}}`;
      case "tilde":
        return `\\tilde{${baseLatex}}`;
      case "bar":
        return `\\bar{${baseLatex}}`;
      case "dot":
        return `\\dot{${baseLatex}}`;
      case "ddot":
        return `\\ddot{${baseLatex}}`;
      case "vec":
        return `\\vec{${baseLatex}}`;
      case "widehat":
        return `\\widehat{${baseLatex}}`;
      case "widetilde":
        return `\\widetilde{${baseLatex}}`;
      case "widebar":
        return `\\overline{${baseLatex}}`;
      case "overrightarrow":
        return `\\overrightarrow{${baseLatex}}`;
      case "overleftarrow":
        return `\\overleftarrow{${baseLatex}}`;
      case "overleftrightarrow":
        return `\\overleftrightarrow{${baseLatex}}`;
      case "overbrace":
        if (element.accentLabel && element.accentLabel.length > 0) {
          const labelLatex = this.toLatexRecursive(element.accentLabel, maxDepth, inOperatorName);
          return `\\overbrace{${baseLatex}}^{${labelLatex}}`;
        } else {
          return `\\overbrace{${baseLatex}}`;
        }
      case "underbrace":
        if (element.accentLabel && element.accentLabel.length > 0) {
          const labelLatex = this.toLatexRecursive(element.accentLabel, maxDepth, inOperatorName);
          return `\\underbrace{${baseLatex}}_{${labelLatex}}`;
        } else {
          return `\\underbrace{${baseLatex}}`;
        }
      case "labeledoverbrace":
        const overbraceLabel = this.toLatexRecursive(element.accentLabel || [], maxDepth, inOperatorName);
        return `\\overbrace{${baseLatex}}^{${overbraceLabel}}`;
      case "labeledunderbrace":
        const underbraceLabel = this.toLatexRecursive(element.accentLabel || [], maxDepth, inOperatorName);
        return `\\underbrace{${baseLatex}}_{${underbraceLabel}}`;
      case "overparen":
        return `\\overparen{${baseLatex}}`;
      case "underparen":
        return `\\underparen{${baseLatex}}`;
      default:
        return `\\hat{${baseLatex}}`;
    }
  }

  private functionToLatex(element: EquationElement, maxDepth: number, inOperatorName: boolean = false): string {
    const functionType = element.functionType!;
    
    // Parse common elements
    const argumentLatex = this.toLatexRecursive(element.functionArgument || [], maxDepth, inOperatorName);
    
    // User-defined functions (use \operatorname)
    if (["function", "functionsub", "functionlim"].includes(functionType)) {
      const nameLatex = this.toLatexRecursive(element.functionName || [], maxDepth, true);
      if (!nameLatex) return argumentLatex || "\\square";
      
      if (functionType === "functionlim") {
        const constraintLatex = this.toLatexRecursive(element.functionConstraint || [], maxDepth, inOperatorName);
        return `{\\displaystyle \\operatorname*{${nameLatex}}_{${constraintLatex}} ${argumentLatex}}`;
      } else if (functionType === "functionsub") {
        const baseLatex = this.toLatexRecursive(element.functionBase || [], maxDepth, inOperatorName);
        return `\\operatorname{${nameLatex}}_{${baseLatex}} ${argumentLatex}`;
      } else {
        return `\\operatorname{${nameLatex}} ${argumentLatex}`;
      }
    }
    
    // Limit operators (need underscripts)
    if (["max", "min", "lim", "argmax", "argmin"].includes(functionType)) {
      const constraintLatex = this.toLatexRecursive(element.functionConstraint || [], maxDepth, inOperatorName);
      const operatorName = functionType === "argmax" ? "argmax" : 
                           functionType === "argmin" ? "argmin" : functionType;
      return `{\\displaystyle \\operatorname*{${operatorName}}_{${constraintLatex}} ${argumentLatex}}`;
    }
    
    // Base-n logarithm
    if (functionType === "logn") {
      const baseLatex = this.toLatexRecursive(element.functionBase || [], maxDepth, inOperatorName);
      return `\\log_{${baseLatex}} ${argumentLatex}`;
    }
    
    // Inverse trig/hyperbolic functions
    if (["asin", "acos", "atan", "asinh", "acosh", "atanh"].includes(functionType)) {
      const baseNames = { asin: "sin", acos: "cos", atan: "tan", asinh: "sinh", acosh: "cosh", atanh: "tanh" };
      const baseName = baseNames[functionType as keyof typeof baseNames];
      return `\\operatorname{${baseName}^{-1}} ${argumentLatex}`;
    }
    
    // Standard built-in functions
    return `\\${functionType} ${argumentLatex}`;
  }

  private shouldUsePhysicsPackageForDerivative(): boolean {
    // Determine whether to use physics package based on current differential style
    // Use physics package for roman style differentials
    if (this.inputHandler && typeof this.inputHandler.getDifferentialStyleForLatex === "function") {
      return this.inputHandler.getDifferentialStyleForLatex();
    }
    return false; // Default to standard LaTeX if no input handler
  }

  private parseLatexToEquation(latex: string): EquationElement[] {
    const result: EquationElement[] = [];
    let i = 0;

    while (i < latex.length) {
      if (latex.substr(i, 13) === "\\displaystyle") {
        // Handle \displaystyle followed by large operators
        i += 13;
        // Skip whitespace after \displaystyle
        while (i < latex.length && latex[i] === " ") i++;

        if (this.isLargeOperator(latex, i)) {
          const operatorInfo = this.parseLargeOperator(latex, i, true); // true = display mode
          if (operatorInfo) {
            result.push(operatorInfo.element);
            i = operatorInfo.endIndex;
          } else {
            i++;
          }
        } else if (latex.substr(i, 3) === "\\dv") {
          // Handle \displaystyle \dv{f}{x} or \displaystyle \dv{x}(\grande{f})
          i += 3; // Skip "\dv"
          const dvResult = this.parseDvCommand(latex, i, "display", false, false);
          if (dvResult) {
            result.push(dvResult.element);
            i = dvResult.endIndex;
          }
        } else if (latex.substr(i, 4) === "\\pdv") {
          // Handle \displaystyle \pdv{f}{x} or \displaystyle \pdv{x}(\grande{f})
          i += 4; // Skip "\pdv"
          const dvResult = this.parseDvCommand(latex, i, "display", false, true);
          if (dvResult) {
            result.push(dvResult.element);
            i = dvResult.endIndex;
          }
        } else {
          // Check if this is followed by an integral command
          const integralResult = this.parseCustomIntegral(latex, i);
          if (integralResult) {
            integralResult.element.displayMode = "display"; // This was preceded by \displaystyle
            result.push(integralResult.element);
            i = integralResult.endIndex;
          } else {
            // \displaystyle not followed by large operator, \dv, or integral
            // Future: will support other expressions like \frac, \sqrt, etc.
            // Now: treat as text
            result.push({
              id: this.generateElementId(),
              type: "text",
              value: "\\displaystyle",
            });
          }
        }
      } else if (latex.substr(i, 10) === "\\textstyle") {
        // Handle \textstyle (inline mode) - just skip it as operators default to inline
        i += 10;
        // Skip whitespace after \textstyle
        while (i < latex.length && latex[i] === " ") i++;

        if (this.isLargeOperator(latex, i)) {
          const operatorInfo = this.parseLargeOperator(latex, i, false); // false = inline mode
          if (operatorInfo) {
            result.push(operatorInfo.element);
            i = operatorInfo.endIndex;
          } else {
            i++;
          }
        } else if (latex.substr(i, 3) === "\\dv") {
          // Handle \textstyle \dv{f}{x} or \textstyle \dv{x}(\grande{f})
          i += 3; // Skip "\dv"
          const dvResult = this.parseDvCommand(latex, i, "inline", false, false);
          if (dvResult) {
            result.push(dvResult.element);
            i = dvResult.endIndex;
          }
        } else if (latex.substr(i, 4) === "\\pdv") {
          // Handle \textstyle \pdv{f}{x} or \textstyle \pdv{x}(\grande{f})
          i += 4; // Skip "\pdv"
          const dvResult = this.parseDvCommand(latex, i, "inline", false, true);
          if (dvResult) {
            result.push(dvResult.element);
            i = dvResult.endIndex;
          }
        } else {
          // Check if this is followed by an integral command
          const integralResult = this.parseCustomIntegral(latex, i);
          if (integralResult) {
            integralResult.element.displayMode = "inline"; // This was preceded by \textstyle
            result.push(integralResult.element);
            i = integralResult.endIndex;
          }
          // If not followed by large operator, derivative, or integral, just continue (skip the \textstyle)
        }
      } else if (this.tryParseDerivativeCommand(latex, i, result)) {
        i = this.lastDerivativeCommandEndIndex!;
      } else if (latex.substr(i, 6) === "\\dfrac") {
        i += 6;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        result.push({
          id: this.generateElementId(),
          type: "fraction",
          displayMode: "display", // dfrac is display-style
          numerator: this.parseLatexToEquation(numerator.content),
          denominator: this.parseLatexToEquation(denominator.content),
        });
      } else if (latex.substr(i, 5) === "\\frac") {
        i += 5;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        result.push({
          id: this.generateElementId(),
          type: "fraction",
          displayMode: "inline", // frac is inline-style
          numerator: this.parseLatexToEquation(numerator.content),
          denominator: this.parseLatexToEquation(denominator.content),
        });
      } else if (latex.substr(i, 6) === "\\begin") {
        // Parse matrix, stack, and cases environments
        const environmentResult = this.parseMatrixStackCasesEnvironment(latex, i);
        if (environmentResult) {
          result.push(environmentResult.element);
          i = environmentResult.endIndex;
        } else {
          // Not a matrix/stack/cases environment, treat as text
          result.push({
            id: this.generateElementId(),
            type: "text",
            value: latex[i],
          });
          i++;
        }
      } else if (this.isLargeOperator(latex, i)) {
        // Parse large operators like \sum, \prod, \int, etc.
        const operatorInfo = this.parseLargeOperator(latex, i, false); // false = inline mode
        if (operatorInfo) {
          result.push(operatorInfo.element);
          i = operatorInfo.endIndex;
        } else {
          i++;
        }
      } else if (this.tryParseStyleWrapper(latex, i, result)) {
        i = this.lastStyleWrapperEndIndex!;
      } else if (latex.substr(i, 3) === "\\dv") {
        // Parse physics package derivative command
        i += 3;
        const dvResult = this.parseDvCommand(latex, i, "inline", false, false);
        if (dvResult) {
          result.push(dvResult.element);
          i = dvResult.endIndex;
        }
      } else if (latex.substr(i, 4) === "\\pdv") {
        // Parse physics package partial derivative command
        i += 4;
        const dvResult = this.parseDvCommand(latex, i, "inline", false, true);
        if (dvResult) {
          result.push(dvResult.element);
          i = dvResult.endIndex;
        }
      } else if (this.isBuiltinFunctionCommand(latex, i)) {
        // Parse built-in function commands like \sin, \cos, \max, etc.
        const functionResult = this.parseBuiltinFunctionCommand(latex, i);
        if (functionResult) {
          result.push(functionResult.element);
          i = functionResult.endIndex;
        }
      } else if (latex.substr(i, 13) === "\\operatorname") {
        // Parse \operatorname{} or \operatorname*{}
        const operatorResult = this.parseOperatorName(latex, i);
        if (operatorResult) {
          result.push(operatorResult.element);
          i = operatorResult.endIndex;
        }
      } else if (this.isCustomIntegralCommand(latex, i)) {
        // Parse custom integral commands like \inti, \intd, \iinti, etc.
        const integralInfo = this.parseCustomIntegral(latex, i);
        if (integralInfo) {
          result.push(integralInfo.element);
          i = integralInfo.endIndex;
        } else {
          i++;
        }
      } else if (latex.substr(i, 5) === "\\sqrt") {
        i += 5;

        if (i < latex.length && latex[i] === "[") {
          const indexStart = i + 1;
          let indexEnd = indexStart;
          let bracketCount = 1;

          while (indexEnd < latex.length && bracketCount > 0) {
            if (latex[indexEnd] === "[") bracketCount++;
            else if (latex[indexEnd] === "]") bracketCount--;
            indexEnd++;
          }

          const indexContent = latex.substring(indexStart, indexEnd - 1);
          i = indexEnd;

          const radicand = this.parseLatexGroup(latex, i);
          i = radicand.endIndex;

          result.push({
            id: this.generateElementId(),
            type: "nthroot",
            index: this.parseLatexToEquation(indexContent),
            radicand: this.parseLatexToEquation(radicand.content),
          });
        } else {
          const radicand = this.parseLatexGroup(latex, i);
          i = radicand.endIndex;

          result.push({
            id: this.generateElementId(),
            type: "sqrt",
            radicand: this.parseLatexToEquation(radicand.content),
          });
        }
      } else if (latex[i] === "^" || latex[i] === "_") {
        const isSuper = latex[i] === "^";
        i++;

        let baseElement: EquationElement;
        if (result.length > 0 && result[result.length - 1].type === "script") {
          baseElement = result.pop()!;
        } else if (result.length > 0) {
          const lastElement = result.pop()!;
          baseElement = {
            id: this.generateElementId(),
            type: "script",
            base: [lastElement],
            superscript: undefined,
            subscript: undefined,
          };
        } else {
          baseElement = {
            id: this.generateElementId(),
            type: "script",
            base: [],
            superscript: undefined,
            subscript: undefined,
          };
        }

        const scriptContent = this.parseLatexGroup(latex, i);
        i = scriptContent.endIndex;

        if (isSuper) {
          baseElement.superscript = this.parseLatexToEquation(scriptContent.content);
        } else {
          baseElement.subscript = this.parseLatexToEquation(scriptContent.content);
        }

        result.push(baseElement);
      } else if (latex[i] === "{") {
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;

        // Try to extract from style wrapper (displaystyle/textstyle)
        const styleWrapper = this.extractFromStyleWrapper(group.content, 0);
        if (styleWrapper && styleWrapper.hasWrapper) {
          const parsedElements = this.parseLatexToEquation(styleWrapper.content);
          // Apply the style mode to elements that support it
          if (styleWrapper.styleType) {
            this.applyStyleModeToElements(parsedElements, styleWrapper.styleType);
          }
          result.push(...parsedElements);
        } else {
          result.push(...this.parseLatexToEquation(group.content));
        }
      } else if (latex[i] === " ") {
        i++;
        // Check for LaTeX symbol commands
      } else if (
        latex[i] === "\\" &&
        !this.isBracketCommand(latex, i) &&
        !this.isLargeOperator(latex, i)
      ) {
        // Try to parse as a LaTeX symbol command
        const newIndex = this.tryParseLatexSymbol(latex, i, result);
        if (newIndex !== null) {
          i = newIndex;
        } else if (this.tryParseFormattingCommand(latex, i, result)) {
          i = this.lastFormattingCommandEndIndex!;
        } else if (latex.substr(i, 10) === "\\textcolor") {
          i += 10;
          const colorGroup = this.parseLatexGroup(latex, i);
          i = colorGroup.endIndex;
          const contentGroup = this.parseLatexGroup(latex, i);
          i = contentGroup.endIndex;
          const formattedElements = this.parseLatexToEquation(contentGroup.content);
          const wrapperGroupId = this.generateElementId();

          // Apply color wrapper using multi-wrapper system
          this.applyWrapperToElements(formattedElements, "color", colorGroup.content);
          result.push(...formattedElements);
        } else if (latex.substr(i, 6) === "\\color") {
          i += 6;
          const colorGroup = this.parseLatexGroup(latex, i);
          i = colorGroup.endIndex;
          const contentGroup = this.parseLatexGroup(latex, i);
          i = contentGroup.endIndex;
          const formattedElements = this.parseLatexToEquation(contentGroup.content);
          formattedElements.forEach((element) => {
            if (element.type === "text") {
              element.color = colorGroup.content;
            }
          });
          result.push(...formattedElements);
        } else if (latex.substr(i, 10) === "\\underline") {
          i += 10;
          const group = this.parseLatexGroup(latex, i);
          i = group.endIndex;

          // Check if this is a double underline (nested \underline)
          const isDoubleUnderline =
            group.content.startsWith("\\underline{") && group.content.endsWith("}");

          const wrapperGroupId = this.generateElementId();

          if (isDoubleUnderline) {
            // Parse the inner content for double underline
            const innerContent = group.content.slice(11, -1); // Remove \underline{ and }
            const formattedElements = this.parseLatexToEquation(innerContent);
            // Apply double underline wrapper using multi-wrapper system
            this.applyWrapperToElements(formattedElements, "underline", "double");
            result.push(...formattedElements);
          } else {
            // Single underline
            const formattedElements = this.parseLatexToEquation(group.content);
            // Apply single underline wrapper using multi-wrapper system
            this.applyWrapperToElements(formattedElements, "underline", "single");
            result.push(...formattedElements);
          }
        } else if (latex.substr(i, 7) === "\\cancel") {
          i += 7;
          const group = this.parseLatexGroup(latex, i);
          i = group.endIndex;
          // Parse the content and apply wrapper group metadata to each element
          const wrappedElements = this.parseLatexToEquation(group.content);

          // Apply cancel wrapper using multi-wrapper system
          this.applyWrapperToElements(wrappedElements, "cancel");

          // Add the elements directly to the result (not as a wrapper)
          result.push(...wrappedElements);
        } else if (this.tryParseAccentCommand(latex, i, result)) {
          i = this.lastAccentCommandEndIndex!;
        } else if (latex.substr(i, 6) === "\\text{") {
          // Handle \text{} commands specially
          if (latex.substr(i, 9) === "\\text{＆}") {
            result.push({
              id: this.generateElementId(),
              type: "text",
              value: "&",
            });
            i += 9;
          } else {
            // Handle other \text{} commands
            i += 6; // Skip \text{
            const group = this.parseLatexGroup(latex, i - 1); // Parse from the { we just skipped
            i = group.endIndex;

            // Parse the content inside \text{} and mark each character as text mode
            const textContent = group.content;
            for (let j = 0; j < textContent.length; j++) {
              const char = textContent[j];
              result.push({
                id: this.generateElementId(),
                type: "text",
                value: char,
                textMode: true,
                italic: false, // Text mode should be roman
              });
            }
          }
        } else {
          // Unknown command - skip it
          i++;
        }
      } else if (latex.substr(i, 10) === "{\\text{^}}") {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: "^",
        });
        i += 10;
      } else if (latex.substr(i, 5) === "{\\_}") {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: "_",
        });
        i += 5;
      } else if (latex.substr(i, 17) === "\\textasciitilde") {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: "~",
        });
        i += 17;
        // Skip the {} if present
        if (latex.substr(i, 2) === "{}") {
          i += 2;
        }
      } else if (latex.substr(i, 2) === "\\{") {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: "{",
        });
        i += 2;
      } else if (latex.substr(i, 2) === "\\}") {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: "}",
        });
        i += 2;
      } else if (latex.substr(i, 2) === "\\#") {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: "#",
        });
        i += 2;
      } else if (latex.substr(i, 2) === "\\%") {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: "%",
        });
        i += 2;
      } else if (latex.substr(i, 5) === "\\left") {
        const bracketInfo = this.parseBracketCommand(latex, i);
        if (bracketInfo) {
          result.push({
            id: this.generateElementId(),
            type: "bracket",
            leftBracketSymbol: bracketInfo.leftSymbol,
            rightBracketSymbol: bracketInfo.rightSymbol,
            content: this.parseLatexToEquation(bracketInfo.content),
          });
          i = bracketInfo.endIndex;
        } else {
          result.push({
            id: this.generateElementId(),
            type: "text",
            value: latex[i],
          });
          i++;
        }
      } else if (this.isBracketCommand(latex, i)) {
        const bracketInfo = this.parseBracketCommand(latex, i);
        if (bracketInfo) {
          result.push({
            id: this.generateElementId(),
            type: "bracket",
            leftBracketSymbol: bracketInfo.leftSymbol,
            rightBracketSymbol: bracketInfo.rightSymbol,
            content: this.parseLatexToEquation(bracketInfo.content),
          });
          i = bracketInfo.endIndex;
        } else {
          // Skip bracket commands that couldn't be parsed to prevent them appearing as text
          const skipped = this.skipBracketCommand(latex, i);
          if (skipped > 0) {
            i += skipped;
          } else {
            result.push({
              id: this.generateElementId(),
              type: "text",
              value: latex[i],
            });
            i++;
          }
        }
      } else {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: latex[i],
        });
        i++;
      }
    }

    return result;
  }

  private parseLatexGroup(
    latex: string,
    startIndex: number
  ): { content: string; endIndex: number } {
    if (latex[startIndex] !== "{") {
      return {
        content: latex[startIndex] || "",
        endIndex: startIndex + 1,
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
            endIndex: i + 1,
          };
        }
      }
      i++;
    }

    return {
      content: latex.substring(startIndex + 1),
      endIndex: latex.length,
    };
  }

  private isBracketCommand(latex: string, index: number): boolean {
    const bracketCommands = ["\\left"];
    return bracketCommands.some((cmd) => latex.substr(index, cmd.length) === cmd);
  }

  private skipBracketCommand(latex: string, index: number): number {
    const bracketCommands = [
      "\\left",
      "\\right",
    ];
    for (const cmd of bracketCommands) {
      if (latex.substr(index, cmd.length) === cmd) {
        return cmd.length;
      }
    }
    return 0;
  }

  private parseBracketCommand(
    latex: string,
    startIndex: number
  ): {
    leftSymbol: string;
    rightSymbol: string;
    content: string;
    endIndex: number;
  } | null {
    // Extract the bracket command
    let leftCommand = "";

    const commands = ["\\left"];
    for (let i = 0; i < commands.length; i++) {
      if (latex.substr(startIndex, commands[i].length) === commands[i]) {
        leftCommand = commands[i];
        break;
      }
    }

    if (!leftCommand) return null;

    let pos = startIndex + leftCommand.length;

    // Extract the left bracket symbol
    const leftBracketInfo = this.extractBracketSymbol(latex, pos);
    if (!leftBracketInfo) return null;

    pos = leftBracketInfo.endIndex;
    const leftSymbol = leftBracketInfo.symbol;

    // Find the matching right bracket by looking for balanced brackets
    const contentStart = pos;
    let depth = 1;
    let j = pos;

    while (j < latex.length && depth > 0) {
      // Check for right bracket commands
      if (latex.substr(j, 6) === "\\right") {
        let rightCommandLength = 6;

        const rightBracketInfo = this.extractBracketSymbol(latex, j + rightCommandLength);
        if (rightBracketInfo) {
          depth--;
          if (depth === 0) {
            const content = latex.substring(contentStart, j);
            return {
              leftSymbol,
              rightSymbol: rightBracketInfo.symbol,
              content,
              endIndex: rightBracketInfo.endIndex,
            };
          }
          j = rightBracketInfo.endIndex;
        } else {
          j++;
        }
      }
      // Check for nested left bracket commands
      else if (this.isBracketCommand(latex, j)) {
        depth++;
        j++;
      } else {
        j++;
      }
    }

    return null;
  }

  private extractBracketSymbol(
    latex: string,
    startIndex: number
  ): { symbol: string; endIndex: number } | null {
    if (startIndex >= latex.length) return null;

    if (latex[startIndex] === "(") return { symbol: "(", endIndex: startIndex + 1 };
    if (latex[startIndex] === ")") return { symbol: ")", endIndex: startIndex + 1 };
    if (latex[startIndex] === "[") return { symbol: "[", endIndex: startIndex + 1 };
    if (latex[startIndex] === "]") return { symbol: "]", endIndex: startIndex + 1 };
    if (latex[startIndex] === "|") return { symbol: "|", endIndex: startIndex + 1 };

    // Only treat "." as invisible bracket if immediately following a bracket command
    if (latex[startIndex] === ".") {
      const bracketCommands = [
        "\\left",
        "\\right",
      ];
      for (const cmd of bracketCommands) {
        if (startIndex >= cmd.length && latex.substr(startIndex - cmd.length, cmd.length) === cmd) {
          return { symbol: ".", endIndex: startIndex + 1 };
        }
      }
    }

    if (latex.substr(startIndex, 2) === "\\{") return { symbol: "{", endIndex: startIndex + 2 };
    if (latex.substr(startIndex, 2) === "\\}") return { symbol: "}", endIndex: startIndex + 2 };
    if (latex.substr(startIndex, 2) === "\\|") return { symbol: "‖", endIndex: startIndex + 2 };

    if (latex.substr(startIndex, 7) === "\\lfloor") return { symbol: "⌊", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 7) === "\\rfloor") return { symbol: "⌋", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 6) === "\\lceil") return { symbol: "⌈", endIndex: startIndex + 6 };
    if (latex.substr(startIndex, 6) === "\\rceil") return { symbol: "⌉", endIndex: startIndex + 6 };
    if (latex.substr(startIndex, 7) === "\\langle") return { symbol: "⟨", endIndex: startIndex + 7 };
    if (latex.substr(startIndex, 7) === "\\rangle") return { symbol: "⟩", endIndex: startIndex + 7 };

    return null;
  }

  private getBracketLatexSymbols(
    leftSymbol: string,
    rightSymbol: string
  ): { latexLeft: string; latexRight: string } {
    // Always use \left and \right for automatic sizing
    let leftSize = "";
    let rightSize = "";

    // Map symbols to LaTeX bracket commands
    const getLatexBracket = (symbol: string, isLeft: boolean): string => {
      if (!symbol) return "";

      switch (symbol) {
        case "(":
          return "\\left(";
        case ")":
          return "\\right)";
        case "[":
          return "\\left[";
        case "]":
          return "\\right]";
        case "{":
          return "\\left\\{";
        case "}":
          return "\\right\\}";
        case "⌊":
          return "\\left\\lfloor";
        case "⌋":
          return "\\right\\rfloor";
        case "⌈":
          return "\\left\\lceil";
        case "⌉":
          return "\\right\\rceil";
        case "|":
          return isLeft ? "\\left|" : "\\right|";
        case "‖":
          return isLeft ? "\\left\\|" : "\\right\\|";
        case "⟨":
          return "\\left\\langle";
        case "⟩":
          return "\\right\\rangle";
        case ".":
          return isLeft ? "\\left." : "\\right.";
        default:
          return symbol; // fallback to the raw symbol
      }
    };

    const latexLeft = getLatexBracket(leftSymbol, true);
    const latexRight = getLatexBracket(rightSymbol, false);

    return { latexLeft, latexRight };
  }

  private hasEqualFormatting(element: EquationElement, formatting: any): boolean {
    // First check legacy formatting properties
    const legacyFormattingMatch =
      element.bold === formatting.bold &&
      this.getEffectiveItalicFormatting(element.italic) ===
        this.getEffectiveItalicFormatting(formatting.italic) &&
      element.color === formatting.color &&
      element.underline === formatting.underline &&
      element.cancel === formatting.cancel &&
      element.textMode === formatting.textMode;

    // Then check if wrappers match
    // If either element has wrappers, they must match exactly
    if (element.wrappers || formatting.wrappers) {
      // Create a dummy element with formatting's wrappers for comparison
      const formattingElement: EquationElement = {
        id: "",
        type: "text",
        value: "",
        wrappers: formatting.wrappers,
      };
      return legacyFormattingMatch && this.haveSameWrappers(element, formattingElement);
    }

    return legacyFormattingMatch;
  }

  private checkUniformFormatting(elements: EquationElement[]): any | null {
    if (elements.length === 0) return null;

    // Recursively collect all formatting from text elements
    const allFormattings = this.collectAllFormattings(elements);
    if (allFormattings.length === 0) return null;

    // Filter out formattings that only have wrapper-eligible properties (cancel, underline, color)
    const wrapperEligibleFormattings = allFormattings
      .map((formatting) => ({
        cancel: formatting.cancel,
        underline: formatting.underline,
        color: formatting.color,
      }))
      .filter((formatting) => formatting.cancel || formatting.underline || formatting.color);

    if (wrapperEligibleFormattings.length === 0) return null;

    // Check if all wrapper-eligible formattings are the same
    const referenceFormatting = wrapperEligibleFormattings[0];

    for (const formatting of wrapperEligibleFormattings) {
      if (
        formatting.cancel !== referenceFormatting.cancel ||
        formatting.underline !== referenceFormatting.underline ||
        formatting.color !== referenceFormatting.color
      ) {
        return null; // Not uniform
      }
    }

    // Check that we have a reasonable number of formatted elements
    const totalTextElements = this.countTextElements(elements);
    const allTextFormattings = this.collectAllFormattings(elements);
    const textElementsWithWrapperFormatting = allTextFormattings.filter(
      (f) => f.cancel || f.underline || f.color
    ).length;

    // Be very conservative: require ALL text elements that have any wrapper formatting to have the SAME wrapper formatting
    if (textElementsWithWrapperFormatting !== wrapperEligibleFormattings.length) {
      return null;
    }

    // Require at least 2 formatted elements and at least 80% of text elements to be formatted
    if (
      wrapperEligibleFormattings.length < 2 ||
      wrapperEligibleFormattings.length < Math.ceil(totalTextElements * 0.8)
    ) {
      return null;
    }

    return referenceFormatting;
  }

  private collectAllFormattings(elements: EquationElement[]): any[] {
    const formattings: any[] = [];

    for (const element of elements) {
      // Only collect formatting from text elements (elements that can actually be formatted)
      if (element.type === "text") {
        // Check if this text element has formatting
        if (
          element.cancel ||
          element.underline ||
          element.color ||
          element.bold ||
          element.italic !== undefined
        ) {
          formattings.push({
            bold: element.bold,
            italic: element.italic,
            color: element.color,
            underline: element.underline,
            cancel: element.cancel,
          });
        }
      } else {
        // For non-text elements, recursively check their children
        const childArrays = [
          element.numerator,
          element.denominator, // fraction, bevelled-fraction
          element.radicand,
          element.index, // sqrt, nthroot
          element.base,
          element.superscript,
          element.subscript, // script
          element.content, // bracket
          element.lowerLimit,
          element.upperLimit,
          element.operand, // large-operator
          element.integrand,
          element.differentialVariable, // integral
          element.function,
          element.variable,
          element.order, // derivative
        ].filter(Boolean);

        for (const childArray of childArrays) {
          if (Array.isArray(childArray)) {
            formattings.push(...this.collectAllFormattings(childArray));
          }
        }

        // Handle matrix cells
        if (element.type === "matrix" && element.cells) {
          for (const cellKey in element.cells) {
            formattings.push(...this.collectAllFormattings(element.cells[cellKey]));
          }
        }
      }
    }

    return formattings;
  }

  private countTextElements(elements: EquationElement[]): number {
    let count = 0;

    for (const element of elements) {
      if (element.type === "text") {
        count++;
      } else {
        // For non-text elements, recursively count their children
        const childArrays = [
          element.numerator,
          element.denominator, // fraction, bevelled-fraction
          element.radicand,
          element.index, // sqrt, nthroot
          element.base,
          element.superscript,
          element.subscript, // script
          element.content, // bracket
          element.lowerLimit,
          element.upperLimit,
          element.operand, // large-operator
          element.integrand,
          element.differentialVariable, // integral
          element.function,
          element.variable,
          element.order, // derivative
        ].filter(Boolean);

        for (const childArray of childArrays) {
          if (Array.isArray(childArray)) {
            count += this.countTextElements(childArray);
          }
        }

        // Handle matrix cells
        if (element.type === "matrix" && element.cells) {
          for (const cellKey in element.cells) {
            count += this.countTextElements(element.cells[cellKey]);
          }
        }
      }
    }

    return count;
  }

  private removeUniformFormattingFromElements(
    elements: EquationElement[],
    uniformFormatting: any
  ): EquationElement[] {
    return elements.map((element) =>
      this.removeUniformFormattingFromElement(element, uniformFormatting)
    );
  }

  private removeUniformFormattingFromElement(
    element: EquationElement,
    uniformFormatting: any
  ): EquationElement {
    // Create a deep copy of the element
    const cleanElement = JSON.parse(JSON.stringify(element));

    // Remove uniform formatting properties from this element
    if (uniformFormatting.cancel && cleanElement.cancel === uniformFormatting.cancel) {
      delete cleanElement.cancel;
    }
    if (uniformFormatting.underline && cleanElement.underline === uniformFormatting.underline) {
      delete cleanElement.underline;
    }
    if (uniformFormatting.color && cleanElement.color === uniformFormatting.color) {
      delete cleanElement.color;
    }

    // Recursively clean child elements
    const childArrays = [
      "numerator",
      "denominator", // fraction, bevelled-fraction
      "radicand",
      "index", // sqrt, nthroot
      "base",
      "superscript",
      "subscript", // script
      "content", // bracket
      "lowerLimit",
      "upperLimit",
      "operand", // large-operator
      "integrand",
      "differentialVariable", // integral
      "function",
      "variable",
      "order", // derivative
    ];

    for (const childProp of childArrays) {
      if (cleanElement[childProp] && Array.isArray(cleanElement[childProp])) {
        cleanElement[childProp] = cleanElement[childProp].map((child: EquationElement) =>
          this.removeUniformFormattingFromElement(child, uniformFormatting)
        );
      }
    }

    // Handle matrix cells
    if (cleanElement.type === "matrix" && cleanElement.cells) {
      for (const cellKey in cleanElement.cells) {
        cleanElement.cells[cellKey] = cleanElement.cells[cellKey].map((child: EquationElement) =>
          this.removeUniformFormattingFromElement(child, uniformFormatting)
        );
      }
    }

    return cleanElement;
  }

  private getEffectiveItalicFormatting(italic: boolean | undefined): string {
    if (italic === true) return "mathit";
    if (italic === false) return "mathrm";
    return "plain"; // undefined = naturally italic, no wrapping needed
  }

  private isOperatorSymbol(text: string): boolean {
    // Trim whitespace to handle cases like " = " or " + "
    const trimmedText = text.trim();

    // Check if the text is a known mathematical operator using symbol config
    // First check direct matches (like "=" which has unicode "=")
    const directMatch = Object.values(SYMBOL_CONFIG).find((info) => info.unicode === trimmedText);
    if (directMatch && !directMatch.defaultItalic) {
      return true;
    }

    // Also check if text is a latex command that maps to an operator
    const symbolInfo = SYMBOL_CONFIG[trimmedText];
    if (symbolInfo && !symbolInfo.defaultItalic) {
      return true;
    }

    // Check if the entire text (with spaces) consists only of operators and whitespace
    if (text !== trimmedText && trimmedText.length === 1) {
      // This handles cases like " = " where we want to treat the whole thing as an operator
      return this.isOperatorSymbol(trimmedText);
    }

    return false;
  }

  private applyWrapperToElements(
    elements: EquationElement[],
    wrapperType: "cancel" | "underline" | "color",
    wrapperValue?: string
  ): void {
    // Apply wrapper using multi-wrapper system, preserving existing wrappers and tracking order
    const wrapperGroupId = this.generateElementId();

    elements.forEach((element) => {
      if (!element.wrappers) element.wrappers = {};

      // Initialize wrapperOrder if it doesn't exist
      if (!element.wrapperOrder) element.wrapperOrder = [];

      // Only add to order if this wrapper type doesn't already exist
      if (!element.wrappers[wrapperType]) {
        element.wrapperOrder.push(wrapperType);
      }

      if (wrapperType === "cancel") {
        element.wrappers.cancel = { id: wrapperGroupId };
      } else if (wrapperType === "underline") {
        element.wrappers.underline = {
          id: wrapperGroupId,
          type: wrapperValue as "single" | "double",
        };
      } else if (wrapperType === "color") {
        element.wrappers.color = { id: wrapperGroupId, value: wrapperValue! };
      }
    });
  }

  private applyFormattingToLatex(text: string, formatting: any, inOperatorName: boolean = false): string {
    let result = text;

    // Apply formatting in the correct nesting order
    // Bold and italic (innermost)
    if (formatting.bold && formatting.italic) {
      // Use \boldsymbol for both letters and numbers when both bold and italic - no italic for numbers
      // since MathJax 3.x does not process macros in text-mode. It only handles math-mode macros
      result = `\\boldsymbol{${result}}`;
    } else if (formatting.bold) {
      result = `\\mathbf{${result}}`;
    } else if (formatting.italic === true) {
      result = `\\mathit{${result}}`;
    } else if (formatting.italic === false) {
      // Don't apply \mathrm{} to text mode elements (they should use \text{} wrapper instead)
      // Also don't apply to LaTeX commands or known operator symbols as it removes proper spacing
      // Don't apply to text inside \operatorname{} as \operatorname already handles upright formatting
      if (!formatting.textMode && !result.startsWith("\\") && !this.isOperatorSymbol(result) && !inOperatorName) {
        result = `\\mathrm{${result}}`;
      }
    }
    // If formatting.italic is undefined, leave as plain text (naturally italic)

    // Underline
    if (formatting.underline) {
      if (formatting.underline === "double") {
        // Double underline using nested \underline commands
        result = `\\underline{\\underline{${result}}}`;
      } else {
        // Single underline (default for all other types)
        result = `\\underline{${result}}`;
      }
    }

    // Cancel
    if (formatting.cancel) {
      result = `\\cancel{${result}}`;
    }

    // Color (outermost)
    if (formatting.color) {
      result = `\\textcolor{${formatting.color}}{${result}}`;
    }

    return result;
  }

  private convertOperatorToLatex(operator: string): string {
    // Use the UNICODE_TO_LATEX mapping for all symbol conversions
    const latexCommand = UNICODE_TO_LATEX[operator];
    if (latexCommand) {
      return latexCommand;
    }

    // If no mapping found, return the original operator
    return operator;
  }

  private isLatexCommand(latex: string, index: number): boolean {
    // Check if this is the start of a LaTeX command (backslash followed by letters)
    if (latex[index] !== "\\") return false;
    let pos = index + 1;
    while (pos < latex.length && latex[pos].match(/[a-zA-Z]/)) {
      pos++;
    }
    return pos > index + 1; // Must have at least one letter after backslash
  }

  private isLargeOperator(latex: string, index: number): boolean {
    // Use the centralized LARGE_OPERATORS list
    return LARGE_OPERATORS.some((op) => {
      if (latex.substr(index, op.length) === op) {
        // Make sure the next character is not a letter (to avoid partial matches)
        const nextCharIndex = index + op.length;
        if (nextCharIndex >= latex.length || !latex[nextCharIndex].match(/[a-zA-Z]/)) {
          return true;
        }
      }
      return false;
    });
  }

  private parseLargeOperator(
    latex: string,
    index: number,
    forceDisplayMode?: boolean
  ): { element: EquationElement; endIndex: number } | null {
    // Use LATEX_TO_UNICODE for the mapping

    // Find which operator matches
    let operatorCommand = "";
    let operatorSymbol = "";

    for (const command of LARGE_OPERATORS) {
      if (latex.substr(index, command.length) === command) {
        operatorCommand = command;
        operatorSymbol = LATEX_TO_UNICODE[command] || "";
        break;
      }
    }

    if (!operatorCommand) {
      return null;
    }

    let pos = index + operatorCommand.length;
    let limitMode: "default" | "nolimits" | "limits" = "limits"; // default
    let displayMode: "inline" | "display" = forceDisplayMode ? "display" : "inline"; // Use forced display mode if provided

    // Check for \limits, \nolimits
    if (latex.substr(pos, 7) === "\\limits") {
      limitMode = "limits";
      pos += 7;
    } else if (latex.substr(pos, 9) === "\\nolimits") {
      limitMode = "nolimits";
      pos += 9;
    }

    // Parse subscript and superscript (limits)
    let lowerLimit: EquationElement[] = [];
    let upperLimit: EquationElement[] = [];
    let operand: EquationElement[] = [];

    // Skip whitespace
    while (pos < latex.length && latex[pos] === " ") pos++;

    // Parse _ (subscript/lower limit)
    if (pos < latex.length && latex[pos] === "_") {
      pos++;
      const limitGroup = this.parseLatexGroup(latex, pos);
      lowerLimit = this.parseLatexToEquation(limitGroup.content);
      pos = limitGroup.endIndex;
    }

    // Skip whitespace
    while (pos < latex.length && latex[pos] === " ") pos++;

    // Parse ^ (superscript/upper limit)
    if (pos < latex.length && latex[pos] === "^") {
      pos++;
      const limitGroup = this.parseLatexGroup(latex, pos);
      upperLimit = this.parseLatexToEquation(limitGroup.content);
      pos = limitGroup.endIndex;
    }

    // Parse operand (now wrapped in braces for predictable parsing)
    // Skip whitespace
    while (pos < latex.length && latex[pos] === " ") pos++;

    // The operand should be in braces after the limits
    if (pos < latex.length && latex[pos] === "{") {
      const operandGroup = this.parseLatexGroup(latex, pos);
      operand = this.parseLatexToEquation(operandGroup.content);
      pos = operandGroup.endIndex;
    }

    const element: EquationElement = {
      id: this.generateElementId(),
      type: "large-operator",
      operator: operatorSymbol,
      limitMode,
      displayMode,
      lowerLimit,
      upperLimit,
      operand,
    };

    return { element, endIndex: pos };
  }

  private escapeLatexSpecialChars(text: string): string {
    // Escape LaTeX special characters that could break parsing
    // Only escape characters that haven't already been converted to LaTeX commands
    let result = text;

    // Don't escape if the text is already a LaTeX command (starts with \)
    if (result.startsWith("\\")) {
      return result;
    }

    // Escape special characters that could break LaTeX parsing
    // Backslash is blocked from input due to MathJax spacing issues
    result = result.replace(/\{/g, "\\{"); // Opening brace
    result = result.replace(/\}/g, "\\}"); // Closing brace
    result = result.replace(/#/g, "\\#"); // Hash
    // Replace & with similar Unicode character that MathJax can handle
    result = result.replace(/&/g, "\\text{＆}"); // Fullwidth ampersand (U+FF06)
    result = result.replace(/%/g, "\\%"); // Percent (comment character)
    result = result.replace(/~/g, "\\textasciitilde{}"); // Tilde

    // Escape ^ and _ when they should be literal characters (not superscript/subscript)
    // In math mode, these are special operators, so we need to escape them for literal display
    result = result.replace(/\^/g, "{\\text{^}}"); // Caret in text mode without backslash
    result = result.replace(/_/g, "{\\_}"); // Underscore escaped in math mode

    return result;
  }

  private tryParseLatexSymbol(
    latex: string,
    index: number,
    result: EquationElement[]
  ): number | null {
    // Check if we have a LaTeX symbol command at this position
    const commandLength = getLatexCommandLength(latex, index);
    if (commandLength > 0) {
      const command = latex.substr(index, commandLength);
      const unicode = LATEX_TO_UNICODE[command];
      if (unicode) {
        result.push({
          id: this.generateElementId(),
          type: "text",
          value: unicode,
        });
        return index + commandLength;
      }
    }
    return null;
  }

  private isCustomIntegralCommand(latex: string, index: number): boolean {
    for (const cmd of INTEGRAL_COMMANDS) {
      if (latex.substr(index, cmd.length) === cmd) {
        // Make sure it's not part of a longer command
        const nextChar = latex[index + cmd.length];
        if (
          !nextChar ||
          nextChar === "{" ||
          nextChar === "[" ||
          nextChar === " " ||
          nextChar === "\\"
        ) {
          console.log("Found integral command:", cmd, "at index:", index);
          return true;
        }
      }
    }
    if (latex[index] === "\\" && latex.substr(index, 10).includes("int")) {
      console.log("Checking integral at", index, ":", latex.substr(index, 15), "against commands:", INTEGRAL_COMMANDS.slice(0, 5));
    }
    return false;
  }

  private parseFraction(
    latex: string,
    index: number,
    forceInlineMode?: boolean
  ): { element: EquationElement; endIndex: number } | null {
    // Check if this is a \frac or \dfrac command
    let isDisplayFrac = false;
    let i = index;

    if (latex.substr(i, 6) === "\\dfrac") {
      isDisplayFrac = true;
      i += 6;
    } else if (latex.substr(i, 5) === "\\frac") {
      i += 5;
    } else {
      return null;
    }

    // Parse numerator {num}
    if (i >= latex.length || latex[i] !== "{") return null;
    const numerator = this.parseLatexGroup(latex, i);
    i = numerator.endIndex;

    // Parse denominator {den}
    if (i >= latex.length || latex[i] !== "{") return null;
    const denominator = this.parseLatexGroup(latex, i);
    i = denominator.endIndex;

    const element: EquationElement = {
      id: this.generateElementId(),
      type: "fraction",
      numerator: this.parseLatexToEquation(numerator.content),
      denominator: this.parseLatexToEquation(denominator.content),
      displayMode: forceInlineMode ? "inline" : isDisplayFrac ? "display" : undefined,
    };

    return { element, endIndex: i };
  }

  private parseCustomIntegral(
    latex: string,
    startIndex: number
  ): { element: EquationElement; endIndex: number } | null {
    let i = startIndex;
    console.log("parseCustomIntegral called with:", latex.substr(startIndex, 20));

    // Determine which command we're parsing
    let integralType: "single" | "double" | "triple" | "contour" = "single";
    let integralStyle: "italic" | "roman" = "italic";
    let commandLength = 0;
    let isDefinite = false;

    // Check for definite integral commands first (longer commands)
    let limitMode: "default" | "nolimits" | "limits" = "default";

    if (latex.substr(i, 12) === "\\iiintdnolim") {
      integralType = "triple";
      integralStyle = "roman";
      commandLength = 12;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 12) === "\\iiintinolim") {
      integralType = "triple";
      integralStyle = "italic";
      commandLength = 12;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 10) === "\\iiintdlim") {
      integralType = "triple";
      integralStyle = "roman";
      commandLength = 10;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 10) === "\\iiintilim") {
      integralType = "triple";
      integralStyle = "italic";
      commandLength = 10;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 11) === "\\iintdnolim") {
      integralType = "double";
      integralStyle = "roman";
      commandLength = 11;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 11) === "\\iintinolim") {
      integralType = "double";
      integralStyle = "italic";
      commandLength = 11;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 9) === "\\iintdlim") {
      integralType = "double";
      integralStyle = "roman";
      commandLength = 9;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 9) === "\\iintilim") {
      integralType = "double";
      integralStyle = "italic";
      commandLength = 9;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 11) === "\\ointdnolim") {
      integralType = "contour";
      integralStyle = "roman";
      commandLength = 11;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 11) === "\\ointinolim") {
      integralType = "contour";
      integralStyle = "italic";
      commandLength = 11;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 9) === "\\ointdlim") {
      integralType = "contour";
      integralStyle = "roman";
      commandLength = 9;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 9) === "\\ointilim") {
      integralType = "contour";
      integralStyle = "italic";
      commandLength = 9;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 10) === "\\intdnolim") {
      integralType = "single";
      integralStyle = "roman";
      commandLength = 10;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 10) === "\\intinolim") {
      integralType = "single";
      integralStyle = "italic";
      commandLength = 10;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 8) === "\\intdlim") {
      integralType = "single";
      integralStyle = "roman";
      commandLength = 8;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 8) === "\\intilim") {
      integralType = "single";
      integralStyle = "italic";
      commandLength = 8;
      isDefinite = true;
      limitMode = "limits";
    }
    // Check for single integral with subscript (3-parameter)
    else if (latex.substr(i, 8) === "\\intisub") {
      integralType = "single";
      integralStyle = "italic";
      commandLength = 8;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 8) === "\\intdsub") {
      integralType = "single";
      integralStyle = "roman";
      commandLength = 8;
      isDefinite = true;
      limitMode = "nolimits";
    }
    // Check for 3-parameter integral commands (subscript and lower limit variants)
    else if (latex.substr(i, 12) === "\\iiintilower") {
      integralType = "triple";
      integralStyle = "italic";
      commandLength = 12;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 12) === "\\iiintdlower") {
      integralType = "triple";
      integralStyle = "roman";
      commandLength = 12;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 10) === "\\iiintisub") {
      integralType = "triple";
      integralStyle = "italic";
      commandLength = 10;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 10) === "\\iiintdsub") {
      integralType = "triple";
      integralStyle = "roman";
      commandLength = 10;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 11) === "\\iintilower") {
      integralType = "double";
      integralStyle = "italic";
      commandLength = 11;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 11) === "\\iintdlower") {
      integralType = "double";
      integralStyle = "roman";
      commandLength = 11;
      isDefinite = true;
      limitMode = "limits";
    } else if (latex.substr(i, 9) === "\\iintisub") {
      integralType = "double";
      integralStyle = "italic";
      commandLength = 9;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 9) === "\\iintdsub") {
      integralType = "double";
      integralStyle = "roman";
      commandLength = 9;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 9) === "\\ointisub") {
      integralType = "contour";
      integralStyle = "italic";
      commandLength = 9;
      isDefinite = true;
      limitMode = "nolimits";
    } else if (latex.substr(i, 9) === "\\ointdsub") {
      integralType = "contour";
      integralStyle = "roman";
      commandLength = 9;
      isDefinite = true;
      limitMode = "nolimits";
    }
    // Check for indefinite integral commands (shorter commands)
    else if (latex.substr(i, 7) === "\\iiintd") {
      integralType = "triple";
      integralStyle = "roman";
      commandLength = 7;
    } else if (latex.substr(i, 7) === "\\iiinti") {
      integralType = "triple";
      integralStyle = "italic";
      commandLength = 7;
    } else if (latex.substr(i, 6) === "\\iintd") {
      integralType = "double";
      integralStyle = "roman";
      commandLength = 6;
    } else if (latex.substr(i, 6) === "\\iinti") {
      integralType = "double";
      integralStyle = "italic";
      commandLength = 6;
    } else if (latex.substr(i, 6) === "\\ointd") {
      integralType = "contour";
      integralStyle = "roman";
      commandLength = 6;
    } else if (latex.substr(i, 6) === "\\ointi") {
      integralType = "contour";
      integralStyle = "italic";
      commandLength = 6;
    } else if (latex.substr(i, 5) === "\\intd") {
      integralType = "single";
      integralStyle = "roman";
      commandLength = 5;
    } else if (latex.substr(i, 5) === "\\inti") {
      integralType = "single";
      integralStyle = "italic";
      commandLength = 5;
    } else {
      return null;
    }

    i += commandLength;

    // Skip whitespace
    while (i < latex.length && latex[i] === " ") i++;

    let integrand: EquationElement[] = [];
    let differentialVariable: EquationElement[] = [];
    let lowerLimit: EquationElement[] = [];
    let upperLimit: EquationElement[] = [];

    if (isDefinite) {
      // Parse integrand {f(x)}
      if (i >= latex.length || latex[i] !== "{") return null;
      const integrandGroup = this.parseLatexGroup(latex, i);
      integrand = this.parseLatexToEquation(integrandGroup.content);
      i = integrandGroup.endIndex;

      // Skip whitespace
      while (i < latex.length && latex[i] === " ") i++;

      // Parse differential variable {x}
      if (i >= latex.length || latex[i] !== "{") return null;
      const variableGroup = this.parseLatexGroup(latex, i);
      differentialVariable = this.parseLatexToEquation(variableGroup.content);
      i = variableGroup.endIndex;

      // Skip whitespace
      while (i < latex.length && latex[i] === " ") i++;

      // Check if this is a 3-parameter command (subscript/lower limit only) or 4-parameter (lower+upper)
      const commandName = latex.substr(startIndex, commandLength);
      const is3Parameter = commandName.includes("sub") || commandName.includes("lower");

      if (is3Parameter) {
        // For 3-parameter integrals: \iintisub{integrand}{variable}{region} or \iintilower{integrand}{variable}{region}
        // Parse region/limit {R}
        if (i >= latex.length || latex[i] !== "{") return null;
        const regionGroup = this.parseLatexGroup(latex, i);
        lowerLimit = this.parseLatexToEquation(regionGroup.content);
        i = regionGroup.endIndex;
        // upperLimit remains empty for 3-parameter commands
      } else {
        // For 4-parameter integrals: \intinolim{integrand}{variable}{lower}{upper} or \intilim{integrand}{variable}{lower}{upper}
        // Parse lower limit {a}
        if (i >= latex.length || latex[i] !== "{") return null;
        const lowerGroup = this.parseLatexGroup(latex, i);
        lowerLimit = this.parseLatexToEquation(lowerGroup.content);
        i = lowerGroup.endIndex;

        // Skip whitespace
        while (i < latex.length && latex[i] === " ") i++;

        // Parse upper limit {b}
        if (i >= latex.length || latex[i] !== "{") return null;
        const upperGroup = this.parseLatexGroup(latex, i);
        upperLimit = this.parseLatexToEquation(upperGroup.content);
        i = upperGroup.endIndex;
      }
    } else {
      // For indefinite integrals: \inti{integrand}{variable}
      // Parse integrand {f(x)}
      if (i >= latex.length || latex[i] !== "{") return null;
      const integrandGroup = this.parseLatexGroup(latex, i);
      integrand = this.parseLatexToEquation(integrandGroup.content);
      i = integrandGroup.endIndex;

      // Skip whitespace
      while (i < latex.length && latex[i] === " ") i++;

      // Parse differential variable {x}
      if (i >= latex.length || latex[i] !== "{") return null;
      const variableGroup = this.parseLatexGroup(latex, i);
      differentialVariable = this.parseLatexToEquation(variableGroup.content);
      i = variableGroup.endIndex;
    }

    const element: EquationElement = {
      id: this.generateElementId(),
      type: "integral",
      integralType: integralType,
      integralStyle: integralStyle,
      isDefinite: isDefinite,
      limitMode: limitMode,
      integrand: integrand,
      differentialVariable: differentialVariable,
      displayMode: "inline", // Default to inline
    };

    if (isDefinite) {
      // For subscript commands (nolimits) and lower limit commands, only set lower limit
      const isLowerOnlyCommand = (latex.substr(startIndex).includes("isub") || 
                                 latex.substr(startIndex).includes("dsub") ||
                                 latex.substr(startIndex).includes("ilower") || 
                                 latex.substr(startIndex).includes("dlower"));
      
      if (isLowerOnlyCommand) {
        element.lowerLimit = lowerLimit;
        // Don't set upperLimit for lower-only integrals
      } else {
        element.lowerLimit = lowerLimit;
        element.upperLimit = upperLimit;
      }
    }

    return {
      element: element,
      endIndex: i,
    };
  }

  /**
   * Parse \dv command and return the parsed derivative element and end index
   * Handles all three forms: standard, displaystyle inline, and displaystyle braced
   */
  private parseDvCommand(
    latex: string,
    startIndex: number,
    displayMode: "inline" | "display",
    skipClosingBrace: boolean = false,
    isPartial: boolean = false
  ): { element: EquationElement; endIndex: number } | null {
    let i = startIndex;

    let order: number | EquationElement[] = 1;
    // Check for optional order parameter [n]
    if (i < latex.length && latex[i] === "[") {
      const orderStart = i + 1;
      let orderEnd = orderStart;
      let bracketCount = 1;

      while (orderEnd < latex.length && bracketCount > 0) {
        if (latex[orderEnd] === "[") bracketCount++;
        else if (latex[orderEnd] === "]") bracketCount--;
        orderEnd++;
      }

      const orderContent = latex.substring(orderStart, orderEnd - 1);
      // Try to parse as number, otherwise treat as nth order
      const parsedOrder = parseInt(orderContent);
      if (!isNaN(parsedOrder)) {
        order = parsedOrder;
      } else {
        // nth order derivative
        order = this.parseLatexToEquation(orderContent);
      }
      i = orderEnd;
    }

    // Parse first group - could be function or variable
    const firstGroup = this.parseLatexGroup(latex, i);
    i = firstGroup.endIndex;

    // Check if there's a second group or if this is long form with \grande
    let isLongForm = false;
    let functionContent = "";
    let variableContent = firstGroup.content;

    // Skip whitespace
    while (i < latex.length && latex[i] === " ") i++;

    // Check for long form patterns: \grande{f} or (\grande{f}) or [\grande{f}] etc., or just another group {x}
    if (i < latex.length && latex[i] !== "}") {
      if (latex[i] === "{") {
        // Standard form with two groups: \dv{f}{x}
        const secondGroup = this.parseLatexGroup(latex, i);
        functionContent = firstGroup.content;
        variableContent = secondGroup.content;
        i = secondGroup.endIndex;
        isLongForm = false;
      } else {
        // Check for any bracket type with \grande for long form
        let bracketMatch = null;
        for (const pair of BRACKET_PAIRS) {
          // Skip curly braces as they're handled separately above
          if (pair.left === "{" || pair.left === "\\{") continue;

          // Check if current position matches the left bracket
          if (latex.substr(i, pair.left.length) === pair.left) {
            bracketMatch = pair;
            break;
          }
        }

        if (bracketMatch) {
          // Long form with brackets: \dv{x}[bracket]\grande{f}[bracket]
          const bracketStart = i;
          i += bracketMatch.left.length; // Skip opening bracket

          // Skip whitespace
          while (i < latex.length && latex[i] === " ") i++;

          // Check for \grande
          if (latex.substr(i, 7) === "\\grande") {
            i += 7;
            const grandeGroup = this.parseLatexGroup(latex, i);
            functionContent = grandeGroup.content;
            i = grandeGroup.endIndex;

            // Skip whitespace and closing bracket
            while (i < latex.length && latex[i] === " ") i++;
            if (latex.substr(i, bracketMatch.right.length) === bracketMatch.right) {
              i += bracketMatch.right.length;
            }

            isLongForm = true;
          } else {
            // Not a recognized pattern, reset position
            i = bracketStart;
          }
        } else if (latex.substr(i, 7) === "\\grande") {
          // Long form without brackets: \dv{x} \grande{f}
          i += 7;
          const grandeGroup = this.parseLatexGroup(latex, i);
          functionContent = grandeGroup.content;
          i = grandeGroup.endIndex;
          isLongForm = true;
        }
      }
    }

    // Skip the closing brace if needed (for {\displaystyle \dv} case)
    if (skipClosingBrace && i < latex.length && latex[i] === "}") {
      i++;
    }

    if (functionContent || !isLongForm) {
      // Debug logging for partial derivatives
      if (isPartial) {
        console.log("parseDvCommand debug:", {
          firstGroupContent: firstGroup.content,
          functionContent,
          variableContent,
          isLongForm,
          displayMode,
          order,
          finalFunction: functionContent || variableContent,
          finalVariable: isLongForm ? variableContent : variableContent || ""
        });
      }
      
      const element: EquationElement = {
        id: this.generateElementId(),
        type: "derivative",
        order: order,
        function: this.parseLatexToEquation(functionContent || variableContent),
        variable: this.parseLatexToEquation(isLongForm ? variableContent : variableContent || ""),
        displayMode: displayMode,
        isLongForm: isLongForm,
        isPartial: isPartial,
      };

      return { element, endIndex: i };
    }

    return null;
  }

  private parseDerivativeFraction(
    numeratorLatex: string,
    denominatorLatex: string,
    displayMode: "inline" | "display"
  ): EquationElement | null {
    // Try to parse numerator and denominator to detect derivative pattern
    // Pattern: numerator = d^n f, denominator = d x^n or dx^n

    // Improved pattern matching with better handling of function expressions
    const numMatch = numeratorLatex.match(/^d(\^{(.+)})?(.*)$/);
    const denMatch = denominatorLatex.match(/^d\s*(.+?)(\^{(.+)})?$/);

    if (numMatch && denMatch) {
      const orderFromNum = numMatch[2]; // From d^{n}
      const orderFromDen = denMatch[3]; // From x^{n}
      let functionPart = numMatch[3] || "";
      const variablePart = denMatch[1] || "";

      // Clean up the function part - handle cases like "{ e }^{2x}"
      functionPart = functionPart.trim();

      // If we have something like "{ e }^{2x}", we need to clean up the unnecessary braces around 'e'
      // But preserve the script part "^{2x}"
      if (functionPart.match(/^{\s*\w+\s*}(.*)$/)) {
        // Extract the content from { content }rest -> content + rest
        const match = functionPart.match(/^{\s*(\w+)\s*}(.*)$/);
        if (match) {
          functionPart = match[1] + match[2]; // e.g., "{ e }^{2x}" -> "e^{2x}"
        }
      }

      // Determine order (prefer from numerator, fallback to denominator, default to 1)
      let order: number | EquationElement[] = 1;
      if (orderFromNum) {
        const parsedOrder = parseInt(orderFromNum);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromNum);
        }
      } else if (orderFromDen) {
        const parsedOrder = parseInt(orderFromDen);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromDen);
        }
      }

      return {
        id: this.generateElementId(),
        type: "derivative",
        order: order,
        displayMode: displayMode,
        function: this.parseLatexToEquation(functionPart),
        variable: this.parseLatexToEquation(variablePart.replace(/\^{.+}$/, "")), // Remove any trailing exponent
      };
    }

    return null; // Not a recognizable derivative pattern
  }

  private parseLongFormDerivative(
    numeratorLatex: string,
    denominatorLatex: string,
    functionLatex: string,
    displayMode: "inline" | "display"
  ): EquationElement | null {
    // Parse long form derivative: \derivlfrac{d^n}{dx^n}{f} or \derivldfrac{d^n}{dx^n}{f}
    // Pattern: numerator = d^n, denominator = dx^n, separate function part

    const numMatch = numeratorLatex.match(/^d(\^{(.+)})?$/);
    const denMatch = denominatorLatex.match(/^d(.+?)(\^{(.+)})?$/);

    if (numMatch && denMatch) {
      const orderFromNum = numMatch[2]; // From d^{n}
      const orderFromDen = denMatch[3]; // From x^{n}
      const variablePart = denMatch[1] || "";

      // Determine order (prefer from numerator, fallback to denominator, default to 1)
      let order: number | EquationElement[] = 1;
      if (orderFromNum) {
        const parsedOrder = parseInt(orderFromNum);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromNum);
        }
      } else if (orderFromDen) {
        const parsedOrder = parseInt(orderFromDen);
        if (!isNaN(parsedOrder)) {
          order = parsedOrder;
        } else {
          order = this.parseLatexToEquation(orderFromDen);
        }
      }

      return {
        id: this.generateElementId(),
        type: "derivative",
        order: order,
        displayMode: displayMode,
        function: this.parseLatexToEquation(functionLatex),
        variable: this.parseLatexToEquation(variablePart.replace(/\^{.+}$/, "")), // Remove any trailing exponent
        isLongForm: true,
      };
    }

    return null; // Not a recognizable long form derivative pattern
  }

  // Track end index for formatting commands
  private lastFormattingCommandEndIndex: number | null = null;
  // Track end index for derivative commands
  private lastDerivativeCommandEndIndex: number | null = null;
  // Track end index for style wrapper
  private lastStyleWrapperEndIndex: number | null = null;
  // Track end index for accent commands
  private lastAccentCommandEndIndex: number | null = null;

  // Helper method to parse derivative commands
  private tryParseDerivativeCommand(
    latex: string,
    index: number,
    result: EquationElement[]
  ): boolean {
    for (const cmd of this.DERIVATIVE_COMMANDS) {
      if (latex.substr(index, cmd.length) === cmd.command) {
        let i = index + cmd.length;
        const numerator = this.parseLatexGroup(latex, i);
        i = numerator.endIndex;
        const denominator = this.parseLatexGroup(latex, i);
        i = denominator.endIndex;

        if (cmd.isLongForm) {
          // Long form has an additional function parameter
          const functionPart = this.parseLatexGroup(latex, i);
          i = functionPart.endIndex;

          const derivativeInfo = this.parseLongFormDerivative(
            numerator.content,
            denominator.content,
            functionPart.content,
            cmd.displayMode
          );
          if (derivativeInfo) {
            result.push(derivativeInfo);
          } else {
            // Fallback to regular fraction if parsing fails
            result.push({
              id: this.generateElementId(),
              type: "fraction",
              displayMode: cmd.displayMode,
              numerator: this.parseLatexToEquation(numerator.content),
              denominator: this.parseLatexToEquation(denominator.content),
            });
          }
        } else {
          // Standard form
          const derivativeInfo = this.parseDerivativeFraction(
            numerator.content,
            denominator.content,
            cmd.displayMode
          );
          if (derivativeInfo) {
            result.push(derivativeInfo);
          } else {
            // Fallback to regular fraction if parsing fails
            result.push({
              id: this.generateElementId(),
              type: "fraction",
              displayMode: cmd.displayMode,
              numerator: this.parseLatexToEquation(numerator.content),
              denominator: this.parseLatexToEquation(denominator.content),
            });
          }
        }

        this.lastDerivativeCommandEndIndex = i;
        return true;
      }
    }
    return false;
  }

  // Helper method to parse style wrapper commands ({\displaystyle ...} and {\textstyle ...})
  private tryParseStyleWrapper(latex: string, index: number, result: EquationElement[]): boolean {
    const styles = [
      { pattern: "{\\displaystyle ", length: 14, mode: "display" as const },
      { pattern: "{\\displaystyle", length: 13, mode: "display" as const },
      { pattern: "{\\textstyle ", length: 12, mode: "inline" as const },
      { pattern: "{\\textstyle", length: 11, mode: "inline" as const },
    ];

    for (const style of styles) {
      if (latex.substr(index, style.length) === style.pattern) {
        console.log("tryParseStyleWrapper found style:", style.mode, "at index:", index, "latex:", latex.substr(index, 30));
        const startIndex = index;
        let i = index + style.length;

        // Find the matching closing brace
        let braceCount = 1;
        let endPos = i;
        while (endPos < latex.length && braceCount > 0) {
          if (latex[endPos] === "{") braceCount++;
          else if (latex[endPos] === "}") braceCount--;
          endPos++;
        }

        // Skip whitespace
        i = this.skipWhitespace(latex, i);

        // Try to parse known commands with the appropriate style
        let parsed = false;

        // Check for \dv command (only for displaystyle)
        if (style.mode === "display" && latex.substr(i, 3) === "\\dv") {
          console.log("tryParseStyleWrapper found \\dv command");
          i += 3;
          const dvResult = this.parseDvCommand(latex, i, "display", true, false);
          if (dvResult) {
            result.push(dvResult.element);
            i = dvResult.endIndex;
            parsed = true;
          }
        }
        // Check for \pdv command (both display and inline)
        else if (latex.substr(i, 4) === "\\pdv") {
          console.log("tryParseStyleWrapper found \\pdv command, mode:", style.mode);
          i += 4;
          const dvResult = this.parseDvCommand(latex, i, style.mode, true, true);
          if (dvResult) {
            result.push(dvResult.element);
            i = dvResult.endIndex;
            parsed = true;
          }
        }
        // Check for integral commands
        else if (this.isCustomIntegralCommand(latex, i)) {
          const integralResult = this.parseCustomIntegral(latex, i);
          if (integralResult) {
            integralResult.element.displayMode = style.mode;
            result.push(integralResult.element);
            i = integralResult.endIndex;
            parsed = true;
          }
        }
        // Check for large operators
        else if (this.isLargeOperator(latex, i)) {
          const operatorInfo = this.parseLargeOperator(latex, i, style.mode === "display");
          if (operatorInfo) {
            result.push(operatorInfo.element);
            i = operatorInfo.endIndex;
            parsed = true;
          }
        }
        // Check for fraction (only for textstyle)
        else if (style.mode === "inline" && latex.substr(i, 5) === "\\frac") {
          const fractionInfo = this.parseFraction(latex, i, true);
          if (fractionInfo) {
            result.push(fractionInfo.element);
            i = fractionInfo.endIndex;
            parsed = true;
          }
        }

        if (parsed) {
          // Skip the closing brace if present
          if (i < latex.length && latex[i] === "}") i++;
          this.lastStyleWrapperEndIndex = i;
          return true;
        } else {
          // Fallback: parse the entire content normally
          console.log("tryParseStyleWrapper fallback for style:", style.mode);
          const group = this.parseLatexGroup(latex, startIndex);
          const content = group.content;
          console.log("Fallback parsing content:", content);

          // Remove the style prefix if present
          const prefix = style.pattern.substring(1); // Remove leading {
          let parsedElements: EquationElement[] = [];
          if (content.startsWith(prefix)) {
            const cleanContent = content.substring(prefix.length);
            parsedElements = this.parseLatexToEquation(cleanContent);
          } else {
            parsedElements = this.parseLatexToEquation(content);
          }

          // Apply the display mode to derivative and integral elements
          for (const element of parsedElements) {
            if (element.type === "derivative" || element.type === "integral") {
              element.displayMode = style.mode;
              console.log("Applied display mode", style.mode, "to", element.type, "element");
            }
          }

          result.push(...parsedElements);
          this.lastStyleWrapperEndIndex = group.endIndex;
          return true;
        }
      }
    }
    return false;
  }

  // Helper method to parse formatting commands
  private tryParseFormattingCommand(
    latex: string,
    index: number,
    result: EquationElement[]
  ): boolean {
    for (const cmd of this.FORMATTING_COMMANDS) {
      if (latex.substr(index, cmd.length) === cmd.command) {
        let i = index + cmd.length;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const formattedElements = this.parseLatexToEquation(group.content);
        formattedElements.forEach((element) => {
          if (element.type === "text") {
            cmd.applyFormatting(element);
          }
        });
        result.push(...formattedElements);
        this.lastFormattingCommandEndIndex = i;
        return true;
      }
    }
    return false;
  }

  private tryParseAccentCommand(latex: string, index: number, result: EquationElement[]): boolean {
    const accentCommands: {
      command: string;
      length: number;
      type: string;
      position: "over" | "under";
    }[] = [
      { command: "\\hat", length: 4, type: "hat", position: "over" },
      { command: "\\tilde", length: 6, type: "tilde", position: "over" },
      { command: "\\bar", length: 4, type: "bar", position: "over" },
      { command: "\\dot", length: 4, type: "dot", position: "over" },
      { command: "\\ddot", length: 5, type: "ddot", position: "over" },
      { command: "\\vec", length: 4, type: "vec", position: "over" },
      { command: "\\widehat", length: 8, type: "widehat", position: "over" },
      { command: "\\widetilde", length: 10, type: "widetilde", position: "over" },
      { command: "\\overline", length: 9, type: "widebar", position: "over" },
      { command: "\\overrightarrow", length: 15, type: "overrightarrow", position: "over" },
      { command: "\\overleftarrow", length: 14, type: "overleftarrow", position: "over" },
      { command: "\\overleftrightarrow", length: 19, type: "overleftrightarrow", position: "over" },
      { command: "\\overbrace", length: 10, type: "overbrace", position: "over" },
      { command: "\\underbrace", length: 11, type: "underbrace", position: "under" },
      { command: "\\overparen", length: 10, type: "overparen", position: "over" },
      { command: "\\underparen", length: 11, type: "underparen", position: "under" },
    ];

    for (const accentCmd of accentCommands) {
      if (latex.substr(index, accentCmd.length) === accentCmd.command) {
        let i = index + accentCmd.length;
        const group = this.parseLatexGroup(latex, i);
        i = group.endIndex;
        const baseContent = this.parseLatexToEquation(group.content);

        let accentLabel: EquationElement[] = [];
        let finalAccentType = accentCmd.type;

        if (accentCmd.type === "overbrace" && i < latex.length && latex[i] === "^") {
          // Check for ^{label} after overbrace
          if (i + 1 < latex.length && latex[i + 1] === "{") {
            const labelGroup = this.parseLatexGroup(latex, i + 1);
            i = labelGroup.endIndex;
            accentLabel = this.parseLatexToEquation(labelGroup.content);
            finalAccentType = "labeledoverbrace";
          }
        } else if (accentCmd.type === "underbrace" && i < latex.length && latex[i] === "_") {
          // Check for _{label} after underbrace
          if (i + 1 < latex.length && latex[i + 1] === "{") {
            const labelGroup = this.parseLatexGroup(latex, i + 1);
            i = labelGroup.endIndex;
            accentLabel = this.parseLatexToEquation(labelGroup.content);
            finalAccentType = "labeledunderbrace";
          }
        }

        const accentElement: EquationElement = {
          id: this.generateElementId(),
          type: "accent",
          accentType: finalAccentType as any,
          accentPosition: accentCmd.position,
          accentBase: baseContent,
          accentLabel:
            accentLabel.length > 0
              ? accentLabel
              : finalAccentType.includes("labeled")
                ? []
                : undefined,
        };

        result.push(accentElement);
        this.lastAccentCommandEndIndex = i;
        return true;
      }
    }
    return false;
  }

  // Helper to check and extract content from style wrappers
  private extractFromStyleWrapper(
    latex: string,
    index: number
  ): {
    content: string;
    endIndex: number;
    hasWrapper: boolean;
    styleType?: "display" | "inline";
  } | null {
    // Case 1: Check for {\displaystyle ...} or {\textstyle ...} (with braces)
    if (
      latex.substr(index, 14) === "{\\displaystyle" ||
      latex.substr(index, 11) === "{\\textstyle"
    ) {
      const isDisplayStyle = latex.substr(index, 14) === "{\\displaystyle";
      const styleLength = isDisplayStyle ? 14 : 11;

      // Find the matching closing brace
      let braceCount = 1;
      let contentStart = index + styleLength;

      // Skip whitespace after style command
      while (contentStart < latex.length && latex[contentStart] === " ") {
        contentStart++;
      }

      // Find the end of the wrapper
      let contentEnd = contentStart;
      for (let k = index + 1; k < latex.length; k++) {
        if (latex[k] === "{") {
          braceCount++;
        } else if (latex[k] === "}") {
          braceCount--;
          if (braceCount === 0) {
            contentEnd = k;
            break;
          }
        }
      }

      const extractedContent = latex.substring(contentStart, contentEnd);
      return {
        content: extractedContent,
        endIndex: contentEnd + 1,
        hasWrapper: true,
        styleType: isDisplayStyle ? "display" : "inline",
      };
    }

    // Case 2: Check for \displaystyle or \textstyle at the beginning (without outer braces)
    const trimmed = latex.trim();
    if (trimmed.startsWith("\\displaystyle ")) {
      const content = trimmed.substring("\\displaystyle ".length);
      return {
        content: content,
        endIndex: index + latex.length,
        hasWrapper: true,
        styleType: "display",
      };
    }

    if (trimmed.startsWith("\\textstyle ")) {
      const content = trimmed.substring("\\textstyle ".length);
      return {
        content: content,
        endIndex: index + latex.length,
        hasWrapper: true,
        styleType: "inline",
      };
    }

    return null;
  }

  // Helper to apply display/inline mode to elements that support it
  private applyStyleModeToElements(
    elements: EquationElement[],
    styleType: "display" | "inline"
  ): void {
    elements.forEach((element) => {
      if (element.type === "integral" || element.type === "large-operator" || element.type === "derivative" || element.type === "fraction") {
        element.displayMode = styleType;
      }
      // Recursively apply to nested elements
      this.applyStyleModeToElementsRecursively(element, styleType);
    });
  }

  // Recursively apply style mode to nested elements
  private applyStyleModeToElementsRecursively(
    element: EquationElement,
    styleType: "display" | "inline"
  ): void {
    // Apply to arrays of elements that exist in EquationElement interface
    if (element.content) this.applyStyleModeToElements(element.content, styleType);
    if (element.numerator) this.applyStyleModeToElements(element.numerator, styleType);
    if (element.denominator) this.applyStyleModeToElements(element.denominator, styleType);
    if (element.operand) this.applyStyleModeToElements(element.operand, styleType);
    if (element.lowerLimit) this.applyStyleModeToElements(element.lowerLimit, styleType);
    if (element.upperLimit) this.applyStyleModeToElements(element.upperLimit, styleType);
    if (element.integrand) this.applyStyleModeToElements(element.integrand, styleType);
    if (element.differentialVariable) this.applyStyleModeToElements(element.differentialVariable, styleType);
    if (element.function) this.applyStyleModeToElements(element.function, styleType);
    if (element.variable) this.applyStyleModeToElements(element.variable, styleType);
    if (element.base) this.applyStyleModeToElements(element.base, styleType);
    if (element.subscript) this.applyStyleModeToElements(element.subscript, styleType);
    if (element.superscript) this.applyStyleModeToElements(element.superscript, styleType);
    if (element.radicand) this.applyStyleModeToElements(element.radicand, styleType);
    if (element.index) this.applyStyleModeToElements(element.index, styleType);
    if (element.functionArgument) this.applyStyleModeToElements(element.functionArgument, styleType);
    if (element.functionBase) this.applyStyleModeToElements(element.functionBase, styleType);
    if (element.functionConstraint) this.applyStyleModeToElements(element.functionConstraint, styleType);
    if (element.functionName) this.applyStyleModeToElements(element.functionName, styleType);
    if (element.accentBase) this.applyStyleModeToElements(element.accentBase, styleType);
    if (element.accentLabel) this.applyStyleModeToElements(element.accentLabel, styleType);
    // Handle matrix cells
    if (element.cells) {
      Object.values(element.cells).forEach(cellContent => {
        this.applyStyleModeToElements(cellContent, styleType);
      });
    }
  }


  private isBuiltinFunctionCommand(latex: string, index: number): boolean {
    for (const cmd of BUILTIN_FUNCTION_COMMANDS) {
      if (latex.substr(index, cmd.length) === cmd) {
        // Make sure next character is not a letter (to avoid \sinh matching \sin)
        const nextChar = latex[index + cmd.length];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          return true;
        }
      }
    }
    return false;
  }

  private parseBuiltinFunctionCommand(
    latex: string,
    startIndex: number
  ): { element: EquationElement; endIndex: number } | null {
    let i = startIndex;
    
    // Find which command this is
    let functionType = "";
    for (const cmd of BUILTIN_FUNCTION_COMMANDS) {
      if (latex.substr(i, cmd.length) === cmd) {
        const nextChar = latex[i + cmd.length];
        if (!nextChar || !/[a-zA-Z]/.test(nextChar)) {
          functionType = cmd.substring(1); // Remove the backslash
          i += cmd.length;
          break;
        }
      }
    }
    
    if (!functionType) return null;
    
    // Skip whitespace
    while (i < latex.length && latex[i] === " ") i++;
    
    // Check for subscript (for log_{base} or limit functions)
    let hasSubscript = false;
    let subscriptElements: EquationElement[] = [];
    
    if (i < latex.length && latex[i] === "_") {
      i++; // Skip "_"
      const subscriptGroup = this.parseLatexGroup(latex, i);
      if (subscriptGroup) {
        i = subscriptGroup.endIndex;
        subscriptElements = this.parseLatexToEquation(subscriptGroup.content);
        hasSubscript = true;
      }
    }
    
    // Skip more whitespace after subscript
    while (i < latex.length && latex[i] === " ") i++;
    
    // Parse argument - everything after the function until we hit certain delimiters
    let argumentElements: EquationElement[] = [];
    
    if (i < latex.length) {
      // For functions, parse the next token/group as the argument
      let argEnd = i;
      
      if (latex[i] === "{") {
        // Argument is in braces
        const argGroup = this.parseLatexGroup(latex, i);
        if (argGroup) {
          argumentElements = this.parseLatexToEquation(argGroup.content);
          argEnd = argGroup.endIndex;
        }
      } else {
        // Parse next token (single character, command, or until space/operator)
        if (latex[i] === "\\") {
          // Next token is a command
          argEnd = i + 1;
          while (argEnd < latex.length && /[a-zA-Z]/.test(latex[argEnd])) {
            argEnd++;
          }
        } else {
          // Single character or number
          argEnd = i + 1;
        }
        
        if (argEnd > i) {
          argumentElements = this.parseLatexToEquation(latex.substring(i, argEnd));
        }
      }
      
      i = argEnd;
    }
    
    // Create the appropriate function element
    let element: EquationElement;
    
    if (hasSubscript && functionType === "log") {
      // log with base becomes logn
      element = {
        id: this.generateElementId(),
        type: "function",
        functionType: "logn",
        functionArgument: argumentElements,
        functionBase: subscriptElements
      };
    } else if (hasSubscript && ["max", "min", "lim"].includes(functionType)) {
      // limit functions
      element = {
        id: this.generateElementId(),
        type: "function",
        functionType: functionType,
        functionArgument: argumentElements,
        functionConstraint: subscriptElements
      };
    } else {
      // simple functions
      element = {
        id: this.generateElementId(),
        type: "function",
        functionType: functionType,
        functionArgument: argumentElements
      };
    }
    
    return {
      element: element,
      endIndex: i
    };
  }

  private parseOperatorName(
    latex: string,
    startIndex: number
  ): { element: EquationElement; endIndex: number } | null {
    let i = startIndex;

    // Check for \operatorname or \operatorname*
    const isLimitOperator = latex.substr(i, 14) === "\\operatorname*";
    const commandLength = isLimitOperator ? 14 : 13;

    if (
      latex.substr(i, commandLength) !== (isLimitOperator ? "\\operatorname*" : "\\operatorname")
    ) {
      return null;
    }

    i += commandLength;

    // Parse the operator name
    const nameGroup = this.parseLatexGroup(latex, i);
    if (!nameGroup) return null;
    i = nameGroup.endIndex;

    const nameElements = this.parseLatexToEquation(nameGroup.content);
    
    // Set italic: false for all name elements since \operatorname creates upright text
    nameElements.forEach(element => {
      if (element.type === "text") {
        element.italic = false;
      }
    });

    // Check for subscript (constraint for limit operator, subscript for regular function)
    let subscriptElements: EquationElement[] | undefined;
    let hasSubscript = false;
    if (i < latex.length && latex[i] === "_") {
      i++; // Skip "_"
      const subscriptGroup = this.parseLatexGroup(latex, i);
      if (subscriptGroup) {
        i = subscriptGroup.endIndex;
        subscriptElements = this.parseLatexToEquation(subscriptGroup.content);
        hasSubscript = true;
      }
    }

    // Check for argument - either in parentheses for regular functions or space-separated for limit operators
    let argumentElements: EquationElement[] = [];

    if (isLimitOperator && hasSubscript) {
      // For \operatorname*{name}_{constraint} argument, the argument follows after a space
      while (i < latex.length && latex[i] === " ") i++; // Skip spaces

      // Parse the rest as the argument (could be a group or expression)
      if (i < latex.length && latex[i] === "{") {
        const argGroup = this.parseLatexGroup(latex, i);
        if (argGroup) {
          i = argGroup.endIndex;
          argumentElements = this.parseLatexToEquation(argGroup.content);
        }
      } else {
        // Parse until next space or command for limit operators
        let argStart = i;
        while (
          i < latex.length &&
          latex[i] !== " " &&
          latex[i] !== "\\" &&
          latex[i] !== "{" &&
          latex[i] !== "}"
        ) {
          i++;
        }
        if (i > argStart) {
          argumentElements = this.parseLatexToEquation(latex.substring(argStart, i));
        }
      }

      // Create user-defined limit function
      const element: EquationElement = {
        id: this.generateElementId(),
        type: "function",
        functionType: "functionlim",
        functionName: nameElements,
        functionConstraint: subscriptElements,
        functionArgument: argumentElements,
      };

      return { element, endIndex: i };
    } else {
      // Regular function - parse argument after space (no parentheses)
      while (i < latex.length && latex[i] === " ") i++; // Skip spaces

      // Parse the argument (could be a group or expression)
      if (i < latex.length && latex[i] === "{") {
        const argGroup = this.parseLatexGroup(latex, i);
        if (argGroup) {
          i = argGroup.endIndex;
          argumentElements = this.parseLatexToEquation(argGroup.content);
        }
      } else {
        // Parse until next space, command, or delimiter
        let argStart = i;
        while (
          i < latex.length &&
          latex[i] !== " " &&
          latex[i] !== "\\" &&
          latex[i] !== "{" &&
          latex[i] !== "}" &&
          latex[i] !== "$"
        ) {
          i++;
        }
        if (i > argStart) {
          argumentElements = this.parseLatexToEquation(latex.substring(argStart, i));
        }
      }

      // Create appropriate user-defined function
      const functionType = hasSubscript ? "functionsub" : "function";
      const element: EquationElement = {
        id: this.generateElementId(),
        type: "function",
        functionType: functionType,
        functionName: nameElements,
        functionArgument: argumentElements,
        functionBase: hasSubscript ? subscriptElements : undefined,
        functionConstraint: undefined,
      };

      return { element, endIndex: i };
    }
  }


  private parseMatrixStackCasesEnvironment(
    latex: string,
    startIndex: number
  ): { element: EquationElement; endIndex: number } | null {
    // Check for matrix, stack, and cases environment patterns
    const environmentTypes: Array<{
      pattern: string;
      end: string;
      type: "matrix" | "stack" | "cases";
      subtype: string;
    }> = [
      // Matrix environments
      {
        pattern: "\\begin{pmatrix}",
        end: "\\end{pmatrix}",
        type: "matrix",
        subtype: "parentheses",
      },
      { pattern: "\\begin{bmatrix}", end: "\\end{bmatrix}", type: "matrix", subtype: "brackets" },
      { pattern: "\\begin{Bmatrix}", end: "\\end{Bmatrix}", type: "matrix", subtype: "braces" },
      { pattern: "\\begin{vmatrix}", end: "\\end{vmatrix}", type: "matrix", subtype: "bars" },
      {
        pattern: "\\begin{Vmatrix}",
        end: "\\end{Vmatrix}",
        type: "matrix",
        subtype: "double-bars",
      },
      { pattern: "\\begin{matrix}", end: "\\end{matrix}", type: "matrix", subtype: "none" },
      // Stack environments (array)
      { pattern: "\\begin{array}", end: "\\end{array}", type: "stack", subtype: "plain" },
      // Cases environments
      { pattern: "\\begin{cases}", end: "\\end{cases}", type: "cases", subtype: "cases" },
    ];

    let environmentType: "matrix" | "stack" | "cases" | null = null;
    let environmentSubtype: string | null = null;
    let endPattern: string | null = null;
    let currentIndex = startIndex;

    // Find which environment type this is
    for (const type of environmentTypes) {
      if (latex.substr(startIndex, type.pattern.length) === type.pattern) {
        environmentType = type.type;
        environmentSubtype = type.subtype;
        endPattern = type.end;
        currentIndex = startIndex + type.pattern.length;
        break;
      }
    }

    if (!environmentType || !endPattern) {
      return null; // Not a supported environment
    }

    // Handle array environment column specification
    if (environmentType === "stack" && latex.substr(currentIndex, 1) === "{") {
      // Skip array column specification like {ccc}
      const colSpecEnd = latex.indexOf("}", currentIndex);
      if (colSpecEnd !== -1) {
        currentIndex = colSpecEnd + 1;
      }
    }

    // Find the end of the environment
    const endIndex = latex.indexOf(endPattern, currentIndex);
    if (endIndex === -1) {
      return null; // Malformed environment - no closing tag
    }

    // Extract content between \begin{} and \end{}
    const environmentContent = latex.substring(currentIndex, endIndex).trim();

    // Parse content into rows and cells
    const rows = environmentContent
      .split("\\\\")
      .map((row) => row.trim())
      .filter((row) => row.length > 0);
    const cellData: { [key: string]: EquationElement[] } = {};

    rows.forEach((row, rowIndex) => {
      const cells = row.split("&").map((cell) => cell.trim());
      cells.forEach((cell, colIndex) => {
        const cellKey = `cell_${rowIndex}_${colIndex}`;
        cellData[cellKey] = this.parseLatexToEquation(cell);
      });
    });

    // Determine dimensions
    const numRows = rows.length;
    const numCols = rows.length > 0 ? rows[0].split("&").length : 1;

    // Create appropriate element based on environment type
    let resultElement: EquationElement;

    if (environmentType === "matrix") {
      resultElement = {
        id: this.generateElementId(),
        type: "matrix",
        matrixType: environmentSubtype as
          | "parentheses"
          | "brackets"
          | "braces"
          | "bars"
          | "double-bars"
          | "none",
        rows: numRows,
        cols: numCols,
        cells: cellData,
      };
    } else if (environmentType === "stack") {
      resultElement = {
        id: this.generateElementId(),
        type: "stack",
        stackType: "plain",
        rows: numRows,
        cols: numCols,
        cells: cellData,
      };
    } else {
      // environmentType === "cases"
      resultElement = {
        id: this.generateElementId(),
        type: "cases",
        casesType: "cases",
        rows: numRows,
        cols: numCols,
        cells: cellData,
      };
    }

    return {
      element: resultElement,
      endIndex: endIndex + endPattern.length,
    };
  }
}
