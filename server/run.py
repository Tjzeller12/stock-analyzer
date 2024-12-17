import logging
from app import create_app
# Create and configure flask app
FLASK_APP = create_app()
logging.basicConfig(level=logging.DEBUG)
#Check if program is being ran directly
if __name__ == '__main__':
    #Starts flask development server and enables debug mode
    FLASK_APP.run(debug=True)