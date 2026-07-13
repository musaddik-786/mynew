


from fastapi import FastAPI
from pydantic import BaseModel
import json
from pathlib import Path
from routers.claims import router
app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
CLAIMS_FILE = BASE_DIR / "claim.json"


app.include_router(router)


class ClaimRequest(BaseModel):
    claim_number: str
    customer_name: str
    amount: int
    status: str
    policy_type: str


@app.post("/reqbodyclaims")
def create_claim(request: ClaimRequest):
    return {
        "message": "Claim Created",
        "claim_number": request.claim_number,
        "customer_name": request.customer_name,
        "amount": request.amount,
        "status": request.status,
        "policy_type": request.policy_type
    }