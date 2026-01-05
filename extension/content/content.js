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
    // Only show button on property detail pages
    if (!isPropertyDetailPage()) {
      const existingBtn = document.getElementById('rancho-btn');
      if (existingBtn) existingBtn.remove();
      return;
    }

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

  // Parse bathroom count - handles full and half baths
  function parseBathrooms(text) {
    if (!text) return 0;

    const lowerText = text.toLowerCase();

    // Handle "X full, Y half" format
    const fullHalfMatch = lowerText.match(/(\d+)\s*full.*?(\d+)\s*half/i);
    if (fullHalfMatch) {
      return parseInt(fullHalfMatch[1]) + (parseInt(fullHalfMatch[2]) * 0.5);
    }

    // Handle "X.5 ba" or "X ba" format
    const baMatch = lowerText.match(/([\d.]+)\s*ba/);
    if (baMatch) {
      return parseFloat(baMatch[1]);
    }

    // Handle just a number with decimal
    const numMatch = text.match(/([\d.]+)/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }

    return 0;
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
      // Try to get data from Next.js __NEXT_DATA__ first (most reliable)
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl) {
        try {
          const nextData = JSON.parse(nextDataEl.textContent);

          // Try multiple paths to find property data
          let property = null;

          // Path 1: Direct property object
          if (nextData?.props?.pageProps?.property) {
            property = nextData.props.pageProps.property;
          }
          // Path 2: initialReduxState gdp building
          else if (nextData?.props?.pageProps?.initialReduxState?.gdp?.building) {
            property = nextData.props.pageProps.initialReduxState.gdp.building;
          }
          // Path 3: componentProps
          else if (nextData?.props?.pageProps?.componentProps?.gdpClientCache) {
            const cache = nextData.props.pageProps.componentProps.gdpClientCache;
            const cacheKey = Object.keys(cache).find(k => cache[k]?.property);
            if (cacheKey) {
              property = cache[cacheKey].property;
            }
          }
          // Path 4: Try to find in gdpClientCache directly
          else if (nextData?.props?.pageProps?.gdpClientCache) {
            const cache = nextData.props.pageProps.gdpClientCache;
            const cacheKey = Object.keys(cache).find(k => cache[k]?.property);
            if (cacheKey) {
              property = cache[cacheKey].property;
            }
          }

          if (property) {
            console.log('Rancho: Found property data in __NEXT_DATA__', property);

            // Address
            data.address = property.address?.streetAddress ||
                          property.fullAddress ||
                          (property.address ? `${property.address.streetAddress}, ${property.address.city}, ${property.address.state} ${property.address.zipcode}` : '');

            // Price
            data.price = property.price || property.listPrice || property.zestimate || 0;

            // Bedrooms
            data.bedrooms = property.bedrooms || property.resoFacts?.bedrooms || 0;

            // Bathrooms - handle full and half baths
            if (property.bathrooms !== undefined) {
              data.bathrooms = property.bathrooms;
            } else if (property.resoFacts) {
              const fullBaths = property.resoFacts.bathroomsFull || 0;
              const halfBaths = property.resoFacts.bathroomsHalf || 0;
              const threeQuarterBaths = property.resoFacts.bathroomsThreeQuarter || 0;
              data.bathrooms = fullBaths + (halfBaths * 0.5) + (threeQuarterBaths * 0.75);
            }

            // Square footage
            data.sqft = property.livingArea ||
                       property.livingAreaValue ||
                       property.resoFacts?.livingArea ||
                       property.lotSize ||
                       0;

            // Year built
            data.yearBuilt = property.yearBuilt || property.resoFacts?.yearBuilt || 0;

            // Rent estimate
            data.zestimateRent = property.rentZestimate || 0;

            // Property tax (annual to monthly)
            if (property.taxAnnualAmount) {
              data.propertyTax = property.taxAnnualAmount / 12;
            } else if (property.resoFacts?.taxAnnualAmount) {
              data.propertyTax = property.resoFacts.taxAnnualAmount / 12;
            }

            // HOA fee
            data.hoaFee = property.monthlyHoaFee ||
                         property.resoFacts?.hoaFee ||
                         property.associationFee ||
                         0;
          }
        } catch (e) {
          console.log('Rancho: Failed to parse __NEXT_DATA__', e);
        }
      }

      // Fallback: scrape from DOM if __NEXT_DATA__ didn't provide enough
      if (!data.address) {
        const addressEl = document.querySelector('[data-testid="bdp-address"]') ||
                          document.querySelector('h1.Text-c11n-8-99-3__sc-aiai24-0');
        if (addressEl) data.address = addressEl.textContent.trim();
      }

      if (!data.price) {
        // Try multiple price selectors
        const priceSelectors = [
          '[data-testid="price"]',
          'span[data-testid="price"]',
          '.summary-container [data-testid="price"]',
          '.ds-summary-row span.Text-c11n-8-99-3__sc-aiai24-0'
        ];

        for (const selector of priceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl) {
            const priceText = priceEl.textContent.replace(/[^0-9]/g, '');
            data.price = parseInt(priceText) || 0;
            if (data.price > 0) break;
          }
        }
      }

      // Fallback for beds/baths/sqft from DOM
      if (!data.bedrooms || !data.bathrooms || !data.sqft) {
        // Try to find the summary facts section
        const factSelectors = [
          '[data-testid="bed-bath-sqft-fact-container"]',
          '.summary-container',
          '.ds-bed-bath-living-area-container',
          '[data-testid="facts-container"]'
        ];

        for (const selector of factSelectors) {
          const container = document.querySelector(selector);
          if (container) {
            const text = container.textContent;

            // Extract bedrooms
            if (!data.bedrooms) {
              const bedMatch = text.match(/(\d+)\s*(?:bd|bed|bedroom)/i);
              if (bedMatch) data.bedrooms = parseInt(bedMatch[1]);
            }

            // Extract bathrooms (handles decimals for half baths)
            if (!data.bathrooms) {
              const bathMatch = text.match(/([\d.]+)\s*(?:ba|bath|bathroom)/i);
              if (bathMatch) data.bathrooms = parseFloat(bathMatch[1]);
            }

            // Extract sqft
            if (!data.sqft) {
              const sqftMatch = text.match(/([\d,]+)\s*(?:sqft|sq\s*ft|square\s*feet)/i);
              if (sqftMatch) data.sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
            }
          }
        }

        // Try individual fact items
        const factItems = document.querySelectorAll('[data-testid="bed-bath-sqft-fact-container"] span, .ds-bed-bath-living-area span');
        factItems.forEach(item => {
          const text = item.textContent.toLowerCase();
          if (text.includes('bd') || text.includes('bed')) {
            if (!data.bedrooms) data.bedrooms = parseInt(text) || 0;
          } else if (text.includes('ba') || text.includes('bath')) {
            if (!data.bathrooms) data.bathrooms = parseBathrooms(text);
          } else if (text.includes('sqft') || text.includes('sq ft')) {
            if (!data.sqft) data.sqft = parseInt(text.replace(/[^0-9]/g, '')) || 0;
          }
        });
      }

      console.log('Rancho: Scraped property data', data);

    } catch (error) {
      console.error('Rancho: Error scraping data', error);
    }

    return data;
  }

  // Analyze property
  function analyzeProperty() {
    // Verify we're on a property detail page
    if (!isPropertyDetailPage()) {
      showResultModal({ error: 'Please navigate to a property detail page to analyze.' });
      return;
    }

    const propertyData = scrapePropertyData();

    // Validate we got some data
    if (!propertyData.price || propertyData.price === 0) {
      showResultModal({ error: 'Could not find property price. Please make sure you are on a Zillow property detail page.' });
      return;
    }

    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'analyzeProperty',
      data: propertyData
    }, response => {
      if (chrome.runtime.lastError) {
        showResultModal({ error: 'Extension error. Please refresh the page and try again.' });
        return;
      }
      if (response && response.success) {
        showResultModal(response.result);
      } else {
        showResultModal({ error: response?.error || 'Analysis failed. Please try again.' });
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
            <p><strong>Layout:</strong> ${result.bedrooms} bed ${result.bathrooms} bath ${result.sqft?.toLocaleString() || 0} sqft</p>
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
          if (chrome.runtime.lastError) {
            alert('Extension error. Please refresh the page and try again.');
            return;
          }
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
      // Delay to let page load
      setTimeout(() => {
        if (isPropertyDetailPage()) {
          createRanchoButton();
        } else {
          // Remove button if not on detail page
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
