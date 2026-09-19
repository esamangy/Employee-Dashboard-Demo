from flask import Blueprint, request, jsonify
from App.API import JsonData
import App.Database.DatabaseSession as dbs
from App.API.User import _SimplifyUsers, GetCurrentUsersName
from flask_login import current_user

json_data_permissions_bp = Blueprint("json_data_permissions", __name__)

@json_data_permissions_bp.get("/api/JsonData/<int:data_id>/accessors")
def GetAccessors(data_id: int):
    with dbs.GetSession() as session:
        sharedWith = session.query(dbs.Schema.User).join(
            dbs.Schema.Json_Data_Permission,
            dbs.Schema.User.id == dbs.Schema.Json_Data_Permission.granted_to_id
        ).filter(
            dbs.Schema.Json_Data_Permission.json_data_id == data_id,
        ).all()

        return({
            "accessors": [{"id": current_user.id, "full_name": GetCurrentUsersName(), "email": current_user.email}] + _SimplifyUsers(sharedWith)
        }), 200
    return {"error": "No Database Session Active"}, 500

@json_data_permissions_bp.post("/api/JsonData/<int:data_id>/accessors")
def ShareJsonData(data_id: int):
    newAccessors = request.get_json()
    JsonData.RequirePermissionForEditingJsonData(current_user.id, data_id)
    with dbs.GetSession() as session:
        for accessor in newAccessors:
            json_permission = dbs.Schema.Json_Data_Permission(
                permission_type_id = dbs.GetJsonPermissionTypeIdByName("Viewer"),
                granted_by_id = current_user.id,
                granted_to_id = accessor,
                json_data_id = data_id
            )
            session.add(json_permission)
        try:
            session.commit()
            return jsonify({"message": "Data shared successfully"}), 200
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
            return {"error": "Could not add accessors"}, 500
        
    return {"error": "No Database Session Active"}, 500

@json_data_permissions_bp.delete("/api/JsonData/<int:data_id>/accessors")
def DeleteAccessors(data_id: int):
    JsonData.RequirePermissionForEditingJsonData(current_user.id, data_id)
    accessor_id = int(request.get_json())
    with dbs.GetSession() as session:
        permission_to_delete = session.query(dbs.Schema.Json_Data_Permission).filter_by(
            json_data_id = data_id,
            granted_to_id = accessor_id,
            granted_by_id = current_user.id,
        ).first()

        if permission_to_delete is None:
            return {"error": "No such accessor found"}, 404

        try:
            session.delete(permission_to_delete)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
            return {"error": "Could not delete accessor"}, 500

        return({"message": "Successfully unshared data"}), 200
    return {"error": "No Database Session Active"}, 500