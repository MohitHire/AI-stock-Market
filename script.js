// static/js/script.js
document.addEventListener('DOMContentLoaded', function() {
    let stockChart;
    let predictionChart;
    let currentData = {};
    
    // Initialize charts
    initializeCharts();
    
    // Event listeners
    document.getElementById('fetchData').addEventListener('click', fetchStockData);
    document.getElementById('predictBtn').addEventListener('click', predictFuturePrices);
    
    function initializeCharts() {
        const stockCtx = document.getElementById('stockChart').getContext('2d');
        stockChart = new Chart(stockCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Stock Price',
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Price (INR)'
                        }
                    }
                }
            }
        });
        
        const predictionCtx = document.getElementById('predictionChart').getContext('2d');
        predictionChart = new Chart(predictionCtx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Historical Prices',
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }, {
                    label: 'Predicted Prices',
                    borderColor: 'rgb(255, 99, 132)',
                    borderDash: [5, 5],
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Price (INR)'
                        }
                    }
                }
            }
        });
    }
    
    function fetchStockData() {
        const symbol = document.getElementById('stockSymbol').value.trim();
        const interval = document.getElementById('timeInterval').value;
        
        if (!symbol) {
            alert('Please enter a stock symbol');
            return;
        }
        
        toggleLoading('fetchData', true);
        
        fetch('/get_stock_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `symbol=${encodeURIComponent(symbol)}&interval=${interval}`
        })
        .then(response => response.json())
        .then(data => {
            toggleLoading('fetchData', false);
            
            if (data.success) {
                currentData = data.data;
                updateStockChart();
                updateStockInfo();
            } else {
                alert('Error: ' + data.error);
            }
        })
        .catch(error => {
            toggleLoading('fetchData', false);
            alert('Error fetching data: ' + error);
        });
    }
    
    function updateStockChart() {
        const dates = currentData.dates;
        const prices = currentData.prices;
        
        stockChart.data.labels = dates;
        stockChart.data.datasets[0].data = prices.map((price, index) => ({
            x: dates[index],
            y: price
        }));
        stockChart.update();
    }
    
    function updateStockInfo() {
        document.getElementById('stockInfo').classList.remove('d-none');
        document.getElementById('companyName').textContent = currentData.company_name || 'N/A';
        document.getElementById('currentPrice').textContent = currentData.current_price ? 
            '₹' + currentData.current_price.toFixed(2) : 'N/A';
    }
    
    function predictFuturePrices() {
        const symbol = document.getElementById('stockSymbol').value.trim();
        const days = document.getElementById('predictionDays').value;
        
        if (!symbol) {
            alert('Please enter a stock symbol and fetch data first');
            return;
        }
        
        if (!currentData || currentData.prices.length === 0) {
            alert('Please fetch stock data first');
            return;
        }
        
        toggleLoading('predictBtn', true);
        
        fetch('/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `symbol=${encodeURIComponent(symbol)}&days=${days}`
        })
        .then(response => response.json())
        .then(data => {
            toggleLoading('predictBtn', false);
            
            if (data.success) {
                updatePredictionChart(data.predictions, data.dates);
                updatePredictionTable(data.predictions, data.dates);
            } else {
                alert('Error: ' + data.error);
            }
        })
        .catch(error => {
            toggleLoading('predictBtn', false);
            alert('Error making prediction: ' + error);
        });
    }
    
    function updatePredictionChart(predictions, predDates) {
        // Combine historical and predicted data
        const allDates = [...currentData.dates, ...predDates];
        const allPrices = [...currentData.prices, ...predictions];
        
        // Historical data
        predictionChart.data.datasets[0].data = currentData.prices.map((price, index) => ({
            x: currentData.dates[index],
            y: price
        }));
        
        // Predicted data
        predictionChart.data.datasets[1].data = predictions.map((price, index) => ({
            x: predDates[index],
            y: price
        }));
        
        predictionChart.update();
    }
    
    function updatePredictionTable(predictions, predDates) {
        const tableBody = document.getElementById('predictionData');
        tableBody.innerHTML = '';
        
        const lastPrice = currentData.prices[currentData.prices.length - 1];
        
        predictions.forEach((price, index) => {
            const change = price - lastPrice;
            const changePercent = (change / lastPrice) * 100;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${predDates[index]}</td>
                <td>₹${price.toFixed(2)}</td>
                <td class="${change >= 0 ? 'positive' : 'negative'}">
                    ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        document.getElementById('predictionTable').classList.remove('d-none');
    }
    
    function toggleLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (isLoading) {
            button.disabled = true;
            const loadingSpan = document.createElement('span');
            loadingSpan.className = 'loading';
            button.appendChild(loadingSpan);
        } else {
            button.disabled = false;
            const loadingSpan = button.querySelector('.loading');
            if (loadingSpan) {
                button.removeChild(loadingSpan);
            }
        }
    }
});