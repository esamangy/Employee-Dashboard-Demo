from App.API import json_data_bp, users_bp, json_data_permissions_bp, files_bp, customers_bp
from App.Login import login_bp
from App.Dashboard import dashboard_bp
from App.SalesApp import sales_app_bp
from App.FileViewer import file_viewer_bp

blueprints = [
    json_data_bp,
    users_bp,
    json_data_permissions_bp,
    files_bp,
    customers_bp,
    login_bp,
    dashboard_bp,
    sales_app_bp,
    file_viewer_bp
]