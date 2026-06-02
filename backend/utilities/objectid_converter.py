import bson
from werkzeug.exceptions import BadRequest
from werkzeug.routing import BaseConverter


class ObjectIdConverter(BaseConverter):
    def to_python(self, value):
        try:
            return bson.ObjectId(value)
        except bson.errors.InvalidId as e:
            raise BadRequest(str(e))

    def to_url(self, value):
        return str(value)

    @classmethod
    def register_in_flask(cls, flask_app):
        flask_app.url_map.converters["ObjectId"] = cls
