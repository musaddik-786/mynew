import random

names=[
"Alex Taylor","Jordan Smith","Chris Morgan",
"Taylor Holdings","Morgan Risk Ltd",
"Pacific Underwriters","Summit Brokers"
]

phones=[
"+64 21 555 0198",
"021-555-0198",
"64 21 5550198",
"+64 (21) 555 0198",
"0215550198"
]

zips=[
"95123","94107","10001","400001","20005"
]

years=[
"1998","2001","2005","2010","2015"
]

noise_blocks=[

"""
Inspection notes:
Minor wear observed.
Previous claim ref CL8821.
Surveyor comments archived.
""",

"""
Maintenance log fragment:
Roof inspection passed.
Drainage acceptable.
Engineer reference ENG9921.
""",

"""
Broker internal note:
Client prefers digital comms.
Risk appetite moderate.
Underwriting review pending.
""",

"""
Document appendix:
Photos archived separately.
Structural review recommended.
Policy subject to renewal review.
"""
]

formats=[

lambda n,p,z,y: f"""
INSURANCE SUBMISSION

Client: {n}

Contact pathways:
Primary mobile -> {p}

Construction metadata:
Property likely built circa {y}

Geographic code:
ZIP:{z}
""",

lambda n,p,z,y: f"""
CLIENT DATA RECORD

Holder : {n}

Reach at:
Tel number {p}

Asset notes:
Construction year believed {y}

Postal marker {z}
""",

lambda n,p,z,y: f"""
UNDERWRITING SNAPSHOT

Entity name {n}

Communication:
Mobile contact = {p}

Risk notes:
Dwelling erected approx {y}

Location identifier {z}
""",

lambda n,p,z,y: f"""
RISK REPORT

Policy customer {n}

Phone listing:
{p}

Asset built year {y}

Area code {z}
"""
]

output="complex_realistic_corpus.txt"

with open(output,"w",encoding="utf-8") as f:

    for i in range(15000):

        name=random.choice(names)+"_"+str(i)

        phone=random.choice(phones)

        zipc=random.choice(zips)

        year=random.choice(years)

        template=random.choice(formats)

        doc=template(name,phone,zipc,year)

        doc+=random.choice(noise_blocks)

        # Add random garbage lines
        if random.random()>0.6:

            doc+=f"\nReference ID: REF{i}{random.randint(100,999)}"

        if random.random()>0.5:

            doc+=f"\nInternal code ZX-{random.randint(1000,9999)}"

        f.write(doc+"\n\n")

print("Complex corpus generated")

