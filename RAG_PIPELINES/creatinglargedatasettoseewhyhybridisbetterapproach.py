import random
import os

base_text = """
Home Insurance Underwriting Submission Report

Policyholder: Alex Taylor
Contact Number: +64 21 555 0198
Email: alex.taylor@example.co.nz

Property Overview:
Year Built: 1998
Construction: Timber frame
Roof: Colorsteel
Floors: 2

Address:
1234 Maple Ridge Lane
San Jose
California
Zip: 95123

Broker:
Casey Morgan
Harbour Risk Advisory

Claim History:
Water damage 2022
Amount: 2480

"""

cities = [
"San Jose","Auckland","Sydney","London",
"Toronto","Melbourne","Dubai","Mumbai"
]

years=[1990,1995,1998,2001,2005,2010,2015,2020]

zipcodes=["95123","94107","10001","20005","400001"]

phones=[
"+64 21 555 0198",
"+61 488 555 111",
"+1 408 777 222",
"+91 98765 43210"
]

output_file="big_insurance_dataset.txt"

with open(output_file,"w",encoding="utf-8") as f:

    for i in range(20000):   # adjust number here

        text=base_text

        text=text.replace(
            "Alex Taylor",
            "Client_"+str(i)
        )

        text=text.replace(
            "1998",
            str(random.choice(years))
        )

        text=text.replace(
            "San Jose",
            random.choice(cities)
        )

        text=text.replace(
            "95123",
            random.choice(zipcodes)
        )

        text=text.replace(
            "+64 21 555 0198",
            random.choice(phones)
        )

        f.write(text+"\n\n")

print("Dataset generated")