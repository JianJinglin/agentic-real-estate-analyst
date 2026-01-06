// Background Service Worker

// Default assumptions
const DEFAULT_ASSUMPTIONS = {
  downPaymentPercent: 3.5,       // Down payment 3.5%
  interestRate: 6.0,             // Interest rate 6%
  loanTermYears: 30,             // Loan term 30 years
  propertyTaxRate: 2.5,          // Property tax rate 2.5%/year
  insuranceRate: 0.3,            // Insurance rate 0.3%/year (price * 0.003)
  maintenancePercent: 5,         // Maintenance 5% of monthly rent
  vacancyRate: 0,                // Vacancy rate 0%
  propertyManagementPercent: 10, // Property management 10% of rent
  incomeTaxRate: 10,             // Income tax rate 10%
  highIncomeTaxRate: 30,         // High income tax rate 30%
  mortgageInsuranceRate: 0.75,   // PMI rate 0.75%/year
  appreciationRate: 3            // Annual property appreciation 3%
};

// Calculate cashflow
function calculateCashflow(propertyData, assumptions = DEFAULT_ASSUMPTIONS) {
  const price = propertyData.price || 0;
  const monthlyRent = propertyData.zestimateRent || estimateRent(propertyData);
  const sqft = propertyData.sqft || 0;

  // Loan calculation
  const downPaymentPercent = assumptions.downPaymentPercent;
  const downPayment = price * (downPaymentPercent / 100);
  const loanAmount = price - downPayment;
  const monthlyInterestRate = (assumptions.interestRate / 100) / 12;
  const numberOfPayments = assumptions.loanTermYears * 12;

  // Monthly payment (P&I) - using amortization formula
  let monthlyMortgage = 0;
  if (loanAmount > 0 && monthlyInterestRate > 0) {
    monthlyMortgage = loanAmount *
      (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
      (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
  }

  // Monthly expenses
  const monthlyTax = propertyData.propertyTax || (price * (assumptions.propertyTaxRate / 100) / 12);
  const monthlyInsurance = propertyData.insurance || (price * (assumptions.insuranceRate / 100) / 12);
  const monthlyHoa = propertyData.hoaFee || 0;
  const monthlyMaintenance = monthlyRent * (assumptions.maintenancePercent / 100);
  const monthlyVacancy = monthlyRent * (assumptions.vacancyRate / 100);
  const monthlyManagement = monthlyRent * (assumptions.propertyManagementPercent / 100);

  // PMI calculation: IF LTV > 80%, PMI = loan * 0.75% / 12, else 0
  const ltv = loanAmount / price;
  const monthlyPMI = ltv > 0.8 ? (loanAmount * (assumptions.mortgageInsuranceRate / 100) / 12) : 0;

  // Total monthly expenses (before tax)
  const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance +
                               monthlyHoa + monthlyMaintenance + monthlyVacancy +
                               monthlyManagement + monthlyPMI;

  // Gross monthly income (rent - operating expenses, before mortgage)
  const operatingExpenses = monthlyTax + monthlyInsurance + monthlyHoa +
                            monthlyMaintenance + monthlyVacancy + monthlyManagement;
  const grossMonthlyIncome = monthlyRent - operatingExpenses;

  // Pre-tax cashflow (income - all expenses including mortgage and PMI)
  const preTaxCashflow = monthlyRent - totalMonthlyExpenses;

  // Income tax calculations (on gross rental income minus expenses)
  const taxableIncome = Math.max(0, preTaxCashflow);
  const monthlyIncomeTax10 = taxableIncome * (assumptions.incomeTaxRate / 100);
  const monthlyIncomeTax30 = taxableIncome * (assumptions.highIncomeTaxRate / 100);

  // After-tax cashflow
  const monthlyCashflow10 = preTaxCashflow - monthlyIncomeTax10;
  const monthlyCashflow30 = preTaxCashflow - monthlyIncomeTax30;

  const annualCashflow10 = monthlyCashflow10 * 12;
  const annualCashflow30 = monthlyCashflow30 * 12;

  // NOI (Net Operating Income) - excluding loan/PMI/taxes
  const annualNOI = (monthlyRent - operatingExpenses) * 12;

  // Cap Rate
  const capRate = price > 0 ? (annualNOI / price) * 100 : 0;

  // Cashflow APY (annual cashflow / down payment)
  const cashflowAPY10 = downPayment > 0 ? (annualCashflow10 / downPayment) * 100 : 0;
  const cashflowAPY30 = downPayment > 0 ? (annualCashflow30 / downPayment) * 100 : 0;

  // 5-year APY (cashflow + appreciation)
  const annualAppreciation = price * (assumptions.appreciationRate / 100);
  const fiveYearCashflow10 = annualCashflow10 * 5;
  const fiveYearCashflow30 = annualCashflow30 * 5;
  const fiveYearAppreciation = annualAppreciation * 5;
  const fiveYearAPY10 = downPayment > 0 ? ((fiveYearCashflow10 + fiveYearAppreciation) / downPayment) * 100 / 5 : 0;
  const fiveYearAPY30 = downPayment > 0 ? ((fiveYearCashflow30 + fiveYearAppreciation) / downPayment) * 100 / 5 : 0;

  // Rent per sqft
  const rentPerSqft = sqft > 0 ? monthlyRent / sqft : 0;

  // Total cash invested (for reference)
  const closingCosts = price * 0.03;
  const totalCashInvested = downPayment + closingCosts;

  return {
    // Property info
    address: propertyData.address,
    url: propertyData.url,
    price: Math.round(price),
    bedrooms: propertyData.bedrooms,
    bathrooms: propertyData.bathrooms,
    sqft: propertyData.sqft,
    yearBuilt: propertyData.yearBuilt,
    propertyType: propertyData.propertyType || '',
    neighborhood: propertyData.neighborhood || '',

    // Income
    monthlyRent: Math.round(monthlyRent),
    rentPerSqft: rentPerSqft.toFixed(2),

    // Loan info
    downPaymentPercent: downPaymentPercent,
    downPayment: Math.round(downPayment),
    loanAmount: Math.round(loanAmount),
    ltv: (ltv * 100).toFixed(1),
    totalCashInvested: Math.round(totalCashInvested),

    // Expense breakdown
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyMaintenance: Math.round(monthlyMaintenance),
    monthlyManagement: Math.round(monthlyManagement),
    monthlyHoa: Math.round(monthlyHoa),
    monthlyPMI: Math.round(monthlyPMI),
    monthlyVacancy: Math.round(monthlyVacancy),
    totalMonthlyExpenses: Math.round(totalMonthlyExpenses),

    // Income calculations
    grossMonthlyIncome: Math.round(grossMonthlyIncome),
    preTaxCashflow: Math.round(preTaxCashflow),
    monthlyIncomeTax10: Math.round(monthlyIncomeTax10),
    monthlyIncomeTax30: Math.round(monthlyIncomeTax30),
    monthlyCashflow10: Math.round(monthlyCashflow10),
    monthlyCashflow30: Math.round(monthlyCashflow30),

    // Annual results
    annualCashflow10: Math.round(annualCashflow10),
    annualCashflow30: Math.round(annualCashflow30),
    annualNOI: Math.round(annualNOI),

    // Returns
    capRate: capRate,
    cashflowAPY10: cashflowAPY10,
    cashflowAPY30: cashflowAPY30,
    fiveYearAPY10: fiveYearAPY10,
    fiveYearAPY30: fiveYearAPY30,
    appreciationRate: assumptions.appreciationRate,
    annualAppreciation: Math.round(annualAppreciation),

    // Assumptions
    assumptions: assumptions,

    // Timestamp
    analyzedAt: new Date().toISOString()
  };
}

// Estimate rent (if Zillow doesn't provide)
function estimateRent(propertyData) {
  // Simple estimation: 0.8% of price as monthly rent (conservative version of 1% rule)
  const baseRent = propertyData.price * 0.008;

  // Adjust based on bedroom count
  const bedroomAdjustment = (propertyData.bedrooms || 2) * 50;

  return Math.round(baseRent + bedroomAdjustment);
}

// Add to Notion database
async function addToNotion(result) {
  // Get Notion config from storage
  const config = await chrome.storage.sync.get(['notionToken', 'notionDatabaseId']);

  if (!config.notionToken || !config.notionDatabaseId) {
    throw new Error('Please configure Notion Token and Database ID in extension settings first');
  }

  const token = config.notionToken;
  const databaseId = config.notionDatabaseId;

  // Create page in Notion database
  // Using rich_text for flexibility with user's database schema
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        // Title property (Address)
        'Address': {
          title: [{ text: { content: result.address || 'Unknown' } }]
        },
        // Number property
        'Price': { number: result.price || 0 },
        // Rich text properties
        'Beds': { rich_text: [{ text: { content: String(result.bedrooms || 0) } }] },
        'Baths': { rich_text: [{ text: { content: String(result.bathrooms || 0) } }] },
        'Sqft': { rich_text: [{ text: { content: (result.sqft?.toLocaleString() || '0') } }] },
        'Down Payment': { number: result.downPayment || 0 },
        'Rent': { rich_text: [{ text: { content: '$' + (result.monthlyRent?.toLocaleString() || '0') } }] },
        'Cashflow': { rich_text: [{ text: { content: '$' + (result.monthlyCashflow10?.toLocaleString() || '0') + '/mo' } }] },
        'APY': { rich_text: [{ text: { content: (result.cashflowAPY10?.toFixed(2) || '0') + '%' } }] },
        // URL as rich_text with link
        'Link': { rich_text: [{ text: { content: 'Zillow', link: { url: result.url || '' } } }] }
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to add to Notion');
  }

  return { success: true };
}

// Test Notion connection
async function testNotionConnection(token, databaseId) {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28'
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Connection failed');
  }

  const data = await response.json();
  const title = data.title?.[0]?.plain_text || 'Database';
  return { success: true, title };
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeProperty') {
    // Get saved assumptions or use defaults
    chrome.storage.sync.get(['assumptions'], (stored) => {
      try {
        const assumptions = { ...DEFAULT_ASSUMPTIONS, ...(stored.assumptions || {}) };
        const result = calculateCashflow(request.data, assumptions);
        sendResponse({ success: true, result: result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }

  if (request.action === 'addToExcel') {
    addToNotion(request.data)
      .then(result => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open
  }

  if (request.action === 'testNotionConnection') {
    testNotionConnection(request.token, request.databaseId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getAssumptions') {
    chrome.storage.sync.get(['assumptions'], (result) => {
      sendResponse({ assumptions: { ...DEFAULT_ASSUMPTIONS, ...(result.assumptions || {}) } });
    });
    return true;
  }

  if (request.action === 'saveAssumptions') {
    chrome.storage.sync.set({ assumptions: request.assumptions }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
