



#Working code 

# test_scripts.py
import requests
import json

BASE_URL = "http://localhost:8601/api/v1/layout/Guidewire_Integration"

def run_test():
    payload = {
        #   "attachment_url": "https://agenticai1.blob.core.windows.net/attachment-downloader/19BDB64178C5A9C8_attachment_Acord_125_High_tech_solution.pdf" , 
        "attachment_url"  :  "https://agenticai1.blob.core.windows.net/output-results/ManufacturingFacility_SubmissionDocument_For_Quote_extraction_20260130_081421.json"

    }


    try:
        resp = requests.post(BASE_URL, json=payload, timeout=180)
        print("HTTP Status:", resp.status_code)
        try:
            data = resp.json()
            print(json.dumps(data, indent=4))
        except Exception:
            print("Response not JSON:", resp.text)
    except Exception as e:
        print("Error calling API:", str(e))

if __name__ == "__main__":
    print("Testing /layout_detection_mcp ...")
    run_test()