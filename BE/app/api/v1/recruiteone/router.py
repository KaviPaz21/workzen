from fastapi import APIRouter

from app.api.v1.recruiteone import cv_pool, dashboard, evaluations, files, jds, public, records, scoring, vacancies

router = APIRouter(prefix="/recruiteone")
router.include_router(dashboard.router)
router.include_router(jds.router)
router.include_router(vacancies.router)
router.include_router(cv_pool.router)
router.include_router(evaluations.router)
router.include_router(scoring.router)
router.include_router(records.router)
router.include_router(files.router)
router.include_router(public.router)
