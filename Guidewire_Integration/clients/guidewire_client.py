import requests

BASE_URL = "https://pc-sandbox-gwcpdev.hexaware.zeta1-andromeda.guidewire.net/rest"

HEADERS = {
    "Content-Type": "application/json",
    "accept": "application/json",
    "authorization": "Basic c3U6Z3c="
}

def post(uri: str, body: dict):
    response = requests.post(BASE_URL + uri, json=body, headers=HEADERS)
    response.raise_for_status()
    return response.json()
