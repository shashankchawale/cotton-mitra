from flask import Flask, request, jsonify, session, redirect, send_from_directory
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
try:
    from forecast_engine import get_forecast_data
    ML_AVAILABLE = True
except Exception as _ml_err:
    ML_AVAILABLE = False
    print(f'[WARN] ML forecast engine unavailable: {_ml_err}')

load_dotenv()

app = Flask(__name__, static_url_path='', static_folder='.')
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'cotton-mitra-super-secret-2026')

# ─── In-Memory Demo Data ──────────────────────────────────────────────────────
DEMO_INVENTORY = [
    {'_id':'d1',  'batchId':'BATCH-001', 'grade':'Premium',  'bales':820, 'warehouse':'Warehouse A', 'location':'Section 1', 'status':'In Stock',  'pricePerBale':1450, 'humidity':52, 'temperature':21, 'notes':'', 'arrival_date': '2026-02-17'},
    {'_id':'d2',  'batchId':'BATCH-002', 'grade':'Premium',  'bales':650, 'warehouse':'Warehouse A', 'location':'Section 2', 'status':'Reserved',  'pricePerBale':1450, 'humidity':54, 'temperature':22, 'notes':'', 'arrival_date': '2026-03-19'},
    {'_id':'d3',  'batchId':'BATCH-003', 'grade':'Standard', 'bales':480, 'warehouse':'Warehouse B', 'location':'Section 1', 'status':'In Stock',  'pricePerBale':1200, 'humidity':61, 'temperature':23, 'notes':'', 'arrival_date': '2025-12-19'},
    {'_id':'d4',  'batchId':'BATCH-004', 'grade':'Standard', 'bales':390, 'warehouse':'Warehouse B', 'location':'Section 2', 'status':'In Stock',  'pricePerBale':1200, 'humidity':58, 'temperature':22, 'notes':'', 'arrival_date': '2025-12-29'},
    {'_id':'d5',  'batchId':'BATCH-005', 'grade':'Economy',  'bales':120, 'warehouse':'Warehouse C', 'location':'Section 1', 'status':'Low Stock', 'pricePerBale':900,  'humidity':57, 'temperature':24, 'notes':'', 'arrival_date': '2025-12-14'},
    {'_id':'d6',  'batchId':'BATCH-006', 'grade':'Premium',  'bales':950, 'warehouse':'Warehouse A', 'location':'Section 3', 'status':'In Stock',  'pricePerBale':1480, 'humidity':50, 'temperature':20, 'notes':'', 'arrival_date': '2026-03-04'},
    {'_id':'d7',  'batchId':'BATCH-007', 'grade':'Standard', 'bales':580, 'warehouse':'Warehouse C', 'location':'Section 2', 'status':'In Stock',  'pricePerBale':1220, 'humidity':55, 'temperature':22, 'notes':'', 'arrival_date': '2026-02-02'},
    {'_id':'d8',  'batchId':'BATCH-008', 'grade':'Economy',  'bales':90,  'warehouse':'Warehouse C', 'location':'Section 3', 'status':'Low Stock', 'pricePerBale':880,  'humidity':60, 'temperature':25, 'notes':'', 'arrival_date': '2025-12-04'},
    {'_id':'d9',  'batchId':'BATCH-009', 'grade':'Premium',  'bales':760, 'warehouse':'Warehouse A', 'location':'Section 4', 'status':'Reserved',  'pricePerBale':1460, 'humidity':51, 'temperature':21, 'notes':'', 'arrival_date': '2026-03-09'},
    {'_id':'d10', 'batchId':'BATCH-010', 'grade':'Standard', 'bales':210, 'warehouse':'Warehouse B', 'location':'Section 3', 'status':'Low Stock', 'pricePerBale':1180, 'humidity':59, 'temperature':23, 'notes':'', 'arrival_date': '2026-01-13'},
]

DEMO_SHIPMENTS = [
    {'_id':'s1', 'shipmentId':'SHIP-4501', 'destination':'Mumbai Textile Hub',        'bales':200, 'status':'Delivered',  'scheduledDate':'2026-03-15', 'carrier':'AgriFreight Ltd'},
    {'_id':'s2', 'shipmentId':'SHIP-4502', 'destination':'Ahmedabad Mills',           'bales':350, 'status':'Delivered',  'scheduledDate':'2026-03-28', 'carrier':'AgriFreight Ltd'},
    {'_id':'s3', 'shipmentId':'SHIP-4503', 'destination':'Surat Yarn Factory',        'bales':180, 'status':'In Transit', 'scheduledDate':'2026-04-05', 'carrier':'SpeedCargo Co.'},
    {'_id':'s4', 'shipmentId':'SHIP-4504', 'destination':'Delhi Textile Market',      'bales':420, 'status':'Pending',    'scheduledDate':'2026-04-10', 'carrier':'AgriFreight Ltd'},
    {'_id':'s5', 'shipmentId':'SHIP-4505', 'destination':'Coimbatore Spinning Mill',  'bales':310, 'status':'Pending',    'scheduledDate':'2026-04-12', 'carrier':'FastTrack Logistics'},
    {'_id':'s6', 'shipmentId':'SHIP-4506', 'destination':'Ludhiana Garment Cluster',  'bales':150, 'status':'Pending',    'scheduledDate':'2026-04-15', 'carrier':'AgriFreight Ltd'},
    {'_id':'s7', 'shipmentId':'SHIP-4507', 'destination':'Nagpur Cotton Exchange',    'bales':280, 'status':'In Transit', 'scheduledDate':'2026-04-03', 'carrier':'SpeedCargo Co.'},
    {'_id':'s8', 'shipmentId':'SHIP-4508', 'destination':'Pune Export Hub',           'bales':500, 'status':'Pending',    'scheduledDate':'2026-04-20', 'carrier':'AgriFreight Ltd'},
]

DEMO_ALERTS = [
    {'_id':'a1', 'type':'danger',  'message':'Warehouse B humidity level exceeded 60% (currently 61%). Immediate action required to prevent bale damage.', 'source':'Sensor',      'resolved':False, 'timeAgo':'10 mins ago'},
    {'_id':'a2', 'type':'warning', 'message':'Forecast update: Heavy rain expected next week in Vidarbha region. Protect exposed bales and check drainage.', 'source':'Weather',     'resolved':False, 'timeAgo':'2 hours ago'},
    {'_id':'a3', 'type':'info',    'message':'Shipment #SHIP-4502 to Ahmedabad Mills successfully loaded and dispatched. 350 bales.', 'source':'Logistics',   'resolved':False, 'timeAgo':'4 hours ago'},
    {'_id':'a4', 'type':'warning', 'message':'BATCH-005 and BATCH-008 are critically low on stock (< 150 bales each). Consider restocking.', 'source':'Inventory',   'resolved':False, 'timeAgo':'6 hours ago'},
    {'_id':'a5', 'type':'success', 'message':'AI Chatbot: Weekly inventory analysis complete. Premium grade stock at 85% capacity. All optimal.', 'source':'AI',          'resolved':False, 'timeAgo':'Yesterday'},
    {'_id':'a6', 'type':'info',    'message':'Scheduled maintenance for Warehouse A conveyor system on April 5, 2026. Plan accordingly.', 'source':'Maintenance', 'resolved':False, 'timeAgo':'2 days ago'},
    {'_id':'a7', 'type':'warning', 'message':'Price fluctuation detected: Cotton spot price dropped 3.2% in MCX. Review pricing strategy.', 'source':'Market',      'resolved':False, 'timeAgo':'3 days ago'},
]

DEMO_FORECAST = [
    {'month':'Apr', 'year':2025, 'predicted':420, 'actual':410, 'rainfall':45,  'temperature':28},
    {'month':'May', 'year':2025, 'predicted':380, 'actual':395, 'rainfall':62,  'temperature':31},
    {'month':'Jun', 'year':2025, 'predicted':440, 'actual':460, 'rainfall':110, 'temperature':29},
    {'month':'Jul', 'year':2025, 'predicted':500, 'actual':520, 'rainfall':145, 'temperature':26},
    {'month':'Aug', 'year':2025, 'predicted':560, 'actual':545, 'rainfall':130, 'temperature':25},
    {'month':'Sep', 'year':2025, 'predicted':530, 'actual':510, 'rainfall':90,  'temperature':26},
    {'month':'Oct', 'year':2025, 'predicted':490, 'actual':505, 'rainfall':40,  'temperature':28},
    {'month':'Nov', 'year':2025, 'predicted':450, 'actual':465, 'rainfall':15,  'temperature':24},
    {'month':'Dec', 'year':2025, 'predicted':410, 'actual':425, 'rainfall':8,   'temperature':21},
    {'month':'Jan', 'year':2026, 'predicted':390, 'actual':400, 'rainfall':5,   'temperature':19},
    {'month':'Feb', 'year':2026, 'predicted':420, 'actual':435, 'rainfall':10,  'temperature':22},
    {'month':'Mar', 'year':2026, 'predicted':460, 'actual':None,'rainfall':25,  'temperature':26},
]

DEMO_YIELD = [
    {'month':'Apr', 'year':2025, 'bales':410},
    {'month':'May', 'year':2025, 'bales':395},
    {'month':'Jun', 'year':2025, 'bales':460},
    {'month':'Jul', 'year':2025, 'bales':520},
    {'month':'Aug', 'year':2025, 'bales':545},
    {'month':'Sep', 'year':2025, 'bales':510},
    {'month':'Oct', 'year':2025, 'bales':505},
    {'month':'Nov', 'year':2025, 'bales':465},
    {'month':'Dec', 'year':2025, 'bales':425},
    {'month':'Jan', 'year':2026, 'bales':400},
    {'month':'Feb', 'year':2026, 'bales':435},
    {'month':'Mar', 'year':2026, 'bales':460},
]

# ─── Auth Middleware ──────────────────────────────────────────────────────────
def require_auth():
    if 'user' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    return None

# ─── Static Pages ─────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/login')
def login_page():
    return app.send_static_file('login.html')

@app.route('/dashboard')
def dashboard_page():
    if 'user' not in session:
        return redirect('/login')
    return app.send_static_file('dashboard.html')

# ─── Farmer Portal Routes ─────────────────────────────────────────────────────
@app.route('/farmer')
def farmer_index():
    farmer_folder = os.path.join(os.path.dirname(__file__), 'farmer')
    return send_from_directory(farmer_folder, 'index.html')

@app.route('/farmer/dashboard')
def farmer_dashboard():
    farmer_folder = os.path.join(os.path.dirname(__file__), 'farmer')
    return send_from_directory(farmer_folder, 'farmdashboard.html')

@app.route('/farmer/<path:filename>')
def farmer_static(filename):
    farmer_folder = os.path.join(os.path.dirname(__file__), 'farmer')
    return send_from_directory(farmer_folder, filename)

# ─── Auth Routes ──────────────────────────────────────────────────────────────
@app.route('/api/config')
def api_config():
    return jsonify({'client_id': os.getenv('GOOGLE_CLIENT_ID', '')})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    if email and password:
        session['user'] = {'email': email, 'name': email.split('@')[0]}
        return jsonify({'success': True, 'redirect': '/dashboard'})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/login/google', methods=['POST'])
def api_login_google():
    data = request.get_json()
    credential = data.get('credential')
    if credential:
        session['user'] = {'email': 'manager@cottonmitra.com', 'name': 'Demo Farm Manager'}
        return jsonify({'success': True, 'redirect': '/dashboard'})
    return jsonify({'success': False, 'message': 'Invalid token'}), 401

@app.route('/api/session', methods=['GET'])
def api_session():
    if 'user' in session:
        return jsonify({'success': True, 'user': session['user']})
    return jsonify({'success': False}), 401

@app.route('/api/logout')
def logout():
    session.pop('user', None)
    return redirect('/login')

# ─── Dashboard Stats ──────────────────────────────────────────────────────────
@app.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    auth_err = require_auth()
    if auth_err: return auth_err

    total_bales   = sum(int(i.get('bales', 0)) for i in DEMO_INVENTORY)
    premium_bales = sum(int(i.get('bales', 0)) for i in DEMO_INVENTORY if i['grade'] == 'Premium')
    premium_grade = round((premium_bales / total_bales) * 100) if total_bales else 0
    pending_ships = len([s for s in DEMO_SHIPMENTS if s['status'] in ('Pending', 'In Transit')])
    low_stock     = len([i for i in DEMO_INVENTORY if i['status'] == 'Low Stock'])

    return jsonify({
        'total_bales':        total_bales,
        'premium_grade':      premium_grade,
        'pending_shipments':  pending_ships,
        'low_stock':          low_stock,
        'alerts': [
            {'type': a['type'], 'message': a['message'], 'time': a['timeAgo'], 'id': a['_id']}
            for a in DEMO_ALERTS if not a['resolved']
        ][:5],
        'yield_chart': DEMO_YIELD
    })

# ─── Inventory Routes ─────────────────────────────────────────────────────────
@app.route('/api/inventory', methods=['GET'])
def api_inventory():
    auth_err = require_auth()
    if auth_err: return auth_err

    grade     = request.args.get('grade', '')
    status    = request.args.get('status', '')
    warehouse = request.args.get('warehouse', '')
    search    = request.args.get('search', '')
    page      = int(request.args.get('page', 1))
    limit     = int(request.args.get('limit', 8))

    items = list(DEMO_INVENTORY)
    if grade:     items = [i for i in items if i['grade'] == grade]
    if status:    items = [i for i in items if i['status'] == status]
    if warehouse: items = [i for i in items if i['warehouse'] == warehouse]
    if search:
        s = search.lower()
        items = [i for i in items if s in i['batchId'].lower() or s in i['location'].lower()]

    total = len(items)
    paged = items[(page-1)*limit : page*limit]
    return jsonify({'success': True, 'data': paged, 'total': total, 'page': page, 'pages': -(-total // limit)})

def get_age_days(arrival_date_str):
    if not arrival_date_str: return 0
    try:
        arr_date = datetime.strptime(arrival_date_str, '%Y-%m-%d')
        return (datetime.now() - arr_date).days
    except ValueError:
        return 0

@app.route('/api/inventory', methods=['POST'])
def api_inventory_add():
    auth_err = require_auth()
    if auth_err: return auth_err

    body = request.get_json()
    required = ['batchId', 'bales']
    for f in required:
        if not body.get(f):
            return jsonify({'success': False, 'message': f'{f} is required'}), 400

    # Check for duplicate batchId
    if any(i['batchId'] == body['batchId'] for i in DEMO_INVENTORY):
        return jsonify({'success': False, 'message': 'Batch ID already exists'}), 400

    new_item = {
        '_id':         'd' + str(int(time.time())),
        'batchId':     body['batchId'],
        'grade':       body.get('grade', 'Standard'),
        'bales':       int(body['bales']),
        'warehouse':   body.get('warehouse', 'Warehouse A'),
        'location':    body.get('location', 'Section 1'),
        'status':      body.get('status', 'In Stock'),
        'pricePerBale':int(body.get('pricePerBale', 1200)),
        'humidity':    int(body.get('humidity', 55)),
        'temperature': int(body.get('temperature', 22)),
        'notes':       body.get('notes', ''),
        'arrival_date':body.get('arrival_date', datetime.now().strftime('%Y-%m-%d'))
    }
    DEMO_INVENTORY.append(new_item)
    return jsonify({'success': True, 'data': new_item}), 201

@app.route('/api/inventory/<item_id>', methods=['PUT'])
def api_inventory_update(item_id):
    auth_err = require_auth()
    if auth_err: return auth_err

    body = request.get_json()
    item = next((i for i in DEMO_INVENTORY if i['_id'] == item_id), None)
    if not item:
        return jsonify({'success': False, 'message': 'Not found'}), 404
    update_data = {}
    for k, v in body.items():
        if k == '_id': continue
        if k in ['bales', 'pricePerBale', 'humidity', 'temperature'] and str(v).isdigit():
            update_data[k] = int(v)
        else:
            update_data[k] = v
    item.update(update_data)
    return jsonify({'success': True, 'data': item})

@app.route('/api/inventory/<item_id>', methods=['DELETE'])
def api_inventory_delete(item_id):
    auth_err = require_auth()
    if auth_err: return auth_err

    idx = next((i for i, item in enumerate(DEMO_INVENTORY) if item['_id'] == item_id), None)
    if idx is None:
        return jsonify({'success': False, 'message': 'Not found'}), 404
    DEMO_INVENTORY.pop(idx)
    return jsonify({'success': True, 'message': 'Deleted successfully'})

@app.route('/api/inventory/aging', methods=['GET'])
def api_inventory_aging():
    auth_err = require_auth()
    if auth_err: return auth_err
    aging_lots = []
    for i in DEMO_INVENTORY:
        age_days = get_age_days(i.get('arrival_date'))
        if age_days > 90:
            lot = dict(i)
            lot['age_days'] = age_days
            aging_lots.append(lot)
    return jsonify({'success': True, 'data': aging_lots})

@app.route('/api/inventory/quality', methods=['GET'])
def api_inventory_quality():
    auth_err = require_auth()
    if auth_err: return auth_err
    grade_a = len([i for i in DEMO_INVENTORY if i.get('grade') == 'Premium'])
    grade_b = len([i for i in DEMO_INVENTORY if i.get('grade') == 'Standard'])
    grade_c = len([i for i in DEMO_INVENTORY if i.get('grade') == 'Economy'])
    return jsonify({'success': True, 'data': {'A': grade_a, 'B': grade_b, 'C': grade_c}})

@app.route('/api/inventory/summary', methods=['GET'])
def api_inventory_summary():
    auth_err = require_auth()
    if auth_err: return auth_err
    total_stock = sum(int(i.get('bales', 0)) for i in DEMO_INVENTORY)
    aging_count = len([i for i in DEMO_INVENTORY if get_age_days(i.get('arrival_date')) > 90])
    grade_a = len([i for i in DEMO_INVENTORY if i.get('grade') == 'Premium'])
    grade_b = len([i for i in DEMO_INVENTORY if i.get('grade') == 'Standard'])
    grade_c = len([i for i in DEMO_INVENTORY if i.get('grade') == 'Economy'])
    forecast = 455.00 # Placeholder for forecast demand
    return jsonify({'success': True, 'data': {
        'total_stock': total_stock,
        'aging_lots': aging_count,
        'forecast_demand': forecast,
        'quality': {'A': grade_a, 'B': grade_b, 'C': grade_c}
    }})

@app.route('/api/inventory/reorder', methods=['GET'])
def api_inventory_reorder():
    auth_err = require_auth()
    if auth_err: return auth_err
    # Mock logic based on user's sample
    avg_daily = 455 / 30
    lead_time = 7
    safety_stock = 1.5 * 10
    rol = (avg_daily * lead_time) + safety_stock
    # Warehouse stock
    wh_stock = {}
    for lot in DEMO_INVENTORY:
        wh = lot.get('warehouse', 'Warehouse A')
        wh_stock[wh] = wh_stock.get(wh, 0) + int(lot.get('bales', 0))
    
    reorder_plan = []
    for wh, qty in wh_stock.items():
        if qty < rol:
            reorder_plan.append({
                'warehouse_id': wh,
                'current_qty': qty,
                'required_qty_mt': round(rol - qty, 2),
                'reason': 'Below ROL'
            })
    return jsonify({'success': True, 'data': reorder_plan, 'rol': round(rol, 2)})

# ─── Shipments Routes ─────────────────────────────────────────────────────────
@app.route('/api/shipments', methods=['GET'])
def api_shipments():
    auth_err = require_auth()
    if auth_err: return auth_err

    status = request.args.get('status', '')
    items  = [s for s in DEMO_SHIPMENTS if s['status'] == status] if status else list(DEMO_SHIPMENTS)
    return jsonify({'success': True, 'data': items})

@app.route('/api/shipments', methods=['POST'])
def api_shipments_add():
    auth_err = require_auth()
    if auth_err: return auth_err

    body = request.get_json()
    new_ship = {
        '_id':          's' + str(int(time.time())),
        'shipmentId':   body.get('shipmentId', 'SHIP-NEW'),
        'destination':  body.get('destination', ''),
        'bales':        int(body.get('bales', 0)),
        'status':       body.get('status', 'Pending'),
        'scheduledDate':body.get('scheduledDate', ''),
        'carrier':      body.get('carrier', 'AgriFreight Ltd'),
    }
    DEMO_SHIPMENTS.append(new_ship)
    return jsonify({'success': True, 'data': new_ship}), 201

@app.route('/api/shipments/<ship_id>', methods=['PUT'])
def api_shipments_update(ship_id):
    auth_err = require_auth()
    if auth_err: return auth_err

    body = request.get_json()
    ship = next((s for s in DEMO_SHIPMENTS if s['_id'] == ship_id), None)
    if not ship:
        return jsonify({'success': False, 'message': 'Not found'}), 404
    ship.update({k: v for k, v in body.items() if k != '_id'})
    return jsonify({'success': True, 'data': ship})

# ─── Forecast Routes ──────────────────────────────────────────────────────────
@app.route('/api/forecast', methods=['GET'])
def api_forecast():
    auth_err = require_auth()
    if auth_err: return auth_err

    if not ML_AVAILABLE:
        return jsonify({'success': False, 'message': 'ML engine not available. Install scikit-learn and pandas.'}), 503

    try:
        results, trend_val = get_forecast_data()
        # Split into history (actual) and forecast
        history  = [r for r in results if r['type'] == 'Actual']
        forecast = [r for r in results if r['type'] == 'Forecast']

        avg_actual = round(sum(r['value'] for r in history) / len(history), 2) if history else 0
        total_proj = round(sum(r['value'] for r in forecast), 2)
        trend_dir  = 'upward' if trend_val > 0 else 'downward' if trend_val < 0 else 'stable'

        return jsonify({
            'success':  True,
            'results':  results,
            'history':  history,
            'forecast': forecast,
            'trend_val': trend_val,
            'insights': {
                'avgActual':      avg_actual,
                'totalProjected': total_proj,
                'trend':          trend_dir,
                'trendVal':       trend_val,
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ─── Alerts Routes ────────────────────────────────────────────────────────────
@app.route('/api/alerts', methods=['GET'])
def api_alerts():
    auth_err = require_auth()
    if auth_err: return auth_err

    resolved_param = request.args.get('resolved')
    type_param     = request.args.get('type', '')

    items = list(DEMO_ALERTS)
    if resolved_param is not None:
        items = [a for a in items if str(a['resolved']).lower() == resolved_param.lower()]
    if type_param:
        items = [a for a in items if a['type'] == type_param]

    unread = len([a for a in DEMO_ALERTS if not a['resolved']])
    return jsonify({'success': True, 'data': items, 'unreadCount': unread})

@app.route('/api/alerts', methods=['POST'])
def api_alerts_add():
    auth_err = require_auth()
    if auth_err: return auth_err

    body = request.get_json()
    new_alert = {
        '_id':      'a' + str(int(time.time())),
        'type':     body.get('type', 'info'),
        'message':  body.get('message', ''),
        'source':   body.get('source', 'System'),
        'resolved': False,
        'timeAgo':  'Just now',
    }
    DEMO_ALERTS.insert(0, new_alert)
    return jsonify({'success': True, 'data': new_alert}), 201

@app.route('/api/alerts/resolve-all', methods=['PUT'])
def api_alerts_resolve_all():
    auth_err = require_auth()
    if auth_err: return auth_err

    for a in DEMO_ALERTS:
        a['resolved'] = True
    return jsonify({'success': True, 'message': 'All alerts resolved'})

@app.route('/api/alerts/<alert_id>/resolve', methods=['PUT'])
def api_alerts_resolve(alert_id):
    auth_err = require_auth()
    if auth_err: return auth_err

    alert = next((a for a in DEMO_ALERTS if a['_id'] == alert_id), None)
    if not alert:
        return jsonify({'success': False, 'message': 'Not found'}), 404
    alert['resolved'] = True
    return jsonify({'success': True, 'data': alert})

# ─── Chatbot Route ────────────────────────────────────────────────────────────
@app.route('/api/chat', methods=['POST'])
def api_chat():
    auth_err = require_auth()
    if auth_err: return auth_err

    body       = request.get_json()
    message    = body.get('message', '')
    session_id = body.get('sessionId', '')

    if not message or not session_id:
        return jsonify({'success': False, 'message': 'Message and sessionId required'}), 400

    total_bales   = sum(int(i.get('bales', 0)) for i in DEMO_INVENTORY)
    premium_bales = sum(int(i.get('bales', 0)) for i in DEMO_INVENTORY if i['grade'] == 'Premium')
    low_stock     = [i for i in DEMO_INVENTORY if i['status'] == 'Low Stock']
    pending_ships = len([s for s in DEMO_SHIPMENTS if s['status'] in ('Pending', 'In Transit')])
    active_alerts = len([a for a in DEMO_ALERTS if not a['resolved']])
    premium_pct   = round((premium_bales / total_bales) * 100) if total_bales else 0

    reply = generate_ai_response(message, {
        'totalBales': total_bales, 'premiumBales': premium_bales, 'premiumPct': premium_pct,
        'lowStockItems': low_stock, 'pendingShipments': pending_ships, 'activeAlerts': active_alerts,
    })
    return jsonify({'success': True, 'reply': reply, 'sessionId': session_id})

def generate_ai_response(message, ctx):
    msg = message.lower()
    total    = ctx['totalBales']
    premium  = ctx['premiumBales']
    pct      = ctx['premiumPct']
    low      = ctx['lowStockItems']
    ships    = ctx['pendingShipments']
    alerts   = ctx['activeAlerts']

    # 4. AGING RISK
    if any(word in msg for word in ["aging", "old stock", "90 days", "risk"]):
        aging_lots = [i for i in DEMO_INVENTORY if get_age_days(i.get('arrival_date')) > 90]
        if not aging_lots:
            return "No aging risk detected. All cotton lots are within safe storage duration."
        else:
            lots = ", ".join(i['batchId'] for i in aging_lots)
            return f"The following lots are **aging beyond 90 days** and require urgent action: {lots}"

    # 5. QUALITY RISK
    if any(word in msg for word in ["quality", "grade"]):
        if "grade a" in msg or "premium" in msg:
            high_quality = [i['batchId'] for i in DEMO_INVENTORY if i.get('grade') == 'Premium']
            return f"High-quality (Grade A / Premium) lots: {', '.join(high_quality)}"
        if "grade b" in msg or "standard" in msg:
            med_quality = [i['batchId'] for i in DEMO_INVENTORY if i.get('grade') == 'Standard']
            return f"Medium-quality (Grade B / Standard) lots: {', '.join(med_quality)}"
        if "grade c" in msg or "economy" in msg:
            low_quality = [i['batchId'] for i in DEMO_INVENTORY if i.get('grade') == 'Economy']
            return f"Low-quality (Grade C / Economy) lots: {', '.join(low_quality)}"
        return f"✨ **Quality Grade Analysis:**\n\nGrade A (Premium): {premium:,} bales\nGrade B/C (Standard/Economy): {total-premium:,} bales.\n\nSpecify 'grade A', 'grade B', or 'grade C' for details."

    # 6. REORDER RECOMMENDATION
    if any(word in msg for word in ["reorder", "refill", "shortage", "low stock"]):
        avg_daily = 455 / 30
        lead_time = 7
        safety_stock = 1.5 * 10
        rol = (avg_daily * lead_time) + safety_stock
        wh_stock = {}
        for lot in DEMO_INVENTORY:
            wh = lot.get('warehouse', 'Warehouse A')
            wh_stock[wh] = wh_stock.get(wh, 0) + lot['bales']
        
        reorder_plan = [wh for wh, qty in wh_stock.items() if qty < rol]
        
        if not reorder_plan:
            return "Current inventory is sufficient. No reorder required."
        
        result = "Reorder Recommendations:\n"
        for wh in reorder_plan:
            qty = wh_stock[wh]
            result += f"- {wh}: Reorder **{round(rol - qty, 2)} MT** (Reason: Below safe stock ROL)\n"
        return result

    # 8. INVENTORY SUMMARY
    if any(word in msg for word in ["summary", "overview", "report"]):
        aging = len([i for i in DEMO_INVENTORY if get_age_days(i.get('arrival_date')) > 90])
        demand = 455.00 # Placeholder forecast
        return (
            f"📌 **Cotton Inventory Summary**\n"
            f"- Total Stock: {total} MT\n"
            f"- Aging Lots (>90 days): {aging}\n"
            f"- Forecast Demand: {demand:.2f} MT\n"
        )

    if any(word in msg for word in ['shipment', 'dispatch', 'delivery']):
        return f"🚚 **Shipment Overview:**\n\nYou have **{ships} active shipment(s)** (Pending or In Transit).\n\nGo to **Inventory Management → Shipments** tab to track and manage them."
    if any(word in msg for w in ['alert', 'warn', 'danger']):
        if alerts == 0: return '✅ **All Clear!** No active alerts at this time.'
        return f"🔔 **Active Alerts: {alerts}**\n\nVisit the **Alerts** section to review and resolve them.\n\n• 🔴 **Danger** — Immediate action needed\n• 🟡 **Warning** — Monitor closely\n• 🔵 **Info** — Informational updates"
    if any(word in msg for word in ['forecast', 'predict', 'future']):
        avg = 455
        return f"📈 **Yield Forecast:**\n\n- **Average Monthly Yield:** ~{avg} bales\n- **Q2 2026 Projection:** ~{avg*3} bales\n- **Trend:** 📗 Upward — favorable conditions\n\nVisit the **Forecast** section for detailed charts."
    if any(word in msg for word in ['humidity', 'warehouse', 'storage']):
        return "🏭 **Warehouse Conditions:**\n\n- **Warehouse A:** Optimal (50–54%) ✅\n- **Warehouse B:** ⚠️ Elevated (58–61%) — Monitor closely\n- **Warehouse C:** Normal (55–60%)\n\n**Recommendation:** Activate dehumidifiers in Warehouse B. Target <55% humidity."
    if any(word in msg for word in ['hello', 'hi', 'hey', 'help']):
        return "👋 **Hello! I'm your Cotton Mitra AI Assistant.**\n\nI can help you with:\n\n📦 **Inventory Summary** — 'Show me the summary'\n⚠️ **Aging Risk** — 'Are there any aging lots?'\n⭐ **Quality Analysis** — 'Show grade a quality'\n📉 **Reorder Needs** — 'Do I need to reorder?'\n\nJust ask anything about your cotton operations!"
    return f"🤖 I understand you're asking about \"{message}\".\n\nTry asking:\n• *\"Show me the inventory summary\"*\n• *\"Identify aging risk\"*\n• *\"Do we need to reorder?\"*\n• *\"Show grade A quality\"*\n\nType **help** for more options."

if __name__ == '__main__':
    app.run(port=8000, debug=True)
