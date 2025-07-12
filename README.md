# Athene

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
