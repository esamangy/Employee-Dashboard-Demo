import pytest
from Version import Version


def test_init():
    version = Version([1, 1, 1])
    assert version.values == [1, 1, 1]
    assert str(version) == "1.1.1"

def test_FromInts():
    version = Version.FromInts(2, 2, 2)
    assert version.values == [2, 2, 2]
    assert str(version) == "2.2.2"

def test_FromString():
    version = Version.FromString("3.3.3")
    assert version.values == [3, 3, 3]
    assert str(version) == "3.3.3"

def test_DiffSizes():
    small = Version.FromString("1")
    assert small.values == [1]
    assert str(small) == "1"

    large = Version([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    assert large.values == [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    assert str(large) == "1.2.3.4.5.6.7.8.9.10"

def test_len():
    v = Version([1, 2, 5])
    assert len(v) == 3
    v = Version([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    assert len(v) == 10

def test_GetItem():
    v = Version([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    assert v[0] == 1
    assert v[5] == 6
    assert v[9] == 10

def test_comparisons():
    v1 = Version([1, 2, 3])
    v2 = Version.FromInts(1, 2, 3)
    v3 = Version.FromString("1.3.2")

    assert v1 == v2
    assert v1 != v3
    assert v1 < v3
    assert v3 > v1
    assert v1 <= v2
    assert v2 >= v1