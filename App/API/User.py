from flask import Blueprint, request, jsonify
from typing import Any, Final
from sqlalchemy import or_
from App.Database import Schema
import App.Database.DatabaseSession as dbs
from flask_login import current_user, login_required

users_bp = Blueprint("users", __name__)

USER_MAX_SEARCH_RESULTS: Final[int] = 25

@users_bp.get("/api/user")
def GetCurrentUser():
    if current_user.is_authenticated:
        return jsonify({
            "id": current_user.id,
            "full_name": current_user.full_name,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "email": current_user.email,
        }), 200
    else:
        return jsonify({"error": "User not authenticated"}), 401

@users_bp.get("/api/users/searchNameAndEmail")
@login_required
def SearchUsersByNameAndEmail():
    chars = request.args.get("chars", "").strip()
    try:
        with dbs.GetSession() as session:
            users = session.query(dbs.Schema.User).filter(
                dbs.Schema.User.id != current_user.id,
                or_(
                    dbs.Schema.User.full_name.ilike(f"%{chars}%"),
                    dbs.Schema.User.email.ilike(f"%{chars}%")
                )
            ).limit(USER_MAX_SEARCH_RESULTS).all()

            return jsonify({"users": _SimplifyUsers(users)}), 200
        raise Exception("No Database Session Active. Failed to upload files.")
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"users": []}), 500

def InsertUser(name: str, first_name: str, last_name: str, email: str, google_sub: str, role_id: int):
    with dbs.GetSession() as session:
        user = Schema.User(
            role_id=role_id,
            google_sub=google_sub,
            full_name=name if name is not None else first_name + " " + last_name,
            first_name = first_name,
            last_name = last_name,
            email=email
        )

        try:
            session.add(user)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
            raise Exception("Failed to insert user into database.")

def CanAccessSalesManagerDashboard() -> bool: #Temporary function until I have implemented a universal role permission system
    acceptedRoles = {
        "Admin",
        "Sales Manager"
    }
    return dbs.GetRoleNameFromId(current_user.role_id) in acceptedRoles

def _SimplifyUsers(users) -> list[dict[str, Any]]:
    return [
        {
            "id": user.id,
            "full_name": user.full_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        } for user in users
    ]

def GetCurrentUsersName() -> str:
    if current_user.is_authenticated:
        if current_user.full_name is not None:
            return current_user.full_name
        else:
            return current_user.first_name + " " + current_user.last_name
    else:
        raise dbs.AccessDeniedError()
    
def GetUsersInfo(user_id: int) -> dict[str, Any]:
    with dbs.GetSession() as session:
        user = session.query(dbs.Schema.User).filter_by(id=user_id).first()
        if user is None:
            raise FileNotFoundError(f"User with id {user_id} not found")
        return {
            "full_name": user.full_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        }
    raise Exception("No Database Session Active. Failed to get user info.")