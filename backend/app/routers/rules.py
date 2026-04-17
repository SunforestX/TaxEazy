from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.exception import RuleDefinition, RulesRunSummary
from app.schemas.common import SuccessResponse
from app.services.rules_engine import rules_engine
from app.utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/rules", tags=["Rules"])


@router.get("/", response_model=List[RuleDefinition])
def list_rules(
    current_user: User = Depends(get_current_user)
):
    """
    List all rule definitions.
    
    Returns a list of all available data quality rules with their metadata.
    """
    rules = rules_engine.get_rules()
    return rules


@router.post("/run", response_model=RulesRunSummary)
def run_all_rules(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Execute all rules and create exceptions for violations (admin only).
    
    Returns a summary of new exceptions found by each rule.
    """
    try:
        results = rules_engine.run_all(db)
        db.commit()
        
        total_new = sum(results.values())
        return RulesRunSummary(
            results=results,
            total_new_exceptions=total_new
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run rules: {str(e)}"
        )


@router.post("/run/{rule_id}", response_model=SuccessResponse)
def run_single_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """
    Execute a single rule by ID (admin only).
    
    - **rule_id**: ID of the rule to run (e.g., MISSING_GST, UNCATEGORIZED)
    
    Returns the count of new exceptions created.
    """
    # Validate rule exists
    rule_ids = [r["id"] for r in rules_engine.get_rules()]
    if rule_id not in rule_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule with ID '{rule_id}' not found"
        )
    
    try:
        count = rules_engine.run_rule(db, rule_id)
        db.commit()
        
        return SuccessResponse(
            message=f"Rule '{rule_id}' executed successfully",
            id=None
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run rule: {str(e)}"
        )
