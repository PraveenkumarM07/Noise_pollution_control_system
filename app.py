from flask import Flask, render_template, request, jsonify, session, redirect, url_for, abort
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import json
import uuid
from functools import wraps

# Application Configuration
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///instance/acousticguard_dev.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)

# Helper Functions
def get_noise_category(noise_level):
    """Determine noise category based on decibel level."""
    if noise_level <= 70:
        return 'safe'
    elif noise_level <= 85:
        return 'moderate'
    else:
        return 'harmful'

# Initialize Flask application
app = Flask(__name__)
app.config.from_object(Config)

# Ensure the instance folder exists
try:
    os.makedirs(os.path.join(app.root_path, 'instance'), exist_ok=True)
except OSError:
    pass

# Initialize extensions
db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False)
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    profile_image_url = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class NoiseReading(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    noise_level = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(20), nullable=False)  # 'safe', 'moderate', 'harmful'
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    location = db.Column(db.String(100))

class Device(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    device_name = db.Column(db.String(100), nullable=False)
    device_type = db.Column(db.String(50), nullable=False)
    battery_level = db.Column(db.Integer)
    is_connected = db.Column(db.Boolean, default=True)
    last_connected = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class HealthScore(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    factors = db.Column(db.Text)  # JSON string

class AiReductionLog(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    device_id = db.Column(db.String(36), db.ForeignKey('device.id'))
    input_level = db.Column(db.Float, nullable=False)
    output_level = db.Column(db.Float, nullable=False)
    reduction_amount = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class UserPreferences(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    daily_listening_limit = db.Column(db.Integer, default=480)  # minutes
    enable_ai_reduction = db.Column(db.Boolean, default=True)
    alert_threshold = db.Column(db.Float, default=75.0)
    notifications = db.Column(db.Boolean, default=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

def login_required_api(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'message': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Routes
@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('dashboard.html')
    else:
        return render_template('landing.html')

@app.route('/api/login', methods=['POST'])
def login():
    if not request.is_json:
        return jsonify({'error': 'Missing JSON data'}), 400

    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('firstName')
    last_name = data.get('lastName')
    
    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400
    
    try:
        user = User.query.filter_by(email=email).first()
        if not user:
            # Create new user for demo purposes
            user = User(
                email=email,
                first_name=first_name or 'User',
                last_name=last_name or ''
            )
            user.set_password(password)  # Set password hash
            db.session.add(user)
            db.session.commit()
        elif not user.check_password(password):
            return jsonify({'error': 'Invalid password'}), 401
        
        login_user(user, remember=True)
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'email': user.email,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'profileImageUrl': user.profile_image_url
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout')
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/api/auth/user')
@login_required_api
def get_user():
    return jsonify({
        'id': current_user.id,
        'email': current_user.email,
        'firstName': current_user.first_name,
        'lastName': current_user.last_name,
        'profileImageUrl': current_user.profile_image_url
    })

# API Routes for Bluetooth and Device Management
@app.route('/api/bluetooth/devices', methods=['GET'])
@login_required_api
def get_bluetooth_devices():
    try:
        devices = Device.query.filter_by(user_id=current_user.id).all()
        return jsonify([{
            'id': device.id,
            'deviceName': device.device_name,
            'deviceType': device.device_type,
            'batteryLevel': device.battery_level,
            'isConnected': device.is_connected,
            'lastConnected': device.last_connected.isoformat()
        } for device in devices])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bluetooth/connect', methods=['POST'])
@login_required_api
def connect_bluetooth_device():
    try:
        data = request.get_json()
        if not data or not data.get('deviceName'):
            return jsonify({'error': 'Device name is required'}), 400

        device = Device(
            user_id=current_user.id,
            device_name=data['deviceName'],
            device_type=data.get('deviceType', 'earbuds'),
            battery_level=data.get('batteryLevel', 100),
            is_connected=True
        )
        
        db.session.add(device)
        db.session.commit()

        # Emit WebSocket event for real-time updates
        socketio.emit('device_connected', {
            'deviceId': device.id,
            'deviceName': device.device_name,
            'deviceType': device.device_type,
            'batteryLevel': device.battery_level
        }, room=current_user.id)

        return jsonify({
            'message': 'Device connected successfully',
            'deviceId': device.id
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/bluetooth/disconnect/<device_id>', methods=['POST'])
@login_required_api
def disconnect_bluetooth_device(device_id):
    try:
        device = Device.query.filter_by(id=device_id, user_id=current_user.id).first()
        if not device:
            return jsonify({'error': 'Device not found'}), 404

        device.is_connected = False
        device.last_connected = datetime.utcnow()
        db.session.commit()

        socketio.emit('device_disconnected', {
            'deviceId': device.id,
            'deviceName': device.device_name
        }, room=current_user.id)

        return jsonify({'message': 'Device disconnected successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Noise monitoring routes
@app.route('/api/noise-readings', methods=['POST'])
@login_required_api
def create_noise_reading():
    data = request.get_json()
    
    reading = NoiseReading(
        user_id=current_user.id,
        noise_level=float(data['noiseLevel']),
        category=data['category'],
        location=data.get('location', 'Real-time monitoring')
    )
    
    db.session.add(reading)
    db.session.commit()
    
    # Emit to WebSocket clients
    socketio.emit('noise_reading', {
        'id': reading.id,
        'noiseLevel': str(reading.noise_level),
        'category': reading.category,
        'timestamp': reading.timestamp.isoformat(),
        'location': reading.location
    })
    
    return jsonify({
        'id': reading.id,
        'noiseLevel': str(reading.noise_level),
        'category': reading.category,
        'timestamp': reading.timestamp.isoformat(),
        'location': reading.location
    })

@app.route('/api/noise-readings')
@login_required_api
def get_noise_readings():
    limit = request.args.get('limit', 50, type=int)
    readings = NoiseReading.query.filter_by(user_id=current_user.id)\
        .order_by(NoiseReading.timestamp.desc()).limit(limit).all()
    
    return jsonify([{
        'id': r.id,
        'noiseLevel': str(r.noise_level),
        'category': r.category,
        'timestamp': r.timestamp.isoformat(),
        'location': r.location
    } for r in readings])

@app.route('/api/noise-readings/range')
@login_required_api
def get_noise_readings_range():
    start_date = datetime.fromisoformat(request.args.get('startDate'))
    end_date = datetime.fromisoformat(request.args.get('endDate'))
    
    readings = NoiseReading.query.filter(
        NoiseReading.user_id == current_user.id,
        NoiseReading.timestamp >= start_date,
        NoiseReading.timestamp <= end_date
    ).order_by(NoiseReading.timestamp.desc()).all()
    
    return jsonify([{
        'id': r.id,
        'noiseLevel': str(r.noise_level),
        'category': r.category,
        'timestamp': r.timestamp.isoformat(),
        'location': r.location
    } for r in readings])

@app.route('/api/devices', methods=['POST'])
@login_required_api
def create_device():
    data = request.get_json()
    
    device = Device(
        user_id=current_user.id,
        device_name=data['deviceName'],
        device_type=data['deviceType'],
        battery_level=data['batteryLevel']
    )
    
    db.session.add(device)
    db.session.commit()
    
    # Emit to WebSocket clients
    socketio.emit('device_status', {
        'id': device.id,
        'deviceName': device.device_name,
        'deviceType': device.device_type,
        'batteryLevel': device.battery_level,
        'isConnected': device.is_connected,
        'lastConnected': device.last_connected.isoformat()
    })
    
    return jsonify({
        'id': device.id,
        'deviceName': device.device_name,
        'deviceType': device.device_type,
        'batteryLevel': device.battery_level,
        'isConnected': device.is_connected,
        'lastConnected': device.last_connected.isoformat()
    })

@app.route('/api/devices')
@login_required_api
def get_devices():
    devices = Device.query.filter_by(user_id=current_user.id).all()
    
    return jsonify([{
        'id': d.id,
        'deviceName': d.device_name,
        'deviceType': d.device_type,
        'batteryLevel': d.battery_level,
        'isConnected': d.is_connected,
        'lastConnected': d.last_connected.isoformat()
    } for d in devices])

@app.route('/api/devices/<device_id>/status', methods=['PATCH'])
@login_required_api
def update_device_status(device_id):
    data = request.get_json()
    device = Device.query.filter_by(id=device_id, user_id=current_user.id).first()
    
    if not device:
        return jsonify({'message': 'Device not found'}), 404
    
    device.is_connected = data.get('isConnected', device.is_connected)
    if 'batteryLevel' in data:
        device.battery_level = data['batteryLevel']
    
    db.session.commit()
    
    # Emit to WebSocket clients
    socketio.emit('device_status', {
        'id': device.id,
        'deviceName': device.device_name,
        'deviceType': device.device_type,
        'batteryLevel': device.battery_level,
        'isConnected': device.is_connected,
        'lastConnected': device.last_connected.isoformat()
    })
    
    return jsonify({
        'id': device.id,
        'deviceName': device.device_name,
        'deviceType': device.device_type,
        'batteryLevel': device.battery_level,
        'isConnected': device.is_connected,
        'lastConnected': device.last_connected.isoformat()
    })

@app.route('/api/health-scores', methods=['POST'])
@login_required_api
def create_health_score():
    data = request.get_json()
    
    score = HealthScore(
        user_id=current_user.id,
        score=data['score'],
        factors=json.dumps(data.get('factors', {}))
    )
    
    db.session.add(score)
    db.session.commit()
    
    return jsonify({
        'id': score.id,
        'score': score.score,
        'date': score.date.isoformat(),
        'factors': json.loads(score.factors) if score.factors else {}
    })

@app.route('/api/health-scores/latest')
@login_required_api
def get_latest_health_score():
    score = HealthScore.query.filter_by(user_id=current_user.id)\
        .order_by(HealthScore.date.desc()).first()
    
    if not score:
        return jsonify({'score': 87})  # Default score
    
    return jsonify({
        'id': score.id,
        'score': score.score,
        'date': score.date.isoformat(),
        'factors': json.loads(score.factors) if score.factors else {}
    })

@app.route('/api/health-scores')
@login_required_api
def get_health_scores():
    limit = request.args.get('limit', 30, type=int)
    scores = HealthScore.query.filter_by(user_id=current_user.id)\
        .order_by(HealthScore.date.desc()).limit(limit).all()
    
    return jsonify([{
        'id': s.id,
        'score': s.score,
        'date': s.date.isoformat(),
        'factors': json.loads(s.factors) if s.factors else {}
    } for s in scores])

@app.route('/api/exposure-stats/today')
@login_required_api
def get_today_exposure_stats():
    today = datetime.now().date()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())
    
    readings = NoiseReading.query.filter(
        NoiseReading.user_id == current_user.id,
        NoiseReading.timestamp >= start_of_day,
        NoiseReading.timestamp <= end_of_day
    ).all()
    
    total_safe = sum(1 for r in readings if r.category == 'safe') * 5  # 5 minutes per reading
    total_moderate = sum(1 for r in readings if r.category == 'moderate') * 5
    total_harmful = sum(1 for r in readings if r.category == 'harmful') * 5
    
    return jsonify({
        'totalSafeTime': total_safe,
        'totalModerateTime': total_moderate,
        'totalHarmfulTime': total_harmful
    })

@app.route('/api/ai-reduction-logs', methods=['POST'])
@login_required_api
def create_ai_reduction_log():
    data = request.get_json()
    
    log = AiReductionLog(
        user_id=current_user.id,
        device_id=data.get('deviceId'),
        input_level=float(data['inputLevel']),
        output_level=float(data['outputLevel']),
        reduction_amount=float(data['reductionAmount'])
    )
    
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'id': log.id,
        'inputLevel': str(log.input_level),
        'outputLevel': str(log.output_level),
        'reductionAmount': str(log.reduction_amount),
        'timestamp': log.timestamp.isoformat()
    })

@app.route('/api/ai-reduction-logs')
@login_required_api
def get_ai_reduction_logs():
    limit = request.args.get('limit', 100, type=int)
    logs = AiReductionLog.query.filter_by(user_id=current_user.id)\
        .order_by(AiReductionLog.timestamp.desc()).limit(limit).all()
    
    return jsonify([{
        'id': l.id,
        'inputLevel': str(l.input_level),
        'outputLevel': str(l.output_level),
        'reductionAmount': str(l.reduction_amount),
        'timestamp': l.timestamp.isoformat()
    } for l in logs])

@app.route('/api/preferences')
@login_required_api
def get_preferences():
    prefs = UserPreferences.query.filter_by(user_id=current_user.id).first()
    
    if not prefs:
        # Create default preferences
        prefs = UserPreferences(
            user_id=current_user.id,
            daily_listening_limit=480,
            enable_ai_reduction=True,
            alert_threshold=75.0,
            notifications=True
        )
        db.session.add(prefs)
        db.session.commit()
    
    return jsonify({
        'id': prefs.id,
        'dailyListeningLimit': prefs.daily_listening_limit,
        'enableAiReduction': prefs.enable_ai_reduction,
        'alertThreshold': str(prefs.alert_threshold),
        'notifications': prefs.notifications
    })

@app.route('/api/preferences', methods=['PATCH'])
@login_required_api
def update_preferences():
    data = request.get_json()
    prefs = UserPreferences.query.filter_by(user_id=current_user.id).first()
    
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.session.add(prefs)
    
    if 'dailyListeningLimit' in data:
        prefs.daily_listening_limit = data['dailyListeningLimit']
    if 'enableAiReduction' in data:
        prefs.enable_ai_reduction = data['enableAiReduction']
    if 'alertThreshold' in data:
        prefs.alert_threshold = float(data['alertThreshold'])
    if 'notifications' in data:
        prefs.notifications = data['notifications']
    
    db.session.commit()
    
    return jsonify({
        'id': prefs.id,
        'dailyListeningLimit': prefs.daily_listening_limit,
        'enableAiReduction': prefs.enable_ai_reduction,
        'alertThreshold': str(prefs.alert_threshold),
        'notifications': prefs.notifications
    })

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        join_room(current_user.id)
        emit('connected', {
            'message': 'Connected to NoiseGuard real-time updates',
            'userId': current_user.id
        })
    else:
        return False  # Reject connection if not authenticated

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        leave_room(current_user.id)

@socketio.on('device_update')
def handle_device_update(data):
    if not current_user.is_authenticated:
        return
    
    try:
        device_id = data.get('deviceId')
        if not device_id:
            return
        
        device = Device.query.filter_by(
            id=device_id, 
            user_id=current_user.id
        ).first()
        
        if not device:
            return
        
        # Update device status
        if 'batteryLevel' in data:
            device.battery_level = data['batteryLevel']
        if 'noiseLevel' in data:
            # Create noise reading
            reading = NoiseReading(
                user_id=current_user.id,
                device_id=device_id,
                noise_level=float(data['noiseLevel']),
                category=get_noise_category(float(data['noiseLevel']))
            )
            db.session.add(reading)
        
        db.session.commit()
        
        # Emit update to all clients in the user's room
        emit('device_status', {
            'deviceId': device.id,
            'batteryLevel': device.battery_level,
            'lastUpdate': datetime.utcnow().isoformat()
        }, room=current_user.id)
        
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})

# Error Handlers
@app.errorhandler(400)
def bad_request_error(error):
    return jsonify({
        'error': 'Bad request',
        'message': str(error)
    }), 400

@app.errorhandler(401)
def unauthorized_error(error):
    return jsonify({
        'error': 'Unauthorized',
        'message': 'Please log in to access this resource'
    }), 401

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({
        'error': 'Not found',
        'message': 'The requested resource was not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred'
    }), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, 
                debug=True, 
                host='0.0.0.0', 
                port=5000,
                ssl_context=None,  # Set to 'adhoc' for HTTPS in production
                cors_allowed_origins="*")
