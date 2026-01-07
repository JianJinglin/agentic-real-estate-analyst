// Content Script - Inject into Zillow property detail pages

(function() {
  'use strict';

  // Check if we're on a property detail page
  function isPropertyDetailPage() {
    return window.location.pathname.includes('/homedetails/');
  }

  // Check if already injected
  if (document.getElementById('rancho-btn')) return;

  // Default assumptions - must match background.js
  function getDefaultAssumptions() {
    return {
      downPaymentPercent: 3.5,
      interestRate: 6.0,
      loanTermYears: 30,
      propertyTaxRate: 2.5,
      insuranceRate: 0.3,
      maintenancePercent: 5,
      vacancyRate: 0,
      propertyManagementPercent: 10,
      incomeTaxRate: 10,
      highIncomeTaxRate: 30,
      mortgageInsuranceRate: 0.75,
      appreciationRate: 3
    };
  }

  // Create Settings Sidebar
  function createSettingsSidebar() {
    if (document.getElementById('rancho-sidebar')) return;

    const sidebar = document.createElement('div');
    sidebar.id = 'rancho-sidebar';
    sidebar.innerHTML = `
      <div class="rancho-sidebar-toggle" id="rancho-sidebar-toggle">⚙️</div>
      <div class="rancho-sidebar-content" id="rancho-sidebar-content">
        <div class="rancho-sidebar-header">
          <h2>🏠 Rancho Settings</h2>
          <span class="rancho-sidebar-close" id="rancho-sidebar-close">&times;</span>
        </div>

        <div class="rancho-sidebar-tabs">
          <button class="rancho-sidebar-tab active" data-tab="settings">⚙️ Settings</button>
          <button class="rancho-sidebar-tab" data-tab="assumptions">📊 Parameters</button>
          <button class="rancho-sidebar-tab" data-tab="help">❓ Help</button>
        </div>

        <!-- Settings Tab -->
        <div class="rancho-sidebar-tab-content active" id="rancho-tab-settings">
          <div class="rancho-sidebar-section">
            <h3>📊 Google Sheets Connection</h3>
            <div class="rancho-form-group">
              <label>Google Apps Script URL</label>
              <input type="text" id="rancho-gsheets-url" placeholder="https://script.google.com/macros/s/xxx/exec">
              <small>Deploy URL from your Google Apps Script</small>
            </div>
            <button id="rancho-save-gsheets" class="rancho-sidebar-btn-primary">💾 Save Config</button>
            <button id="rancho-test-gsheets" class="rancho-sidebar-btn-secondary">🔗 Test Connection</button>
            <div id="rancho-gsheets-status" class="rancho-sidebar-status"></div>
          </div>

          <div class="rancho-sidebar-section">
            <h3>📝 Notion Connection (Optional)</h3>
            <div class="rancho-form-group">
              <label>Notion API Token</label>
              <input type="password" id="rancho-notion-token" placeholder="ntn_xxxx...">
              <small>Internal integration token from Notion</small>
            </div>
            <div class="rancho-form-group">
              <label>Database ID</label>
              <input type="text" id="rancho-notion-database" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
              <small>Your property tracking database ID</small>
            </div>
            <button id="rancho-save-notion" class="rancho-sidebar-btn-primary">💾 Save Config</button>
            <button id="rancho-test-notion" class="rancho-sidebar-btn-secondary">🔗 Test Connection</button>
            <div id="rancho-notion-status" class="rancho-sidebar-status"></div>
          </div>
        </div>

        <!-- Assumptions Tab -->
        <div class="rancho-sidebar-tab-content" id="rancho-tab-assumptions">
          <div class="rancho-sidebar-section">
            <h3>💰 Loan Parameters</h3>
            <div class="rancho-form-group">
              <label>Down Payment (%)</label>
              <input type="number" id="rancho-down-payment" value="3.5" step="0.5" min="0" max="100">
            </div>
            <div class="rancho-form-group">
              <label>Interest Rate (%)</label>
              <input type="number" id="rancho-interest-rate" value="6.0" step="0.125" min="0">
            </div>
            <div class="rancho-form-group">
              <label>Loan Term (years)</label>
              <input type="number" id="rancho-loan-term" value="30" min="1" max="40">
            </div>
            <div class="rancho-form-group">
              <label>PMI Rate (%/year)</label>
              <input type="number" id="rancho-pmi-rate" value="0.75" step="0.05" min="0">
            </div>
          </div>

          <div class="rancho-sidebar-section">
            <h3>🏦 Expense Parameters</h3>
            <div class="rancho-form-group">
              <label>Property Tax Rate (%/year)</label>
              <input type="number" id="rancho-property-tax" value="2.5" step="0.1" min="0">
            </div>
            <div class="rancho-form-group">
              <label>Insurance Rate (%/year)</label>
              <input type="number" id="rancho-insurance-rate" value="0.3" step="0.05" min="0">
            </div>
            <div class="rancho-form-group">
              <label>Maintenance (% of rent)</label>
              <input type="number" id="rancho-maintenance-percent" value="5" step="1" min="0">
            </div>
            <div class="rancho-form-group">
              <label>Property Mgmt (% of rent)</label>
              <input type="number" id="rancho-management-percent" value="10" step="1" min="0">
            </div>
            <div class="rancho-form-group">
              <label>Vacancy Rate (%)</label>
              <input type="number" id="rancho-vacancy-rate" value="0" step="1" min="0" max="100">
            </div>
          </div>

          <div class="rancho-sidebar-section">
            <h3>📈 Tax & Returns</h3>
            <div class="rancho-form-group">
              <label>Income Tax Rate (%)</label>
              <input type="number" id="rancho-income-tax-rate" value="10" step="1" min="0" max="50">
            </div>
            <div class="rancho-form-group">
              <label>High Income Tax Rate (%)</label>
              <input type="number" id="rancho-high-income-tax-rate" value="30" step="1" min="0" max="50">
            </div>
            <div class="rancho-form-group">
              <label>Appreciation Rate (%/year)</label>
              <input type="number" id="rancho-appreciation-rate" value="3" step="0.5" min="0" max="20">
            </div>
          </div>

          <button id="rancho-save-assumptions" class="rancho-sidebar-btn-primary">💾 Save Parameters</button>
          <button id="rancho-reset-assumptions" class="rancho-sidebar-btn-secondary">🔄 Reset to Defaults</button>
          <div id="rancho-assumptions-status" class="rancho-sidebar-status"></div>
        </div>

        <!-- Help Tab -->
        <div class="rancho-sidebar-tab-content" id="rancho-tab-help">
          <div class="rancho-sidebar-section">
            <h3>📖 How to Use</h3>
            <ol>
              <li>Open a Zillow property detail page</li>
              <li>Click the "🏠 Rancho" button on the page</li>
              <li>View the cashflow analysis results</li>
              <li>Click "Add to Sheets" or "Add to Notion" to save</li>
            </ol>
          </div>

          <div class="rancho-sidebar-section">
            <h3>📊 Setup Google Sheets</h3>
            <ol>
              <li>Create a new Google Sheet</li>
              <li>Go to Extensions → Apps Script</li>
              <li>Paste the script from GitHub</li>
              <li>Deploy as Web app</li>
              <li>Copy the URL to Settings tab</li>
            </ol>
          </div>

          <div class="rancho-sidebar-section">
            <h3>📊 Calculation Formulas</h3>
            <p><strong>PMI</strong> = IF(LTV > 80%, loan × 0.75% / 12, 0)</p>
            <p><strong>Cashflow</strong> = Rent - Expenses - Tax</p>
            <p><strong>Cashflow APY</strong> = Annual Cashflow / Down Payment</p>
          </div>
        </div>

        <div class="rancho-sidebar-footer">
          <p>v1.3.0 | Made with ❤️</p>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);

    // Setup sidebar event listeners
    setupSidebarEvents();
    loadSidebarSettings();
  }

  // Setup sidebar event listeners
  function setupSidebarEvents() {
    // Toggle sidebar
    const toggle = document.getElementById('rancho-sidebar-toggle');
    const content = document.getElementById('rancho-sidebar-content');
    const close = document.getElementById('rancho-sidebar-close');

    toggle.addEventListener('click', () => {
      content.classList.toggle('open');
      toggle.classList.toggle('hidden');
    });

    close.addEventListener('click', () => {
      content.classList.remove('open');
      toggle.classList.remove('hidden');
    });

    // Tab switching
    const tabs = document.querySelectorAll('.rancho-sidebar-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.rancho-sidebar-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('rancho-tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Save Google Sheets config
    document.getElementById('rancho-save-gsheets').addEventListener('click', () => {
      const url = document.getElementById('rancho-gsheets-url').value.trim();
      if (!url) {
        showSidebarStatus('rancho-gsheets-status', 'error', 'Please enter the URL');
        return;
      }
      if (!url.startsWith('https://script.google.com/')) {
        showSidebarStatus('rancho-gsheets-status', 'error', 'Invalid URL format');
        return;
      }
      chrome.storage.sync.set({ gSheetsUrl: url }, () => {
        showSidebarStatus('rancho-gsheets-status', 'success', '✅ Config saved');
      });
    });

    // Test Google Sheets connection
    document.getElementById('rancho-test-gsheets').addEventListener('click', () => {
      const url = document.getElementById('rancho-gsheets-url').value.trim();
      if (!url) {
        showSidebarStatus('rancho-gsheets-status', 'error', 'Please enter URL first');
        return;
      }
      showSidebarStatus('rancho-gsheets-status', 'info', '🔄 Testing...');
      chrome.runtime.sendMessage({ action: 'testGSheetsConnection', url: url }, response => {
        if (response && response.success) {
          showSidebarStatus('rancho-gsheets-status', 'success', '✅ Connected!');
        } else {
          showSidebarStatus('rancho-gsheets-status', 'error', '❌ ' + (response?.error || 'Failed'));
        }
      });
    });

    // Save Notion config
    document.getElementById('rancho-save-notion').addEventListener('click', () => {
      const token = document.getElementById('rancho-notion-token').value.trim();
      const databaseId = document.getElementById('rancho-notion-database').value.trim();
      if (!token || !databaseId) {
        showSidebarStatus('rancho-notion-status', 'error', 'Please fill in both fields');
        return;
      }
      chrome.storage.sync.set({ notionToken: token, notionDatabaseId: databaseId }, () => {
        showSidebarStatus('rancho-notion-status', 'success', '✅ Config saved');
      });
    });

    // Test Notion connection
    document.getElementById('rancho-test-notion').addEventListener('click', () => {
      const token = document.getElementById('rancho-notion-token').value.trim();
      const databaseId = document.getElementById('rancho-notion-database').value.trim();
      if (!token || !databaseId) {
        showSidebarStatus('rancho-notion-status', 'error', 'Please fill in both fields first');
        return;
      }
      showSidebarStatus('rancho-notion-status', 'info', '🔄 Testing...');
      chrome.runtime.sendMessage({ action: 'testNotionConnection', token: token, databaseId: databaseId }, response => {
        if (response && response.success) {
          showSidebarStatus('rancho-notion-status', 'success', '✅ Connected!');
        } else {
          showSidebarStatus('rancho-notion-status', 'error', '❌ ' + (response?.error || 'Failed'));
        }
      });
    });

    // Save assumptions
    document.getElementById('rancho-save-assumptions').addEventListener('click', () => {
      const defaults = getDefaultAssumptions();
      const assumptions = {
        downPaymentPercent: parseFloat(document.getElementById('rancho-down-payment').value) || defaults.downPaymentPercent,
        interestRate: parseFloat(document.getElementById('rancho-interest-rate').value) || defaults.interestRate,
        loanTermYears: parseInt(document.getElementById('rancho-loan-term').value) || defaults.loanTermYears,
        mortgageInsuranceRate: parseFloat(document.getElementById('rancho-pmi-rate').value) || defaults.mortgageInsuranceRate,
        propertyTaxRate: parseFloat(document.getElementById('rancho-property-tax').value) || defaults.propertyTaxRate,
        insuranceRate: parseFloat(document.getElementById('rancho-insurance-rate').value) || defaults.insuranceRate,
        maintenancePercent: parseFloat(document.getElementById('rancho-maintenance-percent').value) || defaults.maintenancePercent,
        propertyManagementPercent: parseFloat(document.getElementById('rancho-management-percent').value) || defaults.propertyManagementPercent,
        vacancyRate: parseFloat(document.getElementById('rancho-vacancy-rate').value) || 0,
        incomeTaxRate: parseFloat(document.getElementById('rancho-income-tax-rate').value) || defaults.incomeTaxRate,
        highIncomeTaxRate: parseFloat(document.getElementById('rancho-high-income-tax-rate').value) || defaults.highIncomeTaxRate,
        appreciationRate: parseFloat(document.getElementById('rancho-appreciation-rate').value) || defaults.appreciationRate
      };
      chrome.storage.sync.set({ assumptions }, () => {
        showSidebarStatus('rancho-assumptions-status', 'success', '✅ Parameters saved');
      });
    });

    // Reset assumptions
    document.getElementById('rancho-reset-assumptions').addEventListener('click', () => {
      const defaults = getDefaultAssumptions();
      document.getElementById('rancho-down-payment').value = defaults.downPaymentPercent;
      document.getElementById('rancho-interest-rate').value = defaults.interestRate;
      document.getElementById('rancho-loan-term').value = defaults.loanTermYears;
      document.getElementById('rancho-pmi-rate').value = defaults.mortgageInsuranceRate;
      document.getElementById('rancho-property-tax').value = defaults.propertyTaxRate;
      document.getElementById('rancho-insurance-rate').value = defaults.insuranceRate;
      document.getElementById('rancho-maintenance-percent').value = defaults.maintenancePercent;
      document.getElementById('rancho-management-percent').value = defaults.propertyManagementPercent;
      document.getElementById('rancho-vacancy-rate').value = defaults.vacancyRate;
      document.getElementById('rancho-income-tax-rate').value = defaults.incomeTaxRate;
      document.getElementById('rancho-high-income-tax-rate').value = defaults.highIncomeTaxRate;
      document.getElementById('rancho-appreciation-rate').value = defaults.appreciationRate;
      chrome.storage.sync.set({ assumptions: defaults }, () => {
        showSidebarStatus('rancho-assumptions-status', 'success', '✅ Reset to defaults');
      });
    });
  }

  // Load settings into sidebar
  function loadSidebarSettings() {
    chrome.storage.sync.get(['notionToken', 'notionDatabaseId', 'gSheetsUrl', 'assumptions'], (result) => {
      if (result.gSheetsUrl) {
        document.getElementById('rancho-gsheets-url').value = result.gSheetsUrl;
      }
      if (result.notionToken) {
        document.getElementById('rancho-notion-token').value = result.notionToken;
      }
      if (result.notionDatabaseId) {
        document.getElementById('rancho-notion-database').value = result.notionDatabaseId;
      }

      const defaults = getDefaultAssumptions();
      const assumptions = { ...defaults, ...(result.assumptions || {}) };

      document.getElementById('rancho-down-payment').value = assumptions.downPaymentPercent;
      document.getElementById('rancho-interest-rate').value = assumptions.interestRate;
      document.getElementById('rancho-loan-term').value = assumptions.loanTermYears;
      document.getElementById('rancho-pmi-rate').value = assumptions.mortgageInsuranceRate;
      document.getElementById('rancho-property-tax').value = assumptions.propertyTaxRate;
      document.getElementById('rancho-insurance-rate').value = assumptions.insuranceRate;
      document.getElementById('rancho-maintenance-percent').value = assumptions.maintenancePercent;
      document.getElementById('rancho-management-percent').value = assumptions.propertyManagementPercent;
      document.getElementById('rancho-vacancy-rate').value = assumptions.vacancyRate;
      document.getElementById('rancho-income-tax-rate').value = assumptions.incomeTaxRate;
      document.getElementById('rancho-high-income-tax-rate').value = assumptions.highIncomeTaxRate;
      document.getElementById('rancho-appreciation-rate').value = assumptions.appreciationRate;
    });
  }

  // Show status message in sidebar
  function showSidebarStatus(elementId, type, message) {
    const statusEl = document.getElementById(elementId);
    statusEl.className = 'rancho-sidebar-status ' + type;
    statusEl.textContent = message;
    setTimeout(() => {
      statusEl.className = 'rancho-sidebar-status';
    }, 3000);
  }

  // Create Rancho button - fixed at bottom right
  function createRanchoButton() {
    if (!isPropertyDetailPage()) {
      const existingBtn = document.getElementById('rancho-btn');
      if (existingBtn) existingBtn.remove();
      return;
    }

    const existingBtn = document.getElementById('rancho-btn');
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'rancho-btn';
    btn.innerHTML = '🏠 Rancho';
    btn.title = 'Analyze property cashflow';
    document.body.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      analyzeProperty();
    });

    // Also create the settings sidebar
    createSettingsSidebar();
  }

  // Scrape property data from page
  function scrapePropertyData() {
    const data = {
      url: window.location.href,
      address: '',
      price: 0,
      bedrooms: 0,
      bathrooms: 0,
      sqft: 0,
      yearBuilt: 0,
      zestimateRent: 0,
      hoaFee: 0,
      propertyTax: 0,
      insurance: 0
    };

    try {
      // 1. Get Address from DOM (h1 element)
      const addressEl = document.querySelector('h1');
      if (addressEl) {
        data.address = addressEl.textContent.trim();
      }

      // 2. Get Price from DOM
      const priceEl = document.querySelector('[data-testid="price"]');
      if (priceEl) {
        const priceText = priceEl.textContent.replace(/[^0-9]/g, '');
        data.price = parseInt(priceText) || 0;
      }

      // 3. Get beds/baths/sqft - try multiple approaches

      // Approach A: Look for data-testid attributes (most reliable)
      const bedsEl = document.querySelector('[data-testid="bed-bath-item"]:first-of-type strong, [data-testid="beds"] strong');
      const bathsEl = document.querySelector('[data-testid="bed-bath-item"]:nth-of-type(2) strong, [data-testid="baths"] strong');
      const sqftEl = document.querySelector('[data-testid="bed-bath-item"]:nth-of-type(3) strong, [data-testid="sqft"] strong');

      if (bedsEl) data.bedrooms = parseInt(bedsEl.textContent) || 0;
      if (bathsEl) data.bathrooms = parseFloat(bathsEl.textContent) || 0;
      if (sqftEl) data.sqft = parseInt(sqftEl.textContent.replace(/,/g, '')) || 0;

      // Approach B: Search entire page text for patterns
      const pageText = document.body.innerText;

      // Search for HOA in page text (e.g., "$230/mo HOA" or "HOA fee: $230")
      if (!data.hoaFee) {
        const hoaMatch = pageText.match(/\$\s*([\d,]+)\s*\/?\s*mo(?:nth)?\s*HOA/i) ||
                         pageText.match(/HOA\s*(?:fee)?:?\s*\$\s*([\d,]+)/i);
        if (hoaMatch) {
          data.hoaFee = parseInt(hoaMatch[1].replace(/,/g, '')) || 0;
        }
      }

      if (!data.bedrooms || !data.bathrooms || !data.sqft) {

        // Match patterns like "4 beds", "2 baths", "1,194 sqft"
        if (!data.bedrooms) {
          const bedsMatch = pageText.match(/(\d+)\s*beds?\b/i);
          if (bedsMatch) data.bedrooms = parseInt(bedsMatch[1]);
        }

        if (!data.bathrooms) {
          // First try to find detailed "X full bath + X half bath" pattern
          const detailedBathMatch = pageText.match(/(\d+)\s*full\s*baths?\s*\+\s*(\d+)\s*half\s*baths?/i);
          if (detailedBathMatch) {
            const fullBaths = parseInt(detailedBathMatch[1]) || 0;
            const halfBaths = parseInt(detailedBathMatch[2]) || 0;
            data.bathrooms = fullBaths + (halfBaths * 0.5);
          } else {
            const bathsMatch = pageText.match(/([\d.]+)\s*baths?\b/i);
            if (bathsMatch) data.bathrooms = parseFloat(bathsMatch[1]);
          }
        }

        if (!data.sqft) {
          const sqftMatch = pageText.match(/([\d,]+)\s*sq\s*ft\b/i);
          if (sqftMatch) data.sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
        }
      }

      // Approach C: Find labeled elements by traversing DOM
      if (!data.bedrooms || !data.bathrooms || !data.sqft) {
        const allSpans = document.querySelectorAll('span');

        allSpans.forEach(span => {
          const text = span.textContent.trim().toLowerCase();
          const parent = span.parentElement;
          if (!parent) return;

          // Look for label elements and get number from sibling
          if ((text === 'beds' || text === 'bed') && !data.bedrooms) {
            // Check previous sibling element for the number
            const prevSibling = span.previousElementSibling;
            if (prevSibling) {
              const num = parseInt(prevSibling.textContent);
              if (!isNaN(num) && num > 0 && num < 20) data.bedrooms = num;
            }
            // Also try parent's first child if different from current span
            const firstChild = parent.firstElementChild;
            if (firstChild && firstChild !== span && !data.bedrooms) {
              const num = parseInt(firstChild.textContent);
              if (!isNaN(num) && num > 0 && num < 20) data.bedrooms = num;
            }
          }

          if ((text === 'baths' || text === 'bath') && !data.bathrooms) {
            const prevSibling = span.previousElementSibling;
            if (prevSibling) {
              const num = parseFloat(prevSibling.textContent);
              if (!isNaN(num) && num > 0 && num < 20) data.bathrooms = num;
            }
            const firstChild = parent.firstElementChild;
            if (firstChild && firstChild !== span && !data.bathrooms) {
              const num = parseFloat(firstChild.textContent);
              if (!isNaN(num) && num > 0 && num < 20) data.bathrooms = num;
            }
          }

          if ((text === 'sqft' || text === 'sq ft' || text === 'square feet') && !data.sqft) {
            const prevSibling = span.previousElementSibling;
            if (prevSibling) {
              const num = parseInt(prevSibling.textContent.replace(/,/g, ''));
              if (!isNaN(num) && num > 100) data.sqft = num;
            }
            const firstChild = parent.firstElementChild;
            if (firstChild && firstChild !== span && !data.sqft) {
              const num = parseInt(firstChild.textContent.replace(/,/g, ''));
              if (!isNaN(num) && num > 100) data.sqft = num;
            }
          }
        });
      }

      // 4. Always check __NEXT_DATA__ for accurate data (especially half baths)
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        try {
          const nextData = JSON.parse(nextDataEl.textContent);
          const gdpCache = nextData?.props?.pageProps?.gdpClientCache ||
                          nextData?.props?.pageProps?.componentProps?.gdpClientCache;

          if (gdpCache) {
            for (const key of Object.keys(gdpCache)) {
              const entry = gdpCache[key];
              if (entry?.property) {
                const prop = entry.property;

                // Fill in missing data
                if (!data.bedrooms) data.bedrooms = prop.bedrooms || 0;
                if (!data.bathrooms) data.bathrooms = prop.bathrooms || 0;
                if (!data.sqft) data.sqft = prop.livingArea || 0;
                data.yearBuilt = prop.yearBuilt || 0;
                data.zestimateRent = prop.rentZestimate || 0;
                data.hoaFee = prop.monthlyHoaFee || 0;

                if (prop.taxAnnualAmount) {
                  data.propertyTax = prop.taxAnnualAmount / 12;
                }

                // Check resoFacts for additional data
                if (prop.resoFacts) {
                  // Accurate bathroom count (full + half)
                  const fullBaths = prop.resoFacts.bathroomsFull || 0;
                  const halfBaths = prop.resoFacts.bathroomsHalf || 0;
                  if (fullBaths || halfBaths) {
                    data.bathrooms = fullBaths + (halfBaths * 0.5);
                  }

                  // HOA fee from resoFacts (if not found in monthlyHoaFee)
                  if (!data.hoaFee && prop.resoFacts.associationFee) {
                    data.hoaFee = prop.resoFacts.associationFee;
                  }
                }

                // Also check other possible HOA field locations
                if (!data.hoaFee) {
                  data.hoaFee = prop.hoaFee || prop.associationFee || prop.hdpData?.homeInfo?.monthlyHoaFee || 0;
                }

                break;
              }
            }
          }
        } catch (e) {
          console.log('Rancho: Could not parse __NEXT_DATA__', e);
        }
      }

      console.log('Rancho: Scraped data', data);

    } catch (error) {
      console.error('Rancho: Error scraping data', error);
    }

    return data;
  }

  // Analyze property
  function analyzeProperty() {
    if (!isPropertyDetailPage()) {
      showResultModal({ error: 'Please navigate to a property detail page.' });
      return;
    }

    const propertyData = scrapePropertyData();

    if (!propertyData.price || propertyData.price === 0) {
      showResultModal({ error: 'Could not find property price. Please refresh and try again.' });
      return;
    }

    chrome.runtime.sendMessage({
      action: 'analyzeProperty',
      data: propertyData
    }, response => {
      if (chrome.runtime.lastError) {
        showResultModal({ error: 'Extension error. Please refresh the page.' });
        return;
      }
      if (response && response.success) {
        showResultModal(response.result);
      } else {
        showResultModal({ error: response?.error || 'Analysis failed.' });
      }
    });
  }

  // Show result modal
  function showResultModal(result) {
    const existingModal = document.getElementById('rancho-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'rancho-modal';

    if (result.error) {
      modal.innerHTML = `
        <div class="rancho-modal-content">
          <span class="rancho-close">&times;</span>
          <h2>❌ Error</h2>
          <p>${result.error}</p>
        </div>
      `;
    } else {
      const cashflow10Class = result.monthlyCashflow10 >= 0 ? 'positive' : 'negative';
      const cashflow30Class = result.monthlyCashflow30 >= 0 ? 'positive' : 'negative';
      modal.innerHTML = `
        <div class="rancho-modal-content rancho-expanded">
          <span class="rancho-close">&times;</span>
          <h2>🏠 Rancho Cashflow Analysis</h2>

          <div class="rancho-grid">
            <div class="rancho-section">
              <h3>📍 Property Info</h3>
              <p><strong>Address:</strong> ${result.address || 'N/A'}</p>
              <p><strong>Type:</strong> ${result.propertyType || 'Single Family'}</p>
              <p><strong>Layout:</strong> ${result.bedrooms || 0} bed ${result.bathrooms || 0} bath</p>
              <p><strong>Size:</strong> ${result.sqft?.toLocaleString() || 0} sqft</p>
              <p><strong>Year Built:</strong> ${result.yearBuilt || 'N/A'}</p>
            </div>

            <div class="rancho-section">
              <h3>💵 Purchase & Loan</h3>
              <p><strong>Price:</strong>
                <span class="highlight-pink">$</span><input type="number" id="rancho-price-input" value="${result.price || 0}" style="width: 100px; font-size: 14px; font-weight: 600; color: #D4A373; border: 1px solid #ccc; border-radius: 4px; padding: 2px 6px;">
              </p>
              <p><strong>Down Payment:</strong> <span id="rancho-dp-display">${result.downPaymentPercent}% ($${result.downPayment?.toLocaleString()})</span></p>
              <p><strong>Loan Amount:</strong> $<span id="rancho-loan-display">${result.loanAmount?.toLocaleString()}</span></p>
              <p><strong>LTV:</strong> <span id="rancho-ltv-display">${result.ltv}</span>%</p>
              <p><strong>Rate:</strong> ${result.assumptions?.interestRate}% / ${result.assumptions?.loanTermYears}yr</p>
              <small style="color: #666; font-size: 11px;">💡 Edit price and click Recalc below to update calculations.</small>
            </div>
          </div>

          <div class="rancho-section">
            <h3>🏠 Monthly Rent Income</h3>
            <div class="rancho-row" style="align-items: center;">
              <p><strong>Monthly Rent:</strong>
                <span class="highlight-pink">$</span><input type="number" id="rancho-rent-input" value="${result.monthlyRent || 0}" style="width: 80px; font-size: 14px; font-weight: 600; color: #D4A373; border: 1px solid #ccc; border-radius: 4px; padding: 2px 6px;">
                <button id="rancho-recalc" style="margin-left: 8px; padding: 4px 10px; font-size: 12px; background: linear-gradient(135deg, #CCD5AE 0%, #D4A373 100%); color: #FEFAE0; border: none; border-radius: 4px; cursor: pointer;">🔄 Recalc</button>
              </p>
              <p><strong>Rent/sqft:</strong> $<span id="rancho-rent-sqft" style="color: #CCD5AE; font-weight: 600;">${result.rentPerSqft}</span>/sqft</p>
              <p><strong>Appreciation:</strong> ${result.appreciationRate}%/yr</p>
            </div>
            <small style="color: #666; font-size: 11px;">💡 Default from Zillow Rent Zestimate. Edit and click Recalc to update.</small>
          </div>

          <div class="rancho-section">
            <h3>📤 Monthly Expenses</h3>
            <table class="rancho-table">
              <tr><td>Mortgage (P&I)</td><td class="num">$${result.monthlyMortgage?.toLocaleString()}</td></tr>
              <tr><td>Property Tax</td><td class="num">$${result.monthlyTax?.toLocaleString()}</td></tr>
              <tr><td>Insurance</td><td class="num">$${result.monthlyInsurance?.toLocaleString()}</td></tr>
              <tr><td>Maintenance (${result.assumptions?.maintenancePercent}% rent)</td><td class="num">$${result.monthlyMaintenance?.toLocaleString()}</td></tr>
              <tr><td>Property Mgmt (${result.assumptions?.propertyManagementPercent}% rent)</td><td class="num">$${result.monthlyManagement?.toLocaleString()}</td></tr>
              <tr><td>HOA</td><td class="num">$${result.monthlyHoa?.toLocaleString()}</td></tr>
              <tr><td>PMI (LTV>${80}%)</td><td class="num">$${result.monthlyPMI?.toLocaleString()}</td></tr>
              <tr class="total"><td><strong>Total Expenses</strong></td><td class="num"><strong>$${result.totalMonthlyExpenses?.toLocaleString()}</strong></td></tr>
            </table>
          </div>

          <div class="rancho-section rancho-result">
            <h3>📊 Cashflow Analysis</h3>
            <table class="rancho-table">
              <tr><td>Pre-Tax Cashflow</td><td class="num">$${result.preTaxCashflow?.toLocaleString()}/mo</td></tr>
              <tr><td>Income Tax @10%</td><td class="num">-$${result.monthlyIncomeTax10?.toLocaleString()}</td></tr>
              <tr class="highlight ${cashflow10Class}"><td><strong>Cashflow @10% Tax</strong></td><td class="num"><strong>$${result.monthlyCashflow10?.toLocaleString()}/mo</strong></td></tr>
              <tr><td>Income Tax @30%</td><td class="num">-$${result.monthlyIncomeTax30?.toLocaleString()}</td></tr>
              <tr class="highlight ${cashflow30Class}"><td><strong>Cashflow @30% Tax</strong></td><td class="num"><strong>$${result.monthlyCashflow30?.toLocaleString()}/mo</strong></td></tr>
            </table>
          </div>

          <div class="rancho-section">
            <h3>📈 Returns (Annual)</h3>
            <table class="rancho-table">
              <tr><td>Annual Cashflow @10%</td><td class="num">$${result.annualCashflow10?.toLocaleString()}</td></tr>
              <tr><td>Annual Cashflow @30%</td><td class="num">$${result.annualCashflow30?.toLocaleString()}</td></tr>
              <tr><td>Annual Appreciation</td><td class="num">$${result.annualAppreciation?.toLocaleString()}</td></tr>
              <tr class="divider"><td colspan="2"></td></tr>
              <tr><td><strong>Cashflow APY @10%</strong></td><td class="num highlight-blue">${result.cashflowAPY10?.toFixed(2)}%</td></tr>
              <tr><td><strong>Cashflow APY @30%</strong></td><td class="num">${result.cashflowAPY30?.toFixed(2)}%</td></tr>
              <tr><td><strong>5-Year APY @10%</strong></td><td class="num highlight-blue">${result.fiveYearAPY10?.toFixed(2)}%</td></tr>
              <tr><td><strong>5-Year APY @30%</strong></td><td class="num">${result.fiveYearAPY30?.toFixed(2)}%</td></tr>
              <tr><td>Cap Rate</td><td class="num">${result.capRate?.toFixed(2)}%</td></tr>
            </table>
          </div>

          <div class="rancho-section rancho-assumptions">
            <h3>⚙️ Assumptions</h3>
            <p>DP: ${result.assumptions?.downPaymentPercent}% | Rate: ${result.assumptions?.interestRate}% | Tax: ${result.assumptions?.propertyTaxRate}% | Ins: ${result.assumptions?.insuranceRate}% | Maint: ${result.assumptions?.maintenancePercent}% | Mgmt: ${result.assumptions?.propertyManagementPercent}% | PMI: ${result.assumptions?.mortgageInsuranceRate}%</p>
          </div>

          <div class="rancho-actions">
            <button id="rancho-add-to-sheets" class="rancho-btn-primary">📊 Add to Sheets</button>
            <button id="rancho-add-to-excel" class="rancho-btn-secondary">📝 Add to Notion</button>
            <button id="rancho-copy" class="rancho-btn-secondary">📋 Copy</button>
          </div>
        </div>
      `;
    }

    document.body.appendChild(modal);

    // Close button
    modal.querySelector('.rancho-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Add to Google Sheets button
    const addSheetsBtn = modal.querySelector('#rancho-add-to-sheets');
    if (addSheetsBtn) {
      addSheetsBtn.addEventListener('click', () => {
        addSheetsBtn.textContent = '⏳...';
        chrome.runtime.sendMessage({
          action: 'addToGoogleSheets',
          data: result
        }, response => {
          if (chrome.runtime.lastError) {
            alert('Extension error. Please refresh.');
            addSheetsBtn.textContent = '📊 Add to Sheets';
            return;
          }
          if (response && response.success) {
            addSheetsBtn.textContent = '✅ Added!';
            addSheetsBtn.disabled = true;
          } else {
            alert('Failed: ' + (response?.error || 'Please configure Google Sheets URL in extension settings'));
            addSheetsBtn.textContent = '📊 Add to Sheets';
          }
        });
      });
    }

    // Add to Notion button
    const addBtn = modal.querySelector('#rancho-add-to-excel');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addBtn.textContent = '⏳...';
        chrome.runtime.sendMessage({
          action: 'addToExcel',
          data: result
        }, response => {
          if (chrome.runtime.lastError) {
            alert('Extension error. Please refresh.');
            addBtn.textContent = '📝 Add to Notion';
            return;
          }
          if (response && response.success) {
            addBtn.textContent = '✅ Added!';
            addBtn.disabled = true;
          } else {
            alert('Failed: ' + (response?.error || 'Please configure Notion in extension settings'));
            addBtn.textContent = '📝 Add to Notion';
          }
        });
      });
    }

    // Copy button
    const copyBtn = modal.querySelector('#rancho-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const currentRent = document.getElementById('rancho-rent-input')?.value || result.monthlyRent;
        const text = `Property: ${result.address}
Price: $${result.price?.toLocaleString()}
${result.bedrooms} bed ${result.bathrooms} bath ${result.sqft?.toLocaleString()} sqft
Monthly Rent: $${parseInt(currentRent)?.toLocaleString()}
Cashflow @10%: $${result.monthlyCashflow10?.toLocaleString()}/mo
Cashflow @30%: $${result.monthlyCashflow30?.toLocaleString()}/mo
Cashflow APY @10%: ${result.cashflowAPY10?.toFixed(2)}%
5-Year APY @10%: ${result.fiveYearAPY10?.toFixed(2)}%
Cap Rate: ${result.capRate?.toFixed(2)}%`;
        navigator.clipboard.writeText(text);
        copyBtn.textContent = '✅ Copied!';
      });
    }

    // Recalculate button - recalculate with custom rent and price
    const recalcBtn = modal.querySelector('#rancho-recalc');
    if (recalcBtn) {
      recalcBtn.addEventListener('click', () => {
        const newRent = parseInt(document.getElementById('rancho-rent-input').value) || 0;
        const newPrice = parseInt(document.getElementById('rancho-price-input').value) || result.price;
        recalcBtn.textContent = '⏳...';

        // Create modified property data with custom rent and price
        const modifiedData = {
          ...result,
          zestimateRent: newRent,
          // Pass property info for recalculation (price may be modified)
          price: newPrice,
          bedrooms: result.bedrooms,
          bathrooms: result.bathrooms,
          sqft: result.sqft,
          hoaFee: result.monthlyHoa,
          propertyTax: result.monthlyTax,
          insurance: result.monthlyInsurance
        };

        chrome.runtime.sendMessage({
          action: 'analyzeProperty',
          data: modifiedData
        }, response => {
          if (response && response.success) {
            // Update the modal with new results
            const newResult = response.result;
            result.price = newResult.price;
            result.downPayment = newResult.downPayment;
            result.loanAmount = newResult.loanAmount;
            result.ltv = newResult.ltv;
            result.monthlyRent = newResult.monthlyRent;
            result.monthlyMortgage = newResult.monthlyMortgage;
            result.monthlyTax = newResult.monthlyTax;
            result.monthlyInsurance = newResult.monthlyInsurance;
            result.monthlyPMI = newResult.monthlyPMI;
            result.monthlyCashflow10 = newResult.monthlyCashflow10;
            result.monthlyCashflow30 = newResult.monthlyCashflow30;
            result.cashflowAPY10 = newResult.cashflowAPY10;
            result.cashflowAPY30 = newResult.cashflowAPY30;
            result.fiveYearAPY10 = newResult.fiveYearAPY10;
            result.fiveYearAPY30 = newResult.fiveYearAPY30;
            result.capRate = newResult.capRate;
            result.rentPerSqft = newResult.rentPerSqft;
            result.monthlyMaintenance = newResult.monthlyMaintenance;
            result.monthlyManagement = newResult.monthlyManagement;
            result.totalMonthlyExpenses = newResult.totalMonthlyExpenses;
            result.preTaxCashflow = newResult.preTaxCashflow;
            result.annualCashflow10 = newResult.annualCashflow10;
            result.annualCashflow30 = newResult.annualCashflow30;
            result.annualAppreciation = newResult.annualAppreciation;
            result.annualNOI = newResult.annualNOI;

            // Close and reopen modal with new data
            modal.remove();
            showResultModal(result);
          } else {
            recalcBtn.textContent = '🔄 Recalc';
            alert('Recalculation failed');
          }
        });
      });
    }
  }

  // Initialize
  function init() {
    if (isPropertyDetailPage()) {
      createRanchoButton();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Watch for URL changes (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => {
        if (isPropertyDetailPage()) {
          createRanchoButton();
        } else {
          const existingBtn = document.getElementById('rancho-btn');
          if (existingBtn) existingBtn.remove();
        }
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  // Ensure button exists on detail pages
  setInterval(() => {
    if (isPropertyDetailPage() && !document.getElementById('rancho-btn')) {
      createRanchoButton();
    } else if (!isPropertyDetailPage()) {
      const existingBtn = document.getElementById('rancho-btn');
      if (existingBtn) existingBtn.remove();
    }
  }, 2000);

})();
