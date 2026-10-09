from dataclasses import dataclass

from app.schemas.recruiteone.scoring import CvScore, JdForScoring
from app.services.recruiteone.cv_file_service import CvFileService
from app.services.recruiteone.cv_scoring_service import CvScoringService
from app.services.recruiteone.workspace_service import WorkspaceService


@dataclass
class StoredScoringService:
    scorer: CvScoringService
    workspace: WorkspaceService
    files: CvFileService

    async def score(self, candidate_id: str, jd: JdForScoring) -> CvScore:
        candidate = await self.workspace.get("candidates", candidate_id)
        data, _ = await self.files.fetch(candidate_id)
        return await self.scorer.score(candidate["file_name"], data, jd)
