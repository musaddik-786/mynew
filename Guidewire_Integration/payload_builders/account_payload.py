from models.model_data import QuoteData
from State_Abbrevation import us_state_abbrevation

def build_account_payload(data: QuoteData) -> dict:
    return {
        "data": {
            "attributes": {
                "initialAccountHolder": {
                    "contactSubtype": "Company",
                    "companyName": data.company_name,
                    "primaryAddress": {
                        "addressLine1": data.address_line1,
                        "city": data.city,
                        "postalCode": data.postal_code,
                        "state": {
                            "code": data.state[:2].upper()
                        }
                    }
                },
                "initialPrimaryLocation": {
                    "addressLine1": data.address_line1,
                    "city": data.city,
                    "postalCode": data.postal_code,
                    "state": {
                        "code": data.state[:2].upper()
                        }
                },
                "producerCodes": [
                    {"id": "pc:6"}
                ],
                "organizationType": {
                    "code": data.organization_type
                }
            }
        }
    }
