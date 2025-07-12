# Athene

Athene is a small Flask application serving a Leaflet-based map interface. It allows you to add or remove vehicles and direct them to a location on the map.

## Requirements

- Python 3.x
- Flask

## Installation

1. It is recommended to use a virtual environment.
2. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

Start the Flask server with:

```bash
python app.py
```

Once running, open [http://localhost:5000](http://localhost:5000) in your browser.

## Using the Web Interface

- The top-left controls let you switch between different map layers.
- Use "+ Fahrzeug" to add a ground vehicle and "– Fahrzeug" to remove the selected one.
- Click anywhere on the map to move all vehicles and the aircraft to that location.

Enjoy exploring the demo!

