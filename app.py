# app.py – einfacher Webserver zum Servieren der Leaflet-Anwendung
from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory(app.static_folder, path)

DEBUG = os.getenv('DEBUG', 'False').lower() in ('1', 'true', 'yes', 'on')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=DEBUG)
