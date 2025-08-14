declare const MathJax: any;

export interface SvgPositionInfo {
  baseline: number;
  fractionBars: Array<{ y: number; width: number; height: number; x: number; isMain: boolean }>;
  mainFractionBar: { y: number; width: number; height: number; x: number } | null;
  totalHeight: number;
  totalWidth: number;
}

export class MathJaxService {
  async renderLatexToSvg(latex: string): Promise<SVGElement> {
    try {
      const tempDiv = document.getElementById("mathjax-renderer") as HTMLDivElement;
      if (!tempDiv) {
        throw new Error("MathJax renderer element not found.");
      }

      // Detect if LaTeX contains \displaystyle operators
      // If so, use display mode; otherwise, use inline mode
      const hasDisplayStyle = latex.includes("\\displaystyle");
      const mathMode = hasDisplayStyle ? `\\[${latex}\\]` : `\\(${latex}\\)`;

      tempDiv.innerHTML = mathMode;

      MathJax.texReset();
      await MathJax.typesetPromise([tempDiv]);

      const mjxContainer = tempDiv.querySelector("mjx-container");
      const svg = mjxContainer?.querySelector("svg");

      if (!svg) {
        throw new Error("Failed to find SVG in MathJax output.");
      }

      const svgClone = svg.cloneNode(true) as SVGElement;
      tempDiv.innerHTML = "";

      return svgClone;
    } catch (error) {
      throw new Error("Failed to convert equation to image. Please check the syntax.");
    }
  }

  extractSvgPositionInfo(svg: SVGElement): SvgPositionInfo {
    const viewBox = svg.getAttribute("viewBox");
    if (!viewBox) {
      throw new Error("SVG missing viewBox attribute.");
    }

    const [minX, minY, vbWidth, vbHeight] = viewBox.split(" ").map(parseFloat);

    // Extract baseline from MathJax style
    const originalStyle = svg.getAttribute("style") || "";
    let baseline = 0;
    const verticalAlignMatch = originalStyle.match(/vertical-align:\s*([-\d.]+)ex/);
    if (verticalAlignMatch) {
      baseline = parseFloat(verticalAlignMatch[1]);
    }

    // Find all fraction bars (thin horizontal rectangles)
    const fractionBars: Array<{ y: number; width: number; height: number; x: number; isMain: boolean }> = [];
    const rects = svg.querySelectorAll("rect");

    rects.forEach((rect) => {
      const rectHeight = parseFloat(rect.getAttribute("height") || "0");
      const rectWidth = parseFloat(rect.getAttribute("width") || "0");
      const rectY = parseFloat(rect.getAttribute("y") || "0");
      const rectX = parseFloat(rect.getAttribute("x") || "0");

      // Identify fraction bars as thin horizontal rectangles
      if (rectHeight < vbHeight * 0.05 && rectWidth > vbWidth * 0.1) {
        fractionBars.push({
          y: rectY,
          width: rectWidth,
          height: rectHeight,
          x: rectX,
          isMain: false,
        });
      }
    });

    // Identify the main fraction bar
    let mainFractionBar: { y: number; width: number; height: number; x: number } | null = null;

    if (fractionBars.length > 0) {
      const centerY = minY + vbHeight / 2;

      const sortedBars = [...fractionBars].sort((a, b) => {
        const widthDiff = b.width - a.width;
        if (Math.abs(widthDiff) > vbWidth * 0.1) {
          return widthDiff;
        }
        const aDistFromCenter = Math.abs(a.y - centerY);
        const bDistFromCenter = Math.abs(b.y - centerY);
        return aDistFromCenter - bDistFromCenter;
      });

      mainFractionBar = sortedBars[0];

      const mainIndex = fractionBars.findIndex((bar) =>
          bar.y === mainFractionBar!.y &&
          bar.width === mainFractionBar!.width &&
          bar.x === mainFractionBar!.x
      );
      if (mainIndex !== -1) {
        fractionBars[mainIndex].isMain = true;
      }
    }

    return {
      baseline,
      fractionBars,
      mainFractionBar,
      totalHeight: vbHeight,
      totalWidth: vbWidth,
    };
  }

  isMathJaxReady(): boolean {
    return typeof MathJax !== "undefined" && MathJax.startup;
  }

  async waitForMathJaxReady(): Promise<void> {
    if (!this.isMathJaxReady()) {
      throw new Error("MathJax is not defined.");
    }

    try {
      await MathJax.startup.promise;
    } catch (error) {
      throw new Error("Could not load MathJax.");
    }
  }
}
