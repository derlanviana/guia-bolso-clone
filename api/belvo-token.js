export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { VITE_BELVO_SECRET_ID, VITE_BELVO_SECRET_PASSWORD } = process.env;

  if (!VITE_BELVO_SECRET_ID || !VITE_BELVO_SECRET_PASSWORD) {
    return res.status(500).json({ error: 'Missing Belvo credentials' });
  }

  try {
    const origin = req.headers.origin || 'http://localhost:5173';
    
    const response = await fetch('https://sandbox.belvo.com/api/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: VITE_BELVO_SECRET_ID,
        password: VITE_BELVO_SECRET_PASSWORD,
        scopes: 'read_institutions,write_links,read_links'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error generating token');
    }

    res.status(200).json({ access: data.access });
  } catch (error) {
    console.error('Error in belvo-token:', error);
    res.status(500).json({ error: error.message });
  }
}
