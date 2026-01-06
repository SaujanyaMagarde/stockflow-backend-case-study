# StockFlow Backend Case Study (Node.js + MySQL)

This repository contains the solution for the StocksFlow Backend Engineering Intern case study, implemented in Node.js with raw MySQL queries.

## Structure

*   `server.js`: Application entry point.
*   `database.js`: MySQL connection pool and raw SQL schema definition.
*   `routes.js`: API endpoints implemented using raw SQL queries.

## Setup

1.  **Prerequisites:**
    *   Node.js (v14+)
    *   MySQL Server (running locally or accessible via network)

2.  **Configuration:**
    *   Update `.env` with your database credentials:
        ```
        DB_HOST=localhost
        DB_USER=root
        DB_PASS=password
        DB_NAME=inventory_db
        ```
    *   Ensure the database `inventory_db` exists (or create it: `CREATE DATABASE inventory_db;`).

3.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Run the application:**
    ```bash
    npm start
    ```
    The application will automatically attempt to create the necessary tables on startup.

## API Testing

*   **Create Product:** `POST /api/products`
*   **Get Low Stock Alerts:** `GET /api/companies/<company_id>/alerts/low-stock`
