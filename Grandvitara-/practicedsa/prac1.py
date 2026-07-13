# take input eg 5
# 5 times a person roles two dice simultanoeusly, store all possible outcome,
#  if addition of those pairs >8 print true else flase


# import random

# class MyDice:
#     def __init__(self,n_times,sides=6):
#         self.n_times = n_times
#         self.sides =sides
#         self.all_output =[]
#         self.random_outcomes_list = []
#         self.final_result = []
#     def diceroll(self):
#         for i in range(1, self.sides+1):
#             for j in range (1,self.sides+1):
#                 self.all_output.append((i,j))
#         return self.all_output


#     def random_outcomes(self):
#         for i in range(1,self.n_times+1):
#             die1 = random.randint(i, self.sides)
#             die2 = random.randint(i, self.sides)
#             self.random_outcomes_list.append((die1, die2))
#         # return self.random_outcomes_list
#         return self.random_outcomes_list

#     def result(self):
#         self.final_result = []
#         for pair in self.random_outcomes_list:
#             if sum(pair) > 8:
#                 self.final_result.append(pair)
#         return self.final_result

# # obj1 = MyDice(5)
# # print(obj1.diceroll())
# # print(obj1.random_outcomes())
# obj1 = MyDice(5)

# print("All possible outcomes:")
# print(obj1.diceroll())

# print("Random outcomes:")
# print(obj1.random_outcomes())

# print("Only sums greater than 8:")
# print(obj1.result())










# def maximum():
#     numbers = [2,1,35,4,5,6]
#     great = numbers[0]
#     for i in range(0,len(numbers)):
#         if numbers[i]>great:
#             great = numbers[i]
#     return great

# no = maximum()
# print(no)


#occurences of an element

# def occ_count(fruit_name:str):
#     all_names = ["apple","banana","mango","papaya","apple","apple"]
#     count =0 
#     for i in range(0,len(all_names)):
#         if fruit_name==all_names[i]:
#             count=count+1
#     return count

# c = occ_count("apple")
# print(c)






#remove duplicated from a list

# def dup():
#     result = []
#     mylist = [1,2,3,4,1,2,1,4,12,1,2]
#     for i in range (len(mylist)):
#         for j in range(i+1,len(mylist)):
#             if mylist[i] == mylist[j]:
#                 result.append(mylist[i])
#     return result

# a = dup()
# print(a)








# numbers = [12,12,1,2,3,1,2,34,4,2,3]

# unique_elements=[]

# for n in numbers:
#     if n not in unique_elements:
#         unique_elements.append(n)
# print(unique_elements)



# def dup_all_occurrences():
#     mylist = [1, 2, 3, 4, 1, 2, 1, 4, 12, 1, 2]
#     result = []

#     newlist = sorted(mylist)

#     for i in range(len(newlist) - 1):
#         if newlist[i] == newlist[i + 1]:
#             result.append(newlist[i])

#     return result


# print(dup_all_occurrences())


# import array

# arr1 = array.array('i',[10,20,30,40,50])
# # print(arr1)

# arr1.insert(2,45)
# # print(arr1)


# arr1.remove(10)
# # print(arr1)

# arr1[3]=30
# print(arr1)


# arr2 = array.array('i',[10,200,310,40,50])
# s = sorted(arr2)
# print(type(s)) #this returns a list not an array
# # print(arr2)
# print(type(arr2)) #the original array is not modified by sort

# e = array.array('i',s) #this is how we convert list to array
# print(type(e))

# #Merging
# arr4 = arr1 + arr2
# print(arr4)

# # splitting
# ix = int(len(arr2)/2)
# print(ix)

# print(arr2[ix:])
# print(arr2[:ix])


# same using numpy
# import numpy as np
# np1 = np.array([10,20,30,40,50,60])

# print(np1)


#reverse array without creating a new array
# numbers = [1,2,3,4,5,6,7]
# pointerlast = len(numbers)-1
# pointerfirst = 0
# g = 0
# for n in range(len(numbers)-1):
#     if pointerlast!=n:
#         g=numbers[n]
#         numbers[n] = numbers[pointerlast]
#         numbers[pointerlast] = g
#         pointerlast=pointerlast-1
#     else:
#         break
# print(numbers)


# reverse a array with creating a new array
# numbers = [1,2,3,4,5,6,7]
# pointerlast = len(numbers)-1
# reversed_list=[]
# for n in range(pointerlast,-1,-1):
#     reversed_list.append(numbers[n])

# print(reversed_list)



# # strings skipped all videos of it 

# whatever operations we apply on strings we get a new string ie immutable
# str = "HI i am musa"
# str.split()
# print(type(str.split())) #it gives list so splitting gives us a list and not string
# print(str.split('-'))


str.lower()
str.upper()



# #frequecy of characters
# s = 'banana'

# for n in s:
    










