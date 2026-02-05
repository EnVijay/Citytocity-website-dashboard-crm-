const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const port = process.env.PORT || 3000;

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const DETAILS_TABLE = process.env.AIRTABLE_DETAILS_TABLE || 'Details';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Request too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function assertAirtableConfig() {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    throw new Error('Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID.');
  }
}

async function airtableRequest(endpoint, options = {}) {
  assertAirtableConfig();

  const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

function encodeFormula(formula) {
  return encodeURIComponent(formula);
}

function safeValue(value) {
  return String(value).replace(/'/g, "\\'");
}

async function handleApi(req, res, urlObj) {
  try {
    if (req.method === 'POST' && urlObj.pathname === '/api/login') {
      const { email, password } = await parseRequestBody(req);
      if (!email || !password) {
        sendJson(res, 400, { message: 'Email and password are required.' });
        return;
      }

      const formula = `AND({Email}='${safeValue(email)}', {Password}='${safeValue(password)}')`;
      const endpoint = `${encodeURIComponent(USERS_TABLE)}?filterByFormula=${encodeFormula(formula)}&maxRecords=1`;
      const result = await airtableRequest(endpoint);

      if (!result.records || result.records.length === 0) {
        sendJson(res, 401, { message: 'Invalid credentials.' });
        return;
      }

      sendJson(res, 200, {
        message: 'Login successful.',
        email,
        name: result.records[0].fields.Name || ''
      });
      return;
    }

    if (req.method === 'GET' && urlObj.pathname === '/api/details') {
      const email = urlObj.searchParams.get('email');
      if (!email) {
        sendJson(res, 400, { message: 'Email query parameter is required.' });
        return;
      }

      const formula = `{Email}='${safeValue(email)}'`;
      const endpoint = `${encodeURIComponent(DETAILS_TABLE)}?filterByFormula=${encodeFormula(formula)}&maxRecords=1`;
      const result = await airtableRequest(endpoint);

      if (!result.records || result.records.length === 0) {
        sendJson(res, 200, { record: null });
        return;
      }

      sendJson(res, 200, { record: result.records[0] });
      return;
    }

    if (req.method === 'POST' && urlObj.pathname === '/api/details') {
      const { email, company, phone, notes } = await parseRequestBody(req);

      if (!email) {
        sendJson(res, 400, { message: 'Email is required.' });
        return;
      }

      const formula = `{Email}='${safeValue(email)}'`;
      const findEndpoint = `${encodeURIComponent(DETAILS_TABLE)}?filterByFormula=${encodeFormula(formula)}&maxRecords=1`;
      const existing = await airtableRequest(findEndpoint);

      const fields = {
        Email: email,
        Company: company || '',
        Phone: phone || '',
        Notes: notes || ''
      };

      if (existing.records && existing.records.length > 0) {
        const recordId = existing.records[0].id;
        const response = await airtableRequest(encodeURIComponent(DETAILS_TABLE), {
          method: 'PATCH',
          body: JSON.stringify({ records: [{ id: recordId, fields }] })
        });

        sendJson(res, 200, { message: 'Details updated.', record: response.records[0] });
        return;
      }

      const response = await airtableRequest(encodeURIComponent(DETAILS_TABLE), {
        method: 'POST',
        body: JSON.stringify({ records: [{ fields }] })
      });
      sendJson(res, 200, { message: 'Details created.', record: response.records[0] });
      return;
    }

    sendJson(res, 404, { message: 'API route not found.' });
  } catch (error) {
    sendJson(res, 500, { message: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (urlObj.pathname.startsWith('/api/')) {
    await handleApi(req, res, urlObj);
    return;
  }

  if (urlObj.pathname === '/' || urlObj.pathname === '/index.html') {
    sendFile(res, path.join(__dirname, 'public', 'index.html'));
    return;
  }

  if (urlObj.pathname === '/styles.css') {
    sendFile(res, path.join(__dirname, 'public', 'styles.css'));
    return;
  }

  if (urlObj.pathname === '/app.js') {
    sendFile(res, path.join(__dirname, 'public', 'app.js'));
    return;
  }

  sendFile(res, path.join(__dirname, 'public', 'index.html'));
});

server.listen(port, () => {
  console.log(`CRM dashboard running at http://localhost:${port}`);
});
