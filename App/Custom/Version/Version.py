class Version():
    values:list[int]
            
    def __init__(self, nums:list[int]):
        self.values = []
        for num in nums:
            self.values.append(int(num))
    
    @classmethod
    def FromInts(cls, *args:int):
        return cls(list(args))

    @classmethod
    def FromString(cls, version:str):
        parts = version.split(".")
        
        try:
            return cls([int(part) for part in parts])
        except:
            raise ValueError("version string must look like \"x.y.z\" (can be a different size) where x, y, and z are integers")
    
    def __len__(self):
        return len(self.values)
    
    def __getitem__(self, index):
        return self.values[index]
    
    def __str__(self):
        finalStr = ""
        for x in self.values:
            finalStr += f"{x}."
        return finalStr[:-1]
    
    def __repr__(self):
        return str(self)
    
    def __eq__(self, other):
        return self.values == other.values
    
    def __ne__(self, other):
        return self.values != other.values

    def __lt__(self, other):
        return self._whosGreater(other) is other
    
    def __le__(self, other):
        # if the other is greater or neither is greater then self is less than or equal
        return self._whosGreater(other) is other or self._whosGreater(other) is None
    
    def __gt__(self, other):
        return self._whosGreater(other) is self
    
    def __ge__(self, other):
        # if the self is greater or neither is greater then self is greater than or equal
        return self._whosGreater(other) is self or self._whosGreater(other) is None
        
    def _whosGreater(self, other):
        for x in range(0, max(len(self), len(other))):
            # if length of versions are different, test the numbers for the smaller length of both. if numbers don't match, return the larger version
            if(self[x] > other[x]):
                return self
            elif(self[x] < other[x]):
                return other
        
        # if all elements match for the minimum length, if one is longer, then that one is considered bigger
        if(len(self) != len(other)):
            return self if len(self) > len(other) else other

        #if other comparisons fail, then they are equal
        return None