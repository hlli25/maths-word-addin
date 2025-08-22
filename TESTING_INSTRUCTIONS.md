# Testing Instructions for Math Equation Editor Add-in

## Quick Start for Testers

### What You Need
- **The manifest file**: `manifest.production.xml` (provided separately)
- **Microsoft Word** (2016 or later on Windows/Mac, or Word Online)
- **Internet connection** (the add-in is hosted online)

### Installation Steps

#### For Windows/Mac Desktop

1. **Download** the `manifest.production.xml` file to your computer
2. **Open Microsoft Word**
3. Go to **Insert** → **My Add-ins** (or **Add-ins** → **My Add-ins**)
4. Click **Upload My Add-in**
5. **Browse** and select the `manifest.production.xml` file
6. Click **Upload**
7. The add-in will appear in the **Home tab** as "Equation Editor"

#### For Word Online (Browser)

1. Open Word in your browser at [office.com](https://www.office.com)
2. Go to **Insert** → **Add-ins**
3. Click **Upload My Add-in**
4. Upload the `manifest.production.xml` file
5. The add-in will be available in the Home tab

**Note**: Word Online has limitations - equations will appear as text instead of images.

### How to Use the Add-in

1. **Open the add-in**: Click "Equation Editor" button in the Home tab
2. **Create an equation**: 
   - Type LaTeX code directly (e.g., `\frac{1}{2}`)
   - Or use the button panels to insert symbols
3. **Insert into document**: Click "Insert Equation"
4. **Edit existing equations**: Select an equation and click "Get Selected"

### Platform Compatibility

| Platform | Support | Notes |
|----------|---------|-------|
| ✅ Windows Desktop | Full | All features work |
| ✅ Mac Desktop | Full | All features work |
| ⚠️ Word Online | Limited | Text fallback only (no images) |
| ✅ iPad | Full | Should work normally |

### Testing Checklist

Please test these features:

- [ ] **Basic equations**: Try `x^2 + y^2 = z^2`
- [ ] **Fractions**: Try `\frac{a}{b}`
- [ ] **Greek letters**: Click the Greek button panel
- [ ] **Matrices**: Try creating a 2x2 matrix
- [ ] **Integrals**: Use the integral buttons
- [ ] **Colors**: Apply colors to equations
- [ ] **Subscripts/Superscripts**: Test x₂ and x²
- [ ] **Bracket matching**: Type `(`, `[`, `{` and check auto-closing

### Known Issues

- **Word Online**: Cannot insert images due to API limitations - shows text fallback
- **Large equations**: Very complex equations may take longer to render

### Reporting Issues

If you encounter any problems:

1. **Note the platform** (Windows/Mac/Browser)
2. **Describe the issue** with steps to reproduce
3. **Share any error messages** you see
4. Report at: https://github.com/hlli25/maths-word-addin/issues

### Technical Details

- **Hosted at**: https://hlli25.github.io/maths-word-addin/
- **No installation needed**: The add-in runs from the web
- **Auto-updates**: Always uses the latest version

## For Developers

### Local Testing

```bash
# Clone the repository
git clone https://github.com/hlli25/maths-word-addin.git
cd maths-word-addin

# Install dependencies
npm install

# Start local development server
npm run dev-server

# In another terminal, start Word with the add-in
npm start
```

### Deployment

The add-in is automatically deployed to GitHub Pages. No action needed for testers.

## Support

For help or questions, contact the developer or create an issue on GitHub.