
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from handler import guidewire_api_call

router = APIRouter()

class QuoteRequest(BaseModel):
    attachment_url: str = Field(..., description="Full Azure Blob URL pointing to a JSON document that contains "
           "extracted insurance submission data required for quote generation.")

@router.post("/Guidewire_Quote", operation_id="Guidewire_Quote",
             summary="Generate a commercial property quote in Guidewire using submission data from Azure Blob")
async def generate_quote(request: QuoteRequest):
    """
   Reads a structured JSON submission document directly from Azure Blob Storage
   and invokes Guidewire PolicyCenter APIs to generate a commercial property quote.
   The JSON document is expected to already contain extracted and structured data
   (for example, insured details, property location, producer information, and
   policy effective dates). This service does NOT perform document parsing,
   OCR, or layout analysis.
   Flow:
   1. Read JSON content directly from Azure Blob (in-memory).
   2. Map submission data to an internal data model.
   3. Create Account, Job, Location, and Coverages in Guidewire.
   4. Trigger quote generation and return the result.
   Args:
       request (QuoteRequest):
           - attachment_url: Azure Blob URL of the JSON submission document.
   Returns:
       JSONResponse:
           JSON-RPC style response containing the generated quote details,
           or an error message if the process fails.
   """
    try:
        result = await guidewire_api_call(request.attachment_url)
        return JSONResponse(content={"jsonrpc": "2.0", "id": 1, "result": result}, status_code=200)
    except Exception as e:
        return JSONResponse(content={"jsonrpc": "2.0", "id": 1,
                                     "result": {"status": False, "error": str(e)}}, status_code=200)
