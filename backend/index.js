/**
 * =============================================
 * BACKEND SERVER: Hệ thống Quản lý Nhà hàng + Camera AI
 * Tech: Express.js + PostgreSQL
 * Port: 8000
 * =============================================
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const app = express();
const PORT = process.env.PORT || 8001;

// =============================================
// MIDDLEWARE - CORS FIX
// =============================================
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://f081cd33141f.ngrok-free.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  credentials: true
}));
app.use(express.json());

// =============================================
// DATABASE CONNECTION
// =============================================
const pool = new Pool({
  host: 'localhost',
  database: 'postgres',
  user: 'postgres',
  password: '123',
  port: 5433,
});

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RestaurantAI API',
      version: '1.0.0',
      description: 'Tài liệu và giao diện test API cho RestaurantAI'
    },
    servers: [
      { url: `http://localhost:${PORT}` }
    ]
  },
  apis: [path.join(__dirname, 'routes', '*.js')]
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api', require('./routes/menu')(pool));

// Test DB connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Generate VietQR URL for payment
 */
function generateVietQR(bankConfig, amount, description) {
  const encodedDesc = encodeURIComponent(description);
  return `https://img.vietqr.io/image/${bankConfig.bank_code}-${bankConfig.account_number}-compact.png?amount=${amount}&addInfo=${encodedDesc}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
}

/**
 * Calculate session duration in minutes
 */
function calculateDuration(checkInTime) {
  if (!checkInTime) return 0;
  const now = new Date();
  const checkIn = new Date(checkInTime);
  return Math.floor((now - checkIn) / 60000);
}

/**
 * Generate order code
 */
function generateOrderCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${date}-${random}`;
}

// =============================================
// API: FLOOR STATUS (Core POS Display)
// =============================================

/**
 * GET /api/floor-status
 * Lấy toàn bộ trạng thái sàn để hiển thị trên POS
 */
app.get('/api/floor-status', async (req, res) => {
  try {
    // Query 1: Get all zones (khu_vuc)
    const zonesResult = await pool.query(`
      SELECT id, ten_khu_vuc as name, ma_tien_to as key_prefix, mo_ta as description, tang_so as floor_number
      FROM khu_vuc
      WHERE kich_hoat = TRUE
      ORDER BY tang_so, id
    `);

    // Query 2: Get all tables with states (ban_an + trang_thai_ban)
    const tablesResult = await pool.query(`
      SELECT 
        ba.id,
        ba.khu_vuc_id as zone_id,
        ba.so_ban as table_number,
        ba.ten_ban as table_name,
        ba.hinh_dang as shape,
        ba.so_cho_ngoi as seat_capacity,
        ba.loai_ban as table_type,
        ba.vi_tri_x as position_x,
        ba.vi_tri_y as position_y,
        ttb.trang_thai as status,
        ttb.so_khach_pos as pos_guests,
        ttb.so_khach_ai as ai_detected_guests,
        ttb.la_sai_lech as is_mismatch,
        ttb.chenh_lech as mismatch_diff,
        ttb.la_ban_ma as is_ghost,
        ttb.gio_check_in as check_in_time,
        ttb.hoa_don_hien_tai as current_order_id,
        ttb.lan_cap_nhat_ai_cuoi as last_ai_update,
        hd.ma_hoa_don as order_code,
        hd.tam_tinh as subtotal,
        hd.tien_vat as vat_amount,
        hd.tong_tien as total_amount
      FROM ban_an ba
      LEFT JOIN trang_thai_ban ttb ON ba.id = ttb.ban_id
      LEFT JOIN hoa_don hd ON ttb.hoa_don_hien_tai = hd.id AND hd.trang_thai = 'open'
      WHERE ba.kich_hoat = TRUE
      ORDER BY ba.khu_vuc_id, ba.so_ban
    `);

    // Group tables by zone
    const zones = zonesResult.rows.map(zone => {
      const zoneTables = tablesResult.rows
        .filter(t => t.zone_id === zone.id)
        .map(t => ({
          id: t.id,
          tableNumber: t.table_number,
          tableName: t.table_name,
          shape: t.shape,
          seatCapacity: t.seat_capacity,
          tableType: t.table_type,
          positionX: t.position_x,
          positionY: t.position_y,
          status: t.status || 'empty',
          posGuests: t.pos_guests || 0,
          aiDetectedGuests: t.ai_detected_guests || 0,
          isMismatch: t.is_mismatch || false,
          mismatchDiff: t.mismatch_diff || 0,
          isGhost: t.is_ghost || false,
          checkInTime: t.check_in_time,
          duration: calculateDuration(t.check_in_time),
          currentOrderId: t.current_order_id,
          orderCode: t.order_code,
          currentBill: t.total_amount || 0
        }));

      return {
        id: zone.id,
        name: zone.name,
        keyPrefix: zone.key_prefix,
        description: zone.description,
        floorNumber: zone.floor_number,
        tables: zoneTables
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      zones
    });

  } catch (error) {
    console.error('Error fetching floor status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// API: SERVICE OPERATIONS
// =============================================

/**
 * POST /api/service/start
 * Bắt đầu phục vụ bàn (Check-in)
 */
app.post('/api/service/start', async (req, res) => {
  const { tableId, guestCount } = req.body;

  if (!tableId || !guestCount) {
    return res.status(400).json({ success: false, error: 'tableId và guestCount là bắt buộc' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update table state
    await client.query(`
      UPDATE table_states SET
        status = 'occupied',
        pos_guests = $1,
        check_in_time = NOW(),
        updated_at = NOW()
      WHERE table_id = $2
    `, [guestCount, tableId]);

    // 2. Create new order
    const orderCode = generateOrderCode();
    const orderResult = await client.query(`
      INSERT INTO orders (table_id, order_code, guest_count, status, created_by)
      VALUES ($1, $2, $3, 'open', 'POS')
      RETURNING id, order_code
    `, [tableId, orderCode, guestCount]);

    // 3. Link order to table state
    await client.query(`
      UPDATE table_states SET current_order_id = $1 WHERE table_id = $2
    `, [orderResult.rows[0].id, tableId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Bắt đầu phục vụ thành công',
      orderId: orderResult.rows[0].id,
      orderCode: orderResult.rows[0].order_code
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting service:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/service/override
 * Override số khách khi AI đếm sai
 */
app.post('/api/service/override', async (req, res) => {
  const { tableId, newGuestCount, reason, overrideBy = 'Staff' } = req.body;

  if (!tableId || newGuestCount === undefined) {
    return res.status(400).json({ success: false, error: 'tableId và newGuestCount là bắt buộc' });
  }

  try {
    await pool.query(`
      UPDATE table_states SET
        pos_guests = $1,
        override_reason = $2,
        override_by = $3,
        override_time = NOW(),
        is_mismatch = FALSE,
        mismatch_diff = 0,
        updated_at = NOW()
      WHERE table_id = $4
    `, [newGuestCount, reason, overrideBy, tableId]);

    res.json({
      success: true,
      message: 'Override số khách thành công'
    });

  } catch (error) {
    console.error('Error overriding guests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/service/end
 * Kết thúc phục vụ (Check-out không thanh toán)
 */
app.post('/api/service/end', async (req, res) => {
  const { tableId } = req.body;

  try {
    await pool.query(`
      UPDATE table_states SET
        status = 'empty',
        pos_guests = 0,
        ai_detected_guests = 0,
        is_mismatch = FALSE,
        mismatch_diff = 0,
        is_ghost = FALSE,
        check_in_time = NULL,
        current_order_id = NULL,
        updated_at = NOW()
      WHERE table_id = $1
    `, [tableId]);

    res.json({ success: true, message: 'Kết thúc phục vụ thành công' });

  } catch (error) {
    console.error('Error ending service:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// API: PAYMENT
// =============================================

/**
 * GET /api/payment/calculate/:tableId
 * Tính tiền cho bàn
 */
app.get('/api/payment/calculate/:tableId', async (req, res) => {
  const { tableId } = req.params;

  try {
    // Get table state and order
    const stateResult = await pool.query(`
      SELECT ts.*, o.id as order_id, o.order_code, o.subtotal, o.vat_amount, o.total_amount
      FROM table_states ts
      LEFT JOIN orders o ON ts.current_order_id = o.id
      WHERE ts.table_id = $1
    `, [tableId]);

    if (stateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bàn' });
    }

    const state = stateResult.rows[0];

    // Get order items
    let items = [];
    if (state.order_id) {
      const itemsResult = await pool.query(`
        SELECT oi.*, mi.name as item_name
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = $1
      `, [state.order_id]);
      items = itemsResult.rows;
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const vatAmount = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + vatAmount;

    // Get default bank for QR
    const bankResult = await pool.query(`
      SELECT * FROM bank_configs WHERE is_default = TRUE LIMIT 1
    `);
    const bank = bankResult.rows[0];

    let qrCodeUrl = null;
    if (bank) {
      qrCodeUrl = generateVietQR(bank, totalAmount, `Thanh toan ${state.order_code || 'HD'}`);
    }

    res.json({
      success: true,
      tableId,
      orderId: state.order_id,
      orderCode: state.order_code,
      duration: calculateDuration(state.check_in_time),
      items,
      subtotal,
      vatAmount,
      totalAmount,
      qrCodeUrl,
      bank: bank ? {
        bankName: bank.bank_name,
        accountNumber: bank.account_number,
        accountName: bank.account_name
      } : null
    });

  } catch (error) {
    console.error('Error calculating payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/payment
 * Xử lý thanh toán
 */
app.post('/api/payment', async (req, res) => {
  const { tableId, paymentMethod, discountPercent = 0 } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current order
    const stateResult = await client.query(`
      SELECT ts.current_order_id FROM table_states ts WHERE ts.table_id = $1
    `, [tableId]);

    const orderId = stateResult.rows[0]?.current_order_id;
    if (!orderId) {
      throw new Error('Không có đơn hàng để thanh toán');
    }

    // Calculate final amount
    const orderResult = await client.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    const order = orderResult.rows[0];
    const discount = Math.round(order.total_amount * discountPercent / 100);
    const finalAmount = order.total_amount - discount;

    // Update order status
    await client.query(`
      UPDATE orders SET
        status = 'paid',
        payment_method = $1,
        discount_percent = $2,
        discount_amount = $3,
        final_amount = $4,
        paid_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
    `, [paymentMethod, discountPercent, discount, finalAmount, orderId]);

    // Reset table state
    await client.query(`
      UPDATE table_states SET
        status = 'empty',
        pos_guests = 0,
        ai_detected_guests = 0,
        is_mismatch = FALSE,
        mismatch_diff = 0,
        is_ghost = FALSE,
        check_in_time = NULL,
        current_order_id = NULL,
        updated_at = NOW()
      WHERE table_id = $1
    `, [tableId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Thanh toán thành công',
      orderId,
      finalAmount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// =============================================
// API: AI DETECTION
// =============================================

/**
 * POST /api/ai/detection
 * Nhận data từ Camera AI
 */
app.post('/api/ai/detection', async (req, res) => {
  const { tableId, detectedGuests, confidence, cameraId } = req.body;

  try {
    await pool.query(`
      UPDATE table_states SET
        ai_detected_guests = $1,
        last_ai_update = NOW(),
        updated_at = NOW()
      WHERE table_id = $2
    `, [detectedGuests, tableId]);

    // Log detection
    await pool.query(`
      INSERT INTO ai_detection_logs (table_id, detected_guests, confidence, camera_id)
      VALUES ($1, $2, $3, $4)
    `, [tableId, detectedGuests, confidence, cameraId]);

    res.json({ success: true, message: 'AI detection updated' });

  } catch (error) {
    console.error('Error updating AI detection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================
// CRUD API: ZONES
// =============================================

app.get('/api/zones', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT z.*, COUNT(t.id) as table_count
      FROM zones z
      LEFT JOIN tables t ON z.id = t.zone_id AND t.is_active = TRUE
      WHERE z.is_active = TRUE
      GROUP BY z.id
      ORDER BY z.floor_number, z.id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/zones', async (req, res) => {
  const { name, key_prefix, description, floor_number = 1 } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO zones (name, key_prefix, description, floor_number)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, key_prefix, description, floor_number]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/zones/:id', async (req, res) => {
  const { id } = req.params;
  const { name, key_prefix, description, floor_number } = req.body;
  try {
    const result = await pool.query(`
      UPDATE zones SET name = $1, key_prefix = $2, description = $3, floor_number = $4, updated_at = NOW()
      WHERE id = $5 RETURNING *
    `, [name, key_prefix, description, floor_number, id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/zones/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`UPDATE zones SET is_active = FALSE WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// CRUD API: TABLES
// =============================================

app.get('/api/tables', async (req, res) => {
  const { zoneId } = req.query;
  try {
    let query = `
      SELECT t.*, z.name as zone_name, ts.status
      FROM tables t
      LEFT JOIN zones z ON t.zone_id = z.id
      LEFT JOIN table_states ts ON t.id = ts.table_id
      WHERE t.is_active = TRUE
    `;
    const params = [];
    
    if (zoneId) {
      query += ` AND t.zone_id = $1`;
      params.push(zoneId);
    }
    
    query += ` ORDER BY t.zone_id, t.table_number`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tables', async (req, res) => {
  const { zone_id, table_number, shape, seat_capacity, table_type, position_x, position_y } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO tables (zone_id, table_number, shape, seat_capacity, table_type, position_x, position_y)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [zone_id, table_number, shape, seat_capacity, table_type, position_x, position_y]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tables/:id', async (req, res) => {
  const { id } = req.params;
  const { shape, seat_capacity, table_type, position_x, position_y } = req.body;
  try {
    const result = await pool.query(`
      UPDATE tables SET shape = $1, seat_capacity = $2, table_type = $3, position_x = $4, position_y = $5, updated_at = NOW()
      WHERE id = $6 RETURNING *
    `, [shape, seat_capacity, table_type, position_x, position_y, id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tables/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`UPDATE tables SET is_active = FALSE WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// CRUD API: MENU CATEGORIES
// =============================================

app.get('/api/menu-categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM menu_categories ORDER BY sort_order
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// CRUD API: MENU ITEMS
// =============================================

app.get('/api/menu-items', async (req, res) => {
  const { categoryId } = req.query;
  try {
    let query = `
      SELECT mi.*, mc.name as category_name
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.is_available = TRUE
    `;
    const params = [];
    
    if (categoryId) {
      query += ` AND mi.category_id = $1`;
      params.push(categoryId);
    }
    
    query += ` ORDER BY mc.sort_order, mi.name`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/menu-items', async (req, res) => {
  const { category_id, name, description, price, is_featured, preparation_time } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO menu_items (category_id, name, description, price, is_featured, preparation_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [category_id, name, description, price, is_featured || false, preparation_time || 15]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/menu-items/:id', async (req, res) => {
  const { id } = req.params;
  const { category_id, name, description, price, is_featured, is_available } = req.body;
  try {
    const result = await pool.query(`
      UPDATE menu_items SET category_id = $1, name = $2, description = $3, price = $4, is_featured = $5, is_available = $6, updated_at = NOW()
      WHERE id = $7 RETURNING *
    `, [category_id, name, description, price, is_featured, is_available, id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/menu-items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`UPDATE menu_items SET is_available = FALSE WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// CRUD API: BANK CONFIGS
// =============================================

app.get('/api/bank-configs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM bank_configs WHERE is_active = TRUE ORDER BY is_default DESC, id
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bank-configs', async (req, res) => {
  const { bank_code, bank_name, account_number, account_name, branch, is_default } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // If setting as default, unset other defaults
    if (is_default) {
      await client.query(`UPDATE bank_configs SET is_default = FALSE WHERE is_default = TRUE`);
    }
    
    const result = await client.query(`
      INSERT INTO bank_configs (bank_code, bank_name, account_number, account_name, branch, is_default)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [bank_code, bank_name, account_number, account_name, branch, is_default || false]);
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.put('/api/bank-configs/:id', async (req, res) => {
  const { id } = req.params;
  const { bank_code, bank_name, account_number, account_name, branch, is_default } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (is_default) {
      await client.query(`UPDATE bank_configs SET is_default = FALSE WHERE is_default = TRUE`);
    }
    
    const result = await client.query(`
      UPDATE bank_configs SET bank_code = $1, bank_name = $2, account_number = $3, account_name = $4, branch = $5, is_default = $6, updated_at = NOW()
      WHERE id = $7 RETURNING *
    `, [bank_code, bank_name, account_number, account_name, branch, is_default, id]);
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

app.delete('/api/bank-configs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`UPDATE bank_configs SET is_active = FALSE WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// API: BOOKINGS
// =============================================

app.get('/api/bookings', async (req, res) => {
  const { date } = req.query;
  try {
    let query = `
      SELECT b.*, t.table_name
      FROM bookings b
      LEFT JOIN tables t ON b.table_id = t.id
      WHERE 1=1
    `;
    const params = [];
    
    if (date) {
      query += ` AND b.booking_date = $1`;
      params.push(date);
    }
    
    query += ` ORDER BY b.booking_date, b.booking_time`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  const { table_id, customer_name, customer_phone, booking_date, booking_time, guest_count, notes } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(`
      INSERT INTO bookings (table_id, customer_name, customer_phone, booking_date, booking_time, guest_count, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [table_id, customer_name, customer_phone, booking_date, booking_time, guest_count, notes]);
    
    // Update table state to reserved
    await client.query(`
      UPDATE table_states SET status = 'reserved', updated_at = NOW() WHERE table_id = $1
    `, [table_id]);
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// =============================================
// API: DASHBOARD STATS
// =============================================

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Revenue today
    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(final_amount), 0) as today_revenue, COUNT(*) as orders_count
      FROM orders
      WHERE status = 'paid' AND DATE(paid_at) = CURRENT_DATE
    `);

    // Table status counts
    const tableStatusResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
        COUNT(*) FILTER (WHERE status = 'empty') as empty,
        COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
        COUNT(*) FILTER (WHERE status = 'alert') as alert,
        COUNT(*) FILTER (WHERE is_ghost = TRUE) as ghost_count,
        COUNT(*) FILTER (WHERE is_mismatch = TRUE) as mismatch_count
      FROM table_states
    `);

    // Guest counts
    const guestResult = await pool.query(`
      SELECT 
        COALESCE(SUM(pos_guests), 0) as total_pos_guests,
        COALESCE(SUM(ai_detected_guests), 0) as total_ai_guests
      FROM table_states
      WHERE status = 'occupied'
    `);

    // Hourly revenue
    const hourlyResult = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM paid_at) as hour,
        COALESCE(SUM(final_amount), 0) as revenue
      FROM orders
      WHERE status = 'paid' AND DATE(paid_at) = CURRENT_DATE
      GROUP BY EXTRACT(HOUR FROM paid_at)
      ORDER BY hour
    `);

    res.json({
      revenue: {
        today: parseInt(revenueResult.rows[0].today_revenue),
        ordersCount: parseInt(revenueResult.rows[0].orders_count)
      },
      tables: tableStatusResult.rows[0],
      guests: guestResult.rows[0],
      hourlyRevenue: hourlyResult.rows.map(r => ({ hour: parseInt(r.hour), revenue: parseInt(r.revenue) }))
    });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// ORDER ITEMS API
// =============================================

app.post('/api/orders/:orderId/items', async (req, res) => {
  const { orderId } = req.params;
  const { menu_item_id, quantity, notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get menu item price
    const menuResult = await client.query(`SELECT price FROM menu_items WHERE id = $1`, [menu_item_id]);
    if (menuResult.rows.length === 0) {
      throw new Error('Menu item not found');
    }
    const unitPrice = menuResult.rows[0].price;
    const totalPrice = unitPrice * quantity;

    // Insert order item
    const itemResult = await client.query(`
      INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [orderId, menu_item_id, quantity, unitPrice, totalPrice, notes]);

    // Update order totals
    const totalsResult = await client.query(`
      SELECT COALESCE(SUM(total_price), 0) as subtotal FROM order_items WHERE order_id = $1
    `, [orderId]);
    const subtotal = parseInt(totalsResult.rows[0].subtotal);
    const vatAmount = Math.round(subtotal * 0.1);
    const totalAmount = subtotal + vatAmount;

    await client.query(`
      UPDATE orders SET subtotal = $1, vat_amount = $2, total_amount = $3, updated_at = NOW()
      WHERE id = $4
    `, [subtotal, vatAmount, totalAmount, orderId]);

    await client.query('COMMIT');

    res.status(201).json(itemResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding order item:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Restaurant POS Server running on port ${PORT}`);
  console.log(`📊 API Base: http://127.0.0.1:${PORT}/api`);
  console.log(`📋 Floor Status: http://127.0.0.1:${PORT}/api/floor-status`);
  console.log(`✅ CORS enabled for localhost:5173`);
  console.log('='.repeat(50));
});

module.exports = app;
