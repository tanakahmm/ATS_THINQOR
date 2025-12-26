from waitress import serve
from app import app
from utils.logger import setup_logger

logger = setup_logger("server")

if __name__ == "__main__":
    logger.info("Starting ATS Backend with Waitress (Production Mode)...")
    logger.info("Serving on http://0.0.0.0:5001")
    
    # Run the server
    # threads=6 ensures we can handle multiple async screening requests efficiently
    # Note: Use 'python app.py' for development with debug mode
    serve(app, host="0.0.0.0", port=5001, threads=6)
