const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'inventory_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true // Important for running multiple CREATE TABLEs
});

// SQL Schema Definition
const SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS Companies (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Warehouses (
        id CHAR(36) PRIMARY KEY,
        company_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        FOREIGN KEY (company_id) REFERENCES Companies(id)
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS Products (
        id CHAR(36) PRIMARY KEY,
        company_id CHAR(36) NOT NULL,
        sku VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        reorder_threshold INT DEFAULT 0,
        FOREIGN KEY (company_id) REFERENCES Companies(id),
        UNIQUE KEY unique_sku_company (sku, company_id)
    );

    CREATE TABLE IF NOT EXISTS Inventory (
        id CHAR(36) PRIMARY KEY,
        product_id CHAR(36) NOT NULL,
        warehouse_id CHAR(36) NOT NULL,
        quantity INT DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES Products(id),
        FOREIGN KEY (warehouse_id) REFERENCES Warehouses(id),
        UNIQUE KEY unique_product_warehouse (product_id, warehouse_id)
    );

    CREATE TABLE IF NOT EXISTS ProductSuppliers (
        product_id CHAR(36) NOT NULL,
        supplier_id CHAR(36) NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (product_id, supplier_id),
        FOREIGN KEY (product_id) REFERENCES Products(id),
        FOREIGN KEY (supplier_id) REFERENCES Suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS Sales (
        id CHAR(36) PRIMARY KEY,
        product_id CHAR(36) NOT NULL,
        warehouse_id CHAR(36) NOT NULL,
        quantity INT NOT NULL,
        sold_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES Products(id),
        FOREIGN KEY (warehouse_id) REFERENCES Warehouses(id)
    );
`;

async function initDB() {
    try {
        const connection = await pool.getConnection();
        console.log('Connected to MySQL.');
        await connection.query(SCHEMA_SQL);
        console.log('Database Schema Initialized.');
        connection.release();
    } catch (err) {
        console.error('Database Initialization Failed:', err);
    }
}

module.exports = { pool, initDB };
