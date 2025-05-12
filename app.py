# app.py
from flask import Flask, render_template, request, jsonify
import requests
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import yfinance as yf
import pytz

app = Flask(__name__)

# API Keys (replace with your actual keys)
ALPHA_VANTAGE_API = 'YOUR_ALPHA_VANTAGE_KEY'
FINNHUB_API = 'YOUR_FINNHUB_KEY'

# Indian timezone
india_tz = pytz.timezone('Asia/Kolkata')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_stock_data', methods=['POST'])
def get_stock_data():
    symbol = request.form['symbol'] + '.NS'  # .NS for NSE (National Stock Exchange)
    interval = request.form.get('interval', '1d')
    
    try:
        # Get real-time data using yfinance
        stock = yf.Ticker(symbol)
        hist = stock.history(period='1mo', interval=interval)
        
        # Convert to Indian timezone
        hist.index = hist.index.tz_convert(india_tz)
        
        # Prepare data for response
        data = {
            'dates': hist.index.strftime('%Y-%m-%d %H:%M:%S').tolist(),
            'prices': hist['Close'].fillna(method='ffill').tolist(),
            'volume': hist['Volume'].fillna(0).tolist(),
            'current_price': hist['Close'].iloc[-1] if len(hist) > 0 else None,
            'company_name': stock.info.get('longName', '')
        }
        
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/predict', methods=['POST'])
def predict():
    symbol = request.form['symbol'] + '.NS'
    days = int(request.form.get('days', 7))
    
    try:
        # Get historical data
        stock = yf.Ticker(symbol)
        hist = stock.history(period='1y')
        
        if len(hist) < 30:
            return jsonify({'success': False, 'error': 'Not enough historical data'})
        
        # Preprocess data for LSTM
        data = hist['Close'].values.reshape(-1, 1)
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_data = scaler.fit_transform(data)
        
        # Create training dataset
        x_train, y_train = [], []
        for i in range(60, len(scaled_data)):
            x_train.append(scaled_data[i-60:i, 0])
            y_train.append(scaled_data[i, 0])
        
        x_train, y_train = np.array(x_train), np.array(y_train)
        x_train = np.reshape(x_train, (x_train.shape[0], x_train.shape[1], 1))
        
        # Build LSTM model
        model = Sequential()
        model.add(LSTM(units=50, return_sequences=True, input_shape=(x_train.shape[1], 1)))
        model.add(LSTM(units=50))
        model.add(Dense(1))
        
        model.compile(optimizer='adam', loss='mean_squared_error')
        model.fit(x_train, y_train, epochs=1, batch_size=1, verbose=0)
        
        # Predict future prices
        last_60_days = scaled_data[-60:]
        predictions = []
        
        for _ in range(days):
            x_test = np.array([last_60_days])
            x_test = np.reshape(x_test, (x_test.shape[0], x_test.shape[1], 1))
            pred_price = model.predict(x_test, verbose=0)
            predictions.append(pred_price[0,0])
            last_60_days = np.append(last_60_days[1:], pred_price)
        
        predictions = scaler.inverse_transform(np.array(predictions).reshape(-1, 1))
        
        # Generate future dates
        last_date = hist.index[-1]
        future_dates = [last_date + timedelta(days=i) for i in range(1, days+1)]
        
        return jsonify({
            'success': True,
            'predictions': predictions.flatten().tolist(),
            'dates': [d.strftime('%Y-%m-%d') for d in future_dates]
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)