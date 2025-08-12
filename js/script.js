function extractUsernameFromInput(raw) {
  const value = (raw || '').trim();
  if (!value) return '';

  // If it's a URL, try to parse and extract /@username
  if (/^https?:\/\//i.test(value) || value.includes('tiktok.com/')) {
    try {
      const url = new URL(value.startsWith('http') ? value : `https://${value}`);
      const match = url.pathname.match(/\/@@?([A-Za-z0-9._-]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (_) {
      // fallthrough to regex
    }

    const regex = /\/@@?([A-Za-z0-9._-]+)/i;
    const m = value.match(regex);
    if (m && m[1]) return m[1];
  }

  // If it contains @username, strip the @
  const atMatch = value.match(/@@?([A-Za-z0-9._-]+)/);
  if (atMatch && atMatch[1]) return atMatch[1];

  // Otherwise return as-is (username only)
  return value.replace(/^@/, '');
}

function parseUserIdFromHtmlClient(html, username) {
  if (!html) return null;

  const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (sigiMatch && sigiMatch[1]) {
    try {
      const state = JSON.parse(sigiMatch[1]);
      const usersMap = state?.UserModule?.users || {};

      const targetKey = Object.keys(usersMap).find(
        (key) => (usersMap[key]?.uniqueId || key || '').toLowerCase() === username.toLowerCase()
      );
      if (targetKey) {
        const userObj = usersMap[targetKey] || {};
        return userObj.id || userObj.userId || null;
      }

      const firstKey = Object.keys(usersMap)[0];
      if (firstKey) {
        const userObj = usersMap[firstKey] || {};
        return userObj.id || userObj.userId || null;
      }
    } catch (_) {}
  }

  let m = html.match(/\"userId\":\"(\d+)\"/);
  if (m) return m[1];

  m = html.match(/userId\W+([0-9]{5,})/);
  if (m) return m[1];

  return null;
}

async function clientSideUserIdFallback(username) {
  const candidates = [
    `https://r.jina.ai/http://www.tiktok.com/@${encodeURIComponent(username)}`,
    `https://r.jina.ai/http://m.tiktok.com/@${encodeURIComponent(username)}`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        headers: { Accept: 'text/html,*/*' },
      });
      if (!resp.ok) continue;
      const html = await resp.text();
      const userId = parseUserIdFromHtmlClient(html, username);
      if (userId) return `${userId}`;
    } catch (_) {
      // try next
    }
  }
  return null;
}

async function getTikTokUserId() {
  const input = document.getElementById('url');
  const username = extractUsernameFromInput(input.value);

  const label = document.getElementById('label');
  const userIdSpan = document.getElementById('userId');
  const copyBtn = document.getElementById('copyBtn');

  userIdSpan.textContent = '';
  copyBtn.disabled = true;

  if (!username) {
    alert('Por favor, ingresa un usuario o URL de perfil de TikTok');
    input.focus();
    return;
  }

  label.textContent = 'Buscando ID... ';

  try {
    const response = await fetch(`/api/userid?username=${encodeURIComponent(username)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`BACKEND_${response.status}`);
    }

    const data = await response.json();
    userIdSpan.textContent = data.userId || data.secUid || '';
    label.textContent = 'ID: ';
    copyBtn.disabled = !(userIdSpan.textContent && userIdSpan.textContent.length > 0);
  } catch (error) {
    // Fallback client-side (útil en GitHub Pages sin backend)
    try {
      label.textContent = 'Buscando ID (fallback)... ';
      const userId = await clientSideUserIdFallback(username);
      if (userId) {
        userIdSpan.textContent = userId;
        label.textContent = 'ID: ';
        copyBtn.disabled = false;
      } else {
        label.textContent = 'ID: ';
        const msg = error?.message?.startsWith('BACKEND_')
          ? `No se pudo obtener desde backend (${error.message.replace('BACKEND_', '')}) ni desde fallback`
          : 'No se pudo obtener el ID';
        alert(msg);
      }
    } catch (e2) {
      console.error(e2);
      label.textContent = 'ID: ';
      alert('Ocurrió un error');
    }
  }
}

// Copiar al portapapeles con feedback visual
document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('copyBtn');
  const userIdSpan = document.getElementById('userId');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', async () => {
    const value = (userIdSpan.textContent || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copiado!';
      copyBtn.disabled = true;
      setTimeout(() => {
        copyBtn.textContent = 'Copiar';
        copyBtn.disabled = false;
      }, 1200);
    } catch (_) {
      // Fallback para navegadores sin clipboard API
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copiado!';
      copyBtn.disabled = true;
      setTimeout(() => {
        copyBtn.textContent = 'Copiar';
        copyBtn.disabled = false;
      }, 1200);
    }
  });
});
