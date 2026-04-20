export default async function handler(req, res) {
  const SHEETS = {
    'Education Schools': '0',
    'Education Colleges': '23857437',
    'Corporate IT': '678456523',
    'Corporate FMCG': '354193506',
    'Corporate Large': '2035399782',
    'Sports Gyms': '603519423',
    'Gifting Events': '916100209',
  };

  const BASE = 'https://docs.google.com/spreadsheets/d/1_1sFSV4MhKXcfU3cgsYbJ5d_FTbbdGqsd427EEDQMLc/gviz/tq?tqx=out:csv&gid=';

  try {
    const allContacts = [];
    for (const [industry, gid] of Object.entries(SHEETS)) {
      const resp = await fetch(BASE + gid);
      const csv = await resp.text();
      const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const fields = line.split(',').map(f => f.replace(/^"|"$/g, '').replace(/""/g, '"'));
        const company = fields[0] || '';
        const firstName = fields[1] || '';
        const lastName = fields[2] || '';
        const fullName = fields[3] || '';
        const jobTitle = fields[4] || '';
        const location = fields[5] || '';
        const linkedin = fields[7] || '';
        const email = fields[8] || '';
        const phone = fields[9] || '';
        const name = fullName || (firstName + ' ' + lastName).trim();
        if (!name && !company) continue;
        const slug = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
        const id = slug(industry) + '__' + slug(company) + '__' + slug(name);
        allContacts.push({ id, name, company, jobTitle, location, state: location, industry, linkedin, email, phone, status: 'New', notes: '' });
      }
    }
    res.json({ contacts: allContacts, count: allContacts.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
