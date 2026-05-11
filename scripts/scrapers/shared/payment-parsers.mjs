/**
 * Recursively searches for payment event arrays in nested JSON objects.
 */
export function extractPaymentsFromJson(obj, logs, path = '', depth = 0) {
  if (depth > 15 || !obj || typeof obj !== 'object') return [];

  if (Array.isArray(obj)) {
    const payments = extractPaymentsFromArray(obj, logs, path);
    if (payments.length > 0) return payments;
  }

  const keys = Array.isArray(obj) ? obj.map((_, i) => String(i)) : Object.keys(obj);
  for (const key of keys) {
    const child = Array.isArray(obj) ? obj[Number.parseInt(key, 10)] : obj[key];
    const childPath = path ? `${path}.${key}` : key;
    const result = extractPaymentsFromJson(child, logs, childPath, depth + 1);
    if (result.length > 0) return result;
  }

  return [];
}

function extractPaymentsFromArray(items, logs, path) {
  if (items.length === 0 || !items[0] || typeof items[0] !== 'object') return [];

  const firstItem = items[0];
  const keys = Object.keys(firstItem);
  const dateFields = keys.filter(key => /data|date|vencimento|pagamento/i.test(key));

  if (dateFields.length === 0) return [];

  logs.push(`[json] Array encontrado em "${path}" com ${items.length} items. Keys: ${keys.join(', ')}`);

  const payments = items
    .map(item => mapJsonItemToPayment(item, keys, dateFields))
    .filter(payment => payment.date);

  if (payments.length > 0) {
    logs.push(`[json] ${payments.length} eventos extraídos de "${path}"`);
  }

  return payments;
}

function mapJsonItemToPayment(item, keys, dateFields) {
  const dateField = dateFields.find(field => item[field]) || dateFields[0];
  const typeField = keys.find(key => /tipo|type|evento|event/i.test(key));
  const valueField = keys.find(key => /valor|value|amount|montante|unitario/i.test(key));
  const statusField = keys.find(key => /status|situacao|situação|estado/i.test(key));
  const value = parseNumericValue(valueField ? item[valueField] : null);

  return {
    date: formatDateValue(item[dateField]),
    type: typeField && item[typeField] ? String(item[typeField]) : 'Evento',
    value: Number.isNaN(value) ? null : value,
    status: statusField && item[statusField] ? String(item[statusField]) : null,
  };
}

function parseNumericValue(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return Number.parseFloat(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'));
}

/**
 * Formats various date representations to DD/MM/YYYY.
 */
export function formatDateValue(value) {
  if (!value) return '';
  const str = String(value);

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  if (typeof value === 'number' && value > 1000000000) {
    const date = new Date(value * (value < 10000000000 ? 1000 : 1));
    return [
      String(date.getDate()).padStart(2, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      date.getFullYear(),
    ].join('/');
  }

  return str;
}

/**
 * Parses HTML tables looking for payment schedule data.
 */
export function parseHtmlTables(html, logs) {
  const payments = [];
  const typePatterns = [
    { regex: /juros\s*\+?\s*amortiza[çc][ãa]o/i, type: 'Juros + Amortização' },
    { regex: /amortiza[çc][ãa]o/i, type: 'Amortização' },
    { regex: /juros|remunera[çc][ãa]o/i, type: 'Juros' },
    { regex: /vencimento/i, type: 'Vencimento' },
  ];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let rowCount = 0;

  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const payment = parsePaymentRow(rowMatch[1], typePatterns);
    if (!payment) continue;

    rowCount += 1;
    payments.push(payment);
  }

  logs.push(`[html] ${rowCount} linhas com datas encontradas, ${payments.length} eventos extraídos`);
  return payments;
}

function parsePaymentRow(rowContent, typePatterns) {
  const dateMatch = rowContent.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (!dateMatch) return null;

  const valueMatch = rowContent.match(/R\$\s*([\d.,]+)/);
  const value = valueMatch ? Number.parseFloat(valueMatch[1].replace(/\./g, '').replace(',', '.')) : null;
  const statusMatch = rowContent.match(/(pago|previsto|agendado|liquidado|confirmado)/i);

  return {
    date: dateMatch[1],
    type: findEventType(rowContent, typePatterns),
    value: Number.isNaN(value) ? null : value,
    status: statusMatch ? capitalize(statusMatch[1]) : null,
  };
}

function findEventType(rowContent, typePatterns) {
  const match = typePatterns.find(typePattern => typePattern.regex.test(rowContent));
  return match ? match.type : 'Evento';
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
