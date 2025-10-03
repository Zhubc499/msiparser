const MEASUREMENT_TYPES = [
    '/RT', '/DOC', '/WM', '/CTR 20\'', '/CTR 40\'', '/TRIP', '/SHIPMENT',
    '/KG', '/M3', '/TON', '/CBM', '/PALLET', '/BOX', '/ITEM', '/DAY',
    '/HOUR', '/KM', '/MILE', '/LITER', '/GALLON', '/SQM', '/CASE',
    '/DRUM', '/BAG', '/ROLL', '/UNIT', '/SET', '/DOZEN'
];

document.addEventListener('DOMContentLoaded', function() {
    initializeMeasurementTags();
    loadSavedData();

    const ocrButton = document.getElementById('ocrButton');
    if (ocrButton) {
        ocrButton.addEventListener('click', openOCRProcessor);
    }
});

function initializeMeasurementTags() {
    const container = document.getElementById('measurementTags');
    if (!container) return;
    MEASUREMENT_TYPES.forEach(type => {
        const tag = document.createElement('span');
        tag.className = 'measurement-tag';
        tag.textContent = type;
        container.appendChild(tag);
    });
}

function openOCRProcessor() {
    window.open('ocr-processor.html', 'OCR Processor', 'width=800,height=700');
}

function clearInput() {
    const rawInputElement = document.getElementById('rawInput');
    if (rawInputElement) {
        rawInputElement.value = '';
        showSuccess('Input cleared!');
    }
}

function loadSavedData() {
    const saved = localStorage.getItem('shipmentData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            data.forEach(row => addRowToTable(row));
            calculateGrandTotal();
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }
}

function saveData() {
    try {
        const data = [];
        document.querySelectorAll('#tableBody tr:not(.total-row)').forEach(row => {
            const itemInput = row.cells[0]?.querySelector('input');
            if (itemInput && itemInput.value) {
                data.push({
                    item: itemInput.value,
                    amount: row.cells[1]?.querySelector('input')?.value || '1',
                    cost: row.cells[2]?.querySelector('input')?.value || '',
                    measurement: row.cells[3]?.querySelector('input')?.value || '',
                    vendor: row.cells[5]?.querySelector('input')?.value || '',
                    notes: row.cells[6]?.querySelector('input')?.value || ''
                });
            }
        });
        localStorage.setItem('shipmentData', JSON.stringify(data));
    } catch (e) {
        console.error('Error saving data:', e);
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.className = 'error-message';
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.className = 'success-message';
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

window.addEventListener('message', function(event) {
    if (event.data.type === 'OCR_RESULT') {
        const rawInputElement = document.getElementById('rawInput');
        if (rawInputElement) {
            rawInputElement.value = event.data.text;
            showSuccess('OCR text successfully imported!');
        }
    }
});

async function parseWithAI() {
    const rawInputElement = document.getElementById('rawInput');
    if (!rawInputElement || !rawInputElement.value.trim()) {
        showError('Please paste data from email first!');
        return;
    }
    const rawInput = rawInputElement.value.trim();

    const loadingElement = document.getElementById('loading');
    const aiButton = document.querySelector('.btn-primary');
    
    if (loadingElement) loadingElement.style.display = 'block';
    if (aiButton) {
        aiButton.disabled = true;
        const span = aiButton.querySelector('span');
        if (span) span.textContent = '🤖 Processing...';
    }

    // URL diubah ke path Vercel
    const functionUrl = '/api/parse-ai'; 

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            body: JSON.stringify({ input: rawInput })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            const parsedData = result.data;
            clearTable();
            if (parsedData && parsedData.length > 0) {
                parsedData.forEach(item => addRowToTable(item));
                calculateGrandTotal();
                saveData();
                showSuccess(`Successfully parsed ${parsedData.length} items with AI!`);
            } else {
                 showError('AI did not find any items to parse.');
            }
        } else {
            throw new Error(result.error || 'Unknown error from AI service');
        }

    } catch (error) {
        console.error('AI Parsing Error:', error);
        showError('AI parsing failed. This is likely due to a timeout. Please try again in a moment.');
    } finally {
        if (loadingElement) loadingElement.style.display = 'none';
        if (aiButton) {
            aiButton.disabled = false;
            const span = aiButton.querySelector('span');
            if(span) span.textContent = '🤖 Parse with AI';
        }
    }
}


function addNewRow() {
    addRowToTable({});
}

function addRowToTable(data = {}) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    const row = tbody.insertRow(tbody.rows.length);
    
    const cells = [
        `<input type="text" value="${escapeHtml(data.item || '')}" placeholder="Item name" onchange="updateRow(this)">`,
        `<input type="number" value="${escapeHtml(data.amount || '1')}" placeholder="1" min="1" step="1" onchange="calculateRow(this)">`,
        `<input type="text" value="${escapeHtml(data.cost || '')}" placeholder="e.g., USD 150 or 2000000" onchange="calculateRow(this)">`,
        `<input type="text" value="${escapeHtml(data.measurement || '')}" placeholder="/KG" list="measurementList" onchange="calculateRow(this)">`,
        `<span class="total-amount">0</span>`,
        `<input type="text" value="${escapeHtml(data.vendor || '')}" placeholder="Vendor name" onchange="updateRow(this)">`,
        `<input type="text" value="${escapeHtml(data.notes || '')}" placeholder="Additional notes" onchange="updateRow(this)">`,
        `<span class="status-badge status-invalid">INCOMPLETE</span>`,
        `<button class="btn btn-danger" onclick="deleteRow(this)" style="padding: 6px 12px; font-size: 12px;">Delete</button>`
    ];

    cells.forEach((html, index) => {
        const cell = row.insertCell(index);
        cell.innerHTML = html;
    });

    const totalRow = tbody.querySelector('.total-row');
    if (totalRow) {
        tbody.appendChild(totalRow);
    }

    if (data.cost) {
        const costInput = row.cells[2]?.querySelector('input');
        if (costInput) calculateRow(costInput);
    }

    updateRowStatus(row);
    saveData();
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function calculateRow(input) {
    const row = input.closest('tr');
    const amountInput = row.cells[1]?.querySelector('input');
    const costInput = row.cells[2]?.querySelector('input');
    const totalSpan = row.cells[4]?.querySelector('.total-amount');
    
    if (!amountInput || !costInput || !totalSpan) return;

    const amount = parseFloat(amountInput.value) || 1;
    const costString = costInput.value;
    const cost = parseFloat(costString.replace(/[^0-9.-]+/g,"")) || 0;
    
    let total = cost * amount;
    
    totalSpan.textContent = formatCurrency(total, costString);
    updateRowStatus(row);
    calculateGrandTotal();
    saveData();
}

function updateRow(input) {
    const row = input.closest('tr');
    updateRowStatus(row);
    saveData();
}

function updateRowStatus(row) {
    const statusBadge = row.cells[7]?.querySelector('.status-badge');
    const item = row.cells[0]?.querySelector('input')?.value;
    const cost = row.cells[2]?.querySelector('input')?.value;
    const measurement = row.cells[3]?.querySelector('input')?.value;
    
    if (statusBadge) {
        if (item && cost && measurement) {
            statusBadge.className = 'status-badge status-valid';
            statusBadge.textContent = 'VALID';
        } else {
            statusBadge.className = 'status-badge status-invalid';
            statusBadge.textContent = 'INCOMPLETE';
        }
    }
}

function calculateGrandTotal() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    let totals = { IDR: 0, USD: 0, OTHER: 0 };
    
    tbody.querySelectorAll('.total-row').forEach(row => row.remove());
    
    document.querySelectorAll('#tableBody tr').forEach(row => {
        if (row.classList.contains('total-row')) return;

        const costString = row.cells[2]?.querySelector('input')?.value || '';
        const totalString = row.cells[4]?.querySelector('.total-amount')?.textContent || '0';
        const value = parseFloat(totalString.replace(/[^0-9.-]+/g,"")) || 0;

        if (costString.toUpperCase().includes('USD') || totalString.includes('$')) {
            totals.USD += value;
        } else if (costString.toUpperCase().includes('IDR') || totalString.includes('Rp')) {
            totals.IDR += value;
        } else {
            totals.OTHER += value;
        }
    });
    
    const dataRows = document.querySelectorAll('#tableBody tr:not(.total-row)');
    if (dataRows.length > 0) {
        if (totals.IDR > 0) addTotalRow(tbody, 'GRAND TOTAL (IDR)', formatCurrency(totals.IDR, 'IDR'));
        if (totals.USD > 0) addTotalRow(tbody, 'GRAND TOTAL (USD)', formatCurrency(totals.USD, 'USD'));
        if (totals.OTHER > 0) addTotalRow(tbody, 'GRAND TOTAL (Other)', totals.OTHER.toLocaleString());
    }
}

function addTotalRow(tbody, label, total) {
    const totalRow = tbody.insertRow();
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
        <td colspan="4"><strong>${label}</strong></td>
        <td><strong>${total}</strong></td>
        <td colspan="4"></td>
    `;
}

function formatCurrency(amount, originalString = 'IDR') {
    if (originalString.toUpperCase().includes('USD')) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}


function deleteRow(button) {
    if (confirm('Delete this row?')) {
        const row = button.closest('tr');
        row.remove();
        calculateGrandTotal();
        saveData();
    }
}

function clearTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr:not(.total-row)').forEach(row => row.remove());
    calculateGrandTotal();
}

function clearAll() {
    if (confirm('Clear all data from table and input?')) {
        clearTable();
        const rawInputElement = document.getElementById('rawInput');
        if (rawInputElement) rawInputElement.value = '';
        localStorage.removeItem('shipmentData');
        showSuccess('All data cleared!');
    }
}

function exportToExcel() {
    const rows = [];
    const headers = ['ITEM', 'AMOUNT', 'COST', 'MEASUREMENT', 'TOTAL', 'VENDOR', 'NOTES', 'STATUS'];
    rows.push(headers);

    const dataRows = document.querySelectorAll('#tableBody tr:not(.total-row)');
    
    if (dataRows.length === 0) {
        showError('No data to export!');
        return;
    }

    dataRows.forEach(row => {
        const rowData = [];
        rowData.push(row.cells[0]?.querySelector('input')?.value || '');
        rowData.push(row.cells[1]?.querySelector('input')?.value || '1');
        rowData.push(row.cells[2]?.querySelector('input')?.value || '');
        rowData.push(row.cells[3]?.querySelector('input')?.value || '');
        rowData.push(row.cells[4]?.querySelector('.total-amount')?.textContent || '0');
        rowData.push(row.cells[5]?.querySelector('input')?.value || '');
        rowData.push(row.cells[6]?.querySelector('input')?.value || '');
        rowData.push(row.cells[7]?.querySelector('.status-badge')?.textContent || 'INCOMPLETE');
        rows.push(rowData);
    });
    
    document.querySelectorAll('.total-row').forEach(row => {
        const label = row.cells[0]?.textContent || '';
        const total = row.cells[1]?.textContent || '';
        rows.push([label, '', '', '', total, '', '', '']);
    });
    
    const csvContent = rows.map(row => row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `MSI_Shipment_Costing_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('Data exported successfully!');
}
