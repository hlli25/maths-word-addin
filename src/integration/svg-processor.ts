import { SvgPositionInfo } from './mathjax-service';

export interface ProcessedSvgResult {
  svgString: string;
  width: number;
  height: number;
  baselineOffsetPt: number;
}

export class SvgProcessor {
  prepareSvgForOffice(
    svg: SVGElement,
    targetPtSize: number,
    positionInfo?: SvgPositionInfo
  ): ProcessedSvgResult {
    const svgClone = svg.cloneNode(true) as SVGElement;

    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Extract baseline information from MathJax before removing style
    const originalStyle = svgClone.getAttribute("style") || "";
    let baselineOffset = 0;

    const verticalAlignMatch = originalStyle.match(/vertical-align:\s*([-\d.]+)ex/);
    if (verticalAlignMatch) {
      baselineOffset = parseFloat(verticalAlignMatch[1]);
    }

    this.cleanSvgAttributes(svgClone);

    const viewBox = svgClone.getAttribute("viewBox");
    if (!viewBox) {
      throw new Error("SVG missing viewBox attribute.");
    }

    const [minX, minY, vbWidth, vbHeight] = viewBox.split(" ").map(parseFloat);
    
    // Scale the SVG so that 1em in MathJax's internal units maps to the target font size in pixels
    const targetPxSize = targetPtSize * (96 / 72);
    const internalUnitsPerEm = 1000;
    const scale = targetPxSize / internalUnitsPerEm;

    const width = Math.round(vbWidth * scale);
    const height = Math.round(vbHeight * scale);

    // Calculate baseline adjustment for proper text alignment
    let baselineOffsetPt = 0;
    
    if (positionInfo) {
      const baselineOffsetPx = positionInfo.baseline * 0.5 * targetPtSize * (96 / 72);
      
      if (positionInfo.mainFractionBar) {    
        baselineOffsetPt = baselineOffsetPx * (72 / 96);
        
        const svgCenterY = minY + vbHeight / 2;
        const mainBarY = positionInfo.mainFractionBar.y;
        const fractionBarOffsetFromCenter = mainBarY + (positionInfo.mainFractionBar.height / 2) - svgCenterY;
      } else {
        baselineOffsetPt = baselineOffsetPx * (72 / 96);
      }
    }

    svgClone.setAttribute("width", String(width));
    svgClone.setAttribute("height", String(height));

    this.fixThinRectangles(svgClone, vbHeight);
    this.fixColors(svgClone);
    this.addWhiteBackground(svgClone, minX, minY, vbWidth, vbHeight);
    this.convertUseElementsToPaths(svgClone);

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const finalSvgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${svgString}`;

    return { svgString: finalSvgString, width, height, baselineOffsetPt };
  }

  private cleanSvgAttributes(svgClone: SVGElement): void {
    svgClone.removeAttribute("focusable");
    svgClone.removeAttribute("aria-hidden");
    svgClone.removeAttribute("role");
    svgClone.removeAttribute("style");
  }

  private fixThinRectangles(svgClone: SVGElement, vbHeight: number): void {
    const rects = svgClone.querySelectorAll("rect");
    rects.forEach((rect) => {
      const rectHeight = parseFloat(rect.getAttribute("height") || "0");
      const rectY = parseFloat(rect.getAttribute("y") || "0");

      if (rectHeight < vbHeight * 0.01 && rectHeight > 0) {
        const minVisibleHeight = vbHeight * 0.012;
        const newHeight = Math.max(rectHeight, minVisibleHeight);

        const heightDiff = newHeight - rectHeight;
        const newY = rectY - heightDiff / 2;

        rect.setAttribute("height", String(newHeight));
        rect.setAttribute("y", String(newY));
      }
    });
  }

  private fixColors(svgClone: SVGElement): void {
    // First, check if there are any actual color values in the SVG
    const allElements = svgClone.querySelectorAll("*");
    const hasActualColors = Array.from(allElements).some(element => {
      const fill = element.getAttribute("fill");
      const stroke = element.getAttribute("stroke");
      return (fill && fill !== "black" && fill !== "white" && fill !== "currentColor") ||
             (stroke && stroke !== "black" && stroke !== "white" && stroke !== "currentColor");
    });
    
    
    allElements.forEach((element) => {
      const fill = element.getAttribute("fill");
      const stroke = element.getAttribute("stroke");
      
      // If there are actual colors in the SVG, be more careful with currentColor
      if (hasActualColors) {
        // Only fix currentColor if the element doesn't have a parent with actual colors
        if (fill === "currentColor") {
          // Check if this element or its parent has an actual color
          const parentWithColor = this.findParentWithColor(element);
          if (!parentWithColor) {
            element.setAttribute("fill", "black");
          } else {
            // Remove currentColor to inherit from parent
            element.removeAttribute("fill");
          }
        }
        if (stroke === "currentColor") {
          const parentWithColor = this.findParentWithColor(element);
          if (!parentWithColor) {
            element.setAttribute("stroke", "black");
          } else {
            // Remove currentColor to inherit from parent
            element.removeAttribute("stroke");
          }
        }
        
        // If child elements have no color attributes under a colored parent, 
        // explicitly set the parent's color
        const parentWithColor = this.findParentWithColor(element);
        if (hasActualColors && parentWithColor) {
          const currentFill = element.getAttribute("fill");
          const currentStroke = element.getAttribute("stroke");
          
          // If element has null/empty color attributes, set explicit colors from parent
          if (currentFill === "" || currentFill === "null" || currentFill === null) {
            const parentFill = parentWithColor.getAttribute("fill");
            if (parentFill && parentFill !== "black" && parentFill !== "white" && parentFill !== "currentColor") {
              element.setAttribute("fill", parentFill);
            }
          }
          if (currentStroke === "" || currentStroke === "null" || currentStroke === null) {
            const parentStroke = parentWithColor.getAttribute("stroke");
            if (parentStroke && parentStroke !== "black" && parentStroke !== "white" && parentStroke !== "currentColor") {
              element.setAttribute("stroke", parentStroke);
            }
          }
        }
      } else {
        // No actual colors, safe to convert all currentColor to black
        if (fill === "currentColor") {
          element.setAttribute("fill", "black");
        }
        if (stroke === "currentColor") {
          element.setAttribute("stroke", "black");
        }
      }
      
    });
  }

  private findParentWithColor(element: Element): Element | null {
    let parent = element.parentElement;
    while (parent) {
      const fill = parent.getAttribute("fill");
      const stroke = parent.getAttribute("stroke");
      if ((fill && fill !== "black" && fill !== "white" && fill !== "currentColor") ||
          (stroke && stroke !== "black" && stroke !== "white" && stroke !== "currentColor")) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }

  private addWhiteBackground(svgClone: SVGElement, minX: number, minY: number, vbWidth: number, vbHeight: number): void {
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", String(minX));
    bgRect.setAttribute("y", String(minY));
    bgRect.setAttribute("width", String(vbWidth));
    bgRect.setAttribute("height", String(vbHeight));
    bgRect.setAttribute("fill", "white");
    
    
    // Insert background as first child (behind other elements)
    svgClone.insertBefore(bgRect, svgClone.firstChild);
  }

  private convertUseElementsToPaths(svgClone: SVGElement): void {
    const defs = svgClone.querySelector("defs");
    const useElements = svgClone.querySelectorAll("use");
    useElements.forEach((useElement) => {
      const href = useElement.getAttribute("href") || useElement.getAttribute("xlink:href");
      if (href && defs) {
        const referencedId = href.replace("#", "");
        const referencedElement = defs.querySelector(`#${referencedId}`);

        if (referencedElement && referencedElement.tagName === "path") {
          const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          newPath.setAttribute("d", referencedElement.getAttribute("d") || "");
          if (useElement.hasAttribute("transform")) {
            newPath.setAttribute("transform", useElement.getAttribute("transform")!);
          }
          
          // Preserve colors from the use element or referenced element
          const fillColor = useElement.getAttribute("fill") || referencedElement.getAttribute("fill") || "black";
          const strokeColor = useElement.getAttribute("stroke") || referencedElement.getAttribute("stroke");
          
          newPath.setAttribute("fill", fillColor);
          if (strokeColor) {
            newPath.setAttribute("stroke", strokeColor);
          }
          
          useElement.parentNode?.replaceChild(newPath, useElement);
        }
      }
    });
  }
}