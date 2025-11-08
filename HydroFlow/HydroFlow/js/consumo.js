// Lógica específica para la página consumo.html
// Define loadDataAndChart, saveReading y logout.

let __consumo_currentUserId = null;
let __consumo_chart = null;
let __consumo_docs = [];
let __consumo_videoStream = null;
let __consumo_videoEl = null;
let __consumo_overlayEl = null;
let __consumo_autoCapture = false;
let __consumo_processingImage = false;
let __consumo_worker = null;

function logout() {
    if (typeof signOut === 'function' && typeof auth !== 'undefined') {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        }).catch(err => {
            console.error('Logout error', err);
            alert('Error cerrando sesión');
        });
    } else {
        // Fallback si no está modular exportado
        if (typeof window.auth !== 'undefined' && typeof window.auth.signOut === 'function') {
            window.auth.signOut().then(()=> window.location.href = 'index.html');
        } else {
            alert('No se pudo cerrar sesión: Auth no disponible');
        }
    }
}

async function saveReading() {
    const input = document.getElementById('current-reading');
    const feedback = document.getElementById('reading-feedback');
    const btn = document.getElementById('save-reading-btn');
    
    // Limpiar feedback anterior
    if (feedback) {
        feedback.textContent = '';
        feedback.style.color = '';
    }
    
    // Validaciones rápidas
    if (!input) return;
    if (!window.navigator.onLine) {
        if (feedback) {
            feedback.textContent = 'Guardando en modo offline...';
            feedback.style.color = '#f59e0b';
        }
    }

    const value = parseFloat(input.value);
    if (isNaN(value)) {
        if (feedback) {
            feedback.textContent = 'Ingrese un número válido.';
            feedback.style.color = '#c00';
        }
        return;
    }

    if (!__consumo_currentUserId) {
        if (feedback) {
            feedback.textContent = 'Usuario no autenticado.';
            feedback.style.color = '#c00';
        }
        return;
    }

    // Inhabilitar botón y mostrar estado
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Guardando...';
    }

    try {
        // Crear objeto de lectura
        const readingData = {
            value: value,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString(), // Timestamp local para referencia
            offline: !window.navigator.onLine
        };

        // Guardar en Firestore
        const col = collection(db, 'users', __consumo_currentUserId, 'readings');
        const docRef = await addDoc(col, readingData);

        // Feedback exitoso
        if (feedback) {
            feedback.textContent = window.navigator.onLine ? 
                'Lectura guardada correctamente' : 
                'Lectura guardada (se sincronizará cuando haya conexión)';
            feedback.style.color = '#059669';
        }

        // Limpiar input solo si se guardó exitosamente
        input.value = '';
        
    } catch (e) {
        console.error('saveReading error', e);
        let errMsg = 'Error al guardar la lectura.';
        
        // Mensajes de error más específicos
        if (e.code === 'permission-denied') {
            errMsg = 'No tienes permiso para guardar lecturas.';
        } else if (e.code === 'unavailable') {
            errMsg = 'Servicio no disponible. La lectura se guardará cuando haya conexión.';
        } else if (e.message) {
            errMsg += ` ${e.message}`;
        }
        
        if (feedback) {
            feedback.textContent = errMsg;
            feedback.style.color = '#c00';
        }
    } finally {
        // Restaurar botón
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Guardar Lectura';
        }
    }
}

function buildChart(ctx, labels = [], data = []) {
    if (__consumo_chart) {
        __consumo_chart.destroy();
        __consumo_chart = null;
    }

    __consumo_chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Consumo (m³)',
                data: data,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37,99,235,0.08)',
                fill: true,
                tension: 0.2,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { display: true },
                y: { display: true, beginAtZero: true }
            }
        }
    });
}

async function initTesseract() {
    if (!__consumo_worker) {
        __consumo_worker = await Tesseract.createWorker({
            logger: m => {
                const result = document.getElementById('ocr-result');
                if (result) result.textContent = `Procesando: ${m.status}`;
            }
        });
        await __consumo_worker.loadLanguage('eng');
        await __consumo_worker.initialize('eng');
        await __consumo_worker.setParameters({
            tessedit_char_whitelist: '0123456789.',
        });
    }
}

async function toggleCamera() {
    const container = document.getElementById('camera-container');
    const btn = document.getElementById('camera-toggle');
    const video = document.getElementById('video');
    const overlay = document.getElementById('overlay');

    if (container.classList.contains('hidden')) {
        try {
            __consumo_videoStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            video.srcObject = __consumo_videoStream;
            __consumo_videoEl = video;
            __consumo_overlayEl = overlay;
            container.classList.remove('hidden');
            btn.classList.add('bg-red-500', 'hover:bg-red-600');
            btn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            
            // Inicializar Tesseract
            await initTesseract();

            // Configurar auto-captura
            const autoCapture = document.getElementById('auto-capture');
            autoCapture.addEventListener('change', function() {
                __consumo_autoCapture = this.checked;
                if (this.checked) {
                    processVideoFrame();
                }
            });
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Error al acceder a la cámara. Asegúrate de dar permisos.');
        }
    } else {
        if (__consumo_videoStream) {
            __consumo_videoStream.getTracks().forEach(track => track.stop());
        }
        container.classList.add('hidden');
        btn.classList.remove('bg-red-500', 'hover:bg-red-600');
        btn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        __consumo_autoCapture = false;
        document.getElementById('auto-capture').checked = false;
    }
}

async function processVideoFrame() {
    if (!__consumo_videoEl || !__consumo_autoCapture || __consumo_processingImage) return;

    const canvas = document.createElement('canvas');
    canvas.width = __consumo_videoEl.videoWidth;
    canvas.height = __consumo_videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(__consumo_videoEl, 0, 0);

    try {
        __consumo_processingImage = true;
        const { data: { text } } = await __consumo_worker.recognize(canvas);
        const number = parseFloat(text.replace(/[^\d.]/g, ''));
        
        if (!isNaN(number)) {
            document.getElementById('current-reading').value = number;
            document.getElementById('ocr-result').textContent = `Detectado: ${number}`;
            await saveReading();
        }
    } catch (err) {
        console.error('Error en OCR:', err);
    } finally {
        __consumo_processingImage = false;
        if (__consumo_autoCapture) {
            setTimeout(() => processVideoFrame(), 1000);
        }
    }
}

async function captureImage() {
    if (!__consumo_videoEl || !__consumo_overlayEl) return;

    const canvas = document.createElement('canvas');
    canvas.width = __consumo_videoEl.videoWidth;
    canvas.height = __consumo_videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(__consumo_videoEl, 0, 0);

    try {
        const { data: { text } } = await __consumo_worker.recognize(canvas);
        const number = parseFloat(text.replace(/[^\d.]/g, ''));
        
        if (!isNaN(number)) {
            document.getElementById('current-reading').value = number;
            document.getElementById('ocr-result').textContent = `Detectado: ${number}`;
        } else {
            document.getElementById('ocr-result').textContent = 'No se detectaron números válidos';
        }
    } catch (err) {
        console.error('Error en OCR:', err);
        document.getElementById('ocr-result').textContent = 'Error en el procesamiento';
    }
}

function formatDateForLabel(ts) {
    try {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleString();
    } catch (e) { return '' + ts; }
}

function loadDataAndChart(dbRef, userId, appId) {
    // Guardar userId para uso en saveReading
    __consumo_currentUserId = userId;

    const ctx = document.getElementById('consumoChart');
    if (!ctx) return;

    // Consulta a Firestore: users/{userId}/readings ordenadas por timestamp
    try {
        const readingsCol = collection(dbRef, 'users', userId, 'readings');
        const q = query(readingsCol, orderBy('timestamp', 'asc'));

        // Suscribirse a cambios en tiempo real
        onSnapshot(q, (snapshot) => {
            const labels = [];
            const data = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                labels.push(formatDateForLabel(d.timestamp));
                data.push(d.value);
            });

            // Construir o actualizar gráfico
            buildChart(ctx, labels, data);
        }, (err) => {
            console.error('onSnapshot error', err);
        });
    } catch (e) {
        console.error('loadDataAndChart error', e);
    }
}

// Exponer funciones en window para que el HTML las llame
window.loadDataAndChart = loadDataAndChart;
window.saveReading = saveReading;
window.logout = logout;

// --- Funcionalidad de cámara + OCR usando Tesseract ---
async function openCameraForRead() {
    // Crear overlay si no existe
    if (!__consumo_overlayEl) {
        __consumo_overlayEl = document.createElement('div');
        __consumo_overlayEl.style.position = 'fixed';
        __consumo_overlayEl.style.left = '0';
        __consumo_overlayEl.style.top = '0';
        __consumo_overlayEl.style.width = '100%';
        __consumo_overlayEl.style.height = '100%';
        __consumo_overlayEl.style.background = 'rgba(0,0,0,0.6)';
        __consumo_overlayEl.style.display = 'flex';
        __consumo_overlayEl.style.alignItems = 'center';
        __consumo_overlayEl.style.justifyContent = 'center';
        __consumo_overlayEl.style.zIndex = '9999';

        const box = document.createElement('div');
        box.style.background = '#fff';
        box.style.padding = '12px';
        box.style.borderRadius = '8px';
        box.style.maxWidth = '640px';
        box.style.width = '94%';
        box.style.textAlign = 'center';

        __consumo_videoEl = document.createElement('video');
        __consumo_videoEl.autoplay = true;
        __consumo_videoEl.playsInline = true;
        __consumo_videoEl.style.width = '100%';
        __consumo_videoEl.style.maxHeight = '480px';

    const controls = document.createElement('div');
        controls.style.marginTop = '8px';
        controls.style.display = 'flex';
        controls.style.justifyContent = 'center';
        controls.style.gap = '8px';

    const captureBtn = document.createElement('button');
    captureBtn.textContent = 'Capturar y leer (auto x5)';
    captureBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded';
    // Usar modo automático: varias capturas rápidas y elegir la mejor (por defecto 5 intentos)
    captureBtn.onclick = () => tryAutoCapture(5, 300);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cerrar';
        cancelBtn.className = 'px-4 py-2 bg-gray-300 rounded';
        cancelBtn.onclick = closeCameraOverlay;

        controls.appendChild(captureBtn);
        controls.appendChild(cancelBtn);

        box.appendChild(__consumo_videoEl);
        // area para preview procesada u OCR raw
        const previewWrap = document.createElement('div');
        previewWrap.style.marginTop = '8px';
        previewWrap.style.display = 'flex';
        previewWrap.style.flexDirection = 'column';
        previewWrap.style.alignItems = 'center';
        previewWrap.style.gap = '6px';

        const previewLabel = document.createElement('div');
        previewLabel.textContent = 'Preview OCR (procesado):';
        previewLabel.style.fontSize = '0.9rem';
        previewLabel.style.color = '#333';

        const previewCanvas = document.createElement('canvas');
        previewCanvas.id = 'ocr-processed-preview';
        previewCanvas.style.maxWidth = '100%';
        previewCanvas.style.border = '1px solid #ddd';
        previewCanvas.style.borderRadius = '6px';

        const rawTextEl = document.createElement('div');
        rawTextEl.id = 'ocr-raw-text';
        rawTextEl.style.fontSize = '0.85rem';
        rawTextEl.style.color = '#666';
        rawTextEl.style.maxWidth = '100%';
        rawTextEl.style.wordBreak = 'break-word';

        previewWrap.appendChild(previewLabel);
        previewWrap.appendChild(previewCanvas);
        previewWrap.appendChild(rawTextEl);

        box.appendChild(previewWrap);
        box.appendChild(controls);
        __consumo_overlayEl.appendChild(box);
        document.body.appendChild(__consumo_overlayEl);
    }

    // Solicitar cámara
    try {
        __consumo_videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        __consumo_videoEl.srcObject = __consumo_videoStream;
        await __consumo_videoEl.play();
    } catch (e) {
        console.error('No se pudo acceder a la cámara', e);
        alert('No se pudo acceder a la cámara. Verifica permisos y que tu dispositivo tenga cámara.');
        closeCameraOverlay();
    }
}

// Captura el frame actual del video y devuelve un canvas con la imagen
function captureFrame() {
    if (!__consumo_videoEl) return null;
    const canvas = document.createElement('canvas');
    canvas.width = __consumo_videoEl.videoWidth || 1280;
    canvas.height = __consumo_videoEl.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(__consumo_videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
}

// Modo automático: captura varias imágenes rápidas y elige la mejor lectura
async function tryAutoCapture(attempts = 3, delayMs = 500) {
    const feedback = document.getElementById('reading-feedback');
    if (feedback) { feedback.textContent = 'Realizando ' + attempts + ' intentos...'; feedback.style.color = '#000'; }
    if (typeof Tesseract === 'undefined') {
        if (feedback) { feedback.textContent = 'OCR no disponible (Tesseract no cargado).'; feedback.style.color = '#c00'; }
        return;
    }

    let best = { score: 0, text: '', match: null, processed: null };

    for (let i = 0; i < attempts; i++) {
        if (feedback) { feedback.textContent = `Intento ${i+1} de ${attempts}...`; }
        const frame = captureFrame();
        if (!frame) break;
        const processed = preprocessForOCR(frame);

        // Mostrar preview temporal
        try { const preview = document.getElementById('ocr-processed-preview'); if (preview) { preview.width = processed.width; preview.height = processed.height; preview.getContext('2d').drawImage(processed,0,0); } } catch(e){}

        try {
            const result = await Tesseract.recognize(processed, 'eng', { logger: m => console.log(m), tessedit_char_whitelist: '0123456789.' });
            const text = result && result.data && result.data.text ? result.data.text : '';
            // Buscar número
            const match = text.replace(/[\s,]+/g, '.').match(/\d+(?:\.\d+)?/);
            // Calcular score heurístico: longitud del match + confianza promedio (si existe)
            let conf = 0;
            try { conf = result && result.data && typeof result.data.confidence === 'number' ? result.data.confidence : 0; } catch(_) { conf = 0; }
            const score = (match ? match[0].length : 0) + (conf / 100);
            if (score > best.score) {
                best = { score, text, match: match ? match[0] : null, processed };
            }
        } catch (e) {
            console.warn('OCR intento error', e);
        }

        // Esperar antes del siguiente intento
        await new Promise(r => setTimeout(r, delayMs));
    }

    // Resultado final
    if (best.match) {
        const input = document.getElementById('current-reading');
        if (input) input.value = best.match;
        if (feedback) { feedback.textContent = 'Lectura detectada: ' + best.match; feedback.style.color = '#080'; }
        try { const rawTextEl = document.getElementById('ocr-raw-text'); if (rawTextEl) rawTextEl.textContent = 'Texto OCR (mejor): ' + (best.text || '(vacío)'); } catch(e){}
        try { const preview = document.getElementById('ocr-processed-preview'); if (preview && best.processed) { preview.width = best.processed.width; preview.height = best.processed.height; preview.getContext('2d').drawImage(best.processed,0,0); } } catch(e){}
    } else {
        if (feedback) { feedback.textContent = 'No se detectó número después de ' + attempts + ' intentos. Intenta mejorar iluminación o acercar.'; feedback.style.color = '#c00'; }
    }

    // cerrar overlay
    closeCameraOverlay();
}

function closeCameraOverlay() {
    try {
        if (__consumo_videoStream) {
            __consumo_videoStream.getTracks().forEach(t => t.stop());
            __consumo_videoStream = null;
        }
        if (__consumo_videoEl) {
            __consumo_videoEl.pause();
            __consumo_videoEl.srcObject = null;
        }
        if (__consumo_overlayEl) {
            __consumo_overlayEl.remove();
            __consumo_overlayEl = null;
            __consumo_videoEl = null;
        }
    } catch (e) { console.warn('closeCameraOverlay', e); }
}

async function captureAndRead() {
    const feedback = document.getElementById('reading-feedback');
    if (feedback) { feedback.textContent = 'Procesando imagen...'; feedback.style.color = '#000'; }

    // Crear canvas temporal
    const canvas = document.createElement('canvas');
    canvas.width = __consumo_videoEl.videoWidth || 1280;
    canvas.height = __consumo_videoEl.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(__consumo_videoEl, 0, 0, canvas.width, canvas.height);

    // Opcional: recortar centro o aplicar procesamiento si deseas mejorar OCR
    try {
        if (typeof Tesseract === 'undefined') {
            if (feedback) { feedback.textContent = 'OCR no disponible (Tesseract no cargado).'; feedback.style.color = '#c00'; }
            return;
        }

        // Preprocesar: recortar el centro y mejorar contraste para mejorar OCR
        const processed = preprocessForOCR(canvas);

        // Mostrar preview procesado en overlay para depuración
        try {
            const preview = document.getElementById('ocr-processed-preview');
            if (preview && processed) {
                preview.width = processed.width;
                preview.height = processed.height;
                const pctx = preview.getContext('2d');
                pctx.clearRect(0,0,preview.width, preview.height);
                pctx.drawImage(processed, 0, 0);
            }
        } catch(e){ console.warn('preview draw failed', e); }

        // Usar Tesseract para reconocer texto (limitar caracteres a dígitos y punto ayuda)
        const result = await Tesseract.recognize(processed, 'eng', { logger: m => console.log(m), tessedit_char_whitelist: '0123456789.' });
        const text = result && result.data && result.data.text ? result.data.text : '';
        console.log('OCR result raw:', text);
        // Mostrar texto crudo de OCR en overlay
        try {
            const rawTextEl = document.getElementById('ocr-raw-text');
            if (rawTextEl) rawTextEl.textContent = 'Texto OCR: ' + (text || '(vacío)');
        } catch(e){ }

        // Buscar primer número decimal en el texto (reemplaza comas/espacios por punto)
        const match = text.replace(/[\s,]+/g, '.').match(/\d+(?:\.\d+)?/);
        if (match) {
            const num = match[0];
            const input = document.getElementById('current-reading');
            if (input) {
                input.value = num;
                if (feedback) { feedback.textContent = 'Lectura detectada: ' + num; feedback.style.color = '#080'; }
            }
        } else {
            if (feedback) { feedback.textContent = 'No se detectó un número en la imagen. Intenta otra vez con mejor iluminación o acercando la cámara.'; feedback.style.color = '#c00'; }
        }
    } catch (err) {
        console.error('OCR error', err);
        if (feedback) { feedback.textContent = 'Error realizando OCR.'; feedback.style.color = '#c00'; }
    } finally {
        closeCameraOverlay();
    }
}

// Preprocesado simple para OCR: recorta centro, escala, pasa a gris, aumenta contraste y binariza
function preprocessForOCR(srcCanvas) {
    const w = srcCanvas.width;
    const h = srcCanvas.height;

    // Recortar una región central (ajustable). Aquí 70% ancho x 40% alto centrado
    const cropW = Math.floor(w * 0.7);
    const cropH = Math.floor(h * 0.4);
    const cropX = Math.floor((w - cropW) / 2);
    const cropY = Math.floor((h - cropH) / 2);

    const tmp = document.createElement('canvas');
    // Escalar para mejorar OCR (2x)
    tmp.width = cropW * 2;
    tmp.height = cropH * 2;
    const tctx = tmp.getContext('2d');

    // Dibujar recorte escalado
    tctx.drawImage(srcCanvas, cropX, cropY, cropW, cropH, 0, 0, tmp.width, tmp.height);

    // Obtener datos y convertir a gris
    const img = tctx.getImageData(0, 0, tmp.width, tmp.height);
    const data = img.data;
    // Convertir a escala de grises y calcular histograma
    let sum = 0;
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        // luminancia
        const l = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        const v = Math.round(l);
        hist[v]++;
        sum += v;
        data[i] = data[i+1] = data[i+2] = v;
    }
    // Umbral aproximado: media luminancia
    const avg = sum / (tmp.width * tmp.height);
    let threshold = Math.max(100, Math.floor(avg * 0.9));

    // Aplicar binarización simple y ligero aumento de contraste antes
    for (let i = 0; i < data.length; i += 4) {
        let v = data[i];
        // aumentar contraste: stretch around 128
        v = ((v - 128) * 1.2) + 128;
        v = Math.max(0, Math.min(255, v));
        const bin = v > threshold ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = bin;
    }
    tctx.putImageData(img, 0, 0);
    return tmp;
}

// Exportar funciones de cámara a window
window.openCameraForRead = openCameraForRead;
window.closeCameraOverlay = closeCameraOverlay;
window.captureAndRead = captureAndRead;
