const express = require('express');
const { sequelize, Product, Inventory, Warehouse, Supplier, Sale, ProductSupplier, Op } = require('./database');
const router = express.Router();

// Part 1: Corrected API Implementation
router.post('/products', async (req, res) => {
    // Start atomic transaction
    const t = await sequelize.transaction();

    try {
        const { name, sku, price, warehouse_id, initial_quantity, company_id } = req.body;

        // 1. Input Validation & Optional Fields Check
        if (!name || !sku || price === undefined || !warehouse_id || initial_quantity === undefined || !company_id) {
            await t.rollback();
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Decimal/Numeric handling check
        const numericPrice = parseFloat(price);
        const numericQty = parseInt(initial_quantity);

        if (isNaN(numericPrice) || isNaN(numericQty) || numericPrice < 0 || numericQty < 0) {
            await t.rollback();
            return res.status(400).json({ error: "Price and Quantity must be non-negative valid numbers" });
        }

        // 2. Logic Check: Verify Warehouse Exists
        // We do not check ownership here for brevity, but in production we would.
        const warehouse = await Warehouse.findByPk(warehouse_id, { transaction: t });
        if (!warehouse) {
            await t.rollback();
            return res.status(404).json({ error: "Invalid Warehouse ID" });
        }

        // 3. Create Product (Independent of Warehouse, except via Inventory)
        // Note: products are created independently of warehouses.
        const product = await Product.create({
            name,
            sku,
            price: numericPrice, // Stored as DECIMAL
            CompanyId: company_id
        }, { transaction: t });

        // 4. Update Inventory (Many-to-Many link)
        await Inventory.create({
            ProductId: product.id,
            WarehouseId: warehouse_id,
            quantity: numericQty
        }, { transaction: t });

        // Commit both inserts atomically
        await t.commit();
        return res.status(201).json({ message: "Product created", product_id: product.id });

    } catch (error) {
        await t.rollback();
        // Catch integrity errors (e.g. Unique SKU)
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: "Product with this SKU already exists" });
        }
        console.error("Create Product Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

// Part 3: Low Stock Alerts Implementation
router.get('/companies/:company_id/alerts/low-stock', async (req, res) => {
    try {
        const { company_id } = req.params;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 1. Fetch all inventory for the company's warehouses
        // Optimization: We could filter by CompanyId on Product or Warehouse.
        // Here we go through Product -> Inventory
        const inventoryItems = await Inventory.findAll({
            include: [
                {
                    model: Product,
                    where: { CompanyId: company_id },
                    include: [
                        { model: Supplier, through: { attributes: ['is_primary'] } }
                    ]
                },
                { model: Warehouse }
            ]
        });

        const alerts = [];

        for (const item of inventoryItems) {
            const product = item.Product;
            // "We compare inv.quantity to product.reorder_threshold (0 if not set)."
            const threshold = product.reorder_threshold || 0;

            // "Only items at or below threshold are considered"
            if (item.quantity <= threshold) {

                // "Sum sales of the product in that warehouse over the last 30 days"
                const totalSales = await Sale.sum('quantity', {
                    where: {
                        ProductId: product.id,
                        WarehouseId: item.WarehouseId,
                        sold_at: { [Op.gte]: thirtyDaysAgo }
                    }
                });

                // "If total_sold == 0, we skip the alert"
                if (!totalSales || totalSales === 0) {
                    continue;
                }

                // Calculate pseudo "average daily sales"
                // For simplicity, avg = total_sales / 30
                const avgDailySale = totalSales / 30;

                // "days_until_stockout is computed as current_stock / (avg_daily_sale)"
                // "If no sales or division by zero, we leave it None."
                let daysUntilStockout = null;
                if (avgDailySale > 0) {
                    daysUntilStockout = Math.floor(item.quantity / avgDailySale);
                }

                // Supplier details
                let supplierInfo = null;
                if (product.Suppliers && product.Suppliers.length > 0) {
                    const primary = product.Suppliers.find(s => s.ProductSupplier.is_primary);
                    const sup = primary || product.Suppliers[0];
                    supplierInfo = {
                        id: sup.id,
                        name: sup.name,
                        contact_email: sup.contact_email
                    };
                }

                alerts.push({
                    product_id: product.id,
                    product_name: product.name,
                    sku: product.sku,
                    warehouse_id: item.Warehouse.id,
                    warehouse_name: item.Warehouse.name,
                    current_stock: item.quantity,
                    threshold: threshold,
                    days_until_stockout: daysUntilStockout,
                    supplier: supplierInfo
                });
            }
        }

        res.json({
            alerts: alerts,
            total_alerts: alerts.length
        });

    } catch (error) {
        console.error("Alerts Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
