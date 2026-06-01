from authlib.integrations.flask_client import OAuth
from celery import Celery
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager
from pymongo import MongoClient
from pymongo.database import Database


class Mongo:
    def __init__(self) -> None:
        self.client: MongoClient | None = None

    def init_app(self, app) -> None:
        self.client = MongoClient(app.config["MONGO_URI"])

    @property
    def db(self) -> Database:
        if self.client is None:
            raise RuntimeError("Mongo client is not initialized. Call mongo.init_app(app) first.")

        db = self.client.get_default_database()
        if db is None:
            raise RuntimeError(
                "No default MongoDB database configured. Set a database in MONGO_URI or provide MONGO_DBNAME."
            )
        return db


mongo = Mongo()
login_manager = LoginManager()
oauth = OAuth()
celery_app = Celery()
limiter = Limiter(key_func=get_remote_address, default_limits=[])
