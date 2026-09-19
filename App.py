import os
from flask import Flask
from App.Login import InitializeAuthorizationFeatures
from App.Vite import ViteAsset, ViteClient
from App import blueprints

app = Flask(__name__, static_folder='src', static_url_path='/src')
app.json.sort_keys = False # type: ignore
app.secret_key = os.getenv("APP_SECRET_KEY")

for bp in blueprints:
    app.register_blueprint(bp)

app.jinja_env.globals["vite_asset"] = ViteAsset
app.jinja_env.globals["vite_client"] = ViteClient

if __name__ == "__main__":
    InitializeAuthorizationFeatures(app)
    app.run(debug=True)


# print commit logs : git --no-pager log > log.txt