// UI functionality
function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab content
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked tab
    event.currentTarget.classList.add('active');
}

// Analysis tab switching
function showAnalysis(analysisType) {
    const analysisTabs = document.querySelectorAll('.analysis-tab');
    analysisTabs.forEach(tab => tab.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Update chart content based on analysis type
    updateAnalysisChart(analysisType);
}

function updateAnalysisChart(type) {
    const chartContainer = document.querySelector('.chart-container');
    let content = '';
    
    switch(type) {
        case 'daily':
            content = `
                <div style="text-align: center; color: #718096;">
                    <i class="fas fa-chart-bar" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                    <p>Daily Exposure: 2.5 hrs</p>
                    <p>Safe Listening Time Remaining: 5.5 hrs</p>
                </div>
            `;
            break;
        case 'weekly':
            content = `
                <div style="text-align: center; color: #718096;">
                    <i class="fas fa-chart-line" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                    <p>Weekly Average: 3.2 hrs/day</p>
                    <p>Health Trend: Improving</p>
                </div>
            `;
            break;
        case 'yearly':
            content = `
                <div style="text-align: center; color: #718096;">
                    <i class="fas fa-chart-pie" style="font-size: 2.5em; margin-bottom: 10px;"></i>
                    <p>Yearly Average: 3.8 hrs/day</p>
                    <p>Health Score Trend: +15%</p>
                </div>
            `;
            break;
    }
    
    chartContainer.innerHTML = content;
}