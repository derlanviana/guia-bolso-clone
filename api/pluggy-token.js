import { PluggyClient } from 'pluggy-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET } = process.env;

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Missing Pluggy credentials' });
  }

  try {
    const client = new PluggyClient({
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET,
    });

    const data = await client.createConnectToken();
    res.status(200).json({ accessToken: data.accessToken });
  } catch (error) {
    console.error('Error in pluggy-token:', error);
    res.status(500).json({ error: error.message });
  }
}
