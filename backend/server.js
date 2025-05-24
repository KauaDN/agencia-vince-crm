const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
console.log('Configurando arquivos estáticos do frontend...');
app.use(express.static(path.join(__dirname, '../frontend/public')));

const db = new sqlite3.Database('meu_banco.db', (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err.message);
  else console.log('Conectado ao banco de dados meu_banco.db');
});

// Criar tabelas se não existirem
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      password TEXT,
      name TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      clientId INTEGER,
      status TEXT,
      deadline TEXT,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      projectId INTEGER,
      status TEXT,
      dueDate TEXT,
      area TEXT,
      responsible TEXT,
      comments TEXT,
      files TEXT,
      history TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      classification TEXT,
      status TEXT,
      responsible TEXT,
      source TEXT,
      estimatedValue REAL,
      reminder TEXT,
      interactions TEXT,
      createdAt TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT,
      userId TEXT,
      read INTEGER DEFAULT 0,
      timestamp TEXT
    )
  `);

  // Inserir usuário padrão se não existir
  db.run(
    `INSERT OR IGNORE INTO users (id, username, password, name) VALUES (?, ?, ?, ?)`,
    ['1', 'admin', 'admin123', 'Admin User']
  );
});

// Função auxiliar para executar queries
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Endpoints para Users
app.get('/api/users', async (req, res) => {
  const users = await dbAll('SELECT * FROM users');
  res.json(users);
});

// Endpoints para Clients
app.get('/api/clients', async (req, res) => {
  const clients = await dbAll('SELECT * FROM clients');
  res.json(clients);
});
app.post('/api/clients', async (req, res) => {
  const { name, email, phone } = req.body;
  const result = await dbRun('INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)', [name, email, phone]);
  res.json({ id: result.lastID, name, email, phone });
});
app.put('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;
  await dbRun('UPDATE clients SET name = ?, email = ?, phone = ? WHERE id = ?', [name, email, phone, id]);
  res.json({ id, name, email, phone });
});
app.delete('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  await dbRun('DELETE FROM clients WHERE id = ?', [id]);
  await dbRun('DELETE FROM projects WHERE clientId = ?', [id]); // Cascade delete
  res.json({ message: 'Cliente excluído' });
});

// Endpoints para Projects
app.get('/api/projects', async (req, res) => {
  const projects = await dbAll('SELECT * FROM projects');
  res.json(projects);
});
app.post('/api/projects', async (req, res) => {
  const { title, clientId, status, deadline } = req.body;
  const result = await dbRun('INSERT INTO projects (title, clientId, status, deadline) VALUES (?, ?, ?, ?)', [title, clientId, status, deadline]);
  res.json({ id: result.lastID, title, clientId, status, deadline });
});
app.put('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { title, clientId, status, deadline } = req.body;
  await dbRun('UPDATE projects SET title = ?, clientId = ?, status = ?, deadline = ? WHERE id = ?', [title, clientId, status, deadline, id]);
  res.json({ id, title, clientId, status, deadline });
});
app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  await dbRun('DELETE FROM projects WHERE id = ?', [id]);
  await dbRun('DELETE FROM tasks WHERE projectId = ?', [id]); // Cascade delete
  res.json({ message: 'Projeto excluído' });
});

// Endpoints para Tasks
app.get('/api/tasks', async (req, res) => {
  const tasks = await dbAll('SELECT * FROM tasks');
  res.json(tasks.map(t => ({
    ...t,
    comments: t.comments ? JSON.parse(t.comments) : [],
    files: t.files ? JSON.parse(t.files) : [],
    history: t.history ? JSON.parse(t.history) : []
  })));
});
app.post('/api/tasks', async (req, res) => {
  const { title, projectId, status, dueDate, area, responsible, comments, files, history } = req.body;
  const result = await dbRun(
    'INSERT INTO tasks (title, projectId, status, dueDate, area, responsible, comments, files, history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, projectId, status, dueDate, area, responsible, JSON.stringify(comments), JSON.stringify(files), JSON.stringify(history)]
  );
  res.json({ id: result.lastID, title, projectId, status, dueDate, area, responsible, comments, files, history });
});
app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, projectId, status, dueDate, area, responsible, comments, files, history } = req.body;
  await dbRun(
    'UPDATE tasks SET title = ?, projectId = ?, status = ?, dueDate = ?, area = ?, responsible = ?, comments = ?, files = ?, history = ? WHERE id = ?',
    [title, projectId, status, dueDate, area, responsible, JSON.stringify(comments), JSON.stringify(files), JSON.stringify(history), id]
  );
  res.json({ id, title, projectId, status, dueDate, area, responsible, comments, files, history });
});
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  await dbRun('DELETE FROM tasks WHERE id = ?', [id]);
  res.json({ message: 'Tarefa excluída' });
});

// Endpoints para Leads
app.get('/api/leads', async (req, res) => {
  const leads = await dbAll('SELECT * FROM leads');
  res.json(leads.map(l => ({
    ...l,
    interactions: l.interactions ? JSON.parse(l.interactions) : []
  })));
});
app.post('/api/leads', async (req, res) => {
  const { name, email, phone, classification, status, responsible, source, estimatedValue, reminder, interactions } = req.body;
  const result = await dbRun(
    'INSERT INTO leads (name, email, phone, classification, status, responsible, source, estimatedValue, reminder, interactions, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [name, email, phone, classification, status, responsible, source, estimatedValue, reminder, JSON.stringify(interactions), new Date().toISOString()]
  );
  res.json({ id: result.lastID, name, email, phone, classification, status, responsible, source, estimatedValue, reminder, interactions, createdAt: new Date().toISOString() });
});
app.put('/api/leads/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, classification, status, responsible, source, estimatedValue, reminder, interactions } = req.body;
  await dbRun(
    'UPDATE leads SET name = ?, email = ?, phone = ?, classification = ?, status = ?, responsible = ?, source = ?, estimatedValue = ?, reminder = ?, interactions = ? WHERE id = ?',
    [name, email, phone, classification, status, responsible, source, estimatedValue, reminder, JSON.stringify(interactions), id]
  );
  res.json({ id, name, email, phone, classification, status, responsible, source, estimatedValue, reminder, interactions });
});
app.delete('/api/leads/:id', async (req, res) => {
  const { id } = req.params;
  await dbRun('DELETE FROM leads WHERE id = ?', [id]);
  res.json({ message: 'Lead excluído' });
});
app.post('/api/leads/:id/interactions', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const lead = await dbGet('SELECT interactions FROM leads WHERE id = ?', [id]);
  const interactions = lead.interactions ? JSON.parse(lead.interactions) : [];
  interactions.push({ id: Date.now(), text, user: 'admin', timestamp: new Date().toISOString() });
  await dbRun('UPDATE leads SET interactions = ? WHERE id = ?', [JSON.stringify(interactions), id]);
  res.json({ message: 'Interação adicionada' });
});

// Endpoints para Notifications
app.get('/api/notifications', async (req, res) => {
  const notifications = await dbAll('SELECT * FROM notifications');
  res.json(notifications);
});
app.post('/api/notifications', async (req, res) => {
  const { message, userId } = req.body;
  const result = await dbRun('INSERT INTO notifications (message, userId, timestamp) VALUES (?, ?, ?)', [message, userId, new Date().toISOString()]);
  res.json({ id: result.lastID, message, userId, timestamp: new Date().toISOString(), read: 0 });
});
app.put('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  await dbRun('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
  res.json({ message: 'Notificação marcada como lida' });
});

// Endpoint para registrar novos usuários
app.post('/api/users/register', async (req, res) => {
    const { username, password, name } = req.body;
    try {
      // Verifica se o usuário já existe
      const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
      if (existingUser) {
        return res.status(400).json({ error: 'Usuário já existe' });
      }
      // Insere o novo usuário
      const id = Date.now().toString(); // Gera um ID único baseado no timestamp
      await dbRun('INSERT INTO users (id, username, password, name) VALUES (?, ?, ?, ?)', [id, username, password, name]);
      res.json({ id, username, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});