from typing import Final
from flask import Blueprint, request, jsonify
from App.API.User import CanAccessSalesManagerDashboard
import App.Database.DatabaseSession as dbs
from App.Database import Schema
from sqlalchemy import func, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm.attributes import flag_modified
from flask_login import current_user, login_required

json_data_bp = Blueprint("json_data", __name__)
COMPANY_MAX_SEARCH_RESULTS: Final[int] = 10

@json_data_bp.route("/api/JsonData" , methods=["GET"])
@login_required
def GetDatas():
    raise NotImplementedError("Not implemented yet")

@json_data_bp.route("/api/JsonData" , methods=["POST"])
@login_required
def InsertData():
    raise NotImplementedError("Not implemented yet")

@json_data_bp.route("/api/JsonData/<int:data_id>" , methods=["GET"])
@login_required
def GetData(data_id: int):
    report = GetJsonDataById(data_id, False)
    return jsonify({"data": report.data, "isDraft": report.data_type_id == dbs.GetDataTypeIdByName("sales_app_report_draft"), "meta": report.meta_data}), 200
    

@json_data_bp.route("/api/JsonData/<int:data_id>/rename" , methods=["PATCH"])
@login_required
def RenameData(data_id: int):
    data = request.get_json()
    newTitle = data.get("file_name")
    try:
        RenameJsonData(data_id, newTitle)
        return jsonify({
            "report_name": newTitle,
            "file_id": data_id
        }), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@json_data_bp.route("/api/JsonData/<int:data_id>/update" , methods=["PATCH"])
@login_required
def UpdateData(data_id: int):
    raise NotImplementedError("Not implemented yet")

@json_data_bp.route("/api/JsonData/<int:data_id>/delete" , methods=["DELETE"])
@login_required
def DeleteData(data_id: int):
    RequirePermissionForEditingJsonData(current_user.id, data_id)
    try:
        dbs.DeleteJsonData(data_id, current_user.id)
        return jsonify({
            "message": "Data deleted successfully",
            "file_id": data_id
        }), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

def InsertJsonData(data_type_id:int, data:dict, title:str, meta:dict) -> int:
    with dbs.GetSession() as session:
        json_data = Schema.Json_Data(
            owner_id = current_user.id,
            data_type_id = data_type_id,
            data = data,
            title = title,
            meta_data = meta
        )

        try:
            session.add(json_data)
            session.commit()
            session.refresh(json_data)
            return json_data.id
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
            return -1

def RequirePermissionForViewingJsonData(user_id: int, json_data_id: int) -> None:
    if CanAccessSalesManagerDashboard():
        return # if the user is a manager, then they can access it
    
    with dbs.GetSession() as session:
        record = session.query(Schema.Json_Data).outerjoin(
            Schema.Json_Data_Permission,
            Schema.Json_Data.id == Schema.Json_Data_Permission.json_data_id
        ).filter(Schema.Json_Data.id == json_data_id).filter(or_(
            Schema.Json_Data.owner_id == user_id,
            Schema.Json_Data_Permission.granted_to_id == user_id
        )).first()

        if record is None:
            raise dbs.AccessDeniedError("You do not have permission to access this data.")
    
def RequirePermissionForEditingJsonData(user_id: int, json_data_id: int) -> None:
    if CanAccessSalesManagerDashboard():
        return # if the user is a manager, then they can access it
    
    with dbs.GetSession() as session:
        record = session.query(Schema.Json_Data).filter_by(id=json_data_id, owner_id=user_id).first()

    if record is None:
        raise dbs.AccessDeniedError("You do not have permission to access this data.")

def GetJsonDataById(data_id: int, wantManagerAccess: bool) -> Schema.Json_Data:
    with dbs.GetSession() as session:
        if wantManagerAccess and not CanAccessSalesManagerDashboard():
            raise dbs.AccessDeniedError("You do not have permission to access this data.")
        elif not wantManagerAccess:
            RequirePermissionForViewingJsonData(current_user.id, data_id)
        report = session.query(dbs.Schema.Json_Data).filter_by(id = data_id).first()
        if report is None:
            raise FileNotFoundError("Report not found")
        return report
    raise Exception("No Database Session Active")

def RenameJsonData(json_data_id: int, new_title: str):
    RequirePermissionForEditingJsonData(current_user.id, json_data_id)
    with dbs.GetSession() as session:
        json_data = session.query(Schema.Json_Data).filter_by(id = json_data_id, owner_id = current_user.id).first()

        if json_data is None:
            raise FileNotFoundError(f"No JSON data found with id {json_data_id} and owner id {current_user.id}")

        try:
            json_data.title = new_title
            json_data.updated_at = func.now()
            json_data.renamed = True
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
        return
    raise Exception("No Database Session Active. Failed to update last opened at.")

def ReplaceJsonDataMetaData(json_data_id: int, new_meta_data: dict):
    RequirePermissionForEditingJsonData(current_user.id, json_data_id)
    with dbs.GetSession() as session:
        json_data = session.query(Schema.Json_Data).filter_by(id = json_data_id, owner_id = current_user.id).first()

        if json_data is None:
            raise FileNotFoundError(f"No JSON data found with id {json_data_id} and owner id {current_user.id}")

        try:
            json_data.meta_data = new_meta_data
            json_data.updated_at = func.now()
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
        return
    raise Exception("No Database Session Active. Failed to update last opened at.")

def UpdateJsonDataMetaData(json_data_id:int, data_key:str, newData):
    RequirePermissionForEditingJsonData(current_user.id, json_data_id)
    with dbs.GetSession() as session:
        json_data = session.query(Schema.Json_Data).filter_by(id = json_data_id, owner_id = current_user.id).first()

        if json_data is None:
            raise FileNotFoundError(f"No JSON data found with id {json_data_id} and owner id {current_user.id}")

        try:
            json_data.meta_data[data_key] = newData
            flag_modified(json_data, "meta_data")
            json_data.updated_at = func.now()
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
        return
    raise Exception("No Database Session Active. Failed to update last opened at.")

def UpdateLastOpenedAt(json_data_id: int, viewer_id: int):
    with dbs.GetSession() as session:
        try:
            #check if json_data exists
            json_data = session.query(Schema.Json_Data).filter_by(id=json_data_id).first()
            if json_data is None:
                raise FileNotFoundError(f"No JSON data found with id {json_data_id}")
            
            #check if viewer has permission to view the json_data
            RequirePermissionForViewingJsonData(viewer_id, json_data_id)

            stmt = insert(Schema.User_Json_Data_Activity).values(
                user_id = viewer_id,
                json_data_id = json_data_id,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["json_data_id", "user_id"],
                set_={
                    "last_viewed_at": func.now(),
                },
            )
            
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
        return
    raise Exception("No Database Session Active. Failed to update last opened at.")