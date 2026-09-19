from flask_login import current_user
from sqlalchemy.orm import Session
from App.Database.DatabaseProviders import TestSessionProvider
from App.Database import Schema

db_provider = TestSessionProvider()

class AccessDeniedError(Exception):
    pass

def GetSession() -> Session:
    return db_provider.GetSession()

def InsertDataType(type_name: str):
    with GetSession() as session:
        data_type = Schema.Data_Type(
            type_name = type_name
        )

        try:
            session.add(data_type)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")

def InsertRole(name: str):
    with GetSession() as session:
        role = Schema.Role(
            role_name=name
        )

        try:
            session.add(role)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")

def GetDataTypeIdByName(type_name: str) -> int:
    with GetSession() as session:
        result = session.query(Schema.Data_Type).filter_by(type_name = type_name).first()

        if result is None:
            raise FileNotFoundError(f"No data type found with name {type_name}")
        
        return result.id
    raise Exception("No Database Session Active. Failed to get data type ID.")

def GetRoleIdByName(role_name: str) -> int:
    with GetSession() as session:
        result = session.query(Schema.Role).filter_by(role_name = role_name).first()

        if result is None:
            raise FileNotFoundError(f"No role found with name {role_name}")
        
        return result.id
    raise Exception("No Database Session Active. Failed to get role ID.")

def GetRoleNameFromId(role_id) -> str:
    with GetSession() as session:
        result = session.query(Schema.Role).filter_by(id = role_id).first()

        if result is None:
            raise FileNotFoundError(f"No role found with id {role_id}")
        
        return result.role_name
    raise Exception("No Database Session Active. Failed to get role ID.")

def GetDataTypeIdsByName(*type_names: str) -> list[int]:
    with GetSession() as session:

        file_types = (
            session.query(Schema.Data_Type).filter(Schema.Data_Type.type_name.in_(type_names)).all()
        )

        return [file_type.id for file_type in file_types]

def GetJsonPermissionTypeIdByName(type_name: str) -> int:
    with GetSession() as session:
        result = session.query(Schema.Permission_Type).filter_by(permission_name = type_name).first()

        if result is None:
            raise FileNotFoundError(f"No permission type found with name {type_name}")
        
        return result.id
    raise Exception("No Database Session Active. Failed to get permission type ID.")

def GetJsonPermissionTypeIdsByName(*type_names: str) -> list[int]:
    with GetSession() as session:

        file_types = (
            session.query(Schema.Permission_Type).filter(Schema.Permission_Type.permission_name.in_(type_names)).all()
        )

        return [file_type.id for file_type in file_types]

def DeleteJsonData(json_data_id: int, owner_id: int):
    with GetSession() as session:
        json_data = session.query(Schema.Json_Data).filter_by(id=json_data_id, owner_id=owner_id).first()

        if json_data is None:
            raise FileNotFoundError(f"No JSON data found with id {json_data_id} and owner id {owner_id}")

        # this is temporary code to cascade the deletion of reports to the files attached to them
        if(json_data.meta_data):
            if json_data.meta_data.get("connectedFileIds"):
                for fileId in json_data.meta_data["connectedFileIds"]:
                    DeleteFile(fileId)
        #
        
        try:
            session.delete(json_data)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
        return
    raise Exception("No Database Session Active. Failed to delete JSON data.")

def DeleteFile(file_id):
    with GetSession() as session:
        file = session.query(Schema.File).filter_by(id = file_id, owner_id = current_user.id).first()

        if file is None:
            raise FileNotFoundError(f"No File data found with id {file_id} and owner id {current_user.id}")

        try:
            session.delete(file)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error: {e}")
        return
    raise Exception("No Database Session Active. Failed to delete JSON data.")