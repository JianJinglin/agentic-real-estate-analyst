// Background Service Worker

// Default assumptions
const DEFAULT_ASSUMPTIONS = {
  downPaymentPercent: 20,      // Down payment 20%
  interestRate: 7.0,           // Interest rate 7%
  loanTermYears: 30,           // Loan term 30 years
  propertyTaxRate: 1.25,       // Property tax rate 1.25%/year
  insuranceRate: 0.5,          // Insurance rate 0.5%/year
  maintenanceRate: 1,          // Maintenance 1%/year
  vacancyRate: 5,              // Vacancy rate 5%
  propertyManagementRate: 0    // Property management 0% (self-managed)
};

// Calculate cashflow
function calculateCashflow(propertyData, assumptions = DEFAULT_ASSUMPTIONS) {
  const price = propertyData.price || 0;
  const monthlyRent = propertyData.zestimateRent || estimateRent(propertyData);

  // Loan calculation
  const downPayment = price * (assumptions.downPaymentPercent / 100);
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
  const monthlyMaintenance = price * (assumptions.maintenanceRate / 100) / 12;
  const monthlyVacancy = monthlyRent * (assumptions.vacancyRate / 100);
  const monthlyManagement = monthlyRent * (assumptions.propertyManagementRate / 100);

  // Total monthly expenses
  const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance +
                               monthlyHoa + monthlyMaintenance + monthlyVacancy + monthlyManagement;

  // Monthly cashflow
  const monthlyCashflow = monthlyRent - totalMonthlyExpenses;
  const annualCashflow = monthlyCashflow * 12;

  // NOI (Net Operating Income) - excluding loan
  const annualNOI = (monthlyRent * 12) -
                    ((monthlyTax + monthlyInsurance + monthlyHoa + monthlyMaintenance + monthlyVacancy + monthlyManagement) * 12);

  // Cap Rate
  const capRate = price > 0 ? (annualNOI / price) * 100 : 0;

  // Cash on Cash Return
  const totalCashInvested = downPayment + (price * 0.03); // Down payment + ~3% closing costs
  const cashOnCashReturn = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;

  return {
    // Property info
    address: propertyData.address,
    url: propertyData.url,
    price: Math.round(price),
    bedrooms: propertyData.bedrooms,
    bathrooms: propertyData.bathrooms,
    sqft: propertyData.sqft,
    yearBuilt: propertyData.yearBuilt,

    // Income
    monthlyRent: Math.round(monthlyRent),

    // Expense breakdown
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyHoa: Math.round(monthlyHoa),
    monthlyMaintenance: Math.round(monthlyMaintenance),
    monthlyVacancy: Math.round(monthlyVacancy),
    monthlyManagement: Math.round(monthlyManagement),

    // Results
    monthlyCashflow: Math.round(monthlyCashflow),
    annualCashflow: Math.round(annualCashflow),
    annualNOI: Math.round(annualNOI),
    capRate: capRate,
    cashOnCashReturn: cashOnCashReturn,

    // Loan info
    downPayment: Math.round(downPayment),
    loanAmount: Math.round(loanAmount),
    totalCashInvested: Math.round(totalCashInvested),

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

  // CSV headers
  const headers = 'Date,Address,Price,Beds,Baths,Sqft,Monthly Rent,Monthly Cashflow,Annual Cashflow,CoC Return,Cap Rate,URL\n';

  // New row data
  const newRow = [
    new Date().toLocaleDateString(),
    `"${result.address || ''}"`,
    result.price || 0,
    result.bedrooms || 0,
    result.bathrooms || 0,
    result.sqft || 0,
    result.monthlyRent || 0,
    result.monthlyCashflow || 0,
    result.annualCashflow || 0,
    (result.cashOnCashReturn || 0).toFixed(2) + '%',
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
    try {
      const result = calculateCashflow(request.data);
      sendResponse({ success: true, result: result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
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
      sendResponse({ assumptions: result.assumptions || DEFAULT_ASSUMPTIONS });
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
