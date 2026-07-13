
from fastapi import FastAPI
from pydantic import BaseModel
import json
from pathlib import Path
from fastapi import APIRouter

# app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
# CLAIMS_FILE = BASE_DIR / "/data/claim.json"

CLAIMS_FILE = BASE_DIR.parent / "data" / "claim.json"

router = APIRouter()

def load_claims():
    with open(CLAIMS_FILE, "r", encoding="utf-8") as file:
        claims = json.load(file)
    return claims


@router.get("/claims")
def get_claims(
    status: str,
    policy_type: str
):
    claims = load_claims()

    filtered_claims = []

    for claim in claims:
        if (
            claim["status"].lower() == status.lower()
            and claim["policy_type"].lower() == policy_type.lower()
        ):
            filtered_claims.append(claim)

    return filtered_claims
