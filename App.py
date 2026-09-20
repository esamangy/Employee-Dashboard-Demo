import os
from flask import Flask
from App.Login import InitializeAuthorizationFeatures
from App.Vite import ViteAsset, ViteClient
from App import blueprints

from App.Database import DatabaseSession as dbs

app = Flask(__name__, static_folder='src', static_url_path='/src')
app.json.sort_keys = False # type: ignore
app.secret_key = os.getenv("APP_SECRET_KEY")

for bp in blueprints:
    app.register_blueprint(bp)

app.jinja_env.globals["vite_asset"] = ViteAsset
app.jinja_env.globals["vite_client"] = ViteClient

#this is here to add some of the datathat would be expected to be in the
def AddDefaultDatabaseData():
    dbs.InsertRole("Admin")
    dbs.InsertRole("Default")

    dbs.InsertDataType("sales_app_report")
    dbs.InsertDataType("sales_app_report_draft")

    dbs.InsertCustomer("Default Customer", "DEF*ULT")
    dbs.InsertCustomer("Test Customer", "TES*TER")

if __name__ == "__main__":
    InitializeAuthorizationFeatures(app)
    AddDefaultDatabaseData()
    app.run(debug=True)
