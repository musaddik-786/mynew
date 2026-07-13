from models.canonical_model import CanonicalQuoteData

def build_job_payload(account_id: str, data: CanonicalQuoteData) -> dict:
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
                    "id": "pc6"
                }
            }
        }
    }

