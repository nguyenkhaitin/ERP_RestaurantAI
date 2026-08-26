"""
AI Chat Router - Text-to-SQL với OpenAI
Xử lý câu hỏi ngôn ngữ tự nhiên và trả về kết quả từ Database
"""

import os
import re
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI

# ==========================================
# CONFIGURATION
# ==========================================
router = APIRouter(prefix="/api/chat", tags=["AI Chat"])

# OpenAI Client - Truyền API key trực tiếp (chỉ dùng cho test)
client = OpenAI(api_key="")

# Database Schema cho AI (System Prompt)
DATABASE_SCHEMA = """
Bạn là một AI assistant thông minh giúp người dùng truy vấn dữ liệu nhà hàng.
Database PostgreSQL có các bảng sau:

1. chi_nhanh (Chi nhánh nhà hàng):
   - id: SERIAL PRIMARY KEY
   - ten_chi_nhanh: VARCHAR (tên chi nhánh)
   - dia_chi: VARCHAR (địa chỉ)
   - quan_ly_id: INTEGER (ID quản lý, FK -> nhan_vien.id)

2. nhan_vien (Nhân viên):
   - id: SERIAL PRIMARY KEY
   - ho_ten: VARCHAR (họ tên đầy đủ)
   - chuc_vu: VARCHAR (chức vụ: 'Quản lý', 'Phục vụ', 'Bếp', 'Thu ngân', 'Bảo vệ')
   - so_dien_thoai: VARCHAR (số điện thoại)
   - trang_thai: VARCHAR (trạng thái: 'Đang làm', 'Nghỉ phép', 'Đã nghỉ')
   - avatar: VARCHAR (2 ký tự viết tắt tên)
   - chi_nhanh_id: INTEGER (FK -> chi_nhanh.id)

3. cau_hinh_ca (Cấu hình ca làm việc):
   - id: SERIAL PRIMARY KEY
   - ten_ca: VARCHAR (tên ca: 'Ca sáng', 'Ca chiều', 'Ca tối')
   - gio_bat_dau: TIME (giờ bắt đầu ca)
   - gio_ket_thuc: TIME (giờ kết thúc ca)
   - so_luong_max: INTEGER (số lượng nhân viên tối đa mỗi ca)

4. lich_lam_viec (Lịch làm việc/Phân ca):
   - id: SERIAL PRIMARY KEY
   - nhan_vien_id: INTEGER (FK -> nhan_vien.id)
   - ca_lam_id: INTEGER (FK -> cau_hinh_ca.id)
   - ngay_lam: DATE (ngày làm việc)
   - chi_nhanh_id: INTEGER (FK -> chi_nhanh.id)

5. cham_cong (Chấm công):
   - id: SERIAL PRIMARY KEY
   - nhan_vien_id: INTEGER (FK -> nhan_vien.id)
   - ngay: DATE (ngày chấm công)
   - gio_vao: TIME (giờ check-in)
   - gio_ra: TIME (giờ check-out)
   - trang_thai_checkin: VARCHAR ('Đúng giờ', 'Trễ')

6. cau_hinh_luong (Cấu hình lương):
   - id: SERIAL PRIMARY KEY
   - role: VARCHAR (chức vụ áp dụng)
   - nhan_vien_id: INTEGER (NULL = áp dụng cho cả role, NOT NULL = cá nhân)
   - loai_luong: VARCHAR ('THEO_GIO', 'THEO_THANG')
   - muc_luong: DECIMAL (mức lương)

QUY TẮC QUAN TRỌNG:
1. CHỈ sinh câu lệnh SELECT. TUYỆT ĐỐI KHÔNG dùng DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE.
2. Trả lời bằng tiếng Việt, thân thiện và dễ hiểu.
3. Nếu cần thống kê, dùng COUNT(), SUM(), AVG(), GROUP BY.
4. Khi JOIN bảng, luôn dùng alias rõ ràng (nv, cn, ca, llv, cc, cl).
5. Format số tiền với dấu phẩy ngăn cách hàng nghìn.
6. Nếu câu hỏi không liên quan đến dữ liệu, trả lời lịch sự rằng bạn chỉ hỗ trợ truy vấn dữ liệu.
"""

# ==========================================
# PYDANTIC MODELS
# ==========================================
class ChatRequest(BaseModel):
    question: str
    branch_id: Optional[int] = None

class ChatResponse(BaseModel):
    success: bool
    answer: str
    sql_query: Optional[str] = None
    error: Optional[str] = None

# ==========================================
# DATABASE CONNECTION
# ==========================================
def get_db_connection():
    """Tạo kết nối đến PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="postgres",
            user="postgres",
            password="123",
            port="5433"
        )
        return conn
    except Exception as e:
        print(f"[DB ERROR] Lỗi kết nối Database: {e}")
        return None

# ==========================================
# SECURITY FUNCTIONS
# ==========================================
def is_safe_query(sql: str) -> bool:
    """
    Kiểm tra SQL có an toàn không (chỉ cho phép SELECT)
    Returns True nếu an toàn, False nếu nguy hiểm
    """
    # Normalize SQL
    sql_upper = sql.upper().strip()
    
    # Danh sách các lệnh nguy hiểm
    dangerous_keywords = [
        'DELETE', 'UPDATE', 'INSERT', 'DROP', 'ALTER', 
        'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXEC',
        'EXECUTE', 'MERGE', 'CALL', 'DO', 'COPY'
    ]
    
    # Kiểm tra SQL phải bắt đầu bằng SELECT hoặc WITH (cho CTE)
    if not (sql_upper.startswith('SELECT') or sql_upper.startswith('WITH')):
        return False
    
    # Kiểm tra không chứa các keyword nguy hiểm
    for keyword in dangerous_keywords:
        # Tìm keyword như một từ riêng biệt (không phải substring)
        pattern = r'\b' + keyword + r'\b'
        if re.search(pattern, sql_upper):
            return False
    
    # Kiểm tra không có comment chứa mã độc
    if '--' in sql or '/*' in sql:
        # Cho phép comment đơn giản nhưng kiểm tra kỹ
        sql_no_comments = re.sub(r'--.*$', '', sql, flags=re.MULTILINE)
        sql_no_comments = re.sub(r'/\*.*?\*/', '', sql_no_comments, flags=re.DOTALL)
        return is_safe_query(sql_no_comments)
    
    return True

def sanitize_sql(sql: str) -> str:
    """
    Làm sạch SQL query
    """
    # Loại bỏ whitespace thừa
    sql = ' '.join(sql.split())
    
    # Loại bỏ dấu ; ở cuối (tránh SQL injection qua chained queries)
    sql = sql.rstrip(';')
    
    return sql

# ==========================================
# OPENAI FUNCTIONS
# ==========================================
def generate_sql_from_question(question: str, branch_id: Optional[int] = None) -> dict:
    """
    Sử dụng OpenAI để sinh SQL từ câu hỏi
    Returns: { "sql": "SELECT ...", "explanation": "..." }
    """
    # Build context về branch nếu có
    branch_context = ""
    if branch_id:
        branch_context = f"\nNgười dùng đang xem dữ liệu của chi nhánh có ID = {branch_id}. Hãy filter theo chi_nhanh_id = {branch_id} khi phù hợp."
    
    messages = [
        {
            "role": "system",
            "content": DATABASE_SCHEMA + branch_context + """

KHI TRẢ LỜI, hãy trả về JSON với format:
{
    "sql": "câu lệnh SQL SELECT",
    "explanation": "giải thích ngắn gọn SQL làm gì"
}

Nếu câu hỏi KHÔNG liên quan đến truy vấn dữ liệu, trả về:
{
    "sql": null,
    "explanation": "Câu trả lời cho câu hỏi không liên quan đến dữ liệu"
}
"""
        },
        {
            "role": "user",
            "content": f"Câu hỏi: {question}"
        }
    ]
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Hoặc "gpt-3.5-turbo" nếu muốn tiết kiệm chi phí
            messages=messages,
            temperature=0.1,  # Low temperature cho output nhất quán
            max_tokens=500,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
        
    except Exception as e:
        error_str = str(e)
        print(f"[OPENAI ERROR] {error_str}")
        
        # Nếu hết quota, trả về mock response để test UI
        if "insufficient_quota" in error_str or "429" in error_str:
            print("[MOCK MODE] Using fallback SQL generation")
            q_lower = question.lower()
            
            # Chi nhánh
            if "chi nhánh" in q_lower or "chi nhanh" in q_lower or "branch" in q_lower:
                return {
                    "sql": "SELECT id, ten_chi_nhanh, dia_chi FROM chi_nhanh ORDER BY id",
                    "explanation": "Liệt kê danh sách chi nhánh"
                }
            
            # Ca làm việc
            elif "ca làm" in q_lower or "ca lam" in q_lower or "shift" in q_lower:
                return {
                    "sql": "SELECT id, ten_ca, gio_bat_dau, gio_ket_thuc, so_luong_max FROM cau_hinh_ca ORDER BY id",
                    "explanation": "Liệt kê các ca làm việc"
                }
            
            # Nhân viên đang làm
            elif "bao nhiêu nhân viên" in q_lower or "bao nhieu nhan vien" in q_lower or "tổng nhân viên" in q_lower:
                return {
                    "sql": "SELECT COUNT(*) as total FROM nhan_vien WHERE trang_thai = 'Đang làm'",
                    "explanation": "Đếm số lượng nhân viên đang làm việc"
                }
            
            # Liệt kê nhân viên
            elif "liệt kê nhân viên" in q_lower or "danh sách nhân viên" in q_lower or "nhan vien" in q_lower:
                return {
                    "sql": "SELECT id, ho_ten, chuc_vu, trang_thai, chi_nhanh_id FROM nhan_vien ORDER BY id",
                    "explanation": "Liệt kê danh sách nhân viên"
                }
            
            # Lương
            elif "lương" in q_lower or "luong" in q_lower or "salary" in q_lower:
                return {
                    "sql": "SELECT id, role, loai_luong, muc_luong FROM cau_hinh_luong ORDER BY muc_luong DESC",
                    "explanation": "Thông tin cấu hình lương"
                }
            
            # Chấm công
            elif "chấm công" in q_lower or "cham cong" in q_lower or "check-in" in q_lower or "attendance" in q_lower:
                return {
                    "sql": "SELECT nhan_vien_id, ngay, gio_vao, gio_ra, trang_thai_checkin FROM cham_cong WHERE ngay = CURRENT_DATE ORDER BY gio_vao",
                    "explanation": "Dữ liệu chấm công hôm nay"
                }
            
            # Mặc định: Không hiểu câu hỏi
            else:
                return {
                    "sql": None,
                    "explanation": "🤔 Xin lỗi, tôi không hiểu câu hỏi của bạn. Vui lòng hỏi về: nhân viên, chi nhánh, ca làm việc, lương, hoặc chấm công."
                }
        
        return {
            "sql": None,
            "explanation": f"Lỗi khi xử lý với AI: {error_str}"
        }

def generate_natural_response(question: str, sql_result: list, sql_query: str) -> str:
    """
    Sử dụng OpenAI để sinh câu trả lời tự nhiên từ kết quả SQL
    """
    # Giới hạn số dòng để tránh token quá nhiều
    max_rows = 50
    truncated = len(sql_result) > max_rows
    display_result = sql_result[:max_rows]
    
    messages = [
        {
            "role": "system",
            "content": """Bạn là trợ lý AI thân thiện cho hệ thống quản lý nhà hàng.
Nhiệm vụ: Dựa vào kết quả SQL, tạo câu trả lời tiếng Việt tự nhiên, dễ hiểu.

QUY TẮC:
1. Trả lời ngắn gọn, súc tích nhưng đầy đủ thông tin.
2. Nếu kết quả là danh sách, format thành bảng Markdown hoặc bullet points.
3. Nếu kết quả là số liệu thống kê, highlight con số quan trọng.
4. Sử dụng emoji phù hợp để tăng tính thân thiện.
5. Format số tiền với đơn vị VNĐ và dấu phẩy ngăn cách.
6. Nếu không có dữ liệu, thông báo lịch sự."""
        },
        {
            "role": "user",
            "content": f"""Câu hỏi của người dùng: {question}

Câu SQL đã thực thi: {sql_query}

Kết quả trả về ({len(sql_result)} dòng{', hiển thị ' + str(max_rows) + ' dòng đầu' if truncated else ''}):
{json.dumps(display_result, ensure_ascii=False, default=str, indent=2)}

Hãy tạo câu trả lời tự nhiên bằng tiếng Việt."""
        }
    ]
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        error_str = str(e)
        print(f"[OPENAI ERROR] {error_str}")
        
        # Fallback: Format kết quả thành câu Việt tự nhiên
        print("[FALLBACK MODE] Using manual formatting")
        
        if not sql_result:
            return "📭 Không tìm thấy dữ liệu phù hợp với yêu cầu của bạn."
        
        # Mapping tên cột từ SQL sang Tiếng Việt đẹp
        column_mapping = {
            'id': 'ID',
            'ho_ten': 'Họ Tên',
            'ten_chi_nhanh': 'Tên Chi Nhánh',
            'ten_ca': 'Tên Ca',
            'dia_chi': 'Địa Chỉ',
            'chuc_vu': 'Chức Vụ',
            'so_dien_thoai': 'Số Điện Thoại',
            'trang_thai': 'Trạng Thái',
            'avatar': 'Avatar',
            'chi_nhanh_id': 'Chi Nhánh',
            'nhan_vien_id': 'Nhân Viên',
            'ca_lam_id': 'Ca Làm',
            'ngay_lam': 'Ngày Làm',
            'gio_bat_dau': 'Giờ Bắt Đầu',
            'gio_ket_thuc': 'Giờ Kết Thúc',
            'so_luong_max': 'Số Lượng Tối Đa',
            'role': 'Vị Trí',
            'loai_luong': 'Loại Lương',
            'muc_luong': 'Mức Lương',
            'ngay': 'Ngày',
            'gio_vao': 'Giờ Vào',
            'gio_ra': 'Giờ Ra',
            'trang_thai_checkin': 'Trạng Thái Check-in',
            'total': 'Tổng Cộng',
            'count': 'Tổng Số',
            'sum': 'Tổng',
            'avg': 'Trung Bình'
        }
        
        # Trường hợp 1: Kết quả chỉ có 1 dòng và 1 cột (COUNT, SUM, v.v.)
        if len(sql_result) == 1:
            row = sql_result[0]
            if len(row) == 1:
                key = list(row.keys())[0]
                value = list(row.values())[0]
                
                # Format dựa trên tên cột
                if 'count' in key.lower() or 'total' in key.lower():
                    return f"📊 **Tổng cộng: {value}**"
                elif 'sum' in key.lower():
                    return f"💰 **Tổng cộng: {value:,.0f} VNĐ**" if isinstance(value, (int, float)) else f"💰 **Tổng: {value}**"
                elif 'avg' in key.lower():
                    return f"📈 **Trung bình: {value:,.2f}**" if isinstance(value, (int, float)) else f"📈 **Trung bình: {value}**"
                else:
                    return f"📊 **{value}**"
        
        # Trường hợp 2: Danh sách kết quả (Multiple rows)
        if len(sql_result) > 1:
            # Lấy header và convert sang Tiếng Việt
            headers = list(sql_result[0].keys())
            pretty_headers = [column_mapping.get(h, h) for h in headers]
            
            # Tạo bảng Markdown
            header = " | ".join(f"**{h}**" for h in pretty_headers)
            separator = " | ".join(["---"] * len(headers))
            
            rows = []
            for item in sql_result[:10]:  # Tối đa 10 dòng
                row_str = " | ".join(str(v) for v in item.values())
                rows.append(row_str)
            
            table = f"{header}\n{separator}\n" + "\n".join(rows)
            
            note = f"\n\n📋 *Hiển thị {min(10, len(sql_result))}/{len(sql_result)} kết quả*" if len(sql_result) > 10 else ""
            return f"📊 **Danh sách kết quả:**\n\n{table}{note}"
        
        # Fallback cuối cùng: JSON
        return f"📊 Kết quả:\n```json\n{json.dumps(sql_result[:5], ensure_ascii=False, default=str, indent=2)}\n```"

# ==========================================
# API ENDPOINTS
# ==========================================
@router.post("/ask", response_model=ChatResponse)
async def ask_ai(request: ChatRequest):
    """
    API chính: Nhận câu hỏi, xử lý Text-to-SQL, trả về câu trả lời
    
    Flow:
    1. OpenAI sinh SQL từ câu hỏi
    2. Validate SQL (chỉ cho phép SELECT)
    3. Thực thi SQL vào PostgreSQL
    4. OpenAI sinh câu trả lời tự nhiên từ kết quả
    """
    print("=" * 70)
    print(f"[AI CHAT] Câu hỏi: {request.question}")
    print(f"[AI CHAT] Branch ID: {request.branch_id}")
    print("=" * 70)
    
    # Validate input
    if not request.question or not request.question.strip():
        return ChatResponse(
            success=False,
            answer="",
            error="Vui lòng nhập câu hỏi"
        )
    
    # Step 1: Generate SQL from question
    print("[STEP 1] Generating SQL from question...")
    ai_result = generate_sql_from_question(request.question, request.branch_id)
    
    sql_query = ai_result.get("sql")
    explanation = ai_result.get("explanation", "")
    
    # Nếu không có SQL (câu hỏi không liên quan đến dữ liệu)
    if not sql_query:
        print(f"[STEP 1] No SQL generated. Explanation: {explanation}")
        return ChatResponse(
            success=True,
            answer=explanation,
            sql_query=None
        )
    
    print(f"[STEP 1] Generated SQL: {sql_query}")
    
    # Step 2: Validate SQL (Security check)
    print("[STEP 2] Validating SQL security...")
    sql_query = sanitize_sql(sql_query)
    
    if not is_safe_query(sql_query):
        print(f"[STEP 2] ❌ UNSAFE SQL detected!")
        return ChatResponse(
            success=False,
            answer="",
            sql_query=sql_query,
            error="Câu truy vấn không được phép vì lý do bảo mật. Chỉ cho phép các câu lệnh đọc dữ liệu (SELECT)."
        )
    
    print("[STEP 2] ✓ SQL is safe")
    
    # Step 3: Execute SQL
    print("[STEP 3] Executing SQL...")
    conn = get_db_connection()
    if not conn:
        return ChatResponse(
            success=False,
            answer="",
            error="Không thể kết nối đến cơ sở dữ liệu. Vui lòng thử lại sau."
        )
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(sql_query)
        results = cursor.fetchall()
        
        # Convert to list of dicts
        results = [dict(row) for row in results]
        
        print(f"[STEP 3] ✓ Query returned {len(results)} rows")
        
    except psycopg2.Error as db_err:
        print(f"[STEP 3] ❌ Database error: {db_err}")
        conn.close()
        return ChatResponse(
            success=False,
            answer="",
            sql_query=sql_query,
            error=f"Lỗi truy vấn dữ liệu: {str(db_err)}"
        )
    finally:
        conn.close()
    
    # Step 4: Generate natural response
    print("[STEP 4] Generating natural response...")
    natural_answer = generate_natural_response(request.question, results, sql_query)
    
    print(f"[STEP 4] ✓ Response generated")
    print("=" * 70)
    
    return ChatResponse(
        success=True,
        answer=natural_answer,
        sql_query=sql_query
    )

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "AI Chat"}
