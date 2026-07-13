import json
from storage_utils import read_json_from_blob
from mappers.document_mapper import map_document_to_canonical
from payload_builders.account_payload import build_account_payload
from payload_builders.job_payload import build_job_payload
from payload_builders.location_payload import build_location_payload
from payload_builders.coverage_payloads import get_coverages
from clients.guidewire_client import post

# INPUT_FOLDER = "input"

def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

async def guidewire_api_call(blob_url: str):
    local_file = await read_json_from_blob(blob_url)
    document = load_json(local_file)

    canonical = map_document_to_canonical(document)

    account_resp = post("/account/v1/accounts", build_account_payload(canonical))
    account_id = account_resp["data"]["attributes"]["id"]

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

    return {
        "status": True,
        "accountId": account_id,
        "jobId": job_id,
        "locationId": location_id,
        "quote": quote_resp
    }