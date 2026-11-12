/**
 * Todo App Backend Service
 * Stack: Node.js (Express) + PostgreSQL
 * Deployment: Kubernetes (K8s)
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

// ==========================================
// ANSI Color Codes for Terminal Debugging
// ==========================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgBlue: '\x1b[44m',
};

// ==========================================
// 1. ENVIRONMENT CONFIGURATION
// ==========================================
const PORT = parseInt(process.env.PORT, 10) || 5000;

// PostgreSQL Connection Pool using designated environment variables
const pool = new Pool({
  host: process.env.DB_HOST || 'todo-db-service',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'todouser',
  password: process.env.DB_PASSWORD || 'todopassword',
  database: process.env.DB_NAME || 'tododb',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error(`${colors.red}[DB ERROR] Idle client error: ${err.message}${colors.reset}`);
});

// Helper function to generate Kubernetes Metadata signature
const getK8sMeta = () => ({
  podName: process.env.POD_NAME || process.env.HOSTNAME || 'localhost',
  nodeName: process.env.NODE_NAME || 'worker1',
  version: process.env.APP_VERSION || 'v1.0',
});

// ==========================================
// 2. EXPRESS SETUP & MIDDLEWARES
// ==========================================
const app = express();

// Enable CORS for all origins
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// Colorful Request Logger Middleware for easy debugging / grading
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    let statusColor = colors.green;
    if (res.statusCode >= 500) statusColor = colors.red;
    else if (res.statusCode >= 400) statusColor = colors.yellow;
    else if (res.statusCode >= 300) statusColor = colors.cyan;

    let methodColor = colors.cyan;
    if (req.method === 'POST') methodColor = colors.yellow;
    else if (req.method === 'PUT') methodColor = colors.blue;
    else if (req.method === 'DELETE') methodColor = colors.magenta;

    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${methodColor}${colors.bright}${req.method.padEnd(6)}${colors.reset} ` +
      `${colors.bright}${req.originalUrl}${colors.reset} ` +
      `-> ${statusColor}${colors.bright}${res.statusCode}${colors.reset} ` +
      `(${duration}ms) ` +
      `${colors.magenta}[Pod: ${process.env.HOSTNAME || 'localhost'}]${colors.reset}`
    );
  });

  next();
});

// ==========================================
// 3. KUBERNETES PROBES (COMPATIBLE WITH /health AND /healthz)
// ==========================================
app.get(['/health', '/healthz'], (req, res) => {
  res.status(200).json({ status: 'UP', service: 'todo-backend', _k8s_meta: getK8sMeta() });
});

app.get(['/ready', '/readyz'], async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.status(200).json({ status: 'READY', _k8s_meta: getK8sMeta() });
  } catch (err) {
    res.status(503).json({ status: 'NOT_READY', error: err.message, _k8s_meta: getK8sMeta() });
  }
});

// ==========================================
// 4. API ENDPOINTS (SUPPORT BOTH /api/tasks AND /api/todos)
// ==========================================

/**
 * 1. GET /api/tasks & GET /api/todos
 * Trả về danh sách tasks sắp xếp theo ID giảm dần.
 */
app.get(['/api/tasks', '/api/todos'], async (req, res) => {
  try {
    const query = 'SELECT id, title, completed FROM tasks ORDER BY id DESC';
    const result = await pool.query(query);

    console.log(`${colors.green}✔ Fetched ${result.rows.length} task(s) successfully.${colors.reset}`);

    return res.status(200).json({
      tasks: result.rows,
      data: result.rows,
      _k8s_meta: getK8sMeta(),
    });
  } catch (error) {
    console.error(`${colors.red}✖ Error fetching tasks: ${error.message}${colors.reset}`);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      _k8s_meta: getK8sMeta(),
    });
  }
});

/**
 * 2. POST /api/tasks & POST /api/todos
 * Nhận { title }, lưu vào DB, mặc định completed=false.
 */
app.post(['/api/tasks', '/api/todos'], async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      console.warn(`${colors.yellow}⚠ Validation error: Title is required.${colors.reset}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "title" is required and cannot be empty.',
        _k8s_meta: getK8sMeta(),
      });
    }

    const trimmedTitle = title.trim();
    const query = `
      INSERT INTO tasks (title, completed)
      VALUES ($1, false)
      RETURNING id, title, completed
    `;
    const result = await pool.query(query, [trimmedTitle]);
    const newTask = result.rows[0];

    console.log(`${colors.green}✔ Task created [ID: ${newTask.id}] "${newTask.title}"${colors.reset}`);

    return res.status(201).json({
      task: newTask,
      data: newTask,
      message: 'Task created successfully',
      _k8s_meta: getK8sMeta(),
    });
  } catch (error) {
    console.error(`${colors.red}✖ Error creating task: ${error.message}${colors.reset}`);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      _k8s_meta: getK8sMeta(),
    });
  }
});

/**
 * 3. PUT /api/tasks/:id, PUT /api/todos/:id & PATCH /api/todos/:id/toggle
 * Cập nhật trạng thái completed của task.
 */
app.all(['/api/tasks/:id', '/api/todos/:id', '/api/todos/:id/toggle'], async (req, res, next) => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') return next();
  try {
    const { id } = req.params;
    const { completed } = req.body;

    const taskId = parseInt(id, 10);
    if (isNaN(taskId) || taskId <= 0) {
      console.warn(`${colors.yellow}⚠ Invalid task ID: ${id}${colors.reset}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid task ID format.',
        _k8s_meta: getK8sMeta(),
      });
    }

    if (completed === undefined || typeof completed !== 'boolean') {
      console.warn(`${colors.yellow}⚠ Validation error: completed must be a boolean.${colors.reset}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Field "completed" must be a boolean (true/false).',
        _k8s_meta: getK8sMeta(),
      });
    }

    const query = `
      UPDATE tasks
      SET completed = $1
      WHERE id = $2
      RETURNING id, title, completed
    `;
    const result = await pool.query(query, [completed, taskId]);

    if (result.rowCount === 0) {
      console.warn(`${colors.yellow}⚠ Task [ID: ${taskId}] not found.${colors.reset}`);
      return res.status(404).json({
        error: 'Not Found',
        message: `Task with ID ${taskId} does not exist.`,
        _k8s_meta: getK8sMeta(),
      });
    }

    const updatedTask = result.rows[0];
    console.log(`${colors.green}✔ Task [ID: ${taskId}] updated. completed=${updatedTask.completed}${colors.reset}`);

    return res.status(200).json({
      task: updatedTask,
      data: updatedTask,
      message: 'Task updated successfully',
      _k8s_meta: getK8sMeta(),
    });
  } catch (error) {
    console.error(`${colors.red}✖ Error updating task: ${error.message}${colors.reset}`);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      _k8s_meta: getK8sMeta(),
    });
  }
});

// Fallback for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    _k8s_meta: getK8sMeta(),
  });
});

// ==========================================
// 5. AUTO-MIGRATION & RETRY LOGIC (K8s READY)
// ==========================================
async function initDatabase(maxRetries = 10, delayMs = 3000) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      completed BOOLEAN DEFAULT FALSE
    );
  `;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `${colors.cyan}🔄 [DB CONNECT] Connecting to PostgreSQL at ` +
        `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432} ` +
        `(Attempt ${attempt}/${maxRetries})...${colors.reset}`
      );

      const client = await pool.connect();
      await client.query(createTableSQL);
      client.release();

      console.log(`${colors.green}${colors.bright}✔ [DB READY] PostgreSQL connected & table 'tasks' verified.${colors.reset}`);
      return;
    } catch (err) {
      console.error(
        `${colors.red}✖ [DB RETRY] Attempt ${attempt} failed: ${err.message}.${colors.reset}`
      );

      if (attempt === maxRetries) {
        throw new Error(`Database connection failed after ${maxRetries} attempts.`);
      }

      console.log(`${colors.yellow}⏳ Waiting ${delayMs / 1000}s before retrying...${colors.reset}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// ==========================================
// 6. SERVER BOOTSTRAP & GRACEFUL SHUTDOWN
// ==========================================
async function startServer() {
  try {
    // 1. Ensure Database & Auto-migration are ready
    await initDatabase();

    // 2. Start Express Server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n${colors.bgBlue}${colors.bright} ==================================================== ${colors.reset}`);
      console.log(`${colors.green}${colors.bright}🚀 Server running on http://0.0.0.0:${PORT}${colors.reset}`);
      console.log(`${colors.cyan}📌 Pod Name:   ${process.env.HOSTNAME || 'localhost'}${colors.reset}`);
      console.log(`${colors.cyan}📌 Version:    ${process.env.APP_VERSION || 'v1.0'}${colors.reset}`);
      console.log(`${colors.cyan}📌 DB Target:  ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'todo_db'}${colors.reset}`);
      console.log(`${colors.bgBlue}${colors.bright} ==================================================== \n${colors.reset}`);
    });

    // Graceful Shutdown for K8s SIGTERM / SIGINT
    const shutdown = (signal) => {
      console.log(`\n${colors.yellow}⚠ [SHUTDOWN] Received ${signal}. Draining connections...${colors.reset}`);
      server.close(async () => {
        try {
          await pool.end();
          console.log(`${colors.green}✔ [SHUTDOWN] Database pool closed. Process terminated.${colors.reset}`);
          process.exit(0);
        } catch (e) {
          console.error(`${colors.red}✖ [SHUTDOWN] Error closing DB pool: ${e.message}${colors.reset}`);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (fatalError) {
    console.error(`${colors.red}${colors.bright}💥 [FATAL ERROR] ${fatalError.message}${colors.reset}`);
    process.exit(1);
  }
}

startServer();
