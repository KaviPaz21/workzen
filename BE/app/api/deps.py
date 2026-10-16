import re

from azure.cosmos.aio import DatabaseProxy
from fastapi import Depends, Header, HTTPException, Request

from app.agents.assistant.coworker_graph import get_coworker_graph
from app.agents.assistant.graph import get_assistant_graph
from app.agents.recruiteone.cv_scorer import get_cv_scoring_graph
from app.agents.recruiteone.graph import get_evaluation_graph
from app.agents.recruiteone.jd_decomposer import get_jd_decomposition_graph
from app.core.config import Settings, get_settings
from app.integrations.blob import BlobStorage
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.cosmos_repository import CosmosRepository
from app.repositories.record_repository import RecordRepository
from app.services.assistant.chat_service import ChatService
from app.services.assistant.knowledge_service import KnowledgeIndex
from app.services.base import ResourceService
from app.services.recruiteone.jd_service import JdDecomposerService, JdService
from app.services.recruiteone.cv_file_service import CvFileService
from app.services.recruiteone.cv_pool_service import CvPoolService
from app.services.recruiteone.cv_scoring_service import CvScoringService
from app.services.recruiteone.dashboard_service import DashboardService
from app.services.recruiteone.evaluation_service import EvaluationService
from app.services.recruiteone.public_vacancy_service import PublicVacancyService
from app.services.recruiteone.stored_scoring_service import StoredScoringService
from app.services.recruiteone.vacancy_service import VacancyService
from app.services.recruiteone.workspace_service import WorkspaceService


def get_database(request: Request) -> DatabaseProxy:
    database = request.app.state.database
    if database is None:
        raise HTTPException(status_code=503, detail="Cosmos DB is not configured")
    return database


def get_blob_storage(request: Request) -> BlobStorage:
    blob_storage = request.app.state.blob_storage
    if blob_storage is None:
        raise HTTPException(status_code=503, detail="Azure Blob Storage is not configured")
    return blob_storage


def get_jd_repository(
    database: DatabaseProxy = Depends(get_database), settings: Settings = Depends(get_settings)
) -> CosmosRepository:
    return CosmosRepository(database.get_container_client(settings.cosmos_container_jds))


def get_vacancy_repository(
    database: DatabaseProxy = Depends(get_database), settings: Settings = Depends(get_settings)
) -> CosmosRepository:
    return CosmosRepository(database.get_container_client(settings.cosmos_container_vacancies))


def get_candidate_repository(
    database: DatabaseProxy = Depends(get_database), settings: Settings = Depends(get_settings)
) -> CosmosRepository:
    return CosmosRepository(database.get_container_client(settings.cosmos_container_candidates))


def get_evaluation_repository(
    database: DatabaseProxy = Depends(get_database), settings: Settings = Depends(get_settings)
) -> CosmosRepository:
    return CosmosRepository(database.get_container_client(settings.cosmos_container_evaluations))


def get_jd_service(repository: CosmosRepository = Depends(get_jd_repository)) -> JdService:
    return JdService(repository=repository, resource_name="Job description")


def get_jd_decomposer(
    settings: Settings = Depends(get_settings), graph=Depends(get_jd_decomposition_graph)
) -> JdDecomposerService:
    if not settings.foundry_configured:
        raise HTTPException(status_code=503, detail="Azure AI Foundry is not configured")
    return JdDecomposerService(graph=graph)


def get_cv_scorer(settings: Settings = Depends(get_settings), graph=Depends(get_cv_scoring_graph)) -> CvScoringService:
    if not settings.foundry_configured:
        raise HTTPException(status_code=503, detail="Azure AI Foundry is not configured")
    return CvScoringService(graph=graph, max_upload_bytes=settings.max_upload_bytes)


def get_vacancy_service(
    repository: CosmosRepository = Depends(get_vacancy_repository),
    jd_repository: CosmosRepository = Depends(get_jd_repository),
) -> VacancyService:
    return VacancyService(repository=repository, resource_name="Vacancy", jd_repository=jd_repository)


def get_cv_pool_service(
    repository: CosmosRepository = Depends(get_candidate_repository),
    blob_storage: BlobStorage = Depends(get_blob_storage),
    settings: Settings = Depends(get_settings),
) -> CvPoolService:
    return CvPoolService(
        repository=repository,
        resource_name="Candidate",
        blob_storage=blob_storage,
        max_upload_bytes=settings.max_upload_bytes,
    )


def get_candidate_service(repository: CosmosRepository = Depends(get_candidate_repository)) -> ResourceService:
    return ResourceService(repository=repository, resource_name="Candidate")


def get_evaluation_service(
    evaluations: CosmosRepository = Depends(get_evaluation_repository),
    vacancies: CosmosRepository = Depends(get_vacancy_repository),
    jds: CosmosRepository = Depends(get_jd_repository),
    candidates: CosmosRepository = Depends(get_candidate_repository),
    graph=Depends(get_evaluation_graph),
) -> EvaluationService:
    return EvaluationService(evaluations=evaluations, vacancies=vacancies, jds=jds, candidates=candidates, graph=graph)


def get_dashboard_service(
    jds: CosmosRepository = Depends(get_jd_repository),
    vacancies: CosmosRepository = Depends(get_vacancy_repository),
    candidates: CosmosRepository = Depends(get_candidate_repository),
    evaluations: CosmosRepository = Depends(get_evaluation_repository),
) -> DashboardService:
    return DashboardService(jds=jds, vacancies=vacancies, candidates=candidates, evaluations=evaluations)

def get_record_repository(
    database: DatabaseProxy = Depends(get_database), settings: Settings = Depends(get_settings)
) -> RecordRepository:
    return RecordRepository(database.get_container_client(settings.cosmos_container_records))


def get_workspace_service(repository: RecordRepository = Depends(get_record_repository)) -> WorkspaceService:
    return WorkspaceService(repository=repository)


def get_cv_file_service(
    blob_storage: BlobStorage = Depends(get_blob_storage), settings: Settings = Depends(get_settings)
) -> CvFileService:
    return CvFileService(blob_storage=blob_storage, max_upload_bytes=settings.max_upload_bytes)


def get_public_vacancy_service(
    repository: RecordRepository = Depends(get_record_repository),
    workspace: WorkspaceService = Depends(get_workspace_service),
    files: CvFileService = Depends(get_cv_file_service),
) -> PublicVacancyService:
    return PublicVacancyService(repository=repository, workspace=workspace, files=files)


USER_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def get_user_id(x_user_id: str = Header(default="anonymous")) -> str:
    if not USER_ID_PATTERN.match(x_user_id):
        raise HTTPException(status_code=400, detail="The user id is not valid")
    return x_user_id


def get_chat_session_repository(
    database: DatabaseProxy = Depends(get_database), settings: Settings = Depends(get_settings)
) -> ChatSessionRepository:
    return ChatSessionRepository(database.get_container_client(settings.cosmos_container_records))


def get_knowledge_index(request: Request) -> KnowledgeIndex:
    return request.app.state.knowledge_index


def get_chat_service(
    request: Request,
    sessions: ChatSessionRepository = Depends(get_chat_session_repository),
    knowledge: KnowledgeIndex = Depends(get_knowledge_index),
    settings: Settings = Depends(get_settings),
    graph=Depends(get_assistant_graph),
    coworker_graph=Depends(get_coworker_graph),
) -> ChatService:
    if not settings.foundry_configured:
        raise HTTPException(status_code=503, detail="Azure AI Foundry is not configured")
    return ChatService(
        sessions=sessions,
        graph=graph,
        knowledge=knowledge,
        knowledge_storage=request.app.state.knowledge_storage,
        models=settings.assistant_model_list,
        coworker_graph=coworker_graph,
        coworker_runs=request.app.state.coworker_runs,
        coworker_download_url=settings.coworker_download_url or (f"{settings.api_prefix}/assistant/coworker/installer" if settings.coworker_installer_file else None),
    )


def get_stored_scoring_service(
    scorer: CvScoringService = Depends(get_cv_scorer),
    workspace: WorkspaceService = Depends(get_workspace_service),
    files: CvFileService = Depends(get_cv_file_service),
) -> StoredScoringService:
    return StoredScoringService(scorer=scorer, workspace=workspace, files=files)
