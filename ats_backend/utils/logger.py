import logging
import os
import sys

def setup_logger(name=__name__):
    """
    Sets up a logger that writes to both file and console (stdout).
    """
    logger = logging.getLogger(name)
    
    # If logger already has handlers, assume it's configured to prevent duplicate logs
    if logger.handlers:
        return logger
        
    logger.setLevel(logging.DEBUG)  # Capture all logs

    # Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # File Handler
    log_file = os.path.join(os.getcwd(), 'ats_backend.log')
    try:
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"Failed to create file handler for logger: {e}")

    # Console Handler (StreamHandler)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(logging.INFO)  # Keep console clean, usually INFO
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    return logger
