const textEncoder = new TextEncoder();

type ZipEntry = {
  path: string;
  data: Uint8Array;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc >>>= 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

const encodeUtf8 = (value: string) => textEncoder.encode(value);

const crc32 = (data: Uint8Array): number => {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
};

const getDosDateTime = (date = new Date()) => {
  const year = Math.max(1980, date.getFullYear());
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);

  return { dosDate, dosTime };
};

const createZipArchive = (entries: ZipEntry[]): Uint8Array => {
  const localFileChunks: Uint8Array[] = [];
  const centralDirectoryChunks: Uint8Array[] = [];
  let offset = 0;
  const { dosDate, dosTime } = getDosDateTime();

  for (const entry of entries) {
    const filenameBytes = encodeUtf8(entry.path);
    const crc = crc32(entry.data);

    const localHeader = new Uint8Array(30 + filenameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true); // version needed to extract
    localView.setUint16(6, 0, true); // general purpose bit flag
    localView.setUint16(8, 0, true); // compression method (store)
    localView.setUint16(10, dosTime, true); // last mod file time
    localView.setUint16(12, dosDate, true); // last mod file date
    localView.setUint32(14, crc, true); // crc-32
    localView.setUint32(18, entry.data.length, true); // compressed size
    localView.setUint32(22, entry.data.length, true); // uncompressed size
    localView.setUint16(26, filenameBytes.length, true); // file name length
    localView.setUint16(28, 0, true); // extra field length
    localHeader.set(filenameBytes, 30);

    localFileChunks.push(localHeader, entry.data);

    const localHeaderOffset = offset;
    offset += localHeader.length + entry.data.length;

    const centralHeader = new Uint8Array(46 + filenameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true); // central file header signature
    centralView.setUint16(4, 20, true); // version made by
    centralView.setUint16(6, 20, true); // version needed to extract
    centralView.setUint16(8, 0, true); // general purpose bit flag
    centralView.setUint16(10, 0, true); // compression method
    centralView.setUint16(12, dosTime, true); // last mod file time
    centralView.setUint16(14, dosDate, true); // last mod file date
    centralView.setUint32(16, crc, true); // crc-32
    centralView.setUint32(20, entry.data.length, true); // compressed size
    centralView.setUint32(24, entry.data.length, true); // uncompressed size
    centralView.setUint16(28, filenameBytes.length, true); // file name length
    centralView.setUint16(30, 0, true); // extra field length
    centralView.setUint16(32, 0, true); // file comment length
    centralView.setUint16(34, 0, true); // disk number start
    centralView.setUint16(36, 0, true); // internal file attributes
    centralView.setUint32(38, 0, true); // external file attributes
    centralView.setUint32(42, localHeaderOffset, true); // relative offset of local header
    centralHeader.set(filenameBytes, 46);

    centralDirectoryChunks.push(centralHeader);
  }

  const centralDirectorySize = centralDirectoryChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const endOfCentralDirectory = new Uint8Array(22);
  const endView = new DataView(endOfCentralDirectory.buffer);
  endView.setUint32(0, 0x06054b50, true); // end of central dir signature
  endView.setUint16(4, 0, true); // number of this disk
  endView.setUint16(6, 0, true); // number of the disk with the start of the central directory
  endView.setUint16(8, entries.length, true); // total number of entries in the central dir on this disk
  endView.setUint16(10, entries.length, true); // total number of entries
  endView.setUint32(12, centralDirectorySize, true); // size of the central directory
  endView.setUint32(16, offset, true); // offset of start of central directory
  endView.setUint16(20, 0, true); // .ZIP file comment length

  const totalSize = offset + centralDirectorySize + endOfCentralDirectory.length;
  const zip = new Uint8Array(totalSize);
  let position = 0;

  for (const chunk of localFileChunks) {
    zip.set(chunk, position);
    position += chunk.length;
  }

  for (const chunk of centralDirectoryChunks) {
    zip.set(chunk, position);
    position += chunk.length;
  }

  zip.set(endOfCentralDirectory, position);

  return zip;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const columnLetter = (index: number) => {
  let dividend = index + 1;
  let columnName = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
};

const createSheetXml = (headers: string[], rows: string[][]): string => {
  const sheetRows: string[] = [];

  const buildRow = (values: string[], rowIndex: number) => {
    const cells = values
      .map((value, index) => {
        const cellRef = `${columnLetter(index)}${rowIndex}`;
        const safeValue = escapeXml(value);
        return `<c r="${cellRef}" t="inlineStr"><is><t>${safeValue}</t></is></c>`;
      })
      .join('');

    return `<row r="${rowIndex}">${cells}</row>`;
  };

  sheetRows.push(buildRow(headers, 1));

  rows.forEach((row, rowIndex) => {
    sheetRows.push(buildRow(row, rowIndex + 2));
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRows.join('')}
  </sheetData>
</worksheet>`;
};

const createWorkbookXml = (sheetName: string) => `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const createWorkbookRels = () => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

const createRootRels = () => `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const createContentTypes = () => `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const sanitizeSheetName = (name: string) => {
  const cleaned = name.replace(/[:\/\\?*\[\]]/g, '_').trim();
  if (!cleaned) {
    return 'Planilha1';
  }
  return cleaned.slice(0, 31);
};

export const buildXlsxFile = (headers: string[], rows: string[][], sheetName = 'Leads'): Uint8Array => {
  const safeSheetName = sanitizeSheetName(sheetName);
  const sheetXml = createSheetXml(headers, rows);
  const workbookXml = createWorkbookXml(safeSheetName);
  const workbookRels = createWorkbookRels();
  const rootRels = createRootRels();
  const contentTypes = createContentTypes();

  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: encodeUtf8(contentTypes) },
    { path: '_rels/.rels', data: encodeUtf8(rootRels) },
    { path: 'xl/workbook.xml', data: encodeUtf8(workbookXml) },
    { path: 'xl/_rels/workbook.xml.rels', data: encodeUtf8(workbookRels) },
    { path: 'xl/worksheets/sheet1.xml', data: encodeUtf8(sheetXml) },
  ];

  return createZipArchive(entries);
};

export const downloadXlsx = (filename: string, headers: string[], rows: string[][], sheetName = 'Leads') => {
  const workbook = buildXlsxFile(headers, rows, sheetName);
  const blob = new Blob([workbook], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
