
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mcp import FastApiMCP
import uvicorn

from router import router as file_router


def apply_cors(app: FastAPI):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )


def create_sub_app(title: str, description: str, version: str = "0.1.0") -> FastAPI:
    sub = FastAPI(title=title, description=description, version=version)
    apply_cors(sub)
    return sub


app = FastAPI()
apply_cors(app)

file_app = create_sub_app(
    title="Guide wire Integration",
    description="Receives Response from Licensing_&Sanction_Check_MCP andreceives a JSON-RPC request from the Licensing & Sanction Checker MCP containing the `is_Sanctioned` flag. Based on this value, it reads the ref_eligibility_check Table and writes corresponding data into agent_eligibility Table."
)
file_app.include_router(file_router)

# Expose ONLY this operation id via MCP HTTP (client will use transport='http')
FastApiMCP(file_app, include_operations=["Guidewire_Integration"]).mount_http()

# Mount the sub-app under this prefix (keep as-is per your request)
# app.mount("/api/v1/eligibility_agent", file_app)
app.mount("/api/v1/layout", file_app)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8601)


