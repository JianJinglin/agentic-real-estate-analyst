// Popup Script

document.addEventListener('DOMContentLoaded', () => {
  // Tab 切换
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

  // 加载已保存的设置
  loadSettings();

  // 保存 GitHub 配置
  document.getElementById('save-github').addEventListener('click', saveGitHubConfig);

  // 保存假设参数
  document.getElementById('save-assumptions').addEventListener('click', saveAssumptions);

  // 重置假设参数
  document.getElementById('reset-assumptions').addEventListener('click', resetAssumptions);
});

// 加载设置
function loadSettings() {
  chrome.storage.sync.get(['githubToken', 'githubRepo', 'githubPath', 'assumptions'], (result) => {
    if (result.githubToken) {
      document.getElementById('github-token').value = result.githubToken;
    }
    if (result.githubRepo) {
      document.getElementById('github-repo').value = result.githubRepo;
    }
    if (result.githubPath) {
      document.getElementById('github-path').value = result.githubPath;
    }

    const assumptions = result.assumptions || getDefaultAssumptions();
    document.getElementById('down-payment').value = assumptions.downPaymentPercent;
    document.getElementById('interest-rate').value = assumptions.interestRate;
    document.getElementById('loan-term').value = assumptions.loanTermYears;
    document.getElementById('property-tax').value = assumptions.propertyTaxRate;
    document.getElementById('insurance-rate').value = assumptions.insuranceRate;
    document.getElementById('maintenance-rate').value = assumptions.maintenanceRate;
    document.getElementById('vacancy-rate').value = assumptions.vacancyRate;
  });
}

// 默认参数
function getDefaultAssumptions() {
  return {
    downPaymentPercent: 20,
    interestRate: 7.0,
    loanTermYears: 30,
    propertyTaxRate: 1.25,
    insuranceRate: 0.5,
    maintenanceRate: 1,
    vacancyRate: 5,
    propertyManagementRate: 0
  };
}

// 保存 GitHub 配置
function saveGitHubConfig() {
  const token = document.getElementById('github-token').value.trim();
  const repo = document.getElementById('github-repo').value.trim();
  const path = document.getElementById('github-path').value.trim() || 'data/properties.csv';

  if (!token || !repo) {
    showStatus('github-status', 'error', '请填写 Token 和仓库信息');
    return;
  }

  chrome.storage.sync.set({
    githubToken: token,
    githubRepo: repo,
    githubPath: path
  }, () => {
    showStatus('github-status', 'success', '✅ GitHub 配置已保存');
  });
}

// 保存假设参数
function saveAssumptions() {
  const assumptions = {
    downPaymentPercent: parseFloat(document.getElementById('down-payment').value) || 20,
    interestRate: parseFloat(document.getElementById('interest-rate').value) || 7.0,
    loanTermYears: parseInt(document.getElementById('loan-term').value) || 30,
    propertyTaxRate: parseFloat(document.getElementById('property-tax').value) || 1.25,
    insuranceRate: parseFloat(document.getElementById('insurance-rate').value) || 0.5,
    maintenanceRate: parseFloat(document.getElementById('maintenance-rate').value) || 1,
    vacancyRate: parseFloat(document.getElementById('vacancy-rate').value) || 5,
    propertyManagementRate: 0
  };

  chrome.storage.sync.set({ assumptions }, () => {
    showStatus('assumptions-status', 'success', '✅ 参数已保存');
  });
}

// 重置假设参数
function resetAssumptions() {
  const defaults = getDefaultAssumptions();

  document.getElementById('down-payment').value = defaults.downPaymentPercent;
  document.getElementById('interest-rate').value = defaults.interestRate;
  document.getElementById('loan-term').value = defaults.loanTermYears;
  document.getElementById('property-tax').value = defaults.propertyTaxRate;
  document.getElementById('insurance-rate').value = defaults.insuranceRate;
  document.getElementById('maintenance-rate').value = defaults.maintenanceRate;
  document.getElementById('vacancy-rate').value = defaults.vacancyRate;

  chrome.storage.sync.set({ assumptions: defaults }, () => {
    showStatus('assumptions-status', 'success', '✅ 已重置为默认参数');
  });
}

// 显示状态信息
function showStatus(elementId, type, message) {
  const statusEl = document.getElementById(elementId);
  statusEl.className = 'status ' + type;
  statusEl.textContent = message;

  setTimeout(() => {
    statusEl.className = 'status';
  }, 3000);
}
