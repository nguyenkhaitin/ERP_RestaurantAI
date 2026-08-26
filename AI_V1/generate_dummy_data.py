"""
Script to generate dummy `table_logs` data for the demo dashboard.

Usage:
  python generate_dummy_data.py --date 2025-12-31 --interval 5

It reads `DATABASE_URL` from the environment (falls back to the same default
used by `backend.py`). The script inserts rows for 8 tables across the given
date range at the specified minute interval.
"""
import os
import random
import argparse
import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- Config / Model (kept compatible with backend.py) ---
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:Haiphu2412_@localhost:5432/restaurant_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TableLogDB(Base):
    __tablename__ = "table_logs"
    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer)
    headcount = Column(Integer)
    status = Column(String)
    dwell_time = Column(Integer)
    alert_type = Column(String)
    created_at = Column(DateTime, server_default=func.now())

Base.metadata.create_all(bind=engine)

# Table capacities (same as processor.py)
TABLE_CAPACITIES = [4, 12, 4, 4, 12, 6, 6, 4]

def rand_status_and_values(table_idx, occupancy_multiplier=1.0):
    cap = TABLE_CAPACITIES[table_idx]
    # Base probability of occupied depends on table size
    base_prob = 0.35 if cap <= 4 else 0.55
    prob_occupied = min(1.0, base_prob * occupancy_multiplier)
    if random.random() < prob_occupied:
        status = "CO KHACH"
        # headcount between 1 and cap + sometimes overflow
        headcount = random.randint(1, min(cap + 2, max(1, cap + 1)))
        # dwell time scaled a bit by multiplier
        dwell_time = int(random.randint(60, 7200) * (0.8 + 0.4 * occupancy_multiplier))
    else:
        status = "TRONG"
        headcount = 0
        dwell_time = 0

    alert_type = "NONE"
    if dwell_time > 3600:
        alert_type = "NGOI LAU"
    else:
        # small chance of artificial alerts
        r = random.random()
        if r < 0.03 * occupancy_multiplier:
            alert_type = "KHACH AO"
        elif r < 0.06 * occupancy_multiplier:
            alert_type = "QUEN DONG"

    return status, headcount, dwell_time, alert_type

def generate_for_range(start_dt, end_dt, interval_minutes, peak_hour=12, peak_width_hours=3.0):
    sess = SessionLocal()
    try:
        cur = start_dt
        rows = []
        while cur < end_dt:
            ts = cur
            # compute occupancy multiplier based on time of day (Gaussian around peak_hour)
            tod = ts.time()
            seconds_since_midnight = tod.hour * 3600 + tod.minute * 60 + tod.second
            hour = seconds_since_midnight / 3600.0
            # Gaussian multiplier: peak at peak_hour, width controls spread
            sigma = peak_width_hours / 2.0
            occupancy_multiplier = 1.0 + 1.5 * math.exp(-0.5 * ((hour - peak_hour) / sigma) ** 2)

            for table_idx in range(len(TABLE_CAPACITIES)):
                status, headcount, dwell_time, alert_type = rand_status_and_values(table_idx, occupancy_multiplier)
                row = TableLogDB(
                    table_id=table_idx + 1,  # use 1-based table ids like backend
                    headcount=headcount,
                    status=status,
                    dwell_time=dwell_time,
                    alert_type=alert_type,
                    created_at=ts,
                )
                rows.append(row)

            # bulk insert per 500 rows
            if len(rows) >= 500:
                sess.bulk_save_objects(rows)
                sess.commit()
                rows = []

            cur += datetime.timedelta(minutes=interval_minutes)

        if rows:
            sess.bulk_save_objects(rows)
            sess.commit()

        print("✅ Inserted dummy rows from", start_dt, "to", end_dt)
    finally:
        sess.close()

def parse_date(s):
    return datetime.datetime.strptime(s, "%Y-%m-%d")

def main():
    parser = argparse.ArgumentParser(description="Generate dummy table_logs data")
    parser.add_argument("--date", help="Start date (YYYY-MM-DD)", default=None)
    parser.add_argument("--days", type=int, default=1, help="How many days to generate")
    parser.add_argument("--interval", type=int, default=5, help="Minutes between samples")
    parser.add_argument("--peak-hour", type=float, default=12.0, help="Hour of day (0-23) that corresponds to video peak (e.g., 12)")
    parser.add_argument("--peak-width", type=float, default=3.0, help="Width in hours for peak spread (std dev factor)")
    args = parser.parse_args()

    if args.date:
        start_date = parse_date(args.date)
    else:
        # default to today
        start_date = datetime.datetime.combine(datetime.date.today(), datetime.time.min)

    start_dt = start_date
    end_dt = start_dt + datetime.timedelta(days=args.days)

    print(f"Starting generation: {start_dt} -> {end_dt} (every {args.interval} minutes) peak_hour={args.peak_hour}")
    import math
    generate_for_range(start_dt, end_dt, args.interval, peak_hour=args.peak_hour, peak_width_hours=args.peak_width)

if __name__ == "__main__":
    main()
