
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from handler import guidewire_api_call

router = APIRouter()

class LayoutDetectRequest(BaseModel):
    attachment_url: str = Field(..., description="Full Azure Blob URL to the PDF attachment.")

@router.post("/Guidewire_Integration", operation_id="Guidewire_Integration",
             summary="Download PDF from blob, analyze layout using Form Recognizer, and classify layout")
async def detect_layout(request: LayoutDetectRequest):
    """Downloades the blob based on blob url and calls the Guidewire API with the data present in the blob for Quote generation

    
    Args:
        attachment_url: The Blob URL oreturned by the email_attachment_mcp
    
    Returns:
        JSONResponse: returns the json response containing Quote generated.
    """
    try:
        result = await guidewire_api_call(request.attachment_url)
        return JSONResponse(content={"jsonrpc": "2.0", "id": 1, "result": result}, status_code=200)
    except Exception as e:
        return JSONResponse(content={"jsonrpc": "2.0", "id": 1,
                                     "result": {"status": False, "error": str(e)}}, status_code=200)
