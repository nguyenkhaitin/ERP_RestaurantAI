import random
from datetime import datetime, date, timedelta
from db_models import SessionLocal, HourlyHeatmap, DailyKPI, AlertsLog


def seed_tiny_data():
    session = SessionLocal()
    print("🧹 RESET TOÀN BỘ DỮ LIỆU...")
    session.query(HourlyHeatmap).delete()
    session.query(DailyKPI).delete()
    session.query(AlertsLog).delete()
    session.commit()

    today = date.today()

    # 1) Seed past 6 days (T2-T7)
    print("📅 Tạo dữ liệu cho 6 ngày trước (T2-T7)...")
    for offset in range(1, 7):
        past_date = today - timedelta(days=offset)
        # offset==1 => yesterday (T7) -> higher traffic
        if offset == 1:
            total = random.randint(80, 100)
        else:
            total = random.randint(40, 60)

        session.add(DailyKPI(
            date=past_date,
            total_guests=total,
            occupancy_rate=random.randint(20, 60),
            avg_dwell_seconds=random.randint(900, 1800),
            peak_hour=random.randint(11, 20)
        ))
        print(f"   -> Ngày {past_date}: {total} khách")

    # 2) Seed today's morning (9-11) totals ~50-60 and HourlyHeatmap rows
    print("🌅 Tạo dữ liệu sáng hôm nay (9-11h): mục tiêu tổng 50-60 khách...")
    target_min = 50
    target_max = 60
    morning_entries = []
    morning_hour_totals = {9: 0, 10: 0, 11: 0}

    attempts = 0
    while attempts < 60:
        attempts += 1
        morning_entries = []
        for hour in (9, 10, 11):
            tables = random.sample(range(1, 9), k=random.randint(3, 6))
            hour_total = 0
            for t in tables:
                g = random.randint(1, 5)
                hour_total += g
                morning_entries.append((today, hour, t, g))
            morning_hour_totals[hour] = hour_total

        total_today = sum(morning_hour_totals.values())
        if target_min <= total_today <= target_max:
            break

    # Insert HourlyHeatmap rows for today (9-11)
    for date_val, hour_val, table_id, guests in morning_entries:
        session.add(HourlyHeatmap(date=date_val, hour=hour_val, table_id=table_id, guests=guests, occupied_count=1))

    morning_total = sum(morning_hour_totals.values())
    session.add(DailyKPI(
        date=today,
        total_guests=morning_total,
        occupancy_rate=random.randint(30, 60),
        avg_dwell_seconds=random.randint(900, 1800),
        peak_hour=11
    ))

    # Small demo log
    if morning_entries:
        t_first = morning_entries[0][2]
        session.add(AlertsLog(created_at=datetime.now().replace(hour=9, minute=5), table_id=t_first, alert_type="INFO", details={"msg": f"Bàn {t_first}: Khách vào"}))

    session.commit()
    session.close()
    print("------------------------------------------------")
    print(f"✅ ĐÃ XONG! Tổng khách sáng nay (DB): {morning_total} người. (9h-11h)")


if __name__ == "__main__":
    seed_tiny_data()