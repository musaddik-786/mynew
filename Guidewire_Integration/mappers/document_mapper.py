from models.model_data import QuoteData
from datetime import datetime

# def map_document_to_model_data(doc: dict) -> QuoteData:
#     insured = doc.get("Insured Information", {})
#     broker = doc.get("Broker and Producer Information", {})
#     location = doc.get("Property Location", {})
#     policy = doc.get("Coverage and Policy Details", {})

#     return QuoteData(
#         company_name=insured.get("Named Insured (Company Name)"),
#         organization_type=insured.get("Organization Type", ""),

#         address_line1=location.get("Address Line 1"),
#         city=location.get("City"),
#         state=location.get("State"),
#         postal_code=location.get("Zip Code"),

#         # producer_code=broker.get("Producer Code"),
#         producer_code="pc:6",        
#         # job_effective_date=policy.get("Effective Date"),
#         date_str =policy.get("Effective Date")

#         date_obj = datetime.strptime(date_str, '%d/%m/%Y')

#         # Convert datetime object to desired format string
#         job_effective_date = date_obj.strftime('%Y-%m-%d')
#     )





from State_Abbrevation.us_state_abbrevation import us_states_abbreviations

def map_document_to_model_data(doc: dict) -> QuoteData:
    insured = doc.get("Insured Information", {})
    broker = doc.get("Broker and Producer Information", {})
    location = doc.get("Property Location", {})
    policy = doc.get("Coverage and Policy Details", {})

    # Extract the date string
    date_str = policy.get("Effective Date")

    # Convert the date string to desired format, with error handling
    if date_str:
        try:
            date_obj = datetime.strptime(date_str, '%d/%m/%Y')
            job_effective_date = date_obj.strftime('%Y-%m-%d')
        except ValueError:
            # Handle invalid date format gracefully
            job_effective_date = None
    else:
        job_effective_date = None



    # Get the full state name from location
    full_state_name = location.get("State")

    # Lookup abbreviation; fallback to original full name or None if not found
    state_abbreviation = us_states_abbreviations.get(full_state_name, full_state_name)


    return QuoteData(
        company_name=insured.get("Named Insured (Company Name)"),
        organization_type=insured.get("Organization Type", ""),

        address_line1=location.get("Address Line 1"),
        city=location.get("City"),
        # state=location.get("State"),
        state = state_abbreviation,
        postal_code=location.get("Zip Code"),

        # producer_code=broker.get("Producer Code"),
        producer_code="pc:6",

        job_effective_date=job_effective_date
    )