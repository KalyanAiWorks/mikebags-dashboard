#!/usr/bin/env node
// Fetch all sheets at build time, save as JSON
const fs = require('fs');
const path = require('path');
const https = require('https');

const SHEETS = {
  'Education Schools':  '0',
  'Education Colleges': '23857437',
  'Corporate IT':       '678456523',
  'Corporate FMCG':     '354193506',
  'Corporate Large':    '2035399782',
  'Sports Gyms':        '603519423',
  'Gifting Events':     '916100209',
};

const BASE = 'https://docs.google.com/spreadsheets/d/1_1sFSV4MhKXcfU3cgsYbJ5d_FTbbdGqsd427EEDQMLc/gviz/tq?tqx=out:csv&gid=';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function splitCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCSV(csvText, industry) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const contacts = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = splitCSVLine(line);
    const company = (fields[0] || '').trim();
    const firstName = (fields[1] || '').trim();
    const lastName = (fields[2] || '').trim();
    const fullName = (fields[3] || '').trim();
    const jobTitle = (fields[4] || '').trim();
    const location = (fields[5] || '').trim();
    const linkedin = (fields[7] || '').trim();
    const email = (fields[8] || '').trim();
    const phone = (fields[9] || '').trim();
    const name = fullName || (firstName || lastName ? (firstName + ' ' + lastName).trim() : '');
    if (!name && !company) continue;
    const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    const id = slug(industry) + '__' + slug(company) + '__' + slug(name);
    contacts.push({ id, name, company, jobTitle, location, state: location, industry, linkedin, email, phone, status: 'New', notes: '' });
  }
  return contacts;
}

async function main() {
  const allContacts = [];
  for (const [industry, gid] of Object.entries(SHEETS)) {
    try {
      console.log('Fetching', industry, '...');
      const csv = await fetch(BASE + gid);
      const contacts = parseCSV(csv, industry);
      console.log('  ->', contacts.length, 'contacts');
      allContacts.push(...contacts);
    } catch (e) {
      console.error('  -> FAILED:', e.message);
    }
  }

  const outDir = path.join(__dirname, '../public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'contacts.json'), JSON.stringify(allContacts, null, 2));
  console.log('Total contacts:', allContacts.length);
  console.log('Saved to public/contacts.json');
}

main().catch(console.error);
