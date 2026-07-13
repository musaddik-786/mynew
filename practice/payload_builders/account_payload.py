from models.canonical_model import CanonicalQuoteData

def build_account_payload(data: CanonicalQuoteData) -> dict:
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
                    {"id": "pc6"}
                ],
                "organizationType": {
                    "code": data.organization_type
                }
            }
        }
    }
