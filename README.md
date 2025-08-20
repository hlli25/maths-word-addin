# Math Equation Editor for Microsoft Word

A powerful equation editor add-in for Microsoft Word that provides an intuitive interface for inserting and editing mathematical equations. Built with TypeScript and the Office JavaScript API, this add-in features real-time LaTeX preview, extensive symbol libraries, and seamless integration with Word's equation system.

## Features

### Comprehensive Mathematical Tools
- **Real-time LaTeX Preview**: See your equations rendered instantly as you type
- **Extensive Symbol Libraries**: Access Greek letters, mathematical operators, relations, arrows, and more
- **Advanced Functions**: Support for derivatives, integrals, limits, matrices, and special functions
- **Multiple Input Methods**: Type LaTeX directly or use the visual button interface
- **Smart Bracket Handling**: Automatic bracket matching and navigation

### Specialized Equation Types
- **Derivatives**: Both standard and fractional notation (d/dx, ∂/∂x)
- **Integrals**: Single, double, triple, and contour integrals with customizable limits
- **Limits**: Upper, lower, and bidirectional limits
- **Matrices & Vectors**: Easy matrix creation with customizable dimensions
- **Set Theory & Logic**: Comprehensive set and logical operators

### Formatting Options
- **Text Styling**: Bold, italic, and color formatting for equations
- **Superscripts & Subscripts**: Easy insertion of powers and indices
- **Fractions**: Both inline and display-style fractions
- **Roots**: Square roots and nth roots

## Prerequisites

- **Node.js** (LTS version recommended) - [Download](https://nodejs.org/)
- **Microsoft Word** connected to a Microsoft 365 subscription
  - Qualify for a [Microsoft 365 E5 developer subscription](https://developer.microsoft.com/microsoft-365/dev-program)
  - Or get a [1-month free trial](https://www.microsoft.com/microsoft-365/try?rtc=1)
  - Or [purchase a Microsoft 365 plan](https://www.microsoft.com/microsoft-365/buy/compare-all-microsoft-365-products)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/maths-word-addin.git
cd maths-word-addin
```

2. Install dependencies:
```bash
npm install
```

## Development

### Quick Start with Office Add-ins Development Kit

1. **Open VS Code** and install the Office Add-ins Development Kit extension

2. **Start the development server**:
   - Press `F5` or select "Preview Your Office Add-in" from the extension
   - Choose "Word Desktop (Edge Chromium)" from the Quick Pick menu
   - Word will launch automatically with the add-in loaded

3. **Stop debugging**:
   - Select "Stop Previewing Your Office Add-in" from the extension

### Manual Development Commands

```bash
# Start development server
npm run dev-server

# Build for development
npm run build:dev

# Build for production
npm run build

# Validate manifest
npm run validate

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## Project Structure

```
maths-word-addin/
├── manifest.xml           # Add-in manifest configuration
├── src/
│   ├── taskpane/
│   │   ├── taskpane.html  # Main UI HTML
│   │   ├── taskpane.css   # Styles
│   │   └── taskpane.ts    # Main TypeScript logic
│   └── commands/
│       └── commands.ts    # Office command handlers
├── webpack.config.js      # Webpack configuration
└── package.json          # Project dependencies
```

## Key Features Implementation

### LaTeX Processing
The add-in uses MathJax for rendering LaTeX equations with custom macros for enhanced functionality:
- Custom derivative commands for both standard and fractional notation
- Extended integral commands with separate integrand and variable blocks
- Physics package integration for advanced mathematical notation

### Smart Input Handling
- **Bracket Navigation**: Automatic cursor positioning within brackets
- **Command Shortcuts**: Quick insertion of common mathematical structures
- **Preview Updates**: Real-time rendering as you type

### Word Integration
Direct insertion of equations into Word documents using the Office JavaScript API, maintaining full compatibility with Word's native equation editor.

## Usage

1. **Open the add-in**: Click the Math Equation Editor button in the Word ribbon

2. **Create equations**:
   - Type LaTeX directly in the input field
   - Or use the visual buttons to insert symbols and structures
   - Preview updates automatically

3. **Insert into document**: Click "Insert Equation" to add the equation at the cursor position

4. **Edit existing equations**: Select an equation in Word and click "Get Selected" to load it for editing

## Troubleshooting

### Common Issues

1. **Add-in not loading**:
   - Close all Word instances
   - Stop the dev server with "Stop Previewing Your Office Add-in"
   - Clear the Office cache and restart

2. **Preview not updating**:
   - Check for LaTeX syntax errors
   - Ensure MathJax is loaded (check browser console)

3. **Build errors**:
   - Run `npm install` to ensure all dependencies are installed
   - Check Node.js version compatibility

For more help, see [troubleshooting Office Add-ins](https://learn.microsoft.com/office/dev/add-ins/testing/troubleshoot-development-errors).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- Create an [issue](https://github.com/your-username/maths-word-addin/issues) for bug reports or feature requests
- Join the [Microsoft Office Add-ins community](https://learn.microsoft.com/office/dev/add-ins/overview/office-add-ins-community-call) for discussions

## Acknowledgments

- Built with the [Office Add-ins Development Kit](https://marketplace.visualstudio.com/items?itemName=msoffice.microsoft-office-add-in-debugger)
- Mathematical rendering powered by [MathJax](https://www.mathjax.org/)
- UI components from [Fluent UI](https://developer.microsoft.com/fluentui)