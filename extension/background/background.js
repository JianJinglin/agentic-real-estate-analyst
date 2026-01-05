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

// Add to GitHub CSV
async function addToGitHubCSV(result) {
  // Get GitHub config from storage
  const config = await chrome.storage.sync.get(['githubToken', 'githubRepo', 'githubPath']);

  if (!config.githubToken || !config.githubRepo) {
    throw new Error('Please configure GitHub Token and repository in extension settings first');
  }

  const token = config.githubToken;
  const repo = config.githubRepo; // Format: owner/repo
  const filePath = config.githubPath || 'data/properties.csv';

  // Get existing file content
  let existingContent = '';
  let sha = null;

  try {
    const getResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (getResponse.ok) {
      const fileData = await getResponse.json();
      existingContent = atob(fileData.content);
      sha = fileData.sha;
    }
  } catch (e) {
    // File doesn't exist, will create new file
  }

  // CSV headers (expanded)
  const headers = 'Date,Address,Type,Price,DP%,DP$,Beds,Baths,Sqft,Rent/sqft,Monthly Rent,Mortgage,Tax,Insurance,Maint,Mgmt,HOA,PMI,Cashflow@10%,Cashflow@30%,APY@10%,APY@30%,5yr APY@10%,Cap Rate,URL\n';

  // New row data (expanded)
  const newRow = [
    new Date().toLocaleDateString(),
    `"${result.address || ''}"`,
    result.propertyType || 'SFR',
    result.price || 0,
    (result.downPaymentPercent || 0).toFixed(1) + '%',
    result.downPayment || 0,
    result.bedrooms || 0,
    result.bathrooms || 0,
    result.sqft || 0,
    '$' + (result.rentPerSqft || 0),
    result.monthlyRent || 0,
    result.monthlyMortgage || 0,
    result.monthlyTax || 0,
    result.monthlyInsurance || 0,
    result.monthlyMaintenance || 0,
    result.monthlyManagement || 0,
    result.monthlyHoa || 0,
    result.monthlyPMI || 0,
    result.monthlyCashflow10 || 0,
    result.monthlyCashflow30 || 0,
    (result.cashflowAPY10 || 0).toFixed(2) + '%',
    (result.cashflowAPY30 || 0).toFixed(2) + '%',
    (result.fiveYearAPY10 || 0).toFixed(2) + '%',
    (result.capRate || 0).toFixed(2) + '%',
    result.url || ''
  ].join(',') + '\n';

  // Combine content
  let newContent;
  if (!existingContent) {
    newContent = headers + newRow;
  } else {
    newContent = existingContent + newRow;
  }

  // Update/create file
  const updateResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Add property: ${result.address || 'Unknown'}`,
      content: btoa(unescape(encodeURIComponent(newContent))),
      sha: sha
    })
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.json();
    throw new Error(error.message || 'Failed to update GitHub');
  }

  return { success: true };
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
    addToGitHubCSV(request.data)
      .then(result => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open
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
