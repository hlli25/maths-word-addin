# Testing Instructions for Math Equation Editor Add-in

Your Math Equation Editor add-in is now deployed and ready for testing!

## Live URL
The add-in is hosted at: https://hlli25.github.io/maths-word-addin/

## For Testers

### Quick Setup
1. Download the production manifest file: `manifest.production.xml`
2. Follow the installation instructions below for your platform

### Installation on Windows/Mac Desktop

1. Open Microsoft Word
2. Go to **Insert** → **My Add-ins** (or **Add-ins** → **My Add-ins**)
3. Click **Upload My Add-in**
4. Browse and select the `manifest.production.xml` file
5. Click **Upload**
6. The add-in will appear in the Home tab as "Equation Editor"

### Installation on Word Online (Browser)

1. Open Word in your browser (office.com)
2. Go to **Insert** → **Add-ins**
3. Click **Upload My Add-in**
4. Upload the `manifest.production.xml` file
5. The add-in will be available in the Home tab

### Platform Compatibility

✅ **Supported Platforms:**
- Windows: Word 2016 or later
- Mac: Word 2016 or later  
- Word Online (all browsers)
- iPad: Word for iPad

### Testing Checklist

When testing, please verify:

- [ ] Add-in loads without errors
- [ ] LaTeX preview updates in real-time
- [ ] Equations insert correctly into the document
- [ ] All button categories work (Greek, Operators, etc.)
- [ ] Keyboard shortcuts function properly
- [ ] Color formatting applies correctly
- [ ] Matrix creation works
- [ ] Integral/derivative buttons function

### Sharing the Manifest

To share with testers:
1. Send them the `manifest.production.xml` file
2. Share this instruction document
3. No additional setup or dependencies required!

### Troubleshooting

**Add-in not loading?**
- Ensure you're using a supported version of Word
- Clear browser cache (for Word Online)
- Try re-uploading the manifest

**Equations not inserting?**
- Check if you have edit permissions on the document
- Ensure cursor is positioned in the document body

**Preview not updating?**
- Check for JavaScript errors in browser console
- Verify internet connection (MathJax requires CDN access)

## For Development Team

### Deployment Commands

```bash
# Build and deploy updates
npm run deploy

# Just build
npm run build

# Validate manifest
npm run validate
```

### GitHub Pages Status
- Repository: https://github.com/hlli25/maths-word-addin
- GitHub Pages: https://hlli25.github.io/maths-word-addin/
- Branch: `gh-pages`

### Making Updates

1. Make changes in the main branch
2. Run `npm run deploy` to push to GitHub Pages
3. Changes will be live within 5-10 minutes
4. Testers don't need to re-install (changes load on next use)

## Support

Report issues at: https://github.com/hlli25/maths-word-addin/issues