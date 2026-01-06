const express = require('express');
const { pool } = require('./database');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Part 1: Corrected API Implementation
router.post('/products', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { name, sku, price, warehouse_id, initial_quantity, company_id } = req.body;

        // 1. Input Validation
        if (!name || !sku || price === undefined || !warehouse_id || initial_quantity === undefined || !company_id) {
            await connection.rollback();
            return res.status(400).json({ error: "Missing required fields" });
        }

        const numericPrice = parseFloat(price);
        const numericQty = parseInt(initial_quantity);

        if (isNaN(numericPrice) || isNaN(numericQty) || numericPrice < 0 || numericQty < 0) {
            await connection.rollback();
            return res.status(400).json({ error: "Price and Quantity must be non-negative valid numbers" });
        }

        // 2. Logic Check: Verify Warehouse Exists
        const [warehouses] = await connection.query('SELECT id FROM Warehouses WHERE id = ?', [warehouse_id]);
        if (warehouses.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: "Invalid Warehouse ID" });
        }

        // 3. Create Product
        const productId = uuidv4();
        // Uses DECIMAL type for price in DB
        await connection.query(
            'INSERT INTO Products (id, company_id, sku, name, price) VALUES (?, ?, ?, ?, ?)',
            [productId, company_id, sku, name, numericPrice]
        );

        // 4. Update Inventory
        const inventoryId = uuidv4();
        await connection.query(
            'INSERT INTO Inventory (id, product_id, warehouse_id, quantity) VALUES (?, ?, ?, ?)',
            [inventoryId, productId, warehouse_id, numericQty]
        );

        await connection.commit();
        return res.status(201).json({ message: "Product created", product_id: productId });

    } catch (error) {
        if (connection) await connection.rollback();

        // Handle MySQL Error Codes
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: "Product with this SKU already exists for this company" });
        }

        console.error("Create Product Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
});

// Part 3: Low Stock Alerts Implementation
router.get('/companies/:company_id/alerts/low-stock', async (req, res) => {
    let connection;
    try {
        const { company_id } = req.params;
        connection = await pool.getConnection();

        // Complex Query:
        // 1. Join Inventory, Products, Warehouses.
        // 2. Left Join ProductSuppliers (filtered by is_primary) and Suppliers.
        // 3. Left Join Sales (recent 30 days) to calculate total sales and avg daily sales.
        // 4. Filter by CompanyID.
        // 5. Filter by Quantity <= Threshold.
        // 6. Filter by Recent Sales > 0.

        const sql = `
            SELECT 
                p.id as product_id, p.name as product_name, p.sku, 
                p.reorder_threshold,
                w.id as warehouse_id, w.name as warehouse_name,
                i.quantity as current_stock,
                s.id as supplier_id, s.name as supplier_name, s.contact_email,
                COALESCE(SUM(sa.quantity), 0) as total_recent_sales
            FROM Inventory i
            JOIN Products p ON i.product_id = p.id
            JOIN Warehouses w ON i.warehouse_id = w.id
            LEFT JOIN Sales sa ON sa.product_id = p.id 
                AND sa.warehouse_id = w.id 
                AND sa.sold_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            LEFT JOIN ProductSuppliers ps ON p.id = ps.product_id AND ps.is_primary = 1
            LEFT JOIN Suppliers s ON ps.supplier_id = s.id
            WHERE p.company_id = ?
            GROUP BY i.id, p.id, w.id, s.id
            HAVING i.quantity <= COALESCE(p.reorder_threshold, 0)
               AND total_recent_sales > 0
        `;

        const [rows] = await connection.query(sql, [company_id]);

        const alerts = rows.map(row => {
            const avgDailySale = row.total_recent_sales / 30;
            const daysUntilStockout = avgDailySale > 0 ? Math.floor(row.current_stock / avgDailySale) : null;

            return {
                product_id: row.product_id,
                product_name: row.product_name,
                sku: row.sku,
                warehouse_id: row.warehouse_id,
                warehouse_name: row.warehouse_name,
                current_stock: row.current_stock,
                threshold: row.reorder_threshold,
                days_until_stockout: daysUntilStockout,
                supplier: row.supplier_id ? {
                    id: row.supplier_id,
                    name: row.supplier_name,
                    contact_email: row.contact_email
                } : null
            };
        });

        res.json({
            alerts: alerts,
            total_alerts: alerts.length
        });

    } catch (error) {
        console.error("Alerts Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
