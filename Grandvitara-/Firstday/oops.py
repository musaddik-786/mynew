# class LLMClient:
#     def __init__(self, model_name, api_key):
#         self.model_name = model_name   # instance attribute
#         self.api_key = api_key
#     def generate(self, prompt):
#         return f"[{self.model_name}] response to: {prompt}"
    
# # creating objects (instances)
# client1 = LLMClient("claude-sonnet-4-6", "key-abc")
# client2 = LLMClient("gpt-5", "key-xyz")

# print(client1.generate("hello"))  # [claude-sonnet-4-6] response to: hello
# print(client2.generate("hello"))  # [gpt-5] response to: hello


# class llmclient:
#     def __init__(self,modelname,apikey):
#         self.modelname = modelname
#         self.apikey = apikey
#     def generate(self,prompt):
#         return f"[{self.modelname}] response to: {prompt}"
    
# client1 = llmclient("ollama","key1")
# client2 = llmclient("claude","key2")

# print(client1.generate("hi"))



# class EmbeddingModel:
#    def __init__(self,name,dimension):
#       self.name = name
#       self.dimension = dimension

#    def embed(self,text):
#       return [0.0] * self.dimension
   

# model1 = EmbeddingModel("MiniEmbed", 4)
# model2 = EmbeddingModel("LargeEmbed", 8)



# print(f"{model1.name} embedding:", model1.embed("Hello world"))
# print(f"{model2.name} embedding:", model2.embed("Hello world"))





# class VectorStore:    
#     def __init__(self):        
#         self._documents = []   # underscore = "internal, don't touch directly" (convention, not enforced)    
#     def add_document(self, doc):        
#         self._documents.append(doc)    
#     def count(self):        
#         return len(self._documents)

# client1 = VectorStore()



# # Encapsulation
# class BankAccount:
#     def __init__(self, balance):
#         self.__balance = balance

# acc = BankAccount(10000)
# # acc.__balance = -500000
# # print(acc.__balance)
# print(acc.__dict__)
# print(acc._BankAccount__balance)


#   File "c:\Users\2000137378\Desktop\newproject\Grandvitara-\Firstday\oops.py", line 68, in <module>
#     print(acc.__balance)
#           ^^^^^^^^^^^^^
# AttributeError: 'BankAccount' object has no attribute '__balance'
# PS C:\Users\2000137378\Desktop\newproject> 


#composition is for has a relation and inheritance is for is a
# for eg car is not an engine rather it is car is a engine

#Composition
# class Engine:
#     def start(self):
#         print("Engine started")

# class Car:
#     def __init__(self):
#         self.engine = Engine()

# here self.engine is the composition
# car = Car()
# car.engine.start()


#Inheritance
# class eengine():
#     def start(self):
#         print("Engine Started")
# class caar(eengine):
#     pass
# CAAar = caar()
# CAAar.start()

# as you can see both looks same its just a different between is a and has a



#functions in python are object-----------------------------
# def greet():
#     print("Hello")

# x= greet # x stores the funciton object 

# x()



# def greet():
#     print("Hello")
# def execute(func):
#     func()

# execute(greet)



#lets say there are many functions and you want them to print hello at the begining of each function but you cannot repetatively write hello in all the functions right
# so here comes DECORARTORS-----------------------------------------------------------------------------

# def decorator(func):
#     print("this is decorator function")
#     func()

# @decorator 
# def greet():
#     print("Hi How are you")



# @ = means, greet = decorator(greet)

#Generators---------------------------------------------------------------------------------------------

# def greet():
#     print("hi1")
#     yield 1
#     print("hi2")
#     yield 2
#     print("hi3")
#     yield 3

# x = greet()
# print(next(x))
# print(next(x))
# print(next(x))

# print("END")



#===-----------------------------------------------------
# def greet2():
#     print("hi1")
#     yield 1
#     print("hi2")
#     yield 2
#     print("hi3")
#     yield 3

# x = greet2()
# for value in x:
#     print(value)

#===-----------------------------------------------------
# def greet():
#     print("hi1")
#     yield 1
#     print("hi2")
#     yield 2
#     print("hi3")
#     yield 3
#     print("This is for value in x to print 4")
#     yield 4

# x = greet()
# print(next(x))
# print(next(x))
# print(next(x))

# print("END")

# #below will print 4 because already we are done with yiled 3 above as next we did 3 times so only 4 is left
# for value in x:
#     print(value)




# context managers-------------------------------------------------------------------------------
# file = open("file.txt") as f:
# content = file.read()
# file.close() this has to be closed to prevent data leakage


# we can alos use try finally as well
# try:
#     file = open("file.txt") as f:
#     content = file.read()
# finally:
#     file.close()


# Now instead of closing it using try finallly like this we can use with 

# with open("file.txt") as file:
#     content = file.read()

# using with automatically closes it

import asyncio

# async def greet(): #async means to not to run anything immediately
#     print("before await")
#     await asyncio.sleep(5)
#     print("Hi, this will print after 5 sec")

# greet() this will not run to run this either we have to use asyncio.run or await

# asyncio.run(greet())

# async def greet(): 
#     print("before await")
#     await asyncio.sleep(5)
#     print("Hi, this will print after 5 sec")
# async def greet1():
#     await asyncio.sleep(2)
#     print(" this will print first no matter which funciton is called first as it has only 2 sec of waiting time which is less then 5 sec")

# async def main():
#     await asyncio.gather(
#         greet(),
#         greet1()
#     )

# asyncio.run(main())
# asyncio.run(greet1())


# Threading and Multithreading skipped coding-------------------------------------------------------------























# class llmclient:
#    def __init__(self, modelname, apikey):
#        self.modelname = modelname
#        self.apikey = apikey
#    def generate(self, prompt):
#        return f"[{self.modelname}] response to: {prompt}"
# client1 = llmclient("ollama", "key1")
# print(client1.generate("hi"))

# ⸻

# First Question
# What is
# __init__()
# ?
# You said:
# init is a special method that acts as constructor and is used to assign properties to objects.
# Almost correct.
# More accurate definition:
# __init__() is a special method that Python automatically calls immediately after an object is created.
# When you write:
# client1 = llmclient("ollama", "key1")
# Python internally does something like:
# client1 = llmclient.__new__(llmclient)
# client1.__init__("ollama", "key1")
# Don’t worry about __new__() yet.
# Just remember:
# llmclient(...)
# automatically calls:
# __init__()

# ⸻

# Second Question
# Is
# self
# mandatory?
# Inside instance methods, yes.
# Example:
# class Test:
#    def show(self):
#        print("Hello")
# When you call:
# obj = Test()
# obj.show()
# Python secretly converts:
# obj.show()
# into:
# Test.show(obj)
# Notice:
# obj
# is passed automatically.
# That object becomes:
# self
# inside the function.
# So:
# def show(self):
# means:
# def show(current_object):
# You could actually write:
# class Test:
#    def show(myobject):
#        print("Hello")
# and it works.
# Example:
# obj = Test()
# obj.show()
# Still works.
# Because:
# self
# is just a naming convention.
# But EVERY Python developer uses:
# self

# ⸻

# Why Do We Need Self?
# Suppose:
# client1 = llmclient("ollama","key1")
# client2 = llmclient("claude","key2")
# Both objects need their own values.
# Without self:
# modelname = "?"
# apikey = "?"
# Python wouldn’t know which object’s values to use.
# With self:
# self.modelname
# means:
# current object's modelname

# ⸻

# Third Question
# Can We Create Objects Without __init__()?
# YES.
# Example:
# class llmclient:
#    pass
# Create object:
# client1 = llmclient()
# Works perfectly.

# ⸻

# Then How Do We Add Data?
# Manually.
# class llmclient:
#    pass
# client1 = llmclient()
# client1.modelname = "ollama"
# client1.apikey = "key1"
# Now:
# print(client1.modelname)
# Output:
# ollama

# ⸻

# Then Why Use
# __init__()
# ?
# Without init:
# client1 = llmclient()
# client1.modelname = "ollama"
# client1.apikey = "key1"
# client2 = llmclient()
# client2.modelname = "claude"
# client2.apikey = "key2"
# Lots of repeated code.
# With init:
# client1 = llmclient("ollama","key1")
# client2 = llmclient("claude","key2")
# Much cleaner.

# ⸻

# Real Reason We Use Init
# To guarantee every object starts with valid data.
# Imagine:
# class llmclient:
#    pass
# client1 = llmclient()
# Now:
# print(client1.modelname)
# Error:
# AttributeError
# because modelname was never assigned.
# With init:
# class llmclient:
#    def __init__(self, modelname, apikey):
#        self.modelname = modelname
#        self.apikey = apikey
# Every object automatically gets:
# modelname
# apikey
# when created.

# ⸻

# What Does This Line Really Mean?
# self.modelname = modelname
# Left side:
# self.modelname
# means:
# Create/store a variable inside the object.
# Right side:
# modelname
# means:
# Take the parameter passed into the function.
# Example:
# client1 = llmclient("ollama","key1")
# Inside init:
# modelname = "ollama"
# apikey = "key1"
# So:
# self.modelname = modelname
# becomes:
# self.modelname = "ollama"

# ⸻

# Think of the object like a dictionary.
# After:
# client1 = llmclient("ollama","key1")
# internally it looks roughly like:
# {
#    "modelname": "ollama",
#    "apikey": "key1"
# }
# and:
# client1.modelname
# simply reads that stored value.

# ⸻

# Quick check:
# Can you tell me what will happen here?
# class Student:
#    def __init__(self, name):
#        name = name
# s1 = Student("Musaddique")
# print(s1.name)
# Will it print "Musaddique" or throw an error? And why? This question reveals whether you’ve understood the difference between:
# name
# and
# self.name
# Excellent question. Let’s slow down and understand what’s actually happening.
# Your code:
# class llmclient:
#    def __init__(self, modelname, apikey):
#        self.modelname = modelname
#        self.apikey = apikey
#    def generate(self, prompt):
#        return f"[{self.modelname}] response to: {prompt}"
# client1 = llmclient("ollama", "key1")
# print(client1.generate("hi"))
