from fastapi import APIRouter, Depends, status

from app.api.deps import get_vacancy_service
from app.schemas.recruiteone.vacancy import VacancyCreate, VacancyRead, VacancyUpdate
from app.services.recruiteone.vacancy_service import VacancyService

router = APIRouter(prefix="/vacancies", tags=["recruiteone: vacancies"])


@router.get("", response_model=list[VacancyRead])
async def list_vacancies(limit: int = 100, service: VacancyService = Depends(get_vacancy_service)):
    return await service.list_all(limit)


@router.post("", response_model=VacancyRead, status_code=status.HTTP_201_CREATED)
async def create_vacancy(payload: VacancyCreate, service: VacancyService = Depends(get_vacancy_service)):
    return await service.create(payload.model_dump(mode="json"))


@router.get("/{vacancy_id}", response_model=VacancyRead)
async def get_vacancy(vacancy_id: str, service: VacancyService = Depends(get_vacancy_service)):
    return await service.get(vacancy_id)


@router.patch("/{vacancy_id}", response_model=VacancyRead)
async def update_vacancy(
    vacancy_id: str, payload: VacancyUpdate, service: VacancyService = Depends(get_vacancy_service)
):
    return await service.update(vacancy_id, payload.model_dump(mode="json", exclude_unset=True))


@router.delete("/{vacancy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vacancy(vacancy_id: str, service: VacancyService = Depends(get_vacancy_service)):
    await service.delete(vacancy_id)
