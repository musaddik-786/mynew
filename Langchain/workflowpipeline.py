# workflow_pipeline.py

import os

from dotenv import load_dotenv

from langchain_core.runnables import RunnableLambda

from langchain_core.prompts import ChatPromptTemplate

from langchain_openai import ChatOpenAI

from langchain_core.output_parsers import StrOutputParser

load_dotenv()


# ---------------------------------------------

# Step 1: CLEAN INPUT

# ---------------------------------------------

def clean_text(text: str) -> str:

    """

    Remove unnecessary punctuation, spaces, and normalize text.

    """

    cleaned = text.strip()

    cleaned = cleaned.replace("\n", " ")

    cleaned = " ".join(cleaned.split())  # collapse multiple spaces

    return cleaned


clean_step = RunnableLambda(clean_text)


# ---------------------------------------------

# Step 2: LLM EXTRACTION STEP

# ---------------------------------------------

extraction_prompt = ChatPromptTemplate.from_template("""

Extract the following information from the sentence:

- Age

- Gender

- Sum insured

Sentence: {text}

Return the answer in clean, simple English.

""")

model = ChatOpenAI(model="gpt-4o-mini", temperature=0)

llm_step = extraction_prompt | model | StrOutputParser()


# ---------------------------------------------

# Step 3: FORMAT OUTPUT (LLM AGAIN)

# ---------------------------------------------

format_prompt = ChatPromptTemplate.from_template("""

Convert the following extraction into JSON:

{extraction}

The JSON keys must be: age, gender, sum_insured.

""")

format_step = format_prompt | model | StrOutputParser()


# ---------------------------------------------

# BUILD THE WORKFLOW PIPELINE

# ---------------------------------------------

pipeline = (

    clean_step

    | llm_step

    | format_step

)


# ---------------------------------------------

# RUN PIPELINE

# ---------------------------------------------

def main():

    print("Workflow pipeline ready. Type input or 'exit'.\n")

    while True:

        text = input("Input sentence: ").strip()

        if text.lower() in ("exit", "quit"):

            break

        result = pipeline.invoke(text)

        print("\nPipeline Output:")

        print(result)

        print("-" * 60)


if __name__ == "__main__":

    main()
 