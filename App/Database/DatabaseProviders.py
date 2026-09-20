import os
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from App.Database.db import BaseModel, DatabaseSessionProvider
from sqlalchemy.pool import StaticPool


class TestSessionProvider(DatabaseSessionProvider):
    def __init__(self):
        self.engine = create_engine(
            self.Get_DB_URL(),
            echo=True,
        )

        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
        )

        BaseModel.metadata.create_all(self.engine)

    def GetSession(self) -> Session:
        return self.SessionLocal()

    def Get_DB_URL(self) -> str:
        url = os.getenv("DATABASE_URL")
        if(not url):
            raise ValueError("DATABASE_URL environment variable is not set.")
        return url


class InMemoryProvider(DatabaseSessionProvider):
    def __init__(self):
        self.engine = create_engine(
            self.Get_DB_URL(),
            echo=True,
            connect_args={
                "check_same_thread": False,
            },
            poolclass=StaticPool,
        )

        self.SessionLocal = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
        )

        BaseModel.metadata.create_all(self.engine)

    def GetSession(self) -> Session:
        return self.SessionLocal()

    def Get_DB_URL(self) -> str:
        return "sqlite://"
