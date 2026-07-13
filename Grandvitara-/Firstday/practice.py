# instance variables
# class variables
# global variables
# local variables

# local variables
# class Demo:
#     def greet(self):
#         local_variable = "Hi I am local"
#         print(local_variable)
#     def accessing_local_variable(self):
#         print(self.local_variable)
# obj1 = Demo()
# obj1.greet()
# obj1.accessing_local_variable() # here as you can see local variable is not accessible



# instance variables + unique per objects 
# class Demo:
#     def __init__(self,name):
#         self.name = name

#     def accessing_instance_variable(self):
#         print(self.name) #as u can see the instance variable(self.name) can be accessed here

# c1 = Demo("Musaddique")
# c1.accessing_instance_variable()



# class variables : common for all the objects ie shared by every object
# class Demo:
#     mycommon_Schoolname = "MIT"
#     def __init__(self,name):
#         self.name = name

#     def accessing_instance_variable(self):
#         print(self.name) #as u can see the instance variable can be accessed here

# c1 = Demo("Musaddique")
# c2 = Demo("Anam")
# c1.accessing_instance_variable()
# print(c1.mycommon_Schoolname)
# print(c2.mycommon_Schoolname)

# c1.mycommon_Schoolname = "Crescent" #class variable got overriden for one of the objects

# print(c1.mycommon_Schoolname)
# print(c2.mycommon_Schoolname)



# global variables


# API_VERSION = "v1"   # global variable

# class Demo:
#     def accessing_global_variable(self):
#         print(API_VERSION)   # can read the global directly


# Types of Methods:-------------------------------------------------------------------------------
# Instance Methods
# Class Methods
# Static Methods


# Instance Methods has self in it

# class Demo:
#     mycommon_Schoolname = "MIT"
#     def __init__(self,name):
#         self.name = name

#     def accessing_instance_variable(self): #instance method
#         print(self.name) #as u can see the instance variable can be accessed here

# c1 = Demo("Musaddique")
# c2 = Demo("Anam")
# c1.accessing_instance_variable()
# print(c1.mycommon_Schoolname)
# print(c2.mycommon_Schoolname)


#class method
# class Demo:
#     mycommon_Schoolname = "MIT"
#     def __init__(self,name):
#         self.name = name

#     def accessing_instance_variable(self):
#         print(self.name) #as u can see the instance variable can be accessed here

# c1 = Demo("Musaddique")
# c2 = Demo("Anam")
# c1.accessing_instance_variable()
# print(c1.mycommon_Schoolname)
# print(c2.mycommon_Schoolname)

# now i want to rename this school for all the objects so we need a single funciton that can do this job
# instead of each time editing the objects school name


# class Student:
#     def __init__(self, school_name):
#         self.school_name = school_name

#     @classmethod
#     def change_school_name(cls,sclname):
#         cls.school_name = sclname
    
# c1 = Student("MIT")
# c1.change_school_name("Crescent")

# print(c1.school_name)


# print(Student.school_name)   # Crescent (class variable)

# print(c1.school_name)  # MIT (instance variable)

# Python always looks for an instance attribute first. Since c1 already has its own school_name, it uses "MIT" and ignores the class variable.


# class Student:
#     #we need global variable here not instance variable so that we can change the school name for all the objects 
#     school_name = "MIT"

#     @classmethod
#     def change_school_name(cls,sclname):
#         cls.school_name = sclname
    
# c1 = Student()
# c1.change_school_name("Crescent")

# print(c1.school_name)
# c2 = Student()
# c2.change_school_name("Pius")
# print(c2.school_name)
# print(c1.school_name)

# What exactly is cls? It behaves exactly like self, just one level up: self means "the current object", cls means "the current class". When you call:





# class BankAccount:
#     def __init__(self, balance):
#         self.__balance = balance

# acc = BankAccount(10000)

# print(acc.balance)

#gave roor as it is private but still accessible
# print(acc._BankAccount__balance)# but this is not recommended
# instead of this create getter function


# this is what is encapsulation is 

# Encapsulation

#         |-- Public variables

#         |-- Protected variables (_)

#         |-- Private variables (__)

#         |-- Getters

#         |-- Setters

#         '-- @property

# class BankAccount:
#     def __init__(self, balance):
#         self.__balance = balance

#     def get(self):
#         return self.__balance
#     def set_balance(self, balance):
#         self.__balance = balance
# acc = BankAccount(10000)
# print(acc.get())
# acc.set_balance(299)
# print(acc.get())

# acc2=BankAccount(2000)
# print(acc2.get())



# @property is modern way of getter and setter

# class BankAccount:

#     def __init__(self, balance):

#         self.__balance = balance

 

#     @property
#     def balance(self):

#         return self.__balance

 

# acc = BankAccount(10000)

# print(acc.balance)   # 10000 -- no parentheses! looks like a plain variable



# @x.setter

# A read-only property is useful on its own, but if you also want controlled writing (like the old set_balance), you add a second method with the same name, decorated with @balance.setter:

# class BankAccount:

#     def __init__(self, balance):

#         self.__balance = balance

 

#     @property

#     def balance(self):

#         return self.__balance

 

#     @balance.setter

#     def balance(self, amount):

#         if amount < 0:

#             print("Invalid")

#         else:

#             self.__balance = amount



# 14.2 Single underscore — self._salary

# class Employee:

#     def __init__(self):

#         self._salary = 50000

# Can we still access it? Yes, completely normally:

# e = Employee()

# print(e._salary)   # 50000 -- works

# Can we still modify it, or even delete it? Yes, both work with zero resistance from Python:

# e._salary = 90000   # works

# del e._salary       # works

# So what's the actual point, if Python enforces nothing? The point is purely communication: this variable is internal — please don't touch it unless you know what you're doing. It is a convention, full stop, not a technical barrier. Going back to the office analogy: the "Employees Only" door is unlocked. You CAN walk through it. You are simply expected not to.

# Why do professionals bother with it then? Because when another developer on the team reads self._cache, they immediately understand, without needing a comment: this is an internal implementation detail, not part of the class's intended public interface.

# An AI-flavoured example:

# class LLMClient:

#     def __init__(self):

#         self._token_count = 0   # internal bookkeeping, not meant for outside code

# Should a user of LLMClient go and write client._token_count = 999999 from outside? Almost certainly not — that variable exists purely for the class's own internal tracking, and changing it directly would likely corrupt that bookkeeping.

# 14.3 Single underscore on methods, not just variables

# The exact same convention applies to methods too:

# class LLMClient:

#     def generate(self):

#         self._validate_prompt()

 

#     def _validate_prompt(self):

#         print("Checking prompt")

# Technically, could a user call client._validate_prompt() directly from outside? Yes, Python won't stop them. But conceptually, no — that method exists purely to be used internally by generate(). It was never designed to be called on its own, and doing so bypasses the structure the class was designed around.




#inheritance

# class A:
#     def greet(self):
#         print("Hi")
# class B(A):
#     def newgreet(self):
#         print("Hello")
# class C(A):
#     pass
# class D(B):
#     pass

# obj1 = A()
# obj2 = B()
# obj3 = C()
# obj4 = D()
# obj1.greet()
# obj2.greet()
# obj3.greet()
# obj4.newgreet()


# Constructor inheritance
# class A:
#     def __init__(self,name):
#         self.name = name
#         print("This is costructor of class A")
#     def greet(self):
#         print("Hi")
# class B(A):
#     def __init__(self,surname):
#         self.surname = surname
#         print("This is costructor of class B")
#     def newgreet(self):
#         print("Hello")
# class C(A):
#     pass
# class D(B):
#     pass

# # obj1 = A("Musaddiqe")
# obj2 = B("Anam")
# obj3 = C()
# obj4 = D()
# obj1.greet()
# obj2.greet()
# obj3.greet()
# obj4.newgreet()


# as we see above constructor of class B is getting called and not of class A for object of class B but what if we want
# constructor of class A also to be called before constructor of class B

# we add the super keyword

# class A:
#     def __init__(self,name):
#         self.name = name
#         print("This is costructor of class A")
#     def greet(self):
#         print("Hi")
# class B(A):
#     def __init__(self,surname):
#         super().__init__(surname)
#         self.surname = surname
#         print("This is costructor of class B")
#     def newgreet(self):
#         print("Hello")
# class C(A):
#     pass
# class D(B):
#     pass

# # obj1 = A("Musaddiqe")
# obj2 = B("Anam")
# obj3 = C()
# obj4 = D()
# obj1.greet()
# obj2.greet()
# obj3.greet()
# obj4.newgreet()

#polymorphism------------------------------------------------------------
# this means that one method having many forms that is each object can have its own customized function that is getting inherited from parent class
# it is also called as method overriding

# Method overriding means the child defines a method with the exact same name as one already in the parent — and the child's version is what actually runs.


# class Animal:

#     def speak(self):

#         print("Animal Sound")

 

# class Dog(Animal):

#     def speak(self):       # same name as Animal's speak()

#         print("Woof")

 

# d = Dog()

# d.speak() 


# 17.5 Calling the parent's version too, with super()

# Overriding doesn't have to mean throwing away the parent's logic entirely. super() lets a child run the parent's version first, then add its own behavior on top:

class Animal:

    def speak(self):

        print("Animal Sound")

 

class Dog(Animal):

    def speak(self):

        super().speak()   # run the parent's version first

        print("Woof")     # then add Dog's own behavior

 

d = Dog()

d.speak()

# Animal Sound

# Woof

#abstract method





