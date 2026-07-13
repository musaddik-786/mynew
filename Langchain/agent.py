| prompt
| llm.bind_tools([add_numbers])
| StrOutputParser()
is creating a linear chain of execution. This sequence essentially defines the flow of how the input is 
processed, and it can be thought of as a Language Chain Execution (LCE) or a linear execution pipeline.




load_dotenv
os
prompt
agents
tools
function agent for componenets defining
agent execute


load_dotenv()


@tool
def calculation(a,b) -> int:
    int result = a+b
    return result

@tool
def calculations(a,b) - >int:
    int result = a-b
    return result

prompt = ChatPromptTemplate.from_messages([
   ("system", "You are a helpful AI that can use tools for carrying out different calculations."),
   ("human", "{a},{b}")
])

llm = ChatOpenAi(
 model="gpt-4o-mini",
 temperature=0
)

tool = [calculation,calculations]

agent = create_openai_functions_agent(llm, tool, prompt)

agent_executor = AgentExecutor(agent = agent, tools = tools)

def main():
     while True:
       user_input = input("Your question: ").strip()
       if user_input.lower() in ("exit", "quit"):
           break
       result = agent_executor.invoke({"a": user_input},{"b" : user_input2})
       print("\nAgent Answer:")
       print(result["output"])
       print("-" * 60)

if __name__ == "__main__":
   main()
 







#refined tensai code

# agent_with_calculation_tools.py
import os
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.agents import create_openai_functions_agent, AgentExecutor

# -----------------------------
# Load API Key
# -----------------------------
load_dotenv()

# -----------------------------
# Define Tools
# -----------------------------
@tool
def calculation(a: int, b: int) -> str:
    """
    Adds two numbers and returns the result as a string.
    """
    result = a + b
    return f"The result of addition is {result}"

@tool
def calculations(a: int, b: int) -> str:
    """
    Subtracts two numbers and returns the result as a string.
    """
    result = a - b
    return f"The result of subtraction is {result}"

# -----------------------------
# Create Agent Prompt
# -----------------------------
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful AI that can use tools for carrying out different calculations."),
    ("human", "Perform a calculation with the following numbers: {a} and {b}")
])

# -----------------------------
# Build Agent
# -----------------------------
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0
)
tool = [calculation, calculations]
agent = create_openai_functions_agent(
    llm,
    tool,
    prompt
)
agent_executor = AgentExecutor(agent=agent, tools=tool)

# -----------------------------
# Run Agent
# -----------------------------
def main():
    print("Agent ready. Type 'exit' to quit.\n")
    while True:
        a = input("Enter the first number: ").strip()
        b = input("Enter the second number: ").strip()
        if a.lower() in ("exit", "quit") or b.lower() in ("exit", "quit"):
            break
        result = agent_executor.invoke({"a": a, "b": b})
        print("\nAgent Answer:")
        print(result["output"])
        print("-" * 60)

if __name__ == "__main__":
    main()
























#GPT code

# agent_simple.py
import os
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain.agents import create_openai_functions_agent, AgentExecutor

# -----------------------------
# Load API Key
# -----------------------------
load_dotenv()

# -----------------------------
# Define a Tool
# -----------------------------
@tool
def calculator(expression: str) -> str:
   try:
       result = eval(expression)
       return f"Result = {result}"
   except Exception as e:
       return f"Error evaluating expression: {e}"

# -----------------------------
# Create Agent Prompt
# -----------------------------
prompt = ChatPromptTemplate.from_messages([
   ("system", "You are a helpful AI that can use tools."),
   ("human", "{input}")
])

# -----------------------------
# Build Agent
# -----------------------------
llm = ChatOpenAI(
   model="gpt-4o-mini",
   temperature=0
)

tools = [calculator]

agent = create_openai_functions_agent(llm,tools,prompt) #it tells the agent that it has 3 components it can use any 

# Even if no input is provided and the prompt doesn't require input, the prompt is still processed first because it defines the agent's behavior.
# If the prompt doesn’t require input, the agent defaults to using the language model (llm) to generate a response.
# Tools are only invoked if the agent determines they are relevant.

agent_executor = AgentExecutor(agent=agent,tools=tools,verbose=True) # verbase - shows the reasoning and tool calls

# -----------------------------
# Run Agent
# -----------------------------
def main():
   print("Agent ready. Type 'exit' to quit.\n")
   while True:
       user_input = input("Your question: ").strip()
       if user_input.lower() in ("exit", "quit"):
           break
       result = agent_executor.invoke({"input": user_input}) #this "input": is there in prompt should match also this line this triggeres the line [AgentExecutor(agent=agent] and this triggers line [agent = create_openai_functions_agent(llm,tools,prompt)]
       print("\nAgent Answer:")
       print(result["output"])
       print("-" * 60)

if __name__ == "__main__":
   main()














