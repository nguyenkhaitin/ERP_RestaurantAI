const express = require('express');

module.exports = (pool) => {
  const router = express.Router();

  /**
  * @swagger
   * /api/menu:
   *   get:
   *     summary: Lấy danh sách món ăn
   *     description: Truy vấn các món đang được bán từ PostgreSQL.
   *     tags:
   *       - Menu
   *     responses:
   *       200:
   *         description: Danh sách món ăn
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: integer
   *                   name:
   *                     type: string
   *                   description:
   *                     type: string
   *                     nullable: true
   *                   price:
   *                     type: number
   *                   category_id:
   *                     type: integer
   *                     nullable: true
   *       500:
   *         description: Lỗi truy vấn PostgreSQL
   */
  router.get('/menu', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, description, price, category_id
        FROM menu_items
        WHERE is_available = TRUE
        ORDER BY name
      `);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};