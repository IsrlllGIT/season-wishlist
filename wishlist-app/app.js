const SERVER = 'https://season-wishlist-api.onrender.com/';

window.onload = async function() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }

  const name = localStorage.getItem('userName') || 'My';
  const season = localStorage.getItem('currentSeason') || 'My';

  document.getElementById('listTitle').textContent = name + "'s " + season + " Wish List";
  document.getElementById('ownerTag').textContent = 'Created by ' + name;

  const res = await fetch(SERVER + '/get-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, season })
  });
  const data = await res.json();
  const items = data.items || [];
  items.forEach(item => renderItem(item.name, item.price, item.link));
  updateSummary(items);
}

async function addItem() {
  const token = localStorage.getItem('token');
  const name = document.getElementById('itemName').value.trim();
  const price = document.getElementById('itemPrice').value.trim();
  const link = document.getElementById('itemLink').value.trim();

  if (!name || !link) {
    alert('Please enter an item name and link');
    return;
  }

  let finalLink = link;
  try {
    const res = await fetch(SERVER + '/inject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link })
    });
    const data = await res.json();
    finalLink = data.affiliateUrl;
  } catch {
    console.log('Injection failed, using original link');
  }

  const season = localStorage.getItem('currentSeason');

  // Get current items from server
  const getRes = await fetch(SERVER + '/get-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, season })
  });
  const getData = await getRes.json();
  const items = getData.items || [];
  items.push({ name, price, link: finalLink });

  // Save updated list to server
  await fetch(SERVER + '/save-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, season, items })
  });

  renderItem(name, price, finalLink);
  updateSummary(items);

  document.getElementById('itemName').value = '';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemLink').value = '';
}

function renderItem(name, price, link) {
  const list = document.querySelector('.list');
  const item = document.createElement('div');
  item.className = 'item';
  item.innerHTML = `
    <span class="item-name">${name}</span>
    <span class="price">$${price}</span>
    <a href="${link}" class="buy-btn" target="_blank">Buy on Amazon</a>
    <button class="del-btn" onclick="deleteItem(this, '${name}')">🗑️</button>
  `;
  list.appendChild(item);
}

async function deleteItem(btn, name) {
  const token = localStorage.getItem('token');
  const season = localStorage.getItem('currentSeason');

  btn.parentElement.remove();

  const getRes = await fetch(SERVER + '/get-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, season })
  });
  const getData = await getRes.json();
  let items = getData.items || [];
  items = items.filter(item => item.name !== name);

  await fetch(SERVER + '/save-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, season, items })
  });

  updateSummary(items);
}

function updateSummary(items) {
  const count = items.length;
  const total = items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  document.getElementById('summary').innerHTML =
    `${count} item${count !== 1 ? 's' : ''} · Total: <strong>$${total.toFixed(2)}</strong>`;
}

function shareList() {
  const userId = localStorage.getItem('userId');
  const season = localStorage.getItem('currentSeason');
  const name = localStorage.getItem('userName');

  if (!userId || !season) {
    alert('Please add items first');
    return;
  }

  const shareUrl = `https://season-wishlist.netlify.app/view.html?user=${userId}&season=${season}`;
  const text = `🎁 Check out ${name}'s ${season} Wish List!\n\n${shareUrl}`;

  if (navigator.share) {
    navigator.share({ title: `${name}'s ${season} Wish List`, text, url: shareUrl });
  } else {
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Link copied! Share it with family and friends.');
    });
  }
}