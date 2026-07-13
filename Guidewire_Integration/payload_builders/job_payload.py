from models.model_data import QuoteData
from payload_builders import job_payload

def build_job_payload(account_id: str, data: QuoteData) -> dict:

    
    return {
        "data": {
            "attributes": {
                "account": {
                    "id": account_id
                },
                "baseState": {
                    "code": data.state[:2].upper()
                },
                "jobEffectiveDate": data.job_effective_date,
                "product": {
                    "id": "GoCommercialProp"
                },
                "producerCode": {
                    "id": "pc:6"
                }
            }
        }
    }

