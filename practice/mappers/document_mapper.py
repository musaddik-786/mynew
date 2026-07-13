from models.canonical_model import CanonicalQuoteData

def map_document_to_canonical(doc: dict) -> CanonicalQuoteData:
    insured = doc.get("Insured Information", {})
    broker = doc.get("Broker and Producer Information", {})
    location = doc.get("Property Location", {})
    policy = doc.get("Coverage and Policy Details", {})

    return CanonicalQuoteData(
        company_name=insured.get("Named Insured (Company Name)"),
        organization_type=insured.get("Organization Type", "").lower(),

        address_line1=location.get("Address Line 1"),
        city=location.get("City"),
        state=location.get("State"),
        postal_code=location.get("Zip Code"),

        producer_code=broker.get("Producer Code"),
        job_effective_date=policy.get("Effective Date"),
    )
