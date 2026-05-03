from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.routers import (
    auth, supplier, transaction, employee, payroll, project, rd_activity,
    evidence, bas, exception, rules, report, dashboard, company, integration, audit
)

settings = get_settings()

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="SunForest X Therapeutics API",
    description="Internal finance and R&D intelligence platform",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(supplier.router)
app.include_router(transaction.router)
app.include_router(employee.router)
app.include_router(payroll.router)
app.include_router(project.router)
app.include_router(rd_activity.router)
app.include_router(evidence.router)
app.include_router(bas.router)
app.include_router(exception.router)
app.include_router(rules.router)
app.include_router(report.router)
app.include_router(dashboard.router)
app.include_router(company.router)
app.include_router(integration.router)
app.include_router(audit.router)


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "version": "1.0.0"
    }


@app.get("/", tags=["Root"])
def root():
    """Root endpoint."""
    return {
        "message": "SunForest X Therapeutics API",
        "docs": "/docs",
        "health": "/health"
    }
