from models.canonical_model import CanonicalQuoteData

def build_location_payload(data: CanonicalQuoteData) -> dict:
    return {
        "data": {
            "attributes": {
                "addressLine1": data.address_line1,
                "city": data.city,
                "postalCode": data.postal_code,
                "state": {
                    "code": data.state[:2].upper()
                },
                "coverableJurisdiction": {
                    "code": data.state[:2].upper(),
                    "name": data.state
                }
            }
        }
    }