import Papa from 'papaparse';

const autoCategorize = (description, amount) => {
  const desc = description.toLowerCase();
  
  // Receitas (Ganhos)
  if (amount > 0) {
    if (desc.includes('salario') || desc.includes('salário') || desc.includes('adiantamento') || desc.includes('rescisao') || desc.includes('ferias') || desc.includes('13o') || desc.includes('decimo terceiro')) {
      return 'Salário';
    }
    if (desc.includes('rendimento') || desc.includes('cdb') || desc.includes('tesouro') || desc.includes('fundo') || desc.includes('dividendos')) {
      return 'Investimentos';
    }
    return 'Geral';
  }

  // Despesas (Gastos)
  if (desc.includes('ifood') || desc.includes('mcdonalds') || desc.includes('bk') || desc.includes('burger') || desc.includes('padaria') || desc.includes('mercado') || desc.includes('supermercado') || desc.includes('restaurante') || desc.includes('pao de acucar') || desc.includes('carrefour') || desc.includes('atacadao') || desc.includes('assai') || desc.includes('rappi') || desc.includes('ze delivery') || desc.includes('refeicao')) {
    return 'Alimentação';
  }
  
  if (desc.includes('uber') || desc.includes('99') || desc.includes('posto') || desc.includes('ipiranga') || desc.includes('shell') || desc.includes('petrobras') || desc.includes('estacionamento') || desc.includes('pedagio') || desc.includes('sem parar') || desc.includes('conectcar') || desc.includes('veloe') || desc.includes('metro') || desc.includes('trem') || desc.includes('bilhete unico') || desc.includes('azul') || desc.includes('gol') || desc.includes('latam') || desc.includes('passagem') || desc.includes('viagem')) {
    return 'Transporte';
  }

  if (desc.includes('enel') || desc.includes('sabesp') || desc.includes('copel') || desc.includes('luz') || desc.includes('agua') || desc.includes('energia') || desc.includes('condominio') || desc.includes('aluguel') || desc.includes('iptu') || desc.includes('claro') || desc.includes('vivo') || desc.includes('tim') || desc.includes('net') || desc.includes('internet') || desc.includes('seguro fianca')) {
    return 'Moradia';
  }

  if (desc.includes('farmacia') || desc.includes('droga raia') || desc.includes('drogasil') || desc.includes('pague menos') || desc.includes('hospital') || desc.includes('unimed') || desc.includes('amil') || desc.includes('bradesco saude') || desc.includes('sulamerica') || desc.includes('dr consulta') || desc.includes('medico') || desc.includes('dentista') || desc.includes('exame') || desc.includes('laboratorio')) {
    return 'Saúde';
  }

  if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('amazon prime') || desc.includes('cinema') || desc.includes('ingresso') || desc.includes('sympla') || desc.includes('xbox') || desc.includes('playstation') || desc.includes('steam') || desc.includes('apple') || desc.includes('google play') || desc.includes('disney') || desc.includes('hbo') || desc.includes('youtube') || desc.includes('globoplay') || desc.includes('lazer')) {
    return 'Lazer';
  }

  if (desc.includes('faculdade') || desc.includes('escola') || desc.includes('curso') || desc.includes('udemy') || desc.includes('alura') || desc.includes('senac') || desc.includes('fgv') || desc.includes('livros') || desc.includes('mensalidade') || desc.includes('ingles') || desc.includes('idioma')) {
    return 'Educação';
  }

  if (desc.includes('nubank') || desc.includes('xp') || desc.includes('rico') || desc.includes('clear') || desc.includes('btg') || desc.includes('avenue') || desc.includes('nomad') || desc.includes('binance') || desc.includes('corretora') || desc.includes('investimento')) {
    return 'Investimentos';
  }

  return 'Geral';
};

export const cleanTransactionString = (rawDesc) => {
  let title = rawDesc;
  let details = '';

  // Tenta casar com o padrão longo de PIX: "Transferência enviada pelo Pix - NOME - DETALHES..."
  const pixRegex = /(Transferência (?:enviada|recebida) pelo Pix|Pix(?: enviado| recebido)?|Pagamento via Pix)[\s\-]+([A-Z\s]+)[\s\-]+(.*)/i;
  const match = rawDesc.match(pixRegex);

  if (match) {
    const action = match[1].toLowerCase();
    const isSent = action.includes('enviada') || action.includes('enviado') || action.includes('pagamento');
    const rawName = match[2].trim().toLowerCase();
    
    // Capitalize name (ex: jozilene sousa -> Jozilene Sousa)
    const formattedName = rawName.split(' ')
      .filter(w => w.length > 0)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
      
    title = `Pix ${isSent ? 'p/' : 'de'} ${formattedName}`;
    details = match[3].trim();
  } else if (rawDesc.toLowerCase().includes('pix') && rawDesc.includes('-')) {
    // Fallback genérico para outros formatos de PIX
    const parts = rawDesc.split('-');
    title = parts[0].trim();
    details = parts.slice(1).join('-').trim();
  } else {
    // Limpeza de espaços duplos
    title = rawDesc.replace(/\s{2,}/g, ' ').trim();
  }

  // Se houver detalhes, une com um ' | ' para separarmos na interface sem precisar alterar o banco
  return details ? `${title} | ${details}` : title;
};

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
      
      const rawDescription = (memoMatch ? memoMatch[1] : (nameMatch ? nameMatch[1] : 'Transação')).trim();
      const description = cleanTransactionString(rawDescription);
      
      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      
      transactions.push({
        id: idMatch ? idMatch[1] : Math.random().toString(36).substring(7),
        description,
        amount,
        date: new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString(),
        category: autoCategorize(description, amount)
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
                description: cleanTransactionString(descStr),
                amount: amount,
                date: isoDate,
                category: autoCategorize(descStr, amount)
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
