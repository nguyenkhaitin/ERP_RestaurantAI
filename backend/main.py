from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date, timedelta
import threading
import time
import os
import math
import random

# SQLAlchemy for AI tables (separate from main PostgreSQL)
try:
    from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Date, JSON, func as sql_func
    from sqlalchemy.orm import declarative_base, sessionmaker
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    print("[SQLAlchemy] Not available - history features disabled")

# AI Camera Simulator imports (Optional - will use if available)
try:
    import cv2
    import numpy as np
    from ultralytics import YOLO
    AI_AVAILABLE = True
    print("[AI] OpenCV & YOLO loaded successfully")
except ImportError as e:
    AI_AVAILABLE = False
    print(f"[AI] Warning: AI dependencies not available ({e}). Camera simulator disabled.")

# Allow disabling AI for local/dev runs by setting environment variable DISABLE_AI=1
try:
    if os.getenv('DISABLE_AI', '0') == '1':
        AI_AVAILABLE = False
        print('[AI] Disabled via DISABLE_AI=1 (dev mode)')
except Exception:
    pass

# Import routers
from .routers.chat import router as chat_router

app = FastAPI()

# ==========================================
# CORS Configuration - Allow Frontend Access
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (dev only - restrict in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# HEALTH CHECK ENDPOINT
# ==========================================
@app.get("/health")
async def health_check():
    """Simple health check to verify backend is running"""
    return {
        "status": "OK",
        "ai_available": AI_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

# ==========================================
# AI DATABASE MODELS (SQLAlchemy)
# ==========================================
AI_DB_URL = os.getenv("AI_DB_URL", "postgresql://postgres:123@localhost:5433/postgres")

if SQLALCHEMY_AVAILABLE:
    try:
        ai_engine = create_engine(AI_DB_URL)
        AISessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ai_engine)
        AIBase = declarative_base()

        class HourlyHeatmap(AIBase):
            __tablename__ = "hourly_heatmap"
            id = Column(Integer, primary_key=True, index=True)
            date = Column(Date, index=True)
            hour = Column(Integer)
            table_id = Column(Integer)
            guests = Column(Integer, default=0)
            occupied_count = Column(Integer, default=0)

        class DailyKPI(AIBase):
            __tablename__ = "daily_kpis"
            date = Column(Date, primary_key=True)
            total_guests = Column(Integer, default=0)
            occupancy_rate = Column(Float, default=0.0)
            avg_dwell_seconds = Column(Float, default=0.0)
            peak_hour = Column(Integer, default=12)

        class AlertsLog(AIBase):
            __tablename__ = "alerts_log"
            id = Column(Integer, primary_key=True, index=True)
            created_at = Column(DateTime, default=datetime.now)
            table_id = Column(Integer)
            alert_type = Column(String)
            details = Column(JSON)

        # Create tables if not exist
        AIBase.metadata.create_all(bind=ai_engine)
        print("[AI DB] Tables created/verified successfully")
        AI_DB_AVAILABLE = True
    except Exception as e:
        print(f"[AI DB] Connection failed: {e}")
        AI_DB_AVAILABLE = False
else:
    AI_DB_AVAILABLE = False

# ==========================================
# AI CAMERA SIMULATOR - Global State & Config
# ==========================================

# Paths for AI resources (relative to backend folder)
AI_VIDEO_PATH = os.path.join(os.path.dirname(__file__), '..', 'AI_V1', 'video.mp4')
AI_MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'AI_V1', 'yolov8m.pt')

# --- PROCESSOR.PY CONFIGURATIONS ---
# Table polygon coordinates (from processor.py)
TABLE_POLYGONS = None  # Will be initialized if numpy available
TABLE_CAPACITIES = [4, 12, 4, 4, 12, 6, 6, 4]
TABLE_TTL_CONFIG = {
    1: 10.0,  # B2: Long memory
    4: 8.0,   # B5: Medium memory
    'default': 0.5
}
CHECK_POINT_CONFIG = {
    0: [0.75],
    1: [0.20, 0.45, 0.60],
    5: [0.20, 0.40],
    'default': [0.75]
}
WALKING_THRESHOLD = 2.5
STRICT_TABLES = [1, 4, 5, 6, 7]
SIMULATED_POS_DATA = {0: 'OPEN', 1: 'OPEN', 2: 'CLOSED', 3: 'CLOSED', 4: 'OPEN', 5: 'CLOSED', 6: 'CLOSED', 7: 'CLOSED'}

# Initialize table polygons if numpy is available
if AI_AVAILABLE:
    TABLE_POLYGONS = [
        np.array([[494, 381], [551, 443], [549, 565], [458, 643], [413, 684], [318, 708], [191, 634], [136, 481], [144, 439], [441, 315]]),
        np.array([[832, 331], [644, 419], [518, 524], [499, 660], [503, 777], [613, 841], [749, 920], [835, 968], [1242, 489], [1197, 305], [980, 253]]),
        np.array([[206, 698], [377, 856], [322, 1075], [10, 1070], [5, 789]]),
        np.array([[89, 486], [1, 508], [5, 779], [167, 698]]),
        np.array([[1578, 408], [1626, 474], [1459, 996], [1168, 932], [1073, 829], [1130, 658], [1378, 365]]),
        np.array([[551, 276], [773, 183], [835, 297], [663, 402], [573, 380]]),
        np.array([[1159, 156], [1025, 266], [1040, 311], [1288, 354], [1340, 197]]),
        np.array([[1450, 360], [1638, 415], [1655, 291], [1485, 243]])
    ]

# Enhanced AI State with table details
# Hybrid Dashboard: Real AI data + Mock analytics
# === HIGH-FREQUENCY RAM CACHE ===
# This state is updated by AI thread and read by API endpoints
# Uses lock for thread-safe access at 5-10 reads/second
ai_state = {
    # === REAL-TIME DATA (from AI Detection) ===
    "total_guests": 0,              # Số khách thực từ AI đếm
    "active_zones": [],              # Danh sách ID bàn có người [0, 2, 5]
    "camera_status": "inactive",     # "active" | "inactive" | "error"
    "last_updated": None,
    "fps": 0,
    "frame_count": 0,
    "detections": [],                # Raw detection boxes
    # Enhanced fields from processor.py
    "active_tables": 0,              # Số lượng bàn đang có khách
    "occupancy_rate": 0,
    "avg_dwell_time": 0,
    "table_details": [],             # Chi tiết từng bàn [{table_id, status, guest_count, ...}]
    "alerts": [],
    "logs": []                       # Recent activity logs
}

# === THREAD-SAFE LOCK for high-frequency access ===
ai_state_lock = threading.Lock()  # Lock for ai_state read/write

# Thread control
ai_thread = None
ai_running = False
current_frame_lock = threading.Lock()
current_frame_bytes = None  # JPEG bytes for streaming


# ==========================================
# TABLE MANAGER CLASS (from processor.py)
# ==========================================
class TableManager:
    """Manages individual table state with ID buffering for accurate counting"""
    
    def __init__(self, table_id: int, max_capacity: int):
        self.id = table_id
        self.max_capacity = max_capacity
        self.status = "TRONG"
        self.occupied_start_time = None
        self.dwell_time = 0
        self.active_ids: Dict[int, float] = {}
        self.current_headcount = 0
        self.id_ttl = TABLE_TTL_CONFIG.get(table_id, TABLE_TTL_CONFIG['default'])
        self.entry_start_check = None

    def update(self, current_frame_ids: List[int]):
        now = time.time()
        
        # Update seen IDs
        for tid in current_frame_ids:
            self.active_ids[tid] = now
        
        # Cleanup expired IDs
        self.active_ids = {tid: t for tid, t in self.active_ids.items() if now - t <= self.id_ttl}
        
        # Calculate count with occlusion bonus
        raw_count = len(self.active_ids)
        final_count = raw_count
        if self.id in [1, 4]:
            if raw_count >= 4: final_count += 1
            if raw_count >= 8: final_count += 1
        
        self.current_headcount = min(final_count, self.max_capacity + 2)
        has_people = self.current_headcount > 0

        # Status logic
        if self.status == "TRONG":
            if has_people:
                if self.entry_start_check is None:
                    self.entry_start_check = now
                
                duration = now - self.entry_start_check
                req_time = 5.0
                if self.max_capacity >= 10:
                    req_time = 20.0 if self.current_headcount < 2 else 5.0
                
                if duration > req_time:
                    self.status = "CO KHACH"
                    self.occupied_start_time = now
            else:
                self.entry_start_check = None
        
        elif self.status == "CO KHACH":
            if self.occupied_start_time:
                self.dwell_time = int(now - self.occupied_start_time)
            
            if self.current_headcount == 0:
                self.status = "TRONG"
                self.occupied_start_time = None
                self.dwell_time = 0
                self.entry_start_check = None

    def get_info(self) -> Dict:
        mins, secs = divmod(self.dwell_time, 60)
        time_str = f"{mins:02d}:{secs:02d}"
        pos_status = SIMULATED_POS_DATA.get(self.id, 'CLOSED')
        
        alert_type = "NONE"
        if self.status == "CO KHACH" and pos_status == "CLOSED":
            alert_type = "KHACH AO"
        elif self.status == "TRONG" and pos_status == "OPEN":
            alert_type = "QUEN DONG"
        if mins > 60:
            alert_type = "NGOI LAU"
        
        return {
            'id': self.id + 1,
            'name': f"Bàn {self.id + 1}",
            'status': self.status,
            'dwellTime': f"{mins}p",
            'seconds': self.dwell_time,
            'guests': self.current_headcount,
            'headcount': self.current_headcount,
            'capacity': self.max_capacity,
            'alert': alert_type,
            'totalToday': 0  # Will be calculated from history
        }


# Global table managers
table_managers: List[TableManager] = []
track_pos_history: Dict[int, tuple] = {}

# Include AI Chat router
app.include_router(chat_router)

# ==========================================
# PYDANTIC MODELS
# ==========================================
class BranchCreate(BaseModel):
    name: str
    address: str
    managerId: Optional[int] = None  # Optional: can be null

class BranchUpdate(BaseModel):
    name: str
    address: str
    managerId: Optional[int] = None  # Optional: can be null

class StaffCreate(BaseModel):
    name: str
    role: str
    phone: str
    status: str
    branchId: Optional[int] = None  # Optional: can be null

class StaffUpdate(BaseModel):
    name: str
    role: str
    phone: str
    status: str
    branchId: Optional[int] = None  # Optional: can be null

class ShiftTemplateCreate(BaseModel):
    name: str
    startTime: str  # Format: "HH:MM" (24-hour)
    endTime: str
    maxCapacity: int

class ShiftAssignment(BaseModel):
    staffId: int
    shiftTemplateId: int
    date: str  # Format: "YYYY-MM-DD"
    branchId: Optional[int] = None

class PayrollConfigCreate(BaseModel):
    role: str  # Role name (e.g., 'Phục vụ', 'Bếp')
    staffId: Optional[int] = None  # NULL = apply to all staff with this role, NOT NULL = specific staff
    type: str  # 'THEO_GIO' or 'THEO_THANG'
    amount: float  # Hourly rate or monthly salary

class LoginRequest(BaseModel):
    phone: str
    password: str

# --- Cấu hình CORS (Để React gọi được) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Kết nối Database ---
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="postgres", # <--- QUAN TRỌNG: Đã đổi tên DB thành RestaurantAI
            user="postgres",
            password="123",        # <--- Password của bạn
            port="5433"            # <--- Port của bạn
        )
        return conn
    except Exception as e:
        print("Lỗi kết nối Database:", e)
        return None

# ==========================================
# API LOGIN - Xác thực nhân viên
# ==========================================
@app.post("/api/login")
def login(request: LoginRequest):
    """Xác thực đăng nhập dựa trên số điện thoại nhân viên"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Tìm nhân viên theo số điện thoại
        cursor.execute("""
            SELECT id, ho_ten, chuc_vu, so_dien_thoai, trang_thai
            FROM nhan_vien
            WHERE so_dien_thoai = %s
        """, (request.phone,))
        
        employee = cursor.fetchone()
        
        if not employee:
            raise HTTPException(status_code=400, detail="Số điện thoại không tồn tại trong hệ thống")
        
        # Kiểm tra mật khẩu (hardcode "123" cho demo)
        if request.password != "123":
            raise HTTPException(status_code=400, detail="Sai mật khẩu")
        
        # Đăng nhập thành công
        return {
            "success": True,
            "user": {
                "id": employee["id"],
                "ten_nhan_vien": employee["ho_ten"],
                "chuc_vu": employee["chuc_vu"],
                "so_dien_thoai": employee["so_dien_thoai"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi server: {str(e)}")
    finally:
        conn.close()

# ==========================================
# API FLOOR OPERATIONS - Trạng thái bàn ăn
# ==========================================
@app.get("/api/floor-status")
def get_floor_status():
    """Lấy trạng thái tất cả các bàn ăn theo khu vực"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query dùng tên bảng Tiếng Việt
        query = """
            SELECT 
                kv.id as zone_id,
                kv.ten_khu_vuc as zone_name,
                kv.ma_tien_to as zone_key_prefix,
                ba.id as table_id,
                ba.ten_ban as table_name,
                ba.so_ban as table_number,
                ttb.trang_thai as state,
                ttb.gio_check_in as check_in_time,
                ttb.so_khach_pos as pos_guests,
                ttb.so_khach_ai as ai_detected_guests,
                ttb.la_sai_lech as is_mismatch,
                ttb.chenh_lech as mismatch_diff,
                ttb.la_ban_ma as is_ghost,
                hd.id as order_id,
                hd.ma_hoa_don as order_code,
                hd.tong_tien as total_amount
            FROM khu_vuc kv
            LEFT JOIN ban_an ba ON ba.khu_vuc_id = kv.id
            LEFT JOIN trang_thai_ban ttb ON ttb.ban_id = ba.id
            LEFT JOIN hoa_don hd ON hd.ban_id = ba.id 
                AND hd.trang_thai = 'open'
            WHERE kv.kich_hoat = TRUE AND ba.kich_hoat = TRUE
            ORDER BY kv.id, ba.so_ban
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Group by zones
        zones = {}
        for row in rows:
            zone_id = row['zone_id']
            
            if zone_id not in zones:
                zones[zone_id] = {
                    'id': zone_id,
                    'name': row['zone_name'],
                    'keyPrefix': row['zone_key_prefix'],
                    'tables': []
                }
            
            if row['table_id']:
                # Calculate duration
                duration = 0
                if row['check_in_time']:
                    from datetime import datetime
                    now = datetime.now()
                    check_in = row['check_in_time']
                    if isinstance(check_in, str):
                        check_in = datetime.fromisoformat(check_in.replace('Z', '+00:00'))
                    duration = int((now - check_in).total_seconds() / 60)
                
                zones[zone_id]['tables'].append({
                    'id': row['table_id'],
                    'name': row['table_name'],
                    'tableNumber': row['table_number'],
                    'status': row['state'] or 'empty',
                    'checkInTime': row['check_in_time'].isoformat() if row['check_in_time'] else None,
                    'duration': duration,
                    'posGuests': row['pos_guests'] or 0,
                    'aiDetectedGuests': row['ai_detected_guests'] or 0,
                    'isMismatch': row['is_mismatch'] or False,
                    'mismatchDiff': row['mismatch_diff'] or 0,
                    'isGhost': row['is_ghost'] or False,
                    'currentOrderId': row['order_id'],
                    'orderCode': row['order_code'],
                    'currentBill': float(row['total_amount']) if row['total_amount'] else 0
                })
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "zones": list(zones.values())
        }
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi truy vấn database: {str(e)}")

# ==========================================
# API: ZONES - Quản lý khu vực
# ==========================================
class ZoneCreate(BaseModel):
    name: str
    key_prefix: str
    description: Optional[str] = ""
    floor_number: int = 1

class ZoneUpdate(BaseModel):
    name: str
    key_prefix: str
    description: Optional[str] = ""
    floor_number: int = 1

class ZoneOrderItem(BaseModel):
    id: int
    display_order: int

class ZoneReorder(BaseModel):
    zones: list[ZoneOrderItem]

@app.get("/api/zones")
def get_zones():
    """Lấy danh sách tất cả khu vực (sắp xếp theo display_order)"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT 
                kv.id,
                kv.ten_khu_vuc,
                kv.ma_tien_to as key_prefix,
                kv.mo_ta as description,
                kv.tang_so as floor_number,
                COALESCE(kv.display_order, 0) as display_order,
                COUNT(ba.id) as table_count
            FROM khu_vuc kv
            LEFT JOIN ban_an ba ON ba.khu_vuc_id = kv.id AND ba.kich_hoat = TRUE
            WHERE kv.kich_hoat = TRUE
            GROUP BY kv.id
            ORDER BY kv.display_order ASC, kv.id ASC
        """)
        zones = cursor.fetchall()
        cursor.close()
        conn.close()
        return zones
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/zones", status_code=status.HTTP_201_CREATED)
async def create_zone(zone: ZoneCreate):
    """Tạo khu vực mới"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get max display_order to append new zone at the end
        cursor.execute("SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM khu_vuc")
        next_order = cursor.fetchone()['next_order']
        
        cursor.execute("""
            INSERT INTO khu_vuc (ten_khu_vuc, ma_tien_to, mo_ta, tang_so, display_order, kich_hoat)
            VALUES (%s, %s, %s, %s, %s, TRUE)
            RETURNING id, ten_khu_vuc, ma_tien_to as key_prefix, 
                      mo_ta as description, tang_so as floor_number, display_order
        """, (zone.name, zone.key_prefix, zone.description, zone.floor_number, next_order))
        
        new_zone = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Tạo khu vực thành công", "data": new_zone}
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# IMPORTANT: /zones/reorder must come BEFORE /zones/{zone_id}
@app.put("/api/zones/reorder", status_code=status.HTTP_200_OK)
async def reorder_zones(data: ZoneReorder):
    """Cập nhật thứ tự hiển thị của các khu vực (Drag & Drop)"""
    print(f"DEBUG: Received reorder request with {len(data.zones)} zones")
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Không thể kết nối database")
    
    try:
        print("DEBUG: Opening cursor...")
        cursor = conn.cursor()
        
        # Update display_order for each zone in batch
        for zone in data.zones:
            print(f"DEBUG: Updating zone {zone.id} with order {zone.display_order}")
            cursor.execute(
                "UPDATE khu_vuc SET display_order = %s WHERE id = %s",
                (zone.display_order, zone.id)
            )
        
        print("DEBUG: Committing...")
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Cập nhật thứ tự thành công"}
    except Exception as e:
        print(f"DEBUG: Exception caught: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/zones/{zone_id}", status_code=status.HTTP_200_OK)
async def update_zone(zone_id: int, zone: ZoneUpdate):
    """Cập nhật thông tin khu vực"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if zone exists
        cursor.execute("SELECT id FROM khu_vuc WHERE id = %s", (zone_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy khu vực")
        
        cursor.execute("""
            UPDATE khu_vuc 
            SET ten_khu_vuc = %s, ma_tien_to = %s, mo_ta = %s, tang_so = %s
            WHERE id = %s
            RETURNING id, ten_khu_vuc, ma_tien_to as key_prefix, 
                      mo_ta as description, tang_so as floor_number, display_order
        """, (zone.name, zone.key_prefix, zone.description, zone.floor_number, zone_id))
        
        updated_zone = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Cập nhật khu vực thành công", "data": updated_zone}
    except HTTPException:
        if conn:
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/zones/{zone_id}", status_code=status.HTTP_200_OK)
async def delete_zone(zone_id: int):
    """Xóa khu vực"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor()
        
        # Check if zone exists
        cursor.execute("SELECT id FROM khu_vuc WHERE id = %s", (zone_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy khu vực")
        
        # Check if zone has tables
        cursor.execute("SELECT COUNT(*) as count FROM ban_an WHERE khu_vuc_id = %s", (zone_id,))
        if cursor.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="Không thể xóa khu vực đang có bàn ăn")
        
        cursor.execute("DELETE FROM khu_vuc WHERE id = %s", (zone_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Xóa khu vực thành công"}
    except HTTPException:
        if conn:
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# API: TABLES - Quản lý bàn ăn
# ==========================================
@app.get("/api/tables")
def get_tables(zoneId: int = None):
    """Lấy danh sách bàn ăn (có thể lọc theo khu vực)"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                ba.id,
                ba.khu_vuc_id,
                ba.so_ban,
                ba.ten_ban,
                ba.hinh_dang,
                ba.so_cho_ngoi,
                ba.loai_ban,
                ba.vi_tri_x,
                ba.vi_tri_y,
                kv.ten_khu_vuc,
                COALESCE(ttb.trang_thai, 'empty') as trang_thai,
                COALESCE(ttb.so_khach_pos, 0) as so_khach_hien_tai,
                COALESCE(ttb.so_khach_ai, 0) as so_khach_ai,
                COALESCE(ttb.la_ban_ma, FALSE) as la_ban_ma,
                COALESCE(ttb.la_sai_lech, FALSE) as la_sai_lech,
                ttb.gio_check_in as thoi_gian_bat_dau,
                ttb.hoa_don_hien_tai
            FROM ban_an ba
            LEFT JOIN khu_vuc kv ON ba.khu_vuc_id = kv.id
            LEFT JOIN trang_thai_ban ttb ON ba.id = ttb.ban_id
            WHERE ba.kich_hoat = TRUE
        """
        
        params = []
        if zoneId:
            query += " AND ba.khu_vuc_id = %s"
            params.append(zoneId)
        
        query += " ORDER BY ba.khu_vuc_id, ba.so_ban"
        
        cursor.execute(query, params if params else None)
        tables = cursor.fetchall()
        
        # Debug logging
        print(f"[API DEBUG] /api/tables returned {len(tables)} tables")
        if tables and len(tables) > 0:
            print(f"[API DEBUG] Sample table: {tables[0]}")
        
        cursor.close()
        conn.close()
        return tables
    except Exception as e:
        print(f"[API ERROR] /api/tables error: {str(e)}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

class TableCreate(BaseModel):
    khu_vuc_id: int
    so_cho_ngoi: int
    hinh_dang: str = 'square'
    loai_ban: str = 'single'
    vi_tri_x: int = 0
    vi_tri_y: int = 0

@app.post("/api/tables", status_code=status.HTTP_201_CREATED)
def create_table(table: TableCreate):
    """Thêm bàn mới - Auto generate table name từ zone prefix"""
    print(f"[CREATE TABLE] Received request: khu_vuc_id={table.khu_vuc_id}, so_cho_ngoi={table.so_cho_ngoi}")
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get zone and prefix
        print(f"[CREATE TABLE] Querying zone with id={table.khu_vuc_id}")
        cursor.execute("""
            SELECT id, ten_khu_vuc, ma_tien_to FROM khu_vuc WHERE id = %s
        """, (table.khu_vuc_id,))
        
        zone_result = cursor.fetchone()
        if not zone_result:
            print(f"[CREATE TABLE] ERROR: Zone not found with id={table.khu_vuc_id}")
            raise HTTPException(status_code=404, detail=f"Khu vực với id={table.khu_vuc_id} không tồn tại")
        
        zone_prefix = zone_result['ma_tien_to']
        if not zone_prefix:
            zone_prefix = zone_result['ten_khu_vuc'][:2].upper()
        
        # Count existing tables in zone
        cursor.execute("""
            SELECT COUNT(*) as count FROM ban_an WHERE khu_vuc_id = %s AND kich_hoat = TRUE
        """, (table.khu_vuc_id,))
        
        count_result = cursor.fetchone()
        table_count = count_result['count'] if count_result else 0
        
        # Generate table name: PREFIX-XX (e.g., VIP-05)
        new_table_number = table_count + 1
        ten_ban = f"{zone_prefix}-{new_table_number:02d}"
        
        print(f"[CREATE TABLE] Generated name: {ten_ban} (Count in zone: {table_count})")
        
        # Get next table number (so_ban)
        cursor.execute("""
            SELECT COALESCE(MAX(so_ban), 0) + 1 as next_number
            FROM ban_an
            WHERE khu_vuc_id = %s
        """, (table.khu_vuc_id,))
        
        next_result = cursor.fetchone()
        next_number = next_result['next_number'] if next_result else 1
        
        print(f"[CREATE TABLE] Next so_ban: {next_number}")
        
        # Insert new table with explicit transaction
        insert_sql = """
            INSERT INTO ban_an (
                khu_vuc_id, so_ban, ten_ban, hinh_dang, so_cho_ngoi, 
                loai_ban, vi_tri_x, vi_tri_y, kich_hoat
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """
        insert_params = (
            table.khu_vuc_id, next_number, ten_ban, table.hinh_dang,
            table.so_cho_ngoi, table.loai_ban, table.vi_tri_x, table.vi_tri_y, True
        )
        
        print(f"[CREATE TABLE] Executing INSERT with params: {insert_params}")
        cursor.execute(insert_sql, insert_params)
        
        insert_result = cursor.fetchone()
        if not insert_result:
            raise Exception("INSERT returned no result")
            
        new_table_id = insert_result['id']
        print(f"[CREATE TABLE] Table inserted with id={new_table_id}")
        # Note: Status record is created automatically by trigger trg_tao_trang_thai_ban
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"[CREATE TABLE] [SUCCESS] Created table with id={new_table_id}")
        return {
            "id": new_table_id, 
            "ten_ban": ten_ban,
            "message": "Thêm bàn thành công"
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
            conn.close()
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(e)}")

@app.delete("/api/tables/{table_id}")
async def delete_table(table_id: int):
    """Xóa bàn (chỉ cho phép xóa nếu bàn trống)"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        conn.autocommit = False
        
        # Check if table is empty
        cursor.execute("""
            SELECT trang_thai FROM trang_thai_ban WHERE ban_id = %s
        """, [table_id])
        
        status_record = cursor.fetchone()
        if not status_record:
            raise HTTPException(status_code=404, detail="Bàn không tồn tại")
        
        if status_record['trang_thai'] != 'empty':
            raise HTTPException(status_code=400, detail="Không thể xóa bàn đang có khách hoặc đã đặt")
        
        # Delete status record first (foreign key constraint)
        cursor.execute("DELETE FROM trang_thai_ban WHERE ban_id = %s", [table_id])
        
        # Delete table
        cursor.execute("DELETE FROM ban_an WHERE id = %s", [table_id])
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"message": "Table deleted successfully"}
    except HTTPException:
        if conn:
            conn.rollback()
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"Error deleting table: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# API: MENU - Quản lý thực đơn
# ==========================================

@app.get("/api/menu-categories")
def get_menu_categories():
    """Lấy danh sách loại thực đơn"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT 
                id, 
                ten_loai as name, 
                thu_tu_hien_thi as display_order, 
                kich_hoat as active
            FROM loai_thuc_don
            WHERE kich_hoat = TRUE
            ORDER BY thu_tu_hien_thi, ten_loai
        """)
        categories = cursor.fetchall()
        cursor.close()
        conn.close()
        return categories
    except Exception as e:
        if conn:
            conn.close()
        # Return empty array instead of crashing
        return []

@app.get("/api/menu-items")
def get_menu_items(categoryId: Optional[int] = None):
    """Lấy danh sách món ăn, có thể lọc theo loại"""
    print(f"[API DEBUG] get_menu_items called with categoryId={categoryId}")
    try:
        conn = get_db_connection()
        print(f"[API DEBUG] Connection success: {conn is not None}")
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                td.id,
                td.ten_mon as name,
                td.gia as price,
                td.mo_ta as description,
                COALESCE(td.loai_thuc_don_id, td.danh_muc_id) as category_id,
                ltd.ten_loai as category_name,
                td.hinh_anh as image,
                td.con_hang as available
            FROM thuc_don td
            LEFT JOIN loai_thuc_don ltd ON COALESCE(td.loai_thuc_don_id, td.danh_muc_id) = ltd.id
        """
        
        params = []
        if categoryId:
            query += " WHERE COALESCE(td.loai_thuc_don_id, td.danh_muc_id) = %s"
            params.append(categoryId)
        
        query += " ORDER BY ltd.thu_tu_hien_thi, td.ten_mon"
        
        print(f"[API DEBUG] Executing query with params: {params}")
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        items = cursor.fetchall()
        print(f"[API DEBUG] Query returned {len(items)} items")
        cursor.close()
        conn.close()
        return items
    except Exception as e:
        print(f"[API ERROR] Exception: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals() and conn:
            conn.close()
        # Return empty array instead of crashing
        return []

# Pydantic models for Menu CRUD
class MenuCategoryCreate(BaseModel):
    ten_loai: str

class MenuItemCreate(BaseModel):
    ten_mon: str
    gia: float
    mo_ta: Optional[str] = ""
    loai_thuc_don_id: int
    hinh_anh: Optional[str] = ""

@app.post("/api/menu-categories", status_code=status.HTTP_201_CREATED)
def create_menu_category(category: MenuCategoryCreate):
    """Tạo danh mục thực đơn mới"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get max display_order
        cursor.execute("SELECT COALESCE(MAX(thu_tu_hien_thi), -1) + 1 as next_order FROM loai_thuc_don")
        next_order = cursor.fetchone()['next_order']
        
        cursor.execute("""
            INSERT INTO loai_thuc_don (ten_loai, thu_tu_hien_thi, kich_hoat)
            VALUES (%s, %s, TRUE)
            RETURNING id, ten_loai as name, thu_tu_hien_thi as display_order
        """, (category.ten_loai, next_order))
        
        new_category = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Tạo danh mục thành công", "data": new_category}
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/menu-categories/{category_id}")
def update_menu_category(category_id: int, category: MenuCategoryCreate):
    """Cập nhật danh mục thực đơn"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT id FROM loai_thuc_don WHERE id = %s", (category_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
        
        cursor.execute("""
            UPDATE loai_thuc_don SET ten_loai = %s WHERE id = %s
            RETURNING id, ten_loai as name
        """, (category.ten_loai, category_id))
        
        updated_category = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Cập nhật danh mục thành công", "data": updated_category}
    except HTTPException:
        if conn:
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/menu-categories/{category_id}")
def delete_menu_category(category_id: int):
    """Xóa danh mục thực đơn"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor()
        
        # Check if category has menu items - use COALESCE for both possible column names
        cursor.execute("SELECT COUNT(*) as count FROM thuc_don WHERE COALESCE(loai_thuc_don_id, danh_muc_id) = %s", (category_id,))
        if cursor.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="Không thể xóa danh mục đang có món ăn")
        
        cursor.execute("DELETE FROM loai_thuc_don WHERE id = %s", (category_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Xóa danh mục thành công"}
    except HTTPException:
        if conn:
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/menu-items", status_code=status.HTTP_201_CREATED)
def create_menu_item(item: MenuItemCreate):
    """Tạo món ăn mới"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            INSERT INTO thuc_don (ten_mon, gia, mo_ta, danh_muc_id, loai_thuc_don_id, hinh_anh)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, ten_mon, gia, mo_ta, danh_muc_id, loai_thuc_don_id, hinh_anh
        """, (item.ten_mon, item.gia, item.mo_ta, item.loai_thuc_don_id, item.loai_thuc_don_id, item.hinh_anh))
        
        new_item = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Tạo món ăn thành công", "data": new_item}
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/menu-items/{item_id}")
def update_menu_item(item_id: int, item: MenuItemCreate):
    """Cập nhật món ăn"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT id FROM thuc_don WHERE id = %s", (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Không tìm thấy món ăn")
        
        cursor.execute("""
            UPDATE thuc_don 
            SET ten_mon = %s, gia = %s, mo_ta = %s, danh_muc_id = %s, loai_thuc_don_id = %s, hinh_anh = %s
            WHERE id = %s
            RETURNING id, ten_mon, gia, mo_ta, danh_muc_id, loai_thuc_don_id, hinh_anh
        """, (item.ten_mon, item.gia, item.mo_ta, item.loai_thuc_don_id, item.loai_thuc_don_id, item.hinh_anh, item_id))
        
        updated_item = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Cập nhật món ăn thành công", "data": updated_item}
    except HTTPException:
        if conn:
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/menu-items/{item_id}")
def delete_menu_item(item_id: int):
    """Xóa món ăn"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM thuc_don WHERE id = %s", (item_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Xóa món ăn thành công"}
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# API: SERVICE OPERATIONS - Phục vụ bàn
# ==========================================
class ServiceStartRequest(BaseModel):
    tableId: int
    guestCount: int

class CheckInItem(BaseModel):
    id: int           # mon_id từ menu
    gia: float        # đơn giá
    so_luong: int     # số lượng
    ten_mon: Optional[str] = None  # tên món (optional, for logging)

class CheckInRequest(BaseModel):
    so_khach: int
    items: list[CheckInItem] = []
    ghi_chu: Optional[str] = None

class ServiceOverrideRequest(BaseModel):
    tableId: int
    newGuestCount: int
    reason: Optional[str] = None
    overrideBy: str = "Staff"

class ServiceEndRequest(BaseModel):
    tableId: int

class PaymentRequest(BaseModel):
    tableId: int
    paymentMethod: str
    discountPercent: float = 0

class BookingCreate(BaseModel):
    ban_id: int
    ten_khach_hang: str
    sdt_khach_hang: str
    ngay_dat: str  # Format: "YYYY-MM-DD"
    gio_dat: str   # Format: "HH:MM"
    so_khach: int = 2
    ghi_chu: Optional[str] = None

@app.post("/api/service/start")
def start_service(request: ServiceStartRequest):
    """Bắt đầu phục vụ bàn (Check-in)"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        conn.autocommit = False
        
        # Generate order code
        from datetime import datetime
        date_str = datetime.now().strftime('%Y%m%d')
        import random
        random_num = str(random.randint(0, 999)).zfill(3)
        order_code = f"ORD-{date_str}-{random_num}"
        
        # 1. Update table state
        cursor.execute("""
            UPDATE trang_thai_ban SET
                trang_thai = 'occupied',
                so_khach_pos = %s,
                gio_check_in = NOW()
            WHERE ban_id = %s
        """, [request.guestCount, request.tableId])
        
        # 2. Create new order
        cursor.execute("""
            INSERT INTO hoa_don (ban_id, ma_hoa_don, so_khach, trang_thai, tao_boi)
            VALUES (%s, %s, %s, 'open', 'POS')
            RETURNING id, ma_hoa_don
        """, [request.tableId, order_code, request.guestCount])
        
        order = cursor.fetchone()
        
        # 3. Link order to table state
        cursor.execute("""
            UPDATE trang_thai_ban SET hoa_don_hien_tai = %s WHERE ban_id = %s
        """, [order['id'], request.tableId])
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": "Bắt đầu phục vụ thành công",
            "orderId": order['id'],
            "orderCode": order['ma_hoa_don']
        }
        
    except Exception as e:
        conn.rollback()
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tables/{table_id}/check-in")
def check_in_table(table_id: int, request: CheckInRequest):
    """
    Check-in bàn với danh sách món đã chọn
    
    Input JSON:
    {
        "so_khach": 4,
        "items": [
            { "id": 10, "gia": 50000, "so_luong": 2 },
            { "id": 12, "gia": 20000, "so_luong": 5 }
        ]
    }
    
    Flow:
    1. Validate table exists and is available (empty or reserved)
    2. Create new order (hoa_don)
    3. Insert order items (chi_tiet_hoa_don) using mon_id
    4. Update table status to 'occupied' with hoa_don_hien_tai
    5. Return order info
    """
    print(f"[CHECK-IN] Table={table_id}, Guests={request.so_khach}, Items={len(request.items)}")
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        conn.autocommit = False
        
        # 1. Check table exists and get current status
        cursor.execute("""
            SELECT ba.id, ba.ten_ban, ba.so_cho_ngoi,
                   COALESCE(ttb.trang_thai, 'empty') as trang_thai,
                   ttb.id as status_id
            FROM ban_an ba
            LEFT JOIN trang_thai_ban ttb ON ba.id = ttb.ban_id
            WHERE ba.id = %s
        """, (table_id,))
        
        table_info = cursor.fetchone()
        if not table_info:
            raise HTTPException(status_code=404, detail=f"Bàn ID {table_id} không tồn tại")
        
        current_status = table_info['trang_thai']
        print(f"[CHECK-IN] Table '{table_info['ten_ban']}' current status: {current_status}")
        
        # Validate table can be checked in
        if current_status == 'occupied':
            raise HTTPException(
                status_code=400, 
                detail=f"Bàn {table_info['ten_ban']} đang được phục vụ"
            )
        
        # 2. Generate order code
        from datetime import datetime
        import random
        date_str = datetime.now().strftime('%Y%m%d')
        random_num = str(random.randint(1000, 9999))
        order_code = f"HD-{date_str}-{random_num}"
        
        # 3. Calculate tam_tinh (subtotal) from items
        tam_tinh = 0.0
        if request.items and len(request.items) > 0:
            for item in request.items:
                tam_tinh += float(item.gia) * int(item.so_luong)
        
        # Calculate VAT and total
        vat_rate = 0.08  # 8% VAT
        tien_vat = tam_tinh * vat_rate
        tong_tien = tam_tinh + tien_vat
        
        print(f"[CHECK-IN] Order calculation: tam_tinh={tam_tinh}, tien_vat={tien_vat}, tong_tien={tong_tien}")
        
        # 4. Create order in hoa_don table
        cursor.execute("""
            INSERT INTO hoa_don 
            (ban_id, ma_hoa_don, so_khach, tam_tinh, phan_tram_vat, tien_vat, tong_tien, trang_thai, nguoi_tao, ngay_tao)
            VALUES (%s, %s, %s, %s, 8, %s, %s, 'open', 'POS', NOW())
            RETURNING id, ma_hoa_don
        """, (table_id, order_code, request.so_khach, tam_tinh, tien_vat, tong_tien))
        
        order = cursor.fetchone()
        if not order:
            raise Exception("Không thể tạo hóa đơn")
        
        order_id = order['id']
        print(f"[CHECK-IN] ✓ Created hoa_don: ID={order_id}, Code={order_code}")
        
        # 5. Insert order items into chi_tiet_hoa_don (using mon_id)
        items_inserted = 0
        if request.items and len(request.items) > 0:
            for item in request.items:
                try:
                    thanh_tien = float(item.gia) * int(item.so_luong)
                    cursor.execute("""
                        INSERT INTO chi_tiet_hoa_don 
                        (hoa_don_id, mon_id, so_luong, don_gia, thanh_tien)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (order_id, item.id, item.so_luong, item.gia, thanh_tien))
                    items_inserted += 1
                    item_name = item.ten_mon if item.ten_mon else f"Món #{item.id}"
                    print(f"[CHECK-IN]   + {item_name}: {item.so_luong} x {item.gia:,.0f}đ = {thanh_tien:,.0f}đ")
                except Exception as item_err:
                    print(f"[CHECK-IN] ⚠ Failed to insert mon_id={item.id}: {item_err}")
                    conn.rollback()
                    raise HTTPException(status_code=400, detail=f"Lỗi thêm món ID {item.id}: {str(item_err)}")
        
        print(f"[CHECK-IN] ✓ Inserted {items_inserted}/{len(request.items)} chi_tiet_hoa_don records")
        
        # 6. Update or insert trang_thai_ban with hoa_don_hien_tai
        if table_info['status_id']:
            # Status record exists - UPDATE
            cursor.execute("""
                UPDATE trang_thai_ban SET
                    trang_thai = 'occupied',
                    so_khach_pos = %s,
                    gio_check_in = NOW(),
                    hoa_don_hien_tai = %s,
                    ngay_cap_nhat = NOW()
                WHERE ban_id = %s
            """, (request.so_khach, order_id, table_id))
            print(f"[CHECK-IN] ✓ Updated trang_thai_ban: status='occupied', hoa_don_hien_tai={order_id}")
        else:
            # No status record - INSERT
            cursor.execute("""
                INSERT INTO trang_thai_ban 
                (ban_id, trang_thai, so_khach_pos, gio_check_in, hoa_don_hien_tai, ngay_cap_nhat)
                VALUES (%s, 'occupied', %s, NOW(), %s, NOW())
            """, (table_id, request.so_khach, order_id))
            print(f"[CHECK-IN] ✓ Created trang_thai_ban: status='occupied', hoa_don_hien_tai={order_id}")
        
        # 7. If table was previously reserved, mark booking as completed
        if current_status == 'reserved':
            cursor.execute("""
                UPDATE dat_ban 
                SET trang_thai = 'completed'
                WHERE ban_id = %s AND trang_thai = 'confirmed'
            """, (table_id,))
            print(f"[CHECK-IN] ✓ Updated dat_ban to 'completed'")
        
        # COMMIT transaction
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"[CHECK-IN] ✓✓ SUCCESS: Bàn {table_info['ten_ban']} check-in với hóa đơn {order_code}")
        
        return {
            "success": True,
            "message": f"Mở bàn {table_info['ten_ban']} thành công",
            "data": {
                "orderId": order_id,
                "orderCode": order_code,
                "tableId": table_id,
                "tableName": table_info['ten_ban'],
                "guestCount": request.so_khach,
                "itemsCount": items_inserted,
                "subtotal": float(tam_tinh),
                "vatAmount": float(tien_vat),
                "totalAmount": float(tong_tien)
            }
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
            conn.close()
        raise
    except Exception as e:
        print(f"[CHECK-IN] ✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi check-in: {str(e)}")


@app.post("/api/service/override")
def override_guests(request: ServiceOverrideRequest):
    """Override số khách khi AI đếm sai"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            UPDATE trang_thai_ban SET
                so_khach_pos = %s,
                ly_do_override = %s,
                override_boi = %s,
                thoi_gian_override = NOW(),
                la_sai_lech = FALSE,
                chenh_lech = 0
            WHERE ban_id = %s
        """, [request.newGuestCount, request.reason, request.overrideBy, request.tableId])
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Override số khách thành công"}
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/service/end")
def end_service(request: ServiceEndRequest):
    """Kết thúc phục vụ (Check-out không thanh toán)"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            UPDATE trang_thai_ban SET
                trang_thai = 'empty',
                so_khach_pos = 0,
                so_khach_ai = 0,
                la_sai_lech = FALSE,
                chenh_lech = 0,
                la_ban_ma = FALSE,
                gio_check_in = NULL,
                hoa_don_hien_tai = NULL
            WHERE ban_id = %s
        """, [request.tableId])
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Kết thúc phục vụ thành công"}
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# API: PAYMENT - Thanh toán
# ==========================================

@app.get("/api/invoices/{invoice_id}")
def get_invoice_detail(invoice_id: int):
    """
    Lấy chi tiết hóa đơn để hiển thị lên màn hình thanh toán
    
    Returns:
    - Invoice header (ma_hoa_don, so_khach, tong_tien, etc.)
    - Items list (ten_mon, so_luong, don_gia, thanh_tien)
    """
    print(f"[GET INVOICE] Fetching invoice ID={invoice_id}")
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get invoice header
        cursor.execute("""
            SELECT hd.id, hd.ban_id, hd.ma_hoa_don, hd.so_khach,
                   hd.tam_tinh, hd.phan_tram_vat, hd.tien_vat, hd.tong_tien,
                   hd.trang_thai, hd.phuong_thuc_thanh_toan, hd.ngay_tao,
                   ba.ten_ban
            FROM hoa_don hd
            LEFT JOIN ban_an ba ON hd.ban_id = ba.id
            WHERE hd.id = %s
        """, (invoice_id,))
        
        invoice = cursor.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
        
        # Get invoice items from chi_tiet_hoa_don
        cursor.execute("""
            SELECT 
                ct.id,
                ct.mon_id,
                COALESCE(td.ten_mon, 'Món ăn') as ten_mon,
                ct.so_luong,
                ct.don_gia,
                ct.thanh_tien
            FROM chi_tiet_hoa_don ct
            LEFT JOIN thuc_don td ON ct.mon_id = td.id
            WHERE ct.hoa_don_id = %s
            ORDER BY ct.id
        """, (invoice_id,))
        
        items = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Calculate real-time total from items (SIMPLE: just sum thanh_tien)
        calculated_tam_tinh = sum(float(item['thanh_tien']) for item in items)
        vat_rate = float(invoice['phan_tram_vat'] or 8)  # Convert Decimal to float
        calculated_tien_vat = calculated_tam_tinh * (vat_rate / 100.0)
        calculated_tong_tien = calculated_tam_tinh + calculated_tien_vat
        
        # Always use calculated values (ignore database values which might be wrong)
        tam_tinh = calculated_tam_tinh
        tien_vat = calculated_tien_vat
        tong_tien = calculated_tong_tien
        
        print(f"[GET INVOICE] ✓ Found invoice {invoice['ma_hoa_don']} with {len(items)} items")
        print(f"[GET INVOICE] Calculated from items: tam_tinh={tam_tinh:.2f}, VAT={tien_vat:.2f}, total={tong_tien:.2f}")
        
        return {
            "success": True,
            "data": {
                "id": invoice['id'],
                "ban_id": invoice['ban_id'],
                "ten_ban": invoice['ten_ban'],
                "ma_hoa_don": invoice['ma_hoa_don'],
                "so_khach": invoice['so_khach'],
                "tam_tinh": tam_tinh,
                "phan_tram_vat": vat_rate,
                "tien_vat": tien_vat,
                "tong_tien": tong_tien,
                "trang_thai": invoice['trang_thai'],
                "ngay_tao": invoice['ngay_tao'].isoformat() if invoice['ngay_tao'] else None,
                "items": [
                    {
                        "id": item['id'],
                        "mon_id": item['mon_id'],
                        "ten_mon": item['ten_mon'],
                        "so_luong": item['so_luong'],
                        "don_gia": float(item['don_gia']),
                        "thanh_tien": float(item['thanh_tien'])
                    }
                    for item in items
                ]
            }
        }
        
    except HTTPException:
        if conn:
            conn.close()
        raise
    except Exception as e:
        print(f"[GET INVOICE] ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi lấy hóa đơn: {str(e)}")


@app.post("/api/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: int, payload: dict):
    """
    Thực hiện thanh toán và giải phóng bàn
    
    Payload: { "phuong_thuc": "tien_mat" | "chuyen_khoan" }
    
    Transaction:
    1. Update hoa_don: trang_thai='paid', thoi_gian_thanh_toan=NOW
    2. Update trang_thai_ban: trang_thai='empty', hoa_don_hien_tai=NULL
    """
    print(f"[PAY INVOICE] Invoice ID={invoice_id}, Method={payload.get('phuong_thuc', 'tien_mat')}")
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        conn.autocommit = False
        
        # Get invoice info
        cursor.execute("""
            SELECT id, ban_id, ma_hoa_don, tong_tien, trang_thai
            FROM hoa_don
            WHERE id = %s
        """, (invoice_id,))
        
        invoice = cursor.fetchone()
        if not invoice:
            raise HTTPException(status_code=404, detail="Không tìm thấy hóa đơn")
        
        if invoice['trang_thai'] == 'paid':
            raise HTTPException(status_code=400, detail="Hóa đơn đã được thanh toán")
        
        ban_id = invoice['ban_id']
        phuong_thuc = payload.get('phuong_thuc', 'tien_mat')
        
        # 1. Update invoice status
        cursor.execute("""
            UPDATE hoa_don SET
                trang_thai = 'paid',
                phuong_thuc_thanh_toan = %s,
                thoi_gian_thanh_toan = NOW()
            WHERE id = %s
        """, (phuong_thuc, invoice_id))
        
        print(f"[PAY INVOICE] ✓ Updated hoa_don: trang_thai='paid', method={phuong_thuc}")
        
        # 2. Release table - Update trang_thai_ban
        cursor.execute("""
            UPDATE trang_thai_ban SET
                trang_thai = 'empty',
                hoa_don_hien_tai = NULL,
                so_khach_pos = 0,
                gio_check_out = NOW(),
                ngay_cap_nhat = NOW()
            WHERE ban_id = %s
        """, (ban_id,))
        
        print(f"[PAY INVOICE] ✓ Released table: ban_id={ban_id}, status='empty'")
        
        # COMMIT transaction
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"[PAY INVOICE] ✓✓ SUCCESS: Invoice {invoice['ma_hoa_don']} paid, table {ban_id} released")
        
        return {
            "success": True,
            "message": f"Thanh toán thành công {invoice['tong_tien']:,.0f}đ",
            "data": {
                "invoice_id": invoice_id,
                "ban_id": ban_id,
                "ma_hoa_don": invoice['ma_hoa_don'],
                "tong_tien": float(invoice['tong_tien']),
                "phuong_thuc": phuong_thuc
            }
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
            conn.close()
        raise
    except Exception as e:
        print(f"[PAY INVOICE] ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=f"Lỗi thanh toán: {str(e)}")


@app.get("/api/payment/calculate/{tableId}")
def calculate_payment(tableId: int):
    """Tính tiền cho bàn"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get table state and order
        cursor.execute("""
            SELECT ttb.*, hd.id as order_id, hd.ma_hoa_don as order_code, 
                   hd.tam_tinh as subtotal, hd.tien_vat as vat_amount, hd.tong_tien as total_amount
            FROM trang_thai_ban ttb
            LEFT JOIN hoa_don hd ON ttb.hoa_don_hien_tai = hd.id
            WHERE ttb.ban_id = %s
        """, [tableId])
        
        state = cursor.fetchone()
        if not state:
            raise HTTPException(status_code=404, detail="Không tìm thấy bàn")
        
        # Calculate duration
        duration = 0
        if state.get('gio_check_in'):
            from datetime import datetime
            now = datetime.now()
            check_in = state['gio_check_in']
            duration = int((now - check_in).total_seconds() / 60)
        
        # Get order items (simplified - no items for now)
        items = []
        subtotal = state.get('subtotal') or 0
        vat_amount = state.get('vat_amount') or 0
        total_amount = state.get('total_amount') or 0
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "tableId": tableId,
            "orderId": state.get('order_id'),
            "orderCode": state.get('order_code'),
            "duration": duration,
            "items": items,
            "subtotal": float(subtotal) if subtotal else 0,
            "vatAmount": float(vat_amount) if vat_amount else 0,
            "totalAmount": float(total_amount) if total_amount else 0,
            "qrCodeUrl": None,
            "bank": None
        }
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/payment")
def process_payment(request: PaymentRequest):
    """Xử lý thanh toán"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        conn.autocommit = False
        
        # Get current order
        cursor.execute("""
            SELECT hoa_don_hien_tai FROM trang_thai_ban WHERE ban_id = %s
        """, [request.tableId])
        
        result = cursor.fetchone()
        order_id = result.get('hoa_don_hien_tai') if result else None
        
        if not order_id:
            raise HTTPException(status_code=400, detail="Không có đơn hàng để thanh toán")
        
        # Get order details
        cursor.execute("SELECT * FROM hoa_don WHERE id = %s", [order_id])
        order = cursor.fetchone()
        
        # Calculate final amount
        total = order.get('tong_tien') or 0
        discount = int(total * request.discountPercent / 100)
        final_amount = total - discount
        
        # Update order status
        cursor.execute("""
            UPDATE hoa_don SET
                trang_thai = 'paid',
                phuong_thuc_thanh_toan = %s,
                phan_tram_giam_gia = %s,
                tien_giam_gia = %s,
                tong_cuoi = %s,
                thoi_gian_thanh_toan = NOW()
            WHERE id = %s
        """, [request.paymentMethod, request.discountPercent, discount, final_amount, order_id])
        
        # Reset table state
        cursor.execute("""
            UPDATE trang_thai_ban SET
                trang_thai = 'empty',
                so_khach_pos = 0,
                so_khach_ai = 0,
                la_sai_lech = FALSE,
                chenh_lech = 0,
                la_ban_ma = FALSE,
                gio_check_in = NULL,
                hoa_don_hien_tai = NULL
            WHERE ban_id = %s
        """, [request.tableId])
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": "Thanh toán thành công",
            "orderId": order_id,
            "finalAmount": final_amount
        }
        
    except Exception as e:
        conn.rollback()
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# API: BOOKING - Đặt bàn
# ==========================================
@app.post("/api/bookings", status_code=status.HTTP_201_CREATED)
def create_booking(booking: BookingCreate):
    """Tạo đặt bàn mới và cập nhật trạng thái bàn"""
    print(f"[CREATE BOOKING] Received: table={booking.ban_id}, customer={booking.ten_khach_hang}, date={booking.ngay_dat}, time={booking.gio_dat}")
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if table exists and is empty (handle case where no status record exists)
        cursor.execute("""
            SELECT ba.id, ba.ten_ban,
                   COALESCE(ttb.trang_thai, 'empty') as trang_thai,
                   ttb.id as status_id
            FROM ban_an ba
            LEFT JOIN trang_thai_ban ttb ON ba.id = ttb.ban_id
            WHERE ba.id = %s
        """, (booking.ban_id,))
        
        table_state = cursor.fetchone()
        if not table_state:
            raise HTTPException(status_code=404, detail="Bàn không tồn tại")
        
        if table_state['trang_thai'] != 'empty':
            raise HTTPException(status_code=400, detail=f"Bàn {table_state['ten_ban']} đang được sử dụng hoặc đã đặt")
        
        # Insert booking record
        cursor.execute("""
            INSERT INTO dat_ban (
                ban_id, ten_khach_hang, sdt_khach_hang, 
                ngay_dat, gio_dat, so_khach, ghi_chu, trang_thai
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'confirmed')
            RETURNING id, ban_id, ten_khach_hang, sdt_khach_hang, 
                      ngay_dat, gio_dat, so_khach, ghi_chu, trang_thai
        """, (
            booking.ban_id,
            booking.ten_khach_hang,
            booking.sdt_khach_hang,
            booking.ngay_dat,
            booking.gio_dat,
            booking.so_khach,
            booking.ghi_chu
        ))
        
        new_booking = cursor.fetchone()
        
        # Update or insert table status to 'reserved'
        if table_state['status_id']:
            cursor.execute("""
                UPDATE trang_thai_ban
                SET trang_thai = 'reserved'
                WHERE ban_id = %s
            """, (booking.ban_id,))
        else:
            cursor.execute("""
                INSERT INTO trang_thai_ban (ban_id, trang_thai)
                VALUES (%s, 'reserved')
            """, (booking.ban_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"[CREATE BOOKING] ✓ Created booking ID={new_booking['id']} for table {booking.ban_id}")
        
        return {
            "success": True,
            "message": "Đặt bàn thành công",
            "data": {
                "id": new_booking['id'],
                "tableId": new_booking['ban_id'],
                "customerName": new_booking['ten_khach_hang'],
                "customerPhone": new_booking['sdt_khach_hang'],
                "bookingDate": str(new_booking['ngay_dat']),
                "bookingTime": str(new_booking['gio_dat']),
                "guestCount": new_booking['so_khach'],
                "notes": new_booking['ghi_chu'],
                "status": new_booking['trang_thai']
            }
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        print(f"[CREATE BOOKING] ERROR: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(e)}")

@app.get("/api/bookings")
def get_bookings(date: Optional[str] = None, status: Optional[str] = None):
    """Lấy danh sách đặt bàn"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = """
            SELECT 
                db.id,
                db.ban_id as "tableId",
                ba.ten_ban as "tableName",
                db.ten_khach_hang as "customerName",
                db.sdt_khach_hang as "customerPhone",
                TO_CHAR(db.ngay_dat, 'YYYY-MM-DD') as "bookingDate",
                TO_CHAR(db.gio_dat, 'HH24:MI') as "bookingTime",
                db.so_khach as "guestCount",
                db.ghi_chu as "notes",
                db.trang_thai as "status"
            FROM dat_ban db
            JOIN ban_an ba ON db.ban_id = ba.id
            WHERE 1=1
        """
        
        params = []
        if date:
            query += " AND db.ngay_dat = %s"
            params.append(date)
        
        if status:
            query += " AND db.trang_thai = %s"
            params.append(status)
        
        query += " ORDER BY db.ngay_dat DESC, db.gio_dat DESC"
        
        cursor.execute(query, params if params else None)
        bookings = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return bookings
        
    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/bookings/{booking_id}")
def cancel_booking(booking_id: int):
    """Hủy đặt bàn và cập nhật trạng thái bàn về 'empty'"""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Không thể kết nối database")
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get booking info
        cursor.execute("SELECT ban_id FROM dat_ban WHERE id = %s", (booking_id,))
        booking = cursor.fetchone()
        
        if not booking:
            raise HTTPException(status_code=404, detail="Đặt bàn không tồn tại")
        
        # Update booking status to cancelled
        cursor.execute("""
            UPDATE dat_ban
            SET trang_thai = 'cancelled'
            WHERE id = %s
        """, (booking_id,))
        
        # Reset table status to empty
        cursor.execute("""
            UPDATE trang_thai_ban
            SET trang_thai = 'empty'
            WHERE ban_id = %s
        """, (booking['ban_id'],))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Hủy đặt bàn thành công"}
        
    except HTTPException:
        if conn:
            conn.rollback()
            conn.close()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 1. API CHI NHÁNH (Branches) - MỚI
# ==========================================
@app.get("/api/branches")
def get_branches():
    conn = get_db_connection()
    if not conn: return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # JOIN với bảng nhân viên để lấy tên Quản lý
    query = """
        SELECT cn.id, cn.ten_chi_nhanh as "name", cn.dia_chi as "address", 
               COALESCE(nv.ho_ten, 'Chưa có') as "managerName"
        FROM chi_nhanh cn
        LEFT JOIN nhan_vien nv ON cn.quan_ly_id = nv.id
        ORDER BY cn.id ASC
    """
    cursor.execute(query)
    data = cursor.fetchall()
    conn.close()
    return data

@app.post("/api/branches", status_code=status.HTTP_201_CREATED)
async def create_branch(branch: BranchCreate):
    """
    Create new branch with automatic manager assignment (manager is optional)
    
    Logic Flow:
    1. Receive JSON: { "name": "...", "address": "...", "managerId": 123 or null }
    2. INSERT into chi_nhanh table (ten_chi_nhanh, dia_chi, quan_ly_id)
    3. GET the new branch ID
    4. If managerId provided: UPDATE nhan_vien SET chi_nhanh_id = [new_branch_id] WHERE id = [managerId]
    5. COMMIT transaction (both steps must succeed)
    """
    print("=" * 70)
    print("[CREATE BRANCH] Received payload:")
    print(f"  name: {branch.name}")
    print(f"  address: {branch.address}")
    print(f"  managerId: {branch.managerId}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn: 
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # ===== INPUT VALIDATION =====
        if not branch.name or not branch.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch name cannot be empty"
            )
        
        if not branch.address or not branch.address.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Address cannot be empty"
            )
        
        # Handle managerId (optional now)
        manager_id = branch.managerId if branch.managerId and branch.managerId > 0 else None
        print(f"[STEP 0] Processed managerId: {manager_id}")
        
        # Validate manager exists (only if provided)
        manager_name = 'Chưa có'
        if manager_id is not None:
            print(f"[STEP 0] Validating manager with ID = {manager_id}")
            cursor.execute(
                "SELECT id, ho_ten FROM nhan_vien WHERE id = %s",
                (manager_id,)
            )
            manager = cursor.fetchone()
            
            if not manager:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Manager with ID {manager_id} not found"
                )
            
            manager_name = manager['ho_ten']
            print(f"[STEP 0] ✓ Manager found: {manager_name}")
        else:
            print("[STEP 0] ⚠️  No manager assigned (optional)")
        
        # ===== STEP 1: INSERT BRANCH =====
        # SQL has exactly 3 placeholders (%s)
        insert_sql = """
            INSERT INTO chi_nhanh (ten_chi_nhanh, dia_chi, quan_ly_id)
            VALUES (%s, %s, %s)
            RETURNING id, ten_chi_nhanh, dia_chi, quan_ly_id
        """
        
        # Tuple has exactly 3 values matching the 3 placeholders
        insert_params = (
            branch.name.strip(),
            branch.address.strip(),
            manager_id  # Can be None/NULL
        )
        
        print(f"[STEP 1] Executing INSERT with params: {insert_params}")
        cursor.execute(insert_sql, insert_params)
        new_branch_row = cursor.fetchone()
        
        if not new_branch_row:
            raise Exception("Failed to insert branch - no row returned")
        
        new_branch_id = new_branch_row['id']
        print(f"[STEP 1] ✓ Branch inserted with ID = {new_branch_id}")
        
        # ===== STEP 2: UPDATE EMPLOYEE (ASSIGN BRANCH TO MANAGER) - ONLY IF MANAGER PROVIDED =====
        if manager_id is not None:
            update_sql = """
                UPDATE nhan_vien
                SET chi_nhanh_id = %s
                WHERE id = %s
            """
            
            print(f"[STEP 2] Executing UPDATE nhan_vien: chi_nhanh_id={new_branch_id}, manager_id={manager_id}")
            cursor.execute(update_sql, (new_branch_id, manager_id))
            rows_updated = cursor.rowcount
            print(f"[STEP 2] ✓ Updated {rows_updated} employee record(s)")
        else:
            print("[STEP 2] ⚠️  Skipped (no manager to assign)")
        
        # ===== STEP 3: COMMIT TRANSACTION =====
        conn.commit()
        print("[STEP 3] ✓ Transaction COMMITTED successfully")
        print("=" * 70)
        
        # ===== RETURN SUCCESS RESPONSE =====
        return {
            "success": True,
            "message": "Branch created successfully" + (" and manager assigned" if manager_id else ""),
            "data": {
                "id": new_branch_id,
                "name": new_branch_row['ten_chi_nhanh'],
                "address": new_branch_row['dia_chi'],
                "managerName": manager_name
            }
        }
        
    except HTTPException as http_err:
        # HTTP exceptions (400, 404, etc.) - rollback and re-raise
        if conn:
            conn.rollback()
        print(f"[ERROR] HTTPException: {http_err.status_code} - {http_err.detail}")
        raise
        
    except psycopg2.Error as db_err:
        # Database errors - rollback and convert to 500
        if conn:
            conn.rollback()
        error_msg = f"Database error: {type(db_err).__name__} - {str(db_err)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    except Exception as e:
        # Unexpected errors - rollback and convert to 500
        if conn:
            conn.rollback()
        error_msg = f"Unexpected error: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Database connection closed\n")

@app.put("/api/branches/{branch_id}", status_code=status.HTTP_200_OK)
async def update_branch(branch_id: int, branch: BranchUpdate):
    """
    Update branch information with automatic manager reassignment
    
    Logic Flow:
    1. Validate branch exists
    2. UPDATE chi_nhanh table
    3. If managerId changed: remove old manager and assign new manager to branch
    4. COMMIT transaction
    """
    print("=" * 70)
    print(f"[UPDATE BRANCH] Branch ID: {branch_id}")
    print(f"  name: {branch.name}")
    print(f"  address: {branch.address}")
    print(f"  managerId: {branch.managerId}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn: 
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # ===== VALIDATE BRANCH EXISTS =====
        cursor.execute("SELECT id, quan_ly_id FROM chi_nhanh WHERE id = %s", (branch_id,))
        existing_branch = cursor.fetchone()
        if not existing_branch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Branch not found"
            )
        
        old_manager_id = existing_branch['quan_ly_id']
        print(f"[STEP 0] Existing branch found. Old managerId: {old_manager_id}")
        
        # ===== INPUT VALIDATION =====
        if not branch.name or not branch.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch name cannot be empty"
            )
        
        if not branch.address or not branch.address.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Address cannot be empty"
            )
        
        # Handle managerId (can be None/null now - manager is optional)
        manager_id = branch.managerId if branch.managerId and branch.managerId > 0 else None
        print(f"[STEP 0] New managerId: {manager_id}")
        
        # Validate manager exists (only if provided)
        manager_name = 'Chưa có'
        if manager_id is not None:
            cursor.execute("SELECT id, ho_ten FROM nhan_vien WHERE id = %s", (manager_id,))
            manager = cursor.fetchone()
            if not manager:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Manager with ID {manager_id} not found"
                )
            manager_name = manager['ho_ten']
            print(f"[STEP 0] ✓ Manager found: {manager_name}")
        
        # ===== STEP 1: UPDATE BRANCH INFO =====
        update_branch_sql = """
            UPDATE chi_nhanh
            SET ten_chi_nhanh = %s, dia_chi = %s, quan_ly_id = %s
            WHERE id = %s
        """
        print(f"[STEP 1] Updating chi_nhanh...")
        cursor.execute(update_branch_sql, (branch.name.strip(), branch.address.strip(), manager_id, branch_id))
        print(f"[STEP 1] ✓ Updated chi_nhanh ID {branch_id}")
        
        # ===== STEP 2: REMOVE OLD MANAGER FROM BRANCH (IF DIFFERENT) =====
        if old_manager_id is not None and old_manager_id != manager_id:
            print(f"[STEP 2a] Removing old manager {old_manager_id} from branch {branch_id}")
            cursor.execute(
                "UPDATE nhan_vien SET chi_nhanh_id = NULL WHERE id = %s",
                (old_manager_id,)
            )
            print(f"[STEP 2a] ✓ Old manager {old_manager_id} removed from branch")
        
        # ===== STEP 3: ASSIGN NEW MANAGER TO BRANCH =====
        if manager_id is not None:
            update_employee_sql = """
                UPDATE nhan_vien
                SET chi_nhanh_id = %s
                WHERE id = %s
            """
            print(f"[STEP 2b] Assigning manager {manager_id} to branch {branch_id}")
            cursor.execute(update_employee_sql, (branch_id, manager_id))
            rows_updated = cursor.rowcount
            print(f"[STEP 2b] ✓ Updated {rows_updated} employee record(s)")
        else:
            print("[STEP 2b] ⚠️  Skipped (no manager assigned)")
        
        # ===== STEP 4: COMMIT TRANSACTION =====
        conn.commit()
        print("[STEP 3] ✓ Transaction COMMITTED successfully")
        print("=" * 70)
        
        # ===== RETURN SUCCESS RESPONSE =====
        return {
            "success": True,
            "message": "Branch updated successfully",
            "data": {
                "id": branch_id,
                "name": branch.name,
                "address": branch.address,
                "managerName": manager_name
            }
        }
        
    except HTTPException as http_err:
        if conn:
            conn.rollback()
        print(f"[ERROR] HTTPException: {http_err.status_code} - {http_err.detail}")
        raise
        
    except psycopg2.Error as db_err:
        if conn:
            conn.rollback()
        error_msg = f"Database error: {type(db_err).__name__} - {str(db_err)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = f"Unexpected error: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Database connection closed\n")

@app.delete("/api/branches/{branch_id}", status_code=status.HTTP_200_OK)
async def delete_branch(branch_id: int):
    """
    Xóa chi nhánh
    """
    conn = get_db_connection()
    if not conn: 
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không thể kết nối đến cơ sở dữ liệu"
        )
    
    try:
        cursor = conn.cursor()
        
        # Kiểm tra chi nhánh có tồn tại không
        cursor.execute("SELECT id FROM chi_nhanh WHERE id = %s", (branch_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy chi nhánh với ID này"
            )
        
        # Kiểm tra xem có nhân viên nào thuộc chi nhánh này không
        cursor.execute("SELECT COUNT(*) as count FROM nhan_vien WHERE chi_nhanh_id = %s", (branch_id,))
        result = cursor.fetchone()
        if result[0] > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể xóa chi nhánh vì còn {result[0]} nhân viên đang làm việc tại đây"
            )
        
        query = "DELETE FROM chi_nhanh WHERE id = %s"
        cursor.execute(query, (branch_id,))
        conn.commit()
        
        return {
            "success": True,
            "message": "Xóa chi nhánh thành công"
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        print(f"Error deleting branch: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa chi nhánh: {str(e)}"
        )
    finally:
        conn.close()

# ==========================================
# 2. API NHÂN VIÊN (Staff)
# ==========================================
@app.get("/api/staff")
def get_staff(search: Optional[str] = None, role: Optional[str] = None, status: Optional[str] = None, branchId: Optional[int] = None):
    """
    Get staff list with optional search and filters
    
    Query Parameters:
    - search: Search by name or phone
    - role: Filter by role
    - status: Filter by status
    - branchId: Filter by branch ID
    """
    conn = get_db_connection()
    if not conn: return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Base query
    query = """
       SELECT nv.id, nv.ho_ten as name, nv.chuc_vu as role, 
               nv.so_dien_thoai as phone, nv.trang_thai as status, nv.avatar,
               COALESCE(cn.ten_chi_nhanh, 'Chưa phân bổ') as "branchName",
               nv.chi_nhanh_id as "branchId"
        FROM nhan_vien nv
        LEFT JOIN chi_nhanh cn ON nv.chi_nhanh_id = cn.id
        WHERE 1=1
    """
    params = []
    
    # Add search filter
    if search:
        query += " AND (nv.ho_ten ILIKE %s OR nv.so_dien_thoai ILIKE %s)"
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern])
    
    # Add role filter
    if role:
        query += " AND nv.chuc_vu = %s"
        params.append(role)
    
    # Add status filter
    if status:
        query += " AND nv.trang_thai = %s"
        params.append(status)
    
    # Add branch filter
    if branchId:
        query += " AND nv.chi_nhanh_id = %s"
        params.append(branchId)
    
    query += " ORDER BY nv.id ASC"
    
    cursor.execute(query, tuple(params))
    data = cursor.fetchall()
    conn.close()
    return data

@app.post("/api/staff", status_code=status.HTTP_201_CREATED)
async def create_staff(staff: StaffCreate):
    """
    Create new staff member
    
    Logic:
    1. Validate input
    2. Auto-generate avatar (initials from name)
    3. INSERT into nhan_vien table
    4. Return created staff data
    """
    print("=" * 70)
    print("[CREATE STAFF] Received payload:")
    print(f"  name: {staff.name}")
    print(f"  role: {staff.role}")
    print(f"  phone: {staff.phone}")
    print(f"  status: {staff.status}")
    print(f"  branchId: {staff.branchId}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # ===== INPUT VALIDATION =====
        if not staff.name or not staff.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty"
            )
        
        if not staff.role or not staff.role.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role cannot be empty"
            )
        
        if not staff.phone or not staff.phone.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone cannot be empty"
            )
        
        if not staff.status or not staff.status.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status cannot be empty"
            )
        
        # Handle branchId (optional)
        branch_id = staff.branchId if staff.branchId and staff.branchId > 0 else None
        
        # Validate branch exists (if provided)
        branch_name = 'Chưa phân bổ'
        if branch_id is not None:
            cursor.execute("SELECT id, ten_chi_nhanh FROM chi_nhanh WHERE id = %s", (branch_id,))
            branch = cursor.fetchone()
            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Branch with ID {branch_id} not found"
                )
            branch_name = branch['ten_chi_nhanh']
            print(f"[STEP 0] ✓ Branch found: {branch_name}")
        
        # Auto-generate avatar (initials from name)
        name_parts = staff.name.strip().split()
        if len(name_parts) >= 2:
            avatar = (name_parts[0][0] + name_parts[-1][0]).upper()
        else:
            avatar = name_parts[0][0:2].upper() if len(name_parts[0]) >= 2 else name_parts[0][0].upper()
        
        print(f"[STEP 0] Generated avatar: {avatar}")
        
        # ===== INSERT STAFF =====
        # SQL has exactly 6 placeholders (%s)
        insert_sql = """
            INSERT INTO nhan_vien (ho_ten, chuc_vu, so_dien_thoai, trang_thai, avatar, chi_nhanh_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, ho_ten, chuc_vu, so_dien_thoai, trang_thai, avatar, chi_nhanh_id
        """
        
        # Tuple with exactly 6 values
        insert_params = (
            staff.name.strip(),
            staff.role.strip(),
            staff.phone.strip(),
            staff.status.strip(),
            avatar,
            branch_id
        )
        
        print(f"[STEP 1] Executing INSERT with params: {insert_params}")
        cursor.execute(insert_sql, insert_params)
        new_staff_row = cursor.fetchone()
        
        if not new_staff_row:
            raise Exception("Failed to insert staff - no row returned")
        
        conn.commit()
        print("[STEP 2] ✓ Transaction COMMITTED successfully")
        print("=" * 70)
        
        # ===== RETURN SUCCESS RESPONSE =====
        return {
            "success": True,
            "message": "Staff created successfully",
            "data": {
                "id": new_staff_row['id'],
                "name": new_staff_row['ho_ten'],
                "role": new_staff_row['chuc_vu'],
                "phone": new_staff_row['so_dien_thoai'],
                "status": new_staff_row['trang_thai'],
                "avatar": new_staff_row['avatar'],
                "branchName": branch_name,
                "branchId": new_staff_row['chi_nhanh_id']
            }
        }
        
    except HTTPException as http_err:
        if conn:
            conn.rollback()
        print(f"[ERROR] HTTPException: {http_err.status_code} - {http_err.detail}")
        raise
        
    except psycopg2.Error as db_err:
        if conn:
            conn.rollback()
        error_msg = f"Database error: {type(db_err).__name__} - {str(db_err)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = f"Unexpected error: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Database connection closed\n")

@app.put("/api/staff/{staff_id}", status_code=status.HTTP_200_OK)
async def update_staff(staff_id: int, staff: StaffUpdate):
    """
    Update staff information
    
    Logic:
    1. Validate staff exists
    2. Update staff data
    3. Return updated staff data
    """
    print("=" * 70)
    print(f"[UPDATE STAFF] Staff ID: {staff_id}")
    print(f"  name: {staff.name}")
    print(f"  role: {staff.role}")
    print(f"  phone: {staff.phone}")
    print(f"  status: {staff.status}")
    print(f"  branchId: {staff.branchId}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # ===== VALIDATE STAFF EXISTS =====
        cursor.execute("SELECT id FROM nhan_vien WHERE id = %s", (staff_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff not found"
            )
        
        # ===== INPUT VALIDATION =====
        if not staff.name or not staff.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name cannot be empty"
            )
        
        if not staff.role or not staff.role.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role cannot be empty"
            )
        
        if not staff.phone or not staff.phone.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone cannot be empty"
            )
        
        if not staff.status or not staff.status.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status cannot be empty"
            )
        
        # Handle branchId (optional)
        branch_id = staff.branchId if staff.branchId and staff.branchId > 0 else None
        
        # Validate branch exists (if provided)
        branch_name = 'Chưa phân bổ'
        if branch_id is not None:
            cursor.execute("SELECT id, ten_chi_nhanh FROM chi_nhanh WHERE id = %s", (branch_id,))
            branch = cursor.fetchone()
            if not branch:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Branch with ID {branch_id} not found"
                )
            branch_name = branch['ten_chi_nhanh']
        
        # Auto-generate avatar (initials from name)
        name_parts = staff.name.strip().split()
        if len(name_parts) >= 2:
            avatar = (name_parts[0][0] + name_parts[-1][0]).upper()
        else:
            avatar = name_parts[0][0:2].upper() if len(name_parts[0]) >= 2 else name_parts[0][0].upper()
        
        # ===== UPDATE STAFF =====
        # SQL has exactly 7 placeholders (%s)
        update_sql = """
            UPDATE nhan_vien
            SET ho_ten = %s, chuc_vu = %s, so_dien_thoai = %s, 
                trang_thai = %s, avatar = %s, chi_nhanh_id = %s
            WHERE id = %s
        """
        
        # Tuple with exactly 7 values
        update_params = (
            staff.name.strip(),
            staff.role.strip(),
            staff.phone.strip(),
            staff.status.strip(),
            avatar,
            branch_id,
            staff_id
        )
        
        print(f"[STEP 1] Updating staff...")
        cursor.execute(update_sql, update_params)
        
        conn.commit()
        print("[STEP 2] ✓ Transaction COMMITTED successfully")
        print("=" * 70)
        
        # ===== RETURN SUCCESS RESPONSE =====
        return {
            "success": True,
            "message": "Staff updated successfully",
            "data": {
                "id": staff_id,
                "name": staff.name,
                "role": staff.role,
                "phone": staff.phone,
                "status": staff.status,
                "avatar": avatar,
                "branchName": branch_name,
                "branchId": branch_id
            }
        }
        
    except HTTPException as http_err:
        if conn:
            conn.rollback()
        print(f"[ERROR] HTTPException: {http_err.status_code} - {http_err.detail}")
        raise
        
    except psycopg2.Error as db_err:
        if conn:
            conn.rollback()
        error_msg = f"Database error: {type(db_err).__name__} - {str(db_err)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = f"Unexpected error: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Database connection closed\n")

@app.delete("/api/staff/{staff_id}", status_code=status.HTTP_200_OK)
async def delete_staff(staff_id: int):
    """
    Delete staff member
    """
    print("=" * 70)
    print(f"[DELETE STAFF] Staff ID: {staff_id}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor()
        
        # Validate staff exists
        cursor.execute("SELECT id FROM nhan_vien WHERE id = %s", (staff_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff not found"
            )
        
        # Delete staff
        cursor.execute("DELETE FROM nhan_vien WHERE id = %s", (staff_id,))
        conn.commit()
        
        print("[STEP 1] ✓ Staff deleted successfully")
        print("=" * 70)
        
        return {
            "success": True,
            "message": "Staff deleted successfully"
        }
        
    except HTTPException as http_err:
        if conn:
            conn.rollback()
        print(f"[ERROR] HTTPException: {http_err.status_code} - {http_err.detail}")
        raise
        
    except psycopg2.Error as db_err:
        if conn:
            conn.rollback()
        error_msg = f"Database error: {type(db_err).__name__} - {str(db_err)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = f"Unexpected error: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
        
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Database connection closed\n")

# ==========================================
# 3. API LỊCH LÀM VIỆC (Roster) - MỚI
# ==========================================

# 3.1 API Shift Templates (Cấu hình ca)
@app.get("/api/shift-templates")
def get_shift_templates():
    """
    Get all shift templates from cau_hinh_ca
    """
    conn = get_db_connection()
    if not conn: return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    query = """
        SELECT id, ten_ca as "name", 
               TO_CHAR(gio_bat_dau, 'HH24:MI') as "startTime",
               TO_CHAR(gio_ket_thuc, 'HH24:MI') as "endTime",
               so_luong_max as "maxCapacity"
        FROM cau_hinh_ca
        ORDER BY gio_bat_dau ASC
    """
    cursor.execute(query)
    data = cursor.fetchall()
    conn.close()
    return data

@app.post("/api/shift-templates", status_code=status.HTTP_201_CREATED)
async def create_shift_template(shift: ShiftTemplateCreate):
    """
    Create new shift template with time overlap validation
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Validation
        if not shift.name or not shift.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shift name cannot be empty"
            )
        
        if shift.maxCapacity < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Max capacity must be at least 1"
            )
        
        # Check time overlap
        cursor.execute("""
            SELECT id, ten_ca FROM cau_hinh_ca
            WHERE (gio_bat_dau, gio_ket_thuc) OVERLAPS (%s::time, %s::time)
        """, (shift.startTime, shift.endTime))
        
        existing = cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time overlaps with existing shift: {existing['ten_ca']}"
            )
        
        # Insert shift template
        insert_sql = """
            INSERT INTO cau_hinh_ca (ten_ca, gio_bat_dau, gio_ket_thuc, so_luong_max)
            VALUES (%s, %s::time, %s::time, %s)
            RETURNING id, ten_ca, TO_CHAR(gio_bat_dau, 'HH24:MI') as "startTime",
                      TO_CHAR(gio_ket_thuc, 'HH24:MI') as "endTime", so_luong_max
        """
        
        cursor.execute(insert_sql, (shift.name.strip(), shift.startTime, shift.endTime, shift.maxCapacity))
        new_shift = cursor.fetchone()
        
        conn.commit()
        
        return {
            "success": True,
            "message": "Shift template created successfully",
            "data": {
                "id": new_shift['id'],
                "name": new_shift['ten_ca'],
                "startTime": new_shift['startTime'],
                "endTime": new_shift['endTime'],
                "maxCapacity": new_shift['so_luong_max']
            }
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating shift template: {str(e)}"
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.delete("/api/shift-templates/{shift_id}", status_code=status.HTTP_200_OK)
async def delete_shift_template(shift_id: int):
    """
    Delete shift template (only if no assignments exist)
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if shift exists
        cursor.execute("SELECT id FROM cau_hinh_ca WHERE id = %s", (shift_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shift template not found"
            )
        
        # Check if any assignments use this shift
        cursor.execute(
            "SELECT COUNT(*) as count FROM lich_lam_viec WHERE ca_lam_id = %s",
            (shift_id,)
        )
        count_result = cursor.fetchone()
        if count_result['count'] > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete shift template with {count_result['count']} existing assignments"
            )
        
        cursor.execute("DELETE FROM cau_hinh_ca WHERE id = %s", (shift_id,))
        conn.commit()
        
        return {
            "success": True,
            "message": "Shift template deleted successfully"
        }
        
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting shift template: {str(e)}"
        )
    finally:
        conn.close()

# 3.2 API Roster Assignments (Phân công ca)
@app.get("/api/roster")
def get_roster(start_date: Optional[str] = None, end_date: Optional[str] = None, branch_id: Optional[int] = None):
    """
    Get roster assignments with REQUIRED branch filter
    
    Query Parameters:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - branch_id: Filter by branch ID (REQUIRED)
    
    Returns full data with staff names, shift names, branch names
    """
    print("=" * 70)
    print(f"[GET ROSTER] Params: start_date={start_date}, end_date={end_date}, branch_id={branch_id}")
    print("=" * 70)
    
    # REQUIRE branch_id parameter - Return empty array if not provided
    if not branch_id or branch_id <= 0:
        print("[GET ROSTER] ⚠️ branch_id not provided or invalid - returning empty array")
        return []
    
    conn = get_db_connection()
    if not conn: 
        print("[GET ROSTER] ❌ Database connection failed")
        return []
    
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Query ONLY for specific branch (WHERE clause is MANDATORY)
    query = """
        SELECT l.id, l.nhan_vien_id as "staffId", nv.ho_ten as "staffName",
               nv.avatar, nv.chuc_vu as "role",
               TO_CHAR(l.ngay_lam, 'YYYY-MM-DD') as date,
               l.ca_lam_id as "shiftTemplateId", ca.ten_ca as "shiftName",
               TO_CHAR(ca.gio_bat_dau, 'HH24:MI') as "shiftStartTime",
               TO_CHAR(ca.gio_ket_thuc, 'HH24:MI') as "shiftEndTime",
               l.chi_nhanh_id as "branchId",
               COALESCE(cn.ten_chi_nhanh, 'Chưa phân bổ') as "branchName"
        FROM lich_lam_viec l
        JOIN nhan_vien nv ON l.nhan_vien_id = nv.id
        JOIN cau_hinh_ca ca ON l.ca_lam_id = ca.id
        LEFT JOIN chi_nhanh cn ON l.chi_nhanh_id = cn.id
        WHERE l.chi_nhanh_id = %s
    """
    params = [branch_id]
    
    print(f"[GET ROSTER] 🔍 Filtering by branch_id = {branch_id}")
    
    if start_date:
        query += " AND l.ngay_lam >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND l.ngay_lam <= %s"
        params.append(end_date)
    
    query += " ORDER BY l.ngay_lam ASC, ca.gio_bat_dau ASC"
    
    print(f"[GET ROSTER] Executing query with {len(params)} params: {params}")
    print(f"[GET ROSTER] Query: {query[:200]}...")
    cursor.execute(query, tuple(params))
    data = cursor.fetchall()
    print(f"[GET ROSTER] ✓ Found {len(data)} roster assignments for branch_id={branch_id}")
    
    # Debug: Print first record if exists
    if data and len(data) > 0:
        print(f"[GET ROSTER] Sample record: ID={data[0].get('id')}, branchId={data[0].get('branchId')}, staffName={data[0].get('staffName')}")
    
    print("=" * 70)
    
    conn.close()
    return data

@app.post("/api/assign-shift", status_code=status.HTTP_201_CREATED)
async def assign_shift(assignment: ShiftAssignment):
    """
    Phân công nhân viên vào ca VÀ tự động tạo bản ghi chấm công
    
    Input: { staffId, shiftTemplateId, date, branchId }
    
    Logic Transaction (Cả 2 bước phải thành công):
    1. INSERT vào lich_lam_viec
    2. AUTO INSERT/UPDATE vào cham_cong (lấy giờ từ cau_hinh_ca)
    """
    print("=" * 70)
    print("[ASSIGN SHIFT] Nhận payload:")
    print(f"  staffId: {assignment.staffId}")
    print(f"  shiftTemplateId: {assignment.shiftTemplateId}")
    print(f"  date: {assignment.date}")
    print(f"  branchId: {assignment.branchId}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # ===== STEP 1: VALIDATE STAFF =====
        cursor.execute(
            "SELECT id, ho_ten, avatar, chuc_vu FROM nhan_vien WHERE id = %s",
            (assignment.staffId,)
        )
        staff = cursor.fetchone()
        if not staff:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff not found"
            )
        print(f"[STEP 1] ✓ Staff found: {staff['ho_ten']} ({staff['chuc_vu']})")
        
        # ===== STEP 2: VALIDATE SHIFT TEMPLATE & GET TIMES =====
        cursor.execute("""
            SELECT id, ten_ca, so_luong_max, gio_bat_dau, gio_ket_thuc
            FROM cau_hinh_ca WHERE id = %s
        """, (assignment.shiftTemplateId,))
        
        shift_template = cursor.fetchone()
        if not shift_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shift template not found"
            )
        
        # Extract TIME values for attendance (FORMAT: HH:MM - CẮT BỎ :SS)
        gio_vao_raw = str(shift_template['gio_bat_dau'])  # Convert to string first
        gio_ra_raw = str(shift_template['gio_ket_thuc'])
        
        # Đảm bảo format HH:MM (cắt bỏ giây nếu có)
        gio_vao_str = gio_vao_raw[:5] if len(gio_vao_raw) >= 5 else gio_vao_raw
        gio_ra_str = gio_ra_raw[:5] if len(gio_ra_raw) >= 5 else gio_ra_raw
        
        print(f"[STEP 2] ✓ Shift: {shift_template['ten_ca']} ({gio_vao_str} - {gio_ra_str})")
        
        # ===== STEP 3: CHECK IF ALREADY ASSIGNED =====
        cursor.execute("""
            SELECT id FROM lich_lam_viec 
            WHERE nhan_vien_id = %s AND ngay_lam = %s
        """, (assignment.staffId, assignment.date))
        
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Staff is already assigned to a shift on this date"
            )
        print(f"[STEP 3] ✓ No existing assignment for this date")
        
        # ===== STEP 4: CHECK CAPACITY =====
        cursor.execute("""
            SELECT COUNT(*) as count FROM lich_lam_viec 
            WHERE ca_lam_id = %s AND ngay_lam = %s
        """, (assignment.shiftTemplateId, assignment.date))
        
        count_result = cursor.fetchone()
        if count_result['count'] >= shift_template['so_luong_max']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shift has reached maximum capacity ({shift_template['so_luong_max']} slots)"
            )
        print(f"[STEP 4] ✓ Capacity OK ({count_result['count']}/{shift_template['so_luong_max']})")
        
        # ===== STEP 5: HANDLE BRANCH ID =====
        branch_id = assignment.branchId if assignment.branchId and assignment.branchId > 0 else None
        branch_name = 'Chưa phân bổ'
        
        if branch_id:
            cursor.execute(
                "SELECT id, ten_chi_nhanh FROM chi_nhanh WHERE id = %s",
                (branch_id,)
            )
            branch = cursor.fetchone()
            if branch:
                branch_name = branch['ten_chi_nhanh']
        print(f"[STEP 5] ✓ Branch: {branch_name} (ID={branch_id})")
        
        # ===== STEP 6: INSERT ROSTER ASSIGNMENT =====
        insert_roster_sql = """
            INSERT INTO lich_lam_viec (nhan_vien_id, ca_lam_id, ngay_lam, chi_nhanh_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """
        
        cursor.execute(insert_roster_sql, (assignment.staffId, assignment.shiftTemplateId, assignment.date, branch_id))
        new_assignment = cursor.fetchone()
        print(f"[STEP 6] ✓ Roster assignment created with ID = {new_assignment['id']}")
        
        # ===== STEP 7: AUTO-CREATE/UPDATE ATTENDANCE =====
        # Check if attendance already exists for this staff on this date
        cursor.execute("""
            SELECT id FROM cham_cong 
            WHERE nhan_vien_id = %s AND ngay = %s
        """, (assignment.staffId, assignment.date))
        
        existing_attendance = cursor.fetchone()
        
        if existing_attendance:
            # UPDATE existing record with shift times
            update_attendance_sql = """
                UPDATE cham_cong
                SET gio_vao = %s, gio_ra = %s, trang_thai_checkin = 'Tự động'
                WHERE nhan_vien_id = %s AND ngay = %s
            """
            cursor.execute(update_attendance_sql, (
                gio_vao_str,
                gio_ra_str,
                assignment.staffId,
                assignment.date
            ))
            print(f"[STEP 7] ✓ Updated existing attendance (ID={existing_attendance['id']}) with times: {gio_vao_str} - {gio_ra_str}")
        else:
            # INSERT new attendance record
            insert_attendance_sql = """
                INSERT INTO cham_cong (nhan_vien_id, ngay, gio_vao, gio_ra, trang_thai_checkin)
                VALUES (%s, %s, %s, %s, 'Tự động')
            """
            cursor.execute(insert_attendance_sql, (
                assignment.staffId,
                assignment.date,
                gio_vao_str,
                gio_ra_str
            ))
            print(f"[STEP 7] ✓ Created new attendance record with times: {gio_vao_str} - {gio_ra_str}")
        
        # ===== STEP 8: COMMIT TRANSACTION =====
        conn.commit()
        print("[STEP 8] ✓ Transaction COMMITTED successfully (Roster + Attendance synced)")
        print("=" * 70)
        
        return {
            "success": True,
            "message": "Phân ca thành công và tự động tạo chấm công",
            "data": {
                "id": new_assignment['id'],
                "staffId": assignment.staffId,
                "staffName": staff['ho_ten'],
                "avatar": staff['avatar'],
                "role": staff['chuc_vu'],
                "date": assignment.date,
                "shiftTemplateId": assignment.shiftTemplateId,
                "shiftName": shift_template['ten_ca'],
                "shiftStartTime": gio_vao_str,
                "shiftEndTime": gio_ra_str,
                "branchId": branch_id,
                "branchName": branch_name
            }
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = f"Error assigning shift: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Database connection closed\n")

@app.delete("/api/roster/{assignment_id}", status_code=status.HTTP_200_OK)
async def delete_assignment(assignment_id: int):
    """
    Xóa phân ca VÀ tự động xóa bản ghi chấm công tương ứng
    
    Input: assignment_id (ID dòng trong lich_lam_viec)
    
    Logic Transaction:
    1. Lấy nhan_vien_id và ngay_lam từ lich_lam_viec
    2. DELETE từ lich_lam_viec
    3. DELETE từ cham_cong (WHERE nhan_vien_id + ngay khớp)
    """
    print("=" * 70)
    print(f"[DELETE ASSIGNMENT] ID: {assignment_id}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không thể kết nối Database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # === BƯỚC 1: Lấy thông tin trước khi xóa ===
        cursor.execute("""
            SELECT l.id, l.nhan_vien_id, l.ngay_lam, nv.ho_ten
            FROM lich_lam_viec l
            JOIN nhan_vien nv ON l.nhan_vien_id = nv.id
            WHERE l.id = %s
        """, (assignment_id,))
        
        assignment = cursor.fetchone()
        if not assignment:
            raise HTTPException(status_code=404, detail="Không tìm thấy phân ca này")
        
        staff_id = assignment['nhan_vien_id']
        staff_name = assignment['ho_ten']
        work_date = assignment['ngay_lam']
        
        print(f"[STEP 1] ✅ Tìm thấy: {staff_name} (ID={staff_id}), ngày={work_date}")
        
        # === BƯỚC 2: Xóa khỏi lich_lam_viec ===
        cursor.execute("DELETE FROM lich_lam_viec WHERE id = %s", (assignment_id,))
        rows_deleted_roster = cursor.rowcount
        print(f"[STEP 2] ✅ Xóa lịch làm việc (ID={assignment_id})")
        
        # === BƯỚC 3: Xóa khỏi cham_cong (ĐỒNG BỘ) ===
        cursor.execute("""
            DELETE FROM cham_cong 
            WHERE nhan_vien_id = %s AND ngay = %s
        """, (staff_id, work_date))
        
        rows_deleted_attendance = cursor.rowcount
        if rows_deleted_attendance > 0:
            print(f"[STEP 3] ✅ Xóa {rows_deleted_attendance} bản ghi chấm công")
        else:
            print(f"[STEP 3] ⚠️ Không tìm thấy chấm công (đã xóa trước đó)")
        
        # === BƯỚC 4: COMMIT ===
        conn.commit()
        print("[STEP 4] ✅ COMMIT thành công (Đồng bộ xóa 2 bảng)")
        print("=" * 70)
        
        return {
            "success": True,
            "message": f"Xóa thành công ({rows_deleted_roster} lịch, {rows_deleted_attendance} chấm công)"
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        print("[ERROR] HTTPException - ROLLBACK")
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = f"Lỗi: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_msg} - ROLLBACK")
        raise HTTPException(status_code=500, detail=error_msg)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Đóng kết nối DB\n")

# ==========================================
# 4. API CHẤM CÔNG (Attendance & Timesheet)
# ==========================================
@app.get("/api/attendance")
def get_attendance():
    conn = get_db_connection()
    if not conn: return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    query = """
        SELECT nv.ho_ten as "staffName", 
               TO_CHAR(c.ngay, 'DD/MM/YYYY') as date, 
               c.gio_vao as "checkIn", c.gio_ra as "checkOut",
               c.trang_thai_checkin
        FROM cham_cong c
        JOIN nhan_vien nv ON c.nhan_vien_id = nv.id
        ORDER BY c.ngay DESC, c.gio_vao ASC
    """
    cursor.execute(query)
    data = cursor.fetchall()
    
    # Tính toán tổng giờ (Giả lập đơn giản)
    for row in data:
        row['totalHours'] = '8h' 
        # Logic hiển thị trễ cho frontend
        if row['trang_thai_checkin'] == 'Trễ':
             row['isLate'] = True # Frontend có thể dùng cờ này để tô đỏ
        
    conn.close()
    return data

@app.get("/api/timesheet")
def get_timesheet(
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    branch_id: Optional[int] = None,
    role: Optional[str] = None,
    search: Optional[str] = None
):
    """
    Get timesheet data for staff with attendance records
    Returns matrix-friendly structure for Frontend rendering
    
    Query Parameters:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - branch_id: Filter by branch ID
    - role: Filter by staff role
    - search: Search by staff name or phone
    """
    conn = get_db_connection()
    if not conn: return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Build base query with all JOINs first
    query = """
        SELECT 
            nv.id as "staffId",
            nv.ho_ten as "staffName",
            nv.avatar,
            nv.chuc_vu as "role",
            COALESCE(cn.ten_chi_nhanh, 'Chưa phân bổ') as "branchName",
            TO_CHAR(c.ngay, 'YYYY-MM-DD') as date,
            c.gio_vao as "checkIn",
            c.gio_ra as "checkOut",
            c.trang_thai_checkin as "status"
        FROM nhan_vien nv
        LEFT JOIN chi_nhanh cn ON nv.chi_nhanh_id = cn.id
        LEFT JOIN cham_cong c ON nv.id = c.nhan_vien_id
        WHERE 1=1
    """
    
    params = []
    
    # Add staff filters
    if search:
        query += " AND (nv.ho_ten ILIKE %s OR nv.so_dien_thoai ILIKE %s)"
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern])
    
    if branch_id:
        query += " AND nv.chi_nhanh_id = %s"
        params.append(branch_id)
    
    if role:
        query += " AND nv.chuc_vu = %s"
        params.append(role)
    
    # Add date range filters
    if start_date and end_date:
        query += " AND (c.ngay IS NULL OR (c.ngay >= %s AND c.ngay <= %s))"
        params.extend([start_date, end_date])
    elif start_date:
        query += " AND (c.ngay IS NULL OR c.ngay >= %s)"
        params.append(start_date)
    elif end_date:
        query += " AND (c.ngay IS NULL OR c.ngay <= %s)"
        params.append(end_date)
    
    query += " ORDER BY nv.id ASC, c.ngay ASC"
    
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    
    # Transform data into matrix-friendly structure
    staff_dict = {}
    
    for row in rows:
        staff_id = row['staffId']
        
        if staff_id not in staff_dict:
            staff_dict[staff_id] = {
                'staffId': staff_id,
                'staffName': row['staffName'],
                'avatar': row['avatar'],
                'role': row['role'],
                'branchName': row['branchName'],
                'totalHours': 0,
                'attendance': {}
            }
        
        # Process attendance record if exists
        if row['date'] and row['checkIn'] and row['checkOut']:
            try:
                date = row['date']
                check_in = row['checkIn']
                check_out = row['checkOut']
                
                # Calculate hours worked (safe parsing inside calculate_work_hours)
                hours = calculate_work_hours(check_in, check_out)
                
                staff_dict[staff_id]['attendance'][date] = {
                    'in': check_in,
                    'out': check_out,
                    'hours': hours,
                    'status': row['status']
                }
                
                staff_dict[staff_id]['totalHours'] += hours
            except Exception as e:
                # Log error but continue processing other rows
                print(f"[ERROR] Failed to process attendance for staff {staff_id} on {row['date']}: {e}")
                continue
    
    # Convert dict to list and round total hours
    result = []
    for staff_data in staff_dict.values():
        staff_data['totalHours'] = round(staff_data['totalHours'], 1)
        result.append(staff_data)
    
    return result

def calculate_work_hours(check_in: str, check_out: str) -> float:
    """
    Calculate work hours from time strings using datetime module
    Format: "HH:MM" (e.g., "08:00", "17:30")
    Logic: Parse with strptime, calculate exact time difference (no auto lunch deduction)
    """
    try:
        # Parse time strings using datetime
        time_format = '%H:%M'
        t_in = datetime.strptime(check_in.strip(), time_format)
        t_out = datetime.strptime(check_out.strip(), time_format)
        
        # Handle overnight shifts (check_out < check_in)
        # Add 24 hours to checkout time if it's earlier than check-in
        if t_out < t_in:
            from datetime import timedelta
            t_out += timedelta(days=1)
        
        # Calculate difference in hours (exact time difference)
        time_diff = t_out - t_in
        work_hours = time_diff.total_seconds() / 3600
        
        return max(0, round(work_hours, 1))  # Ensure non-negative and round to 1 decimal
        
    except (ValueError, AttributeError, TypeError) as e:
        # Log error for debugging but don't crash the API
        print(f"[ERROR] Failed to parse time: check_in={check_in}, check_out={check_out}, error={e}")
        return 0

# ==========================================
# 5. API QUẢN LÝ LƯƠNG (Payroll Management)
# ==========================================

# 5.1 API Payroll Configuration
@app.get("/api/payroll-config")
def get_payroll_config():
    """
    Get salary configurations:
    - Role-based configs (nhan_vien_id IS NULL)
    - Individual staff configs (nhan_vien_id IS NOT NULL)
    """
    conn = get_db_connection()
    if not conn: return {"roleConfigs": [], "staffConfigs": []}
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get role-based configs
    role_query = """
        SELECT id, role, loai_luong as "salaryType", muc_luong as "amount"
        FROM cau_hinh_luong
        WHERE nhan_vien_id IS NULL
        ORDER BY role ASC
    """
    cursor.execute(role_query)
    role_configs = cursor.fetchall()
    
    # Get individual staff configs
    staff_query = """
        SELECT cl.id, cl.nhan_vien_id as "staffId", cl.role,
               nv.ho_ten as "staffName",
               cl.loai_luong as "salaryType",
               cl.muc_luong as "amount"
        FROM cau_hinh_luong cl
        JOIN nhan_vien nv ON cl.nhan_vien_id = nv.id
        WHERE cl.nhan_vien_id IS NOT NULL
        ORDER BY nv.id ASC
    """
    cursor.execute(staff_query)
    staff_configs = cursor.fetchall()
    
    conn.close()
    return {
        "roleConfigs": role_configs,
        "staffConfigs": staff_configs
    }

@app.post("/api/payroll-config", status_code=status.HTTP_201_CREATED)
async def create_or_update_payroll_config(config: PayrollConfigCreate):
    """
    Create or update salary configuration:
    - If staffId is NULL: Configure for entire role
    - If staffId is provided: Configure for specific staff (overrides role config)
    """
    print("=" * 70)
    print("[PAYROLL CONFIG] Received payload:")
    print(f"  role: {config.role}")
    print(f"  staffId: {config.staffId}")
    print(f"  type: {config.type}")
    print(f"  amount: {config.amount}")
    print("=" * 70)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot connect to database"
        )
    
    cursor = None
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Validate role
        if not config.role or not config.role.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role cannot be empty"
            )
        
        # Validate staff exists (if staffId provided)
        staff_name = None
        if config.staffId:
            cursor.execute("SELECT id, ho_ten, chuc_vu FROM nhan_vien WHERE id = %s", (config.staffId,))
            staff = cursor.fetchone()
            if not staff:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Staff not found"
                )
            
            # Validate staff role matches
            if staff['chuc_vu'] != config.role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Staff role ({staff['chuc_vu']}) does not match config role ({config.role})"
                )
            
            staff_name = staff['ho_ten']
            print(f"[STEP 0] ✓ Staff found: {staff_name} (role: {staff['chuc_vu']})")
        else:
            print(f"[STEP 0] Configuring for entire role: {config.role}")
        
        # Validate salary type
        if config.type not in ['THEO_GIO', 'THEO_THANG']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Salary type must be 'THEO_GIO' or 'THEO_THANG'"
            )
        
        if config.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount must be greater than 0"
            )
        
        # Check if config exists (role + staffId combination)
        if config.staffId:
            cursor.execute(
                "SELECT id FROM cau_hinh_luong WHERE role = %s AND nhan_vien_id = %s",
                (config.role, config.staffId)
            )
        else:
            cursor.execute(
                "SELECT id FROM cau_hinh_luong WHERE role = %s AND nhan_vien_id IS NULL",
                (config.role,)
            )
        existing = cursor.fetchone()
        
        if existing:
            # UPDATE existing config
            target = f"nhân viên {staff_name}" if config.staffId else f"vai trò {config.role}"
            message = f"Cập nhật cấu hình lương cho {target} thành công"
            cursor.execute(
                "UPDATE cau_hinh_luong SET loai_luong = %s, muc_luong = %s WHERE id = %s",
                (config.type, config.amount, existing['id'])
            )
        else:
            # INSERT new config
            target = f"nhân viên {staff_name}" if config.staffId else f"vai trò {config.role}"
            message = f"Thêm cấu hình lương cho {target} thành công"
            cursor.execute(
                "INSERT INTO cau_hinh_luong (role, nhan_vien_id, loai_luong, muc_luong) VALUES (%s, %s, %s, %s)",
                (config.role, config.staffId, config.type, config.amount)
            )
        
        conn.commit()
        print(f"[SUCCESS] {message}")
        print("=" * 70)
        
        return {
            "success": True,
            "message": message,
            "data": {
                "role": config.role,
                "staffId": config.staffId,
                "staffName": staff_name,
                "salaryType": config.type,
                "amount": config.amount
            }
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        error_msg = f"Error saving payroll config: {str(e)}"
        print(f"[ERROR] {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("[CLEANUP] Database connection closed\n")

# 5.2 API Get Staff by Role (For Payroll Config)
@app.get("/api/staff-by-role/{role}")
def get_staff_by_role(role: str):
    """
    Get all staff members with a specific role
    Used in payroll config to show dropdown of staff for role-specific config
    """
    conn = get_db_connection()
    if not conn: return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    query = """
        SELECT id, ho_ten as "name", chuc_vu as "role"
        FROM nhan_vien
        WHERE chuc_vu = %s
        ORDER BY ho_ten ASC
    """
    cursor.execute(query, (role,))
    data = cursor.fetchall()
    conn.close()
    return data

# 5.3 API Payroll Sheet (Salary Calculation)
@app.get("/api/payroll-sheet")
def get_payroll_sheet(
    month: Optional[int] = None,
    year: Optional[int] = None,
    branch_id: Optional[int] = None,
    role: Optional[str] = None,
    search: Optional[str] = None
):
    """
    Calculate monthly payroll for staff based on attendance data
    
    Business Rules:
    - THEO_GIO (Hourly): salary = total_hours * hourly_rate
    - THEO_THANG (Monthly): salary = fixed_amount (independent of hours)
    - No config: salary = 0
    
    Query Parameters:
    - month: Month (1-12), default current month
    - year: Year (YYYY), default current year
    - branch_id: Filter by branch
    - role: Filter by staff role
    - search: Search by staff name
    """
    conn = get_db_connection()
    if not conn: return []
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Default to current month/year if not provided
    if not month or not year:
        from datetime import datetime
        today = datetime.now()
        month = month or today.month
        year = year or today.year
    
    print(f"[PAYROLL SHEET] Calculating for month={month}, year={year}")
    
    # Build base query with priority: staff-specific config > role config
    query = """
        SELECT nv.id as "staffId",
               nv.ho_ten as "staffName",
               nv.chuc_vu as "role",
               COALESCE(cn.ten_chi_nhanh, 'Chưa phân bổ') as "branchName",
               COALESCE(cl_staff.loai_luong, cl_role.loai_luong) as "salaryType",
               COALESCE(cl_staff.muc_luong, cl_role.muc_luong) as "baseAmount",
               CASE WHEN cl_staff.id IS NOT NULL THEN true ELSE false END as "hasCustomConfig"
        FROM nhan_vien nv
        LEFT JOIN chi_nhanh cn ON nv.chi_nhanh_id = cn.id
        LEFT JOIN cau_hinh_luong cl_staff ON nv.id = cl_staff.nhan_vien_id
        LEFT JOIN cau_hinh_luong cl_role ON nv.chuc_vu = cl_role.role AND cl_role.nhan_vien_id IS NULL
        WHERE 1=1
    """
    
    params = []
    
    # Add filters
    if search:
        query += " AND nv.ho_ten ILIKE %s"
        params.append(f"%{search}%")
    
    if branch_id:
        query += " AND nv.chi_nhanh_id = %s"
        params.append(branch_id)
    
    if role:
        query += " AND nv.chuc_vu = %s"
        params.append(role)
    
    query += " ORDER BY nv.id ASC"
    
    cursor.execute(query, tuple(params))
    staff_rows = cursor.fetchall()
    
    # Calculate total hours and final salary for each staff
    result = []
    
    for staff in staff_rows:
        staff_id = staff['staffId']
        salary_type = staff['salaryType']
        base_amount = staff['baseAmount'] or 0
        
        # Get attendance records for this month
        attendance_query = """
            SELECT gio_vao as "checkIn", gio_ra as "checkOut"
            FROM cham_cong
            WHERE nhan_vien_id = %s
              AND EXTRACT(MONTH FROM ngay) = %s
              AND EXTRACT(YEAR FROM ngay) = %s
              AND gio_vao IS NOT NULL
              AND gio_ra IS NOT NULL
        """
        
        cursor.execute(attendance_query, (staff_id, month, year))
        attendance_records = cursor.fetchall()
        
        # Calculate total hours
        total_hours = 0
        for record in attendance_records:
            hours = calculate_work_hours(record['checkIn'], record['checkOut'])
            total_hours += hours
        
        # Calculate final salary based on type (CONVERT base_amount to float to avoid Decimal issues)
        base_amount_float = float(base_amount) if base_amount else 0
        if salary_type == 'THEO_GIO':
            final_salary = total_hours * base_amount_float
        elif salary_type == 'THEO_THANG':
            final_salary = base_amount_float
        else:
            # No salary config
            final_salary = 0
        
        result.append({
            'id': staff_id,
            'name': staff['staffName'],
            'role': staff['role'],
            'branchName': staff['branchName'],
            'salaryType': 'Theo giờ' if salary_type == 'THEO_GIO' else ('Theo tháng' if salary_type == 'THEO_THANG' else 'Chưa cấu hình'),
            'baseAmount': base_amount_float,
            'totalHours': round(total_hours, 1),
            'finalSalary': round(final_salary, 0),
            'hasCustomConfig': staff['hasCustomConfig']  # Flag for custom config
        })
    
    conn.close()
    print(f"[PAYROLL SHEET] Calculated for {len(result)} staff members")
    return result

# ==========================================
# AI ALERTS ENDPOINTS
# ==========================================
@app.get("/api/ai/alerts")
def get_ai_alerts():
    """Get AI-detected alerts (Overstay, Ghost Table, Mismatch)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query from trang_thai_ban table
        cursor.execute("""
            SELECT 
                ttb.id,
                ba.id as table_id,
                ba.ten_ban as table_name,
                ttb.trang_thai,
                ttb.gio_check_in,
                ttb.so_khach_pos,
                ttb.so_khach_ai,
                ttb.la_ban_ma,
                ttb.la_sai_lech,
                ttb.chenh_lech
            FROM trang_thai_ban ttb
            JOIN ban_an ba ON ttb.ban_id = ba.id
            WHERE ba.kich_hoat = TRUE
            ORDER BY ba.id
        """)
        
        data = cursor.fetchall()
        alerts = []
        
        # Check for alerts
        for row in data:
            # Overstay alert (> 90 minutes)
            if row['gio_check_in'] and row['trang_thai'] != 'empty':
                duration = (datetime.now() - row['gio_check_in']).total_seconds() / 60
                if duration > 90:
                    alerts.append({
                        'id': f"overstay_{row['table_id']}",
                        'type': 'overstay',
                        'table_id': row['table_id'],
                        'table_name': row['table_name'],
                        'message': f"Overstay - Vượt quá {int(duration)} phút",
                        'severity': 'warning',
                        'data': {
                            'duration_minutes': int(duration),
                            'guests': row['so_khach_pos']
                        }
                    })
            
            # Ghost Table alert (bàn không có order)
            if row['la_ban_ma']:
                alerts.append({
                    'id': f"ghost_{row['table_id']}",
                    'type': 'ghost',
                    'table_id': row['table_id'],
                    'table_name': row['table_name'],
                    'message': "Ghost Table - Bàn không có order",
                    'severity': 'error',
                    'data': {}
                })
            
            # Mismatch alert (AI count != POS count)
            if row['la_sai_lech'] and row['chenh_lech'] and row['chenh_lech'] != 0:
                alerts.append({
                    'id': f"mismatch_{row['table_id']}",
                    'type': 'mismatch',
                    'table_id': row['table_id'],
                    'table_name': row['table_name'],
                    'message': f"Sai lệch - AI đếm {row['so_khach_ai']} người, POS ghi {row['so_khach_pos']} ({row['chenh_lech']:+d})",
                    'severity': 'warning',
                    'data': {
                        'ai_count': row['so_khach_ai'],
                        'pos_count': row['so_khach_pos'],
                        'difference': row['chenh_lech']
                    }
                })
        
        conn.close()
        return alerts
    except Exception as e:
        print(f"Error fetching AI alerts: {e}")
        return []

# ==========================================
# AI CAMERA SIMULATOR - Background Thread & Endpoints
# ==========================================

def ai_camera_thread():
    """
    Background thread that reads video, runs YOLO detection with full processor.py logic,
    and updates ai_state with table-level tracking.
    """
    global ai_state, ai_running, current_frame_bytes, table_managers, track_pos_history
    
    if not AI_AVAILABLE:
        print("[AI Thread] Cannot start - dependencies not available")
        return
    
    # Check if video file exists
    if not os.path.exists(AI_VIDEO_PATH):
        print(f"[AI Thread] Video file not found: {AI_VIDEO_PATH}")
        ai_state["camera_status"] = "error"
        return
    
    # Check if model file exists
    if not os.path.exists(AI_MODEL_PATH):
        print(f"[AI Thread] Model file not found: {AI_MODEL_PATH}")
        ai_state["camera_status"] = "error"
        return
    
    print(f"[AI Thread] Loading YOLO model from: {AI_MODEL_PATH}")
    try:
        model = YOLO(AI_MODEL_PATH)
        print("[AI Thread] YOLO model loaded successfully")
    except Exception as e:
        print(f"[AI Thread] Error loading YOLO model: {e}")
        ai_state["camera_status"] = "error"
        return
    
    print(f"[AI Thread] Opening video: {AI_VIDEO_PATH}")
    cap = cv2.VideoCapture(AI_VIDEO_PATH)
    
    if not cap.isOpened():
        print("[AI Thread] Cannot open video file")
        ai_state["camera_status"] = "error"
        return
    
    # Initialize table managers
    table_managers = [TableManager(i, TABLE_CAPACITIES[i]) for i in range(len(TABLE_CAPACITIES))]
    track_pos_history = {}
    
    ai_state["camera_status"] = "active"
    frame_count = 0
    start_time = time.time()
    activity_logs = []
    last_table_states = {}
    
    print("[AI Thread] Starting detection loop with full processor logic...")
    
    while ai_running:
        ret, frame = cap.read()
        
        # Loop video when it ends
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        
        frame_count += 1
        
        try:
            # Resize for faster processing
            target_w, target_h = 960, 540
            scale_w = frame.shape[1] / target_w
            scale_h = frame.shape[0] / target_h
            frame_small = cv2.resize(frame, (target_w, target_h))
            
            # Run YOLO with tracking
            results = model.track(frame_small, persist=True, verbose=False, classes=[0],
                                 conf=0.20, iou=0.65, tracker="bytetrack.yaml")
            
            # Map table index -> list of track IDs in this frame
            frame_guests_map = {i: [] for i in range(len(TABLE_CAPACITIES))}
            detections = []
            
            if results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
                track_ids = results[0].boxes.id.cpu().numpy().astype(int)
                
                for box, track_id in zip(boxes, track_ids):
                    x1, y1 = int(box[0] * scale_w), int(box[1] * scale_h)
                    x2, y2 = int(box[2] * scale_w), int(box[3] * scale_h)
                    center_x, center_y = (x1 + x2) // 2, (y1 + y2) // 2
                    
                    # Calculate velocity
                    speed = 0
                    if track_id in track_pos_history:
                        prev_x, prev_y = track_pos_history[track_id]
                        speed = math.sqrt((center_x - prev_x)**2 + (center_y - prev_y)**2)
                    track_pos_history[track_id] = (center_x, center_y)
                    
                    # Check which table this person is in
                    in_table = False
                    if TABLE_POLYGONS is not None:
                        for i, poly in enumerate(TABLE_POLYGONS):
                            # Velocity filter for strict tables
                            if i in STRICT_TABLES and speed > WALKING_THRESHOLD:
                                continue
                            
                            # Multi-point check
                            check_ratios = CHECK_POINT_CONFIG.get(i, CHECK_POINT_CONFIG['default'])
                            is_inside = False
                            for ratio in check_ratios:
                                check_y = int(y1 + (y2 - y1) * ratio)
                                check_point = ((x1 + x2) // 2, check_y)
                                if cv2.pointPolygonTest(poly, check_point, False) >= 0:
                                    is_inside = True
                                    break
                            
                            if is_inside:
                                frame_guests_map[i].append(track_id)
                                in_table = True
                                break
                    
                    # Add detection
                    conf = float(results[0].boxes.conf[0]) if len(results[0].boxes.conf) > 0 else 0.5
                    color = (0, 255, 0) if in_table else (100, 100, 100)
                    detections.append({
                        "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                        "confidence": round(conf, 2),
                        "track_id": int(track_id),
                        "in_table": in_table
                    })
                    
                    # Draw on frame
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            
            # Update all table managers
            busy_tables = 0
            total_dwell = 0
            total_guests = 0
            table_details = []
            alerts = []
            time_str = datetime.now().strftime("%H:%M:%S")
            
            for i in range(len(TABLE_CAPACITIES)):
                manager = table_managers[i]
                manager.update(frame_guests_map[i])
                info = manager.get_info()
                table_details.append(info)
                total_guests += info['headcount']
                
                if info['status'] == "CO KHACH":
                    busy_tables += 1
                    total_dwell += info['seconds']
                
                # Generate alerts
                if info['alert'] != "NONE":
                    alerts.append(f"B{info['id']}: {info['alert']}")
                
                # Log state transitions
                old_status = last_table_states.get(i, "TRONG")
                if old_status != info['status']:
                    if info['status'] == "CO KHACH":
                        activity_logs.insert(0, {
                            "id": random.randint(10000, 99999),
                            "time": time_str,
                            "type": "INFO",
                            "message": f"Bàn {info['id']}: Khách mới ({info['headcount']} người)"
                        })
                    else:
                        activity_logs.insert(0, {
                            "id": random.randint(10000, 99999),
                            "time": time_str,
                            "type": "SUCCESS",
                            "message": f"Bàn {info['id']}: Đã thanh toán"
                        })
                    last_table_states[i] = info['status']
                
                # Draw table polygons on frame
                if TABLE_POLYGONS is not None:
                    poly = TABLE_POLYGONS[i]
                    color = (0, 0, 200) if info['status'] == "CO KHACH" else (0, 200, 0)
                    cv2.polylines(frame, [poly], True, color, 2)
                    cx, cy = int(np.mean(poly[:, 0])), int(np.mean(poly[:, 1]))
                    label = f"B{info['id']}"
                    if info['status'] == "CO KHACH":
                        label += f"({info['headcount']})"
                    cv2.putText(frame, label, (cx - 30, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Keep only last 20 logs
            activity_logs = activity_logs[:20]
            
            # Calculate metrics
            occupancy_rate = int((busy_tables / len(TABLE_CAPACITIES)) * 100) if TABLE_CAPACITIES else 0
            avg_dwell = int(total_dwell / busy_tables // 60) if busy_tables > 0 else 0
            elapsed = time.time() - start_time
            fps = frame_count / elapsed if elapsed > 0 else 0
            
            # Get list of active table IDs (for frontend to highlight)
            active_zones = [info['id'] for info in table_details if info['status'] == "CO KHACH"]
            
            # Draw stats on frame
            cv2.putText(frame, f"Guests: {total_guests} | Tables: {busy_tables}/8", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
            cv2.putText(frame, f"AI Processor Active | {fps:.1f} FPS", (10, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            
            # === THREAD-SAFE UPDATE: Write to RAM cache with lock ===
            with ai_state_lock:
                ai_state["total_guests"] = total_guests
                ai_state["active_tables"] = busy_tables
                ai_state["active_zones"] = active_zones  # <-- LIST các ID bàn có khách
                ai_state["occupancy_rate"] = occupancy_rate
                ai_state["avg_dwell_time"] = avg_dwell
                ai_state["table_details"] = table_details
                ai_state["alerts"] = alerts
                ai_state["logs"] = activity_logs
                ai_state["last_updated"] = datetime.now().isoformat()
                ai_state["fps"] = round(fps, 1)
                ai_state["frame_count"] = frame_count
                ai_state["detections"] = detections
            
            # Encode frame to JPEG for streaming
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            with current_frame_lock:
                current_frame_bytes = buffer.tobytes()
                
        except Exception as e:
            print(f"[AI Thread] Detection error: {e}")
        
        # Control frame rate (~15 FPS)
        time.sleep(0.066)
    
    cap.release()
    ai_state["camera_status"] = "stopped"
    print("[AI Thread] Stopped")


def generate_video_frames():
    """Generator function for MJPEG streaming"""
    global current_frame_bytes
    
    while True:
        with current_frame_lock:
            if current_frame_bytes is not None:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + current_frame_bytes + b'\r\n')
        time.sleep(0.033)  # ~30 FPS max


@app.on_event("startup")
async def startup_event():
    """Start AI camera thread on server startup"""
    global ai_thread, ai_running
    
    if AI_AVAILABLE:
        print("[Startup] Starting AI Camera Simulator thread...")
        ai_running = True
        ai_thread = threading.Thread(target=ai_camera_thread, daemon=True)
        ai_thread.start()
        print("[Startup] AI Camera thread started")
    else:
        print("[Startup] AI Camera disabled (dependencies not available)")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop AI camera thread on server shutdown"""
    global ai_running
    
    print("[Shutdown] Stopping AI Camera thread...")
    ai_running = False
    if ai_thread:
        ai_thread.join(timeout=2)
    print("[Shutdown] AI Camera thread stopped")


@app.get("/video_feed")
async def video_feed():
    """
    MJPEG video stream endpoint.
    Usage in HTML: <img src="http://localhost:8000/video_feed" />
    """
    if not AI_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI Camera not available")
    
    if ai_state["camera_status"] != "active":
        raise HTTPException(status_code=503, detail=f"Camera status: {ai_state['camera_status']}")
    
    return StreamingResponse(
        generate_video_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/api/ai-camera/status")
async def get_ai_camera_status():
    """
    HIGH-FREQUENCY API: Returns cached AI state from RAM.
    Designed for 5-10 calls/second with < 1ms response time.
    No database queries - pure memory read.
    """
    # Thread-safe read of cached state
    with ai_state_lock:
        cached_state = ai_state.copy()  # Shallow copy for thread safety
    
    return {
        "success": True,
        "data": cached_state,
        "ai_available": AI_AVAILABLE
    }


@app.get("/api/ai-camera/fast")
async def get_ai_camera_fast():
    """
    ULTRA-FAST API: Returns only essential data for real-time UI updates.
    Optimized for 10+ calls/second with minimal payload.
    Use this for high-frequency polling of guest counts and table status.
    """
    with ai_state_lock:
        return {
            "guests": ai_state["total_guests"],
            "tables": ai_state["active_zones"],  # List of active table IDs
            "active": ai_state["active_tables"],
            "rate": ai_state["occupancy_rate"],
            "status": ai_state["camera_status"],
            "ts": ai_state["last_updated"]
        }


@app.post("/api/ai-camera/toggle")
async def toggle_ai_camera():
    """
    Toggle AI camera on/off.
    """
    global ai_running, ai_thread
    
    if not AI_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI Camera not available")
    
    if ai_running:
        # Stop the camera
        ai_running = False
        if ai_thread:
            ai_thread.join(timeout=2)
        return {"success": True, "message": "AI Camera stopped", "status": "stopped"}
    else:
        # Start the camera
        ai_running = True
        ai_thread = threading.Thread(target=ai_camera_thread, daemon=True)
        ai_thread.start()
        return {"success": True, "message": "AI Camera started", "status": "starting"}


# ============================================
# API DASHBOARD - HYBRID DATA ENDPOINT
# Real-time AI Data + Mock Analytics for Charts
# ============================================

@app.get("/api/dashboard")
async def get_dashboard_data():
    """
    HYBRID DASHBOARD API:
    - realtime: Dữ liệu THẬT từ AI Camera (số khách, trạng thái bàn)
    - analytics: Dữ liệu GIẢ LẬP (Mock) để vẽ biểu đồ đẹp
    """
    try:
        # =============================================
        # 1. REALTIME DATA (THẬT - từ AI Detection)
        # =============================================
        current_guests = ai_state.get("total_guests", 0)
        active_zones = ai_state.get("active_zones", [])
        active_table_count = len(active_zones)
        
        # Fallback: nếu active_zones rỗng, tính từ table_details
        if not active_zones:
            table_details = ai_state.get("table_details", [])
            active_zones = [t.get("table_id", t.get("id", 0)) for t in table_details 
                           if t.get("occupied", False) or t.get("status") == "CO KHACH"]
            active_table_count = len(active_zones)
        
        realtime_data = {
            "total_guests": current_guests,           # <-- THẬT: Số khách từ AI
            "active_tables_count": active_table_count, # <-- THẬT: Số bàn có người
            "active_table_ids": active_zones,         # <-- THẬT: ID các bàn có người [0, 2, 5]
            "total_tables": 8,
            "camera_status": ai_state.get("camera_status", "inactive"),
            "fps": ai_state.get("fps", 0),
            "table_details": ai_state.get("table_details", []),
            "alerts": ai_state.get("alerts", [])[-10:],
            "activity_logs": ai_state.get("logs", [])[-20:],
            "last_updated": ai_state.get("last_updated", datetime.now().isoformat())
        }
        
        # =============================================
        # 2. ANALYTICS DATA (MOCK - Dữ liệu giả để vẽ chart)
        # =============================================
        mock_revenue_week = [
            {"day": "T2", "value": 12500000, "orders": 45},
            {"day": "T3", "value": 15200000, "orders": 52},
            {"day": "T4", "value": 9800000, "orders": 38},
            {"day": "T5", "value": 18500000, "orders": 67},
            {"day": "T6", "value": 26000000, "orders": 89},
            {"day": "T7", "value": 35000000, "orders": 124},
            {"day": "CN", "value": 31000000, "orders": 108},
        ]
        
        mock_peak_hours = [
            {"hour": "10:00", "guests": 5},
            {"hour": "11:00", "guests": 18},
            {"hour": "12:00", "guests": 45},  # Giờ cao điểm trưa
            {"hour": "13:00", "guests": 32},
            {"hour": "14:00", "guests": 15},
            {"hour": "15:00", "guests": 8},
            {"hour": "16:00", "guests": 12},
            {"hour": "17:00", "guests": 22},
            {"hour": "18:00", "guests": 35},
            {"hour": "19:00", "guests": 52},  # Giờ cao điểm tối
            {"hour": "20:00", "guests": 60},  # Peak
            {"hour": "21:00", "guests": 48},
            {"hour": "22:00", "guests": 25},
        ]
        
        # Thêm biến động nhỏ để trông tự nhiên hơn
        current_minute = datetime.now().minute
        variation = (current_minute % 10) / 10  # 0.0 - 0.9
        
        analytics_data = {
            "revenue_week": mock_revenue_week,
            "peak_hours": mock_peak_hours,
            "efficiency_score": 88 + int(variation * 5),  # 88-93
            "revenue_today": 15400000 + int(variation * 2000000),
            "avg_order_value": 285000,
            "customer_satisfaction": 4.6,
            "table_turnover_rate": 3.2,  # Số lần xoay bàn/ngày
            "peak_hour_today": "20:00",
            "busiest_day": "Thứ 7",
            "total_orders_today": 54 + int(variation * 10),
        }
        
        return {
            "success": True,
            "realtime": realtime_data,    # <-- DỮ LIỆU THẬT
            "analytics": analytics_data,   # <-- DỮ LIỆU MOCK
            "ai_available": AI_AVAILABLE,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"[Dashboard] Error: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "error": str(e),
            "realtime": {
                "total_guests": 0,
                "active_tables_count": 0,
                "active_table_ids": [],
                "camera_status": "error"
            },
            "analytics": {
                "revenue_week": [],
                "peak_hours": [],
                "efficiency_score": 0,
                "revenue_today": 0
            }
        }


# --- Chạy Server ---
if __name__ == "__main__":
    import uvicorn
    print("[Server] Running at http://127.0.0.1:8001")
    print("[Server] Video feed available at http://127.0.0.1:8001/video_feed")
    uvicorn.run(app, host="127.0.0.1", port=8000)