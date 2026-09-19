from flask import Blueprint, redirect, render_template, url_for, request, jsonify
from typing import Any, Final, Sequence
from flask_login import current_user, login_required
from sqlalchemy import and_, func, or_

file_viewer_bp = Blueprint("file_viewer", __name__)

@file_viewer_bp.get("/FileViewer")
@login_required
def FileViewer():
    return render_template("FileViewer.html", title = "Permco File Viewer")