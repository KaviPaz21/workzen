import json

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel

from app.api.deps import get_public_vacancy_service
from app.core.errors import InvalidRequestError
from app.services.recruiteone.public_vacancy_service import PublicVacancyService

router = APIRouter(prefix="/public/vacancies", tags=["recruiteone: public applications"])


class ApplicationReceipt(BaseModel):
    id: str


@router.get("/{token}")
async def describe_vacancy(token: str, service: PublicVacancyService = Depends(get_public_vacancy_service)):
    return await service.describe(token)


@router.post("/{token}/applications", response_model=ApplicationReceipt, status_code=status.HTTP_201_CREATED)
async def submit_application(
    token: str,
    file: UploadFile = File(...),
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    current_title: str = Form(""),
    application: str = Form("{}"),
    service: PublicVacancyService = Depends(get_public_vacancy_service),
):
    try:
        details = json.loads(application)
    except json.JSONDecodeError as error:
        raise InvalidRequestError("The application details are not valid") from error
    if not isinstance(details, dict):
        raise InvalidRequestError("The application details are not valid")
    data = await file.read()
    saved = await service.apply(
        token=token,
        file_name=file.filename or "cv",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        full_name=full_name.strip(),
        email=email.strip(),
        phone=phone.strip(),
        current_title=current_title.strip(),
        application={str(key): str(value) for key, value in details.items()},
    )
    return ApplicationReceipt(id=saved["id"])
