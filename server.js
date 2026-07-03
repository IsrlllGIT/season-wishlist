/*const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'wishlist-app')));

app.get('/', (req, res) => {
  res.send('Season Wishlist Server is running!');
});

function injectAffiliate(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('amazon.com')) {
      parsed.searchParams.set('tag', 'yourtaghere-20');
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

app.post('/inject', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  const affiliateUrl = injectAffiliate(url);
  res.json({ original: url, affiliateUrl });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
}); */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'wishlist-app')));

// ===== AFFILIATE INJECTION =====
function injectAffiliate(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('amazon.com')) {
      parsed.searchParams.set('tag', 'yourtaghere-20');
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

app.post('/inject', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  res.json({ original: url, affiliateUrl: injectAffiliate(url) });
});

// ===== REGISTER =====
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  const hashed = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert([{ name, email, password: hashed }])
    .select();

  if (error) return res.status(400).json({ error: error.message });

  const token = jwt.sign({ id: data[0].id, name }, process.env.JWT_SECRET);
  res.json({ token, name });
});

// ===== LOGIN =====
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) return res.status(400).json({ error: 'User not found' });

  const match = await bcrypt.compare(password, data.password);
  if (!match) return res.status(400).json({ error: 'Wrong password' });

  const token = jwt.sign({ id: data.id, name: data.name }, process.env.JWT_SECRET);
  res.json({ token, name: data.name });
});

// ===== SAVE LIST =====
app.post('/save-list', async (req, res) => {
  const { token, season, items } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: existing, error: fetchError } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', decoded.id)
      .eq('season', season)
      .single();

    if (fetchError) console.log('Fetch error:', fetchError.message);

    if (existing) {
      const { error: updateError } = await supabase
        .from('wishlist')
        .update({ items })
        .eq('id', existing.id);
      if (updateError) console.log('Update error:', updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from('wishlist')
        .insert([{ user_id: decoded.id, season, items }]);
      if (insertError) console.log('Insert error:', insertError.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.log('JWT error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// ===== GET LIST =====
app.post('/get-list', async (req, res) => {
  const { token, season } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data } = await supabase
      .from('wishlist')
      .select('items')
      .eq('user_id', decoded.id)
      .eq('season', season)
      .single();

    res.json({ items: data?.items || [] });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});