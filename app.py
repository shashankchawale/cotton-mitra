from flask import Flask, request, jsonify, session, redirect
import os
from dotenv import load_dotenv
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "super-secret-dev-key-123")
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '').strip()

@app.route('/')
def home():
    """Serves the main landing page."""
    return app.send_static_file('index.html')

@app.route('/login', methods=['GET'])
def login_page():
    """Serves the login page."""
    return app.send_static_file('login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    """Handles the login authentication request."""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    # Simple simulated authentication logic
    if email and len(password) >= 4:
        # Save user into session
        session['user'] = {"email": email, "name": email.split('@')[0]}
        return jsonify({"success": True, "message": "Authenticated successfully", "redirect": "/dashboard"}), 200
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/api/login/google', methods=['POST'])
def api_login_google():
    """Verifies a Google ID token sent from the frontend."""
    data = request.get_json(silent=True) or {}
    credential = data.get('credential', '').strip()

    if not credential:
        return jsonify({"success": False, "message": "Missing Google credential."}), 400

    # SIMULATED MODE: Log in immediately if using the mock token
    if credential.startswith('MOCK_GOOGLE_TOKEN'):
        if credential == 'MOCK_GOOGLE_TOKEN_2':
            session['user'] = {
                "email": "shashank@farmer.com",
                "name": "Shashank",
                "picture": ""
            }
        else:
            session['user'] = {
                "email": "manager@cottonmitra.com",
                "name": "Demo Farm Manager",
                "picture": "https://www.svgrepo.com/show/475656/google-color.svg"
            }
        
        return jsonify({
            "success": True,
            "message": "Mock Google authentication successful",
            "redirect": "/dashboard",
            "user": session['user']
        }), 200

    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID == 'YOUR_GOOGLE_CLIENT_ID':
        return jsonify({
            "success": False,
            "message": "Google login is currently disabled on the server. Please set GOOGLE_CLIENT_ID."
        }), 500

    try:
        token_info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        return jsonify({"success": False, "message": "Invalid Google token."}), 401

    if token_info.get('iss') not in {'accounts.google.com', 'https://accounts.google.com'}:
        return jsonify({"success": False, "message": "Untrusted Google token issuer."}), 401

    session['user'] = {
        "email": token_info.get('email'),
        "name": token_info.get('name'),
        "picture": token_info.get('picture'),
    }

    return jsonify({
        "success": True,
        "message": "Google authentication successful",
        "redirect": "/dashboard",
        "user": {
            "email": token_info.get('email'),
            "name": token_info.get('name'),
            "picture": token_info.get('picture'),
        }
    }), 200

@app.route('/api/config', methods=['GET'])
def api_config():
    """Exposes frontend-safe runtime config."""
    return jsonify({
        "googleClientId": GOOGLE_CLIENT_ID,
    })

@app.route('/dashboard')
def dashboard():
    """Serves the dashboard page."""
    if not session.get('user'):
        return redirect('/login')
    return app.send_static_file('dashboard.html')

@app.route('/api/session', methods=['GET'])
def api_session():
    """Returns the current logged-in user session."""
    user = session.get('user')
    if user:
        return jsonify({"success": True, "user": user}), 200
    return jsonify({"success": False, "message": "Not authenticated"}), 401

@app.route('/api/logout', methods=['POST', 'GET'])
def api_logout():
    """Clears the session and logs the user out."""
    session.pop('user', None)
    return redirect('/login')

@app.route('/api/dashboard/stats', methods=['GET'])
def dashboard_stats():
    """An example API endpoint fetching data from the backend to the frontend."""
    if not session.get('user'):
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({
        "total_bales": 4250,
        "premium_grade": 85,
        "pending_shipments": 12,
        "low_stock": 3,
        "alerts": [
            {"type": "danger", "message": "Warehouse B humidity level exceeded 60%. Action required.", "time": "10 mins ago"},
            {"type": "warning", "message": "Forecast update: Heavy rain expected next week. Protect exposed bales.", "time": "2 hours ago"}
        ]
    })

if __name__ == '__main__':
    print("Cotton Mitra Backend is running at http://127.0.0.1:5000/")
    app.run(debug=True, port=5000, use_reloader=False)
