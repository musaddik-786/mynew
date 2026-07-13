import requests

url = "https://pc-sandbox-gwcpdev.hexaware.zeta1-andromeda.guidewire.net/rest/account/v1/accounts"  # Replace with actual API URL

payload = {
    "data": {
        "attributes": {
            "initialAccountHolder": {
                "contactSubtype": "Company",
                "companyName": "Hexa Tester",
                "primaryAddress": {
                    "addressLine1": "2850 S. Delaware St.",
                    "city": "San Mateo",
                    "postalCode": "94403",
                    "state": {
                        "code": "CA"
                    }
                }
            },
            "initialPrimaryLocation": {
                "addressLine1": "2850 S. Delaware St.",
                "city": "San Mateo",
                "postalCode": "94403",
                "state": {
                    "code": "CA"
                }
            },
            "producerCodes": [
                {
                    "id": "pc:6"
                }
            ],
            "organizationType": {
                "code": "llc"
            }
        }
    }
}

headers = {
    'accpet': 'application/json',
    # Add authorization headers here if needed, e.g.
    'authorization': 'Basic c3U6Z3c=',
    'Content-Type' : 'application/json'
}

response = requests.post(url, json=payload, headers=headers)

print(f"Status Code: {response.status_code}")
print("Response Body:")
print(response.json())