document.addEventListener('DOMContentLoaded', setupEventListeners);

let tesseractWorker = null;
let isWorkerReady = false;

async function initializeTesseract() {
    if (isWorkerReady) return;

    try {
        showMessage('Initializing OCR engine... (this may take a moment)', 'info');
        
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                console.log(m);
                if (m.status === 'recognizing text') {
                    const progress = (m.progress * 100).toFixed(0);
                    showMessage(`Processing OCR... ${progress}%`, 'info');
                }
            }
        });

        tesseractWorker = worker;
        isWorkerReady = true;
        showMessage('OCR engine ready! You can now upload an image.', 'success');
        
    } catch (error) {
        console.error('Error initializing Tesseract:', error);
        showMessage('Fatal Error: Could not initialize OCR engine. ' + error.message, 'error');
    }
}

function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    ['dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    uploadArea.addEventListener('dragover', () => uploadArea.classList.add('dragover'));
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', handleDrop, false);
    
    initializeTesseract();
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file!', 'error');
        return;
    }
    
    if (!isWorkerReady) {
        showMessage('Please wait, OCR engine is still initializing.', 'error');
        await initializeTesseract();
        if (!isWorkerReady) return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        processOCR(e.target.result);
    };
    reader.readAsDataURL(file);
}

async function processOCR(imageData) {
    const loadingElement = document.getElementById('loading');
    const ocrResult = document.getElementById('ocrResult');
    
    loadingElement.style.display = 'block';
    ocrResult.value = '';

    try {
        const { data: { text } } = await tesseractWorker.recognize(imageData);
        ocrResult.value = text;
        showMessage('OCR processing completed!', 'success');
    } catch (error) {
        console.error('OCR Error:', error);
        showMessage('OCR processing failed: ' + (error.message || 'An unknown error occurred'), 'error');
    } finally {
        loadingElement.style.display = 'none';
    }
}

function sendToMainApp() {
    const ocrResult = document.getElementById('ocrResult').value.trim();
    if (!ocrResult) {
        showMessage('No OCR result to send! Process an image first.', 'error');
        return;
    }

    if (window.opener) {
        window.opener.postMessage({ type: 'OCR_RESULT', text: ocrResult }, '*');
        showMessage('Text sent successfully! This window will close shortly.', 'success');
        setTimeout(() => window.close(), 1500);
    } else {
        showMessage('Cannot find main application window!', 'error');
    }
}

function copyToClipboard() {
    const ocrResult = document.getElementById('ocrResult');
    if (!ocrResult.value) {
        showMessage('Nothing to copy!', 'error');
        return;
    }
    ocrResult.select();
    document.execCommand('copy');
    showMessage('Text copied to clipboard!', 'success');
}

function clearAll() {
    document.getElementById('fileInput').value = null;
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('ocrResult').value = '';
    showMessage('All cleared!', 'success');
}

function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `${type}-message`;
    messageDiv.style.display = 'block';
    
    if (type !== 'info') {
        setTimeout(() => { messageDiv.style.display = 'none'; }, 5000);
    }
}