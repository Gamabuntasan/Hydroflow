/**
 * Función que simula el comportamiento de un href
 * @param {string} url - La URL a la que se debe navegar.
 * @param {boolean} [showAlert=false] - Opcional: Si se debe mostrar una alerta antes de navegar.
 */
function navegarA(url, showAlert = false) {
    if (showAlert) {
        alert('Redireccionando a: ' + url);
    }
    
    // La clave para la navegación es cambiar la propiedad window.location.href
    window.location.href = url;
}

/**
 * Función para crear una nueva cuenta de usuario usando Firebase Auth
 */
function crearCuenta() {
    // Obtener los valores de los campos
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    // Validaciones básicas
    if (!email || !password) {
        alert('Por favor, complete todos los campos');
        return;
    }

    if (password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    // Comprobaciones de inicialización de Firebase
    if (typeof firebase === 'undefined') {
        alert('Firebase no está cargado. Verifica que los scripts de Firebase estén incluidos en el HTML.');
        console.error('Firebase object not found');
        return;
    }

    if (!firebase.apps || firebase.apps.length === 0) {
        alert('Firebase no se ha inicializado. Revisa firebaseConfig en tu HTML.');
        console.error('No firebase apps initialized', firebase.apps);
        return;
    }

    if (typeof auth === 'undefined' || !auth) {
        alert('Firebase Auth no está disponible. Asegúrate de inicializar auth en el HTML (const auth = firebase.auth()).');
        console.error('Auth object not found');
        return;
    }

    // Crear usuario en Firebase (compat)
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Usuario creado exitosamente
            alert('¡Cuenta creada exitosamente!');
            // Redirigir a la página de inicio de sesión
            window.location.href = 'index.html';
        })
        .catch((error) => {
            // Manejar errores con mensajes más útiles
            console.error('createUser error', error);
            if (error && error.code === 'auth/configuration-not-found') {
                alert('Error: configuración de autenticación no encontrada.\n\nPasos para resolver:\n1) En la consola de Firebase, ve a Authentication → Sign-in method y habilita "Email/Password".\n2) En Authentication → Settings, añade tu dominio (ej. localhost) en "Authorized domains".\n3) Verifica que los valores de firebaseConfig (apiKey, authDomain, projectId) coincidan con tu proyecto en la consola de Firebase.');
                return;
            }

            let mensajeError = 'Error al crear la cuenta: ';
            switch (error && error.code) {
                case 'auth/email-already-in-use':
                    mensajeError += 'El correo electrónico ya está registrado';
                    break;
                case 'auth/invalid-email':
                    mensajeError += 'El correo electrónico no es válido';
                    break;
                case 'auth/weak-password':
                    mensajeError += 'La contraseña es demasiado débil';
                    break;
                default:
                    mensajeError += (error && error.message) ? error.message : 'Error desconocido';
            }
            alert(mensajeError);
        });
}

/**
 * Genera una ventana de impresión que simula un PDF vacío.
 * Este método abre una nueva ventana, añade contenido (opcional) 
 * y llama al diálogo de impresión del navegador.
 */
function imprimirPDFVacio() {
    
    // 1. Abre una nueva ventana/pestaña
    const printWindow = window.open('', '_blank');

    // Verifica si la ventana se abrió correctamente
    if (!printWindow) {
        alert("El navegador bloqueó la ventana emergente. Por favor, permítalas para generar el PDF.");
        return;
    }

    // 2. Define el contenido básico del "PDF"
    const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte HydroFlow Vacio</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #004c8c; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
                /* Oculta los elementos que no quieres imprimir (como el pie de página del navegador) */
                @media print {
                    @page { margin: 1in; }
                }
            </style>
        </head>
        <body>
            <h1>Reporte de HydroFlow</h1>
            <p><strong>Generado el:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
            <p>Este documento simula la generación de un reporte en formato PDF.</p>
            
            <div style="height: 400px; border: 1px solid #ddd; padding: 15px; margin-top: 30px;">
                Espacio reservado para el contenido del informe. (Actualmente vacío)
            </div>
        </body>
        </html>
    `;

    // 3. Escribe el contenido en la nueva ventana
    printWindow.document.write(content);
    printWindow.document.close(); // Cierra el stream de escritura

    // 4. Llama al comando de impresión
    // Se añade un pequeño retardo para asegurar que el contenido se cargue completamente antes de imprimir
    setTimeout(() => {
        printWindow.print();
        // Opcional: cierra la ventana después de que el usuario interactúa (si el navegador lo permite)
        // printWindow.close(); 
    }, 500); 
}

/**
 * Función para iniciar sesión con Firebase Auth (compat)
 */
function iniciarSesion() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const feedbackEl = document.getElementById('login-feedback');
    const btn = document.getElementById('login-button');
    if (feedbackEl) feedbackEl.textContent = '';

    if (!email || !password) {
        if (feedbackEl) feedbackEl.textContent = 'Por favor, complete todos los campos.';
        return;
    }

    // Comprobaciones de Firebase (reutiliza los mensajes útiles)
    if (typeof firebase === 'undefined') {
        if (feedbackEl) feedbackEl.textContent = 'Error interno: Firebase no cargado.';
        console.error('Firebase object not found');
        return;
    }

    if (!firebase.apps || firebase.apps.length === 0) {
        if (feedbackEl) feedbackEl.textContent = 'Error interno: Firebase no inicializado.';
        console.error('No firebase apps initialized', firebase.apps);
        return;
    }

    if (typeof auth === 'undefined' || !auth) {
        if (feedbackEl) feedbackEl.textContent = 'Error interno: Firebase Auth no disponible.';
        console.error('Auth object not found');
        return;
    }

    // Deshabilitar botón y mostrar estado
    let originalText = null;
    if (btn) {
        originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Iniciando...';
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Inicio de sesión exitoso
            if (feedbackEl) feedbackEl.style.color = '#080';
            if (feedbackEl) feedbackEl.textContent = 'Inicio de sesión correcto. Redirigiendo...';
            // Redirigir a la página principal de la app (cambiar si corresponde)
            setTimeout(() => { window.location.href = 'main.html'; }, 800);
        })
        .catch((error) => {
            console.error('signIn error', error);
            if (error && error.code === 'auth/configuration-not-found') {
                const msg = 'Configuración de autenticación no encontrada. Habilita Email/Password y añade tu dominio en la consola de Firebase.';
                if (feedbackEl) feedbackEl.textContent = msg;
                alert('Error: configuración de autenticación no encontrada. Revisa la consola de Firebase.');
                return;
            }

            let mensaje = '';
            switch (error && error.code) {
                case 'auth/user-not-found':
                    mensaje = 'Usuario no encontrado. ¿Quieres crear una cuenta?';
                    break;
                case 'auth/wrong-password':
                    mensaje = 'Contraseña incorrecta. Intenta nuevamente.';
                    break;
                case 'auth/invalid-email':
                    mensaje = 'El correo ingresado no es válido.';
                    break;
                case 'auth/network-request-failed':
                    mensaje = 'Fallo de red. Verifica tu conexión e intenta de nuevo.';
                    break;
                default:
                    mensaje = (error && error.message) ? error.message : 'Error desconocido al iniciar sesión.';
            }

            if (feedbackEl) {
                feedbackEl.style.color = '#c00';
                feedbackEl.textContent = mensaje;
            }
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalText || 'Iniciar Sesión';
            }
        });
}

/**
 * Función para enviar correo de restablecimiento de contraseña usando Firebase Auth
 */
function enviarResetPassword() {
    const email = document.getElementById('correo').value;

    if (!email) {
        alert('Por favor, ingresa tu correo electrónico.');
        return;
    }

    // Comprobaciones de Firebase
    if (typeof firebase === 'undefined') {
        alert('Firebase no está cargado. Verifica que los scripts de Firebase estén incluidos en el HTML.');
        console.error('Firebase object not found');
        return;
    }

    if (!firebase.apps || firebase.apps.length === 0) {
        alert('Firebase no se ha inicializado. Revisa firebaseConfig en tu HTML.');
        console.error('No firebase apps initialized', firebase.apps);
        return;
    }

    if (typeof auth === 'undefined' || !auth) {
        alert('Firebase Auth no está disponible. Asegúrate de inicializar auth en el HTML (const auth = firebase.auth()).');
        console.error('Auth object not found');
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert('Si tienes una cuenta activa, se te enviará un correo de restablecimiento de contraseña en los próximos minutos.');
        })
        .catch((error) => {
            console.error('sendPasswordResetEmail error', error);
            let mensajeError = 'Error al enviar el correo de restablecimiento: ';
            switch (error && error.code) {
                case 'auth/user-not-found':
                    mensajeError += 'No se encontró una cuenta con ese correo electrónico.';
                    break;
                case 'auth/invalid-email':
                    mensajeError += 'El correo electrónico no es válido.';
                    break;
                case 'auth/network-request-failed':
                    mensajeError += 'Fallo de red. Verifica tu conexión e intenta de nuevo.';
                    break;
                default:
                    mensajeError += (error && error.message) ? error.message : 'Error desconocido';
            }
            alert(mensajeError);
        });
}
