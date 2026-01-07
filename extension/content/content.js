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

  // Generate settings panel HTML
  function getSettingsPanelHTML(result) {
    const price = result?.price || 0;
    const rent = result?.monthlyRent || 0;
    return `
      <div class="rancho-settings-panel">
        <div class="rancho-settings-header">
          <h2>⚙️ Settings</h2>
        </div>

        <div class="rancho-settings-tabs">
          <button class="rancho-settings-tab" data-tab="settings">Settings</button>
          <button class="rancho-settings-tab active" data-tab="params">Parameters</button>
          <button class="rancho-settings-tab" data-tab="help">Help</button>
        </div>

        <!-- Settings Tab -->
        <div class="rancho-settings-tab-content" id="rancho-panel-settings">
          <div class="rancho-panel-section">
            <h3>📊 Google Sheets</h3>
            <div class="rancho-panel-form-group">
              <label>Apps Script URL</label>
              <input type="text" id="rancho-panel-gsheets-url" placeholder="https://script.google.com/...">
            </div>
            <button id="rancho-panel-save-gsheets" class="rancho-panel-btn-primary">💾 Save</button>
            <button id="rancho-panel-test-gsheets" class="rancho-panel-btn-secondary">🔗 Test</button>
            <div id="rancho-panel-gsheets-status" class="rancho-panel-status"></div>
          </div>

          <div class="rancho-panel-section">
            <h3>📝 Notion (Optional)</h3>
            <div class="rancho-panel-form-group">
              <label>API Token</label>
              <input type="password" id="rancho-panel-notion-token" placeholder="ntn_xxxx...">
            </div>
            <div class="rancho-panel-form-group">
              <label>Database ID</label>
              <input type="text" id="rancho-panel-notion-database" placeholder="xxxxxxxx-xxxx-...">
            </div>
            <button id="rancho-panel-save-notion" class="rancho-panel-btn-primary">💾 Save</button>
            <button id="rancho-panel-test-notion" class="rancho-panel-btn-secondary">🔗 Test</button>
            <div id="rancho-panel-notion-status" class="rancho-panel-status"></div>
          </div>
        </div>

        <!-- Parameters Tab -->
        <div class="rancho-settings-tab-content active" id="rancho-panel-params">
          <div class="rancho-panel-section">
            <h3>🏷️ Property</h3>
            <div class="rancho-panel-form-group">
              <label>Price ($)</label>
              <input type="number" id="rancho-panel-price" value="${price}" step="1000">
            </div>
            <div class="rancho-panel-form-group">
              <label>Monthly Rent ($)</label>
              <input type="number" id="rancho-panel-rent" value="${rent}" step="50">
            </div>
          </div>

          <div class="rancho-panel-section">
            <h3>💰 Loan</h3>
            <div class="rancho-panel-form-row">
              <div class="rancho-panel-form-group">
                <label>Down Payment (%)</label>
                <input type="number" id="rancho-panel-down-payment" value="3.5" step="0.5">
              </div>
              <div class="rancho-panel-form-group">
                <label>Interest Rate (%)</label>
                <input type="number" id="rancho-panel-interest-rate" value="6.0" step="0.125">
              </div>
            </div>
            <div class="rancho-panel-form-row">
              <div class="rancho-panel-form-group">
                <label>Loan Term (yrs)</label>
                <input type="number" id="rancho-panel-loan-term" value="30">
              </div>
              <div class="rancho-panel-form-group">
                <label>PMI Rate (%)</label>
                <input type="number" id="rancho-panel-pmi-rate" value="0.75" step="0.05">
              </div>
            </div>
          </div>

          <div class="rancho-panel-section">
            <h3>🏦 Expenses</h3>
            <div class="rancho-panel-form-row">
              <div class="rancho-panel-form-group">
                <label>Tax Rate (%/yr)</label>
                <input type="number" id="rancho-panel-property-tax" value="2.5" step="0.1">
              </div>
              <div class="rancho-panel-form-group">
                <label>Insurance (%/yr)</label>
                <input type="number" id="rancho-panel-insurance-rate" value="0.3" step="0.05">
              </div>
            </div>
            <div class="rancho-panel-form-row">
              <div class="rancho-panel-form-group">
                <label>Maintenance (%)</label>
                <input type="number" id="rancho-panel-maintenance-percent" value="5">
              </div>
              <div class="rancho-panel-form-group">
                <label>Mgmt (%)</label>
                <input type="number" id="rancho-panel-management-percent" value="10">
              </div>
            </div>
            <div class="rancho-panel-form-group">
              <label>Vacancy Rate (%)</label>
              <input type="number" id="rancho-panel-vacancy-rate" value="0" style="width: 80px;">
            </div>
          </div>

          <div class="rancho-panel-section">
            <h3>📈 Tax & Returns</h3>
            <div class="rancho-panel-form-row">
              <div class="rancho-panel-form-group">
                <label>Tax @Low (%)</label>
                <input type="number" id="rancho-panel-income-tax-rate" value="10">
              </div>
              <div class="rancho-panel-form-group">
                <label>Tax @High (%)</label>
                <input type="number" id="rancho-panel-high-income-tax-rate" value="30">
              </div>
            </div>
            <div class="rancho-panel-form-group">
              <label>Appreciation (%/yr)</label>
              <input type="number" id="rancho-panel-appreciation-rate" value="3" step="0.5" style="width: 80px;">
            </div>
          </div>

          <button id="rancho-panel-save-params" class="rancho-panel-btn-primary">💾 Save Parameters</button>
          <button id="rancho-panel-reset-params" class="rancho-panel-btn-secondary">🔄 Reset</button>
          <div id="rancho-panel-params-status" class="rancho-panel-status"></div>
        </div>

        <!-- Help Tab -->
        <div class="rancho-settings-tab-content" id="rancho-panel-help">
          <div class="rancho-panel-section">
            <h3>📖 How to Use</h3>
            <ol>
              <li>Open a Zillow property page</li>
              <li>Click "🏠 Rancho" button</li>
              <li>View cashflow analysis</li>
              <li>Save to Sheets or Notion</li>
            </ol>
          </div>
          <div class="rancho-panel-section">
            <h3>📊 Formulas</h3>
            <p><strong>PMI</strong> = IF LTV>80%</p>
            <p><strong>Cashflow</strong> = Rent - Expenses</p>
            <p><strong>APY</strong> = Cashflow / Down</p>
          </div>
        </div>

        <div class="rancho-settings-footer">
          <p>v1.3.0</p>
        </div>
      </div>
    `;
  }

  // Setup settings panel events
  function setupSettingsPanelEvents(modal, currentResult) {
    // Tab switching
    const tabs = modal.querySelectorAll('.rancho-settings-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.rancho-settings-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector('#rancho-panel-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Helper function to recalculate and refresh
    function recalculateAndRefresh() {
      const newPrice = parseInt(modal.querySelector('#rancho-panel-price').value) || currentResult.price;
      const newRent = parseInt(modal.querySelector('#rancho-panel-rent').value) || currentResult.monthlyRent;

      const modifiedData = {
        ...currentResult,
        zestimateRent: newRent,
        price: newPrice,
        bedrooms: currentResult.bedrooms,
        bathrooms: currentResult.bathrooms,
        sqft: currentResult.sqft,
        hoaFee: currentResult.monthlyHoa,
        propertyTax: currentResult.monthlyTax,
        insurance: currentResult.monthlyInsurance
      };

      chrome.runtime.sendMessage({
        action: 'analyzeProperty',
        data: modifiedData
      }, response => {
        if (response && response.success) {
          modal.remove();
          showResultModal(response.result);
        }
      });
    }

    // Load settings
    chrome.storage.sync.get(['notionToken', 'notionDatabaseId', 'gSheetsUrl', 'assumptions'], (result) => {
      if (result.gSheetsUrl) {
        modal.querySelector('#rancho-panel-gsheets-url').value = result.gSheetsUrl;
      }
      if (result.notionToken) {
        modal.querySelector('#rancho-panel-notion-token').value = result.notionToken;
      }
      if (result.notionDatabaseId) {
        modal.querySelector('#rancho-panel-notion-database').value = result.notionDatabaseId;
      }

      const defaults = getDefaultAssumptions();
      const assumptions = { ...defaults, ...(result.assumptions || {}) };

      modal.querySelector('#rancho-panel-down-payment').value = assumptions.downPaymentPercent;
      modal.querySelector('#rancho-panel-interest-rate').value = assumptions.interestRate;
      modal.querySelector('#rancho-panel-loan-term').value = assumptions.loanTermYears;
      modal.querySelector('#rancho-panel-pmi-rate').value = assumptions.mortgageInsuranceRate;
      modal.querySelector('#rancho-panel-property-tax').value = assumptions.propertyTaxRate;
      modal.querySelector('#rancho-panel-insurance-rate').value = assumptions.insuranceRate;
      modal.querySelector('#rancho-panel-maintenance-percent').value = assumptions.maintenancePercent;
      modal.querySelector('#rancho-panel-management-percent').value = assumptions.propertyManagementPercent;
      modal.querySelector('#rancho-panel-vacancy-rate').value = assumptions.vacancyRate;
      modal.querySelector('#rancho-panel-income-tax-rate').value = assumptions.incomeTaxRate;
      modal.querySelector('#rancho-panel-high-income-tax-rate').value = assumptions.highIncomeTaxRate;
      modal.querySelector('#rancho-panel-appreciation-rate').value = assumptions.appreciationRate;
    });

    // Save Google Sheets
    modal.querySelector('#rancho-panel-save-gsheets').addEventListener('click', () => {
      const url = modal.querySelector('#rancho-panel-gsheets-url').value.trim();
      if (!url || !url.startsWith('https://script.google.com/')) {
        showPanelStatus(modal, 'rancho-panel-gsheets-status', 'error', 'Invalid URL');
        return;
      }
      chrome.storage.sync.set({ gSheetsUrl: url }, () => {
        showPanelStatus(modal, 'rancho-panel-gsheets-status', 'success', '✅ Saved');
      });
    });

    // Test Google Sheets
    modal.querySelector('#rancho-panel-test-gsheets').addEventListener('click', () => {
      const url = modal.querySelector('#rancho-panel-gsheets-url').value.trim();
      if (!url) {
        showPanelStatus(modal, 'rancho-panel-gsheets-status', 'error', 'Enter URL first');
        return;
      }
      showPanelStatus(modal, 'rancho-panel-gsheets-status', 'info', '🔄 Testing...');
      chrome.runtime.sendMessage({ action: 'testGSheetsConnection', url: url }, response => {
        if (response && response.success) {
          showPanelStatus(modal, 'rancho-panel-gsheets-status', 'success', '✅ OK!');
        } else {
          showPanelStatus(modal, 'rancho-panel-gsheets-status', 'error', '❌ Failed');
        }
      });
    });

    // Save Notion
    modal.querySelector('#rancho-panel-save-notion').addEventListener('click', () => {
      const token = modal.querySelector('#rancho-panel-notion-token').value.trim();
      const databaseId = modal.querySelector('#rancho-panel-notion-database').value.trim();
      if (!token || !databaseId) {
        showPanelStatus(modal, 'rancho-panel-notion-status', 'error', 'Fill both fields');
        return;
      }
      chrome.storage.sync.set({ notionToken: token, notionDatabaseId: databaseId }, () => {
        showPanelStatus(modal, 'rancho-panel-notion-status', 'success', '✅ Saved');
      });
    });

    // Test Notion
    modal.querySelector('#rancho-panel-test-notion').addEventListener('click', () => {
      const token = modal.querySelector('#rancho-panel-notion-token').value.trim();
      const databaseId = modal.querySelector('#rancho-panel-notion-database').value.trim();
      if (!token || !databaseId) {
        showPanelStatus(modal, 'rancho-panel-notion-status', 'error', 'Fill both fields');
        return;
      }
      showPanelStatus(modal, 'rancho-panel-notion-status', 'info', '🔄 Testing...');
      chrome.runtime.sendMessage({ action: 'testNotionConnection', token: token, databaseId: databaseId }, response => {
        if (response && response.success) {
          showPanelStatus(modal, 'rancho-panel-notion-status', 'success', '✅ OK!');
        } else {
          showPanelStatus(modal, 'rancho-panel-notion-status', 'error', '❌ Failed');
        }
      });
    });

    // Save Parameters and refresh
    modal.querySelector('#rancho-panel-save-params').addEventListener('click', () => {
      const defaults = getDefaultAssumptions();
      const assumptions = {
        downPaymentPercent: parseFloat(modal.querySelector('#rancho-panel-down-payment').value) || defaults.downPaymentPercent,
        interestRate: parseFloat(modal.querySelector('#rancho-panel-interest-rate').value) || defaults.interestRate,
        loanTermYears: parseInt(modal.querySelector('#rancho-panel-loan-term').value) || defaults.loanTermYears,
        mortgageInsuranceRate: parseFloat(modal.querySelector('#rancho-panel-pmi-rate').value) || defaults.mortgageInsuranceRate,
        propertyTaxRate: parseFloat(modal.querySelector('#rancho-panel-property-tax').value) || defaults.propertyTaxRate,
        insuranceRate: parseFloat(modal.querySelector('#rancho-panel-insurance-rate').value) || defaults.insuranceRate,
        maintenancePercent: parseFloat(modal.querySelector('#rancho-panel-maintenance-percent').value) || defaults.maintenancePercent,
        propertyManagementPercent: parseFloat(modal.querySelector('#rancho-panel-management-percent').value) || defaults.propertyManagementPercent,
        vacancyRate: parseFloat(modal.querySelector('#rancho-panel-vacancy-rate').value) || 0,
        incomeTaxRate: parseFloat(modal.querySelector('#rancho-panel-income-tax-rate').value) || defaults.incomeTaxRate,
        highIncomeTaxRate: parseFloat(modal.querySelector('#rancho-panel-high-income-tax-rate').value) || defaults.highIncomeTaxRate,
        appreciationRate: parseFloat(modal.querySelector('#rancho-panel-appreciation-rate').value) || defaults.appreciationRate
      };
      chrome.storage.sync.set({ assumptions }, () => {
        showPanelStatus(modal, 'rancho-panel-params-status', 'success', '✅ Saved & Refreshing...');
        // Recalculate with new parameters
        setTimeout(recalculateAndRefresh, 300);
      });
    });

    // Reset Parameters and refresh
    modal.querySelector('#rancho-panel-reset-params').addEventListener('click', () => {
      const defaults = getDefaultAssumptions();
      modal.querySelector('#rancho-panel-down-payment').value = defaults.downPaymentPercent;
      modal.querySelector('#rancho-panel-interest-rate').value = defaults.interestRate;
      modal.querySelector('#rancho-panel-loan-term').value = defaults.loanTermYears;
      modal.querySelector('#rancho-panel-pmi-rate').value = defaults.mortgageInsuranceRate;
      modal.querySelector('#rancho-panel-property-tax').value = defaults.propertyTaxRate;
      modal.querySelector('#rancho-panel-insurance-rate').value = defaults.insuranceRate;
      modal.querySelector('#rancho-panel-maintenance-percent').value = defaults.maintenancePercent;
      modal.querySelector('#rancho-panel-management-percent').value = defaults.propertyManagementPercent;
      modal.querySelector('#rancho-panel-vacancy-rate').value = defaults.vacancyRate;
      modal.querySelector('#rancho-panel-income-tax-rate').value = defaults.incomeTaxRate;
      modal.querySelector('#rancho-panel-high-income-tax-rate').value = defaults.highIncomeTaxRate;
      modal.querySelector('#rancho-panel-appreciation-rate').value = defaults.appreciationRate;
      chrome.storage.sync.set({ assumptions: defaults }, () => {
        showPanelStatus(modal, 'rancho-panel-params-status', 'success', '✅ Reset & Refreshing...');
        // Recalculate with default parameters
        setTimeout(recalculateAndRefresh, 300);
      });
    });
  }

  // Show status in panel
  function showPanelStatus(modal, elementId, type, message) {
    const statusEl = modal.querySelector('#' + elementId);
    statusEl.className = 'rancho-panel-status ' + type;
    statusEl.textContent = message;
    setTimeout(() => {
      statusEl.className = 'rancho-panel-status';
    }, 3000);
  }

  // Show result modal
  function showResultModal(result) {
    const existingModal = document.getElementById('rancho-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'rancho-modal';

    if (result.error) {
      modal.innerHTML = `
        <div class="rancho-modal-wrapper">
          <div class="rancho-modal-content">
            <span class="rancho-close">&times;</span>
            <h2>❌ Error</h2>
            <p>${result.error}</p>
          </div>
        </div>
      `;
    } else {
      const cashflow10Class = result.monthlyCashflow10 >= 0 ? 'positive' : 'negative';
      const cashflow30Class = result.monthlyCashflow30 >= 0 ? 'positive' : 'negative';
      modal.innerHTML = `
        <div class="rancho-modal-wrapper rancho-dual-panel">
          <!-- Left: Settings Panel -->
          ${getSettingsPanelHTML(result)}

          <!-- Right: Analysis Results -->
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
                <p><strong>Price:</strong> <span class="highlight-pink">$${result.price?.toLocaleString()}</span></p>
                <p><strong>Down Payment:</strong> ${result.downPaymentPercent}% ($${result.downPayment?.toLocaleString()})</p>
                <p><strong>Loan Amount:</strong> $${result.loanAmount?.toLocaleString()}</p>
                <p><strong>LTV:</strong> ${result.ltv}%</p>
                <p><strong>Rate:</strong> ${result.assumptions?.interestRate}% / ${result.assumptions?.loanTermYears}yr</p>
              </div>
            </div>

            <div class="rancho-section">
              <h3>🏠 Monthly Rent Income</h3>
              <div class="rancho-row" style="align-items: center;">
                <p><strong>Monthly Rent:</strong> <span class="highlight-pink">$${result.monthlyRent?.toLocaleString()}</span></p>
                <p><strong>Rent/sqft:</strong> <span style="color: #CCD5AE; font-weight: 600;">$${result.rentPerSqft}</span>/sqft</p>
                <p><strong>Appreciation:</strong> ${result.appreciationRate}%/yr</p>
              </div>
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
        </div>
      `;
    }

    document.body.appendChild(modal);

    // Setup settings panel events (only if not error modal)
    if (!result.error) {
      setupSettingsPanelEvents(modal, result);
    }

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
        const text = `Property: ${result.address}
Price: $${result.price?.toLocaleString()}
${result.bedrooms} bed ${result.bathrooms} bath ${result.sqft?.toLocaleString()} sqft
Monthly Rent: $${result.monthlyRent?.toLocaleString()}
Cashflow @10%: $${result.monthlyCashflow10?.toLocaleString()}/mo
Cashflow @30%: $${result.monthlyCashflow30?.toLocaleString()}/mo
Cashflow APY @10%: ${result.cashflowAPY10?.toFixed(2)}%
5-Year APY @10%: ${result.fiveYearAPY10?.toFixed(2)}%
Cap Rate: ${result.capRate?.toFixed(2)}%`;
        navigator.clipboard.writeText(text);
        copyBtn.textContent = '✅ Copied!';
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
