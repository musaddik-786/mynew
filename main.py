import os
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
import json

# Load environment variables from .env file
load_dotenv()

def download_blob():
    # Retrieve environment variables
    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
    json_file_path = os.getenv("JSON_FILEPATH")

    if not connection_string:
        raise ValueError("AZURE_STORAGE_CONNECTION_STRING is not defined in the environment variables.")
    if not account_name:
        raise ValueError("AZURE_STORAGE_ACCOUNT_NAME is not defined in the environment variables.")
    if not json_file_path:
        raise ValueError("JSON_FILEPATH is not defined in the environment variables.")

    # Split the URL to extract container name and blob name
    blob_url_parts = json_file_path.split("/")
    container_name = blob_url_parts[3]
    blob_name = "/".join(blob_url_parts[4:])

    print(f"Blob Name: {blob_name}")
    print(f"Container Name: {container_name}")

    try:
        # Authenticate and connect to Azure Blob Storage
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)

        # Download the blob
        blob_client = container_client.get_blob_client(blob_name)
        download_file_path = os.path.basename(blob_name)

        with open(download_file_path, "wb") as file:
            file.write(blob_client.download_blob().readall())

        print(f"File downloaded successfully: {download_file_path}")

    except Exception as e:
        print(f"An error occurred: {e}")

def greet_user():
    def greet(name:str)->str:
        message = f"Hello, {name}! Welcome Back!"
        return message

    username = "Musaddique"
    output = greet(username) 

    print({username},{output})
    data={
    "user" : username,
    "message" : output
    }
    
    output_file_path = os.path.join(os.getcwd(),"database.json")
    with open(output_file_path,"w") as file:
        json.dump(data,file, indent =4)

#Never use Mutable(modifiable) object is default argument: this will create list again and again due mutable object in default argument that is list here it will be created again and again whenever the function is called 
#List=[ordered, duplicates alowed] , dict={"tupple is used inside dictionary if required" : Not list}, set ={unordered , unique}
#stored as containers
#memory address stays same
def mutable_notmutable():
    def mutable(item,Items=[]):
        Items.append(item)
        return Items
    
    result = mutable(1)
    print(result)

#this None is not mutable(not modifiable) so it will not create new lists again and again
#int, float , string , bool , tuple = (ordered, duplicate allowed)
#stores fix values in memory
#any change creates a new object 
    def not_mutable(item,Items=None):
        if Items is None:
            Items = []
        Items.append(item)
        return Items
    resultnew = not_mutable(3)
    print(resultnew) 

#*args for variable positiional arguments - *args converts it into tupple

def add_all(*num):
    return sum(num)

#**kwargs for variable keyword arguments - converts it into dictionary

def displayinfo(**info):
    print(info)

#returning multiple values from a function
def compute_stats(numbers):
    sum = 5+ numbers
    sumn = 6+ numbers
    sumnn = 4 + numbers

    return sum, sumn, sumnn

# def error(a: int, b: int):
#     try:
#         sum = a + b/0
#         sum == 5
#     # except ValueError:
# #         sum = a + b/0
# #               ~^~
# # ZeroDivisionError: division by zero

#     except Exception as e:
#         minus = a - b
#         print("code failed",e)
#     else:
#         print("code did not failed")
#     finally:
#         print("this part always runs")    





def custom_error(age):
    try:
        if age < 0:
            raise Exception("Age cannot be negative")
    except Exception as e:
        print("code failed", e)
    else:
        print("code did not failed")
    finally:
        print("this part always runs")    




#create list of 5 fruit print last fruit
def list_pract(mylist:list):
#last element
    length = len(mylist)
    last_element = mylist[length-1]
    print(last_element)
#replaced last element with 5 last element 
    new_element = length-1
    mylist[new_element] = 5
    for i in mylist:
        print(i)
#added a new last element
    mylist.append(29)
    for i in mylist:
        print("/n",i)

#List of dictionaries

def list_of_dict():
    students = [
        {"name" : "Musa", "marks" : 92},
        {"name" : "Saad", "marks" : 89},
        {"name" : "Kaif", "marks" : 89.1}
    ]

    for student in students:
        if student["marks"] > 90:
            print("Pass")
        else:
            print("Fail")
        
        # continue //due to this the next line skips 
        # break //due to this the entire flow stops and the above for loop only executes once
        if student["marks"] >90:
            print(f"{student['name']} is the topper")
        else:
            print(f"{student['name']} is not the topper")


#CREATING A JSON AND STORING IT IN THE FOLDER            
def summary_list_of_dict():
    summary = [
        {"individual_summary" : "asidbjwedbsfjsadbmfnbdms sndf snbdfnms dfsdkjfnsajkdfns dfjsnfkjsanf sadjkfnsfm, "},
        {"overall_summary" : "asidjnsjkd sdjnbasjkdb asdbjd nbdfnbdbsdmnsbdfnsafmnbas fmsadfjbkjfbsnsad f231ui4hiurwqm jknbjnm41 qranfkjlbnAF"}
    ]
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_FOLDER = os.path.join(BASE_DIR, "output")

    # Create the output folder if it doesn't exist
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)

    output_file_path = os.path.join(OUTPUT_FOLDER, "summaryoutput.json")

    with open(output_file_path, "w") as file:
        json.dump(summary, file, indent=4)




# def extract_list_from_dict():
#     classroom = {
#         "students" : ["Musa", "Maaz"],
#         "Hi" : "Bye"
#     }
#     newlist = []
#     for student in classroom['students']:
#         newlist.append(student)

#     print(newlist)        


if __name__ == "__main__":
    # download_blob()
    # greet_user() 
    # mutable_notmutable()
    # result = add_all(2,2,213,1234,2)  
    # print(result)
    # displayinfo(Name = "Musa", Vehicle = "Bike")
    # lo, hi, new = compute_stats(3)
    #Error handling
    # error(1,2)  
    # custom_error(-2)  
    # list_pract([14,21,33,24])
    # list_of_dict()
    # summary_list_of_dict()
    # extract_list_from_dict()
    #importing
    #utils.py file
    #import utils.py (this is a module import)

    #Now package is folder which contains __init__.py
    #eg: 
    # Project
    #     utils
    #         __init__.py
    #         file_utils.py
    # now we can access (from utils.file_utils import write_json) (here write_json is a function)
    
      
    



router = APIRouter()

class SanctionResponseRequest(BaseModel):
    result: dict

@router.post(
    "/Eligibility_Sanction_Check_DB_WRITER_MCP",
    operation_id="Eligibility_Sanction_Check_DB_WRITER_MCP",
    summary="Extract is_Sanctioned flag from MCP response and based on the Eligibility Status the tables in the database gets populated"
)

async def sanction_router(request: SanctionResponseRequest):
    try:
        is_sanctioned_flag = extract_sanction_status(request.result)

        return JSONResponse(
            content={
                "jsonrpc":"2.0"
                "id": 1,
                "result": {
                    "status": True,
                    "is_Sanctioned": is_sanctioned_flag
                }
            },
            status_code=200
        )

except Exception as e:
    tb = traceback.format_exc()
    print(tb, file=sys.stderr)

        return JSONResponse(
            content={
                "jsonrpc": "2.0",
                "id": request.id,
                "result": {
                    "status": False,
                    "error": str(e),
                    "trace": tb
                }
            },
            status_code=200
        )




from sqlmodel import Session, select
from models import RefEligibilityCheck
from db import get_engine

def process_sanction_and_eligibility(mcp_result: dict) -> dict:
    """
    - Extract is_Sanctioned (NO DEFAULTS)
    - Decide eligibility status
    - Fetch corresponding row from ref_eligibility_check
    - Return column values
    """

    # ---------- VALIDATION ----------
    if not isinstance(mcp_result, dict):
        return {
            "status": False,
            "error": "Invalid MCP result format (expected dict)"
        }
    
    results = mcp_result.get("results")
    if not isinstance(results, list) or not results:
        return{
            "status": False,
            "error": "'results' missing or empty in MCP response"            
        }

    record = results[0]

    if "is_Sanctioned" not in record:
        return {
            "status": False,
            "error": "'is_Sanctioned' field missing in MCP response"
        }

    is_sanctioned = record["is_Sanctioned"]

    if not isinstance(is_sanctioned, bool):
        return {
            "status": False,
            "error": "'is_Sanctioned' must be boolean"
        }
    
    eligibility_status = "Not Eligible" if is_sanctioned else "Eligible"


    engine = get_engine()
    with Session(engine) as session:
        stmt = select(RefEligibilityCheck).where(
            RefEligibilityCheck.eligibility_status == eligibility_status
        )
        row = session.exec(stmt).first()

        if not row:
            return {
                "status": False,
                "error": f"No row found for Eligibility Status = '{eligibility_status}'"
            }

        # ---------- RESPONSE ----------
        return {
            "status": True,
            "eligibility_status": row.eligibility_status,
            "reason_summary": row.reason_summary,
            "line_of_business": row.line_of_business,
            "location_risk_zone": row.location_risk_zone,
            "business_type": row.business_type,
            "licensing_and_sanction_check": row.licensing_and_sanction_check,
            "source_of_check": row.source_of_check,
            "approval_flag": row.approval_flag
        }
