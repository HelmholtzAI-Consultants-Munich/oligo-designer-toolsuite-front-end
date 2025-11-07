from flask_pymongo import PyMongo
from flask_login import LoginManager
from authlib.integrations.flask_client import OAuth

mongo = PyMongo()
login_manager = LoginManager()
oauth = OAuth()