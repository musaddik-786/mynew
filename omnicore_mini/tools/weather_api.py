from lanngchain_core.tools import tools

@tools
def get_weather(city: str) -> str:
    "Get Weather using wttr.in"
    temp = 10

    return f"Temperature in {City} is {tempy} C"