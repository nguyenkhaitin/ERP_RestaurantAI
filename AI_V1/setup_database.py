from sqlalchemy_utils import database_exists, create_database
from db_models import engine, init_db, DB_URL

def setup():
    print(f"🔌 Đang kết nối tới: {DB_URL}...")
    
    # 1. Tạo Database nếu chưa có
    if not database_exists(engine.url):
        create_database(engine.url)
        print("✅ Đã tạo mới Database 'restaurant_db'")
    else:
        print("ℹ️  Database 'restaurant_db' đã có sẵn.")

    # 2. Tạo các bảng (Tables)
    print("🔨 Đang xây dựng cấu trúc bảng...")
    init_db()
    print("✅ Đã tạo xong các bảng: hourly_heatmap, daily_kpis, alerts_log")
    print("🚀 SẴN SÀNG ĐỂ NẠP DỮ LIỆU MẪU!")

if __name__ == "__main__":
    setup()