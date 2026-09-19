from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, ForeignKey, DateTime, LargeBinary, Text, func, false, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from flask_login import UserMixin

from App.Database.db import BaseModel

class User(BaseModel, UserMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    role_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("roles.id"), nullable=False)
    google_sub: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    first_name: Mapped[str] = mapped_column(Text, nullable=False)
    last_name: Mapped[str] = mapped_column(Text, nullable=False)

class Role(BaseModel):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    role_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

class Data_Type(BaseModel):
    __tablename__ = "data_types"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    type_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

    def is_type(self, type_name: str) -> bool:
        return self.type_name == type_name

class File(BaseModel):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    file_type_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("file_types.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    storage_type: Mapped[str] = mapped_column(Text, nullable=False)
    database_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)
    storage_key: Mapped[str] = mapped_column(Text, nullable=True)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)

class FileType(BaseModel):
    __tablename__ = "file_types"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    type_name: Mapped[str] = mapped_column(Text, nullable=False)

    def is_type(self, type_name: str) -> bool:
        return self.type_name == type_name

class Json_Data(BaseModel):
    __tablename__ = "json_data"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    data_type_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("data_types.id"), nullable=False)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=True)
    renamed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false())
    meta_data: Mapped[dict[str, Any]] = mapped_column(JSONB)

class Permission_Type(BaseModel):
    __tablename__ = "permission_types"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    permission_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)

class Json_Data_Permission(BaseModel):
    __tablename__ = "json_data_permissions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    permission_type_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("permission_types.id"), nullable=False)
    granted_by_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    granted_to_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    json_data_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("json_data.id"), nullable=False)

class User_Json_Data_Activity(BaseModel):
    __tablename__ = "user_json_data_activity"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    json_data_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("json_data.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    last_viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Customer(BaseModel):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    code: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text(7), nullable=False)

    __table_args__ = (CheckConstraint(
        r"code ~ '^[A-Za-z&]{3}\*[A-Za-z&]{3}$'",
        name = "check_code"
    ),)