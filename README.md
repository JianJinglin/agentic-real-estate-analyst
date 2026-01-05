# Rancho - Real Estate Analyst

**Zillow Property Cashflow Analysis Chrome Extension**

Analyze property cashflow with one click while browsing Zillow listings. Quickly screen investment properties.

## Features

- **One-Click Analysis**: Click the "Rancho" button on any Zillow property detail page for instant cashflow analysis
- **Comprehensive Calculations**: Mortgage, property tax, insurance, HOA, maintenance, and vacancy all at a glance
- **Key Metrics**: Monthly cashflow, annual cashflow, Cash-on-Cash return, Cap Rate
- **Export Feature**: One-click save to GitHub CSV for tracking and comparison
- **Customizable Parameters**: Adjust down payment, interest rate, expense assumptions, and more

## Installation

### Developer Mode Installation

1. Download this project to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `extension` folder

### Generate Icons

```bash
cd extension/icons
# Use rsvg-convert to generate PNG icons
rsvg-convert -w 16 -h 16 icon.svg > icon16.png
rsvg-convert -w 48 -h 48 icon.svg > icon48.png
rsvg-convert -w 128 -h 128 icon.svg > icon128.png
```

## Usage

### 1. Configure GitHub (Optional)

1. Click the extension icon to open the settings panel
2. Enter your GitHub Token ([How to get one](https://github.com/settings/tokens))
3. Enter your repository name (e.g., `JianJinglin/agentic-real-estate-analyst`)
4. Set the CSV file path (default: `data/properties.csv`)

### 2. Analyze Properties

1. Open any property detail page on [Zillow](https://www.zillow.com)
2. Click the "Rancho" button on the page
3. View the cashflow analysis results
4. Click "Add to My Excel" to save the data

### 3. Customize Parameters

In Extension Settings > Parameters tab, you can adjust:

| Parameter | Default | Description |
|-----------|---------|-------------|
| Down Payment | 20% | Down payment percentage |
| Interest Rate | 7.0% | Loan interest rate |
| Loan Term | 30 years | Loan term |
| Property Tax | 1.25%/year | Property tax rate |
| Insurance | 0.5%/year | Insurance rate |
| Maintenance | 1%/year | Maintenance reserve |
| Vacancy | 5% | Vacancy rate |

## Calculation Formulas

```
Monthly Cashflow = Rent - Mortgage - Property Tax - Insurance - HOA - Maintenance Reserve - Vacancy Reserve

CoC Return = Annual Cashflow / Total Cash Invested x 100%

Cap Rate = Annual NOI / Price x 100%

NOI = Annual Rent Income - Annual Operating Expenses (excluding loan)
```

## Project Structure

```
extension/
├── manifest.json          # Extension configuration
├── background/
│   └── background.js      # Background service & calculation logic
├── content/
│   ├── content.js         # Zillow page injection script
│   └── content.css        # Injected styles
├── popup/
│   ├── popup.html         # Settings panel
│   ├── popup.css          # Settings styles
│   └── popup.js           # Settings logic
└── icons/
    └── icon.svg           # Icon source file
```

## Links

- [Notion Project Page](https://www.notion.so/jianjinglin/AI-2116f2ec284680029263c3c428733b6a)

## License

MIT License

---

Made with love for real estate investors
