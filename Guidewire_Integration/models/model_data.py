from dataclasses import dataclass
@dataclass
class QuoteData:
    company_name:str
    organization_type:str

    address_line1:str
    city: str
    state: str
    postal_code: str

    producer_code : str
    job_effective_date: str

