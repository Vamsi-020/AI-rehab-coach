"""Asynchronous MongoDB connection manager using Motor."""

from typing import Any, Dict, Optional
import motor.motor_asyncio
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from backend.app.core.config import settings
from backend.app.core.logging import logger


class MongoDBManager:
    """Manages asynchronous MongoDB connection lifecycle and collection access."""

    def __init__(self) -> None:
        self.client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
        self.db: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None
        self.is_connected: bool = False

    async def connect(self) -> None:
        """Initialize Motor client and attempt connection ping."""
        logger.info(f"Initializing MongoDB client for database: '{settings.MONGODB_DB_NAME}'...")
        client_kwargs = {
            "maxPoolSize": settings.MONGODB_MAX_POOL_SIZE,
            "minPoolSize": settings.MONGODB_MIN_POOL_SIZE,
            "serverSelectionTimeoutMS": settings.MONGODB_TIMEOUT_MS,
        }
        try:
            import certifi
            client_kwargs["tlsCAFile"] = certifi.where()
        except ImportError:
            pass

        try:
            self.client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.MONGODB_URI,
                **client_kwargs,
            )
            self.db = self.client[settings.MONGODB_DB_NAME]

            # Fast ping to verify connectivity
            await self.client.admin.command("ping")
            self.is_connected = True
            logger.info(f"Successfully connected to MongoDB database: '{settings.MONGODB_DB_NAME}'.")

            # Initialize performance and unique indexes across core collections
            try:
                from backend.app.database.indexes import init_indexes
                await init_indexes(self.db)
            except Exception as index_exc:
                logger.warning(f"Index initialization encountered an error: {str(index_exc)}")
        except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as exc:
            self.is_connected = False
            logger.warning(
                f"MongoDB connection check failed or server unreachable at '{settings.MONGODB_URI}'. "
                f"Reason: {str(exc)}. The application will continue running in offline/degraded database mode."
            )


    async def disconnect(self) -> None:
        """Close Motor client connection pool."""
        if self.client:
            logger.info("Closing MongoDB connection pool...")
            self.client.close()
            self.client = None
            self.db = None
            self.is_connected = False
            logger.info("MongoDB connection pool closed.")

    def get_database(self) -> Optional[motor.motor_asyncio.AsyncIOMotorDatabase]:
        """Return the active MongoDB database instance, or None if disconnected."""
        if self.is_connected:
            return self.db
        return None

    def get_collection(self, collection_name: str) -> Optional[motor.motor_asyncio.AsyncIOMotorCollection]:
        """Return a typed collection from the active database."""
        if self.is_connected and self.db is not None:
            return self.db[collection_name]
        return None



    async def check_health(self) -> Dict[str, Any]:
        """Check live database connectivity status."""
        if not self.client:
            return {
                "status": "disconnected",
                "database": settings.MONGODB_DB_NAME,
                "details": "Client not initialized",
            }
        try:
            await self.client.admin.command("ping")
            self.is_connected = True
            return {
                "status": "connected",
                "database": settings.MONGODB_DB_NAME,
                "details": "MongoDB cluster ping successful",
            }
        except Exception as exc:
            self.is_connected = False
            return {
                "status": "disconnected",
                "database": settings.MONGODB_DB_NAME,
                "details": f"Ping failed: {str(exc)}",
            }


# Singleton database manager instance
db_manager = MongoDBManager()
