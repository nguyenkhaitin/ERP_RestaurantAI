import cv2
import numpy as np
from ultralytics import YOLO
import threading
import time
from collections import deque
import math
import os
import requests
import datetime
from db_models import init_db, SessionLocal, DailyKPI, HourlyHeatmap, AlertsLog
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func

# --- CẤU HÌNH ---
# Có thể cấu hình qua biến môi trường
VIDEO_PATH = os.getenv('VIDEO_PATH', 'video.mp4')
MODEL_PATH = os.getenv('MODEL_PATH', 'yolov8l.pt')
BACKEND_URL = os.getenv('BACKEND_URL', ' http://localhost:8000')

def send_payload(payload: dict):
    try:
        requests.post(f"{BACKEND_URL}/api/ai/update", json=payload, timeout=5)
    except Exception as e:
        print("⚠️ Không gửi được dữ liệu tới backend:", e)

# --- CẤU HÌNH DỊCH CHUYỂN VỊ TRÍ CHỮ (X, Y) ---
TEXT_OFFSETS = {
    0: (-60, -60), 1: (0, -40), 4: (0, 80)
}

# --- CẤU HÌNH ĐIỂM CHECK ĐA ĐIỂM (MULTI-POINT) ---
CHECK_POINT_CONFIG = {
    0: [0.75], # B1: Gối
    1: [0.20, 0.45, 0.60], # B2: Đa điểm (Cổ, Ngực, Bụng)
    5: [0.20, 0.40], # B6
    'default': [0.75]
}

# --- CẤU HÌNH ĐỘ NHỚ ID (TTL - TIME TO LIVE) ---
# [QUAN TRỌNG NHẤT V31]
# Đây là thời gian hệ thống vẫn "nhớ" khách dù bị che khuất
TABLE_TTL_CONFIG = {
    1: 10.0,  # B2: Nhớ dai 10s (Vì hay bị che, ngồi chen chúc)
    4: 8.0,   # B5: Nhớ 8s
    'default': 0.5 # B1 và các bàn khác: Nhớ cực ngắn (0.5s) để tránh đếm người đi ngang
}

# --- SỐ LƯỢNG GHẾ ---
TABLE_CAPACITIES = [4, 12, 4, 4, 12, 6, 6, 4]

# --- NGƯỠNG TỐC ĐỘ ---
WALKING_THRESHOLD = 2.5 
STRICT_TABLES = [1, 4, 5, 6, 7] 

# --- DỮ LIỆU GIẢ LẬP POS ---
SIMULATED_POS_DATA = {
    0: 'OPEN', 1: 'OPEN', 2: 'CLOSED', 3: 'CLOSED',
    4: 'OPEN', 5: 'CLOSED', 6: 'CLOSED', 7: 'CLOSED'
}

# --- TỌA ĐỘ BÀN ---
table_polygons = [
    # Index 0: B1
    np.array([[494, 381], [551, 443], [549, 565], [458, 643], [413, 684], [318, 708], [191, 634], [136, 481], [144, 439], [441, 315]]),
    # Index 1: B2
    np.array([[832, 331], [644, 419], [518, 524], [499, 660], [503, 777], [613, 841], [749, 920], [835, 968], [1242, 489], [1197, 305], [980, 253]]),
    # Index 2: B3
    np.array([[206, 698], [377, 856], [322, 1075], [10, 1070], [5, 789]]),
    # Index 3: B4
    np.array([[89, 486], [1, 508], [5, 779], [167, 698]]),
    # Index 4: B5
    np.array([[1578, 408], [1626, 474], [1459, 996], [1168, 932], [1073, 829], [1130, 658], [1378, 365]]),
    # Index 5: B6
    np.array([[551, 276], [773, 183], [835, 297], [663, 402], [573, 380]]),
    # Index 6: B7
    np.array([[1159, 156], [1025, 266], [1040, 311], [1288, 354], [1340, 197]]) ,
    # Index 7: B8
    np.array([[1450, 360], [1638, 415], [1655, 291], [1485, 243]])
]

# --- VARIABLES ---
current_frame = None       
processed_data = None      
is_running = True          
lock = threading.Lock()
dashboard_data = {'occupancy_rate': 0, 'total_guests': 0, 'avg_dwell_time': 0, 'table_details': [], 'alerts': []}

class TableManager:
    def __init__(self, table_id, max_capacity):
        self.id = table_id
        self.max_capacity = max_capacity
        self.status = "TRONG" 
        self.occupied_start_time = None
        self.dwell_time = 0
        
        # --- CẤU TRÚC ID BUFFER (THEO ĐỀ XUẤT) ---
        self.active_ids = {} # {track_id: last_seen_time}
        self.current_headcount = 0
        
        # Lấy TTL riêng cho từng bàn
        self.id_ttl = TABLE_TTL_CONFIG.get(self.id, TABLE_TTL_CONFIG['default'])
        
        # Logic Time
        self.entry_start_check = None

    def update(self, current_frame_ids):
        """
        current_frame_ids: List các track_id xuất hiện trong polygon ở frame này
        """
        now = time.time()
        
        # 1. Cập nhật thời gian cho các ID đang nhìn thấy (Keep Alive)
        for tid in current_frame_ids:
            self.active_ids[tid] = now
            
        # 2. Dọn dẹp ID quá hạn (TTL Cleanup)
        # B1 sẽ bị xóa sau 0.5s (ngay lập tức)
        # B2 sẽ được giữ lại 10s (chống tụt số)
        self.active_ids = {
            tid: t for tid, t in self.active_ids.items()
            if now - t <= self.id_ttl
        }
        
        # 3. Tính toán số lượng
        raw_count = len(self.active_ids)
        
        # 4. Occlusion Bonus (Chỉ áp dụng B2, B5 khi đã đông)
        final_count = raw_count
        if self.id in [1, 4]:
            if raw_count >= 4: final_count += 1
            if raw_count >= 8: final_count += 1
            
        self.current_headcount = min(final_count, self.max_capacity + 2)
        has_people = self.current_headcount > 0

        # --- LOGIC TRẠNG THÁI (STATUS LOGIC) ---
        
        if self.status == "TRONG":
            if has_people:
                if self.entry_start_check is None: 
                    self.entry_start_check = now
                
                duration = now - self.entry_start_check
                # Rule vào bàn
                req_time = 5.0
                if self.max_capacity >= 10:
                    if self.current_headcount < 2: req_time = 20.0
                    else: req_time = 5.0
                
                if duration > req_time:
                    self.status = "CO KHACH"
                    self.occupied_start_time = now
            else:
                self.entry_start_check = None
        
        elif self.status == "CO KHACH":
            if self.occupied_start_time:
                self.dwell_time = int(now - self.occupied_start_time)
            
            # Chỉ Reset khi danh sách ID sạch bóng
            if self.current_headcount == 0:
                self.status = "TRONG"
                self.occupied_start_time = None
                self.dwell_time = 0
                self.entry_start_check = None

    def get_info(self):
        mins, secs = divmod(self.dwell_time, 60)
        time_str = f"{mins:02d}:{secs:02d}"
        pos_status = SIMULATED_POS_DATA.get(self.id, 'CLOSED')
        
        alert_type = "NONE"
        if self.status == "CO KHACH" and pos_status == "CLOSED": alert_type = "KHACH AO"
        elif self.status == "TRONG" and pos_status == "OPEN": alert_type = "QUEN DONG"
        if mins > 60: alert_type = "NGOI LAU"
        
        return {
            'id': self.id + 1, 'status': self.status, 'time_str': time_str, 
            'seconds': self.dwell_time, 
            'headcount': self.current_headcount, 'capacity': self.max_capacity, 'alert': alert_type
        }

def ai_worker():
    global processed_data, is_running, dashboard_data
    print("🚀 AI Started (V31: Dynamic ID Buffer)")
    # Ensure KPI tables exist
    try:
        init_db()
    except Exception as e:
        print("⚠️ Không thể khởi tạo bảng KPI:", e)
    table_managers = [TableManager(i, TABLE_CAPACITIES[i]) for i in range(len(table_polygons))]
    model = YOLO(MODEL_PATH) 
    
    track_pos_history = {} 

    while is_running:
        if current_frame is None: time.sleep(0.01); continue
        
        with lock: frame_to_process = current_frame.copy()
        
        target_w, target_h = 960, 540 
        scale_w = 1920 / target_w
        scale_h = 1080 / target_h
        frame_small = cv2.resize(frame_to_process, (target_w, target_h))
        
        # Dùng ByteTrack (Nhẹ, chuẩn cho bài toán này nếu đã có ID Buffer)
        results = model.track(frame_small, persist=True, verbose=False, classes=[0], 
                              conf=0.20, iou=0.65, tracker="bytetrack.yaml")
        
        temp_boxes = []
        # Map: Table Index -> List of IDs in this frame
        frame_guests_map = {i: [] for i in range(len(table_polygons))}
        
        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
            track_ids = results[0].boxes.id.cpu().numpy().astype(int)

            for box, track_id in zip(boxes, track_ids):
                x1, y1 = int(box[0] * scale_w), int(box[1] * scale_h)
                x2, y2 = int(box[2] * scale_w), int(box[3] * scale_h)
                
                center_x, center_y = int((x1+x2)/2), int((y1+y2)/2)
                
                # Tính vận tốc để lọc nhiễu
                speed = 0
                if track_id in track_pos_history:
                    prev_x, prev_y = track_pos_history[track_id]
                    speed = math.sqrt((center_x - prev_x)**2 + (center_y - prev_y)**2)
                track_pos_history[track_id] = (center_x, center_y)

                in_table = False
                for i, poly in enumerate(table_polygons):
                    # 1. Velocity Filter
                    if i in STRICT_TABLES and speed > WALKING_THRESHOLD:
                        continue 

                    # 2. Multi-point check (Cực quan trọng cho B2)
                    check_ratios = CHECK_POINT_CONFIG.get(i, CHECK_POINT_CONFIG['default'])
                    is_inside = False
                    for ratio in check_ratios:
                        check_y = int(y1 + (y2 - y1) * ratio)
                        check_point = (int((x1+x2)/2), check_y)
                        if cv2.pointPolygonTest(poly, check_point, False) >= 0:
                            is_inside = True
                            break 
                    
                    if is_inside:
                        frame_guests_map[i].append(track_id)
                        in_table = True
                        break 
                
                if in_table:
                    color = (0, 255, 255)
                elif speed > WALKING_THRESHOLD:
                    color = (50, 50, 50) 
                else:
                    color = (100, 100, 100)
                temp_boxes.append((x1, y1, x2, y2, color)) 
                
        busy_tables, total_dwell_time, table_details, active_alerts = 0, 0, [], []
        temp_visuals = []
        
        # Cập nhật Manager
        total_guests_managed = 0
        for i, poly in enumerate(table_polygons):
            manager = table_managers[i]
            # Đẩy list ID vào manager để xử lý buffer
            manager.update(frame_guests_map[i])
            
            info = manager.get_info()
            table_details.append(info)
            total_guests_managed += info['headcount']
            
            if info['status'] == "CO KHACH":
                busy_tables += 1
                total_dwell_time += info['seconds']
                poly_color = (0, 0, 200) 
                if info['alert'] == "KHACH AO": poly_color = (0, 0, 139) 
            else:
                poly_color = (0, 200, 0)
                if info['alert'] == "QUEN DONG": poly_color = (0, 215, 255)
            
            label = f"B{info['id']}"
            if info['status'] == "CO KHACH": 
                label += f"({info['headcount']}/{info['capacity']})"
            
            cx, cy = int(np.mean(poly[:,0])), int(np.mean(poly[:,1]))
            offset_x, offset_y = TEXT_OFFSETS.get(i, (0, 0))
            final_cx = cx + offset_x
            final_cy = cy + offset_y

            temp_visuals.append((poly, poly_color, label, (final_cx, final_cy)))
            
            if info['alert'] == "KHACH AO": active_alerts.append(f"B{info['id']}: KHACH AO")
            if info['alert'] == "QUEN DONG": active_alerts.append(f"B{info['id']}: QUEN DONG POS")
            if info['alert'] == "NGOI LAU": active_alerts.append(f"B{info['id']}: >60 phut")

        occupancy_rate = int((busy_tables / len(table_polygons)) * 100)
        avg_dwell = int(total_dwell_time / busy_tables // 60) if busy_tables > 0 else 0
        
        dashboard_data = {'occupancy_rate': occupancy_rate, 'total_guests': total_guests_managed, 'avg_dwell_time': avg_dwell, 'table_details': table_details, 'alerts': active_alerts}
        processed_data = {'boxes': temp_boxes, 'visuals': temp_visuals}

        # Persist aggregates and alerts into DB (non-blocking)
        try:
            ts = datetime.datetime.now()
            threading.Thread(target=lambda td=table_details, tts=ts: persist_metrics(td, tts), daemon=True).start()
        except Exception as e:
            print("⚠️ Lỗi khi spawn persist thread:", e)

        # Gửi phiếu dữ liệu đến backend (không chặn luồng AI)
        try:
            payload = {"data": []}
            for t in table_details:
                payload["data"].append({
                    "table_id": int(t['id']),
                    "headcount": int(t['headcount']),
                    "status": t['status'],
                    "dwell_time": int(t['seconds']),
                    "alert_type": t['alert']
                })
            threading.Thread(target=lambda p=payload: send_payload(p), daemon=True).start()
        except Exception as e:
            print("⚠️ Lỗi khi chuẩn bị gửi payload:", e)

def create_combined_dashboard(video_frame, data):
    display_h = 576
    display_w = 1024
    video_resized = cv2.resize(video_frame, (display_w, display_h))
    
    sidebar_w = 320
    sidebar = np.zeros((display_h, sidebar_w, 3), dtype=np.uint8)
    sidebar[:] = (30, 30, 30) 

    cv2.putText(sidebar, "HE THONG GIAM SAT", (15, 35), cv2.FONT_HERSHEY_DUPLEX, 0.7, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.line(sidebar, (15, 45), (sidebar_w - 15, 45), (100, 100, 100), 1)

    cv2.putText(sidebar, "Ty Le Lap Day", (15, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)
    occ_color = (0, 255, 100) if data['occupancy_rate'] < 70 else (0, 100, 255)
    cv2.putText(sidebar, f"{data['occupancy_rate']}%", (200, 80), cv2.FONT_HERSHEY_DUPLEX, 0.75, occ_color, 1, cv2.LINE_AA)

    cv2.putText(sidebar, "Tong Khach", (15, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)
    cv2.putText(sidebar, f"{data['total_guests']}", (200, 115), cv2.FONT_HERSHEY_DUPLEX, 0.75, (255, 100, 255), 1, cv2.LINE_AA)
    
    cv2.putText(sidebar, "TG Trung Binh", (15, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1, cv2.LINE_AA)
    cv2.putText(sidebar, f"{data['avg_dwell_time']}m", (200, 150), cv2.FONT_HERSHEY_DUPLEX, 0.75, (0, 255, 255), 1, cv2.LINE_AA)

    cv2.line(sidebar, (15, 175), (sidebar_w - 15, 175), (80, 80, 80), 1)

    y_start = 210
    cv2.putText(sidebar, "BAN", (10, y_start), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1, cv2.LINE_AA)
    cv2.putText(sidebar, "TT", (50, y_start), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1, cv2.LINE_AA)
    cv2.putText(sidebar, "KHACH", (160, y_start), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1, cv2.LINE_AA)
    cv2.putText(sidebar, "TIME", (240, y_start), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (150, 150, 150), 1, cv2.LINE_AA)
    
    for i, t in enumerate(data['table_details']):
        y = y_start + 30 + (i * 30) 
        cv2.putText(sidebar, f"B{t['id']}", (10, y), cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
        
        if t['status'] == "TRONG":
            st_col = (100, 255, 100); st_txt = "TRONG"
        else:
            st_col = (100, 100, 255); st_txt = "KHACH"
        cv2.putText(sidebar, st_txt, (50, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, st_col, 1, cv2.LINE_AA)
        
        if t['status'] == "CO KHACH":
            hc_txt = f"{t['headcount']}/{t['capacity']}"
            col_hc = (0, 0, 255) if t['headcount'] > t['capacity'] else (255, 255, 255)
        else:
            hc_txt = f"-/{t['capacity']}"
            col_hc = (100, 100, 100)
        cv2.putText(sidebar, hc_txt, (165, y), cv2.FONT_HERSHEY_DUPLEX, 0.55, col_hc, 1, cv2.LINE_AA)
        
        cv2.putText(sidebar, t['time_str'], (240, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
        
        if t['alert'] != "NONE":
            cv2.circle(sidebar, (300, y-5), 5, (0, 0, 255), -1)

    if data['alerts']:
        alert_bg_h = 100
        cv2.rectangle(sidebar, (0, display_h - alert_bg_h), (sidebar_w, display_h), (0, 0, 60), -1)
        cv2.putText(sidebar, "CANH BAO", (15, display_h - alert_bg_h + 20), cv2.FONT_HERSHEY_DUPLEX, 0.6, (0, 165, 255), 1, cv2.LINE_AA)
        for i, alert in enumerate(data['alerts'][:3]):
            cv2.putText(sidebar, f"> {alert}", (15, display_h - alert_bg_h + 45 + (i*20)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

    final_view = np.hstack((video_resized, sidebar))
    return final_view


def persist_metrics(table_details, timestamp):
    """Update HourlyHeatmap, AlertsLog and DailyKPI based on current table_details."""
    sess = SessionLocal()
    try:
        date = timestamp.date()
        hour = timestamp.hour

        # Update hourly heatmap per table
        for t in table_details:
            table_id = int(t['id'])
            guests = int(t['headcount'])
            occupied = 1 if t['status'] == 'CO KHACH' else 0

            try:
                row = sess.query(HourlyHeatmap).filter_by(date=date, hour=hour, table_id=table_id).with_for_update(nowait=False).first()
            except SQLAlchemyError:
                row = None

            if row is None:
                row = HourlyHeatmap(date=date, hour=hour, table_id=table_id, guests=guests, occupied_count=occupied)
                sess.add(row)
            else:
                row.guests = (row.guests or 0) + guests
                row.occupied_count = (row.occupied_count or 0) + occupied

            # Insert alert row if any
            if t.get('alert') and t.get('alert') != 'NONE':
                alert = AlertsLog(created_at=timestamp, table_id=table_id, alert_type=t.get('alert'), details={"headcount": guests})
                sess.add(alert)

        sess.commit()

        # Recompute daily KPI from hourly table for this date
        # total_guests = sum(guests)
        total_guests = sess.query(func.coalesce(func.sum(HourlyHeatmap.guests), 0)).filter(HourlyHeatmap.date == date).scalar() or 0

        # occupancy_rate: percentage of occupied samples across available cells
        total_occupied = sess.query(func.coalesce(func.sum(HourlyHeatmap.occupied_count), 0)).filter(HourlyHeatmap.date == date).scalar() or 0
        # number of hour-table cells present
        cells = sess.query(func.count(HourlyHeatmap.id)).filter(HourlyHeatmap.date == date).scalar() or 1
        # approximate occupancy percent
        occupancy_rate = int((total_occupied / (cells * 1.0)) * 100) if cells > 0 else 0

        # avg dwell seconds: approximate from most recent samples of table_details
        dwell_times = [int(t.get('seconds', 0)) for t in table_details if t.get('status') == 'CO KHACH']
        avg_dwell = int(sum(dwell_times) / len(dwell_times)) if dwell_times else 0

        # compute peak_hour by summing guests grouped by hour
        from sqlalchemy import func as _func
        peak_row = sess.query(HourlyHeatmap.hour, _func.coalesce(_func.sum(HourlyHeatmap.guests), 0).label('g'))\
                      .filter(HourlyHeatmap.date == date)\
                      .group_by(HourlyHeatmap.hour)\
                      .order_by(_func.sum(HourlyHeatmap.guests).desc()).first()
        peak_hour = peak_row[0] if peak_row else hour

        # Upsert daily kpi
        dk = sess.query(DailyKPI).filter_by(date=date).first()
        if dk is None:
            dk = DailyKPI(date=date, total_guests=total_guests, occupancy_rate=occupancy_rate, avg_dwell_seconds=avg_dwell, peak_hour=peak_hour)
            sess.add(dk)
        else:
            dk.total_guests = total_guests
            dk.occupancy_rate = occupancy_rate
            dk.avg_dwell_seconds = avg_dwell
            dk.peak_hour = peak_hour

        sess.commit()
    except Exception as e:
        print("⚠️ Lỗi khi persist metrics:", e)
        try:
            sess.rollback()
        except Exception:
            pass
    finally:
        sess.close()

def main():
    global current_frame, is_running
    print(f"📂 Loading video: {VIDEO_PATH}")
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened(): return
    ai_thread = threading.Thread(target=ai_worker); ai_thread.daemon = True; ai_thread.start()
    print("✅ System Ready! (V31: Dynamic ID Buffer)")
    
    while cap.isOpened():
        start_time = time.time()
        ret, frame = cap.read()
        if not ret: cap.set(cv2.CAP_PROP_POS_FRAMES, 0); continue
        
        with lock: current_frame = frame.copy()
        
        if processed_data:
            display_frame = frame.copy()
            for poly, color, label, center in processed_data['visuals']:
                cv2.polylines(display_frame, [poly], True, color, 2, cv2.LINE_AA)
                cv2.putText(display_frame, label, (center[0]-20, center[1]), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2, cv2.LINE_AA)
            for x1, y1, x2, y2, color in processed_data['boxes']: 
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 1)

            final_ui = create_combined_dashboard(display_frame, dashboard_data)
        else: 
            loading_screen = np.zeros((576, 1024 + 320, 3), dtype=np.uint8)
            cv2.putText(loading_screen, "Dang khoi tao AI...", (550, 280), cv2.FONT_HERSHEY_DUPLEX, 1.2, (0, 255, 255), 2)
            final_ui = loading_screen
            
        cv2.imshow("Smart Restaurant Manager (V31)", final_ui)
        
        elapsed = time.time() - start_time
        if cv2.waitKey(max(1, int((1/30 - elapsed) * 1000))) & 0xFF == ord('q'): is_running = False; break
    cap.release(); cv2.destroyAllWindows()

if __name__ == "__main__": main()