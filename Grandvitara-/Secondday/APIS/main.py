# # from fastapi import FastAPI
# # from pydantic import BaseModel
# # app = FastAPI()


# # #query parameters
# # @app.get("/queryclaims")
# # def get_claims(
# #    status: str,
# #    policy_type: str
# # ):
# #    return {
# #        "status": status,
# #        "policy": policy_type
# #    }


# # #second is Pydantic class
# # class ClaimRequest(BaseModel):
# #    claim_number: str
# #    customer_name: str
# #    amount: int
# #    status: str
# #    policy_type: str

# # @app.post("/reqbodyclaims")
# # def create_claim(request: ClaimRequest):
# #    return {
# #        "message": "Claim Created",
# #        "claim_number": request.claim_number,
# #        "customer_name": request.customer_name,
# #        "amount": request.amount,
# #        "status": request.status,
# #        "policy_type": request.policy_type
# #    }










# from fastapi import FastAPI
# from pydantic import BaseModel
# import json

# app = FastAPI()

# # C:\Users\2000137378\Desktop\newproject\Grandvitara-\Secondday\APIS\claim.json this is my path
# def load_claims():
#     with open("claims.json", "r") as file:
#         claims = json.load(file)
#     return claims


# @app.get("/queryclaims")
# def get_claims(
#     status: str,
#     policy_type: str
# ):
#     claims = load_claims()

#     filtered_claims = []

#     for claim in claims:
#         if claim["status"] == status and claim["policy_type"] == policy_type:
#             filtered_claims.append(claim)

#     return filtered_claims


# class ClaimRequest(BaseModel):
#     claim_number: str
#     customer_name: str
#     amount: int
#     status: str
#     policy_type: str


# @app.post("/reqbodyclaims")
# def create_claim(request: ClaimRequest):
#     return {
#         "message": "Claim Created",
#         "claim_number": request.claim_number,
#         "customer_name": request.customer_name,
#         "amount": request.amount,
#         "status": request.status,
#         "policy_type": request.policy_type
#     }







from fastapi import FastAPI
from pydantic import BaseModel
import json
from pathlib import Path

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
CLAIMS_FILE = BASE_DIR / "claim.json"


def load_claims():
    with open(CLAIMS_FILE, "r", encoding="utf-8") as file:
        claims = json.load(file)
    return claims


@app.get("/queryclaims")
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