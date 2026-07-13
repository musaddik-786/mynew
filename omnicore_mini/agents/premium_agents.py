
tools = ["premium_calculator","weather_api"]

def build_premium_agent():

    prompt = ChatPromptTemplate.from message([
        {
            "system", 
            "You are a premium calculation assistant"
            "Use tools when required"

            ("human","{input}")
        }
    ])

    llm = ChatOpenAI(
    model="gpt4o mini", 
    temprature = 0)


    agent_core = create_openai_functions_agent(
        llm=llm
        tools= tools
        prompt = prompt
    )

    agent_executor = AgentExecutor(
        agent=agent_core
        tools = tools,
        verbrose = true
    )

    return agent_executor