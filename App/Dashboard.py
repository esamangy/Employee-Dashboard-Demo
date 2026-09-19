from flask import Blueprint, redirect, render_template, url_for, jsonify
from flask_login import login_required


dashboard_bp = Blueprint("dashboard", __name__)

@login_required
@dashboard_bp.route("/Dashboard")
def Dashboard():
    return redirect(url_for("dashboard.DashboardHome"))

@login_required
@dashboard_bp.route("/Dashboard/Dashboard")
def DashboardHome():
    return render_template("Dashboard/Home.html", title="Dashboard")

@login_required
@dashboard_bp.route("/Dashboard/AllApps")
def DashboardAllApps():
    return render_template("Dashboard/AllApps.html", title="All Apps")

@login_required
@dashboard_bp.route("/Dashboard/Notifications")
def DashboardNotifications():
    return render_template("Dashboard/Notifications.html", title="Notifications")

@login_required
@dashboard_bp.get("/Dashboard/Apps/<string:page>")
def GetAppsForPage(page:str):
    return jsonify({"page": page, "apps": GetAllowedApps(page)})

# this is a placeholder function to simulate fetching allowed apps for the user. Will need updated to access permissions database and return appropriate apps based on user permissions
def GetAllowedApps(page:str) -> list:
    page = page.lower()
    if(page == "recents"):
        return [{"name": "Permco Sales App", "image": url_for("static", filename= "img/Permco Sales App Logo.png"), "alt": "Permco Sales App Logo", "dest": "/SalesApp"}]
    elif(page == "allapps"):
        return [{"name": "Permco Sales App", "image": url_for("static", filename= "img/Permco Sales App Logo.png"), "alt": "Permco Sales App Logo", "dest": "/SalesApp"}]
    else:
        raise FileNotFoundError("App page for ${page} doesn't exist")