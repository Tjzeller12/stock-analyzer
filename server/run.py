from app import create_app
# Create and configure flask app
app = create_app()
#Check if program is being ran directly
if __name__ == '__main__':
    #Starts flask development server and enables debug mode
    app.run(debug=True)