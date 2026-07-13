OpenAi embedding
recursivecharater splitter
os
dotenv
AIpromttemplate
llm model response -> string (outputparser)
vector database
runnable passthrough


def load_env():
    load_dotenv()
    API_key= os.getenv(openAPIkey)
    if not API_key:
        raise ValueError("key is not present ")
    return API_key

def load_document():
    with open(filepath,"r",encoding = "utf-8" as f):
        return f.read()

def chunk_store_vector_database(text: str):
    split = recursivecharaterTextSplitter(
        chunk_size = 300,
        chunk_overlap = 50
    )
    text_split = split.create_document([text])

    openembedding = OpenAiEmbedding(model = "")

    # Vecotr database + Embedding
    Vect_database = FAIIS.to_create_docuemnt(text_split, openembedding) 

def promtteplate():













































here wher eis retriever.iinvoke are we invoking or not??


# rag_simple.py

import os

from dotenv import load_dotenv

from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from langchain_community.vectorstores import FAISS

from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_core.prompts import ChatPromptTemplate

from langchain_core.output_parsers import StrOutputParser

from langchain_core.runnables import RunnablePassthrough


def load_env():

    """

    Load environment variables from .env file.

    """

    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:

        raise ValueError("OPENAI_API_KEY is missing in .env file")

    return api_key


def load_document_text(file_path: str) -> str:

    """

    Read the full text of a document from a file.

    """

    with open(file_path, "r", encoding="utf-8") as f:

        return f.read()


def build_vectorstore_from_text(text: str) -> FAISS:

    """

    1) Split the text into chunks

    2) Convert chunks into embeddings

    3) Store them in a FAISS vectorstore

    """

    # 1. Split text into smaller pieces (chunks)

    text_splitter = RecursiveCharacterTextSplitter(

        chunk_size=300,      # max characters in one chunk

        chunk_overlap=50     # overlap to keep context continuity

    )

    documents = text_splitter.create_documents([text])

    # 2. Create embeddings object (turn text into vectors)

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    # 3. Build FAISS vectorstore from documents

    vectorstore = FAISS.from_documents(documents, embeddings)

    return vectorstore


def build_rag_chain(vectorstore: FAISS, model: ChatOpenAI):

    """

    Create a RAG chain:

    - retrieve relevant chunks from vectorstore

    - feed them + question into the LLM with a prompt

    """

    retriever = vectorstore.as_retriever()

    prompt = ChatPromptTemplate.from_template(

        """

You are an assistant for question-answering about an insurance policy.

Use ONLY the information in the context below.

If the answer is not in the context, say "I don't know based on the given document."

Context:

{context}

Question: {question}

Answer in simple, clear English:

"""

    )

    # LCEL chain:

    # 1) Prepare inputs: "context" from retriever, "question" from user

    # 2) Pass through prompt -> model -> output parser

    rag_chain = (

        {

            "context": retriever,            # retriever will receive the question

            "question": RunnablePassthrough()  # passes the question through as-is

        }

        | prompt

        | model

        | StrOutputParser()

    )
rag_chain({"asda":sad,"sad":wqd} promnpt model stroutparser())
    return rag_chain


def main():

    # ----- 1. Load API key -----

    load_env()

    # ----- 2. Load document text -----

    data_path = os.path.join("data", "insurance_guide.txt")

    if not os.path.exists(data_path):

        raise FileNotFoundError(f"File not found: {data_path}")

    full_text = load_document_text(data_path)

    # ----- 3. Build vectorstore (this is the 'R' in RAG: Retrieval) -----

    print("Building vectorstore from document...")

    vectorstore = build_vectorstore_from_text(full_text)

    # ----- 4. Create LLM model (the 'G' in RAG: Generation) -----

    model = ChatOpenAI(

        model="gpt-4o-mini",  # you can change this model name

        temperature=0.0       # 0.0 = more factual, less creative

    )

    # ----- 5. Build RAG chain -----

    rag_chain = build_rag_chain(vectorstore, model)

    # ----- 6. Simple loop to ask questions -----

    print("\nRAG system is ready. Ask questions about the insurance document.")

    print("Type 'exit' to quit.\n")

    while True:

        user_question = input("Your question: ").strip()

        if user_question.lower() in ("exit", "quit"):

            print("Goodbye!")

            break

        if not user_question:

            print("Please type a question.")

            continue

        # Call the RAG chain with the question

        try:

            answer = rag_chain.invoke(user_question)

            print("\nAnswer:")

            print(answer)

            print("-" * 60)

        except Exception as e:

            print(f"Error while answering: {e}")

            print("-" * 60)


if __name__ == "__main__":

    main()
 
