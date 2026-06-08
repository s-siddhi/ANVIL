from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List  # NEW: Allows us to accept lists of tasks
import hashlib
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "anvil_db.json"

def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

def load_db():
    if not os.path.exists(DB_FILE):
        return {"users": {}} 
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db(db):
    with open(DB_FILE, "w") as f:
        json.dump(db, f, indent=4)

def get_blank_user_data():
    return {
        "date": str(datetime.now().date()), 
        "tasks": [], 
        "nutrition": {"target_cals": 0, "target_pro": 0, "cals": 0, "pro": 0}, 
        "history": [], 
        "matrix": [0] * 28
    }

def check_date_and_reset(user_data):
    today = str(datetime.now().date())
    if user_data["date"] != today:
        total_tasks = len(user_data["tasks"])
        completed_tasks = sum(1 for t in user_data["tasks"] if t["is_completed"])
        
        if total_tasks > 0:
            user_data["history"].insert(0, {
                "date": user_data["date"],
                "score": f"{completed_tasks}/{total_tasks} Tasks",
                "tasks": user_data["tasks"]
            })
            
        matrix_score = 1 if (total_tasks > 0 and completed_tasks == total_tasks) else 0
        user_data["matrix"].append(matrix_score)
        if len(user_data["matrix"]) > 28:
            user_data["matrix"].pop(0) 
            
        user_data["date"] = today
        user_data["tasks"] = []
        user_data["nutrition"]["cals"] = 0
        user_data["nutrition"]["pro"] = 0
    return user_data

@app.get("/")
def home():
    return {"message": "ANVIL Auth API is online."}

class AuthRequest(BaseModel):
    username: str
    password: str

@app.post("/api/signup")
def signup(auth: AuthRequest):
    db = load_db()
    if auth.username in db["users"]:
        raise HTTPException(status_code=400, detail="User already exists")
    
    db["users"][auth.username] = {
        "password_hash": hash_password(auth.password),
        "data": get_blank_user_data()
    }
    save_db(db)
    return {"message": "User created successfully"}

@app.post("/api/login")
def login(auth: AuthRequest):
    db = load_db()
    user = db["users"].get(auth.username)
    
    if not user or user["password_hash"] != hash_password(auth.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    return {"message": "Login successful", "username": auth.username}

@app.get("/api/dashboard")
def get_dashboard(x_user: str = Header(None)):
    db = load_db()
    if not x_user or x_user not in db["users"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_data = db["users"][x_user]["data"]
    db["users"][x_user]["data"] = check_date_and_reset(user_data)
    save_db(db)
    return db["users"][x_user]["data"]

class Task(BaseModel):
    text: str
    is_completed: bool

    

# NEW: The Master Sync Endpoint
@app.put("/api/tasks")
def sync_tasks(tasks: List[Task], x_user: str = Header(None)):
    """Receives the exact list of tasks on your screen and overwrites the database."""
    db = load_db()
    if not x_user or x_user not in db["users"]:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    db["users"][x_user]["data"]["tasks"] = [t.model_dump() for t in tasks]
    save_db(db)
    return {"status": "success"}



