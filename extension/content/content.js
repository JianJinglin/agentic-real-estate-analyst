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
      if (!data.bedrooms || !data.bathrooms || !data.sqft) {
        const pageText = document.body.innerText;

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

                // Always check resoFacts for accurate bathroom count (full + half)
                // This overrides the simple "2 baths" with accurate "1 full + 1 half = 1.5"
                if (prop.resoFacts) {
                  const fullBaths = prop.resoFacts.bathroomsFull || 0;
                  const halfBaths = prop.resoFacts.bathroomsHalf || 0;
                  if (fullBaths || halfBaths) {
                    data.bathrooms = fullBaths + (halfBaths * 0.5);
                  }
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
              <p><strong>Price:</strong> $${result.price?.toLocaleString() || 'N/A'}</p>
              <p><strong>Down Payment:</strong> ${result.downPaymentPercent}% ($${result.downPayment?.toLocaleString()})</p>
              <p><strong>Loan Amount:</strong> $${result.loanAmount?.toLocaleString()}</p>
              <p><strong>LTV:</strong> ${result.ltv}%</p>
              <p><strong>Rate:</strong> ${result.assumptions?.interestRate}% / ${result.assumptions?.loanTermYears}yr</p>
            </div>
          </div>

          <div class="rancho-section">
            <h3>🏠 Monthly Rent Income</h3>
            <div class="rancho-row">
              <p><strong>Monthly Rent:</strong> <span class="highlight-green">$${result.monthlyRent?.toLocaleString()}</span></p>
              <p><strong>Rent/sqft:</strong> $${result.rentPerSqft}/sqft</p>
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
