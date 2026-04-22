import Papa from 'papaparse';

export const parseOFX = (ofxString) => {
  const transactions = [];
  // Basic OFX Regex parsing since OFX is SGML/XML-like but often malformed
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  
  let match;
  while ((match = stmtTrnRegex.exec(ofxString)) !== null) {
    const trnBlock = match[1];
    
    // Extract Type
    const typeMatch = trnBlock.match(/<TRNTYPE>(.*?)(?:<|\r|\n)/);
    // Extract Amount
    const amountMatch = trnBlock.match(/<TRNAMT>(.*?)(?:<|\r|\n)/);
    // Extract Date
    const dateMatch = trnBlock.match(/<DTPOSTED>([0-9]{8})/);
    // Extract Description (MEMO or NAME)
    const memoMatch = trnBlock.match(/<MEMO>(.*?)(?:<|\r|\n)/);
    const nameMatch = trnBlock.match(/<NAME>(.*?)(?:<|\r|\n)/);
    // ID
    const idMatch = trnBlock.match(/<FITID>(.*?)(?:<|\r|\n)/);

    if (amountMatch && dateMatch) {
      const year = dateMatch[1].substring(0, 4);
      const month = dateMatch[1].substring(4, 6);
      const day = dateMatch[1].substring(6, 8);
      
      transactions.push({
        id: idMatch ? idMatch[1] : Math.random().toString(36).substring(7),
        description: (memoMatch ? memoMatch[1] : (nameMatch ? nameMatch[1] : 'Transação')).trim(),
        amount: parseFloat(amountMatch[1].replace(',', '.')),
        date: new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString(),
        category: 'Geral'
      });
    }
  }

  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const parseCSV = (csvString) => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions = [];
        results.data.forEach(row => {
          // Attempt to find common column names for Brazilian Banks
          const dateStr = row['Data'] || row['Date'] || row['Data Lançamento'] || Object.values(row)[0];
          const descStr = row['Descrição'] || row['Description'] || row['Histórico'] || Object.values(row)[1];
          const valStr = row['Valor'] || row['Amount'] || row['Valor (R$)'] || Object.values(row)[2];

          if (dateStr && valStr) {
            // Clean up value (e.g. "R$ 1.500,00" -> "1500.00" or "-1.500,00")
            const cleanVal = valStr.toString().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
            const amount = parseFloat(cleanVal);
            
            // Try to parse DD/MM/YYYY date
            let isoDate = new Date().toISOString();
            if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length >= 3) {
                 // Format: YYYY-MM-DD
                 isoDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00Z`).toISOString();
              }
            }

            if (!isNaN(amount)) {
              transactions.push({
                id: Math.random().toString(36).substring(7),
                description: descStr,
                amount: amount,
                date: isoDate,
                category: 'Geral'
              });
            }
          }
        });
        resolve(transactions.sort((a, b) => new Date(b.date) - new Date(a.date)));
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};
