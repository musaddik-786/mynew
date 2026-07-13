# import os
# import json
# from typing import Dict, Any
# from service import _require_env
# from storage_utils import download_blob_to_input_folder
# # from document_loader import load_document
# # from classifier import classify_document


# from mappers.document_mapper import map_document_to_canonical
# from payload_builders.account_payload import build_account_payload
# from payload_builders.job_payload import build_job_payload
# from payload_builders.location_payload import build_location_payload
# from payload_builders.coverage_payloads import get_coverages
# from clients.guidewire_client import post


# INPUT_FOLDER = "input"
# # OUTPUT_FOLDER = "output"

# async def classify_blob_pdf_layout(blob_url: str) -> Dict[str, Any]:
#     """
#     - Download json into input/
#     """
#     try:
#         _require_env()
#     except Exception as e:
#         return {"status": False, "error": f"Environment misconfigured: {e}"}


#     # 1) Download PDF
#     try:
#         local_pdf = await download_blob_to_input_folder(blob_url, input_folder=INPUT_FOLDER)
#     except Exception as e:
#         return {"status": False, "error": f"Failed to download blob: {e}"}











# handler.py
from typing import Dict, Any
from service import _require_env
from storage_utils import read_json_from_blob
from mappers.document_mapper import map_document_to_model_data
from payload_builders.account_payload import build_account_payload
from payload_builders.job_payload import build_job_payload
from payload_builders.location_payload import build_location_payload
from payload_builders.coverage_payloads import get_coverages
from clients.guidewire_client import post
from service import _ref_parse_blob_url
from storage_utils import save_json_output_to_blob

async def guidewire_api_call(blob_url: str) -> Dict[str, Any]:
    """
    Reads JSON directly from Azure Blob and calls Guidewire APIs to get the Quote.
    """
    try:
        _require_env()
    except Exception as e:
        return {"status": False, "error": f"Environment misconfigured: {e}"}

    try:
        document = await read_json_from_blob(blob_url)
        print(document)
    except Exception as e:
        return {"status": False, "error": f"Failed to read blob: {e}"}
    
    try:
        canonical = map_document_to_model_data(document)
        print("Canonical",canonical)
    except Exception as e:
        return {"status": False, "error": f"Failed to map data : {e}"}

        # canonical = map_document_to_canonical(document)
    account_resp = post("/account/v1/accounts", build_account_payload(canonical))
    account_id = account_resp["data"]["attributes"]["id"]
    
    print("account_id",account_id)

    job_resp = post("/job/v1/submissions", build_job_payload(account_id, canonical))
    job_id = job_resp["data"]["attributes"]["id"]

    location_resp = post(
        f"/job/v1/jobs/{job_id}/lines/GOCommercialLine/locations",
        build_location_payload(canonical)
    )
    location_id = location_resp["data"]["attributes"]["id"]

    for coverage in get_coverages():
        post(
            f"/job/v1/jobs/{job_id}/lines/GOCommercialLine/coverages",
            {"data": {"attributes": coverage}}
        )

    quote_resp = post(f"/job/v1/jobs/{job_id}/quote", {})

    try:
        container, blob_path, ref_id, name = _ref_parse_blob_url(blob_url)
        print("Container:", container)
        print("Blob_path:", blob_path)
        print("Ref_id:", ref_id)
        print("Name:", name)
    except Exception as e:
        return {"status": False, "error": f"Failed to extract name from blob url : {e}"}
    
    try:
        await save_json_output_to_blob(ref_id,name,quote_resp)
    except Exception as e:
        return {"status": False, "error": f"Failed to extract name from blob url : {e}"} 


    return {
        "status": True,
        # "accountId": account_id,
        # "jobId": job_id,
        # "locationId": location_id,
        "quote": quote_resp
    }

