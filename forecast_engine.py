import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import os

def get_forecast_data():
    # 1. Load your dataset
    # We use 'data.csv' which contains your latest April entries
    file_path = os.path.join(os.path.dirname(__file__), 'data.csv')
    df = pd.read_csv(file_path)
    
    # CRITICAL: Convert the date column and sort it
    # This prevents the "Jan 2026" repetition bug
    df['date'] = pd.to_datetime(df['date'], dayfirst=True)
    df = df.sort_values('date').reset_index(drop=True)

    # 2. Setup Features for the ML Model
    features = ['year', 'month', 'price_lag_1', 'consumption_lag_1', 
                'textile_index', 'rainfall_mm']
    target = 'consumption_lakh_bales'
    
    # Train model on historical data
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(df[features], df[target])

    # 3. Identify the "History" Window (Last 3 Months)
    # If today is April, this will capture Feb, Mar, and Apr
    history_df = df.tail(3)
    results = []
    
    for _, row in history_df.iterrows():
        results.append({
            'month': row['date'].strftime('%b %Y'), 
            'value': round(float(row['consumption_lakh_bales']), 2),
            'type': 'Actual'
        })

    # 4. Predict the "Next 3 Months" (Automatic Sequence)
    last_row = df.iloc[-1]
    last_date = last_row['date']
    current_cons = last_row['consumption_lakh_bales']
    
    # We start from 1 month after the last record in the CSV
    for i in range(1, 4):
        # Move the calendar forward (April -> May -> June -> July)
        future_date = last_date + pd.offsets.MonthBegin(i)
        
        input_data = pd.DataFrame([{
            'year': future_date.year, 
            'month': future_date.month,
            'price_lag_1': last_row['price_rs_per_quintal'],
            'consumption_lag_1': current_cons,
            'textile_index': last_row['textile_index'],
            'rainfall_mm': last_row['rainfall_mm']
        }])
        
        # Generate the AI prediction
        pred = model.predict(input_data[features])[0]
        
        results.append({
            'month': future_date.strftime('%b %Y'),
            'value': round(float(pred), 2),
            'type': 'Forecast'
        })
        
        # Use this prediction as the input for the next month's forecast
        current_cons = pred

    # 5. Trend (Last Forecast vs Last Actual)
    trend_val = round(results[-1]['value'] - results[2]['value'], 2)
    
    return results, trend_val