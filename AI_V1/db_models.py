from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Date, JSON
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import func
import datetime

# --- CẤU HÌNH KẾT NỐI (SỬA PASSWORD NẾU CẦN) ---
DB_URL = "postgresql://postgres:Haiphu2412_@localhost:5432/restaurant_db"

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 1. Bảng Heatmap (Lưu số khách theo từng giờ - Dùng cho biểu đồ nhiệt & AI update)
class HourlyHeatmap(Base):
    __tablename__ = "hourly_heatmap"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)      # Ngày
    hour = Column(Integer)               # Giờ (0-23)
    table_id = Column(Integer)           # Bàn số mấy
    guests = Column(Integer, default=0)  # Số khách
    occupied_count = Column(Integer, default=0) # Biến đếm phụ để tính tỷ lệ

# 2. Bảng KPI (Lưu tổng hợp ngày - Dùng cho biểu đồ tuần)
class DailyKPI(Base):
    __tablename__ = "daily_kpis"
    date = Column(Date, primary_key=True)
    total_guests = Column(Integer, default=0)
    occupancy_rate = Column(Float, default=0.0)
    avg_dwell_seconds = Column(Float, default=0.0)
    peak_hour = Column(Integer, default=12)

# 3. Bảng Cảnh báo (Lưu lịch sử cảnh báo)
class AlertsLog(Base):
    __tablename__ = "alerts_log"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.now)
    table_id = Column(Integer)
    alert_type = Column(String) # "NGOI LAU", "KHACH AO"...
    details = Column(JSON)

# Hàm khởi tạo Database
def init_db():
    Base.metadata.create_all(bind=engine)