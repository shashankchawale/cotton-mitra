import json
import forecast_engine
with open('output_log.json', 'w', encoding='utf-8') as f:
    json.dump(forecast_engine.get_forecast_data(), f, indent=2)
