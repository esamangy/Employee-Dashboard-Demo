from abc import ABC, abstractmethod

from dotenv import load_dotenv
from sqlalchemy.orm import DeclarativeBase, Session


load_dotenv()


class BaseModel(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    """
    pass


class DatabaseSessionProvider(ABC):
    """
    Interface for anything that can provide a SQLAlchemy Session.
    """

    @abstractmethod
    def GetSession(self) -> Session:
        pass

    @abstractmethod
    def Get_DB_URL(self) -> str:
        pass