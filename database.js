const { Sequelize, DataTypes, Op } = require('sequelize');
const path = require('path');

// Initialize SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'inventory.db'), // Database file
    logging: false // Toggle to true to see SQL queries
});

// --- Details Models ---

const Company = sequelize.define('Company', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false }
});

const Warehouse = sequelize.define('Warehouse', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    location: { type: DataTypes.STRING }
});

const Supplier = sequelize.define('Supplier', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    contact_email: { type: DataTypes.STRING }
});

const Product = sequelize.define('Product', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sku: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    reorder_threshold: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: true } // Renamed from custom_threshold
}, {
    indexes: [
        { unique: true, fields: ['sku', 'CompanyId'] } // Unique SKU per company
    ]
});

const Inventory = sequelize.define('Inventory', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    quantity: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false }
}, {
    indexes: [
        { unique: true, fields: ['ProductId', 'WarehouseId'] } // One record per product per warehouse
    ]
});

const Sale = sequelize.define('Sale', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    sold_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// --- Relationships ---

// Company Relationships
Company.hasMany(Warehouse);
Warehouse.belongsTo(Company);

Company.hasMany(Product);
Product.belongsTo(Company);

// Product-to-Warehouse via Inventory
Product.hasMany(Inventory, { onDelete: 'CASCADE' });
Inventory.belongsTo(Product);

Warehouse.hasMany(Inventory, { onDelete: 'CASCADE' });
Inventory.belongsTo(Warehouse);

// Product-to-Supplier (Many-to-Many)
const ProductSupplier = sequelize.define('ProductSupplier', {
    is_primary: { type: DataTypes.BOOLEAN, defaultValue: false }
});
Product.belongsToMany(Supplier, { through: ProductSupplier });
Supplier.belongsToMany(Product, { through: ProductSupplier });

// Sales tracking
Product.hasMany(Sale);
Sale.belongsTo(Product);

// Sale also belongs to a Warehouse now for granular tracking
Warehouse.hasMany(Sale);
Sale.belongsTo(Warehouse);

module.exports = {
    sequelize,
    Company,
    Warehouse,
    Supplier,
    Product,
    Inventory,
    Sale,
    ProductSupplier,
    Op
};
