// Background Service Worker

// 默认假设参数
const DEFAULT_ASSUMPTIONS = {
  downPaymentPercent: 20,      // 首付比例 20%
  interestRate: 7.0,           // 贷款利率 7%
  loanTermYears: 30,           // 贷款期限 30年
  propertyTaxRate: 1.25,       // 房产税率 1.25%/年
  insuranceRate: 0.5,          // 保险率 0.5%/年
  maintenanceRate: 1,          // 维护费 1%/年
  vacancyRate: 5,              // 空置率 5%
  propertyManagementRate: 0    // 物业管理费 0% (自己管理)
};

// 计算现金流
function calculateCashflow(propertyData, assumptions = DEFAULT_ASSUMPTIONS) {
  const price = propertyData.price || 0;
  const monthlyRent = propertyData.zestimateRent || estimateRent(propertyData);

  // 贷款计算
  const downPayment = price * (assumptions.downPaymentPercent / 100);
  const loanAmount = price - downPayment;
  const monthlyInterestRate = (assumptions.interestRate / 100) / 12;
  const numberOfPayments = assumptions.loanTermYears * 12;

  // 月供 (P&I) - 使用等额本息公式
  let monthlyMortgage = 0;
  if (loanAmount > 0 && monthlyInterestRate > 0) {
    monthlyMortgage = loanAmount *
      (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
      (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
  }

  // 月度费用
  const monthlyTax = propertyData.propertyTax || (price * (assumptions.propertyTaxRate / 100) / 12);
  const monthlyInsurance = propertyData.insurance || (price * (assumptions.insuranceRate / 100) / 12);
  const monthlyHoa = propertyData.hoaFee || 0;
  const monthlyMaintenance = price * (assumptions.maintenanceRate / 100) / 12;
  const monthlyVacancy = monthlyRent * (assumptions.vacancyRate / 100);
  const monthlyManagement = monthlyRent * (assumptions.propertyManagementRate / 100);

  // 月度总支出
  const totalMonthlyExpenses = monthlyMortgage + monthlyTax + monthlyInsurance +
                               monthlyHoa + monthlyMaintenance + monthlyVacancy + monthlyManagement;

  // 月现金流
  const monthlyCashflow = monthlyRent - totalMonthlyExpenses;
  const annualCashflow = monthlyCashflow * 12;

  // NOI (净营业收入) - 不含贷款
  const annualNOI = (monthlyRent * 12) -
                    ((monthlyTax + monthlyInsurance + monthlyHoa + monthlyMaintenance + monthlyVacancy + monthlyManagement) * 12);

  // Cap Rate
  const capRate = price > 0 ? (annualNOI / price) * 100 : 0;

  // Cash on Cash Return (现金回报率)
  const totalCashInvested = downPayment + (price * 0.03); // 首付 + 约3%交易费用
  const cashOnCashReturn = totalCashInvested > 0 ? (annualCashflow / totalCashInvested) * 100 : 0;

  return {
    // 房产信息
    address: propertyData.address,
    url: propertyData.url,
    price: Math.round(price),
    bedrooms: propertyData.bedrooms,
    bathrooms: propertyData.bathrooms,
    sqft: propertyData.sqft,
    yearBuilt: propertyData.yearBuilt,

    // 收入
    monthlyRent: Math.round(monthlyRent),

    // 支出明细
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyTax: Math.round(monthlyTax),
    monthlyInsurance: Math.round(monthlyInsurance),
    monthlyHoa: Math.round(monthlyHoa),
    monthlyMaintenance: Math.round(monthlyMaintenance),
    monthlyVacancy: Math.round(monthlyVacancy),
    monthlyManagement: Math.round(monthlyManagement),

    // 结果
    monthlyCashflow: Math.round(monthlyCashflow),
    annualCashflow: Math.round(annualCashflow),
    annualNOI: Math.round(annualNOI),
    capRate: capRate,
    cashOnCashReturn: cashOnCashReturn,

    // 贷款信息
    downPayment: Math.round(downPayment),
    loanAmount: Math.round(loanAmount),
    totalCashInvested: Math.round(totalCashInvested),

    // 假设参数
    assumptions: assumptions,

    // 时间戳
    analyzedAt: new Date().toISOString()
  };
}

// 估算租金 (如果 Zillow 没有提供)
function estimateRent(propertyData) {
  // 简单估算: 房价的 0.8% 作为月租金 (1% 规则的保守版)
  const baseRent = propertyData.price * 0.008;

  // 根据卧室数量调整
  const bedroomAdjustment = (propertyData.bedrooms || 2) * 50;

  return Math.round(baseRent + bedroomAdjustment);
}

// 添加到 GitHub CSV
async function addToGitHubCSV(result) {
  // 从存储中获取 GitHub 配置
  const config = await chrome.storage.sync.get(['githubToken', 'githubRepo', 'githubPath']);

  if (!config.githubToken || !config.githubRepo) {
    throw new Error('请先在扩展设置中配置 GitHub Token 和仓库信息');
  }

  const token = config.githubToken;
  const repo = config.githubRepo; // 格式: owner/repo
  const filePath = config.githubPath || 'data/properties.csv';

  // 获取现有文件内容
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
    // 文件不存在，将创建新文件
  }

  // CSV 头部
  const headers = 'Date,Address,Price,Beds,Baths,Sqft,Monthly Rent,Monthly Cashflow,Annual Cashflow,CoC Return,Cap Rate,URL\n';

  // 新行数据
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

  // 组合内容
  let newContent;
  if (!existingContent) {
    newContent = headers + newRow;
  } else {
    newContent = existingContent + newRow;
  }

  // 更新/创建文件
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
    throw new Error(error.message || '更新 GitHub 失败');
  }

  return { success: true };
}

// 消息监听器
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
    return true; // 保持消息通道开放
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
