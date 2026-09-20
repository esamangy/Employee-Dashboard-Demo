import os
from flask import Flask, Blueprint, abort, redirect, render_template, url_for
from flask_login import current_user, login_required, LoginManager, login_user, logout_user
from authlib.integrations.flask_client import OAuth
from App.API import User
import App.Database.DatabaseSession as dbs

login_bp = Blueprint("login", __name__)
oauth: OAuth
login_manager = LoginManager()

def InitializeAuthorizationFeatures(app: Flask):
    login_manager.login_view = "/" # type: ignore
    login_manager.init_app(app)
    app.config['SERVER_NAME'] = '127.0.0.1:5000'
    global oauth
    oauth = OAuth(app)

@login_manager.user_loader
def load_user(user_id):
    if user_id is None or user_id == "None":
        return None
    with dbs.GetSession() as session:
        return session.query(dbs.Schema.User).get(int(user_id))
    return {"error": "No Database Session Active"}, 500

@login_bp.route("/")
def Index():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.Dashboard"))
    return redirect(url_for("login.Login"))

@login_bp.route("/login")
def Login():
    return render_template("Login.html", excludeHeader=True)

@login_bp.route("/login/google")
def Google():
    gClientId = os.getenv("GOOGLE_CLIENT_ID")
    gClientSecret = os.getenv("GOOGLE_CLIENT_SECRET")
    confURL = os.getenv("GOOGLE_DISCOVERY_URL")
    oauth.register(
        name = "google",
        client_id = gClientId,
        client_secret = gClientSecret,
        server_metadata_url = confURL,
        client_kwargs = {"scope": "openid email profile"})
    redirect_uri = url_for("login.GoogleCallback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

#this is a bypass for viewping purposes
@login_bp.route("/login/bypass")
def Bypass():
    User.InsertUser(
        name = "Bypass User",
        first_name = "Bypass",
        last_name = "User",
        email = "bypass@example.com",
        google_sub = "bypass_user",
        role_id = dbs.GetRoleIdByName("Admin")
    )
    user = dbs.GetSession().query(dbs.Schema.User).filter_by(google_sub="bypass_user").first()
    dbs.GetSession().commit()
    login_user(user)
    return redirect(url_for("dashboard.Dashboard"))

@login_bp.route("/login/google/callback")
def GoogleCallback():
    token = oauth.google.authorize_access_token()
    user_info = token["userinfo"]

    if user_info.get("hd") != os.getenv("ALLOWED_DOMAIN"):
        abort(403)
    with dbs.GetSession() as session:
        user = session.query(dbs.Schema.User).filter_by(google_sub=user_info["sub"]).first()
        if user is None:
            #new user
            User.InsertUser(
                name = user_info["name"],
                first_name = user_info["given_name"],
                last_name = user_info["family_name"],
                email = user_info["email"],
                google_sub = user_info["sub"],
                role_id = dbs.GetRoleIdByName("Default")
            )
            user = session.query(dbs.Schema.User).filter_by(google_sub=user_info["sub"]).first()
        else:
            #returning user
            user.email = user_info["email"]
            user.full_name = user_info.get("name")
            user.first_name = user_info["given_name"]
            user.last_name = user_info["family_name"]
        session.commit()
        login_user(user)
        return redirect("/")
    return {"error": "No Database Session Active"}, 501

@login_bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect("/")