// Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // Load saved settings
  loadSettings();

  // Save Notion config
  document.getElementById('save-notion').addEventListener('click', saveNotionConfig);

  // Test Notion connection
  document.getElementById('test-notion').addEventListener('click', testNotionConnection);

  // Save assumptions
  document.getElementById('save-assumptions').addEventListener('click', saveAssumptions);

  // Reset assumptions
  document.getElementById('reset-assumptions').addEventListener('click', resetAssumptions);
});

// Default assumptions - must match background.js
function getDefaultAssumptions() {
  return {
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
}

// Load settings
function loadSettings() {
  chrome.storage.sync.get(['notionToken', 'notionDatabaseId', 'assumptions'], (result) => {
    if (result.notionToken) {
      document.getElementById('notion-token').value = result.notionToken;
    }
    if (result.notionDatabaseId) {
      document.getElementById('notion-database').value = result.notionDatabaseId;
    }

    const defaults = getDefaultAssumptions();
    const assumptions = { ...defaults, ...(result.assumptions || {}) };

    // Loan parameters
    document.getElementById('down-payment').value = assumptions.downPaymentPercent;
    document.getElementById('interest-rate').value = assumptions.interestRate;
    document.getElementById('loan-term').value = assumptions.loanTermYears;
    document.getElementById('pmi-rate').value = assumptions.mortgageInsuranceRate;

    // Expense parameters
    document.getElementById('property-tax').value = assumptions.propertyTaxRate;
    document.getElementById('insurance-rate').value = assumptions.insuranceRate;
    document.getElementById('maintenance-percent').value = assumptions.maintenancePercent;
    document.getElementById('management-percent').value = assumptions.propertyManagementPercent;
    document.getElementById('vacancy-rate').value = assumptions.vacancyRate;

    // Tax & returns
    document.getElementById('income-tax-rate').value = assumptions.incomeTaxRate;
    document.getElementById('high-income-tax-rate').value = assumptions.highIncomeTaxRate;
    document.getElementById('appreciation-rate').value = assumptions.appreciationRate;
  });
}

// Save Notion config
function saveNotionConfig() {
  const token = document.getElementById('notion-token').value.trim();
  const databaseId = document.getElementById('notion-database').value.trim();

  if (!token || !databaseId) {
    showStatus('notion-status', 'error', 'Please fill in Token and Database ID');
    return;
  }

  chrome.storage.sync.set({
    notionToken: token,
    notionDatabaseId: databaseId
  }, () => {
    showStatus('notion-status', 'success', '✅ Notion config saved');
  });
}

// Test Notion connection
function testNotionConnection() {
  const token = document.getElementById('notion-token').value.trim();
  const databaseId = document.getElementById('notion-database').value.trim();

  if (!token || !databaseId) {
    showStatus('notion-status', 'error', 'Please fill in Token and Database ID first');
    return;
  }

  showStatus('notion-status', 'info', '🔄 Testing connection...');

  chrome.runtime.sendMessage({
    action: 'testNotionConnection',
    token: token,
    databaseId: databaseId
  }, response => {
    if (chrome.runtime.lastError) {
      showStatus('notion-status', 'error', 'Extension error');
      return;
    }
    if (response && response.success) {
      showStatus('notion-status', 'success', '✅ Connected! Database: ' + (response.title || 'OK'));
    } else {
      showStatus('notion-status', 'error', '❌ ' + (response?.error || 'Connection failed'));
    }
  });
}

// Save assumptions
function saveAssumptions() {
  const defaults = getDefaultAssumptions();

  const assumptions = {
    // Loan parameters
    downPaymentPercent: parseFloat(document.getElementById('down-payment').value) || defaults.downPaymentPercent,
    interestRate: parseFloat(document.getElementById('interest-rate').value) || defaults.interestRate,
    loanTermYears: parseInt(document.getElementById('loan-term').value) || defaults.loanTermYears,
    mortgageInsuranceRate: parseFloat(document.getElementById('pmi-rate').value) || defaults.mortgageInsuranceRate,

    // Expense parameters
    propertyTaxRate: parseFloat(document.getElementById('property-tax').value) || defaults.propertyTaxRate,
    insuranceRate: parseFloat(document.getElementById('insurance-rate').value) || defaults.insuranceRate,
    maintenancePercent: parseFloat(document.getElementById('maintenance-percent').value) || defaults.maintenancePercent,
    propertyManagementPercent: parseFloat(document.getElementById('management-percent').value) || defaults.propertyManagementPercent,
    vacancyRate: parseFloat(document.getElementById('vacancy-rate').value) || 0, // Allow 0

    // Tax & returns
    incomeTaxRate: parseFloat(document.getElementById('income-tax-rate').value) || defaults.incomeTaxRate,
    highIncomeTaxRate: parseFloat(document.getElementById('high-income-tax-rate').value) || defaults.highIncomeTaxRate,
    appreciationRate: parseFloat(document.getElementById('appreciation-rate').value) || defaults.appreciationRate
  };

  chrome.storage.sync.set({ assumptions }, () => {
    showStatus('assumptions-status', 'success', '✅ Parameters saved');
  });
}

// Reset assumptions
function resetAssumptions() {
  const defaults = getDefaultAssumptions();

  // Loan parameters
  document.getElementById('down-payment').value = defaults.downPaymentPercent;
  document.getElementById('interest-rate').value = defaults.interestRate;
  document.getElementById('loan-term').value = defaults.loanTermYears;
  document.getElementById('pmi-rate').value = defaults.mortgageInsuranceRate;

  // Expense parameters
  document.getElementById('property-tax').value = defaults.propertyTaxRate;
  document.getElementById('insurance-rate').value = defaults.insuranceRate;
  document.getElementById('maintenance-percent').value = defaults.maintenancePercent;
  document.getElementById('management-percent').value = defaults.propertyManagementPercent;
  document.getElementById('vacancy-rate').value = defaults.vacancyRate;

  // Tax & returns
  document.getElementById('income-tax-rate').value = defaults.incomeTaxRate;
  document.getElementById('high-income-tax-rate').value = defaults.highIncomeTaxRate;
  document.getElementById('appreciation-rate').value = defaults.appreciationRate;

  chrome.storage.sync.set({ assumptions: defaults }, () => {
    showStatus('assumptions-status', 'success', '✅ Reset to defaults');
  });
}

// Show status message
function showStatus(elementId, type, message) {
  const statusEl = document.getElementById(elementId);
  statusEl.className = 'status ' + type;
  statusEl.textContent = message;

  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
}
