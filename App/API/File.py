from io import BytesIO
from flask import Blueprint, request, jsonify, send_file
from typing import Any, Final
from sqlalchemy import or_
from App.Database import Schema
import App.Database.DatabaseSession as dbs
from App.Database.Schema import User
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from enum import Enum, StrEnum
import magic
from werkzeug.datastructures import FileStorage

files_bp = Blueprint("files", __name__)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 #5 MB
class StorageType(Enum):
    DATABASE = "database"
    CLOUD = "cloud"

class FileType(StrEnum):
    UNDEFINED = ""
    IMAGE = "Image"
    VIDEO = "Video"
    TEXT_DOCUMENT = "Text Document"
    AUDIO = "Audio"
    PDF = "Pdf"

textDocumentMimes = {
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
    "application/json",
    "application/xml",
}

@files_bp.post("/api/files/upload")
@login_required
def InsertFiles() -> Any:
    files = request.files.getlist("files")

    if not files:
        return jsonify({"message": "No files received"}), 400
    
    with dbs.GetSession() as session:
        ok: bool = True
        message: str = ""
        ids:list[int] = []
        for file in files:
            if file.filename == "":
                ok = False
                message = "File with no name detected"
                break
                
            row = CreateFile(file)
            if(row is None):
                raise SystemError(f"Could not create a database entry for{file}")
            session.add(row)
            session.flush()
            ids.append(row.id)

        if ok:
            session.commit()
        return (jsonify({"message": message, "fileIds": ids}), 200) if ok else (jsonify({"error": message}), 500)
    raise Exception("No Database Session Active. Failed to upload files.")

@files_bp.get("/api/files/simple")
@login_required
def GetFilesSimpleData() -> Any:
    fileIds = request.args.getlist("id", type=int)
    for id in fileIds:
        break
        #dbs.RequirePermissionForViewingJsonData(current_user.id, id) make a version of this for file
    
    with dbs.GetSession() as session:
        files = session.query(dbs.Schema.File).filter(
            dbs.Schema.File.owner_id == current_user.id,
            dbs.Schema.File.id.in_(fileIds)
        ).all()

        return jsonify({"files": [{
                "id": file.id,
                "name": file.file_name,
                "size": FormatSize(file.file_size_bytes),
                "type": GetFileTypeFromId(file.file_type_id),
                "mime": file.mime_type
            } for file in files ]
        }), 200
    raise Exception("No Database Session Active. Failed to upload files.")

@files_bp.route("/api/files/<int:file_id>/delete" , methods=["DELETE"])
@login_required
def DeleteFile(file_id: int) -> Any:
    # dbs.RequirePermissionForEditingJsonData(current_user.id, data_id) make a version of this for file
    try:
        dbs.DeleteFile(file_id)
        return jsonify({"message": "Successfully deleted file"}), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@files_bp.get("/api/files/<int:file_id>/content")
@login_required
def ViewFile(file_id:int):
    file = GetFile(file_id)

    return send_file(
        BytesIO(file["data"]),
        mimetype = file["mime"],
        as_attachment = False,
        download_name = file["name"],
        conditional = True,
    )

@files_bp.get("/api/files/<int:file_id>/download")
@login_required
def DownloadFile(file_id:int):
    file = GetFile(file_id)

    return send_file(
        BytesIO(file["data"]),
        mimetype = file["mime"],
        as_attachment = True,
        download_name = file["name"],
    )

def GetFile(file_id):
    with dbs.GetSession() as session:
        file = session.query(dbs.Schema.File).filter(
            dbs.Schema.File.owner_id == current_user.id,
            dbs.Schema.File.id == file_id
        ).first()
        
        if file is None:
            raise FileNotFoundError("File not found")
        return {
            "id": file.id,
            "name": file.file_name,
            "fileType": GetFileTypeFromId(file.file_type_id),
            "mime": file.mime_type,
            "data": bytes(file.database_data)
        }
    raise Exception("No Database Session Active. Failed to upload files.") 

def CreateFile(file) -> Schema.File:
    filename = secure_filename(file.filename)

    mime_type, custom_type = GetFileTypes(file)
    newFile = dbs.Schema.File(
        file_type_id = GetFileTypeIdFor(custom_type.value), #get file type will throw an error if the file is an unsupported type
        file_name = filename,
        file_size_bytes = GetFileSize(file),
        owner_id = current_user.id,
        storage_type = GetStorageType(file).value,
        database_data = GetDatabaseData(file),
        storage_key = GetStorageKey(file),
        mime_type = mime_type
    )
    return newFile

def GetFileSize(file:FileStorage) -> int:
    stream = file.stream
    stream.seek(0, 2)
    size = stream.tell()
    stream.seek(0)
    return size

def GetStorageType(file:FileStorage) -> StorageType:
    return StorageType.DATABASE if GetFileSize(file) <= MAX_FILE_SIZE_BYTES else StorageType.CLOUD

def GetDatabaseData(file:FileStorage) -> bytes | None:
    return file.read() if GetStorageType(file) == StorageType.DATABASE else None

def GetStorageKey(file:FileStorage) -> str | None:
    return "cloud key here" if GetStorageType(file) == StorageType.CLOUD else None

def GetFileTypeFromId(id:int) -> str | None:
    with dbs.GetSession() as session:
        type = session.query(dbs.Schema.FileType).filter(
            dbs.Schema.FileType.id == id
        ).first()

        if type is None:
            raise FileNotFoundError("File Type does not exist")
        
        return type.type_name
    raise Exception("No Database Session Active.")  

def GetFileTypeIdFor(typeName:str) -> int:
    with dbs.GetSession() as session:
        result = session.query(dbs.Schema.FileType).filter_by(type_name = typeName).first()

        if result is None:
            raise FileNotFoundError(f"No data type found with name {typeName}")
        
        return result.id
    raise Exception("No Database Session Active. Failed to get data type ID.")

def GetFileTypes(file:FileStorage):
    mimeType = magic.from_buffer(
        file.read(2048),
        mime = True
    )

    file.seek(0)

    fileType: FileType = FileType.UNDEFINED

    if(mimeType.startswith("image/")):
        fileType = FileType.IMAGE
    
    if(mimeType.startswith("video/")):
        fileType = FileType.VIDEO
    
    if(mimeType.startswith("text/")):
        fileType = FileType.TEXT_DOCUMENT
    
    if(mimeType.startswith("audio/")):
        fileType = FileType.AUDIO
    
    if(mimeType.startswith("application/pdf")):
        fileType = FileType.PDF
    
    if(mimeType in textDocumentMimes):
        fileType = FileType.TEXT_DOCUMENT
    
    return mimeType, fileType

def FormatSize(size):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024