from langchain_core.tools import tool

@tools
def calculate_premium(age: int, sum_insured: int)-> str: 
    "Simple premium calculation formula"
    premium = age * 15 + sum_insured*0.04
    return f"Premium for age {age} and SI {sum_insured} is {premium:.2f} INR"
    