"""
Cotton Mitra — ML Forecast Microservice
Runs the RandomForestRegressor forecast engine and exposes results via a REST API.
Start: python ml_server.py
"""
from flask import Flask, jsonify
from flask_cors import CORS
import forecast_engine

app = Flask(__name__)
CORS(app)

@app.route('/ml/forecast', methods=['GET'])
def ml_forecast():
    try:
        results, trend = forecast_engine.get_forecast_data()
        return jsonify({
            'success': True,
            'results': results,
            'trend': trend
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/ml/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'Cotton Mitra ML Forecast Engine'})

if __name__ == '__main__':
    print('\n🧠 Cotton Mitra ML Forecast Server')
    print('📊 Endpoint: http://localhost:5001/ml/forecast')
    print('❤️  Health:   http://localhost:5001/ml/health\n')
    app.run(port=5001, debug=False)
