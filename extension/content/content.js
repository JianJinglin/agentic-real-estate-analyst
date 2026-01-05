// Content Script - Inject into Zillow property detail pages

(function() {
  'use strict';

  // Check if we're on a property detail page
  function isPropertyDetailPage() {
    return window.location.pathname.includes('/homedetails/');
  }

  // Check if already injected
  if (document.getElementById('rancho-btn')) return;

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
      // 1. Get Address from DOM (most visible element)
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

      // 3. Get beds/baths/sqft - look for the summary container
      const allSpans = document.querySelectorAll('span');
      allSpans.forEach(span => {
        const text = span.textContent.trim();

        // Match "X bd" pattern for bedrooms
        if (/^\d+\s*bd$/i.test(text)) {
          data.bedrooms = parseInt(text) || 0;
        }
        // Match "X ba" or "X.5 ba" pattern for bathrooms
        else if (/^[\d.]+\s*ba$/i.test(text)) {
          data.bathrooms = parseFloat(text) || 0;
        }
        // Match "X,XXX sqft" pattern for square footage
        else if (/^[\d,]+\s*sqft$/i.test(text)) {
          data.sqft = parseInt(text.replace(/[^0-9]/g, '')) || 0;
        }
      });

      // 4. Try to get additional data from __NEXT_DATA__
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        try {
          const nextData = JSON.parse(nextDataEl.textContent);

          // Try to find property in gdpClientCache
          const gdpCache = nextData?.props?.pageProps?.gdpClientCache ||
                          nextData?.props?.pageProps?.componentProps?.gdpClientCache;

          if (gdpCache) {
            // Find the first cache entry with property data
            for (const key of Object.keys(gdpCache)) {
              const entry = gdpCache[key];
              if (entry?.property) {
                const prop = entry.property;

                // Fill in missing data
                if (!data.address && prop.address) {
                  const addr = prop.address;
                  data.address = `${addr.streetAddress}, ${addr.city}, ${addr.state} ${addr.zipcode}`;
                }
                if (!data.price) data.price = prop.price || 0;
                if (!data.bedrooms) data.bedrooms = prop.bedrooms || 0;
                if (!data.bathrooms) data.bathrooms = prop.bathrooms || 0;
                if (!data.sqft) data.sqft = prop.livingArea || 0;
                data.yearBuilt = prop.yearBuilt || 0;
                data.zestimateRent = prop.rentZestimate || 0;
                data.hoaFee = prop.monthlyHoaFee || 0;

                if (prop.taxAnnualAmount) {
                  data.propertyTax = prop.taxAnnualAmount / 12;
                }

                // Handle resoFacts for detailed bathroom info
                if (prop.resoFacts) {
                  if (!data.bedrooms) data.bedrooms = prop.resoFacts.bedrooms || 0;
                  if (!data.sqft) data.sqft = prop.resoFacts.livingArea || 0;

                  // Calculate bathrooms from full + half
                  if (!data.bathrooms || data.bathrooms === 0) {
                    const fullBaths = prop.resoFacts.bathroomsFull || 0;
                    const halfBaths = prop.resoFacts.bathroomsHalf || 0;
                    if (fullBaths || halfBaths) {
                      data.bathrooms = fullBaths + (halfBaths * 0.5);
                    }
                  }
                }

                break; // Found property data, stop searching
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
      const cashflowClass = result.monthlyCashflow >= 0 ? 'positive' : 'negative';
      modal.innerHTML = `
        <div class="rancho-modal-content">
          <span class="rancho-close">&times;</span>
          <h2>🏠 Rancho Cashflow Analysis</h2>

          <div class="rancho-section">
            <h3>📍 Property Info</h3>
            <p><strong>Address:</strong> ${result.address || 'N/A'}</p>
            <p><strong>Price:</strong> $${result.price?.toLocaleString() || 'N/A'}</p>
            <p><strong>Layout:</strong> ${result.bedrooms || 0} bed ${result.bathrooms || 0} bath ${result.sqft?.toLocaleString() || 0} sqft</p>
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

    // Close button
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
          if (chrome.runtime.lastError) {
            alert('Extension error. Please refresh.');
            return;
          }
          if (response && response.success) {
            addBtn.textContent = '✅ Added!';
            addBtn.disabled = true;
          } else {
            alert('Failed: ' + (response?.error || 'Unknown error'));
          }
        });
      });
    }

    // Copy button
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
