from celery import Celery
from flask_pymongo import PyMongo
from flask_login import LoginManager
from authlib.integrations.flask_client import OAuth
from flask_login import LoginManager
from flask_pymongo import PyMongo

mongo = PyMongo()
login_manager = LoginManager()
oauth = OAuth()
celery_app = Celery()
