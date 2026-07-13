import requests

BASE_URL = "https://pc-sandbox-g"

HEADERS = {
    "Content-Type": "application/json",
    "accept": "application/json",
    "authorization": "Bearer YOUR_TOKEN"
}

def post(uri: str, body: dict):
    response = requests.post(BASE_URL + uri, json=body, headers=HEADERS)
    response.raise_for_status()
    return response.json()
