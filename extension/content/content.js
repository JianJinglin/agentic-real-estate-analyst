// Content Script - Inject into Zillow property detail pages

(function() {
  'use strict';

  // Check if already injected
  if (document.getElementById('rancho-btn')) return;

  // Create Rancho button - fixed at bottom right
  function createRanchoButton() {
    // Remove existing button if any
    const existingBtn = document.getElementById('rancho-btn');
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'rancho-btn';
    btn.innerHTML = '🏠 Rancho';
    btn.title = 'Analyze property cashflow';

    // Append to body with fixed positioning
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
      propertyType: '',
      zestimateRent: 0,
      hoaFee: 0,
      propertyTax: 0,
      insurance: 0
    };

    try {
      // Address
      const addressEl = document.querySelector('[data-testid="bdp-address"]') ||
                        document.querySelector('h1');
      if (addressEl) data.address = addressEl.textContent.trim();

      // Price
      const priceEl = document.querySelector('[data-testid="price"]') ||
                      document.querySelector('span[data-testid="price"]');
      if (priceEl) {
        const priceText = priceEl.textContent.replace(/[^0-9]/g, '');
        data.price = parseInt(priceText) || 0;
      }

      // Beds, baths, sqft
      const summaryItems = document.querySelectorAll('[data-testid="bed-bath-sqft-fact-container"] span');
      summaryItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes('bd')) {
          data.bedrooms = parseInt(text) || 0;
        } else if (text.includes('ba')) {
          data.bathrooms = parseFloat(text) || 0;
        } else if (text.includes('sqft')) {
          data.sqft = parseInt(text.replace(/[^0-9]/g, '')) || 0;
        }
      });

      // Alternative way to get beds/baths/sqft
      if (!data.bedrooms) {
        const bedsEl = document.querySelector('[data-testid="bed-bath-item"]');
        if (bedsEl) {
          const match = bedsEl.textContent.match(/(\d+)\s*bd/i);
          if (match) data.bedrooms = parseInt(match[1]);
        }
      }

      // Try to get data from Next.js __NEXT_DATA__
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        try {
          const nextData = JSON.parse(nextDataEl.textContent);
          const property = nextData?.props?.pageProps?.property ||
                          nextData?.props?.pageProps?.initialReduxState?.gdp?.building;
          if (property) {
            data.price = property.price || data.price;
            data.bedrooms = property.bedrooms || data.bedrooms;
            data.bathrooms = property.bathrooms || data.bathrooms;
            data.sqft = property.livingArea || property.livingAreaValue || data.sqft;
            data.yearBuilt = property.yearBuilt || data.yearBuilt;
            data.zestimateRent = property.rentZestimate || data.zestimateRent;
            data.propertyTax = property.taxAnnualAmount ? property.taxAnnualAmount / 12 : data.propertyTax;
            data.hoaFee = property.monthlyHoaFee || data.hoaFee;
          }
        } catch (e) {
          console.log('Rancho: Failed to parse __NEXT_DATA__');
        }
      }

    } catch (error) {
      console.error('Rancho: Error scraping data', error);
    }

    return data;
  }

  // Analyze property
  function analyzeProperty() {
    const propertyData = scrapePropertyData();

    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'analyzeProperty',
      data: propertyData
    }, response => {
      if (response && response.success) {
        showResultModal(response.result);
      } else {
        showResultModal({ error: 'Analysis failed. Please try again.' });
      }
    });
  }

  // Show result modal
  function showResultModal(result) {
    // Remove existing modal
    const existingModal = document.getElementById('rancho-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'rancho-modal';

    if (result.error) {
      modal.innerHTML = `
        <div class="rancho-modal-content">
          <span class="rancho-close">&times;</span>
          <h2>❌ Analysis Failed</h2>
          <p>${result.error}</p>
        </div>
      `;
    } else {
      const cashflowClass = result.monthlyCashflow >= 0 ? 'positive' : 'negative';
      modal.innerHTML = `
        <div class="rancho-modal-content">
          <span class="rancho-close">&times;</span>
          <h2>🏠 Rancho Cashflow Analysis</h2>

          <div class="rancho-section">
            <h3>📍 Property Info</h3>
            <p><strong>Address:</strong> ${result.address || 'N/A'}</p>
            <p><strong>Price:</strong> $${result.price?.toLocaleString() || 'N/A'}</p>
            <p><strong>Layout:</strong> ${result.bedrooms} bed ${result.bathrooms} bath ${result.sqft?.toLocaleString()} sqft</p>
          </div>

          <div class="rancho-section">
            <h3>💰 Monthly Income & Expenses</h3>
            <p><strong>Estimated Rent:</strong> $${result.monthlyRent?.toLocaleString() || 'N/A'}</p>
            <p><strong>Mortgage (P&I):</strong> -$${result.monthlyMortgage?.toLocaleString() || 'N/A'}</p>
            <p><strong>Property Tax:</strong> -$${result.monthlyTax?.toLocaleString() || 'N/A'}</p>
            <p><strong>Insurance:</strong> -$${result.monthlyInsurance?.toLocaleString() || 'N/A'}</p>
            <p><strong>HOA:</strong> -$${result.monthlyHoa?.toLocaleString() || '0'}</p>
            <p><strong>Maintenance Reserve:</strong> -$${result.monthlyMaintenance?.toLocaleString() || 'N/A'}</p>
            <p><strong>Vacancy Reserve:</strong> -$${result.monthlyVacancy?.toLocaleString() || 'N/A'}</p>
          </div>

          <div class="rancho-section rancho-result">
            <h3>📊 Cashflow Results</h3>
            <p class="cashflow ${cashflowClass}">
              <strong>Monthly Cashflow:</strong> $${result.monthlyCashflow?.toLocaleString() || 'N/A'}
            </p>
            <p><strong>Annual Cashflow:</strong> $${result.annualCashflow?.toLocaleString() || 'N/A'}</p>
            <p><strong>Cash on Cash Return:</strong> ${result.cashOnCashReturn?.toFixed(2) || 'N/A'}%</p>
            <p><strong>Cap Rate:</strong> ${result.capRate?.toFixed(2) || 'N/A'}%</p>
          </div>

          <div class="rancho-section">
            <h3>⚙️ Assumptions</h3>
            <p>Down Payment: ${result.assumptions?.downPaymentPercent}% | Rate: ${result.assumptions?.interestRate}% | Term: ${result.assumptions?.loanTermYears} years</p>
          </div>

          <div class="rancho-actions">
            <button id="rancho-add-to-excel" class="rancho-btn-primary">📊 Add to My Excel</button>
            <button id="rancho-copy" class="rancho-btn-secondary">📋 Copy Results</button>
          </div>
        </div>
      `;
    }

    document.body.appendChild(modal);

    // Close button event
    modal.querySelector('.rancho-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Add to Excel button
    const addBtn = modal.querySelector('#rancho-add-to-excel');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          action: 'addToExcel',
          data: result
        }, response => {
          if (response && response.success) {
            addBtn.textContent = '✅ Added!';
            addBtn.disabled = true;
          } else {
            alert('Failed to add: ' + (response?.error || 'Unknown error'));
          }
        });
      });
    }

    // Copy results button
    const copyBtn = modal.querySelector('#rancho-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = `Property: ${result.address}\nPrice: $${result.price?.toLocaleString()}\nMonthly Cashflow: $${result.monthlyCashflow?.toLocaleString()}\nCoC Return: ${result.cashOnCashReturn?.toFixed(2)}%`;
        navigator.clipboard.writeText(text);
        copyBtn.textContent = '✅ Copied!';
      });
    }
  }

  // Initialize
  function init() {
    createRanchoButton();
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
      setTimeout(createRanchoButton, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  // Ensure button always exists
  setInterval(() => {
    if (!document.getElementById('rancho-btn')) {
      createRanchoButton();
    }
  }, 2000);

})();
