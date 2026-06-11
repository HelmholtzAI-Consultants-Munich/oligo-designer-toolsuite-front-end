from authlib.integrations.flask_client import OAuth
from celery import Celery
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager
from pymongo import MongoClient

from backend.config import Config

client = MongoClient(Config.MONGO_URI)
db = client["oligo_db"]

login_manager = LoginManager()
oauth = OAuth()
celery_app = Celery()
limiter = Limiter(key_func=get_remote_address, default_limits=[], storage_uri=Config.REDIS_URI)
