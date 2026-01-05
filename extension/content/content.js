// Content Script - 注入到 Zillow 房产详情页面

(function() {
  'use strict';

  // 检查是否已经注入过
  if (document.getElementById('rancho-btn')) return;

  // 创建 Rancho 按钮 - 始终固定在右下角
  function createRanchoButton() {
    // 移除已存在的按钮
    const existingBtn = document.getElementById('rancho-btn');
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'rancho-btn';
    btn.innerHTML = '🏠 Rancho';
    btn.title = '分析此房产现金流';

    // 直接添加到 body，固定定位在右下角
    document.body.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      analyzeProperty();
    });
  }

  // 从页面抓取房产数据
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
      // 地址
      const addressEl = document.querySelector('[data-testid="bdp-address"]') ||
                        document.querySelector('h1.Text-c11n-8-100-1__sc-aiai24-0');
      if (addressEl) data.address = addressEl.textContent.trim();

      // 价格
      const priceEl = document.querySelector('[data-testid="price"]') ||
                      document.querySelector('span[data-testid="price"]');
      if (priceEl) {
        const priceText = priceEl.textContent.replace(/[^0-9]/g, '');
        data.price = parseInt(priceText) || 0;
      }

      // 房间信息 - beds, baths, sqft
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

      // 备选方式获取 beds/baths/sqft
      if (!data.bedrooms) {
        const bedsEl = document.querySelector('[data-testid="bed-bath-item"]');
        if (bedsEl) {
          const match = bedsEl.textContent.match(/(\d+)\s*bd/i);
          if (match) data.bedrooms = parseInt(match[1]);
        }
      }

      // Zestimate 租金估算
      const rentEstimateEl = document.querySelector('[data-testid="zestimate-rent"]') ||
                             document.querySelector('span:contains("Rent Zestimate")');
      if (rentEstimateEl) {
        const rentText = rentEstimateEl.textContent.replace(/[^0-9]/g, '');
        data.zestimateRent = parseInt(rentText) || 0;
      }

      // 从页面 JSON 数据中提取更多信息
      const scripts = document.querySelectorAll('script[type="application/json"]');
      scripts.forEach(script => {
        try {
          const jsonData = JSON.parse(script.textContent);
          if (jsonData && jsonData.props && jsonData.props.pageProps) {
            const property = jsonData.props.pageProps.initialReduxState?.gdp?.building ||
                            jsonData.props.pageProps.property;
            if (property) {
              data.yearBuilt = property.yearBuilt || data.yearBuilt;
              data.propertyType = property.propertyType || property.homeType || data.propertyType;
              data.hoaFee = property.hoaFee || property.monthlyHoaFee || 0;
              data.propertyTax = property.propertyTaxRate || property.taxAnnualAmount || 0;
              if (property.rentZestimate) data.zestimateRent = property.rentZestimate;
            }
          }
        } catch (e) {}
      });

      // 尝试从 Next.js 数据中获取
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
            data.propertyTax = property.propertyTaxRate || property.taxAnnualAmount / 12 || data.propertyTax;
            data.hoaFee = property.monthlyHoaFee || data.hoaFee;
          }
        } catch (e) {}
      }

    } catch (error) {
      console.error('Rancho: 数据抓取错误', error);
    }

    return data;
  }

  // 分析房产
  function analyzeProperty() {
    const propertyData = scrapePropertyData();

    // 发送消息给 background script
    chrome.runtime.sendMessage({
      action: 'analyzeProperty',
      data: propertyData
    }, response => {
      if (response && response.success) {
        showResultModal(response.result);
      } else {
        showResultModal({ error: '分析失败，请重试' });
      }
    });
  }

  // 显示结果弹窗
  function showResultModal(result) {
    // 移除已存在的弹窗
    const existingModal = document.getElementById('rancho-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'rancho-modal';

    if (result.error) {
      modal.innerHTML = `
        <div class="rancho-modal-content">
          <span class="rancho-close">&times;</span>
          <h2>❌ 分析失败</h2>
          <p>${result.error}</p>
        </div>
      `;
    } else {
      const cashflowClass = result.monthlyCashflow >= 0 ? 'positive' : 'negative';
      modal.innerHTML = `
        <div class="rancho-modal-content">
          <span class="rancho-close">&times;</span>
          <h2>🏠 Rancho 现金流分析</h2>

          <div class="rancho-section">
            <h3>📍 房产信息</h3>
            <p><strong>地址:</strong> ${result.address || 'N/A'}</p>
            <p><strong>价格:</strong> $${result.price?.toLocaleString() || 'N/A'}</p>
            <p><strong>户型:</strong> ${result.bedrooms}床 ${result.bathrooms}卫 ${result.sqft?.toLocaleString()}sqft</p>
          </div>

          <div class="rancho-section">
            <h3>💰 月度收支</h3>
            <p><strong>预估月租金:</strong> $${result.monthlyRent?.toLocaleString() || 'N/A'}</p>
            <p><strong>月供 (P&I):</strong> -$${result.monthlyMortgage?.toLocaleString() || 'N/A'}</p>
            <p><strong>房产税:</strong> -$${result.monthlyTax?.toLocaleString() || 'N/A'}</p>
            <p><strong>保险:</strong> -$${result.monthlyInsurance?.toLocaleString() || 'N/A'}</p>
            <p><strong>HOA:</strong> -$${result.monthlyHoa?.toLocaleString() || '0'}</p>
            <p><strong>维护预留:</strong> -$${result.monthlyMaintenance?.toLocaleString() || 'N/A'}</p>
            <p><strong>空置预留:</strong> -$${result.monthlyVacancy?.toLocaleString() || 'N/A'}</p>
          </div>

          <div class="rancho-section rancho-result">
            <h3>📊 现金流结果</h3>
            <p class="cashflow ${cashflowClass}">
              <strong>月现金流:</strong> $${result.monthlyCashflow?.toLocaleString() || 'N/A'}
            </p>
            <p><strong>年现金流:</strong> $${result.annualCashflow?.toLocaleString() || 'N/A'}</p>
            <p><strong>现金回报率 (CoC):</strong> ${result.cashOnCashReturn?.toFixed(2) || 'N/A'}%</p>
            <p><strong>Cap Rate:</strong> ${result.capRate?.toFixed(2) || 'N/A'}%</p>
          </div>

          <div class="rancho-section">
            <h3>⚙️ 假设参数</h3>
            <p>首付: ${result.assumptions?.downPaymentPercent}% | 利率: ${result.assumptions?.interestRate}% | 贷款期限: ${result.assumptions?.loanTermYears}年</p>
          </div>

          <div class="rancho-actions">
            <button id="rancho-add-to-excel" class="rancho-btn-primary">📊 添加到我的Excel</button>
            <button id="rancho-copy" class="rancho-btn-secondary">📋 复制结果</button>
          </div>
        </div>
      `;
    }

    document.body.appendChild(modal);

    // 关闭按钮事件
    modal.querySelector('.rancho-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // 添加到 Excel 按钮
    const addBtn = modal.querySelector('#rancho-add-to-excel');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          action: 'addToExcel',
          data: result
        }, response => {
          if (response && response.success) {
            addBtn.textContent = '✅ 已添加!';
            addBtn.disabled = true;
          } else {
            alert('添加失败: ' + (response?.error || '未知错误'));
          }
        });
      });
    }

    // 复制结果按钮
    const copyBtn = modal.querySelector('#rancho-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = `房产: ${result.address}\n价格: $${result.price?.toLocaleString()}\n月现金流: $${result.monthlyCashflow?.toLocaleString()}\nCoC回报率: ${result.cashOnCashReturn?.toFixed(2)}%`;
        navigator.clipboard.writeText(text);
        copyBtn.textContent = '✅ 已复制!';
      });
    }
  }

  // 页面加载完成后创建按钮
  function init() {
    createRanchoButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 监听 URL 变化（SPA 导航）
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(createRanchoButton, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  // 确保按钮始终存在
  setInterval(() => {
    if (!document.getElementById('rancho-btn')) {
      createRanchoButton();
    }
  }, 2000);

})();
