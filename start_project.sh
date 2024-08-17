#!/bin/bash

unalias python 2>/dev/null || true

if [[ ! -z "$CONDA_DEFAULT_ENV" ]]; then
    conda deactivate
fi

if [ -d "server/venv" ]; then
    source server/venv/bin/activate
else 
    echo "Virtual evironment not found. Please check its location."
    exit 1
fi
#verity that the correct python is being used
VENV_PYTHON=$(which python)
echo "Using Python from: $VENV_PYTHON"

#Set up envormnet variables
export FLASK_APP=server/app.py
export FLASK_ENV=development

echo "Enviroment activated. You can now run the Flask app with 'python server/app.py'"
