import uvicorn
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date, timedelta, datetime
import random

from db_models import SessionLocal, DailyKPI, HourlyHeatmap, AlertsLog

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

# --- BIẾN TOÀN CỤC ---
# Lưu trạng thái cũ để log
last_table_states: Dict[int, str] = {} 

# Dữ liệu tĩnh buổi sáng (Chỉ đọc 1 lần từ DB, không bao giờ thay đổi)
STATIC_MORNING_TOTAL = 0
STATIC_TABLE_COUNTS = {i: 0 for i in range(1, 9)}
IS_INITIALIZED = False

# Dữ liệu trả về Frontend
current_status = {
    "tables": [],
    "kpi": { "totalGuests": 0, "currentGuests": 0, "occupancy": 0, "avgDwell": 0 },
    "logs": [] 
}

class TableData(BaseModel):
    table_id: int
    headcount: int
    status: str
    dwell_time: int
    alert_type: str

class AIUpdate(BaseModel):
    data: List[TableData]

# Hàm chỉ chạy 1 lần khi khởi động để lấy số liệu tĩnh
def init_static_data(db: Session):
    global STATIC_MORNING_TOTAL, STATIC_TABLE_COUNTS, IS_INITIALIZED, current_status
    if IS_INITIALIZED: return

    today = date.today()
    print("🔒 Đang chốt số liệu buổi sáng (Static)...")
    
    # 1. Lấy tổng khách từng bàn sáng nay (9h-11h)
    # only consider morning hours (9-11) as static data
    rows = (
        db.query(HourlyHeatmap.table_id, func.sum(HourlyHeatmap.guests))
        .filter(HourlyHeatmap.date == today)
        .filter(HourlyHeatmap.hour >= 9)
        .filter(HourlyHeatmap.hour <= 11)
        .group_by(HourlyHeatmap.table_id)
        .all()
    )
    
    STATIC_MORNING_TOTAL = 0
    STATIC_TABLE_COUNTS = {i: 0 for i in range(1, 9)} # Reset về 0 hết

    for t_id, count in rows:
        val = int(count) if count else 0
        STATIC_TABLE_COUNTS[t_id] = val
        STATIC_MORNING_TOTAL += val

    # 2. Load logs cũ
    old_logs = db.query(AlertsLog).filter(func.date(AlertsLog.created_at) == today).order_by(desc(AlertsLog.created_at)).limit(10).all()
    formatted_logs = []
    for log in old_logs:
        msg = log.details.get("msg", "") if log.details else ""
        formatted_logs.append({"id": log.id, "time": log.created_at.strftime("%H:%M"), "type": log.alert_type, "message": msg})
    current_status["logs"] = formatted_logs
    
    IS_INITIALIZED = True
    print(f"✅ Đã chốt. Tổng sáng: {STATIC_MORNING_TOTAL}. Chi tiết bàn: {STATIC_TABLE_COUNTS}")

@app.post("/api/ai/update")
async def receive_ai_data(payload: AIUpdate, db: Session = Depends(get_db)):
    global current_status, last_table_states
    init_static_data(db)
    
    tables = []
    live_guests_now = 0 # Biến này đếm khách đang ngồi ngay lúc này
    busy_tables = 0
    total_dwell = 0
    time_str = datetime.now().strftime("%H:%M:%S")
    new_logs = []

    for item in payload.data:
        # 1. Tính số khách đang ngồi (Live) - dùng headcount trực tiếp
        try:
            current_guests_at_table = int(item.headcount) if item.headcount and int(item.headcount) > 0 else 0
        except Exception:
            current_guests_at_table = 0

        live_guests_now += current_guests_at_table

        # 2. Tính tổng khách bàn = (Số tĩnh sáng nay) + (Số đang ngồi)
        total_history_table = STATIC_TABLE_COUNTS.get(item.table_id, 0) + current_guests_at_table

        alert_msg = item.alert_type
        if item.dwell_time > (15 * 60) and current_guests_at_table > 0:
            alert_msg = "NGOI LAU"

        tables.append({
            "id": item.table_id,
            "name": f"Bàn {item.table_id}",
            "status": item.status,
            "guests": current_guests_at_table,
            "dwellTime": f"{item.dwell_time // 60}p",
            "alert": alert_msg,
            "totalToday": total_history_table
        })

        if current_guests_at_table > 0:
            busy_tables += 1
            total_dwell += (item.dwell_time // 60)

        # Log Logic: detect occupancy transitions based on previous recorded status
        old_status = last_table_states.get(item.table_id, "TRONG")
        # consider a table 'occupied' when headcount > 0
        was_occupied = old_status == "CO KHACH"
        now_occupied = current_guests_at_table > 0

        if not was_occupied and now_occupied:
            new_logs.append({"id": random.randint(10000,99999), "time": time_str, "type": "INFO", "message": f"Bàn {item.table_id}: Khách mới ({current_guests_at_table} người)"})
        elif was_occupied and not now_occupied:
            new_logs.append({"id": random.randint(10000,99999), "time": time_str, "type": "SUCCESS", "message": f"Bàn {item.table_id}: Đã thanh toán"})

        if alert_msg == "NGOI LAU" and random.random() < 0.05:
            new_logs.append({"id": random.randint(10000,99999), "time": time_str, "type": "WARNING", "message": f"Bàn {item.table_id}: >15p"})

        # store a simplified status for next comparison
        last_table_states[item.table_id] = ("CO KHACH" if now_occupied else "TRONG")

    # 3. TÍNH KPI TỔNG
    # Tổng ngày = (Tổng tĩnh sáng 12 người) + (Tổng đang ngồi live)
    # Do NOT mutate STATIC_MORNING_TOTAL; compute final value from static + live
    final_total_guests = int(STATIC_MORNING_TOTAL) + int(live_guests_now)
    
    current_status["tables"] = tables
    current_status["kpi"] = {
        "totalGuests": final_total_guests,   # VD: 12 + 5 = 17
        "currentGuests": live_guests_now,    # VD: 5
        "occupancy": int((busy_tables / 8) * 100),
        "avgDwell": int(total_dwell / busy_tables) if busy_tables > 0 else 0
    }
    
    if new_logs: current_status["logs"] = (new_logs + current_status["logs"])[:20]

    return {"message": "Updated"}

@app.get("/api/dashboard")
async def get_dashboard_data(db: Session = Depends(get_db)):
    init_static_data(db)
    
    response_data = {
        "tables": current_status["tables"],
        "kpi": current_status["kpi"],
        "logs": current_status["logs"],
        "heatmap": [],
        "weekComparison": []
    }
    
    try:
        start_date = date.today() - timedelta(days=6)
        
        # Chart Tuần
        stats = db.query(DailyKPI).filter(DailyKPI.date >= start_date).order_by(DailyKPI.date).all()
        chart_data = []
        days_map = {0: "T2", 1: "T3", 2: "T4", 3: "T5", 4: "T6", 5: "T7", 6: "CN"}
        
        # Hardcode labels: T2..T7, CN (today displayed as CN)
        labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
        chart_data = []

        # Map the previous 6 calendar days to T2..T7 (T2 = today-6, T7 = today-1)
        for idx, label in enumerate(labels):
            if label != "CN":
                days_ago = 6 - idx  # idx 0 -> 6 days ago, idx 5 -> 1 day ago
                d = date.today() - timedelta(days=days_ago)
                record = next((s for s in stats if s.date == d), None)
                val_now = record.total_guests if record else 0
            else:
                # CN (today) value should equal KPI total (static morning + live)
                val_now = int(current_status.get("kpi", {}).get("totalGuests", STATIC_MORNING_TOTAL))

            val_last = int(val_now * 0.9) if val_now > 0 else 5
            chart_data.append({"day": label, "thisWeek": val_now, "lastWeek": val_last})

        response_data["weekComparison"] = chart_data

        # Chart Giờ (Heatmap)
        heatmap_data = []
        heatmap_query = db.query(HourlyHeatmap.hour, func.sum(HourlyHeatmap.guests)).filter(HourlyHeatmap.date == date.today()).group_by(HourlyHeatmap.hour).all()
        
        # Map dữ liệu DB vào dict
        db_hours = {h: count for h, count in heatmap_query}

        for h in range(9, 23):
            val = 0
            if h < 12: # 9h, 10h, 11h lấy từ DB
                val = db_hours.get(h, 0)
            elif h == 12: # 12h lấy Live
                val = current_status["kpi"]["currentGuests"]
            
            heatmap_data.append({"hour": f"{h}h", "value": val})
            
        response_data["heatmap"] = heatmap_data

    except Exception as e: print(f"Lỗi DB: {e}")

    return response_data

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)