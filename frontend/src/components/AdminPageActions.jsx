import { Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const normalizeText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const csvCell = (value) => {
  let text = normalizeText(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

const isVisible = (element) => {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
};

const getPageTitle = (root) => normalizeText(root.querySelector('.page-header h1, h1')?.textContent || 'Admin Report');

const controlValue = (control) => {
  if (control.type === 'checkbox') return control.checked ? 'Yes' : 'No';
  if (control.tagName === 'SELECT') return normalizeText(control.selectedOptions?.[0]?.textContent || control.value);
  return control.value;
};

const buildCsvRows = (root) => {
  const pageTitle = getPageTitle(root);
  const rows = [
    ['GeoSand Admin Export'],
    ['Page', pageTitle],
    ['Exported at', new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })],
    [],
  ];
  let exportedSections = 0;

  const stats = [...root.querySelectorAll('.stat-card')].filter(isVisible);
  if (stats.length) {
    rows.push(['Summary'], ['Metric', 'Value']);
    stats.forEach((card) => {
      rows.push([
        card.querySelector('.stat-content p, p')?.textContent || 'Metric',
        card.querySelector('.stat-content h3, h3, strong')?.textContent || card.textContent,
      ]);
    });
    rows.push([]);
    exportedSections += 1;
  }

  [...root.querySelectorAll('table')].filter(isVisible).forEach((table, tableIndex) => {
    const sectionTitle = normalizeText(
      table.closest('.card')?.querySelector('.card-header h3, .card-header h2')?.textContent
      || `Table ${tableIndex + 1}`
    );
    const tableRows = [...table.querySelectorAll('tr')].filter(isVisible);
    if (!tableRows.length) return;

    const firstCells = [...tableRows[0].querySelectorAll('th, td')];
    const includedIndexes = firstCells
      .map((cell, index) => ({ index, label: normalizeText(cell.textContent).toLowerCase() }))
      .filter(({ label }) => label !== 'actions' && label !== 'action')
      .map(({ index }) => index);

    rows.push([sectionTitle]);
    tableRows.forEach((row) => {
      const cells = [...row.querySelectorAll(':scope > th, :scope > td')];
      rows.push(includedIndexes.map((index) => cells[index]?.textContent || ''));
    });
    rows.push([]);
    exportedSections += 1;
  });

  const routeItems = [...root.querySelectorAll('.route-item')].filter(isVisible);
  if (routeItems.length) {
    rows.push(['Delivery monitoring'], ['Vehicle', 'Tracking / Material', 'Route', 'Status']);
    routeItems.forEach((item) => rows.push([
      item.querySelector('strong')?.textContent,
      item.querySelector('small')?.textContent,
      item.querySelector('em')?.textContent,
      item.querySelector('.badge')?.textContent,
    ]));
    rows.push([]);
    exportedSections += 1;
  }

  if (!exportedSections) {
    const fields = [...root.querySelectorAll('.form-group')].filter(isVisible).map((group) => {
      const control = group.querySelector('input, select, textarea');
      if (!control || ['submit', 'button', 'file'].includes(control.type)) return null;
      return [group.querySelector('.form-label, label, span')?.textContent || control.name || 'Field', controlValue(control)];
    }).filter(Boolean);

    if (fields.length) {
      rows.push(['Form values'], ['Field', 'Value'], ...fields);
      exportedSections += 1;
    }
  }

  if (!exportedSections) {
    const cards = [...root.querySelectorAll('.card')].filter(isVisible);
    rows.push(['Page summary'], ['Section', 'Details']);
    cards.forEach((card, index) => rows.push([
      card.querySelector('h2, h3, h4')?.textContent || `Section ${index + 1}`,
      card.textContent,
    ]));
  }

  return { pageTitle, rows };
};

export default function AdminPageActions() {
  const handlePrint = () => {
    const root = document.querySelector('.page-content');
    if (!root) return;
    const previousTitle = document.title;
    document.title = `GeoSand - ${getPageTitle(root)}`;
    window.print();
    document.title = previousTitle;
  };

  const handleCsvDownload = () => {
    const root = document.querySelector('.page-content');
    if (!root) {
      toast.error('No page data is available to export.');
      return;
    }

    const { pageTitle, rows } = buildCsvRows(root);
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'admin-report';
    link.href = url;
    link.download = `geosand-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <div className="admin-page-actions no-print" aria-label="Admin page export actions">
      <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
        <Printer size={15} /> Print
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={handleCsvDownload}>
        <Download size={15} /> Download CSV
      </button>
    </div>
  );
}
