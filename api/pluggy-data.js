import { PluggyClient } from 'pluggy-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { itemId } = req.body;
  const { PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET } = process.env;

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Missing Pluggy credentials' });
  }

  if (!itemId) {
    return res.status(400).json({ error: 'Missing itemId' });
  }

  try {
    const client = new PluggyClient({
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET,
    });

    // Fetch accounts for the connected item
    const accounts = await client.fetchAccounts(itemId);
    
    // Fetch transactions for the connected item (first page)
    const transactions = await client.fetchTransactions(itemId, { limit: 20 });

    res.status(200).json({ 
      accounts: accounts.results,
      transactions: transactions.results
    });
  } catch (error) {
    console.error('Error fetching Pluggy data:', error);
    res.status(500).json({ error: error.message });
  }
}
