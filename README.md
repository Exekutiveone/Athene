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
- Click anywhere on the map to move all vehicles to that location.

Enjoy exploring the demo!

This project provides a simple Flask web server for serving the Leaflet-based asset map.

## Installation

Install the required dependencies using pip:

```bash
pip install -r requirements.txt
```

## Usage

After installing the dependencies, start the application with:

```bash
python app.py
This project contains a small Flask application that serves the files from the
`static` directory. It is intended for quickly testing the Leaflet front end.

## Running

Install the dependencies and start the server:

```bash
pip install Flask
python app.py
```

### Debug mode

The Flask debug mode can be toggled by setting the `DEBUG` environment
variable. When `DEBUG` is set to a truthy value (`1`, `true`, `yes` or
`on`), the server starts with `debug=True`.

```bash
DEBUG=1 python app.py  # start with debug mode enabled
```
