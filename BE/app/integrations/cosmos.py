from azure.cosmos import PartitionKey
from azure.cosmos.aio import CosmosClient, DatabaseProxy

from app.core.config import Settings


def container_names(settings: Settings) -> list[str]:
    return [
        settings.cosmos_container_jds,
        settings.cosmos_container_vacancies,
        settings.cosmos_container_candidates,
        settings.cosmos_container_evaluations,
    ]


async def connect_cosmos(settings: Settings) -> tuple[CosmosClient, DatabaseProxy]:
    client = CosmosClient(settings.cosmos_endpoint, credential=settings.cosmos_key.get_secret_value())
    database = await client.create_database_if_not_exists(id=settings.cosmos_database)
    for name in container_names(settings):
        await database.create_container_if_not_exists(id=name, partition_key=PartitionKey(path="/id"))
    await database.create_container_if_not_exists(
        id=settings.cosmos_container_records, partition_key=PartitionKey(path="/collection")
    )
    return client, database
