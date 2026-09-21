# Employee-Dashboard-Demo
This is a snapshot of an employee dashboard that I made while working for Permco at the time I was let go. This project was intended to be the start of a brand new system that would take all the separate systems and apps that were developed over the years and bring them into one connected system with better functionality and a more intuitive user interface. The dashboard was originally connected to a postgres database, but to make it easy for any viewers to get this running, I have added a simple sqlite database that runs in memory.

# What is This Project and Why Should You Care?
This project is a full-stack employee dashboard that was built using:
- Flask
- SQLAlchemy
- PostgreSQL (SQLite added for your ease of use)
- Vite

This project demonstrates my ability to build a full-stack web application from the ground up with **no prior experience**. Yes, you read that right. Before this, I was a C# / .NET Application developer focusing on VR applications. This was my first ever experience doing web developement and this project took me about 2.5 months to reach the point it is at now. This shows that I am a quick leaner and able to pick up new skills quickly. This was truly a **full-stack** project as I fully designed:
- A Reactive frontend css and html codebase
- A PostgreSQL databse
- The Data Models and API
- The User Authentication and Authorization using OpenId and Oauth
- Many User focued features

## Requirements:
1. Python 3.14 installed on your system
2. Node.js Lts (24.21.0 as of latest commit)

## Quick Setup
Clone the project and navigate to the folder in your terminal
### 1. Setup
Run the setup script\
Windows:
~~~
$ .\setup.ps1
~~~

Mac / Linux:
~~~
$ .\setup.sh
~~~

### - Run
Run the program. Then navigate to http://127.0.0.1:5000/ \
Windows:
~~~
$ .\run.ps1
~~~
Mac / Linux:
~~~
$ .\run.sh
~~~

## Full Setup
Clone the project and navigate to the folder in your terminal.

### Create Python Environment and Activate It
Windows:
~~~
$ python -m venv .venv
$ .venv\Scripts\Activate.ps1
~~~
Mac / Linux:
~~~
$ python -m venv .venv
$ source .venv/bin/activate
~~~

### Install Dependencies
~~~
$ python -m pip install -r "./requirements.txt"
$ npm install 
~~~

### Run it and Navigate
Navigate to http://127.0.0.1:5000/ \
Windows:
~~~
$ .\run.ps1
~~~
Mac / Linux:
~~~
$ .\run.sh
~~~